import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '../../../../../../generated/prisma';
import { z } from 'zod';
import { verifyAndDecodeToken } from '../../../../../../lib/auth/session';
import { processContent, contentTypeSchema } from '../../../../../../lib/services/webScraper';

const prisma = new PrismaClient();

// Request validation schema for content ingestion
const contentIngestionSchema = z.object({
  content: z.string().min(1, 'Content cannot be empty').max(1000000, 'Content is too large'),
  contentType: contentTypeSchema,
  title: z.string().max(500).optional(),
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
      tenant: {
        select: {
          id: true,
          name: true,
        }
      }
    }
  });

  return project;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { id: projectId } = await params;

    // Verify project exists and belongs to user's tenant
    const project = await findProjectWithTenantCheck(projectId, user.tenant_id);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Validate request body
    const validationResult = contentIngestionSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { content, contentType, title: providedTitle } = validationResult.data;

    // Process content based on type (URL scraping or direct content)
    const processingResult = await processContent(content, contentType);

    if (processingResult.error) {
      return NextResponse.json(
        { error: processingResult.error },
        { status: 400 }
      );
    }

    if (!processingResult.content || processingResult.content.trim().length === 0) {
      return NextResponse.json(
        { error: 'No content could be extracted' },
        { status: 400 }
      );
    }

    // Use provided title or extracted title
    const finalTitle = providedTitle || processingResult.title;

    // Save to database
    const page = await prisma.page.create({
      data: {
        url: contentType === 'url' ? processingResult.url || content : null,
        title: finalTitle,
        content: processingResult.content,
        project_id: projectId,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            tenant_id: true,
          }
        }
      }
    });

    return NextResponse.json(
      {
        id: page.id,
        url: page.url,
        title: page.title,
        content: page.content,
        projectId: page.project_id,
        projectName: page.project.name,
        createdAt: page.created_at,
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Content ingestion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { id: projectId } = await params;

    // Verify project exists and belongs to user's tenant
    const project = await findProjectWithTenantCheck(projectId, user.tenant_id);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Get all pages for the project
    const pages = await prisma.page.findMany({
      where: {
        project_id: projectId,
      },
      select: {
        id: true,
        url: true,
        title: true,
        content: true,
        created_at: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return NextResponse.json(
      {
        pages: pages.map(page => ({
          id: page.id,
          url: page.url,
          title: page.title,
          content: page.content,
          createdAt: page.created_at,
        })),
        projectId: project.id,
        projectName: project.name,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Get pages error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}