// @ts-nocheck
import { jest } from '@jest/globals';
import { NextRequest } from 'next/server';

// Mock Prisma completely
const mockPrisma = {
  user: {
    findFirst: jest.fn() as jest.MockedFunction<(args: any) => Promise<any>>,
  },
  $disconnect: jest.fn() as jest.MockedFunction<() => Promise<void>>,
};

// Mock bcryptjs
const mockBcrypt = {
  compare: jest.fn() as jest.MockedFunction<(data: string, encrypted: string) => Promise<boolean>>,
};

// Mock session utilities
const mockSession = {
  generateAuthToken: jest.fn() as jest.MockedFunction<(user: any) => string>,
  createAuthCookie: jest.fn() as jest.MockedFunction<(token: string) => any>,
};

jest.mock('../../../../../../generated/prisma', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}));

jest.mock('bcryptjs', () => mockBcrypt);

jest.mock('../../../../../../lib/auth/session', () => mockSession);

// Dynamic import after mocks are set up
let POST: (request: NextRequest) => Promise<Response>;

describe('/api/v1/auth/login POST', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
    if (!POST) {
      const routeModule = await import('../route');
      POST = routeModule.POST;
    }
  });

  it('should successfully login with valid credentials', async () => {
    // Mock successful login
    const mockUser = {
      id: 'user-123',
      username: 'testuser',
      password_hash: 'hashed_password',
      tenant_id: 'tenant-123',
      tenant: {
        id: 'tenant-123',
        name: 'Test Company',
      },
    };

    mockPrisma.user.findFirst.mockResolvedValue(mockUser);
    mockBcrypt.compare.mockResolvedValue(true);
    mockSession.generateAuthToken.mockReturnValue('mock-jwt-token');
    mockSession.createAuthCookie.mockReturnValue({
      name: 'auth-token',
      value: 'mock-jwt-token',
      options: { httpOnly: true }
    });

    const request = new NextRequest('http://localhost:3060/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: 'testuser',
        password: 'password123',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      message: 'Login successful',
      user: {
        id: 'user-123',
        username: 'testuser',
        tenantId: '12345678-1234-1234-1234-123456789abc',
        tenantName: 'Test Company',
      },
    });

    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
      where: { username: 'testuser' },
      include: { tenant: true },
    });
    expect(mockBcrypt.compare).toHaveBeenCalledWith('password123', 'hashed_password');
    expect(mockSession.generateAuthToken).toHaveBeenCalled();
  });

  it('should login with tenant ID when provided', async () => {
    const mockUser = {
      id: 'user-123',
      username: 'testuser',
      password_hash: 'hashed_password',
      tenant_id: 'tenant-123',
      tenant: {
        id: 'tenant-123',
        name: 'Test Company',
      },
    };

    mockPrisma.user.findFirst.mockResolvedValue(mockUser);
    mockBcrypt.compare.mockResolvedValue(true);
    mockSession.generateAuthToken.mockReturnValue('mock-jwt-token');
    mockSession.createAuthCookie.mockReturnValue({
      name: 'auth-token',
      value: 'mock-jwt-token',
      options: { httpOnly: true }
    });

    const request = new NextRequest('http://localhost:3060/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: 'testuser',
        password: 'password123',
        tenantId: '12345678-1234-1234-1234-123456789abc',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
      where: { username: 'testuser', tenant_id: '12345678-1234-1234-1234-123456789abc' },
      include: { tenant: true },
    });
  });

  it('should return 401 for non-existent user', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3060/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: 'nonexistent',
        password: 'password123',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({
      error: 'Invalid credentials',
    });
  });

  it('should return 401 for invalid password', async () => {
    const mockUser = {
      id: 'user-123',
      username: 'testuser',
      password_hash: 'hashed_password',
      tenant_id: 'tenant-123',
      tenant: {
        id: 'tenant-123',
        name: 'Test Company',
      },
    };

    mockPrisma.user.findFirst.mockResolvedValue(mockUser);
    mockBcrypt.compare.mockResolvedValue(false);

    const request = new NextRequest('http://localhost:3060/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: 'testuser',
        password: 'wrongpassword',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({
      error: 'Invalid credentials',
    });
  });

  it('should return 400 for invalid input', async () => {
    const request = new NextRequest('http://localhost:3060/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: '', // Invalid empty username
        password: '',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid input');
  });

  it('should return 500 when database error occurs', async () => {
    mockPrisma.user.findFirst.mockRejectedValue(new Error('Database connection failed'));

    const request = new NextRequest('http://localhost:3060/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: 'testuser',
        password: 'password123',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({
      error: 'Internal server error',
    });
  });
});