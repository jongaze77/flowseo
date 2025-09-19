// @ts-nocheck
import { jest } from '@jest/globals';
import { NextRequest } from 'next/server';

// Mock Prisma completely
const mockPrisma = {
  user: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  },
  tenant: {
    findUnique: jest.fn(),
  },
};

// Mock bcryptjs
const mockBcrypt = {
  hash: jest.fn(),
};

jest.mock('../../../../../../../generated/prisma', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}));

jest.mock('bcryptjs', () => mockBcrypt);

// Dynamic import after mocks are set up
let POST: (request: NextRequest, context: { params: Promise<{ tenantId: string }> }) => Promise<Response>;
let GET: (request: NextRequest, context: { params: Promise<{ tenantId: string }> }) => Promise<Response>;

describe('/api/v1/tenants/[tenantId]/users', () => {
  const mockTenantId = 'tenant-123';
  const mockParams = { params: Promise.resolve({ tenantId: mockTenantId }) };

  beforeEach(async () => {
    jest.clearAllMocks();
    if (!POST || !GET) {
      const routeModule = await import('../route');
      POST = routeModule.POST;
      GET = routeModule.GET;
    }
  });

  describe('POST - Create User', () => {
    it('should successfully create a new user', async () => {
      // Mock successful user creation
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: mockTenantId,
        name: 'Test Company',
      });
      mockPrisma.user.findFirst.mockResolvedValue(null); // No existing user
      mockBcrypt.hash.mockResolvedValue('hashed_password_123');
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-123',
        username: 'newuser',
        tenant_id: mockTenantId,
      });

      const request = new NextRequest('http://localhost:3060/api/v1/tenants/tenant-123/users', {
        method: 'POST',
        body: JSON.stringify({
          username: 'newuser',
          password: 'password123',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toEqual({
        message: 'User created successfully',
        user: {
          id: 'user-123',
          username: 'newuser',
          tenant_id: mockTenantId,
        },
      });

      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: mockTenantId },
      });
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          username: 'newuser',
          tenant_id: mockTenantId,
        },
      });
      expect(mockBcrypt.hash).toHaveBeenCalledWith('password123', 12);
    });

    it('should return 404 when tenant does not exist', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3060/api/v1/tenants/nonexistent/users', {
        method: 'POST',
        body: JSON.stringify({
          username: 'newuser',
          password: 'password123',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request, { params: Promise.resolve({ tenantId: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({
        error: 'Tenant not found',
      });
    });

    it('should return 409 when username already exists in tenant', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: mockTenantId,
        name: 'Test Company',
      });
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'existing-user',
        username: 'existinguser',
        tenant_id: mockTenantId,
      });

      const request = new NextRequest('http://localhost:3060/api/v1/tenants/tenant-123/users', {
        method: 'POST',
        body: JSON.stringify({
          username: 'existinguser',
          password: 'password123',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data).toEqual({
        error: 'Username already exists in this organization',
      });
    });

    it('should return 400 for invalid input', async () => {
      const request = new NextRequest('http://localhost:3060/api/v1/tenants/tenant-123/users', {
        method: 'POST',
        body: JSON.stringify({
          username: 'ab', // Too short
          password: '123', // Too short
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid input');
    });
  });

  describe('GET - List Users', () => {
    it('should successfully list users in tenant', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          username: 'user1',
          tenant_id: mockTenantId,
        },
        {
          id: 'user-2',
          username: 'user2',
          tenant_id: mockTenantId,
        },
      ];

      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: mockTenantId,
        name: 'Test Company',
      });
      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      const request = new NextRequest('http://localhost:3060/api/v1/tenants/tenant-123/users');

      const response = await GET(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        users: mockUsers,
        count: 2,
      });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { tenant_id: mockTenantId },
        select: {
          id: true,
          username: true,
          tenant_id: true,
        },
        orderBy: {
          username: 'asc',
        },
      });
    });

    it('should return 404 when tenant does not exist', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3060/api/v1/tenants/nonexistent/users');

      const response = await GET(request, { params: Promise.resolve({ tenantId: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({
        error: 'Tenant not found',
      });
    });

    it('should return empty list when no users in tenant', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: mockTenantId,
        name: 'Test Company',
      });
      mockPrisma.user.findMany.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3060/api/v1/tenants/tenant-123/users');

      const response = await GET(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        users: [],
        count: 0,
      });
    });
  });
});