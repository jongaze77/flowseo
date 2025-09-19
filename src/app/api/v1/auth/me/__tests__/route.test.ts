import { jest } from '@jest/globals';
import { NextRequest } from 'next/server';

// Mock Prisma completely
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  $disconnect: jest.fn(),
};

// Mock session utilities
const mockSession = {
  verifyAndDecodeToken: jest.fn(),
  generateAuthToken: jest.fn(),
  createAuthCookie: jest.fn(),
};

jest.mock('../../../../../../generated/prisma', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}));

jest.mock('../../../../../../lib/auth/session', () => mockSession);

// Dynamic import after mocks are set up
let GET: typeof import('../route').GET;

describe('/api/v1/auth/me GET', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
    if (!GET) {
      const routeModule = await import('../route');
      GET = routeModule.GET;
    }
  });

  it('should return user info for valid token', async () => {
    const mockUser = {
      id: 'user-123',
      username: 'testuser',
      tenant_id: 'tenant-123',
      tenant: {
        id: 'tenant-123',
        name: 'Test Company',
      },
    };

    const mockTokenResult = {
      user: {
        userId: 'user-123',
        username: 'testuser',
        tenantId: 'tenant-123',
        tenantName: 'Test Company',
      },
      needsRenewal: false,
    };

    mockSession.verifyAndDecodeToken.mockReturnValue(mockTokenResult);
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);

    const request = new NextRequest('http://localhost:3060/api/v1/auth/me', {
      method: 'GET',
      headers: {
        Cookie: 'auth-token=valid-jwt-token',
      },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      user: {
        id: 'user-123',
        username: 'testuser',
        tenantId: 'tenant-123',
        tenantName: 'Test Company',
      },
    });

    expect(mockSession.verifyAndDecodeToken).toHaveBeenCalledWith('valid-jwt-token');
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      include: { tenant: true },
    });
  });

  it('should renew token when needed', async () => {
    const mockUser = {
      id: 'user-123',
      username: 'testuser',
      tenant_id: 'tenant-123',
      tenant: {
        id: 'tenant-123',
        name: 'Test Company',
      },
    };

    const mockTokenResult = {
      user: {
        userId: 'user-123',
        username: 'testuser',
        tenantId: 'tenant-123',
        tenantName: 'Test Company',
      },
      needsRenewal: true,
    };

    mockSession.verifyAndDecodeToken.mockReturnValue(mockTokenResult);
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockSession.generateAuthToken.mockReturnValue('new-jwt-token');
    mockSession.createAuthCookie.mockReturnValue({
      name: 'auth-token',
      value: 'new-jwt-token',
      options: { httpOnly: true }
    });

    const request = new NextRequest('http://localhost:3060/api/v1/auth/me', {
      method: 'GET',
      headers: {
        Cookie: 'auth-token=expiring-jwt-token',
      },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      user: {
        id: 'user-123',
        username: 'testuser',
        tenantId: 'tenant-123',
        tenantName: 'Test Company',
      },
    });

    expect(mockSession.generateAuthToken).toHaveBeenCalled();
    expect(mockSession.createAuthCookie).toHaveBeenCalled();
  });

  it('should return 401 when no token provided', async () => {
    const request = new NextRequest('http://localhost:3060/api/v1/auth/me', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({
      error: 'Not authenticated',
    });
  });

  it('should return 401 for invalid token', async () => {
    mockSession.verifyAndDecodeToken.mockReturnValue(null);

    const request = new NextRequest('http://localhost:3060/api/v1/auth/me', {
      method: 'GET',
      headers: {
        Cookie: 'auth-token=invalid-jwt-token',
      },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({
      error: 'Invalid token',
    });
  });

  it('should return 401 when user not found in database', async () => {
    const mockTokenResult = {
      user: {
        userId: 'user-123',
        username: 'testuser',
        tenantId: 'tenant-123',
        tenantName: 'Test Company',
      },
      needsRenewal: false,
    };

    mockSession.verifyAndDecodeToken.mockReturnValue(mockTokenResult);
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3060/api/v1/auth/me', {
      method: 'GET',
      headers: {
        Cookie: 'auth-token=valid-jwt-token',
      },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({
      error: 'User not found',
    });
  });

  it('should return 500 when database error occurs', async () => {
    const mockTokenResult = {
      user: {
        userId: 'user-123',
        username: 'testuser',
        tenantId: 'tenant-123',
        tenantName: 'Test Company',
      },
      needsRenewal: false,
    };

    mockSession.verifyAndDecodeToken.mockReturnValue(mockTokenResult);
    mockPrisma.user.findUnique.mockRejectedValue(new Error('Database connection failed'));

    const request = new NextRequest('http://localhost:3060/api/v1/auth/me', {
      method: 'GET',
      headers: {
        Cookie: 'auth-token=valid-jwt-token',
      },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({
      error: 'Internal server error',
    });
  });
});