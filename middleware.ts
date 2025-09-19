import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAndDecodeToken } from './src/lib/auth/session';

// Define protected routes that require authentication
const protectedRoutes = [
  '/dashboard',
  '/users',
  '/api/v1/tenants',
];

// Define public routes that don't require authentication
const publicRoutes = [
  '/',
  '/login',
  '/register',
  '/api/v1/auth/login',
  '/api/v1/auth/logout',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if route is public
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  // Allow access to public routes and static assets
  if (isPublicRoute || pathname.startsWith('/_next/') || pathname.startsWith('/favicon')) {
    return NextResponse.next();
  }

  // Check if route is protected
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  if (isProtectedRoute) {
    // Get token from cookie
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      // Redirect to login page if no token
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Verify authentication
    const tokenResult = verifyAndDecodeToken(token);

    if (!tokenResult) {
      // Redirect to login page if token is invalid
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(loginUrl);
    }

    const { user } = tokenResult;

    // Add user info to headers for use in API routes
    const response = NextResponse.next();
    response.headers.set('x-user-id', user.userId);
    response.headers.set('x-user-tenant-id', user.tenantId);
    response.headers.set('x-user-username', user.username);

    return response;
  }

  // Allow access to unspecified routes
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes - handled individually)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};