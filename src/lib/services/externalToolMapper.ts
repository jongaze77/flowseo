import { z } from 'zod';

export type ExternalTool = 'semrush' | 'ahrefs' | 'google_keyword_planner' | 'unknown';

export interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  transform?: (value: any) => any;
  required: boolean;
}

export interface ToolSchemaDefinition {
  tool: ExternalTool;
  confidence: number;
  requiredColumns: string[];
  optionalColumns: string[];
  columnMappings: ColumnMapping[];
  valueValidators: Record<string, z.ZodSchema>;
}

export interface MappingResult {
  detectedTool: ExternalTool;
  confidence: number;
  mappings: ColumnMapping[];
  unmappedColumns: string[];
  errors: MappingError[];
  previewData?: MappedKeywordData[];
}

export interface MappingError {
  column: string;
  row?: number;
  message: string;
  type: 'missing_required' | 'invalid_format' | 'validation_failed';
}

export interface MappedKeywordData {
  keyword: string;
  searchVolume?: number;
  difficulty?: number;
  region?: string;
  externalToolData: Record<string, any>;
  toolSource: ExternalTool;
}

// Schema definitions for each external tool
const SEMRUSH_SCHEMA: ToolSchemaDefinition = {
  tool: 'semrush',
  confidence: 0,
  requiredColumns: ['keyword'],
  optionalColumns: ['search volume', 'kd', 'cpc', 'competition level', 'results', 'intent', 'position', 'previous position', 'change', 'serp features'],
  columnMappings: [
    { sourceColumn: 'keyword', targetField: 'keyword', required: true },
    { sourceColumn: 'search volume', targetField: 'searchVolume', required: false, transform: parseNumeric },
    { sourceColumn: 'kd', targetField: 'difficulty', required: false, transform: parseNumeric },
    { sourceColumn: 'cpc', targetField: 'cpc', required: false, transform: parseNumeric },
    { sourceColumn: 'competition level', targetField: 'competitionLevel', required: false },
    { sourceColumn: 'results', targetField: 'results', required: false, transform: parseNumeric },
    { sourceColumn: 'intent', targetField: 'intent', required: false },
    { sourceColumn: 'position', targetField: 'position', required: false, transform: parseNumeric },
    { sourceColumn: 'previous position', targetField: 'previousPosition', required: false, transform: parseNumeric },
    { sourceColumn: 'change', targetField: 'change', required: false },
    { sourceColumn: 'serp features', targetField: 'serpFeatures', required: false }
  ],
  valueValidators: {
    keyword: z.string().min(1).max(255),
    searchVolume: z.number().min(0).optional(),
    difficulty: z.number().min(0).max(100).optional(),
    cpc: z.number().min(0).optional()
  }
};

const AHREFS_SCHEMA: ToolSchemaDefinition = {
  tool: 'ahrefs',
  confidence: 0,
  requiredColumns: ['keyword'],
  optionalColumns: ['search volume', 'keyword difficulty', 'cpc', 'parent topic', 'traffic potential', 'return rate', 'clicks'],
  columnMappings: [
    { sourceColumn: 'keyword', targetField: 'keyword', required: true },
    { sourceColumn: 'search volume', targetField: 'searchVolume', required: false, transform: parseNumeric },
    { sourceColumn: 'keyword difficulty', targetField: 'difficulty', required: false, transform: parseNumeric },
    { sourceColumn: 'cpc', targetField: 'cpc', required: false, transform: parseNumeric },
    { sourceColumn: 'parent topic', targetField: 'parentTopic', required: false },
    { sourceColumn: 'traffic potential', targetField: 'trafficPotential', required: false, transform: parseNumeric },
    { sourceColumn: 'return rate', targetField: 'returnRate', required: false, transform: parseNumeric },
    { sourceColumn: 'clicks', targetField: 'clicks', required: false, transform: parseNumeric }
  ],
  valueValidators: {
    keyword: z.string().min(1).max(255),
    searchVolume: z.number().min(0).optional(),
    difficulty: z.number().min(0).max(100).optional(),
    cpc: z.number().min(0).optional()
  }
};

const GOOGLE_KEYWORD_PLANNER_SCHEMA: ToolSchemaDefinition = {
  tool: 'google_keyword_planner',
  confidence: 0,
  requiredColumns: ['keyword'],
  optionalColumns: ['avg. monthly searches', 'competition', 'competition (indexed value)', 'top of page bid (low range)', 'top of page bid (high range)'],
  columnMappings: [
    { sourceColumn: 'keyword', targetField: 'keyword', required: true },
    { sourceColumn: 'avg. monthly searches', targetField: 'searchVolume', required: false, transform: parseGoogleVolume },
    { sourceColumn: 'competition', targetField: 'competition', required: false },
    { sourceColumn: 'competition (indexed value)', targetField: 'competitionIndex', required: false, transform: parseNumeric },
    { sourceColumn: 'top of page bid (low range)', targetField: 'topBidLow', required: false, transform: parseNumeric },
    { sourceColumn: 'top of page bid (high range)', targetField: 'topBidHigh', required: false, transform: parseNumeric }
  ],
  valueValidators: {
    keyword: z.string().min(1).max(255),
    searchVolume: z.number().min(0).optional(),
    competition: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
    competitionIndex: z.number().min(0).max(1).optional()
  }
};

// Transform functions
function parseNumeric(value: any): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;

  // Handle string values that might contain commas or other formatting
  const stringValue = value.toString().replace(/[,$%]/g, '');
  const numeric = parseFloat(stringValue);

  return isNaN(numeric) ? undefined : numeric;
}

function parseGoogleVolume(value: any): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;

  const stringValue = value.toString().toLowerCase();

  // Handle Google's range format (e.g., "1K - 10K")
  if (stringValue.includes(' - ')) {
    const [low, high] = stringValue.split(' - ');
    const lowNum = parseGoogleVolumeValue(low);
    const highNum = parseGoogleVolumeValue(high);

    if (lowNum !== undefined && highNum !== undefined) {
      return Math.round((lowNum + highNum) / 2);
    }
  }

  return parseGoogleVolumeValue(stringValue);
}

function parseGoogleVolumeValue(value: string): number | undefined {
  if (!value) return undefined;

  value = value.trim().toLowerCase();

  // Handle K (thousands) and M (millions) suffixes
  if (value.endsWith('k')) {
    const num = parseFloat(value.slice(0, -1));
    return isNaN(num) ? undefined : num * 1000;
  }

  if (value.endsWith('m')) {
    const num = parseFloat(value.slice(0, -1));
    return isNaN(num) ? undefined : num * 1000000;
  }

  // Handle regular numbers with commas
  const cleanValue = value.replace(/[,$]/g, '');
  const numeric = parseFloat(cleanValue);

  return isNaN(numeric) ? undefined : numeric;
}

export class ExternalToolMapper {
  private schemas: ToolSchemaDefinition[] = [
    SEMRUSH_SCHEMA,
    AHREFS_SCHEMA,
    GOOGLE_KEYWORD_PLANNER_SCHEMA
  ];

  detectTool(headers: string[]): MappingResult {
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
    let bestMatch: ToolSchemaDefinition | null = null;
    let highestConfidence = 0;

    // Calculate confidence scores for each tool schema
    for (const schema of this.schemas) {
      const confidence = this.calculateConfidence(normalizedHeaders, schema);
      if (confidence > highestConfidence) {
        highestConfidence = confidence;
        bestMatch = schema;
      }
    }

    if (!bestMatch || highestConfidence < 0.5) {
      return {
        detectedTool: 'unknown',
        confidence: highestConfidence,
        mappings: [],
        unmappedColumns: headers,
        errors: [{
          column: 'general',
          message: 'Could not automatically detect external tool format. Manual mapping required.',
          type: 'missing_required'
        }]
      };
    }

    return this.createMapping(headers, bestMatch, highestConfidence);
  }

  private calculateConfidence(headers: string[], schema: ToolSchemaDefinition): number {
    const totalColumns = schema.requiredColumns.length + schema.optionalColumns.length;
    let matchedColumns = 0;
    let requiredMatches = 0;

    // Check required columns
    for (const required of schema.requiredColumns) {
      if (headers.includes(required.toLowerCase())) {
        matchedColumns++;
        requiredMatches++;
      }
    }

    // Check optional columns
    for (const optional of schema.optionalColumns) {
      if (headers.includes(optional.toLowerCase())) {
        matchedColumns++;
      }
    }

    // Require all required columns to be present
    if (requiredMatches < schema.requiredColumns.length) {
      return 0;
    }

    // Calculate confidence based on column matches
    const columnScore = matchedColumns / totalColumns;

    // Bonus points for tool-specific column patterns
    const bonusScore = this.calculateToolSpecificBonus(headers, schema.tool);

    return Math.min(columnScore + bonusScore, 1.0);
  }

  private calculateToolSpecificBonus(headers: string[], tool: ExternalTool): number {
    const headerString = headers.join(' ').toLowerCase();

    switch (tool) {
      case 'semrush':
        if (headerString.includes('kd') || headerString.includes('serp features')) {
          return 0.2;
        }
        break;
      case 'ahrefs':
        if (headerString.includes('parent topic') || headerString.includes('traffic potential')) {
          return 0.2;
        }
        break;
      case 'google_keyword_planner':
        if (headerString.includes('avg. monthly searches') || headerString.includes('indexed value')) {
          return 0.2;
        }
        break;
    }

    return 0;
  }

  private createMapping(headers: string[], schema: ToolSchemaDefinition, confidence: number): MappingResult {
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
    const mappings: ColumnMapping[] = [];
    const unmappedColumns: string[] = [];
    const errors: MappingError[] = [];

    // Create mappings for matched columns
    for (const mapping of schema.columnMappings) {
      const sourceIndex = normalizedHeaders.indexOf(mapping.sourceColumn.toLowerCase());
      if (sourceIndex !== -1) {
        mappings.push({
          ...mapping,
          sourceColumn: headers[sourceIndex] // Use original header case
        });
      } else if (mapping.required) {
        errors.push({
          column: mapping.sourceColumn,
          message: `Required column '${mapping.sourceColumn}' not found`,
          type: 'missing_required'
        });
      }
    }

    // Find unmapped columns
    const mappedSources = new Set(mappings.map(m => m.sourceColumn.toLowerCase()));
    unmappedColumns.push(...headers.filter(h => !mappedSources.has(h.toLowerCase())));

    return {
      detectedTool: schema.tool,
      confidence,
      mappings,
      unmappedColumns,
      errors
    };
  }

  createManualMapping(headers: string[], columnMappings: Record<string, string>): MappingResult {
    const mappings: ColumnMapping[] = [];
    const unmappedColumns: string[] = [];
    const errors: MappingError[] = [];

    // Create mappings based on user selections
    for (const [sourceColumn, targetField] of Object.entries(columnMappings)) {
      if (headers.includes(sourceColumn) && targetField !== 'ignore') {
        mappings.push({
          sourceColumn,
          targetField,
          required: targetField === 'keyword',
          transform: this.getTransformFunction(targetField)
        });
      }
    }

    // Find unmapped columns
    const mappedSources = new Set(mappings.map(m => m.sourceColumn));
    unmappedColumns.push(...headers.filter(h => !mappedSources.has(h)));

    // Validate required mappings
    const hasKeywordMapping = mappings.some(m => m.targetField === 'keyword');
    if (!hasKeywordMapping) {
      errors.push({
        column: 'keyword',
        message: 'Keyword column mapping is required',
        type: 'missing_required'
      });
    }

    return {
      detectedTool: 'unknown',
      confidence: 1.0, // Manual mapping is 100% confident
      mappings,
      unmappedColumns,
      errors
    };
  }

  private getTransformFunction(targetField: string): ((value: any) => any) | undefined {
    switch (targetField) {
      case 'searchVolume':
      case 'difficulty':
      case 'cpc':
      case 'position':
      case 'previousPosition':
      case 'results':
      case 'trafficPotential':
      case 'returnRate':
      case 'clicks':
      case 'competitionIndex':
      case 'topBidLow':
      case 'topBidHigh':
        return parseNumeric;
      default:
        return undefined;
    }
  }

  mapRowData(row: Record<string, any>, mappings: ColumnMapping[]): MappedKeywordData | null {
    const mappedData: Record<string, any> = {};
    const externalToolData: Record<string, any> = {};
    let keyword = '';

    for (const mapping of mappings) {
      const sourceValue = row[mapping.sourceColumn];
      let targetValue = sourceValue;

      // Apply transformation if specified
      if (mapping.transform) {
        targetValue = mapping.transform(sourceValue);
      }

      // Map to standard fields or external tool data
      switch (mapping.targetField) {
        case 'keyword':
          keyword = targetValue?.toString().trim() || '';
          break;
        case 'searchVolume':
          mappedData.searchVolume = targetValue;
          break;
        case 'difficulty':
          mappedData.difficulty = targetValue;
          break;
        default:
          externalToolData[mapping.targetField] = targetValue;
          break;
      }
    }

    // Require keyword to be present
    if (!keyword) {
      return null;
    }

    return {
      keyword,
      searchVolume: mappedData.searchVolume,
      difficulty: mappedData.difficulty,
      externalToolData,
      toolSource: 'unknown' // Will be set by the caller based on detected tool
    };
  }

  validateMappedData(data: MappedKeywordData[], schema?: ToolSchemaDefinition): MappingError[] {
    const errors: MappingError[] = [];

    data.forEach((row, index) => {
      const rowNumber = index + 2; // +2 for header and 0-based index

      // Validate keyword presence
      if (!row.keyword || row.keyword.trim() === '') {
        errors.push({
          column: 'keyword',
          row: rowNumber,
          message: 'Keyword is required and cannot be empty',
          type: 'validation_failed'
        });
      }

      // Validate using schema if provided
      if (schema) {
        for (const [field, validator] of Object.entries(schema.valueValidators)) {
          const value = field === 'keyword' ? row.keyword :
                       field === 'searchVolume' ? row.searchVolume :
                       field === 'difficulty' ? row.difficulty :
                       row.externalToolData[field];

          const result = validator.safeParse(value);
          if (!result.success) {
            errors.push({
              column: field,
              row: rowNumber,
              message: `Invalid ${field}: ${result.error.errors[0]?.message || 'validation failed'}`,
              type: 'validation_failed'
            });
          }
        }
      }
    });

    return errors;
  }
}

export const externalToolMapper = new ExternalToolMapper();