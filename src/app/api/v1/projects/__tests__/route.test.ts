// @ts-nocheck
import { jest } from '@jest/globals';
import { NextRequest } from 'next/server';

// Mock Prisma completely
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  project: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  $disconnect: jest.fn(),
};

// Mock auth session
const mockAuth = {
  verifyAndDecodeToken: jest.fn(),
};

jest.mock('../../../../../generated/prisma', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}));

jest.mock('../../../../../lib/auth/session', () => mockAuth);

// Dynamic import after mocks are set up
let POST: (request: NextRequest) => Promise<Response>;
let GET: (request: NextRequest) => Promise<Response>;

describe('/api/v1/projects', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    if (!POST || !GET) {
      const routeModule = await import('../route');
      POST = routeModule.POST;
      GET = routeModule.GET;
    }
  });

  describe('POST /api/v1/projects', () => {
    it('should successfully create a new project', async () => {
      // Mock authenticated user
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        tenant_id: 'tenant-123',
        tenant: {
          id: 'tenant-123',
          name: 'Test Company',
        },
      };

      mockAuth.verifyAndDecodeToken.mockReturnValue({
        user: { userId: 'user-123' },
      });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const mockProject = {
        id: 'project-123',
        name: 'Test Project',
        domain: 'example.com',
        tenant_id: 'tenant-123',
        created_at: new Date(),
        updated_at: new Date(),
        tenant: {
          id: 'tenant-123',
          name: 'Test Company',
        },
      };

      mockPrisma.project.create.mockResolvedValue(mockProject);

      const request = new NextRequest('http://localhost:3000/api/v1/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'auth-token=valid-token',
        },
        body: JSON.stringify({
          name: 'Test Project',
          domain: 'example.com',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.name).toBe('Test Project');
      expect(data.domain).toBe('example.com');
      expect(data.tenantId).toBe('tenant-123');
      expect(mockPrisma.project.create).toHaveBeenCalledWith({
        data: {
          name: 'Test Project',
          domain: 'example.com',
          tenant_id: 'tenant-123',
        },
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
            }
          }
        }
      });
    });

    it('should return 401 when not authenticated', async () => {
      mockAuth.verifyAndDecodeToken.mockReturnValue(null);

      const request = new NextRequest('http://localhost:3000/api/v1/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test Project',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Not authenticated');
    });

    it('should return 400 when validation fails', async () => {
      const mockUser = {
        id: 'user-123',
        tenant_id: 'tenant-123',
        tenant: { id: 'tenant-123', name: 'Test Company' },
      };

      mockAuth.verifyAndDecodeToken.mockReturnValue({
        user: { userId: 'user-123' },
      });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost:3000/api/v1/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'auth-token=valid-token',
        },
        body: JSON.stringify({
          name: '', // Invalid empty name
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid input');
    });

    it('should return 409 when project name already exists', async () => {
      const mockUser = {
        id: 'user-123',
        tenant_id: 'tenant-123',
        tenant: { id: 'tenant-123', name: 'Test Company' },
      };

      mockAuth.verifyAndDecodeToken.mockReturnValue({
        user: { userId: 'user-123' },
      });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      // Mock unique constraint error
      const uniqueError = new Error('Unique constraint failed') as Error & {
        code: string;
        meta: { target: string[] };
      };
      uniqueError.code = 'P2002';
      uniqueError.meta = { target: ['name', 'tenant_id'] };
      mockPrisma.project.create.mockRejectedValue(uniqueError);

      const request = new NextRequest('http://localhost:3000/api/v1/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'auth-token=valid-token',
        },
        body: JSON.stringify({
          name: 'Duplicate Project',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe('Project name already exists in your organization');
    });
  });

  describe('GET /api/v1/projects', () => {
    it('should successfully fetch projects for authenticated user', async () => {
      const mockUser = {
        id: 'user-123',
        tenant_id: 'tenant-123',
        tenant: { id: 'tenant-123', name: 'Test Company' },
      };

      const mockProjects = [
        {
          id: 'project-1',
          name: 'Project 1',
          domain: 'example1.com',
          tenant_id: 'tenant-123',
          created_at: new Date(),
          updated_at: new Date(),
          tenant: { id: 'tenant-123', name: 'Test Company' },
        },
        {
          id: 'project-2',
          name: 'Project 2',
          domain: null,
          tenant_id: 'tenant-123',
          created_at: new Date(),
          updated_at: new Date(),
          tenant: { id: 'tenant-123', name: 'Test Company' },
        },
      ];

      mockAuth.verifyAndDecodeToken.mockReturnValue({
        user: { userId: 'user-123' },
      });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.project.findMany.mockResolvedValue(mockProjects);

      const request = new NextRequest('http://localhost:3000/api/v1/projects', {
        method: 'GET',
        headers: {
          'Cookie': 'auth-token=valid-token',
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.projects).toHaveLength(2);
      expect(data.count).toBe(2);
      expect(data.projects[0].name).toBe('Project 1');
      expect(data.projects[1].name).toBe('Project 2');
      expect(mockPrisma.project.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: 'tenant-123',
        },
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
            }
          }
        },
        orderBy: {
          created_at: 'desc',
        },
      });
    });

    it('should return 401 when not authenticated', async () => {
      mockAuth.verifyAndDecodeToken.mockReturnValue(null);

      const request = new NextRequest('http://localhost:3000/api/v1/projects', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Not authenticated');
    });
  });
});