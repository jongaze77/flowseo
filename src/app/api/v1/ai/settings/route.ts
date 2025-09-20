import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAndDecodeToken } from '../../../../../lib/auth/session';
import { PrismaClient } from '../../../../../generated/prisma';
import { PROMPT_TYPES } from '../../../../../lib/services/aiService';

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
    id: z.string().uuid().optional(), // For editing existing prompts
    name: z.string().min(1, 'Prompt name is required').max(100),
    promptText: z.string().min(10, 'Prompt text is required').max(5000),
    promptType: z.enum([
      PROMPT_TYPES.KEYWORD_GENERATION,
      PROMPT_TYPES.CONTENT_ANALYSIS,
      PROMPT_TYPES.SEO_OPTIMIZATION,
      PROMPT_TYPES.META_GENERATION,
      PROMPT_TYPES.COMPETITOR_ANALYSIS
    ] as const),
    isDefault: z.boolean().default(false),
    isEnabled: z.boolean().default(true),
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

    // Get existing AI keys to preserve them
    const existingTenant = await prisma.tenant.findUnique({
      where: { id: user.tenant_id },
    });
    const existingAiKeys = (existingTenant?.ai_api_keys as Record<string, {
      apiKey: string;
      model: string;
      maxTokens: number;
      temperature: number;
      updatedAt: string;
    }>) || {};

    // Handle API key preservation for existing configs
    let apiKeyToSave = validatedData.aiConfig.apiKey;
    if (validatedData.aiConfig.apiKey === 'PRESERVE_EXISTING_KEY') {
      const existingConfig = existingAiKeys[validatedData.aiConfig.provider];
      if (existingConfig?.apiKey) {
        apiKeyToSave = existingConfig.apiKey;
      } else {
        return NextResponse.json({ error: 'No existing API key found to preserve' }, { status: 400 });
      }
    }

    // Update tenant AI API keys (preserve existing keys for other providers)
    await prisma.tenant.update({
      where: { id: user.tenant_id },
      data: {
        ai_api_keys: {
          ...existingAiKeys,
          [validatedData.aiConfig.provider]: {
            apiKey: apiKeyToSave,
            model: validatedData.aiConfig.model,
            maxTokens: validatedData.aiConfig.maxTokens,
            temperature: validatedData.aiConfig.temperature,
            updatedAt: new Date().toISOString(),
          }
        }
      },
    });

    // Handle default prompt logic - if this prompt is being set as default,
    // remove default from other prompts of the same type
    if (validatedData.promptConfig.isDefault) {
      const whereClause: any = {
        tenant_id: user.tenant_id,
        prompt_type: validatedData.promptConfig.promptType,
      };

      // Only add the 'not' condition if we have a valid existing ID
      if (validatedData.promptConfig.id) {
        whereClause.id = { not: validatedData.promptConfig.id };
      }

      await prisma.aIPrompt.updateMany({
        where: whereClause,
        data: { is_default: false }
      });
    }

    // Create or update AI prompt
    if (validatedData.promptConfig.id) {
      // Update existing prompt by ID
      const existingPrompt = await prisma.aIPrompt.findFirst({
        where: {
          id: validatedData.promptConfig.id,
          tenant_id: user.tenant_id, // Security: ensure user owns the prompt
        },
      });

      if (!existingPrompt) {
        return NextResponse.json({ error: 'Prompt not found or access denied' }, { status: 404 });
      }

      await prisma.aIPrompt.update({
        where: { id: validatedData.promptConfig.id },
        data: {
          name: validatedData.promptConfig.name,
          prompt_text: validatedData.promptConfig.promptText,
          ai_model: validatedData.aiConfig.model,
          prompt_type: validatedData.promptConfig.promptType,
          is_default: validatedData.promptConfig.isDefault,
          is_enabled: validatedData.promptConfig.isEnabled,
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
          prompt_type: validatedData.promptConfig.promptType,
          is_default: validatedData.promptConfig.isDefault,
          is_enabled: validatedData.promptConfig.isEnabled,
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
          details: error.issues
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

/**
 * DELETE /api/v1/ai/settings?promptId=...
 * Delete an AI prompt
 */
export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get prompt ID from query parameters
    const { searchParams } = new URL(request.url);
    const promptId = searchParams.get('promptId');

    if (!promptId) {
      return NextResponse.json({ error: 'Prompt ID is required' }, { status: 400 });
    }

    // Verify prompt exists and user owns it
    const existingPrompt = await prisma.aIPrompt.findFirst({
      where: {
        id: promptId,
        tenant_id: user.tenant_id,
      },
    });

    if (!existingPrompt) {
      return NextResponse.json({ error: 'Prompt not found or access denied' }, { status: 404 });
    }

    // Delete the prompt
    await prisma.aIPrompt.delete({
      where: { id: promptId },
    });

    return NextResponse.json({
      success: true,
      message: 'Prompt deleted successfully',
    });

  } catch (error) {
    console.error('AI prompt delete error:', error);

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