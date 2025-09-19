'use client';

import { useState, useEffect } from 'react';
import AppLayout from '../../components/layout/AppLayout';
import UserList from '../../components/UserList';
import AddUserForm from '../../components/AddUserForm';

interface User {
  id: string;
  username: string;
  tenant_id: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // For now, we don't have a real tenant ID from authentication
  // In a real app, this would come from authentication/session context
  const tenantId = null; // Will be set when we have proper auth

  const fetchUsers = async () => {
    // Skip fetching if no tenant ID available
    if (!tenantId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/v1/tenants/${tenantId}/users`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch users');
      }

      setUsers(data.users);
    } catch (error) {
      console.error('Error fetching users:', error);
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!tenantId) return;

    try {
      const response = await fetch(`/api/v1/tenants/${tenantId}/users/${userId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove user');
      }

      // Refresh user list
      await fetchUsers();
    } catch (error) {
      console.error('Error removing user:', error);
      throw error; // Re-throw to let UserList handle the error display
    }
  };

  const handleUserAdded = () => {
    // Refresh user list when a new user is added
    if (tenantId) {
      fetchUsers();
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Show authentication placeholder when no tenant ID
  if (!tenantId) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="border-b border-gray-200 pb-6">
            <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
            <p className="text-gray-600 mt-2">Manage your team members and their access</p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-6 text-center">
            <div className="text-blue-600 text-4xl mb-4">🔐</div>
            <h3 className="text-lg font-medium text-blue-900 mb-2">Authentication Required</h3>
            <p className="text-blue-700 mb-4">
              User management requires authentication to determine your organization context.
            </p>
            <p className="text-sm text-blue-600">
              This feature will be available once authentication is implemented in a future story.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Add Team Member</h3>
              <p className="text-gray-600 text-sm mb-4">Create user accounts for your organization</p>
              <div className="bg-gray-200 rounded-md p-4 text-center text-gray-500 text-sm">
                Available after authentication
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Team Members</h3>
              <p className="text-gray-600 text-sm mb-4">View and manage your team</p>
              <div className="bg-gray-200 rounded-md p-4 text-center text-gray-500 text-sm">
                Available after authentication
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="border-b border-gray-200 pb-6">
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-2">Manage your team members and their access</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex items-center">
              <div className="text-red-400 mr-3">⚠️</div>
              <div>
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
              <button
                onClick={fetchUsers}
                className="ml-auto text-red-600 hover:text-red-700 text-sm font-medium"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <AddUserForm onUserAdded={handleUserAdded} tenantId={tenantId} />
          </div>
          <div>
            <UserList
              users={users}
              onRemoveUser={handleRemoveUser}
              isLoading={isLoading}
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}