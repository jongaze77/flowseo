// @ts-nocheck
import { jest } from '@jest/globals';
import { ExternalToolMapper } from '../externalToolMapper';

describe('ExternalToolMapper', () => {
  let mapper: ExternalToolMapper;

  beforeEach(() => {
    mapper = new ExternalToolMapper();
  });

  describe('detectTool', () => {
    it('should detect Semrush format correctly', () => {
      const headers = ['keyword', 'search volume', 'kd', 'cpc', 'competition level', 'serp features'];

      const result = mapper.detectTool(headers);

      expect(result.detectedTool).toBe('semrush');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect Ahrefs format correctly', () => {
      const headers = ['keyword', 'search volume', 'keyword difficulty', 'parent topic', 'traffic potential'];

      const result = mapper.detectTool(headers);

      expect(result.detectedTool).toBe('ahrefs');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect Google Keyword Planner format correctly', () => {
      const headers = ['keyword', 'avg. monthly searches', 'competition', 'competition (indexed value)'];

      const result = mapper.detectTool(headers);

      expect(result.detectedTool).toBe('google_keyword_planner');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.errors).toHaveLength(0);
    });

    it('should return unknown for unrecognized format', () => {
      const headers = ['term', 'count', 'difficulty'];

      const result = mapper.detectTool(headers);

      expect(result.detectedTool).toBe('unknown');
      expect(result.confidence).toBeLessThan(0.5);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Could not automatically detect');
    });

    it('should require keyword column for any tool', () => {
      const headers = ['search volume', 'kd', 'cpc']; // Missing keyword column

      const result = mapper.detectTool(headers);

      expect(result.detectedTool).toBe('unknown');
      expect(result.confidence).toBe(0);
    });

    it('should handle case-insensitive headers', () => {
      const headers = ['KEYWORD', 'SEARCH VOLUME', 'KD', 'CPC'];

      const result = mapper.detectTool(headers);

      expect(result.detectedTool).toBe('semrush');
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('createManualMapping', () => {
    it('should create manual mapping correctly', () => {
      const headers = ['term', 'monthly_searches', 'difficulty_score'];
      const columnMappings = {
        'term': 'keyword',
        'monthly_searches': 'searchVolume',
        'difficulty_score': 'difficulty'
      };

      const result = mapper.createManualMapping(headers, columnMappings);

      expect(result.detectedTool).toBe('unknown');
      expect(result.confidence).toBe(1.0);
      expect(result.mappings).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
    });

    it('should require keyword mapping in manual mode', () => {
      const headers = ['term', 'volume'];
      const columnMappings = {
        'term': 'ignore',
        'volume': 'searchVolume'
      };

      const result = mapper.createManualMapping(headers, columnMappings);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Keyword column mapping is required');
    });

    it('should ignore unmapped columns', () => {
      const headers = ['keyword', 'volume', 'extra_column'];
      const columnMappings = {
        'keyword': 'keyword',
        'volume': 'searchVolume'
        // extra_column not mapped
      };

      const result = mapper.createManualMapping(headers, columnMappings);

      expect(result.unmappedColumns).toContain('extra_column');
      expect(result.mappings).toHaveLength(2);
    });
  });

  describe('mapRowData', () => {
    it('should map row data correctly with Semrush mappings', () => {
      const row = {
        'keyword': 'test keyword',
        'search volume': '1000',
        'kd': '45.5',
        'cpc': '2.50'
      };

      const mappings = [
        { sourceColumn: 'keyword', targetField: 'keyword', required: true },
        { sourceColumn: 'search volume', targetField: 'searchVolume', required: false, transform: (val) => parseInt(val) },
        { sourceColumn: 'kd', targetField: 'difficulty', required: false, transform: (val) => parseFloat(val) },
        { sourceColumn: 'cpc', targetField: 'cpc', required: false, transform: (val) => parseFloat(val) }
      ];

      const result = mapper.mapRowData(row, mappings);

      expect(result).not.toBeNull();
      expect(result?.keyword).toBe('test keyword');
      expect(result?.searchVolume).toBe(1000);
      expect(result?.difficulty).toBe(45.5);
      expect(result?.externalToolData.cpc).toBe(2.5);
    });

    it('should return null for rows without keyword', () => {
      const row = {
        'search volume': '1000',
        'kd': '45.5'
      };

      const mappings = [
        { sourceColumn: 'keyword', targetField: 'keyword', required: true },
        { sourceColumn: 'search volume', targetField: 'searchVolume', required: false }
      ];

      const result = mapper.mapRowData(row, mappings);

      expect(result).toBeNull();
    });

    it('should handle Google Keyword Planner volume ranges', () => {
      const row = {
        'keyword': 'test keyword',
        'avg. monthly searches': '1K - 10K'
      };

      const mappings = [
        { sourceColumn: 'keyword', targetField: 'keyword', required: true },
        { sourceColumn: 'avg. monthly searches', targetField: 'searchVolume', required: false, transform: (val) => {
          // Simplified version of parseGoogleVolume
          if (val.includes(' - ')) {
            const [low, high] = val.split(' - ');
            const lowNum = parseFloat(low.replace('K', '')) * 1000;
            const highNum = parseFloat(high.replace('K', '')) * 1000;
            return Math.round((lowNum + highNum) / 2);
          }
          return parseInt(val);
        }}
      ];

      const result = mapper.mapRowData(row, mappings);

      expect(result).not.toBeNull();
      expect(result?.searchVolume).toBe(5500); // Average of 1K and 10K
    });
  });

  describe('validateMappedData', () => {
    it('should validate mapped data successfully', () => {
      const data = [
        {
          keyword: 'test keyword',
          searchVolume: 1000,
          difficulty: 45.5,
          externalToolData: { cpc: 2.5 },
          toolSource: 'semrush' as const
        }
      ];

      const schema = {
        tool: 'semrush' as const,
        confidence: 1.0,
        requiredColumns: ['keyword'],
        optionalColumns: ['search volume', 'kd'],
        columnMappings: [],
        valueValidators: {
          keyword: { safeParse: () => ({ success: true }) },
          searchVolume: { safeParse: () => ({ success: true }) },
          difficulty: { safeParse: () => ({ success: true }) }
        }
      };

      const errors = mapper.validateMappedData(data, schema);

      expect(errors).toHaveLength(0);
    });

    it('should report validation errors for invalid data', () => {
      const data = [
        {
          keyword: '', // Empty keyword
          searchVolume: -100, // Invalid volume
          difficulty: 150, // Invalid difficulty
          externalToolData: {},
          toolSource: 'semrush' as const
        }
      ];

      const schema = {
        tool: 'semrush' as const,
        confidence: 1.0,
        requiredColumns: ['keyword'],
        optionalColumns: [],
        columnMappings: [],
        valueValidators: {
          keyword: {
            safeParse: (val) => val ? { success: true } : { success: false, error: { errors: [{ message: 'Required' }] } }
          },
          searchVolume: {
            safeParse: (val) => val >= 0 ? { success: true } : { success: false, error: { errors: [{ message: 'Must be positive' }] } }
          },
          difficulty: {
            safeParse: (val) => val <= 100 ? { success: true } : { success: false, error: { errors: [{ message: 'Must be <= 100' }] } }
          }
        }
      };

      const errors = mapper.validateMappedData(data, schema);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.column === 'keyword')).toBe(true);
      expect(errors.some(e => e.column === 'searchVolume')).toBe(true);
      expect(errors.some(e => e.column === 'difficulty')).toBe(true);
    });
  });
});