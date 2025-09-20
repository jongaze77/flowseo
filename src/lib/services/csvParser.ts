import Papa from 'papaparse';

export interface CSVParseResult {
  data: Record<string, string | number | boolean>[];
  headers: string[];
  errors: CSVParseError[];
  meta: {
    rowCount: number;
    fileSize: number;
    encoding?: string;
    hasHeaders: boolean;
  };
}

export interface CSVParseError {
  row: number;
  column?: string;
  message: string;
  type: 'validation' | 'parsing' | 'format';
}

export interface CSVParseOptions {
  maxFileSize: number;
  allowedEncodings: string[];
  skipEmptyLines: boolean;
  trimHeaders: boolean;
  chunkSize?: number;
  progressCallback?: (progress: number) => void;
}

const DEFAULT_PARSE_OPTIONS: CSVParseOptions = {
  maxFileSize: 50 * 1024 * 1024, // 50MB
  allowedEncodings: ['UTF-8', 'ISO-8859-1'],
  skipEmptyLines: true,
  trimHeaders: true,
  chunkSize: 10000
};

export class CSVParser {
  private options: CSVParseOptions;

  constructor(options: Partial<CSVParseOptions> = {}) {
    this.options = { ...DEFAULT_PARSE_OPTIONS, ...options };
  }

  async parseFile(file: File): Promise<CSVParseResult> {
    // Validate file size
    if (file.size > this.options.maxFileSize) {
      throw new Error(`File size exceeds maximum allowed size of ${this.options.maxFileSize / 1024 / 1024}MB`);
    }

    // Validate file type
    if (!this.isValidCSVFile(file)) {
      throw new Error('Invalid file type. Only CSV files are allowed.');
    }

    const errors: CSVParseError[] = [];
    let data: Record<string, string | number | boolean>[] = [];
    let headers: string[] = [];

    return new Promise((resolve, reject) => {
      let rowCount = 0;
      let processedRows = 0;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Papa.parse(file as any, {
        header: true,
        skipEmptyLines: this.options.skipEmptyLines,
        transformHeader: this.options.trimHeaders ? (header: string) => header.trim() : undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        chunk: (results: any, parser: any) => {
          if (results.errors.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            results.errors.forEach((error: any) => {
              errors.push({
                row: error.row || 0,
                message: error.message,
                type: 'parsing'
              });
            });
          }

          if (headers.length === 0 && results.meta.fields) {
            headers = results.meta.fields;
          }

          // Process and validate chunk data
          const chunkData = this.processChunkData(results.data, processedRows, errors);
          data = data.concat(chunkData);

          processedRows += results.data.length;
          rowCount = Math.max(rowCount, processedRows);

          // Report progress
          if (this.options.progressCallback) {
            const progress = Math.min((processedRows / (file.size / 100)), 100);
            this.options.progressCallback(progress);
          }

          // Handle chunked processing if file is large
          if (this.options.chunkSize && processedRows >= this.options.chunkSize) {
            parser.pause();
            setTimeout(() => parser.resume(), 0);
          }
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        complete: (results: any) => {
          if (results.errors.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            results.errors.forEach((error: any) => {
              errors.push({
                row: error.row || 0,
                message: error.message,
                type: 'parsing'
              });
            });
          }

          // Final validation
          this.validateCSVStructure(data, headers, errors);

          resolve({
            data,
            headers,
            errors,
            meta: {
              rowCount,
              fileSize: file.size,
              encoding: 'UTF-8',
              hasHeaders: headers.length > 0
            }
          });
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        error: (error: any) => {
          reject(new Error(`CSV parsing failed: ${error.message}`));
        }
      });
    });
  }

  private isValidCSVFile(file: File): boolean {
    const csvTypes = ['text/csv', 'application/csv'];
    const csvExtensions = ['.csv', '.tsv'];

    const hasCSVType = csvTypes.includes(file.type);
    const hasCSVExtension = csvExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

    // Accept if it has CSV extension OR proper CSV MIME type
    // This will reject test.txt with text/plain since it has neither
    return hasCSVExtension || hasCSVType;
  }

  private processChunkData(
    chunkData: Record<string, string>[],
    startIndex: number,
    errors: CSVParseError[]
  ): Record<string, string | number | boolean>[] {
    return chunkData.map((row, index) => {
      const rowIndex = startIndex + index + 1; // +1 for header row

      // Sanitize data to prevent CSV injection
      const sanitizedRow: Record<string, string | number | boolean> = {};

      Object.entries(row).forEach(([key, value]: [string, string]) => {
        if (typeof value === 'string') {
          // Remove potentially dangerous characters that could be used in CSV injection
          const sanitized = this.sanitizeCSVValue(value);
          sanitizedRow[key] = sanitized;

          // Check for potential CSV injection attempts
          if (this.isPotentialCSVInjection(value)) {
            errors.push({
              row: rowIndex,
              column: key,
              message: 'Potential CSV injection detected and sanitized',
              type: 'validation'
            });
          }
        } else {
          sanitizedRow[key] = value;
        }
      });

      return sanitizedRow;
    });
  }

  private sanitizeCSVValue(value: string): string {
    // Remove or escape potentially dangerous formulas
    if (value.startsWith('=') || value.startsWith('+') || value.startsWith('-') || value.startsWith('@')) {
      return `'${value}`;
    }
    return value;
  }

  private isPotentialCSVInjection(value: string): boolean {
    const dangerousPatterns = [
      /^[=+\-@]/,  // Formula injection
      /cmd\s*\|/i, // Command injection
      /powershell/i, // PowerShell injection
      /\|\s*curl/i   // Command chaining
    ];

    return dangerousPatterns.some(pattern => pattern.test(value));
  }

  private validateCSVStructure(
    data: Record<string, string | number | boolean>[],
    headers: string[],
    errors: CSVParseError[]
  ): void {
    // Check if we have headers
    if (headers.length === 0) {
      errors.push({
        row: 0,
        message: 'No headers detected in CSV file',
        type: 'format'
      });
      return;
    }

    // Check for duplicate headers
    const duplicateHeaders = headers.filter((header, index) => headers.indexOf(header) !== index);
    if (duplicateHeaders.length > 0) {
      errors.push({
        row: 0,
        message: `Duplicate headers detected: ${duplicateHeaders.join(', ')}`,
        type: 'format'
      });
    }

    // Check if we have data rows
    if (data.length === 0) {
      errors.push({
        row: 0,
        message: 'No data rows found in CSV file',
        type: 'format'
      });
      return;
    }

    // Validate data consistency
    data.forEach((row, index) => {
      const rowIndex = index + 2; // +2 for header row and 0-based index

      // Check for completely empty rows
      const hasData = Object.values(row).some(value => value !== null && value !== undefined && value !== '');
      if (!hasData) {
        errors.push({
          row: rowIndex,
          message: 'Empty row detected',
          type: 'validation'
        });
      }

      // Check for missing required columns (at least one column should have data)
      const emptyColumns = Object.entries(row)
        .filter(([_key, value]) => !value || value.toString().trim() === '')
        .map(([key]) => key);

      if (emptyColumns.length === headers.length) {
        errors.push({
          row: rowIndex,
          message: 'Row contains no data in any column',
          type: 'validation'
        });
      }
    });
  }

  // Utility method to detect file encoding (basic implementation)
  async detectEncoding(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const buffer = reader.result as ArrayBuffer;
        const uint8Array = new Uint8Array(buffer.slice(0, 1024)); // Check first 1KB

        // Simple encoding detection based on byte patterns
        // This is a basic implementation - production might use a more sophisticated library
        let hasNonASCII = false;
        for (let i = 0; i < uint8Array.length; i++) {
          if (uint8Array[i] > 127) {
            hasNonASCII = true;
            break;
          }
        }

        resolve(hasNonASCII ? 'ISO-8859-1' : 'UTF-8');
      };
      reader.readAsArrayBuffer(file);
    });
  }
}

export const csvParser = new CSVParser();