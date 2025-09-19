import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '../../../../generated/prisma';
import { z } from 'zod';
import { verifyAndDecodeToken } from '../../../../lib/auth/session';

const prisma = new PrismaClient();

// Request validation schemas
const createProjectSchema = z.object({
  name: z.string().min(1).max(255).trim(),
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

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate request body
    const validationResult = createProjectSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { name, domain } = validationResult.data;

    // Create project with tenant scope
    try {
      const project = await prisma.project.create({
        data: {
          name,
          domain: domain || null,
          tenant_id: user.tenant_id,
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

      return NextResponse.json(
        {
          id: project.id,
          name: project.name,
          domain: project.domain,
          tenantId: project.tenant_id,
          tenantName: project.tenant.name,
          createdAt: project.created_at,
          updatedAt: project.updated_at,
        },
        { status: 201 }
      );

    } catch (error: any) {
      // Handle unique constraint violation
      if (error.code === 'P2002' && error.meta?.target?.includes('name')) {
        return NextResponse.json(
          { error: 'Project name already exists in your organization' },
          { status: 409 }
        );
      }
      throw error;
    }

  } catch (error) {
    console.error('Create project error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get projects for user's tenant
    const projects = await prisma.project.findMany({
      where: {
        tenant_id: user.tenant_id,
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    const formattedProjects = projects.map(project => ({
      id: project.id,
      name: project.name,
      domain: project.domain,
      tenantId: project.tenant_id,
      tenantName: project.tenant.name,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    }));

    return NextResponse.json(
      {
        projects: formattedProjects,
        count: formattedProjects.length,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('List projects error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}