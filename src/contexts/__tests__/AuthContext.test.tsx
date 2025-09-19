// @ts-nocheck
import { jest } from '@jest/globals';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../AuthContext';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as jest.MockedFunction<typeof fetch>;

// Mock window.location
const mockLocation = {
  href: '',
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

// Test component that uses the auth context
function TestComponent() {
  const { user, isLoading, isAuthenticated, login, logout, refreshUser } = useAuth();

  return (
    <div>
      <div data-testid="loading">{isLoading ? 'Loading' : 'Not Loading'}</div>
      <div data-testid="authenticated">{isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</div>
      <div data-testid="user">{user ? `User: ${user.username}` : 'No User'}</div>
      <button onClick={() => login('testuser', 'password123')} data-testid="login">
        Login
      </button>
      <button onClick={logout} data-testid="logout">
        Logout
      </button>
      <button onClick={refreshUser} data-testid="refresh">
        Refresh
      </button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation.href = '';
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should provide initial state', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId('loading')).toHaveTextContent('Loading');

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading');
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('Not Authenticated');
    expect(screen.getByTestId('user')).toHaveTextContent('No User');
  });

  it('should authenticate user on mount if valid session exists', async () => {
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
      expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading');
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('Authenticated');
    expect(screen.getByTestId('user')).toHaveTextContent('User: testuser');
  });

  it('should handle successful login', async () => {
    // Mock initial refresh (no user)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    // Mock successful login
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
      expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading');
    });

    const loginButton = screen.getByTestId('login');
    await act(async () => {
      await userEvent.click(loginButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('Authenticated');
    });

    expect(screen.getByTestId('user')).toHaveTextContent('User: testuser');
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'testuser', password: 'password123' }),
      credentials: 'include',
    });
  });

  it('should handle failed login', async () => {
    // Mock initial refresh (no user)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    // Mock failed login
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Invalid credentials' }),
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading');
    });

    const loginButton = screen.getByTestId('login');
    await act(async () => {
      await userEvent.click(loginButton);
    });

    // Should remain unauthenticated
    expect(screen.getByTestId('authenticated')).toHaveTextContent('Not Authenticated');
    expect(screen.getByTestId('user')).toHaveTextContent('No User');
  });

  it('should handle logout', async () => {
    // Mock initial user state
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

    // Mock logout
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Logout successful' }),
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('Authenticated');
    });

    const logoutButton = screen.getByTestId('logout');
    await act(async () => {
      await userEvent.click(logoutButton);
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('Not Authenticated');
    expect(screen.getByTestId('user')).toHaveTextContent('No User');
    expect(mockLocation.href).toBe('/login');
  });

  it('should handle refresh user', async () => {
    // Mock initial state (no user)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    // Mock refresh user success
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
      expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading');
    });

    const refreshButton = screen.getByTestId('refresh');
    await act(async () => {
      await userEvent.click(refreshButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('Authenticated');
    });

    expect(screen.getByTestId('user')).toHaveTextContent('User: testuser');
  });

  it('should throw error when useAuth is used outside AuthProvider', () => {
    // Temporarily suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useAuth must be used within an AuthProvider');

    consoleSpy.mockRestore();
  });
});