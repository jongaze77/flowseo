import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '../../../../../../../generated/prisma';
import { z } from 'zod';
import { verifyAndDecodeToken } from '../../../../../../../lib/auth/session';
import { csvParser } from '../../../../../../../lib/services/csvParser';
import { externalToolMapper } from '../../../../../../../lib/services/externalToolMapper';
// import { keywordMerger } from '../../../../../../../lib/services/keywordMerger';

const prisma = new PrismaClient();

// Validation schemas
const importRequestSchema = z.object({
  keywordListId: z.string().uuid('Invalid keyword list ID').optional(),
  keywordListName: z.string().min(1).max(255).optional(),
  detectTool: z.boolean().default(true),
  tool: z.enum(['semrush', 'ahrefs', 'google_keyword_planner', 'unknown']).optional(),
  columnMappings: z.record(z.string(), z.string()).optional(),
  conflictResolution: z.enum(['keep_existing', 'use_imported', 'manual']).default('manual'),
  allowRegionMismatch: z.boolean().default(false)
});

// const importStatusSchema = z.object({
//   importId: z.string().uuid('Invalid import ID')
// });

// Helper function to get authenticated user from request
async function getAuthenticatedUser(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value;

  if (!token) {
    return null;
  }

  const tokenResult = verifyAndDecodeToken(token);
  if (!tokenResult) {
    return null;
  }

  const { user: decoded } = tokenResult;

  // Fetch fresh user data to ensure it's still valid
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    include: {
      tenant: true,
    },
  });

  return user;
}

// Helper function to find project and verify tenant ownership
async function findProjectWithTenantCheck(projectId: string, tenantId: string) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      tenant_id: tenantId,
    },
    include: {
      tenant: true,
    },
  });

  return project;
}

// Import the shared progress store
import { importProgressStore, updateImportProgress } from '../../../../../../../lib/services/importProgress';

/**
 * POST /api/v1/projects/[id]/keywords/import
 * Import CSV file with keyword data
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params
    const resolvedParams = await params;

    // Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Validate project ownership
    const project = await findProjectWithTenantCheck(resolvedParams.id, user.tenant_id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const requestData = formData.get('data') as string;

    if (!file) {
      return NextResponse.json({ error: 'CSV file is required' }, { status: 400 });
    }

    // Parse and validate request data
    let parsedRequestData = {};
    if (requestData) {
      try {
        parsedRequestData = JSON.parse(requestData);
      } catch (_error) {
        return NextResponse.json({ error: 'Invalid request data format' }, { status: 400 });
      }
    }

    const validatedRequest = importRequestSchema.parse(parsedRequestData);

    // Generate import ID for tracking
    const importId = crypto.randomUUID();
    updateImportProgress(importId, 'processing', 0, 'Starting CSV parsing...');

    // Process import asynchronously
    processImport({
      importId,
      file,
      project,
      validatedRequest,
      _userId: user.id
    }).catch(error => {
      console.error('Import processing error:', error);
      updateImportProgress(importId, 'failed', 0, undefined, undefined, error.message || 'Unknown import error');
    });

    return NextResponse.json({
      success: true,
      importId,
      message: 'Import started successfully. Use the import ID to track progress.',
      statusUrl: `/api/v1/projects/${resolvedParams.id}/keywords/import/status/${importId}`
    });

  } catch (error) {
    console.error('CSV import error:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    // Handle general errors
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * GET /api/v1/projects/[id]/keywords/import/status/[importId]
 * Get import status and progress
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params
    const resolvedParams = await params;

    // Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Validate project ownership
    const project = await findProjectWithTenantCheck(resolvedParams.id, user.tenant_id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
    }

    // Get import ID from URL path
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    const importId = pathSegments[pathSegments.length - 1];

    if (!importId) {
      return NextResponse.json({ error: 'Import ID is required' }, { status: 400 });
    }

    // Get import status
    const importStatus = importProgressStore.get(importId);
    if (!importStatus) {
      return NextResponse.json({ error: 'Import not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      importId,
      status: importStatus.status,
      progress: importStatus.progress,
      message: importStatus.message,
      result: importStatus.result,
      error: importStatus.error
    });

  } catch (error) {
    console.error('Import status error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Async import processing function
async function processImport({
  importId,
  file,
  project,
  validatedRequest,
  _userId
}: {
  importId: string;
  file: File;
  project: { id: string; name: string; default_region: string; tenant_id: string };
  validatedRequest: z.infer<typeof importRequestSchema>;
  _userId: string;
}) {
  try {
    // Update progress: Parsing CSV
    updateImportProgress(importId, 'processing', 10, 'Parsing CSV file...');

    // Parse CSV file
    const csvResult = await csvParser.parseFile(file);

    if (csvResult.errors.length > 0) {
      const criticalErrors = csvResult.errors.filter(e => e.type === 'parsing' || e.type === 'format');
      if (criticalErrors.length > 0) {
        throw new Error(`CSV parsing failed: ${criticalErrors[0].message}`);
      }
    }

    // Update progress: Detecting tool format
    updateImportProgress(importId, 'processing', 25, 'Detecting external tool format...');

    // Detect or use specified tool
    let mappingResult;
    if (validatedRequest.detectTool && !validatedRequest.tool) {
      mappingResult = externalToolMapper.detectTool(csvResult.headers);
    } else if (validatedRequest.columnMappings) {
      mappingResult = externalToolMapper.createManualMapping(csvResult.headers, validatedRequest.columnMappings);
    } else {
      throw new Error('Either tool detection or manual column mappings must be provided');
    }

    if (mappingResult.errors.length > 0) {
      const criticalErrors = mappingResult.errors.filter(e => e.type === 'missing_required');
      if (criticalErrors.length > 0) {
        throw new Error(`Column mapping failed: ${criticalErrors[0].message}`);
      }
    }

    // Update progress: Mapping data
    updateImportProgress(importId, 'processing', 40, 'Mapping CSV data to keyword format...');

    // Map CSV data to keyword format
    const mappedKeywords = csvResult.data
      .map(row => {
        // Convert mixed types to strings for external tool mapper
        const stringRow: Record<string, string> = {};
        Object.entries(row).forEach(([key, value]) => {
          stringRow[key] = String(value);
        });
        return externalToolMapper.mapRowData(stringRow, mappingResult.mappings);
      })
      .filter((keyword): keyword is NonNullable<typeof keyword> => keyword !== null);

    if (mappedKeywords.length === 0) {
      throw new Error('No valid keywords found in CSV data');
    }

    // Set tool source
    const toolSource = validatedRequest.tool || mappingResult.detectedTool;
    mappedKeywords.forEach(keyword => {
      if (keyword) keyword.toolSource = toolSource;
    });

    // Update progress: Getting existing keywords
    updateImportProgress(importId, 'processing', 55, 'Loading existing keywords for merge comparison...');

    // Get existing keywords for the project
    const existingKeywordLists = await prisma.keywordList.findMany({
      where: { project_id: project.id },
      include: {
        keywords: {
          select: {
            id: true,
            keyword_list_id: true,
            text: true,
            search_volume: true,
            difficulty: true,
            region: true,
            external_tool_data: true,
            created_at: true
          }
        }
      }
    });

    const existingKeywords = existingKeywordLists.flatMap(list =>
      list.keywords.map(keyword => ({
        id: keyword.id,
        keywordListId: keyword.keyword_list_id,
        text: keyword.text,
        searchVolume: keyword.search_volume ?? undefined,
        difficulty: keyword.difficulty ?? undefined,
        region: keyword.region ?? undefined,
        externalToolData: keyword.external_tool_data as Record<string, string | number | boolean> || {},
        createdAt: keyword.created_at
      }))
    );

    // Update progress: Merging keywords
    updateImportProgress(importId, 'processing', 70, 'Merging imported keywords with existing data...');

    // Configure merger options
    const mergerOptions = {
      projectRegion: project.default_region,
      allowRegionMismatch: validatedRequest.allowRegionMismatch,
      autoResolveConflicts: validatedRequest.conflictResolution !== 'manual',
      conflictResolutionStrategy: validatedRequest.conflictResolution,
      preserveExistingData: true
    };

    const merger = new (await import('../../../../../../../lib/services/keywordMerger')).KeywordMerger(mergerOptions);
    const mergeResult = await merger.mergeKeywords(existingKeywords, mappedKeywords, toolSource);

    // Update progress: Saving to database
    updateImportProgress(importId, 'processing', 85, 'Saving results to database...');

    // Create or get keyword list
    let keywordList;
    if (validatedRequest.keywordListId) {
      keywordList = await prisma.keywordList.findFirst({
        where: {
          id: validatedRequest.keywordListId,
          project_id: project.id
        }
      });

      if (!keywordList) {
        throw new Error('Keyword list not found or access denied');
      }
    } else {
      const listName = validatedRequest.keywordListName || `Imported from ${toolSource} - ${new Date().toLocaleString()}`;
      keywordList = await prisma.keywordList.create({
        data: {
          project_id: project.id,
          name: listName,
          region: project.default_region
        }
      });
    }

    // Save merged keywords (update existing)
    for (const mergedKeyword of mergeResult.matched) {
      await prisma.keyword.update({
        where: { id: mergedKeyword.id },
        data: {
          search_volume: mergedKeyword.searchVolume,
          difficulty: mergedKeyword.difficulty,
          region: mergedKeyword.region,
          external_tool_data: mergedKeyword.externalToolData
        }
      });
    }

    // Save new keywords
    if (mergeResult.newKeywords.length > 0) {
      await prisma.keyword.createMany({
        data: mergeResult.newKeywords.map(keyword => ({
          keyword_list_id: keywordList.id,
          text: keyword.text,
          search_volume: keyword.searchVolume,
          difficulty: keyword.difficulty,
          region: keyword.region,
          external_tool_data: keyword.externalToolData
        }))
      });
    }

    // Generate audit trail
    const auditTrail = merger.generateAuditTrail(mergeResult, toolSource);

    // Complete import
    updateImportProgress(importId, 'completed', 100, 'Import completed successfully', {
      summary: mergeResult.summary,
      conflicts: mergeResult.conflicts,
      errors: mergeResult.errors,
      keywordListId: keywordList.id,
      keywordListName: keywordList.name,
      auditTrail
    });

  } catch (error) {
    console.error('Import processing error:', error);
    updateImportProgress(importId, 'failed', 0, undefined, undefined, error instanceof Error ? error.message : 'Unknown import error');
  }
}