// @ts-nocheck
import { jest } from '@jest/globals';
import { NextRequest } from 'next/server';

// Mock session utilities
const mockSession = {
  createExpiredAuthCookie: jest.fn(),
};

jest.mock('../../../../../../lib/auth/session', () => mockSession);

// Dynamic import after mocks are set up
let POST: (request: NextRequest) => Promise<Response>;

describe('/api/v1/auth/logout POST', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    if (!POST) {
      const routeModule = await import('../route');
      POST = routeModule.POST;
    }
  });

  it('should successfully logout user', async () => {
    mockSession.createExpiredAuthCookie.mockReturnValue({
      name: 'auth-token',
      value: '',
      options: { httpOnly: true, maxAge: 0 }
    });

    const request = new NextRequest('http://localhost:3060/api/v1/auth/logout', {
      method: 'POST',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      message: 'Logout successful',
    });

    expect(mockSession.createExpiredAuthCookie).toHaveBeenCalled();
  });

  it('should handle logout even without auth token', async () => {
    mockSession.createExpiredAuthCookie.mockReturnValue({
      name: 'auth-token',
      value: '',
      options: { httpOnly: true, maxAge: 0 }
    });

    const request = new NextRequest('http://localhost:3060/api/v1/auth/logout', {
      method: 'POST',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      message: 'Logout successful',
    });
  });

  it('should return 500 when logout fails', async () => {
    mockSession.createExpiredAuthCookie.mockImplementation(() => {
      throw new Error('Cookie error');
    });

    const request = new NextRequest('http://localhost:3060/api/v1/auth/logout', {
      method: 'POST',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({
      error: 'Internal server error',
    });
  });
});