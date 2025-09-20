import { z } from 'zod';

// Define the standard metric categories we support
export type StandardMetrics = {
  volume?: number;
  difficulty?: number;
  competition?: number | string;
  cpc?: number;
};

// Tool source enum
export enum ToolSource {
  AI_GENERATED = 'AI Generated',
  SEMRUSH = 'Semrush',
  AHREFS = 'Ahrefs',
  KEYWORD_PLANNER = 'Keyword Planner',
  MANUAL = 'Manual'
}

// External tool data structure stored in JSONB
export type ExternalToolData = {
  source: ToolSource;
  standardMetrics: StandardMetrics;
  rawData: Record<string, unknown>; // Store original data from tool
  importedAt: string;
  toolVersion?: string;
};

// Validation schemas
const standardMetricsSchema = z.object({
  volume: z.number().optional(),
  difficulty: z.number().optional(),
  competition: z.union([z.number(), z.string()]).optional(),
  cpc: z.number().optional(),
});

const externalToolDataSchema = z.object({
  source: z.nativeEnum(ToolSource),
  standardMetrics: standardMetricsSchema,
  rawData: z.record(z.string(), z.unknown()),
  importedAt: z.string(),
  toolVersion: z.string().optional(),
});

// Tool-specific mapping interfaces
interface SemrushKeywordData {
  keyword: string;
  volume?: number;
  kd?: number; // Keyword Difficulty
  cmp?: number; // Competition
  cpc?: number;
  [key: string]: unknown;
}

interface AhrefsKeywordData {
  keyword: string;
  'search volume'?: number;
  kd?: number; // Keyword Difficulty
  cpc?: number;
  'competition'?: string;
  [key: string]: unknown;
}

interface KeywordPlannerData {
  keyword: string;
  'avg monthly searches'?: number | string;
  competition?: string;
  'top of page bid (low range)'?: number;
  'top of page bid (high range)'?: number;
  [key: string]: unknown;
}

interface AIGeneratedData {
  keyword: string;
  searchVolume?: number;
  difficulty?: number;
  [key: string]: unknown;
}

export class ExternalToolDataMapper {
  /**
   * Maps Semrush data to our standard format
   */
  static mapSemrushData(data: SemrushKeywordData): ExternalToolData {
    const standardMetrics: StandardMetrics = {
      volume: data.volume,
      difficulty: data.kd,
      competition: data.cmp,
      cpc: data.cpc,
    };

    return {
      source: ToolSource.SEMRUSH,
      standardMetrics,
      rawData: data,
      importedAt: new Date().toISOString(),
    };
  }

  /**
   * Maps Ahrefs data to our standard format
   */
  static mapAhrefsData(data: AhrefsKeywordData): ExternalToolData {
    // Convert competition string to number if it's a percentage
    let competition: number | string | undefined = data.competition;
    if (typeof competition === 'string' && competition.includes('%')) {
      const numericValue = parseFloat(competition.replace('%', ''));
      if (!isNaN(numericValue)) {
        competition = numericValue;
      }
    }

    const standardMetrics: StandardMetrics = {
      volume: data['search volume'],
      difficulty: data.kd,
      competition,
      cpc: data.cpc,
    };

    return {
      source: ToolSource.AHREFS,
      standardMetrics,
      rawData: data,
      importedAt: new Date().toISOString(),
    };
  }

  /**
   * Maps Google Keyword Planner data to our standard format
   */
  static mapKeywordPlannerData(data: KeywordPlannerData): ExternalToolData {
    // Parse volume from ranges (e.g., "1K - 10K")
    let volume: number | undefined;
    const avgSearches = data['avg monthly searches'];
    if (typeof avgSearches === 'string') {
      const volumeMatch = avgSearches.match(/(\d+(?:\.\d+)?)[KM]?/);
      if (volumeMatch) {
        let numValue = parseFloat(volumeMatch[1]);
        if (avgSearches.includes('K')) numValue *= 1000;
        if (avgSearches.includes('M')) numValue *= 1000000;
        volume = numValue;
      }
    } else if (typeof avgSearches === 'number') {
      volume = avgSearches;
    }

    // Convert competition level to numeric
    let competition: number | string | undefined = data.competition;
    if (competition === 'Low') competition = 0.33;
    else if (competition === 'Medium') competition = 0.66;
    else if (competition === 'High') competition = 1.0;

    // Use average of bid range for CPC
    let cpc: number | undefined;
    const lowBid = data['top of page bid (low range)'];
    const highBid = data['top of page bid (high range)'];
    if (typeof lowBid === 'number' && typeof highBid === 'number') {
      cpc = (lowBid + highBid) / 2;
    }

    const standardMetrics: StandardMetrics = {
      volume,
      competition,
      cpc,
    };

    return {
      source: ToolSource.KEYWORD_PLANNER,
      standardMetrics,
      rawData: data,
      importedAt: new Date().toISOString(),
    };
  }

  /**
   * Maps AI-generated keyword data to our standard format
   */
  static mapAIGeneratedData(data: AIGeneratedData): ExternalToolData {
    const standardMetrics: StandardMetrics = {
      volume: data.searchVolume,
      difficulty: data.difficulty,
    };

    return {
      source: ToolSource.AI_GENERATED,
      standardMetrics,
      rawData: data,
      importedAt: new Date().toISOString(),
    };
  }

  /**
   * Generic mapper that attempts to auto-detect tool and format
   */
  static mapGenericData(
    data: Record<string, unknown>,
    toolSource?: ToolSource
  ): ExternalToolData {
    if (toolSource) {
      switch (toolSource) {
        case ToolSource.SEMRUSH:
          return this.mapSemrushData(data as SemrushKeywordData);
        case ToolSource.AHREFS:
          return this.mapAhrefsData(data as AhrefsKeywordData);
        case ToolSource.KEYWORD_PLANNER:
          return this.mapKeywordPlannerData(data as KeywordPlannerData);
        case ToolSource.AI_GENERATED:
          return this.mapAIGeneratedData(data as AIGeneratedData);
      }
    }

    // Auto-detection logic based on common field patterns
    if ('kd' in data && 'volume' in data && 'cmp' in data) {
      return this.mapSemrushData(data as SemrushKeywordData);
    }

    if ('search volume' in data && 'kd' in data) {
      return this.mapAhrefsData(data as AhrefsKeywordData);
    }

    if ('avg monthly searches' in data && 'top of page bid (low range)' in data) {
      return this.mapKeywordPlannerData(data as KeywordPlannerData);
    }

    if ('searchVolume' in data && 'difficulty' in data) {
      return this.mapAIGeneratedData(data as AIGeneratedData);
    }

    // Fallback to manual mapping
    return {
      source: ToolSource.MANUAL,
      standardMetrics: {
        volume: this.extractNumericValue(data.volume || data.searchVolume),
        difficulty: this.extractNumericValue(data.difficulty || data.kd),
        competition: (data.competition || data.cmp) as number | string | undefined,
        cpc: this.extractNumericValue(data.cpc),
      },
      rawData: data,
      importedAt: new Date().toISOString(),
    };
  }

  /**
   * Validates external tool data structure
   */
  static validateExternalToolData(data: unknown): ExternalToolData {
    const result = externalToolDataSchema.safeParse(data);
    if (!result.success) {
      throw new Error(`Invalid external tool data: ${result.error.message}`);
    }
    return result.data;
  }

  /**
   * Merges multiple external tool data entries, preferring higher quality sources
   */
  static mergeExternalToolData(dataEntries: ExternalToolData[]): ExternalToolData {
    if (dataEntries.length === 0) {
      throw new Error('No data entries to merge');
    }

    if (dataEntries.length === 1) {
      return dataEntries[0];
    }

    // Source quality ranking (higher = better)
    const sourceQuality = {
      [ToolSource.SEMRUSH]: 4,
      [ToolSource.AHREFS]: 3,
      [ToolSource.KEYWORD_PLANNER]: 2,
      [ToolSource.AI_GENERATED]: 1,
      [ToolSource.MANUAL]: 0,
    };

    // Sort by quality (best first)
    const sortedEntries = [...dataEntries].sort(
      (a, b) => sourceQuality[b.source] - sourceQuality[a.source]
    );

    const mergedMetrics: StandardMetrics = {};
    const mergedRawData: Record<string, unknown> = {};

    // Merge metrics, preferring data from higher quality sources
    for (const entry of sortedEntries) {
      if (mergedMetrics.volume === undefined && entry.standardMetrics.volume !== undefined) {
        mergedMetrics.volume = entry.standardMetrics.volume;
      }
      if (mergedMetrics.difficulty === undefined && entry.standardMetrics.difficulty !== undefined) {
        mergedMetrics.difficulty = entry.standardMetrics.difficulty;
      }
      if (mergedMetrics.competition === undefined && entry.standardMetrics.competition !== undefined) {
        mergedMetrics.competition = entry.standardMetrics.competition;
      }
      if (mergedMetrics.cpc === undefined && entry.standardMetrics.cpc !== undefined) {
        mergedMetrics.cpc = entry.standardMetrics.cpc;
      }

      // Merge raw data with source prefixes
      Object.entries(entry.rawData).forEach(([key, value]) => {
        mergedRawData[`${entry.source.toLowerCase()}_${key}`] = value;
      });
    }

    return {
      source: sortedEntries[0].source, // Use best source as primary
      standardMetrics: mergedMetrics,
      rawData: {
        ...mergedRawData,
        sources: dataEntries.map(entry => entry.source),
        mergedAt: new Date().toISOString(),
      },
      importedAt: sortedEntries[0].importedAt,
    };
  }

  /**
   * Helper to extract numeric values from various formats
   */
  private static extractNumericValue(value: unknown): number | undefined {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const num = parseFloat(value);
      return isNaN(num) ? undefined : num;
    }
    return undefined;
  }

  /**
   * Get display string for a metric value
   */
  static formatMetricValue(
    metric: keyof StandardMetrics,
    value: number | string | undefined
  ): string {
    if (value === undefined || value === null) return '-';

    switch (metric) {
      case 'volume':
        if (typeof value === 'number') {
          if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
          if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
          return value.toString();
        }
        return value.toString();

      case 'difficulty':
        if (typeof value === 'number') {
          return `${Math.round(value)}`;
        }
        return value.toString();

      case 'competition':
        if (typeof value === 'number') {
          if (value <= 1) return `${(value * 100).toFixed(0)}%`;
          return `${Math.round(value)}`;
        }
        return value.toString();

      case 'cpc':
        if (typeof value === 'number') {
          return `$${value.toFixed(2)}`;
        }
        return value.toString();

      default:
        return value.toString();
    }
  }
}