import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '../../../../../../generated/prisma';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Request validation schema for creating a user
const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8),
});

interface RouteParams {
  params: Promise<{
    tenantId: string;
  }>;
}

// POST /api/v1/tenants/:tenantId/users - Create new user
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { tenantId } = await params;
    const body = await request.json();

    // Validate request body
    const validationResult = createUserSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { username, password } = validationResult.data;

    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Check if username already exists within this tenant
    const existingUser = await prisma.user.findFirst({
      where: {
        username,
        tenant_id: tenantId
      }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Username already exists in this organization' },
        { status: 409 }
      );
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        password_hash,
        tenant_id: tenantId,
      },
      select: {
        id: true,
        username: true,
        tenant_id: true,
      }
    });

    return NextResponse.json(
      {
        message: 'User created successfully',
        user
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/v1/tenants/:tenantId/users - List all users in tenant
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { tenantId } = await params;

    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Get all users in the tenant
    const users = await prisma.user.findMany({
      where: { tenant_id: tenantId },
      select: {
        id: true,
        username: true,
        tenant_id: true,
      },
      orderBy: {
        username: 'asc'
      }
    });

    return NextResponse.json({
      users,
      count: users.length
    });

  } catch (error) {
    console.error('List users error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}