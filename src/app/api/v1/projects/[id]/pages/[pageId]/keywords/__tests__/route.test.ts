// @ts-nocheck
import { jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { POST } from '../route';

// Mock dependencies
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  project: {
    findFirst: jest.fn(),
  },
  page: {
    findFirst: jest.fn(),
  },
  keywordList: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  keyword: {
    createMany: jest.fn(),
  },
  $disconnect: jest.fn(),
};

jest.mock('../../../../../../../../generated/prisma', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}));

jest.mock('../../../../../../../../lib/auth/session', () => ({
  verifyAndDecodeToken: jest.fn(),
}));

jest.mock('../../../../../../../../lib/services/aiService', () => ({
  aiService: {
    generateKeywords: jest.fn(),
  },
  keywordGenerationRequestSchema: {
    safeParse: jest.fn(),
  },
}));

import { verifyAndDecodeToken } from '../../../../../../../../lib/auth/session';
import { aiService, keywordGenerationRequestSchema } from '../../../../../../../../lib/services/aiService';

const mockVerifyAndDecodeToken = verifyAndDecodeToken as jest.MockedFunction<typeof verifyAndDecodeToken>;
const mockAiService = aiService as jest.Mocked<typeof aiService>;
const mockKeywordGenerationRequestSchema = keywordGenerationRequestSchema as jest.Mocked<typeof keywordGenerationRequestSchema>;

describe('/api/v1/projects/[id]/pages/[pageId]/keywords POST', () => {
  const mockUser = {
    id: 'user-1',
    username: 'testuser',
    tenant_id: 'tenant-1',
    tenant: {
      id: 'tenant-1',
      name: 'Test Tenant',
    },
  };

  const mockProject = {
    id: 'project-1',
    name: 'Test Project',
    tenant_id: 'tenant-1',
    tenant: {
      id: 'tenant-1',
      name: 'Test Tenant',
    },
  };

  const mockPage = {
    id: 'page-1',
    title: 'Test Page',
    content: 'This is test content for keyword generation',
    project_id: 'project-1',
    project: mockProject,
  };

  const mockRequestBody = {
    promptText: 'Generate keywords for: {{content}}',
    aiConfig: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'sk-test123',
      maxTokens: 4000,
      temperature: 0.7,
    },
    targetCount: 10,
    keywordListName: 'Test Keywords',
  };

  const params = { id: 'project-1', pageId: 'page-1' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should generate keywords successfully', async () => {
    // Setup mocks
    const mockRequest = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockRequestBody),
    });

    Object.defineProperty(mockRequest, 'cookies', {
      value: {
        get: jest.fn().mockReturnValue({ value: 'mock-token' }),
      },
    });

    mockVerifyAndDecodeToken.mockReturnValue({
      user: { userId: 'user-1' },
    });

    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (mockPrisma.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
    (mockPrisma.page.findFirst as jest.Mock).mockResolvedValue(mockPage);

    mockKeywordGenerationRequestSchema.safeParse.mockReturnValue({
      success: true,
      data: {
        content: mockPage.content,
        promptText: mockRequestBody.promptText,
        targetCount: mockRequestBody.targetCount,
        aiConfig: mockRequestBody.aiConfig,
      },
    });

    mockAiService.generateKeywords.mockResolvedValue({
      keywords: [
        { text: 'test keyword 1', relevanceScore: 0.9 },
        { text: 'test keyword 2', relevanceScore: 0.8 },
      ],
      tokensUsed: 150,
      processingTime: 2500,
    });

    const mockKeywordList = {
      id: 'keyword-list-1',
      name: 'Test Keywords',
      project_id: 'project-1',
      page_id: 'page-1',
      keywords: [
        { id: 'kw-1', text: 'test keyword 1', search_volume: null, difficulty: null },
        { id: 'kw-2', text: 'test keyword 2', search_volume: null, difficulty: null },
      ],
      project: { id: 'project-1', name: 'Test Project' },
      page: { id: 'page-1', title: 'Test Page', url: null },
    };

    (mockPrisma.keywordList.create as jest.Mock).mockResolvedValue({ id: 'keyword-list-1' });
    (mockPrisma.keyword.createMany as jest.Mock).mockResolvedValue({ count: 2 });
    (mockPrisma.keywordList.findUnique as jest.Mock).mockResolvedValue(mockKeywordList);

    // Execute
    const response = await POST(mockRequest, { params });

    // Verify
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.keywordList).toEqual(mockKeywordList);
    expect(data.aiMetadata.keywordsGenerated).toBe(2);

    // Verify database operations
    expect(mockPrisma.keywordList.create).toHaveBeenCalledWith({
      data: {
        name: 'Test Keywords',
        project_id: 'project-1',
        page_id: 'page-1',
        generated_at: expect.any(Date),
      },
    });

    expect(mockPrisma.keyword.createMany).toHaveBeenCalledWith({
      data: [
        {
          keyword_list_id: 'keyword-list-1',
          text: 'test keyword 1',
          search_volume: null,
          difficulty: null,
        },
        {
          keyword_list_id: 'keyword-list-1',
          text: 'test keyword 2',
          search_volume: null,
          difficulty: null,
        },
      ],
    });
  });

  it('should return 401 when user is not authenticated', async () => {
    const mockRequest = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockRequestBody),
    });

    Object.defineProperty(mockRequest, 'cookies', {
      value: {
        get: jest.fn().mockReturnValue(null),
      },
    });

    const response = await POST(mockRequest, { params });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Authentication required');
  });

  it('should return 404 when project is not found', async () => {
    const mockRequest = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockRequestBody),
    });

    Object.defineProperty(mockRequest, 'cookies', {
      value: {
        get: jest.fn().mockReturnValue({ value: 'mock-token' }),
      },
    });

    mockVerifyAndDecodeToken.mockReturnValue({
      user: { userId: 'user-1' },
    });

    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (mockPrisma.project.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await POST(mockRequest, { params });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Project not found or access denied');
  });

  it('should return 404 when page is not found', async () => {
    const mockRequest = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockRequestBody),
    });

    Object.defineProperty(mockRequest, 'cookies', {
      value: {
        get: jest.fn().mockReturnValue({ value: 'mock-token' }),
      },
    });

    mockVerifyAndDecodeToken.mockReturnValue({
      user: { userId: 'user-1' },
    });

    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (mockPrisma.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
    (mockPrisma.page.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await POST(mockRequest, { params });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Page not found or access denied');
  });

  it('should return 400 for invalid request body', async () => {
    const invalidRequestBody = {
      promptText: '', // Invalid: empty
      aiConfig: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        apiKey: 'sk-test123',
      },
      keywordListName: 'Test Keywords',
    };

    const mockRequest = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidRequestBody),
    });

    Object.defineProperty(mockRequest, 'cookies', {
      value: {
        get: jest.fn().mockReturnValue({ value: 'mock-token' }),
      },
    });

    mockVerifyAndDecodeToken.mockReturnValue({
      user: { userId: 'user-1' },
    });

    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (mockPrisma.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
    (mockPrisma.page.findFirst as jest.Mock).mockResolvedValue(mockPage);

    const response = await POST(mockRequest, { params });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Validation failed');
  });

  it('should return 500 when AI service fails', async () => {
    const mockRequest = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockRequestBody),
    });

    Object.defineProperty(mockRequest, 'cookies', {
      value: {
        get: jest.fn().mockReturnValue({ value: 'mock-token' }),
      },
    });

    mockVerifyAndDecodeToken.mockReturnValue({
      user: { userId: 'user-1' },
    });

    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (mockPrisma.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
    (mockPrisma.page.findFirst as jest.Mock).mockResolvedValue(mockPage);

    mockKeywordGenerationRequestSchema.safeParse.mockReturnValue({
      success: true,
      data: {
        content: mockPage.content,
        promptText: mockRequestBody.promptText,
        targetCount: mockRequestBody.targetCount,
        aiConfig: mockRequestBody.aiConfig,
      },
    });

    mockAiService.generateKeywords.mockResolvedValue({
      keywords: [],
      processingTime: 1000,
      error: 'AI service connection failed',
    });

    const response = await POST(mockRequest, { params });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('AI keyword generation failed');
  });

  it('should return 500 when no keywords are generated', async () => {
    const mockRequest = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockRequestBody),
    });

    Object.defineProperty(mockRequest, 'cookies', {
      value: {
        get: jest.fn().mockReturnValue({ value: 'mock-token' }),
      },
    });

    mockVerifyAndDecodeToken.mockReturnValue({
      user: { userId: 'user-1' },
    });

    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (mockPrisma.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
    (mockPrisma.page.findFirst as jest.Mock).mockResolvedValue(mockPage);

    mockKeywordGenerationRequestSchema.safeParse.mockReturnValue({
      success: true,
      data: {
        content: mockPage.content,
        promptText: mockRequestBody.promptText,
        targetCount: mockRequestBody.targetCount,
        aiConfig: mockRequestBody.aiConfig,
      },
    });

    mockAiService.generateKeywords.mockResolvedValue({
      keywords: [], // No keywords generated
      processingTime: 1500,
    });

    const response = await POST(mockRequest, { params });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('No keywords generated');
  });

  it('should handle database errors gracefully', async () => {
    const mockRequest = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockRequestBody),
    });

    Object.defineProperty(mockRequest, 'cookies', {
      value: {
        get: jest.fn().mockReturnValue({ value: 'mock-token' }),
      },
    });

    mockVerifyAndDecodeToken.mockReturnValue({
      user: { userId: 'user-1' },
    });

    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (mockPrisma.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
    (mockPrisma.page.findFirst as jest.Mock).mockResolvedValue(mockPage);

    mockKeywordGenerationRequestSchema.safeParse.mockReturnValue({
      success: true,
      data: {
        content: mockPage.content,
        promptText: mockRequestBody.promptText,
        targetCount: mockRequestBody.targetCount,
        aiConfig: mockRequestBody.aiConfig,
      },
    });

    mockAiService.generateKeywords.mockResolvedValue({
      keywords: [{ text: 'test keyword', relevanceScore: 0.9 }],
      tokensUsed: 100,
      processingTime: 1200,
    });

    (mockPrisma.keywordList.create as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

    const response = await POST(mockRequest, { params });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Internal server error');
  });
});