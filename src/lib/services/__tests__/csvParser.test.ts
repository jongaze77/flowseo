// @ts-nocheck
import { jest } from '@jest/globals';
import { CSVParser } from '../csvParser';

// Mock Papa Parse
jest.mock('papaparse', () => ({
  default: {
    parse: jest.fn()
  }
}));

import Papa from 'papaparse';

// Mock FileReader for Node.js environment
global.FileReader = class MockFileReader {
  result: any = null;
  onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;

  readAsArrayBuffer(file: Blob) {
    // Simulate async behavior
    setTimeout(() => {
      this.result = new ArrayBuffer(8);
      if (this.onload) {
        this.onload.call(this, {} as ProgressEvent<FileReader>);
      }
    }, 0);
  }
} as any;

describe('CSVParser', () => {
  let csvParser: CSVParser;

  beforeEach(() => {
    jest.clearAllMocks();
    csvParser = new CSVParser({
      maxFileSize: 10 * 1024 * 1024, // 10MB for testing
      allowedEncodings: ['UTF-8', 'ISO-8859-1'],
      skipEmptyLines: true,
      trimHeaders: true
    });
  });

  describe('parseFile', () => {
    it('should parse a valid CSV file successfully', async () => {
      const mockFile = new File(['keyword,volume\ntest keyword,1000'], 'test.csv', {
        type: 'text/csv'
      });

      const mockResults = {
        data: [
          { keyword: 'test keyword', volume: '1000' }
        ],
        errors: [],
        meta: {
          fields: ['keyword', 'volume']
        }
      };

      (Papa.parse as jest.Mock).mockImplementation((file, options) => {
        setTimeout(() => {
          options.complete(mockResults);
        }, 0);
      });

      const result = await csvParser.parseFile(mockFile);

      expect(result.data).toHaveLength(1);
      expect(result.headers).toEqual(['keyword', 'volume']);
      expect(result.errors).toHaveLength(0);
      expect(result.meta.hasHeaders).toBe(true);
    });

    it('should reject files that are too large', async () => {
      const mockFile = new File(['x'.repeat(20 * 1024 * 1024)], 'large.csv', {
        type: 'text/csv'
      });

      await expect(csvParser.parseFile(mockFile)).rejects.toThrow(
        'File size exceeds maximum allowed size of 10MB'
      );
    });

    it('should reject invalid file types', async () => {
      const mockFile = new File(['content'], 'test.txt', {
        type: 'text/plain'
      });

      await expect(csvParser.parseFile(mockFile)).rejects.toThrow(
        'Invalid file type. Only CSV files are allowed.'
      );
    });

    it('should handle CSV parsing errors', async () => {
      const mockFile = new File(['invalid,csv\ndata'], 'test.csv', {
        type: 'text/csv'
      });

      const mockResults = {
        data: [],
        errors: [
          { row: 1, message: 'Parse error', type: 'Quotes' }
        ],
        meta: {
          fields: ['invalid', 'csv']
        }
      };

      (Papa.parse as jest.Mock).mockImplementation((file, options) => {
        setTimeout(() => {
          options.complete(mockResults);
        }, 0);
      });

      const result = await csvParser.parseFile(mockFile);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('parsing');
      expect(result.errors[0].message).toBe('Parse error');
    });

    it('should sanitize potential CSV injection attempts', async () => {
      const mockFile = new File(['keyword,formula\ntest,=SUM(A1:A2)'], 'test.csv', {
        type: 'text/csv'
      });

      const mockResults = {
        data: [
          { keyword: 'test', formula: '=SUM(A1:A2)' }
        ],
        errors: [],
        meta: {
          fields: ['keyword', 'formula']
        }
      };

      (Papa.parse as jest.Mock).mockImplementation((file, options) => {
        setTimeout(() => {
          options.chunk({
            data: mockResults.data,
            errors: [],
            meta: mockResults.meta
          });
          options.complete(mockResults);
        }, 0);
      });

      const result = await csvParser.parseFile(mockFile);

      expect(result.data[0].formula).toBe("'=SUM(A1:A2)"); // Should be sanitized
      expect(result.errors.some(e => e.message.includes('CSV injection'))).toBe(true);
    });

    it('should validate CSV structure and report missing headers', async () => {
      const mockFile = new File(['data'], 'test.csv', {
        type: 'text/csv'
      });

      const mockResults = {
        data: [['data']],
        errors: [],
        meta: {
          fields: undefined
        }
      };

      (Papa.parse as jest.Mock).mockImplementation((file, options) => {
        setTimeout(() => {
          options.complete(mockResults);
        }, 0);
      });

      const result = await csvParser.parseFile(mockFile);

      expect(result.errors.some(e => e.message.includes('No headers detected'))).toBe(true);
    });
  });

  describe('detectEncoding', () => {
    it('should detect UTF-8 encoding for ASCII content', async () => {
      const mockFile = new File(['simple ascii content'], 'test.csv', {
        type: 'text/csv'
      });

      const encoding = await csvParser.detectEncoding(mockFile);

      expect(encoding).toBe('UTF-8');
    });

    it('should detect non-ASCII encoding', async () => {
      // Create a buffer with non-ASCII bytes
      const buffer = new ArrayBuffer(10);
      const view = new Uint8Array(buffer);
      view[0] = 200; // Non-ASCII byte

      const mockFile = new File([buffer], 'test.csv', {
        type: 'text/csv'
      });

      const encoding = await csvParser.detectEncoding(mockFile);

      expect(encoding).toBe('ISO-8859-1');
    });
  });

  describe('isValidCSVFile', () => {
    it('should accept CSV files with correct MIME type', () => {
      const mockFile = new File(['content'], 'test.csv', {
        type: 'text/csv'
      });

      const parser = new CSVParser();
      const isValid = parser['isValidCSVFile'](mockFile);

      expect(isValid).toBe(true);
    });

    it('should accept files with CSV extension even with different MIME type', () => {
      const mockFile = new File(['content'], 'test.csv', {
        type: 'text/plain'
      });

      const parser = new CSVParser();
      const isValid = parser['isValidCSVFile'](mockFile);

      expect(isValid).toBe(true);
    });

    it('should reject files without CSV extension or MIME type', () => {
      const mockFile = new File(['content'], 'test.txt', {
        type: 'text/plain'
      });

      const parser = new CSVParser();
      const isValid = parser['isValidCSVFile'](mockFile);

      expect(isValid).toBe(false);
    });
  });
});