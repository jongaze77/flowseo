'use client';

interface ImportResultsProps {
  result: {
    summary: {
      totalImported: number;
      totalMatched: number;
      totalNew: number;
      totalConflicts: number;
      totalErrors: number;
      regionValidated: boolean;
    };
    conflicts?: Array<{
      keywordText: string;
      field: string;
      existingValue: any;
      importedValue: any;
      existingSource?: string;
      importedSource: string;
    }>;
    errors?: Array<{
      keywordText: string;
      message: string;
      type: string;
    }>;
    keywordListId: string;
    keywordListName: string;
  };
  onClose: () => void;
  onViewKeywords?: () => void;
  onResolveConflicts?: () => void;
  className?: string;
}

export default function ImportResults({
  result,
  onClose,
  onViewKeywords,
  onResolveConflicts,
  className = ''
}: ImportResultsProps) {
  const { summary, conflicts = [], errors = [] } = result;

  const getStatusColor = () => {
    if (summary.totalErrors > 0) return 'red';
    if (summary.totalConflicts > 0) return 'yellow';
    return 'green';
  };

  const getStatusIcon = () => {
    const statusColor = getStatusColor();

    if (statusColor === 'red') {
      return (
        <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      );
    }

    if (statusColor === 'yellow') {
      return (
        <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      );
    }

    return (
      <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  };

  const getStatusMessage = () => {
    if (summary.totalErrors > 0) {
      return `Import completed with ${summary.totalErrors} error${summary.totalErrors > 1 ? 's' : ''}`;
    }
    if (summary.totalConflicts > 0) {
      return `Import completed with ${summary.totalConflicts} conflict${summary.totalConflicts > 1 ? 's' : ''} to resolve`;
    }
    return 'Import completed successfully!';
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          {getStatusIcon()}
          <h3 className="ml-3 text-lg font-semibold text-gray-900">
            Import Results
          </h3>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-500"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Status Message */}
      <div className="mb-6">
        <p className="text-sm text-gray-600">{getStatusMessage()}</p>
        <p className="text-xs text-gray-500 mt-1">
          Keywords imported to: <span className="font-medium">{result.keywordListName}</span>
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center p-3 bg-blue-50 rounded-md">
          <div className="text-2xl font-bold text-blue-600">{summary.totalImported}</div>
          <div className="text-xs text-blue-700">Total Imported</div>
        </div>
        <div className="text-center p-3 bg-green-50 rounded-md">
          <div className="text-2xl font-bold text-green-600">{summary.totalNew}</div>
          <div className="text-xs text-green-700">New Keywords</div>
        </div>
        <div className="text-center p-3 bg-yellow-50 rounded-md">
          <div className="text-2xl font-bold text-yellow-600">{summary.totalMatched}</div>
          <div className="text-xs text-yellow-700">Updated Existing</div>
        </div>
        <div className="text-center p-3 bg-purple-50 rounded-md">
          <div className="text-2xl font-bold text-purple-600">{summary.totalConflicts}</div>
          <div className="text-xs text-purple-700">Conflicts</div>
        </div>
      </div>

      {/* Region Validation Status */}
      {!summary.regionValidated && (
        <div className="mb-6 p-3 bg-orange-50 border border-orange-200 rounded-md">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-orange-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-orange-700">
              Some keywords may not match the project's geographic region
            </span>
          </div>
        </div>
      )}

      {/* Errors Section */}
      {errors.length > 0 && (
        <div className="mb-6">
          <h4 className="text-md font-medium text-red-800 mb-3">Errors ({errors.length})</h4>
          <div className="max-h-32 overflow-y-auto space-y-2">
            {errors.slice(0, 5).map((error, index) => (
              <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="text-sm font-medium text-red-800">{error.keywordText}</div>
                <div className="text-xs text-red-600">{error.message}</div>
              </div>
            ))}
            {errors.length > 5 && (
              <div className="text-xs text-red-600 text-center py-2">
                ... and {errors.length - 5} more errors
              </div>
            )}
          </div>
        </div>
      )}

      {/* Conflicts Section */}
      {conflicts.length > 0 && (
        <div className="mb-6">
          <h4 className="text-md font-medium text-yellow-800 mb-3">
            Conflicts Requiring Resolution ({conflicts.length})
          </h4>
          <div className="max-h-32 overflow-y-auto space-y-2">
            {conflicts.slice(0, 3).map((conflict, index) => (
              <div key={index} className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="text-sm font-medium text-yellow-800">{conflict.keywordText}</div>
                <div className="text-xs text-yellow-600">
                  {conflict.field}: {conflict.existingSource || 'Existing'} ({conflict.existingValue}) vs {conflict.importedSource} ({conflict.importedValue})
                </div>
              </div>
            ))}
            {conflicts.length > 3 && (
              <div className="text-xs text-yellow-600 text-center py-2">
                ... and {conflicts.length - 3} more conflicts
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        {onViewKeywords && (
          <button
            onClick={onViewKeywords}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium"
          >
            View Keywords
          </button>
        )}

        {conflicts.length > 0 && onResolveConflicts && (
          <button
            onClick={onResolveConflicts}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md font-medium"
          >
            Resolve Conflicts
          </button>
        )}

        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md font-medium"
        >
          Close
        </button>
      </div>

      {/* Quick Stats Summary */}
      <div className="mt-6 pt-4 border-t border-gray-200 text-xs text-gray-500">
        <div className="flex justify-between">
          <span>Import completed at {new Date().toLocaleString()}</span>
          <span>Success rate: {Math.round(((summary.totalImported - summary.totalErrors) / summary.totalImported) * 100)}%</span>
        </div>
      </div>
    </div>
  );
}