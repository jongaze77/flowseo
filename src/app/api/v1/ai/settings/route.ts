import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAndDecodeToken } from '../../../../../lib/auth/session';
import { PrismaClient } from '../../../../../generated/prisma';

const prisma = new PrismaClient();

// Request validation schema for AI settings
const aiSettingsSchema = z.object({
  tenantId: z.string().uuid('Invalid tenant ID'),
  aiConfig: z.object({
    provider: z.enum(['openai', 'anthropic']),
    model: z.string().min(1, 'Model is required'),
    apiKey: z.string().min(1, 'API key is required'),
    maxTokens: z.number().min(100).max(8000),
    temperature: z.number().min(0).max(2),
  }),
  promptConfig: z.object({
    name: z.string().min(1, 'Prompt name is required').max(100),
    promptText: z.string().min(10, 'Prompt text is required').max(5000),
  }),
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

/**
 * POST /api/v1/ai/settings
 * Save AI configuration settings for a tenant
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
    const validatedData = aiSettingsSchema.parse(body);

    // Verify tenant access
    if (validatedData.tenantId !== user.tenant_id) {
      return NextResponse.json({ error: 'Access denied to tenant' }, { status: 403 });
    }

    // Update tenant AI API keys (store encrypted in production)
    await prisma.tenant.update({
      where: { id: user.tenant_id },
      data: {
        ai_api_keys: {
          [validatedData.aiConfig.provider]: {
            apiKey: validatedData.aiConfig.apiKey,
            model: validatedData.aiConfig.model,
            maxTokens: validatedData.aiConfig.maxTokens,
            temperature: validatedData.aiConfig.temperature,
            updatedAt: new Date().toISOString(),
          }
        }
      },
    });

    // Create or update AI prompt
    const existingPrompt = await prisma.aIPrompt.findFirst({
      where: {
        tenant_id: user.tenant_id,
        name: validatedData.promptConfig.name,
      },
    });

    if (existingPrompt) {
      // Update existing prompt
      await prisma.aIPrompt.update({
        where: { id: existingPrompt.id },
        data: {
          prompt_text: validatedData.promptConfig.promptText,
          ai_model: validatedData.aiConfig.model,
        },
      });
    } else {
      // Create new prompt
      await prisma.aIPrompt.create({
        data: {
          tenant_id: user.tenant_id,
          name: validatedData.promptConfig.name,
          prompt_text: validatedData.promptConfig.promptText,
          ai_model: validatedData.aiConfig.model,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'AI settings saved successfully',
    });

  } catch (error) {
    console.error('AI settings save error:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid settings data',
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

/**
 * GET /api/v1/ai/settings
 * Get AI configuration settings for the current tenant
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get tenant AI settings
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenant_id },
      include: {
        ai_prompts: {
          orderBy: { created_at: 'desc' },
          take: 10, // Latest 10 prompts
        },
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Format AI API keys (remove sensitive data)
    const aiSettings = tenant.ai_api_keys ?
      Object.entries(tenant.ai_api_keys as Record<string, {
        model: string;
        apiKey: string;
        maxTokens: number;
        temperature: number;
        updatedAt: string;
      }>).map(([provider, config]) => ({
        provider,
        model: config.model,
        hasApiKey: !!config.apiKey,
        maxTokens: config.maxTokens,
        temperature: config.temperature,
        updatedAt: config.updatedAt,
      })) : [];

    return NextResponse.json({
      success: true,
      aiSettings,
      prompts: tenant.ai_prompts,
    });

  } catch (error) {
    console.error('AI settings fetch error:', error);

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