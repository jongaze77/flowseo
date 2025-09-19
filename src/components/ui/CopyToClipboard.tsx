'use client';

import { useState } from 'react';

interface CopyToClipboardProps {
  text: string;
  children?: React.ReactNode;
  className?: string;
  onCopy?: () => void;
  onError?: (error: Error) => void;
  successMessage?: string;
  errorMessage?: string;
  resetDelay?: number; // milliseconds
}

export default function CopyToClipboard({
  text,
  children,
  className = '',
  onCopy,
  onError,
  successMessage = 'Copied!',
  errorMessage = 'Copy failed',
  resetDelay = 2000
}: CopyToClipboardProps) {
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        // Use modern clipboard API
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers or non-secure contexts
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'absolute';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (!successful) {
          throw new Error('Fallback copy failed');
        }
      }

      setStatus('success');
      onCopy?.();

      // Reset status after delay
      setTimeout(() => {
        setStatus('idle');
      }, resetDelay);

    } catch (error) {
      setStatus('error');
      onError?.(error instanceof Error ? error : new Error('Copy operation failed'));

      // Reset status after delay
      setTimeout(() => {
        setStatus('idle');
      }, resetDelay);
    }
  };

  const getButtonText = () => {
    switch (status) {
      case 'success':
        return successMessage;
      case 'error':
        return errorMessage;
      default:
        return children || 'Copy';
    }
  };

  const getButtonStyles = () => {
    const baseStyles = 'inline-flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';

    switch (status) {
      case 'success':
        return `${baseStyles} text-green-700 bg-green-50 border-green-200 focus:ring-green-500`;
      case 'error':
        return `${baseStyles} text-red-700 bg-red-50 border-red-200 focus:ring-red-500`;
      default:
        return `${baseStyles} text-gray-700 bg-white border-gray-300 hover:bg-gray-50 focus:ring-blue-500`;
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`${getButtonStyles()} ${className}`}
      disabled={status === 'success'}
      title={status === 'idle' ? 'Copy to clipboard' : undefined}
    >
      {/* Icon */}
      <span className="mr-2">
        {status === 'success' ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        ) : status === 'error' ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
      </span>

      {/* Text */}
      <span>{getButtonText()}</span>
    </button>
  );
}

// Utility function for copying text directly (can be used without component)
export const copyTextToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'absolute';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (!successful) {
        throw new Error('Fallback copy failed');
      }
    }
    return true;
  } catch (error) {
    console.error('Copy failed:', error);
    return false;
  }
};

// Utility function to format keywords for different export formats
export const formatKeywordsForExport = (keywords: Array<{ text: string; search_volume?: number | null; difficulty?: number | null }>, format: 'plain' | 'csv' | 'json'): string => {
  switch (format) {
    case 'plain':
      return keywords.map(k => k.text).join('\n');

    case 'csv':
      return 'Keyword,Search Volume,Difficulty\n' +
        keywords.map(k =>
          `"${k.text.replace(/"/g, '""')}",${k.search_volume || ''},${k.difficulty || ''}`
        ).join('\n');

    case 'json':
      return JSON.stringify(keywords.map(k => ({
        text: k.text,
        searchVolume: k.search_volume,
        difficulty: k.difficulty
      })), null, 2);

    default:
      return keywords.map(k => k.text).join('\n');
  }
};