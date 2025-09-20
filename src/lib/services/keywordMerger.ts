import { MappedKeywordData, ExternalTool } from './externalToolMapper';

export interface ExistingKeyword {
  id: string;
  keywordListId: string;
  text: string;
  searchVolume?: number;
  difficulty?: number;
  region?: string;
  externalToolData?: Record<string, string | number | boolean>;
  createdAt: Date;
}

export interface MergeConflict {
  keywordText: string;
  field: string;
  existingValue: string | number | boolean;
  importedValue: string | number | boolean;
  existingSource?: string;
  importedSource: ExternalTool;
  resolution?: 'keep_existing' | 'use_imported' | 'merge' | 'manual';
}

export interface MergeResult {
  matched: MergedKeyword[];
  newKeywords: NewKeyword[];
  conflicts: MergeConflict[];
  errors: MergeError[];
  summary: MergeSummary;
}

export interface MergedKeyword {
  id: string;
  text: string;
  searchVolume?: number;
  difficulty?: number;
  region?: string;
  externalToolData: Record<string, string | number | boolean>;
  changes: string[];
  conflictsResolved: number;
}

export interface NewKeyword {
  text: string;
  searchVolume?: number;
  difficulty?: number;
  region: string;
  externalToolData: Record<string, string | number | boolean>;
  toolSource: ExternalTool;
}

export interface MergeError {
  keywordText: string;
  message: string;
  type: 'validation' | 'region_mismatch' | 'duplicate' | 'merge_failed';
}

export interface MergeSummary {
  totalImported: number;
  totalMatched: number;
  totalNew: number;
  totalConflicts: number;
  totalErrors: number;
  regionValidated: boolean;
}

export interface MergeOptions {
  projectRegion: string;
  allowRegionMismatch: boolean;
  autoResolveConflicts: boolean;
  conflictResolutionStrategy: 'keep_existing' | 'use_imported' | 'prefer_newer' | 'manual';
  preserveExistingData: boolean;
}

const DEFAULT_MERGE_OPTIONS: MergeOptions = {
  projectRegion: 'UK',
  allowRegionMismatch: false,
  autoResolveConflicts: false,
  conflictResolutionStrategy: 'manual',
  preserveExistingData: true
};

export class KeywordMerger {
  private options: MergeOptions;

  constructor(options: Partial<MergeOptions> = {}) {
    this.options = { ...DEFAULT_MERGE_OPTIONS, ...options };
  }

  async mergeKeywords(
    existingKeywords: ExistingKeyword[],
    importedKeywords: MappedKeywordData[],
    toolSource: ExternalTool
  ): Promise<MergeResult> {
    const matched: MergedKeyword[] = [];
    const newKeywords: NewKeyword[] = [];
    const conflicts: MergeConflict[] = [];
    const errors: MergeError[] = [];

    // Create lookup map for existing keywords (case-insensitive)
    const existingLookup = new Map<string, ExistingKeyword>();
    existingKeywords.forEach(keyword => {
      existingLookup.set(keyword.text.toLowerCase().trim(), keyword);
    });

    // Process each imported keyword
    for (const importedKeyword of importedKeywords) {
      try {
        // Validate region consistency
        if (!this.validateRegion(importedKeyword)) {
          errors.push({
            keywordText: importedKeyword.keyword,
            message: `Region mismatch: imported keyword region does not match project region (${this.options.projectRegion})`,
            type: 'region_mismatch'
          });
          continue;
        }

        const normalizedText = importedKeyword.keyword.toLowerCase().trim();
        const existingKeyword = existingLookup.get(normalizedText);

        if (existingKeyword) {
          // Handle keyword matching and merging
          const mergeResult = await this.mergeExistingKeyword(existingKeyword, importedKeyword, toolSource);
          matched.push(mergeResult.merged);
          conflicts.push(...mergeResult.conflicts);
        } else {
          // Create new keyword
          const newKeyword = this.createNewKeyword(importedKeyword, toolSource);
          newKeywords.push(newKeyword);
        }
      } catch (error) {
        errors.push({
          keywordText: importedKeyword.keyword,
          message: error instanceof Error ? error.message : 'Unknown merge error',
          type: 'merge_failed'
        });
      }
    }

    // Validate for duplicates in new keywords
    this.checkForDuplicates(newKeywords, errors);

    const summary: MergeSummary = {
      totalImported: importedKeywords.length,
      totalMatched: matched.length,
      totalNew: newKeywords.length,
      totalConflicts: conflicts.length,
      totalErrors: errors.length,
      regionValidated: !errors.some(e => e.type === 'region_mismatch')
    };

    return {
      matched,
      newKeywords,
      conflicts,
      errors,
      summary
    };
  }

  private async mergeExistingKeyword(
    existing: ExistingKeyword,
    imported: MappedKeywordData,
    toolSource: ExternalTool
  ): Promise<{ merged: MergedKeyword; conflicts: MergeConflict[] }> {
    const conflicts: MergeConflict[] = [];
    const changes: string[] = [];

    // Start with existing keyword data
    const merged: MergedKeyword = {
      id: existing.id,
      text: existing.text,
      searchVolume: existing.searchVolume,
      difficulty: existing.difficulty,
      region: existing.region || this.options.projectRegion,
      externalToolData: existing.externalToolData ? { ...existing.externalToolData } : {},
      changes: [],
      conflictsResolved: 0
    };

    // Check for conflicts and merge data
    const conflictFields = this.detectConflicts(existing, imported, toolSource);
    conflicts.push(...conflictFields);

    // Apply conflict resolutions
    for (const conflict of conflictFields) {
      const resolution = this.resolveConflict(conflict);
      conflict.resolution = resolution;

      switch (resolution) {
        case 'use_imported':
          this.applyImportedValue(merged, conflict.field, conflict.importedValue);
          changes.push(`Updated ${conflict.field} from ${conflict.existingValue} to ${conflict.importedValue}`);
          merged.conflictsResolved++;
          break;
        case 'keep_existing':
          // No change needed
          break;
        case 'merge':
          if (conflict.field === 'externalToolData') {
            // Merge external tool data by flattening imported data
            Object.keys(imported.externalToolData).forEach(key => {
              merged.externalToolData[`${toolSource}_${key}`] = imported.externalToolData[key];
            });
            changes.push(`Merged ${toolSource} data into external tool data`);
            merged.conflictsResolved++;
          }
          break;
        case 'manual':
          // Leave for manual resolution
          break;
      }
    }

    // Store tool-specific data in external tool data instead of overwriting main fields
    // Only update main fields if they're completely empty
    if ((merged.searchVolume === null || merged.searchVolume === undefined) && imported.searchVolume !== undefined) {
      merged.searchVolume = imported.searchVolume;
      changes.push(`Set search volume to ${imported.searchVolume} from ${toolSource}`);
    }

    if ((merged.difficulty === null || merged.difficulty === undefined) && imported.difficulty !== undefined) {
      merged.difficulty = imported.difficulty;
      changes.push(`Set difficulty to ${imported.difficulty} from ${toolSource}`);
    }

    // Always store tool-specific search volume and difficulty
    if (imported.searchVolume !== undefined) {
      merged.externalToolData[`${toolSource}_searchVolume`] = imported.searchVolume;
    }
    if (imported.difficulty !== undefined) {
      merged.externalToolData[`${toolSource}_difficulty`] = imported.difficulty;
    }

    // Always merge external tool data if no conflicts
    if (!conflicts.some(c => c.field === 'externalToolData')) {
      // Merge each field from imported data directly
      Object.keys(imported.externalToolData).forEach(key => {
        merged.externalToolData[`${toolSource}_${key}`] = imported.externalToolData[key];
      });
      changes.push(`Added ${toolSource} data`);
    }

    // Update timestamp and source tracking
    merged.externalToolData = {
      ...merged.externalToolData,
      last_import_source: toolSource,
      last_import_timestamp: new Date().toISOString()
    };

    merged.changes = changes;

    return { merged, conflicts };
  }

  private detectConflicts(
    existing: ExistingKeyword,
    imported: MappedKeywordData,
    toolSource: ExternalTool
  ): MergeConflict[] {
    const conflicts: MergeConflict[] = [];

    // Check search volume conflict
    if (existing.searchVolume !== undefined && imported.searchVolume !== undefined &&
        existing.searchVolume !== imported.searchVolume) {
      conflicts.push({
        keywordText: existing.text,
        field: 'searchVolume',
        existingValue: existing.searchVolume,
        importedValue: imported.searchVolume,
        existingSource: this.getExistingSource(existing),
        importedSource: toolSource
      });
    }

    // Check difficulty conflict
    if (existing.difficulty !== undefined && imported.difficulty !== undefined &&
        existing.difficulty !== imported.difficulty) {
      conflicts.push({
        keywordText: existing.text,
        field: 'difficulty',
        existingValue: existing.difficulty,
        importedValue: imported.difficulty,
        existingSource: this.getExistingSource(existing),
        importedSource: toolSource
      });
    }

    // Check region conflict
    if (existing.region && imported.region && existing.region !== imported.region) {
      conflicts.push({
        keywordText: existing.text,
        field: 'region',
        existingValue: existing.region,
        importedValue: imported.region,
        existingSource: this.getExistingSource(existing),
        importedSource: toolSource
      });
    }

    return conflicts;
  }

  private resolveConflict(_conflict: MergeConflict): 'keep_existing' | 'use_imported' | 'merge' | 'manual' {
    if (!this.options.autoResolveConflicts) {
      return 'manual';
    }

    switch (this.options.conflictResolutionStrategy) {
      case 'keep_existing':
        return 'keep_existing';
      case 'use_imported':
        return 'use_imported';
      case 'prefer_newer':
        // For now, consider imported data as newer
        return 'use_imported';
      default:
        return 'manual';
    }
  }

  private applyImportedValue(merged: MergedKeyword, field: string, value: string | number | boolean): void {
    switch (field) {
      case 'searchVolume':
        merged.searchVolume = typeof value === 'number' ? value : undefined;
        break;
      case 'difficulty':
        merged.difficulty = typeof value === 'number' ? value : undefined;
        break;
      case 'region':
        merged.region = typeof value === 'string' ? value : undefined;
        break;
    }
  }

  private getExistingSource(existing: ExistingKeyword): string {
    if (existing.externalToolData?.last_import_source) {
      return existing.externalToolData.last_import_source.toString();
    }
    return 'AI Generated';
  }

  private createNewKeyword(imported: MappedKeywordData, toolSource: ExternalTool): NewKeyword {
    const externalToolData: Record<string, string | number | boolean> = {
      ...imported.externalToolData,
      import_source: toolSource,
      last_import_source: toolSource,
      import_timestamp: new Date().toISOString()
    };

    // Store tool-specific search volume and difficulty
    if (imported.searchVolume !== undefined) {
      externalToolData[`${toolSource}_searchVolume`] = imported.searchVolume;
    }
    if (imported.difficulty !== undefined) {
      externalToolData[`${toolSource}_difficulty`] = imported.difficulty;
    }

    return {
      text: imported.keyword.trim(),
      searchVolume: imported.searchVolume,
      difficulty: imported.difficulty,
      region: imported.region || this.options.projectRegion,
      externalToolData,
      toolSource
    };
  }

  private validateRegion(imported: MappedKeywordData): boolean {
    if (this.options.allowRegionMismatch) {
      return true;
    }

    if (!imported.region) {
      // If no region specified, inherit project region
      imported.region = this.options.projectRegion;
      return true;
    }

    return imported.region === this.options.projectRegion;
  }

  private checkForDuplicates(newKeywords: NewKeyword[], errors: MergeError[]): void {
    const seen = new Set<string>();

    for (const keyword of newKeywords) {
      const normalizedText = keyword.text.toLowerCase().trim();
      if (seen.has(normalizedText)) {
        errors.push({
          keywordText: keyword.text,
          message: 'Duplicate keyword found in import data',
          type: 'duplicate'
        });
      }
      seen.add(normalizedText);
    }
  }

  // Method to apply manual conflict resolutions
  applyConflictResolutions(
    conflicts: MergeConflict[],
    resolutions: Record<string, { field: string; resolution: 'keep_existing' | 'use_imported' }>
  ): MergeConflict[] {
    return conflicts.map(conflict => {
      const key = `${conflict.keywordText}_${conflict.field}`;
      const resolution = resolutions[key];

      if (resolution && resolution.field === conflict.field) {
        conflict.resolution = resolution.resolution;
      }

      return conflict;
    });
  }

  // Utility method to generate merge audit trail
  generateAuditTrail(result: MergeResult, toolSource: ExternalTool): Record<string, unknown> {
    return {
      timestamp: new Date().toISOString(),
      tool_source: toolSource,
      summary: result.summary,
      changes: result.matched.map(m => ({
        keyword_id: m.id,
        keyword_text: m.text,
        changes: m.changes,
        conflicts_resolved: m.conflictsResolved
      })),
      new_keywords: result.newKeywords.map(n => ({
        keyword_text: n.text,
        tool_source: n.toolSource
      })),
      unresolved_conflicts: result.conflicts.filter(c => !c.resolution || c.resolution === 'manual').length,
      errors: result.errors.map(e => ({
        keyword_text: e.keywordText,
        error_type: e.type,
        message: e.message
      }))
    };
  }
}

export const keywordMerger = new KeywordMerger();