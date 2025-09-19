'use client';

import { ReactNode } from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isConfirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
}

export default function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isConfirming = false,
  onConfirm,
  onCancel,
  variant = 'danger'
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const getConfirmButtonStyles = () => {
    switch (variant) {
      case 'danger':
        return 'bg-red-600 hover:bg-red-700 text-white';
      case 'warning':
        return 'bg-yellow-600 hover:bg-yellow-700 text-white';
      case 'info':
        return 'bg-blue-600 hover:bg-blue-700 text-white';
      default:
        return 'bg-red-600 hover:bg-red-700 text-white';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>
        <div className="text-gray-600 mb-6">{message}</div>
        <div className="flex space-x-3">
          <button
            onClick={onCancel}
            disabled={isConfirming}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isConfirming}
            className={`flex-1 px-4 py-2 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed ${getConfirmButtonStyles()}`}
          >
            {isConfirming ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}