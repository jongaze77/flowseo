'use client';

import { useState, useEffect } from 'react';
import { z } from 'zod';
import ContentPreview from './ContentPreview';
import ErrorModal from './ui/ErrorModal';

// Form validation schemas
const urlSchema = z.string().url('Please enter a valid URL (e.g., https://example.com)').min(1, 'URL is required');
const contentSchema = z.string().min(10, 'Content must be at least 10 characters').max(1000000, 'Content is too large');

type ContentType = 'url' | 'html' | 'markdown';

interface ContentIngestionFormProps {
  projectId: string;
  onContentSaved: () => void;
}

interface ProcessedContent {
  title: string | null;
  content: string;
  url?: string;
}

export default function ContentIngestionForm({ projectId, onContentSaved }: ContentIngestionFormProps) {
  const [activeTab, setActiveTab] = useState<ContentType>('url');
  const [urlInput, setUrlInput] = useState('');
  const [contentInput, setContentInput] = useState('');
  const [titleInput, setTitleInput] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [processedContent, setProcessedContent] = useState<ProcessedContent | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title: string; message: string }>({
    isOpen: false,
    title: '',
    message: ''
  });

  // Reset form when switching tabs
  useEffect(() => {
    setUrlInput('');
    setContentInput('');
    setTitleInput('');
    setErrors({});
    setProcessedContent(null);
    setShowPreview(false);
  }, [activeTab]);

  const showError = (title: string, message: string) => {
    setErrorModal({ isOpen: true, title, message });
  };

  const clearError = (field: string) => {
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateInput = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (activeTab === 'url') {
      const urlResult = urlSchema.safeParse(urlInput.trim());
      if (!urlResult.success) {
        newErrors.url = urlResult.error.issues[0].message;
      }
    } else {
      const contentResult = contentSchema.safeParse(contentInput.trim());
      if (!contentResult.success) {
        newErrors.content = contentResult.error.issues[0].message;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const processContent = async () => {
    if (!validateInput()) {
      return;
    }

    setIsProcessing(true);
    setErrors({});

    try {
      const content = activeTab === 'url' ? urlInput.trim() : contentInput.trim();

      const response = await fetch(`/api/v1/projects/${projectId}/pages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          contentType: activeTab,
          title: titleInput.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process content');
      }

      setProcessedContent({
        title: data.title,
        content: data.content,
        url: data.url,
      });
      setShowPreview(true);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      showError('Processing Failed', errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const saveContent = async () => {
    if (!processedContent) return;

    setIsSaving(true);

    try {
      // Content is already saved by the processing endpoint
      // This is just for UX flow - in a real scenario you might want to separate processing and saving
      onContentSaved();

      // Reset form
      setUrlInput('');
      setContentInput('');
      setTitleInput('');
      setProcessedContent(null);
      setShowPreview(false);
      setErrors({});

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save content';
      showError('Save Failed', errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const cancelPreview = () => {
    setShowPreview(false);
    setProcessedContent(null);
  };

  if (showPreview && processedContent) {
    return (
      <>
        <ContentPreview
          title={processedContent.title}
          content={processedContent.content}
          url={processedContent.url}
          onConfirm={saveContent}
          onCancel={cancelPreview}
          isLoading={isSaving}
        />
        <ErrorModal
          isOpen={errorModal.isOpen}
          title={errorModal.title}
          message={errorModal.message}
          onClose={() => setErrorModal({ isOpen: false, title: '', message: '' })}
        />
      </>
    );
  }

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6">Add Content to Project</h3>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('url')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'url'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Scrape URL
            </button>
            <button
              onClick={() => setActiveTab('html')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'html'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Paste HTML
            </button>
            <button
              onClick={() => setActiveTab('markdown')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'markdown'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Paste Markdown
            </button>
          </nav>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); processContent(); }} className="space-y-4">
          {/* Optional Title Input */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Custom Title (Optional)
            </label>
            <input
              type="text"
              id="title"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder="Leave empty to auto-extract title"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              maxLength={500}
            />
          </div>

          {/* URL Input Tab */}
          {activeTab === 'url' && (
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-1">
                Website URL
              </label>
              <input
                type="url"
                id="url"
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value);
                  clearError('url');
                }}
                placeholder="https://example.com"
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                  errors.url ? 'border-red-300' : 'border-gray-300'
                }`}
                required
              />
              {errors.url && (
                <p className="mt-1 text-sm text-red-600">{errors.url}</p>
              )}
              <p className="mt-1 text-sm text-gray-500">
                Enter a URL to automatically scrape and extract content
              </p>
            </div>
          )}

          {/* HTML Content Tab */}
          {activeTab === 'html' && (
            <div>
              <label htmlFor="htmlContent" className="block text-sm font-medium text-gray-700 mb-1">
                HTML Content
              </label>
              <textarea
                id="htmlContent"
                value={contentInput}
                onChange={(e) => {
                  setContentInput(e.target.value);
                  clearError('content');
                }}
                placeholder="<html><body><h1>Your content here...</h1></body></html>"
                rows={12}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 font-mono text-sm ${
                  errors.content ? 'border-red-300' : 'border-gray-300'
                }`}
                required
              />
              {errors.content && (
                <p className="mt-1 text-sm text-red-600">{errors.content}</p>
              )}
              <p className="mt-1 text-sm text-gray-500">
                Paste HTML content that will be cleaned and processed
              </p>
            </div>
          )}

          {/* Markdown Content Tab */}
          {activeTab === 'markdown' && (
            <div>
              <label htmlFor="markdownContent" className="block text-sm font-medium text-gray-700 mb-1">
                Markdown Content
              </label>
              <textarea
                id="markdownContent"
                value={contentInput}
                onChange={(e) => {
                  setContentInput(e.target.value);
                  clearError('content');
                }}
                placeholder="# Your content here&#10;&#10;This is a paragraph with **bold** text."
                rows={12}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 font-mono text-sm ${
                  errors.content ? 'border-red-300' : 'border-gray-300'
                }`}
                required
              />
              {errors.content && (
                <p className="mt-1 text-sm text-red-600">{errors.content}</p>
              )}
              <p className="mt-1 text-sm text-gray-500">
                Paste Markdown content for processing
              </p>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isProcessing}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                `Process ${activeTab === 'url' ? 'URL' : 'Content'}`
              )}
            </button>
          </div>
        </form>
      </div>

      <ErrorModal
        isOpen={errorModal.isOpen}
        title={errorModal.title}
        message={errorModal.message}
        onClose={() => setErrorModal({ isOpen: false, title: '', message: '' })}
      />
    </>
  );
}