'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Navigation() {
  const [tenantName, setTenantName] = useState<string>('');

  // For now, we'll use a placeholder tenant name
  // In a real app, this would come from authentication/session context
  useEffect(() => {
    setTenantName('My Organization');
  }, []);

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and tenant name */}
          <div className="flex items-center">
            <Link href="/dashboard" className="flex items-center">
              <span className="text-xl font-bold text-blue-600">FlowSEO</span>
              {tenantName && (
                <span className="ml-3 text-gray-500">|</span>
              )}
              {tenantName && (
                <span className="ml-3 text-gray-700 font-medium">{tenantName}</span>
              )}
            </Link>
          </div>

          {/* Navigation menu */}
          <div className="flex items-center space-x-8">
            <Link
              href="/dashboard"
              className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/users"
              className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Users
            </Link>
            <Link
              href="#"
              className="text-gray-400 px-3 py-2 rounded-md text-sm font-medium cursor-not-allowed"
            >
              Projects
            </Link>
            <Link
              href="#"
              className="text-gray-400 px-3 py-2 rounded-md text-sm font-medium cursor-not-allowed"
            >
              Analytics
            </Link>
          </div>

          {/* User menu placeholder */}
          <div className="flex items-center">
            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
              <span className="text-gray-600 text-sm font-medium">U</span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}