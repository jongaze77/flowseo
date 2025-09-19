import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '../../../../../../generated/prisma';
import { z } from 'zod';
import { verifyAndDecodeToken } from '../../../../../../lib/auth/session';

const prisma = new PrismaClient();

// Query parameters validation schema
const keywordListQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  sortBy: z.enum(['created_at', 'name', 'generated_at']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

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

/**
 * GET /api/v1/projects/[id]/keywords
 * List all keyword lists for a project with pagination and filtering
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

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = {
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      search: searchParams.get('search'),
      sortBy: searchParams.get('sortBy'),
      sortOrder: searchParams.get('sortOrder'),
    };

    const validatedQuery = keywordListQuerySchema.parse(queryParams);

    // Build where clause for search
    const whereClause: {
      project_id: string;
      name?: {
        contains: string;
        mode: 'insensitive';
      };
    } = {
      project_id: resolvedParams.id,
    };

    if (validatedQuery.search) {
      whereClause.name = {
        contains: validatedQuery.search,
        mode: 'insensitive',
      };
    }

    // Calculate offset for pagination
    const offset = (validatedQuery.page - 1) * validatedQuery.limit;

    // Build order by clause
    const orderBy: Record<string, string> = {};
    orderBy[validatedQuery.sortBy] = validatedQuery.sortOrder;

    // Fetch keyword lists with pagination
    const [keywordLists, totalCount] = await Promise.all([
      prisma.keywordList.findMany({
        where: whereClause,
        include: {
          keywords: {
            select: {
              id: true,
              text: true,
              search_volume: true,
              difficulty: true,
              created_at: true,
            },
            orderBy: {
              created_at: 'asc',
            },
          },
          page: {
            select: {
              id: true,
              title: true,
              url: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy,
        skip: offset,
        take: validatedQuery.limit,
      }),
      prisma.keywordList.count({
        where: whereClause,
      }),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / validatedQuery.limit);
    const hasNext = validatedQuery.page < totalPages;
    const hasPrev = validatedQuery.page > 1;

    // Aggregate statistics
    const totalKeywords = keywordLists.reduce((sum, list) => sum + list.keywords.length, 0);

    return NextResponse.json({
      success: true,
      data: keywordLists,
      pagination: {
        page: validatedQuery.page,
        limit: validatedQuery.limit,
        totalCount,
        totalPages,
        hasNext,
        hasPrev,
      },
      meta: {
        totalKeywordLists: totalCount,
        totalKeywords,
        projectId: resolvedParams.id,
        projectName: project.name,
      },
    });

  } catch (error) {
    console.error('Keyword list fetch error:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.issues },
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
 * DELETE /api/v1/projects/[id]/keywords
 * Delete a keyword list (requires keywordListId in body)
 */
export async function DELETE(
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

    // Parse request body
    const body = await request.json();
    const { keywordListId } = z.object({
      keywordListId: z.string().uuid('Invalid keyword list ID'),
    }).parse(body);

    // Verify keyword list belongs to project
    const keywordList = await prisma.keywordList.findFirst({
      where: {
        id: keywordListId,
        project_id: resolvedParams.id,
      },
      include: {
        keywords: true,
      },
    });

    if (!keywordList) {
      return NextResponse.json({ error: 'Keyword list not found or access denied' }, { status: 404 });
    }

    // Delete keyword list (cascade will delete keywords)
    await prisma.keywordList.delete({
      where: { id: keywordListId },
    });

    return NextResponse.json({
      success: true,
      message: 'Keyword list deleted successfully',
      deleted: {
        keywordListId: keywordList.id,
        keywordListName: keywordList.name,
        keywordsCount: keywordList.keywords.length,
      },
    });

  } catch (error) {
    console.error('Keyword list deletion error:', error);

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