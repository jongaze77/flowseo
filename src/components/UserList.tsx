'use client';

import { useState } from 'react';

interface User {
  id: string;
  username: string;
  tenant_id: string;
}

interface UserListProps {
  users: User[];
  onRemoveUser: (userId: string) => void;
  isLoading?: boolean;
}

export default function UserList({ users, onRemoveUser, isLoading = false }: UserListProps) {
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState<string | null>(null);

  const handleRemoveUser = async (userId: string) => {
    if (removingUserId) return; // Prevent multiple requests

    setRemovingUserId(userId);
    try {
      await onRemoveUser(userId);
      setShowConfirmDialog(null);
    } catch (error) {
      console.error('Error removing user:', error);
    } finally {
      setRemovingUserId(null);
    }
  };

  const confirmRemoval = (userId: string) => {
    setShowConfirmDialog(userId);
  };

  const cancelRemoval = () => {
    setShowConfirmDialog(null);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Team Members</h3>
        </div>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                  <div className="w-24 h-4 bg-gray-200 rounded"></div>
                </div>
                <div className="w-16 h-8 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Team Members</h3>
          <p className="text-sm text-gray-600 mt-1">
            {users.length} {users.length === 1 ? 'member' : 'members'}
          </p>
        </div>

        {users.length === 0 ? (
          <div className="p-6 text-center">
            <div className="text-gray-400 text-sm">No team members yet</div>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {users.map((user) => (
              <div key={user.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-medium text-sm">
                      {user.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="font-medium text-gray-900">{user.username}</span>
                </div>

                <button
                  onClick={() => confirmRemoval(user.id)}
                  disabled={removingUserId === user.id}
                  className="px-3 py-1 text-sm bg-red-100 text-red-700 hover:bg-red-200 hover:text-red-900 rounded border border-red-300 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {removingUserId === user.id ? 'Removing...' : 'Remove'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Remove Team Member</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to remove{' '}
              <span className="font-medium">
                {users.find(u => u.id === showConfirmDialog)?.username}
              </span>{' '}
              from your organization? This action cannot be undone.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={cancelRemoval}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (showConfirmDialog) {
                    handleRemoveUser(showConfirmDialog);
                  }
                }}
                disabled={removingUserId === showConfirmDialog}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {removingUserId === showConfirmDialog ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}