import { NextRequest, NextResponse } from 'next/server';
import { createExpiredAuthCookie } from '../../../../../lib/auth/session';

export async function POST(_request: NextRequest) {
  try {
    // Create response
    const response = NextResponse.json(
      { message: 'Logout successful' },
      { status: 200 }
    );

    // Clear the auth token cookie using session utilities
    const expiredCookie = createExpiredAuthCookie();
    response.cookies.set(expiredCookie.name, expiredCookie.value, expiredCookie.options);

    return response;

  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}