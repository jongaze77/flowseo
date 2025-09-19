import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

export interface AuthUser {
  userId: string;
  username: string;
  tenantId: string;
  tenantName: string;
}

export interface AuthenticatedRequest extends NextRequest {
  user: AuthUser;
}

export function verifyAuthToken(request: NextRequest): AuthUser | null {
  try {
    // Get token from cookie
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return null;
    }

    // Verify JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET environment variable is not set');
      return null;
    }

    const decoded = jwt.verify(token, jwtSecret) as AuthUser;
    return decoded;

  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

export function requireAuth(request: NextRequest): AuthUser {
  const user = verifyAuthToken(request);
  if (!user) {
    throw new Error('Authentication required');
  }
  return user;
}