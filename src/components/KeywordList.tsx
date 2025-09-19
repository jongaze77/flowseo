'use client';

import { useState } from 'react';
import ErrorModal from './ui/ErrorModal';
import ConfirmationModal from './ui/ConfirmationModal';

interface Keyword {
  id: string;
  text: string;
  search_volume?: number | null;
  difficulty?: number | null;
  created_at: string;
}

interface KeywordListData {
  id: string;
  name: string;
  generated_at: string;
  created_at: string;
  keywords: Keyword[];
  project?: {
    id: string;
    name: string;
  };
  page?: {
    id: string;
    title?: string | null;
    url?: string | null;
  };
}

interface KeywordListProps {
  keywordList: KeywordListData;
  onDelete?: (keywordListId: string) => void;
  showActions?: boolean;
  compact?: boolean;
}

export default function KeywordList({
  keywordList,
  onDelete,
  showActions = true,
  compact = false
}: KeywordListProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Modal states
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean }>({ isOpen: false });
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title: string; message: string }>({
    isOpen: false,
    title: '',
    message: ''
  });

  const showError = (title: string, message: string) => {
    setErrorModal({ isOpen: true, title, message });
  };

  const copyToClipboard = async (format: 'plain' | 'csv' | 'json' = 'plain') => {
    try {
      let textToCopy = '';

      switch (format) {
        case 'plain':
          textToCopy = keywordList.keywords.map(k => k.text).join('\n');
          break;
        case 'csv':
          textToCopy = 'Keyword,Search Volume,Difficulty\n' +
            keywordList.keywords.map(k =>
              `"${k.text}",${k.search_volume || ''},${k.difficulty || ''}`
            ).join('\n');
          break;
        case 'json':
          textToCopy = JSON.stringify(keywordList.keywords.map(k => ({
            text: k.text,
            searchVolume: k.search_volume,
            difficulty: k.difficulty
          })), null, 2);
          break;
      }

      await navigator.clipboard.writeText(textToCopy);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      showError('Copy Failed', 'Failed to copy keywords to clipboard. Please try again.');
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;

    setIsDeleting(true);
    setDeleteModal({ isOpen: false });

    try {
      await onDelete(keywordList.id);
    } catch {
      showError('Delete Failed', 'Failed to delete keyword list. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDifficultyColor = (difficulty?: number | null) => {
    if (!difficulty) return 'text-gray-400';
    if (difficulty < 30) return 'text-green-600';
    if (difficulty < 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getDifficultyLabel = (difficulty?: number | null) => {
    if (!difficulty) return 'Unknown';
    if (difficulty < 30) return 'Easy';
    if (difficulty < 70) return 'Medium';
    return 'Hard';
  };

  if (compact) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h4 className="font-medium text-gray-900">{keywordList.name}</h4>
            <p className="text-sm text-gray-500">
              {keywordList.keywords.length} keywords • {formatDate(keywordList.generated_at)}
            </p>
          </div>
          {showActions && (
            <button
              onClick={() => copyToClipboard('plain')}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Copy
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {keywordList.keywords.slice(0, 10).map((keyword) => (
            <span
              key={keyword.id}
              className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
            >
              {keyword.text}
            </span>
          ))}
          {keywordList.keywords.length > 10 && (
            <span className="inline-block px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded">
              +{keywordList.keywords.length - 10} more
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{keywordList.name}</h3>
            <div className="mt-1 text-sm text-gray-500 space-y-1">
              <p>Generated: {formatDate(keywordList.generated_at)}</p>
              {keywordList.page && (
                <p>
                  Source: {keywordList.page.title || 'Untitled Page'}
                  {keywordList.page.url && (
                    <a
                      href={keywordList.page.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1 text-blue-600 hover:text-blue-800"
                    >
                      ↗
                    </a>
                  )}
                </p>
              )}
              <p>{keywordList.keywords.length} keywords total</p>
            </div>
          </div>

          {showActions && (
            <div className="flex space-x-2">
              {/* Copy Dropdown */}
              <div className="relative group">
                <button
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  {copySuccess ? 'Copied!' : 'Copy'}
                </button>
                <div className="absolute right-0 mt-1 w-32 bg-white rounded-md shadow-lg border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                  <button
                    onClick={() => copyToClipboard('plain')}
                    className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Plain Text
                  </button>
                  <button
                    onClick={() => copyToClipboard('csv')}
                    className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    CSV
                  </button>
                  <button
                    onClick={() => copyToClipboard('json')}
                    className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    JSON
                  </button>
                </div>
              </div>

              {/* Delete Button */}
              {onDelete && (
                <button
                  onClick={() => setDeleteModal({ isOpen: true })}
                  disabled={isDeleting}
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Keywords Grid */}
      <div className="p-6">
        {keywordList.keywords.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p>No keywords found in this list</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {keywordList.keywords.map((keyword) => (
              <div
                key={keyword.id}
                className="p-3 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
              >
                <div className="font-medium text-gray-900 mb-1">{keyword.text}</div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>
                    Volume: {keyword.search_volume?.toLocaleString() || 'N/A'}
                  </span>
                  <span className={getDifficultyColor(keyword.difficulty)}>
                    {getDifficultyLabel(keyword.difficulty)} {keyword.difficulty ? `(${keyword.difficulty})` : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer with Stats */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Total Keywords: {keywordList.keywords.length}</span>
          <span>
            Avg. Difficulty: {
              keywordList.keywords.filter(k => k.difficulty).length > 0
                ? Math.round(
                    keywordList.keywords
                      .filter(k => k.difficulty)
                      .reduce((sum, k) => sum + (k.difficulty || 0), 0) /
                    keywordList.keywords.filter(k => k.difficulty).length
                  )
                : 'N/A'
            }
          </span>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onCancel={() => setDeleteModal({ isOpen: false })}
        onConfirm={handleDelete}
        title="Delete Keyword List"
        message={`Are you sure you want to delete "${keywordList.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
      />

      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ isOpen: false, title: '', message: '' })}
        title={errorModal.title}
        message={errorModal.message}
      />
    </div>
  );
}