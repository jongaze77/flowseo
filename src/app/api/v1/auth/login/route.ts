import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '../../../../../generated/prisma';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { generateAuthToken, createAuthCookie } from '../../../../lib/auth/session';

const prisma = new PrismaClient();

// Request validation schema
const loginRequestSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  tenantId: z.string().uuid().optional(), // Optional for multi-tenant login
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validationResult = loginRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { username, password, tenantId } = validationResult.data;

    // Find user by username and optionally tenantId
    const whereClause = tenantId
      ? { username, tenant_id: tenantId }
      : { username };

    const user = await prisma.user.findFirst({
      where: whereClause,
      include: {
        tenant: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Generate JWT token
    const userPayload = {
      userId: user.id,
      username: user.username,
      tenantId: user.tenant_id,
      tenantName: user.tenant.name,
    };

    const token = generateAuthToken(userPayload);

    // Create response with httpOnly cookie
    const response = NextResponse.json(
      {
        message: 'Login successful',
        user: {
          id: user.id,
          username: user.username,
          tenantId: user.tenant_id,
          tenantName: user.tenant.name,
        },
      },
      { status: 200 }
    );

    // Set httpOnly cookie for security using session utilities
    const authCookie = createAuthCookie(token);
    response.cookies.set(authCookie.name, authCookie.value, authCookie.options);

    return response;

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}