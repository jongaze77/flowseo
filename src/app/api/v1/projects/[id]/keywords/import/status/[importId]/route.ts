import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '../../../../../../../../../generated/prisma';
import { verifyAndDecodeToken } from '../../../../../../../../../lib/auth/session';
import { getImportProgress, clearImportProgress } from '../../../../../../../../../lib/services/importProgress';

const prisma = new PrismaClient();

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
 * GET /api/v1/projects/[id]/keywords/import/status/[importId]
 * Get import status and progress
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; importId: string }> }
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

    // Get import status
    const importStatus = getImportProgress(resolvedParams.importId);
    if (!importStatus) {
      return NextResponse.json({ error: 'Import not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      importId: resolvedParams.importId,
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

/**
 * DELETE /api/v1/projects/[id]/keywords/import/status/[importId]
 * Cancel or clear import status
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; importId: string }> }
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

    // Check if import exists
    const importStatus = getImportProgress(resolvedParams.importId);
    if (!importStatus) {
      return NextResponse.json({ error: 'Import not found' }, { status: 404 });
    }

    // Only allow deletion if import is completed or failed
    if (importStatus.status === 'processing') {
      return NextResponse.json({ error: 'Cannot delete import while processing' }, { status: 400 });
    }

    // Remove import status
    clearImportProgress(resolvedParams.importId);

    return NextResponse.json({
      success: true,
      message: 'Import status cleared successfully'
    });

  } catch (error) {
    console.error('Import status deletion error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

