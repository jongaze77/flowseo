'use client';

import React from 'react';
import { useRequireAuth } from '../../hooks/useRequireAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
}

export function ProtectedRoute({
  children,
  fallback = <div className="flex justify-center items-center min-h-screen">Loading...</div>,
  redirectTo = '/login'
}: ProtectedRouteProps) {
  const { user, isLoading } = useRequireAuth(redirectTo);

  if (isLoading) {
    return <>{fallback}</>;
  }

  if (!user) {
    // The useRequireAuth hook will handle the redirect
    return <>{fallback}</>;
  }

  return <>{children}</>;
}