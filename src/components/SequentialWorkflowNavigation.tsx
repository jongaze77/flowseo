'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Page {
  id: string;
  url: string | null;
  title: string | null;
  content: string;
  analysis_status: Record<string, {
    analyzed: boolean;
    analyzedAt?: string;
    keywordCount?: number;
  }> | null;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
  default_region: string;
}

interface SequentialWorkflowNavigationProps {
  projectId: string;
  project: Project | null;
  pages: Page[];
  currentPageId?: string;
  selectedRegion: string;
  onPageChange?: (pageId: string) => void;
  onRegionChange?: (region: string) => void;
  showSummary?: boolean;
}

const REGIONS = [
  { code: 'UK', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'AU', name: 'Australia' },
  { code: 'CA', name: 'Canada' },
];

export default function SequentialWorkflowNavigation({
  projectId,
  pages,
  currentPageId,
  selectedRegion,
  onPageChange,
  onRegionChange,
  showSummary = true
}: SequentialWorkflowNavigationProps) {
  const router = useRouter();
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  const getAnalysisStatus = (page: Page, region: string) => {
    if (!page.analysis_status) return { analyzed: false };
    return page.analysis_status[region] || { analyzed: false };
  };

  const getWorkflowProgress = () => {
    const analyzed = pages.filter(page =>
      getAnalysisStatus(page, selectedRegion).analyzed
    ).length;
    const total = pages.length;
    const percentage = total > 0 ? Math.round((analyzed / total) * 100) : 0;

    return { analyzed, total, percentage };
  };

  const getCurrentPageIndex = () => {
    if (!currentPageId) return -1;
    return pages.findIndex(page => page.id === currentPageId);
  };

  const getNextPage = () => {
    const currentIndex = getCurrentPageIndex();
    if (currentIndex === -1 || currentIndex >= pages.length - 1) return null;
    return pages[currentIndex + 1];
  };

  const getPreviousPage = () => {
    const currentIndex = getCurrentPageIndex();
    if (currentIndex <= 0) return null;
    return pages[currentIndex - 1];
  };

  const getNextUnanalyzedPage = () => {
    return pages.find(page =>
      !getAnalysisStatus(page, selectedRegion).analyzed
    );
  };

  const handlePageNavigation = (pageId: string) => {
    if (onPageChange) {
      onPageChange(pageId);
    } else {
      router.push(`/projects/${projectId}/keywords?page=${pageId}&region=${selectedRegion}`);
    }
  };

  const handleRegionChange = (region: string) => {
    if (onRegionChange) {
      onRegionChange(region);
    }
  };

  const handleWorkflowComplete = () => {
    setShowCompletionModal(true);
  };

  const progress = getWorkflowProgress();
  const currentIndex = getCurrentPageIndex();
  const nextPage = getNextPage();
  const prevPage = getPreviousPage();
  const nextUnanalyzed = getNextUnanalyzedPage();
  const isWorkflowComplete = progress.analyzed === progress.total && progress.total > 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Sequential Workflow</h3>
            <p className="text-sm text-gray-600 mt-1">
              Page {currentIndex >= 0 ? currentIndex + 1 : '?'} of {pages.length} • {selectedRegion} Region
            </p>
          </div>

          {/* Region Selector */}
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Region:</label>
            <select
              value={selectedRegion}
              onChange={(e) => handleRegionChange(e.target.value)}
              className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {REGIONS.map((region) => (
                <option key={region.code} value={region.code}>
                  {region.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Progress: {progress.analyzed} / {progress.total} pages</span>
            <span>{progress.percentage}% complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-300 ${
                isWorkflowComplete ? 'bg-green-500' : 'bg-purple-600'
              }`}
              style={{ width: `${progress.percentage}%` }}
            ></div>
          </div>
          {isWorkflowComplete && (
            <div className="flex items-center mt-2 text-sm text-green-600">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Workflow complete for {selectedRegion} region!
            </div>
          )}
        </div>
      </div>

      {/* Page Navigation */}
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Previous Page */}
          <button
            onClick={() => prevPage && handlePageNavigation(prevPage.id)}
            disabled={!prevPage}
            className="flex items-center px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </button>

          {/* Current Page Info */}
          <div className="text-center flex-1 mx-4">
            {currentPageId && currentIndex >= 0 ? (
              <div>
                <h4 className="font-medium text-gray-900">
                  {pages[currentIndex].title || 'Untitled Page'}
                </h4>
                <p className="text-sm text-gray-500 mt-1">
                  {getAnalysisStatus(pages[currentIndex], selectedRegion).analyzed ? (
                    <span className="text-green-600">✓ Analyzed</span>
                  ) : (
                    <span className="text-orange-600">⏳ Not analyzed</span>
                  )}
                </p>
              </div>
            ) : (
              <div className="text-gray-500">Select a page to continue</div>
            )}
          </div>

          {/* Next Page */}
          <button
            onClick={() => nextPage && handlePageNavigation(nextPage.id)}
            disabled={!nextPage}
            className="flex items-center px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Quick Actions */}
        <div className="mt-4 flex items-center justify-center space-x-4">
          {nextUnanalyzed && (
            <button
              onClick={() => handlePageNavigation(nextUnanalyzed.id)}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm"
            >
              Continue to Next Unanalyzed →
            </button>
          )}

          {isWorkflowComplete && showSummary && (
            <button
              onClick={handleWorkflowComplete}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
            >
              View Workflow Summary
            </button>
          )}
        </div>
      </div>

      {/* Page List Preview */}
      {pages.length > 0 && (
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <h5 className="text-sm font-medium text-gray-700 mb-3">Page Overview</h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {pages.map((page, index) => {
              const status = getAnalysisStatus(page, selectedRegion);
              const isCurrent = page.id === currentPageId;

              return (
                <button
                  key={page.id}
                  onClick={() => handlePageNavigation(page.id)}
                  className={`text-left p-2 rounded text-xs border transition-colors ${
                    isCurrent
                      ? 'border-purple-500 bg-purple-50 text-purple-900'
                      : status.analyzed
                      ? 'border-green-200 bg-green-50 text-green-900 hover:bg-green-100'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">#{index + 1}</span>
                    <div className={`w-2 h-2 rounded-full ${
                      status.analyzed ? 'bg-green-500' : 'bg-gray-300'
                    }`}></div>
                  </div>
                  <div className="truncate mt-1">
                    {page.title || 'Untitled Page'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Completion Modal */}
      {showCompletionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Workflow Complete!
              </h3>
              <p className="text-gray-600 mb-6">
                You have successfully analyzed all {progress.total} pages for the {selectedRegion} region.
                Total keywords generated: {pages.reduce((sum, page) => {
                  const status = getAnalysisStatus(page, selectedRegion);
                  return sum + (status.keywordCount || 0);
                }, 0)}
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowCompletionModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Continue Working
                </button>
                <button
                  onClick={() => router.push(`/projects/${projectId}`)}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                >
                  Project Overview
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}