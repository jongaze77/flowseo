import { jest } from '@jest/globals';
import { NextRequest } from 'next/server';

// Mock Prisma completely
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  project: {
    findFirst: jest.fn(),
  },
  page: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  $disconnect: jest.fn(),
};

// Mock auth session
const mockAuth = {
  verifyAndDecodeToken: jest.fn(),
};

// Mock web scraper
const mockWebScraper = {
  processContent: jest.fn(),
};

jest.mock('../../../../../../../generated/prisma', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}));

jest.mock('../../../../../../../lib/auth/session', () => mockAuth);

jest.mock('../../../../../../../lib/services/webScraper', () => mockWebScraper);

// Dynamic import after mocks are set up
let POST: (request: NextRequest, context: { params: Promise<{ id: string }> }) => Promise<Response>;
let GET: (request: NextRequest, context: { params: Promise<{ id: string }> }) => Promise<Response>;

describe('/api/v1/projects/[id]/pages', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    if (!POST || !GET) {
      const routeModule = await import('../route');
      POST = routeModule.POST;
      GET = routeModule.GET;
    }
  });

  const mockUser = {
    id: 'user-123',
    username: 'testuser',
    tenant_id: 'tenant-123',
    tenant: {
      id: 'tenant-123',
      name: 'Test Company',
    },
  };

  const mockProject = {
    id: 'project-123',
    name: 'Test Project',
    domain: 'example.com',
    tenant_id: 'tenant-123',
    tenant: {
      id: 'tenant-123',
      name: 'Test Company',
    },
  };

  describe('POST /api/v1/projects/[id]/pages', () => {
    it('should successfully create a page from URL content', async () => {
      // Mock authenticated user
      mockAuth.verifyAndDecodeToken.mockReturnValue({
        user: { userId: 'user-123' }
      });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      // Mock project exists
      mockPrisma.project.findFirst.mockResolvedValue(mockProject);

      // Mock web scraper success
      mockWebScraper.processContent.mockResolvedValue({
        title: 'Scraped Page Title',
        content: 'This is the scraped content from the webpage.',
        url: 'https://example.com',
        error: undefined,
      });

      // Mock page creation
      const mockCreatedPage = {
        id: 'page-123',
        url: 'https://example.com',
        title: 'Scraped Page Title',
        content: 'This is the scraped content from the webpage.',
        project_id: 'project-123',
        created_at: new Date(),
        project: mockProject,
      };
      mockPrisma.page.create.mockResolvedValue(mockCreatedPage);

      const request = new NextRequest('http://localhost:3000/api/v1/projects/project-123/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'auth-token=valid-token',
        },
        body: JSON.stringify({
          content: 'https://example.com',
          contentType: 'url',
        }),
      });

      const params = Promise.resolve({ id: 'project-123' });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.title).toBe('Scraped Page Title');
      expect(data.content).toBe('This is the scraped content from the webpage.');
      expect(data.url).toBe('https://example.com');
      expect(mockWebScraper.processContent).toHaveBeenCalledWith('https://example.com', 'url');
    });

    it('should successfully create a page from HTML content', async () => {
      // Mock authenticated user
      mockAuth.verifyAndDecodeToken.mockReturnValue({
        user: { userId: 'user-123' }
      });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      // Mock project exists
      mockPrisma.project.findFirst.mockResolvedValue(mockProject);

      // Mock web scraper success
      mockWebScraper.processContent.mockResolvedValue({
        title: 'HTML Page Title',
        content: 'This is the processed HTML content.',
        error: undefined,
      });

      // Mock page creation
      const mockCreatedPage = {
        id: 'page-456',
        url: null,
        title: 'HTML Page Title',
        content: 'This is the processed HTML content.',
        project_id: 'project-123',
        created_at: new Date(),
        project: mockProject,
      };
      mockPrisma.page.create.mockResolvedValue(mockCreatedPage);

      const htmlContent = '<html><head><title>HTML Page Title</title></head><body><p>HTML content</p></body></html>';
      const request = new NextRequest('http://localhost:3000/api/v1/projects/project-123/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'auth-token=valid-token',
        },
        body: JSON.stringify({
          content: htmlContent,
          contentType: 'html',
          title: 'Custom Title',
        }),
      });

      const params = Promise.resolve({ id: 'project-123' });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.title).toBe('HTML Page Title'); // Uses extracted title, not custom
      expect(mockWebScraper.processContent).toHaveBeenCalledWith(htmlContent, 'html');
    });

    it('should return 401 for unauthenticated requests', async () => {
      mockAuth.verifyAndDecodeToken.mockReturnValue(null);

      const request = new NextRequest('http://localhost:3000/api/v1/projects/project-123/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'https://example.com',
          contentType: 'url',
        }),
      });

      const params = Promise.resolve({ id: 'project-123' });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Not authenticated');
    });

    it('should return 404 for non-existent project', async () => {
      // Mock authenticated user
      mockAuth.verifyAndDecodeToken.mockReturnValue({
        user: { userId: 'user-123' }
      });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      // Mock project not found
      mockPrisma.project.findFirst.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/v1/projects/nonexistent/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'auth-token=valid-token',
        },
        body: JSON.stringify({
          content: 'https://example.com',
          contentType: 'url',
        }),
      });

      const params = Promise.resolve({ id: 'nonexistent' });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Project not found');
    });

    it('should return 400 for invalid input', async () => {
      // Mock authenticated user
      mockAuth.verifyAndDecodeToken.mockReturnValue({
        user: { userId: 'user-123' }
      });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      // Mock project exists
      mockPrisma.project.findFirst.mockResolvedValue(mockProject);

      const request = new NextRequest('http://localhost:3000/api/v1/projects/project-123/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'auth-token=valid-token',
        },
        body: JSON.stringify({
          content: '', // Empty content
          contentType: 'url',
        }),
      });

      const params = Promise.resolve({ id: 'project-123' });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid input');
    });

    it('should return 400 for scraping errors', async () => {
      // Mock authenticated user
      mockAuth.verifyAndDecodeToken.mockReturnValue({
        user: { userId: 'user-123' }
      });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      // Mock project exists
      mockPrisma.project.findFirst.mockResolvedValue(mockProject);

      // Mock web scraper error
      mockWebScraper.processContent.mockResolvedValue({
        title: null,
        content: '',
        error: 'Failed to fetch content from URL',
      });

      const request = new NextRequest('http://localhost:3000/api/v1/projects/project-123/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'auth-token=valid-token',
        },
        body: JSON.stringify({
          content: 'https://invalid-url.com',
          contentType: 'url',
        }),
      });

      const params = Promise.resolve({ id: 'project-123' });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Failed to fetch content from URL');
    });
  });

  describe('GET /api/v1/projects/[id]/pages', () => {
    it('should successfully retrieve pages for a project', async () => {
      // Mock authenticated user
      mockAuth.verifyAndDecodeToken.mockReturnValue({
        user: { userId: 'user-123' }
      });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      // Mock project exists
      mockPrisma.project.findFirst.mockResolvedValue(mockProject);

      // Mock pages
      const mockPages = [
        {
          id: 'page-1',
          url: 'https://example.com',
          title: 'First Page',
          content: 'Content of first page',
          created_at: new Date(),
        },
        {
          id: 'page-2',
          url: null,
          title: 'Second Page',
          content: 'Content of second page',
          created_at: new Date(),
        },
      ];
      mockPrisma.page.findMany.mockResolvedValue(mockPages);

      const request = new NextRequest('http://localhost:3000/api/v1/projects/project-123/pages', {
        method: 'GET',
        headers: {
          'Cookie': 'auth-token=valid-token',
        },
      });

      const params = Promise.resolve({ id: 'project-123' });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pages).toHaveLength(2);
      expect(data.projectId).toBe('project-123');
      expect(data.projectName).toBe('Test Project');
    });

    it('should return 401 for unauthenticated requests', async () => {
      mockAuth.verifyAndDecodeToken.mockReturnValue(null);

      const request = new NextRequest('http://localhost:3000/api/v1/projects/project-123/pages', {
        method: 'GET',
      });

      const params = Promise.resolve({ id: 'project-123' });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Not authenticated');
    });

    it('should return 404 for non-existent project', async () => {
      // Mock authenticated user
      mockAuth.verifyAndDecodeToken.mockReturnValue({
        user: { userId: 'user-123' }
      });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      // Mock project not found
      mockPrisma.project.findFirst.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/v1/projects/nonexistent/pages', {
        method: 'GET',
        headers: {
          'Cookie': 'auth-token=valid-token',
        },
      });

      const params = Promise.resolve({ id: 'nonexistent' });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Project not found');
    });
  });
});