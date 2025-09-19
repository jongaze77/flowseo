// @ts-nocheck
import { jest } from '@jest/globals';
import { NextRequest } from 'next/server';

// Mock Prisma completely
const mockPrisma = {
  user: {
    findFirst: jest.fn(),
    delete: jest.fn(),
  },
  tenant: {
    findUnique: jest.fn(),
  },
};

jest.mock('../../../../../../../../generated/prisma', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}));

// Dynamic import after mocks are set up
let DELETE: (request: NextRequest, context: { params: Promise<{ tenantId: string; userId: string }> }) => Promise<Response>;

describe('/api/v1/tenants/[tenantId]/users/[userId] DELETE', () => {
  const mockTenantId = 'tenant-123';
  const mockUserId = 'user-123';
  const mockParams = { params: Promise.resolve({ tenantId: mockTenantId, userId: mockUserId }) };

  beforeEach(async () => {
    jest.clearAllMocks();
    if (!DELETE) {
      const routeModule = await import('../route');
      DELETE = routeModule.DELETE;
    }
  });

  it('should successfully delete a user', async () => {
    // Mock successful deletion
    mockPrisma.tenant.findUnique.mockResolvedValue({
      id: mockTenantId,
      name: 'Test Company',
    });
    mockPrisma.user.findFirst.mockResolvedValue({
      id: mockUserId,
      username: 'testuser',
      tenant_id: mockTenantId,
    });
    mockPrisma.user.delete.mockResolvedValue({
      id: mockUserId,
      username: 'testuser',
      tenant_id: mockTenantId,
    });

    const request = new NextRequest(
      `http://localhost:3060/api/v1/tenants/${mockTenantId}/users/${mockUserId}`,
      { method: 'DELETE' }
    );

    const response = await DELETE(request, mockParams);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      message: 'User removed successfully',
    });

    expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
      where: { id: mockTenantId },
    });
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: mockUserId,
        tenant_id: mockTenantId,
      },
    });
    expect(mockPrisma.user.delete).toHaveBeenCalledWith({
      where: { id: mockUserId },
    });
  });

  it('should return 404 when tenant does not exist', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue(null);

    const request = new NextRequest(
      `http://localhost:3060/api/v1/tenants/nonexistent/users/${mockUserId}`,
      { method: 'DELETE' }
    );

    const response = await DELETE(request, { params: Promise.resolve({ tenantId: 'nonexistent', userId: mockUserId }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toEqual({
      error: 'Tenant not found',
    });

    expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.user.delete).not.toHaveBeenCalled();
  });

  it('should return 404 when user does not exist in tenant', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue({
      id: mockTenantId,
      name: 'Test Company',
    });
    mockPrisma.user.findFirst.mockResolvedValue(null);

    const request = new NextRequest(
      `http://localhost:3060/api/v1/tenants/${mockTenantId}/users/nonexistent`,
      { method: 'DELETE' }
    );

    const response = await DELETE(request, { params: Promise.resolve({ tenantId: mockTenantId, userId: 'nonexistent' }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toEqual({
      error: 'User not found in this organization',
    });

    expect(mockPrisma.user.delete).not.toHaveBeenCalled();
  });

  it('should return 404 when user exists but belongs to different tenant', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue({
      id: mockTenantId,
      name: 'Test Company',
    });
    // User belongs to different tenant
    mockPrisma.user.findFirst.mockResolvedValue(null);

    const request = new NextRequest(
      `http://localhost:3060/api/v1/tenants/${mockTenantId}/users/${mockUserId}`,
      { method: 'DELETE' }
    );

    const response = await DELETE(request, mockParams);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toEqual({
      error: 'User not found in this organization',
    });

    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: mockUserId,
        tenant_id: mockTenantId,
      },
    });
    expect(mockPrisma.user.delete).not.toHaveBeenCalled();
  });

  it('should return 500 when database error occurs', async () => {
    mockPrisma.tenant.findUnique.mockRejectedValue(new Error('Database connection failed'));

    const request = new NextRequest(
      `http://localhost:3060/api/v1/tenants/${mockTenantId}/users/${mockUserId}`,
      { method: 'DELETE' }
    );

    const response = await DELETE(request, mockParams);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({
      error: 'Internal server error',
    });
  });
});