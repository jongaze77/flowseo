// @ts-nocheck
import { jest } from '@jest/globals';
import { render, waitFor } from '@testing-library/react';
import { useRequireAuth } from '../useRequireAuth';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock next/navigation
const mockPush = jest.fn();
const mockRouter = {
  push: mockPush,
};

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as jest.MockedFunction<typeof fetch>;

// Mock window.location
const mockLocation = {
  pathname: '/protected-page',
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

// Test component that uses the useRequireAuth hook
function TestComponent({ redirectTo }: { redirectTo?: string }) {
  const { user, isLoading, isAuthenticated } = useRequireAuth(redirectTo);

  return (
    <div>
      <div data-testid="loading">{isLoading ? 'Loading' : 'Not Loading'}</div>
      <div data-testid="authenticated">{isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</div>
      <div data-testid="user">{user ? `User: ${user.username}` : 'No User'}</div>
    </div>
  );
}

describe('useRequireAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation.pathname = '/protected-page';
  });

  it('should redirect to login when user is not authenticated', async () => {
    // Mock no user found
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login?redirectTo=%2Fprotected-page');
    });
  });

  it('should redirect to custom login path when specified', async () => {
    // Mock no user found
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    render(
      <AuthProvider>
        <TestComponent redirectTo="/custom-login" />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/custom-login?redirectTo=%2Fprotected-page');
    });
  });

  it('should not redirect when user is authenticated', async () => {
    const mockUser = {
      id: 'user-123',
      username: 'testuser',
      tenantId: 'tenant-123',
      tenantName: 'Test Company',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user: mockUser }),
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  it('should return correct authentication state', async () => {
    const mockUser = {
      id: 'user-123',
      username: 'testuser',
      tenantId: 'tenant-123',
      tenantName: 'Test Company',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user: mockUser }),
    });

    const { getByTestId } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getByTestId('loading')).toHaveTextContent('Not Loading');
    });

    expect(getByTestId('authenticated')).toHaveTextContent('Authenticated');
    expect(getByTestId('user')).toHaveTextContent('User: testuser');
  });

  it('should show loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    const { getByTestId } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(getByTestId('loading')).toHaveTextContent('Loading');
    expect(getByTestId('authenticated')).toHaveTextContent('Not Authenticated');
    expect(getByTestId('user')).toHaveTextContent('No User');
  });
});