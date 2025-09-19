'use client';

interface ContentPreviewProps {
  title: string | null;
  content: string;
  url?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function ContentPreview({
  title,
  content,
  url,
  onConfirm,
  onCancel,
  isLoading = false
}: ContentPreviewProps) {
  const truncatedContent = content.length > 1000
    ? content.substring(0, 1000) + '...'
    : content;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Content Preview</h3>

      <div className="space-y-4">
        {url && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Source URL
            </label>
            <p className="text-sm text-blue-600 break-all">{url}</p>
          </div>
        )}

        {title && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Page Title
            </label>
            <p className="text-sm text-gray-900 font-medium">{title}</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Content ({content.length.toLocaleString()} characters)
          </label>
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3 max-h-64 overflow-y-auto">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap break-words">
              {truncatedContent}
            </pre>
            {content.length > 1000 && (
              <p className="text-xs text-gray-500 mt-2 italic">
                Preview shows first 1,000 characters. Full content will be saved.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex space-x-3 mt-6">
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Saving...' : 'Save Content'}
        </button>
      </div>
    </div>
  );
}