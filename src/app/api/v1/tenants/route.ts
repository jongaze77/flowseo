import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '../../../../generated/prisma';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Request validation schema
const registerRequestSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8),
  tenantName: z.string().min(1).max(255),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validationResult = registerRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { username, password, tenantName } = validationResult.data;

    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 12);

    // Create tenant and user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: tenantName,
        }
      });

      // Create user associated with tenant
      const user = await tx.user.create({
        data: {
          username,
          password_hash,
          tenant_id: tenant.id,
        }
      });

      return { tenant, user };
    });

    return NextResponse.json(
      {
        message: 'Registration successful',
        tenant: {
          id: result.tenant.id,
          name: result.tenant.name,
        },
        user: {
          id: result.user.id,
          username: result.user.username,
        }
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}