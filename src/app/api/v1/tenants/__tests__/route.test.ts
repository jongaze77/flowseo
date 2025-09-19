import { jest } from '@jest/globals';
import { NextRequest } from 'next/server';

// Mock Prisma completely
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  tenant: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

// Mock bcryptjs
const mockBcrypt = {
  hash: jest.fn(),
};

jest.mock('../../../../../generated/prisma', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}));

jest.mock('bcryptjs', () => mockBcrypt);

// Dynamic import after mocks are set up
let POST: typeof import('../route').POST;

describe('/api/v1/tenants POST', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    if (!POST) {
      const routeModule = await import('../route');
      POST = routeModule.POST;
    }
  });

  it('should successfully register a new user and tenant', async () => {
    // Mock successful registration
    mockBcrypt.hash.mockResolvedValue('hashed_password_123');
    mockPrisma.$transaction.mockResolvedValue({
      tenant: {
        id: 'tenant-123',
        name: 'Test Company',
      },
      user: {
        id: 'user-123',
        username: 'testuser',
      },
    });

    const request = new NextRequest('http://localhost:3060/api/v1/tenants', {
      method: 'POST',
      body: JSON.stringify({
        username: 'testuser',
        password: 'password123',
        tenantName: 'Test Company',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toEqual({
      message: 'Registration successful',
      tenant: {
        id: 'tenant-123',
        name: 'Test Company',
      },
      user: {
        id: 'user-123',
        username: 'testuser',
      },
    });

    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(mockBcrypt.hash).toHaveBeenCalledWith('password123', 12);
  });


  it('should return 400 for invalid input data', async () => {
    const request = new NextRequest('http://localhost:3060/api/v1/tenants', {
      method: 'POST',
      body: JSON.stringify({
        username: 'ab', // Too short
        password: '123', // Too short
        tenantName: '', // Empty
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid input');
    if (data.details) {
      expect(Array.isArray(data.details)).toBe(true);
    }

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('should return 400 for missing required fields', async () => {
    const request = new NextRequest('http://localhost:3060/api/v1/tenants', {
      method: 'POST',
      body: JSON.stringify({
        username: 'testuser',
        // Missing password and tenantName
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
    mockPrisma.$transaction.mockRejectedValue(new Error('Database connection failed'));

    const request = new NextRequest('http://localhost:3060/api/v1/tenants', {
      method: 'POST',
      body: JSON.stringify({
        username: 'testuser',
        password: 'password123',
        tenantName: 'Test Company',
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

  it('should hash password before storing', async () => {
    mockBcrypt.hash.mockResolvedValue('hashed_password_123');
    mockPrisma.$transaction.mockResolvedValue({
      tenant: {
        id: 'tenant-123',
        name: 'Test Company',
      },
      user: {
        id: 'user-123',
        username: 'testuser',
      },
    });

    const request = new NextRequest('http://localhost:3060/api/v1/tenants', {
      method: 'POST',
      body: JSON.stringify({
        username: 'testuser',
        password: 'password123',
        tenantName: 'Test Company',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    await POST(request);

    expect(mockBcrypt.hash).toHaveBeenCalledWith('password123', 12);
  });
});