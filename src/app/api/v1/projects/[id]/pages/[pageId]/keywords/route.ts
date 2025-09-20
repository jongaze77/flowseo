import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '../../../../../../../../generated/prisma';
import { z } from 'zod';
import { verifyAndDecodeToken } from '../../../../../../../../lib/auth/session';
import { aiService, keywordGenerationRequestSchema } from '../../../../../../../../lib/services/aiService';

const prisma = new PrismaClient();

// Request validation schema for keyword generation
const keywordGenerationEndpointSchema = z.object({
  promptText: z.string().min(1, 'Prompt text is required'),
  aiConfig: z.object({
    provider: z.enum(['openai', 'anthropic']),
    model: z.string(),
    apiKey: z.string(),
    maxTokens: z.number().optional().default(4000),
    temperature: z.number().min(0).max(2).optional().default(0.7),
  }),
  targetCount: z.number().min(1).max(200).optional().default(100),
  keywordListName: z.string().min(1, 'Keyword list name is required'),
  region: z.enum(['UK', 'US', 'AU', 'CA']).optional(),
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
      tenant: true,
    },
  });

  return project;
}

// Helper function to find page and verify project ownership
async function findPageWithProjectCheck(pageId: string, projectId: string) {
  const page = await prisma.page.findFirst({
    where: {
      id: pageId,
      project_id: projectId,
    },
    include: {
      project: true,
    },
  });

  return page;
}

/**
 * POST /api/v1/projects/[id]/pages/[pageId]/keywords
 * Generate keywords from page content using AI
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pageId: string }> }
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

    // Validate page ownership
    const page = await findPageWithProjectCheck(resolvedParams.pageId, resolvedParams.id);
    if (!page) {
      return NextResponse.json({ error: 'Page not found or access denied' }, { status: 404 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = keywordGenerationEndpointSchema.parse(body);

    // Fetch the actual API key from tenant AI settings
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenant_id },
    });

    if (!tenant || !tenant.ai_api_keys) {
      return NextResponse.json(
        { error: 'No AI settings configured. Please configure AI settings first.' },
        { status: 400 }
      );
    }

    const aiApiKeys = tenant.ai_api_keys as Record<string, {
      apiKey: string;
      model: string;
      maxTokens: number;
      temperature: number;
      updatedAt: string;
    }>;

    const providerConfig = aiApiKeys[validatedData.aiConfig.provider];
    if (!providerConfig || !providerConfig.apiKey) {
      return NextResponse.json(
        { error: `No API key configured for ${validatedData.aiConfig.provider}` },
        { status: 400 }
      );
    }

    // Get region from request body (with fallback to project default)
    const region = body.region || project.default_region;

    // Prepare AI service request with actual API key
    const aiRequest = {
      content: page.content,
      promptText: validatedData.promptText,
      targetCount: validatedData.targetCount,
      region: region,
      aiConfig: {
        ...validatedData.aiConfig,
        apiKey: providerConfig.apiKey, // Use actual API key from database
      },
    };

    // Validate AI request
    const aiRequestValidation = keywordGenerationRequestSchema.safeParse(aiRequest);
    if (!aiRequestValidation.success) {
      return NextResponse.json(
        { error: 'Invalid AI request parameters', details: aiRequestValidation.error.issues },
        { status: 400 }
      );
    }

    // Generate keywords using AI service
    const aiResponse = await aiService.generateKeywords(aiRequest);

    if (aiResponse.error) {
      return NextResponse.json(
        { error: 'AI keyword generation failed', details: aiResponse.error },
        { status: 500 }
      );
    }

    if (aiResponse.keywords.length === 0) {
      return NextResponse.json(
        { error: 'No keywords generated', details: 'AI service returned empty results' },
        { status: 500 }
      );
    }

    // Save keyword list to database
    const keywordList = await prisma.keywordList.create({
      data: {
        name: validatedData.keywordListName,
        project_id: resolvedParams.id,
        page_id: resolvedParams.pageId,
        region: region,
        generated_at: new Date(),
      },
    });

    // Save individual keywords
    const keywordData = aiResponse.keywords.map(keyword => ({
      keyword_list_id: keywordList.id,
      text: keyword.text,
      search_volume: keyword.searchVolume || null,
      difficulty: keyword.difficulty || null,
      region: region,
    }));

    await prisma.keyword.createMany({
      data: keywordData,
    });

    // Update page analysis status
    type AnalysisStatus = {
      analyzed: boolean;
      analyzedAt?: string;
      keywordCount?: number;
    };
    const currentAnalysisStatus = page.analysis_status as Record<string, AnalysisStatus> || {};
    const updatedAnalysisStatus = {
      ...currentAnalysisStatus,
      [region]: {
        analyzed: true,
        analyzedAt: new Date().toISOString(),
        keywordCount: aiResponse.keywords.length,
      },
    };

    await prisma.page.update({
      where: { id: resolvedParams.pageId },
      data: {
        analysis_status: updatedAnalysisStatus,
      },
    });

    // Fetch complete keyword list with keywords for response
    const completeKeywordList = await prisma.keywordList.findUnique({
      where: { id: keywordList.id },
      include: {
        keywords: true,
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        page: {
          select: {
            id: true,
            title: true,
            url: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      keywordList: completeKeywordList,
      region: region,
      analysisStatus: (updatedAnalysisStatus as Record<string, AnalysisStatus>)[region],
      aiMetadata: {
        tokensUsed: aiResponse.tokensUsed,
        processingTime: aiResponse.processingTime,
        keywordsGenerated: aiResponse.keywords.length,
      },
    }, { status: 201 });

  } catch (error) {
    console.error('Keyword generation error:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    // Handle general errors
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}