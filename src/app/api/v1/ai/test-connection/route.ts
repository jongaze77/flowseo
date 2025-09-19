import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { aiService, aiModelConfigSchema } from '../../../../../lib/services/aiService';
import { verifyAndDecodeToken } from '../../../../../lib/auth/session';
import { PrismaClient } from '../../../../../generated/prisma';

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

/**
 * POST /api/v1/ai/test-connection
 * Test AI service connection with provided configuration
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedConfig = aiModelConfigSchema.parse(body);

    // Test connection using AI service
    const testResult = await aiService.testConnection(validatedConfig);

    if (testResult.success) {
      return NextResponse.json({
        success: true,
        message: 'AI service connection successful',
      });
    } else {
      return NextResponse.json({
        success: false,
        error: testResult.error || 'Connection test failed',
      }, { status: 400 });
    }

  } catch (error) {
    console.error('AI connection test error:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid configuration',
          details: error.errors
        },
        { status: 400 }
      );
    }

    // Handle general errors
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}