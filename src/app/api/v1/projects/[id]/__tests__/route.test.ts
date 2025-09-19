import { jest } from '@jest/globals';
import { NextRequest } from 'next/server';

// Mock Prisma completely
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  project: {
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $disconnect: jest.fn(),
};

// Mock auth session
const mockAuth = {
  verifyAndDecodeToken: jest.fn(),
};

jest.mock('../../../../../../generated/prisma', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}));

jest.mock('../../../../../../lib/auth/session', () => mockAuth);

// Dynamic import after mocks are set up
let PUT: (request: NextRequest, context: { params: Promise<{ id: string }> }) => Promise<Response>;
let DELETE: (request: NextRequest, context: { params: Promise<{ id: string }> }) => Promise<Response>;

describe('/api/v1/projects/[id]', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    if (!PUT || !DELETE) {
      const routeModule = await import('../route');
      PUT = routeModule.PUT;
      DELETE = routeModule.DELETE;
    }
  });

  describe('PUT /api/v1/projects/[id]', () => {
    it('should successfully update a project', async () => {
      const mockUser = {
        id: 'user-123',
        tenant_id: 'tenant-123',
        tenant: { id: 'tenant-123', name: 'Test Company' },
      };

      const mockExistingProject = {
        id: 'project-123',
        name: 'Old Project',
        domain: 'old.com',
        tenant_id: 'tenant-123',
        tenant: { id: 'tenant-123', name: 'Test Company' },
      };

      const mockUpdatedProject = {
        id: 'project-123',
        name: 'Updated Project',
        domain: 'updated.com',
        tenant_id: 'tenant-123',
        created_at: new Date(),
        updated_at: new Date(),
        tenant: { id: 'tenant-123', name: 'Test Company' },
      };

      mockAuth.verifyAndDecodeToken.mockReturnValue({
        user: { userId: 'user-123' },
      });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.project.findFirst.mockResolvedValue(mockExistingProject);
      mockPrisma.project.update.mockResolvedValue(mockUpdatedProject);

      const request = new NextRequest('http://localhost:3000/api/v1/projects/project-123', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'auth-token=valid-token',
        },
        body: JSON.stringify({
          name: 'Updated Project',
          domain: 'updated.com',
        }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'project-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.name).toBe('Updated Project');
      expect(data.domain).toBe('updated.com');
      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: {
          id: 'project-123',
        },
        data: {
          name: 'Updated Project',
          domain: 'updated.com',
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

    it('should return 404 when project not found', async () => {
      const mockUser = {
        id: 'user-123',
        tenant_id: 'tenant-123',
        tenant: { id: 'tenant-123', name: 'Test Company' },
      };

      mockAuth.verifyAndDecodeToken.mockReturnValue({
        user: { userId: 'user-123' },
      });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.project.findFirst.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/v1/projects/nonexistent', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'auth-token=valid-token',
        },
        body: JSON.stringify({
          name: 'Updated Project',
        }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Project not found');
    });

    it('should return 401 when not authenticated', async () => {
      mockAuth.verifyAndDecodeToken.mockReturnValue(null);

      const request = new NextRequest('http://localhost:3000/api/v1/projects/project-123', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Updated Project',
        }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'project-123' }) });
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

      const mockExistingProject = {
        id: 'project-123',
        tenant_id: 'tenant-123',
      };

      mockAuth.verifyAndDecodeToken.mockReturnValue({
        user: { userId: 'user-123' },
      });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.project.findFirst.mockResolvedValue(mockExistingProject);

      const request = new NextRequest('http://localhost:3000/api/v1/projects/project-123', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'auth-token=valid-token',
        },
        body: JSON.stringify({
          name: '', // Invalid empty name
        }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'project-123' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid input');
    });

    it('should return 409 when updated name already exists', async () => {
      const mockUser = {
        id: 'user-123',
        tenant_id: 'tenant-123',
        tenant: { id: 'tenant-123', name: 'Test Company' },
      };

      const mockExistingProject = {
        id: 'project-123',
        tenant_id: 'tenant-123',
      };

      mockAuth.verifyAndDecodeToken.mockReturnValue({
        user: { userId: 'user-123' },
      });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.project.findFirst.mockResolvedValue(mockExistingProject);

      // Mock unique constraint error
      const uniqueError = new Error('Unique constraint failed') as Error & {
        code: string;
        meta: { target: string[] };
      };
      uniqueError.code = 'P2002';
      uniqueError.meta = { target: ['name', 'tenant_id'] };
      mockPrisma.project.update.mockRejectedValue(uniqueError);

      const request = new NextRequest('http://localhost:3000/api/v1/projects/project-123', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'auth-token=valid-token',
        },
        body: JSON.stringify({
          name: 'Duplicate Name',
        }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'project-123' }) });
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe('Project name already exists in your organization');
    });
  });

  describe('DELETE /api/v1/projects/[id]', () => {
    it('should successfully delete a project', async () => {
      const mockUser = {
        id: 'user-123',
        tenant_id: 'tenant-123',
        tenant: { id: 'tenant-123', name: 'Test Company' },
      };

      const mockExistingProject = {
        id: 'project-123',
        name: 'Project to Delete',
        tenant_id: 'tenant-123',
      };

      mockAuth.verifyAndDecodeToken.mockReturnValue({
        user: { userId: 'user-123' },
      });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.project.findFirst.mockResolvedValue(mockExistingProject);
      mockPrisma.project.delete.mockResolvedValue(mockExistingProject);

      const request = new NextRequest('http://localhost:3000/api/v1/projects/project-123', {
        method: 'DELETE',
        headers: {
          'Cookie': 'auth-token=valid-token',
        },
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'project-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Project deleted successfully');
      expect(mockPrisma.project.delete).toHaveBeenCalledWith({
        where: {
          id: 'project-123',
        },
      });
    });

    it('should return 404 when project not found', async () => {
      const mockUser = {
        id: 'user-123',
        tenant_id: 'tenant-123',
        tenant: { id: 'tenant-123', name: 'Test Company' },
      };

      mockAuth.verifyAndDecodeToken.mockReturnValue({
        user: { userId: 'user-123' },
      });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.project.findFirst.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/v1/projects/nonexistent', {
        method: 'DELETE',
        headers: {
          'Cookie': 'auth-token=valid-token',
        },
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Project not found');
    });

    it('should return 401 when not authenticated', async () => {
      mockAuth.verifyAndDecodeToken.mockReturnValue(null);

      const request = new NextRequest('http://localhost:3000/api/v1/projects/project-123', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'project-123' }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Not authenticated');
    });
  });
});