import jwt from 'jsonwebtoken';
import { AuthUser } from './middleware';

export interface SessionConfig {
  maxAge: number; // in seconds
  renewalThreshold: number; // in seconds - when to renew token
}

export const defaultSessionConfig: SessionConfig = {
  maxAge: 24 * 60 * 60, // 24 hours
  renewalThreshold: 4 * 60 * 60, // 4 hours - renew if less than 4 hours left
};

export function generateAuthToken(user: AuthUser, config: SessionConfig = defaultSessionConfig): string {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  return jwt.sign(
    {
      userId: user.userId,
      username: user.username,
      tenantId: user.tenantId,
      tenantName: user.tenantName,
    },
    jwtSecret,
    { expiresIn: config.maxAge }
  );
}

export function verifyAndDecodeToken(token: string): { user: AuthUser; needsRenewal: boolean } | null {
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is not set');
    }

    const decoded = jwt.verify(token, jwtSecret) as AuthUser & { exp: number; iat: number };

    // Check if token needs renewal
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = decoded.exp - now;
    const needsRenewal = timeUntilExpiry < defaultSessionConfig.renewalThreshold;

    return {
      user: {
        userId: decoded.userId,
        username: decoded.username,
        tenantId: decoded.tenantId,
        tenantName: decoded.tenantName,
      },
      needsRenewal,
    };

  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

export function createAuthCookie(token: string, config: SessionConfig = defaultSessionConfig) {
  return {
    name: 'auth-token',
    value: token,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: config.maxAge,
      path: '/',
    },
  };
}

export function createExpiredAuthCookie() {
  return {
    name: 'auth-token',
    value: '',
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 0,
      path: '/',
    },
  };
}