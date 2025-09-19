import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '../../../../../generated/prisma';
import { z } from 'zod';
import { verifyAndDecodeToken } from '../../../../../lib/auth/session';

const prisma = new PrismaClient();

// Request validation schema for updates
const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).trim().optional(),
  domain: z.string().max(255).trim().optional().nullable(),
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

    return NextResponse.json(
      {
        success: true,
        project: {
          id: project.id,
          name: project.name,
          domain: project.domain,
          tenantId: project.tenant_id,
          tenantName: project.tenant.name,
          createdAt: project.created_at,
          updatedAt: project.updated_at,
        }
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Get project error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function PUT(
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
    const existingProject = await findProjectWithTenantCheck(projectId, user.tenant_id);
    if (!existingProject) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Validate request body
    const validationResult = updateProjectSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const updateData = validationResult.data;

    // Remove undefined values to avoid updating with undefined
    const cleanUpdateData = Object.fromEntries(
      Object.entries(updateData).filter(([, value]) => value !== undefined)
    );

    if (Object.keys(cleanUpdateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Update project
    try {
      const updatedProject = await prisma.project.update({
        where: {
          id: projectId,
        },
        data: cleanUpdateData,
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
            }
          }
        }
      });

      return NextResponse.json(
        {
          id: updatedProject.id,
          name: updatedProject.name,
          domain: updatedProject.domain,
          tenantId: updatedProject.tenant_id,
          tenantName: updatedProject.tenant.name,
          createdAt: updatedProject.created_at,
          updatedAt: updatedProject.updated_at,
        },
        { status: 200 }
      );

    } catch (error: unknown) {
      // Handle unique constraint violation
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002' &&
          'meta' in error && error.meta && typeof error.meta === 'object' && 'target' in error.meta &&
          Array.isArray(error.meta.target) && error.meta.target.includes('name')) {
        return NextResponse.json(
          { error: 'Project name already exists in your organization' },
          { status: 409 }
        );
      }
      throw error;
    }

  } catch (error) {
    console.error('Update project error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function DELETE(
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
    const existingProject = await findProjectWithTenantCheck(projectId, user.tenant_id);
    if (!existingProject) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Delete project
    await prisma.project.delete({
      where: {
        id: projectId,
      },
    });

    return NextResponse.json(
      { message: 'Project deleted successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Delete project error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}