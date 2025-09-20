'use client';

import { useState, useMemo } from 'react';
import DataTable, { type TableColumn } from './ui/DataTable';
import ErrorModal from './ui/ErrorModal';
import ConfirmationModal from './ui/ConfirmationModal';
import { ExternalToolDataMapper, type ExternalToolData, ToolSource } from '../lib/utils/externalToolDataMapper';

interface Keyword {
  id: string;
  text: string;
  search_volume?: number | null;
  difficulty?: number | null;
  region?: string | null;
  external_tool_data?: ExternalToolData;
  created_at: string;
}

interface KeywordListData {
  id: string;
  name: string;
  generated_at: string;
  created_at: string;
  region?: string | null;
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

interface KeywordDataTableProps {
  keywordList: KeywordListData;
  onDelete?: (keywordListId: string) => void;
  onKeywordsSelected?: (keywords: Keyword[]) => void;
  showActions?: boolean;
  selectable?: boolean;
  onViewModeChange?: (mode: 'cards' | 'table') => void;
}

export default function KeywordDataTable({
  keywordList,
  onDelete,
  onKeywordsSelected,
  showActions = true,
  selectable = false,
  onViewModeChange,
}: KeywordDataTableProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [selectedKeywords, setSelectedKeywords] = useState<Keyword[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

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

  const getToolSource = (keyword: Keyword): string => {
    const toolData = keyword.external_tool_data || {};
    const sources: string[] = [];

    if (toolData.last_import_source) {
      switch (toolData.last_import_source) {
        case 'semrush':
          sources.push(ToolSource.SEMRUSH);
          break;
        case 'ahrefs':
          sources.push(ToolSource.AHREFS);
          break;
        case 'google_keyword_planner':
          sources.push(ToolSource.KEYWORD_PLANNER);
          break;
      }
    }

    // Check for individual tool data
    if (toolData.semrush_cpc !== undefined || toolData.semrush_intent !== undefined) {
      if (!sources.includes(ToolSource.SEMRUSH)) sources.push(ToolSource.SEMRUSH);
    }
    if (toolData.ahrefs_cpc !== undefined || toolData.ahrefs_searchVolume !== undefined) {
      if (!sources.includes(ToolSource.AHREFS)) sources.push(ToolSource.AHREFS);
    }
    if (toolData.google_keyword_planner_topBidLow !== undefined) {
      if (!sources.includes(ToolSource.KEYWORD_PLANNER)) sources.push(ToolSource.KEYWORD_PLANNER);
    }

    if (sources.length === 0) {
      return ToolSource.AI_GENERATED;
    }

    return sources.join(', ');
  };

  const getCompetition = (keyword: Keyword): string => {
    const toolData = keyword.external_tool_data || {};

    // Check for Google Keyword Planner competition data
    if (toolData.google_keyword_planner_competition !== undefined) {
      return String(toolData.google_keyword_planner_competition);
    }

    // Check for competition index
    if (toolData.google_keyword_planner_competitionIndex !== undefined) {
      const index = Number(toolData.google_keyword_planner_competitionIndex);
      if (index <= 0.33) return 'LOW';
      if (index <= 0.66) return 'MEDIUM';
      return 'HIGH';
    }

    // Fallback to standardMetrics if it exists
    if (toolData.standardMetrics?.competition !== undefined) {
      return ExternalToolDataMapper.formatMetricValue(
        'competition',
        toolData.standardMetrics.competition
      );
    }

    return 'N/A';
  };

  const getCPC = (keyword: Keyword): string => {
    const toolData = keyword.external_tool_data || {};

    // Check for various CPC data sources
    if (toolData.semrush_cpc !== undefined) {
      return ExternalToolDataMapper.formatMetricValue('cpc', toolData.semrush_cpc);
    }

    if (toolData.ahrefs_cpc !== undefined) {
      return ExternalToolDataMapper.formatMetricValue('cpc', toolData.ahrefs_cpc);
    }

    if (toolData.google_keyword_planner_topBidLow !== undefined) {
      return ExternalToolDataMapper.formatMetricValue('cpc', toolData.google_keyword_planner_topBidLow);
    }

    // Fallback to standardMetrics if it exists
    if (toolData.standardMetrics?.cpc !== undefined) {
      return ExternalToolDataMapper.formatMetricValue('cpc', toolData.standardMetrics.cpc);
    }

    return 'N/A';
  };

  const columns: TableColumn<Keyword>[] = [
    {
      key: 'text',
      title: 'Keyword',
      sortable: true,
      render: (value: unknown) => (
        <span className="font-medium text-gray-900">{String(value)}</span>
      ),
    },
    {
      key: 'search_volume',
      title: 'Volume',
      sortable: true,
      render: (value: unknown, keyword: Keyword) => {
        const toolData = keyword.external_tool_data || {};
        const volumes: Array<{source: string, value: number | string}> = [];

        // Collect tool-specific volumes first
        const toolSources: Array<{source: string, value: number | string}> = [];

        // Semrush volume
        if (toolData.semrush_volume !== undefined) {
          toolSources.push({source: 'Semrush', value: toolData.semrush_volume});
        }

        // Ahrefs volume
        if (toolData.ahrefs_searchVolume !== undefined) {
          toolSources.push({source: 'Ahrefs', value: toolData.ahrefs_searchVolume});
        }

        // Google Keyword Planner volume
        if (toolData.google_keyword_planner_searchVolume !== undefined) {
          toolSources.push({source: 'GKP', value: toolData.google_keyword_planner_searchVolume});
        }

        // Main search volume - only add if it's different from tool sources or if no tool sources exist
        if (value !== null && value !== undefined) {
          const baseValue = value as number;
          const matchingToolSource = toolSources.find(ts => Number(ts.value) === baseValue);

          if (!matchingToolSource) {
            // Base value is different from all tool sources, so include it
            volumes.push({source: 'Base', value: baseValue});
          }
        }

        // Add all tool sources
        volumes.push(...toolSources);

        if (volumes.length === 0) {
          return <span className="text-gray-400">-</span>;
        }

        if (volumes.length === 1) {
          return (
            <span className="text-gray-700">
              {ExternalToolDataMapper.formatMetricValue('volume', volumes[0].value)}
            </span>
          );
        }

        // Multiple sources - show all
        return (
          <div className="flex flex-col space-y-1">
            {volumes.map((vol, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <span className="text-xs text-gray-500 min-w-[60px]">{vol.source}:</span>
                <span className="text-gray-700">
                  {ExternalToolDataMapper.formatMetricValue('volume', vol.value)}
                </span>
              </div>
            ))}
          </div>
        );
      },
    },
    {
      key: 'difficulty',
      title: 'Difficulty',
      sortable: true,
      render: (value: unknown, keyword: Keyword) => {
        const toolData = keyword.external_tool_data || {};
        const difficulties: Array<{source: string, value: number}> = [];

        // Collect tool-specific difficulties first
        const toolSources: Array<{source: string, value: number}> = [];

        // Semrush difficulty
        if (toolData.semrush_difficulty !== undefined && typeof toolData.semrush_difficulty === 'number') {
          toolSources.push({source: 'Semrush', value: toolData.semrush_difficulty});
        }

        // Ahrefs difficulty
        if (toolData.ahrefs_difficulty !== undefined && typeof toolData.ahrefs_difficulty === 'number') {
          toolSources.push({source: 'Ahrefs', value: toolData.ahrefs_difficulty});
        }

        // Google Keyword Planner competition
        if (toolData.google_keyword_planner_competitionIndex !== undefined && typeof toolData.google_keyword_planner_competitionIndex === 'number') {
          toolSources.push({source: 'GKP', value: Math.round(toolData.google_keyword_planner_competitionIndex * 100)});
        }

        // Main difficulty - only add if it's different from tool sources or if no tool sources exist
        if (value !== null && value !== undefined && typeof value === 'number') {
          const baseValue = value;
          const matchingToolSource = toolSources.find(ts => ts.value === baseValue);

          if (!matchingToolSource) {
            // Base value is different from all tool sources, so include it
            difficulties.push({source: 'Base', value: baseValue});
          }
        }

        // Add all tool sources
        difficulties.push(...toolSources);

        if (difficulties.length === 0) {
          return <span className="text-gray-400">-</span>;
        }

        if (difficulties.length === 1) {
          const diff = difficulties[0];
          return (
            <div className="flex items-center space-x-2">
              <span className={getDifficultyColor(diff.value)}>
                {getDifficultyLabel(diff.value)}
              </span>
              <span className="text-xs text-gray-500">({diff.value})</span>
            </div>
          );
        }

        // Multiple sources - show all
        return (
          <div className="flex flex-col space-y-1">
            {difficulties.map((diff, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <span className="text-xs text-gray-500 min-w-[60px]">{diff.source}:</span>
                <span className={getDifficultyColor(diff.value)}>
                  {getDifficultyLabel(diff.value)}
                </span>
                <span className="text-xs text-gray-500">({diff.value})</span>
              </div>
            ))}
          </div>
        );
      },
    },
    {
      key: 'competition',
      title: 'Competition',
      sortable: false,
      render: (_, keyword: Keyword) => (
        <span className="text-gray-700">{getCompetition(keyword)}</span>
      ),
    },
    {
      key: 'cpc',
      title: 'CPC',
      sortable: false,
      render: (_, keyword: Keyword) => (
        <span className="text-gray-700">{getCPC(keyword)}</span>
      ),
    },
    {
      key: 'tool_source',
      title: 'Source',
      sortable: true,
      render: (_, keyword: Keyword) => {
        const source = getToolSource(keyword);
        const colorMap: Record<string, string> = {
          [ToolSource.SEMRUSH]: 'bg-orange-100 text-orange-800',
          [ToolSource.AHREFS]: 'bg-blue-100 text-blue-800',
          [ToolSource.KEYWORD_PLANNER]: 'bg-green-100 text-green-800',
          [ToolSource.AI_GENERATED]: 'bg-purple-100 text-purple-800',
          [ToolSource.MANUAL]: 'bg-gray-100 text-gray-800',
        };

        // If multiple sources, show them as separate badges
        if (source.includes(', ')) {
          const sources = source.split(', ');
          return (
            <div className="flex flex-wrap gap-1">
              {sources.map((src, idx) => (
                <span key={idx} className={`inline-flex px-1.5 py-0.5 text-xs font-medium rounded ${
                  colorMap[src] || 'bg-gray-100 text-gray-800'
                }`}>
                  {src}
                </span>
              ))}
            </div>
          );
        }

        return (
          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
            colorMap[source] || 'bg-gray-100 text-gray-800'
          }`}>
            {source}
          </span>
        );
      },
    },
  ];

  const copyToClipboard = async (format: 'plain' | 'csv' | 'json' = 'plain', keywords: Keyword[] = keywordList.keywords) => {
    try {
      let textToCopy = '';

      switch (format) {
        case 'plain':
          textToCopy = keywords.map(k => k.text).join('\n');
          break;
        case 'csv':
          textToCopy = 'Keyword,Search Volume,Difficulty,Competition,CPC,Source\n' +
            keywords.map(k =>
              `"${k.text}","${k.search_volume || ''}","${k.difficulty || ''}","${getCompetition(k)}","${getCPC(k)}","${getToolSource(k)}"`
            ).join('\n');
          break;
        case 'json':
          textToCopy = JSON.stringify(keywords.map(k => ({
            text: k.text,
            searchVolume: k.search_volume,
            difficulty: k.difficulty,
            competition: getCompetition(k),
            cpc: getCPC(k),
            source: getToolSource(k),
            region: k.region
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

  const handleSelectionChange = (keywords: Keyword[]) => {
    setSelectedKeywords(keywords);
    if (onKeywordsSelected) {
      onKeywordsSelected(keywords);
    }
  };

  const stats = useMemo(() => {
    const keywords = keywordList.keywords;
    const withVolume = keywords.filter(k => k.search_volume !== null && k.search_volume !== undefined);
    const withDifficulty = keywords.filter(k => k.difficulty !== null && k.difficulty !== undefined);

    return {
      total: keywords.length,
      avgVolume: withVolume.length > 0
        ? Math.round(withVolume.reduce((sum, k) => sum + (k.search_volume || 0), 0) / withVolume.length)
        : null,
      avgDifficulty: withDifficulty.length > 0
        ? Math.round(withDifficulty.reduce((sum, k) => sum + (k.difficulty || 0), 0) / withDifficulty.length)
        : null,
    };
  }, [keywordList.keywords]);

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{keywordList.name}</h3>
            <div className="mt-1 text-sm text-gray-500 space-y-1">
              <p>Generated: {formatDate(keywordList.generated_at)}</p>
              {keywordList.region && (
                <p>Region: {keywordList.region}</p>
              )}
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
            </div>
          </div>

          {showActions && (
            <div className="flex space-x-2">
              {/* View Toggle */}
              {onViewModeChange && (
                <div className="flex bg-gray-100 rounded-md p-1">
                  <button
                    onClick={() => onViewModeChange('cards')}
                    className="px-2 py-1 text-xs rounded text-gray-600 hover:text-gray-900"
                  >
                    Cards
                  </button>
                  <button
                    onClick={() => onViewModeChange('table')}
                    className="px-2 py-1 text-xs rounded bg-white text-gray-900 shadow-sm"
                  >
                    Table
                  </button>
                </div>
              )}

              {/* Copy Actions */}
              <div className="relative group">
                <button
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  {copySuccess ? 'Copied!' : 'Copy'}
                </button>
                <div className="absolute right-0 mt-1 w-40 bg-white rounded-md shadow-lg border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                  <button
                    onClick={() => copyToClipboard('plain')}
                    className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    All - Plain Text
                  </button>
                  <button
                    onClick={() => copyToClipboard('csv')}
                    className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    All - CSV
                  </button>
                  <button
                    onClick={() => copyToClipboard('json')}
                    className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    All - JSON
                  </button>
                  {selectedKeywords.length > 0 && (
                    <>
                      <hr className="my-1" />
                      <button
                        onClick={() => copyToClipboard('plain', selectedKeywords)}
                        className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        Selected - Plain
                      </button>
                      <button
                        onClick={() => copyToClipboard('csv', selectedKeywords)}
                        className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        Selected - CSV
                      </button>
                    </>
                  )}
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

        {/* Selection Info */}
        {selectable && selectedKeywords.length > 0 && (
          <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">
              {selectedKeywords.length} keyword{selectedKeywords.length === 1 ? '' : 's'} selected
            </p>
          </div>
        )}
      </div>

      {/* Data Table */}
      <DataTable
        data={keywordList.keywords}
        columns={columns}
        selectable={selectable}
        selectedItems={selectedKeywords}
        onSelectionChange={handleSelectionChange}
        getItemId={(keyword) => keyword.id}
        pagination={{
          pageSize,
          currentPage,
          onPageChange: setCurrentPage,
        }}
        emptyMessage="No keywords found in this list"
      />

      {/* Footer with Stats */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Total Keywords: {stats.total}</span>
          <div className="flex space-x-4">
            <span>
              Avg. Volume: {stats.avgVolume ? stats.avgVolume.toLocaleString() : 'N/A'}
            </span>
            <span>
              Avg. Difficulty: {stats.avgDifficulty || 'N/A'}
            </span>
          </div>
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