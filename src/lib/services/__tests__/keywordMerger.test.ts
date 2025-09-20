// @ts-nocheck
import { jest } from '@jest/globals';
import { KeywordMerger } from '../keywordMerger';

describe('KeywordMerger', () => {
  let merger: KeywordMerger;

  beforeEach(() => {
    merger = new KeywordMerger({
      projectRegion: 'UK',
      allowRegionMismatch: false,
      autoResolveConflicts: false,
      conflictResolutionStrategy: 'manual',
      preserveExistingData: true
    });
  });

  describe('mergeKeywords', () => {
    it('should merge keywords without conflicts', async () => {
      const existingKeywords = [
        {
          id: '1',
          keywordListId: 'list-1',
          text: 'existing keyword',
          searchVolume: 1000,
          difficulty: 45,
          region: 'UK',
          externalToolData: {},
          createdAt: new Date()
        }
      ];

      const importedKeywords = [
        {
          keyword: 'new keyword',
          searchVolume: 2000,
          difficulty: 55,
          region: 'UK',
          externalToolData: { cpc: 2.5 },
          toolSource: 'semrush' as const
        }
      ];

      const result = await merger.mergeKeywords(existingKeywords, importedKeywords, 'semrush');

      expect(result.summary.totalImported).toBe(1);
      expect(result.summary.totalNew).toBe(1);
      expect(result.summary.totalMatched).toBe(0);
      expect(result.summary.totalConflicts).toBe(0);
      expect(result.newKeywords).toHaveLength(1);
      expect(result.newKeywords[0].text).toBe('new keyword');
    });

    it('should detect and handle keyword matches', async () => {
      const existingKeywords = [
        {
          id: '1',
          keywordListId: 'list-1',
          text: 'test keyword',
          searchVolume: 1000,
          difficulty: 45,
          region: 'UK',
          externalToolData: {},
          createdAt: new Date()
        }
      ];

      const importedKeywords = [
        {
          keyword: 'Test Keyword', // Case-insensitive match
          searchVolume: 1500,
          difficulty: 50,
          region: 'UK',
          externalToolData: { cpc: 2.5 },
          toolSource: 'semrush' as const
        }
      ];

      const result = await merger.mergeKeywords(existingKeywords, importedKeywords, 'semrush');

      expect(result.summary.totalMatched).toBe(1);
      expect(result.summary.totalNew).toBe(0);
      expect(result.matched).toHaveLength(1);
      expect(result.matched[0].id).toBe('1');
    });

    it('should detect conflicts in merged data', async () => {
      const existingKeywords = [
        {
          id: '1',
          keywordListId: 'list-1',
          text: 'test keyword',
          searchVolume: 1000,
          difficulty: 45,
          region: 'UK',
          externalToolData: {},
          createdAt: new Date()
        }
      ];

      const importedKeywords = [
        {
          keyword: 'test keyword',
          searchVolume: 2000, // Different from existing
          difficulty: 55, // Different from existing
          region: 'UK',
          externalToolData: { cpc: 2.5 },
          toolSource: 'semrush' as const
        }
      ];

      const result = await merger.mergeKeywords(existingKeywords, importedKeywords, 'semrush');

      expect(result.summary.totalConflicts).toBeGreaterThan(0);
      expect(result.conflicts).toHaveLength(2); // searchVolume and difficulty conflicts
      expect(result.conflicts[0].keywordText).toBe('test keyword');
    });

    it('should validate region consistency', async () => {
      const existingKeywords = [];

      const importedKeywords = [
        {
          keyword: 'us keyword',
          searchVolume: 1000,
          difficulty: 45,
          region: 'US', // Different from project region (UK)
          externalToolData: {},
          toolSource: 'semrush' as const
        }
      ];

      const result = await merger.mergeKeywords(existingKeywords, importedKeywords, 'semrush');

      expect(result.summary.totalErrors).toBe(1);
      expect(result.errors[0].type).toBe('region_mismatch');
      expect(result.errors[0].keywordText).toBe('us keyword');
    });

    it('should allow region mismatch when configured', async () => {
      const flexibleMerger = new KeywordMerger({
        projectRegion: 'UK',
        allowRegionMismatch: true,
        autoResolveConflicts: false,
        conflictResolutionStrategy: 'manual',
        preserveExistingData: true
      });

      const existingKeywords = [];

      const importedKeywords = [
        {
          keyword: 'us keyword',
          searchVolume: 1000,
          difficulty: 45,
          region: 'US',
          externalToolData: {},
          toolSource: 'semrush' as const
        }
      ];

      const result = await flexibleMerger.mergeKeywords(existingKeywords, importedKeywords, 'semrush');

      expect(result.summary.totalErrors).toBe(0);
      expect(result.summary.totalNew).toBe(1);
      expect(result.newKeywords[0].region).toBe('US');
    });

    it('should auto-resolve conflicts when configured', async () => {
      const autoMerger = new KeywordMerger({
        projectRegion: 'UK',
        allowRegionMismatch: false,
        autoResolveConflicts: true,
        conflictResolutionStrategy: 'use_imported',
        preserveExistingData: false
      });

      const existingKeywords = [
        {
          id: '1',
          keywordListId: 'list-1',
          text: 'test keyword',
          searchVolume: 1000,
          difficulty: 45,
          region: 'UK',
          externalToolData: {},
          createdAt: new Date()
        }
      ];

      const importedKeywords = [
        {
          keyword: 'test keyword',
          searchVolume: 2000,
          difficulty: 55,
          region: 'UK',
          externalToolData: { cpc: 2.5 },
          toolSource: 'semrush' as const
        }
      ];

      const result = await autoMerger.mergeKeywords(existingKeywords, importedKeywords, 'semrush');

      expect(result.matched[0].searchVolume).toBe(2000); // Should use imported value
      expect(result.matched[0].difficulty).toBe(55); // Should use imported value
      expect(result.matched[0].conflictsResolved).toBeGreaterThan(0);
    });

    it('should detect duplicate keywords in import data', async () => {
      const existingKeywords = [];

      const importedKeywords = [
        {
          keyword: 'duplicate keyword',
          searchVolume: 1000,
          difficulty: 45,
          region: 'UK',
          externalToolData: {},
          toolSource: 'semrush' as const
        },
        {
          keyword: 'Duplicate Keyword', // Case-insensitive duplicate
          searchVolume: 1500,
          difficulty: 50,
          region: 'UK',
          externalToolData: {},
          toolSource: 'semrush' as const
        }
      ];

      const result = await merger.mergeKeywords(existingKeywords, importedKeywords, 'semrush');

      expect(result.summary.totalErrors).toBe(1);
      expect(result.errors[0].type).toBe('duplicate');
    });
  });

  describe('applyConflictResolutions', () => {
    it('should apply manual conflict resolutions', () => {
      const conflicts = [
        {
          keywordText: 'test keyword',
          field: 'searchVolume',
          existingValue: 1000,
          importedValue: 2000,
          importedSource: 'semrush' as const
        }
      ];

      const resolutions = {
        'test keyword_searchVolume': {
          field: 'searchVolume',
          resolution: 'use_imported' as const
        }
      };

      const resolvedConflicts = merger.applyConflictResolutions(conflicts, resolutions);

      expect(resolvedConflicts[0].resolution).toBe('use_imported');
    });
  });

  describe('generateAuditTrail', () => {
    it('should generate comprehensive audit trail', () => {
      const mergeResult = {
        matched: [
          {
            id: '1',
            text: 'test keyword',
            searchVolume: 2000,
            difficulty: 55,
            region: 'UK',
            externalToolData: {},
            changes: ['Updated searchVolume from 1000 to 2000'],
            conflictsResolved: 1
          }
        ],
        newKeywords: [
          {
            text: 'new keyword',
            searchVolume: 1000,
            difficulty: 45,
            region: 'UK',
            externalToolData: {},
            toolSource: 'semrush' as const
          }
        ],
        conflicts: [],
        errors: [],
        summary: {
          totalImported: 2,
          totalMatched: 1,
          totalNew: 1,
          totalConflicts: 0,
          totalErrors: 0,
          regionValidated: true
        }
      };

      const auditTrail = merger.generateAuditTrail(mergeResult, 'semrush');

      expect(auditTrail.tool_source).toBe('semrush');
      expect(auditTrail.summary).toEqual(mergeResult.summary);
      expect(auditTrail.changes).toHaveLength(1);
      expect(auditTrail.new_keywords).toHaveLength(1);
      expect(auditTrail.unresolved_conflicts).toBe(0);
    });
  });
});