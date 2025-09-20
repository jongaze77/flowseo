'use client';

import { useState, useEffect } from 'react';
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

interface PageAnalysisTrackerProps {
  projectId: string;
  project: Project | null;
  pages: Page[];
  onPageSelect?: (pageId: string, region: string) => void;
  showNavigation?: boolean;
}

const REGIONS = [
  { code: 'UK', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'AU', name: 'Australia' },
  { code: 'CA', name: 'Canada' },
];

export default function PageAnalysisTracker({
  projectId,
  project,
  pages,
  onPageSelect,
  showNavigation = true
}: PageAnalysisTrackerProps) {
  const router = useRouter();
  const [selectedRegion, setSelectedRegion] = useState<string>(
    project?.default_region || 'UK'
  );

  useEffect(() => {
    if (project?.default_region) {
      setSelectedRegion(project.default_region);
    }
  }, [project?.default_region]);

  const getAnalysisStatus = (page: Page, region: string) => {
    if (!page.analysis_status) return { analyzed: false };
    return page.analysis_status[region] || { analyzed: false };
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getProgressStats = () => {
    const analyzed = pages.filter(page =>
      getAnalysisStatus(page, selectedRegion).analyzed
    ).length;
    const total = pages.length;
    const percentage = total > 0 ? Math.round((analyzed / total) * 100) : 0;

    return { analyzed, total, percentage };
  };

  const handleAnalyzePage = (pageId: string) => {
    if (onPageSelect) {
      onPageSelect(pageId, selectedRegion);
    } else {
      router.push(`/projects/${projectId}/keywords?page=${pageId}&region=${selectedRegion}`);
    }
  };

  const stats = getProgressStats();

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Analysis Progress</h3>
            <p className="text-sm text-gray-600 mt-1">
              {stats.analyzed} of {stats.total} pages analyzed ({stats.percentage}%)
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Region:</label>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
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
        <div className="mt-3">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${stats.percentage}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Pages List */}
      <div className="max-h-80 overflow-y-auto">
        {pages.length === 0 ? (
          <div className="p-4 text-center">
            <div className="text-gray-400 text-sm">No pages yet</div>
            <p className="text-xs text-gray-500 mt-1">Add content to track analysis progress</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {pages.map((page) => {
              const status = getAnalysisStatus(page, selectedRegion);
              const isAnalyzed = status.analyzed;

              return (
                <div key={page.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        {/* Status Indicator */}
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                          isAnalyzed ? 'bg-green-500' : 'bg-gray-300'
                        }`}></div>

                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {page.title || 'Untitled Content'}
                        </h4>
                      </div>

                      {page.url && (
                        <p className="text-xs text-blue-600 truncate mt-1 ml-5">{page.url}</p>
                      )}

                      <div className="ml-5 mt-1">
                        {isAnalyzed ? (
                          <div className="flex items-center space-x-3 text-xs text-gray-500">
                            <span className="text-green-600 font-medium">✓ Analyzed</span>
                            {status.analyzedAt && (
                              <span>on {formatDate(status.analyzedAt)}</span>
                            )}
                            {status.keywordCount && (
                              <span>({status.keywordCount} keywords)</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">Not analyzed</span>
                        )}
                      </div>
                    </div>

                    {/* Action Button */}
                    {showNavigation && (
                      <div className="flex-shrink-0 ml-4">
                        <button
                          onClick={() => handleAnalyzePage(page.id)}
                          className={`px-3 py-1 text-xs rounded border transition-colors ${
                            isAnalyzed
                              ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
                              : 'bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-200'
                          }`}
                        >
                          {isAnalyzed ? 'View Keywords' : 'Analyze Page'} →
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer with Sequential Navigation */}
      {showNavigation && pages.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Sequential workflow for region: <span className="font-medium">{selectedRegion}</span>
            </div>
            <button
              onClick={() => {
                const nextUnanalyzed = pages.find(page =>
                  !getAnalysisStatus(page, selectedRegion).analyzed
                );
                if (nextUnanalyzed) {
                  handleAnalyzePage(nextUnanalyzed.id);
                }
              }}
              disabled={stats.analyzed === stats.total}
              className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {stats.analyzed === stats.total ? 'All Complete' : 'Next Unanalyzed →'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}