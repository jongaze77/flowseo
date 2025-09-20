import { z } from 'zod';
import { ExternalToolDataMapper, ToolSource, type ExternalToolData } from './externalToolDataMapper';

// Validation schema for CSV import rows
const csvRowSchema = z.object({
  keyword: z.string().min(1, 'Keyword is required'),
  // Allow flexible field names and types
  volume: z.union([z.number(), z.string()]).optional(),
  searchVolume: z.union([z.number(), z.string()]).optional(),
  'search volume': z.union([z.number(), z.string()]).optional(),
  'avg monthly searches': z.union([z.number(), z.string()]).optional(),

  difficulty: z.union([z.number(), z.string()]).optional(),
  kd: z.union([z.number(), z.string()]).optional(),

  competition: z.union([z.number(), z.string()]).optional(),
  cmp: z.union([z.number(), z.string()]).optional(),

  cpc: z.union([z.number(), z.string()]).optional(),
  'top of page bid (low range)': z.union([z.number(), z.string()]).optional(),
  'top of page bid (high range)': z.union([z.number(), z.string()]).optional(),
}).passthrough(); // Allow additional fields

export type CSVRowData = z.infer<typeof csvRowSchema>;

export interface ValidationResult {
  success: boolean;
  data?: ExternalToolData[];
  errors: string[];
  warnings: string[];
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    detectedTool?: ToolSource;
  };
}

export class ExternalToolValidator {
  /**
   * Validates and parses CSV data for external tool import
   */
  static validateCSVData(
    csvData: Record<string, unknown>[],
    expectedTool?: ToolSource
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const validData: ExternalToolData[] = [];

    if (!csvData || csvData.length === 0) {
      return {
        success: false,
        errors: ['No data provided'],
        warnings: [],
        summary: {
          totalRows: 0,
          validRows: 0,
          invalidRows: 0,
        },
      };
    }

    // Auto-detect tool if not specified
    const detectedTool = expectedTool || this.detectToolFromHeaders(csvData[0]);

    if (!detectedTool) {
      warnings.push('Could not auto-detect tool source. Using manual mapping.');
    }

    // Validate each row
    for (let i = 0; i < csvData.length; i++) {
      const rowIndex = i + 1; // 1-based for user display

      try {
        // Basic validation
        const validatedRow = csvRowSchema.parse(csvData[i]);

        // Check for required keyword field
        if (!validatedRow.keyword || validatedRow.keyword.trim() === '') {
          errors.push(`Row ${rowIndex}: Keyword is required`);
          continue;
        }

        // Sanitize keyword
        const sanitizedKeyword = this.sanitizeKeyword(validatedRow.keyword);
        if (!sanitizedKeyword) {
          errors.push(`Row ${rowIndex}: Invalid keyword format`);
          continue;
        }

        // Map to external tool data
        const mappedData = ExternalToolDataMapper.mapGenericData(
          { ...validatedRow, keyword: sanitizedKeyword },
          detectedTool
        );

        // Additional validation
        const validationIssues = this.validateMappedData(mappedData, rowIndex);
        if (validationIssues.errors.length > 0) {
          errors.push(...validationIssues.errors);
          continue;
        }

        warnings.push(...validationIssues.warnings);
        validData.push(mappedData);

      } catch (error) {
        if (error instanceof z.ZodError) {
          const fieldErrors = error.issues.map(issue =>
            `${issue.path.join('.')}: ${issue.message}`
          ).join(', ');
          errors.push(`Row ${rowIndex}: ${fieldErrors}`);
        } else {
          errors.push(`Row ${rowIndex}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }

    return {
      success: errors.length === 0,
      data: validData,
      errors,
      warnings,
      summary: {
        totalRows: csvData.length,
        validRows: validData.length,
        invalidRows: csvData.length - validData.length,
        detectedTool,
      },
    };
  }

  /**
   * Attempts to detect the tool source from CSV headers
   */
  private static detectToolFromHeaders(firstRow: Record<string, unknown>): ToolSource | undefined {
    const headers = Object.keys(firstRow).map(h => h.toLowerCase());

    // Semrush patterns
    if (headers.includes('kd') && headers.includes('volume') && headers.includes('cmp')) {
      return ToolSource.SEMRUSH;
    }

    // Ahrefs patterns
    if (headers.includes('search volume') && headers.includes('kd')) {
      return ToolSource.AHREFS;
    }

    // Keyword Planner patterns
    if (headers.includes('avg monthly searches') &&
        (headers.includes('top of page bid (low range)') || headers.includes('competition'))) {
      return ToolSource.KEYWORD_PLANNER;
    }

    // AI Generated patterns
    if (headers.includes('searchvolume') && headers.includes('difficulty')) {
      return ToolSource.AI_GENERATED;
    }

    return undefined;
  }

  /**
   * Sanitizes and validates keyword text
   */
  private static sanitizeKeyword(keyword: string): string | null {
    if (typeof keyword !== 'string') {
      return null;
    }

    // Trim whitespace
    const trimmed = keyword.trim();

    // Check minimum length
    if (trimmed.length === 0 || trimmed.length > 255) {
      return null;
    }

    // Remove any potential injection characters
    const sanitized = trimmed.replace(/[<>'"]/g, '');

    return sanitized;
  }

  /**
   * Validates mapped external tool data
   */
  private static validateMappedData(
    data: ExternalToolData,
    rowIndex: number
  ): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate numeric ranges
    const { volume, difficulty, cpc } = data.standardMetrics;

    if (volume !== undefined) {
      if (volume < 0) {
        errors.push(`Row ${rowIndex}: Search volume cannot be negative`);
      } else if (volume > 10000000) {
        warnings.push(`Row ${rowIndex}: Search volume seems unusually high (${volume})`);
      }
    }

    if (difficulty !== undefined) {
      if (difficulty < 0 || difficulty > 100) {
        errors.push(`Row ${rowIndex}: Difficulty must be between 0-100`);
      }
    }

    if (cpc !== undefined) {
      if (cpc < 0) {
        errors.push(`Row ${rowIndex}: CPC cannot be negative`);
      } else if (cpc > 1000) {
        warnings.push(`Row ${rowIndex}: CPC seems unusually high ($${cpc})`);
      }
    }

    return { errors, warnings };
  }

  /**
   * Validates a complete external tool data object
   */
  static validateExternalToolData(data: unknown): { valid: boolean; errors: string[] } {
    try {
      ExternalToolDataMapper.validateExternalToolData(data);
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.issues.map(issue =>
          `${issue.path.join('.')}: ${issue.message}`
        );
        return { valid: false, errors };
      }
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Unknown validation error']
      };
    }
  }

  /**
   * Sanitizes raw CSV data to prevent injection attacks
   */
  static sanitizeCSVData(csvData: Record<string, unknown>[]): Record<string, unknown>[] {
    return csvData.map(row => {
      const sanitizedRow: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(row)) {
        // Sanitize key
        const sanitizedKey = key.replace(/[<>'"]/g, '').trim();

        // Sanitize value
        let sanitizedValue: unknown = value;
        if (typeof value === 'string') {
          sanitizedValue = value.replace(/[<>'"]/g, '').trim();

          // Convert string numbers to actual numbers
          const numValue = parseFloat(sanitizedValue as string);
          if (!isNaN(numValue) && isFinite(numValue)) {
            sanitizedValue = numValue;
          }
        }

        sanitizedRow[sanitizedKey] = sanitizedValue;
      }

      return sanitizedRow;
    });
  }

  /**
   * Provides suggestions for fixing common CSV import issues
   */
  static getSuggestions(validationResult: ValidationResult): string[] {
    const suggestions: string[] = [];

    if (!validationResult.summary.detectedTool) {
      suggestions.push(
        'Consider manually specifying the tool source to improve data mapping accuracy.'
      );
    }

    if (validationResult.summary.invalidRows > 0) {
      suggestions.push(
        'Review invalid rows and ensure all required fields are present and properly formatted.'
      );
    }

    if (validationResult.warnings.some(w => w.includes('unusually high'))) {
      suggestions.push(
        'Double-check any unusually high values - they may indicate data format issues.'
      );
    }

    if (validationResult.errors.some(e => e.includes('Keyword is required'))) {
      suggestions.push(
        'Ensure your CSV has a "keyword" column with non-empty values in each row.'
      );
    }

    return suggestions;
  }
}