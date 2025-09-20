'use client';

import { useState } from 'react';
import FileUpload from './ui/FileUpload';
import ProgressBar from './ui/ProgressBar';
import ErrorModal from './ui/ErrorModal';

interface CSVUploadFormProps {
  projectId: string;
  onImportComplete?: (result: ImportResult) => void;
  onImportStart?: (importId: string) => void;
  className?: string;
}

interface ImportResult {
  summary: {
    totalImported: number;
    totalMatched: number;
    totalNew: number;
    totalConflicts: number;
    totalErrors: number;
    regionValidated: boolean;
  };
  keywordListId: string;
  keywordListName: string;
}

interface ImportOptions {
  keywordListName?: string;
  detectTool: boolean;
  tool?: 'semrush' | 'ahrefs' | 'google_keyword_planner';
  conflictResolution: 'keep_existing' | 'use_imported' | 'manual';
  allowRegionMismatch: boolean;
}

export default function CSVUploadForm({
  projectId,
  onImportComplete,
  onImportStart,
  className = ''
}: CSVUploadFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importOptions, setImportOptions] = useState<ImportOptions>({
    detectTool: true,
    conflictResolution: 'manual',
    allowRegionMismatch: false
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState('');
  const [importId, setImportId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setError(null);
  };

  const handleImportSubmit = async () => {
    if (!selectedFile) {
      setError('Please select a CSV file to import');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadMessage('Uploading file...');
    setError(null);

    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('data', JSON.stringify(importOptions));

      // Upload file and start import
      const response = await fetch(`/api/v1/projects/${projectId}/keywords/import`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      const newImportId = result.importId;
      setImportId(newImportId);

      if (onImportStart) {
        onImportStart(newImportId);
      }

      // Start polling for progress
      pollImportStatus(newImportId);

    } catch (error) {
      console.error('Upload error:', error);
      setError(error instanceof Error ? error.message : 'Upload failed');
      setIsUploading(false);
    }
  };

  const pollImportStatus = async (importId: string) => {
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/keywords/import/status/${importId}`);

      if (!response.ok) {
        throw new Error('Failed to get import status');
      }

      const statusData = await response.json();

      setUploadProgress(statusData.progress);
      setUploadMessage(statusData.message || 'Processing...');

      if (statusData.status === 'completed') {
        setIsUploading(false);
        setUploadMessage('Import completed successfully!');

        if (onImportComplete && statusData.result) {
          onImportComplete(statusData.result);
        }

        // Reset form after successful import
        setTimeout(() => {
          setSelectedFile(null);
          setImportId(null);
          setUploadProgress(0);
          setUploadMessage('');
        }, 3000);

      } else if (statusData.status === 'failed') {
        setIsUploading(false);
        setError(statusData.error || 'Import failed');

      } else {
        // Continue polling if still processing
        setTimeout(() => pollImportStatus(importId), 1000);
      }

    } catch (error) {
      console.error('Status polling error:', error);
      setError('Failed to get import status');
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setIsUploading(false);
    setUploadProgress(0);
    setUploadMessage('');
    setImportId(null);
    setError(null);
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Import Keywords from CSV
        </h3>
        <p className="text-sm text-gray-600">
          Upload a CSV file from external tools like Semrush, Ahrefs, or Google Keyword Planner
        </p>
      </div>

      {/* File Upload Section */}
      <div className="mb-6">
        <FileUpload
          onFileSelect={handleFileSelect}
          disabled={isUploading}
          className="mb-4"
        />

        {selectedFile && !isUploading && (
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-gray-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-gray-900">{selectedFile.name}</span>
              <span className="text-xs text-gray-500 ml-2">
                ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
              </span>
            </div>
            <button
              onClick={handleReset}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Remove
            </button>
          </div>
        )}
      </div>

      {/* Import Options */}
      {selectedFile && !isUploading && (
        <div className="mb-6 space-y-4">
          <h4 className="text-md font-medium text-gray-900">Import Options</h4>

          {/* Keyword List Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Keyword List Name (optional)
            </label>
            <input
              type="text"
              value={importOptions.keywordListName || ''}
              onChange={(e) => setImportOptions({
                ...importOptions,
                keywordListName: e.target.value || undefined
              })}
              placeholder="Auto-generated from file and date"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Tool Detection */}
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={importOptions.detectTool}
                onChange={(e) => setImportOptions({
                  ...importOptions,
                  detectTool: e.target.checked,
                  tool: e.target.checked ? undefined : importOptions.tool
                })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">
                Auto-detect external tool format
              </span>
            </label>
          </div>

          {/* Manual Tool Selection */}
          {!importOptions.detectTool && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                External Tool
              </label>
              <select
                value={importOptions.tool || ''}
                onChange={(e) => setImportOptions({
                  ...importOptions,
                  tool: e.target.value as any
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select tool...</option>
                <option value="semrush">Semrush</option>
                <option value="ahrefs">Ahrefs</option>
                <option value="google_keyword_planner">Google Keyword Planner</option>
              </select>
            </div>
          )}

          {/* Conflict Resolution */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              When keywords already exist
            </label>
            <select
              value={importOptions.conflictResolution}
              onChange={(e) => setImportOptions({
                ...importOptions,
                conflictResolution: e.target.value as any
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="manual">Review conflicts manually</option>
              <option value="keep_existing">Keep existing data</option>
              <option value="use_imported">Use imported data</option>
            </select>
          </div>

          {/* Region Mismatch */}
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={importOptions.allowRegionMismatch}
                onChange={(e) => setImportOptions({
                  ...importOptions,
                  allowRegionMismatch: e.target.checked
                })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">
                Allow keywords from different regions
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <div className="mb-6">
          <ProgressBar
            progress={uploadProgress}
            label={uploadMessage}
            showPercentage={true}
            color="blue"
            animated={uploadProgress < 100}
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end space-x-3">
        {!isUploading && selectedFile && (
          <>
            <button
              onClick={handleReset}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleImportSubmit}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium"
            >
              Start Import
            </button>
          </>
        )}
      </div>

      {/* Error Modal */}
      <ErrorModal
        isOpen={!!error}
        title="Import Error"
        message={error || ''}
        onClose={() => setError(null)}
      />
    </div>
  );
}