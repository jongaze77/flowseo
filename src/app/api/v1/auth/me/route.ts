import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '../../../../../generated/prisma';
import { verifyAndDecodeToken, generateAuthToken, createAuthCookie } from '../../../../lib/auth/session';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Get token from cookie
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Verify and decode JWT token
    const tokenResult = verifyAndDecodeToken(token);
    if (!tokenResult) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const { user: decoded, needsRenewal } = tokenResult;

    // Fetch fresh user data to ensure it's still valid
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        tenant: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      );
    }

    const response = NextResponse.json(
      {
        user: {
          id: user.id,
          username: user.username,
          tenantId: user.tenant_id,
          tenantName: user.tenant.name,
        },
      },
      { status: 200 }
    );

    // Renew token if needed
    if (needsRenewal) {
      const userPayload = {
        userId: user.id,
        username: user.username,
        tenantId: user.tenant_id,
        tenantName: user.tenant.name,
      };
      const newToken = generateAuthToken(userPayload);
      const authCookie = createAuthCookie(newToken);
      response.cookies.set(authCookie.name, authCookie.value, authCookie.options);
    }

    return response;

  } catch (error) {
    console.error('Auth verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}