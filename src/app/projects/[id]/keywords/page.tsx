'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '../../../../components/layout/AppLayout';
import KeywordGenerationTrigger from '../../../../components/KeywordGenerationTrigger';
import KeywordList from '../../../../components/KeywordList';
import ErrorModal from '../../../../components/ui/ErrorModal';

interface Project {
  id: string;
  name: string;
  domain: string | null;
  tenantId: string;
  tenantName: string;
  createdAt: string;
  updatedAt: string;
}

interface Page {
  id: string;
  url: string | null;
  title: string | null;
  content: string;
  createdAt: string;
}

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

interface ProjectKeywordsPageProps {
  params: Promise<{ id: string }>;
}

export default function ProjectKeywordsPage({ params }: ProjectKeywordsPageProps) {
  const router = useRouter();
  const [projectId, setProjectId] = useState<string>('');
  const [project, setProject] = useState<Project | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [keywordLists, setKeywordLists] = useState<KeywordListData[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string>('');

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isPagesLoading, setIsPagesLoading] = useState(false);
  const [isKeywordListsLoading, setIsKeywordListsLoading] = useState(false);

  // Error states
  const [error, setError] = useState<string | null>(null);
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title: string; message: string }>({
    isOpen: false,
    title: '',
    message: ''
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  // Resolve params
  useEffect(() => {
    params.then(({ id }) => setProjectId(id));
  }, [params]);

  // Fetch project details
  const fetchProject = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/v1/projects/${id}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        if (response.status === 404) {
          setError('Project not found');
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.project) {
        setProject(data.project);
      } else {
        setError('Failed to load project');
      }
    } catch (error) {
      console.error('Project fetch error:', error);
      setError('Failed to load project');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  // Fetch pages for the project
  const fetchPages = useCallback(async (id: string) => {
    try {
      setIsPagesLoading(true);

      const response = await fetch(`/api/v1/projects/${id}/pages`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.pages) {
          setPages(data.pages);
          // Auto-select first page if none selected
          if (data.pages.length > 0 && !selectedPageId) {
            setSelectedPageId(data.pages[0].id);
          }
        }
      }
    } catch (error) {
      console.error('Pages fetch error:', error);
    } finally {
      setIsPagesLoading(false);
    }
  }, [selectedPageId]);

  // Fetch keyword lists for the project
  const fetchKeywordLists = useCallback(async (id: string, page = 1, search = '') => {
    try {
      setIsKeywordListsLoading(true);

      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        sortBy: 'created_at',
        sortOrder: 'desc',
      });

      if (search.trim()) {
        queryParams.append('search', search.trim());
      }

      const response = await fetch(`/api/v1/projects/${id}/keywords?${queryParams}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setKeywordLists(data.data || []);
          setTotalPages(data.pagination?.totalPages || 1);
          setCurrentPage(data.pagination?.page || 1);
        }
      }
    } catch (error) {
      console.error('Keyword lists fetch error:', error);
    } finally {
      setIsKeywordListsLoading(false);
    }
  }, []);

  // Handle keyword generation completion
  const handleKeywordsGenerated = useCallback((_keywordListId: string) => {
    // Refresh keyword lists to show the new one
    if (projectId) {
      fetchKeywordLists(projectId, currentPage, searchTerm);
    }
  }, [projectId, currentPage, searchTerm, fetchKeywordLists]);

  // Handle keyword list deletion
  const handleKeywordListDelete = useCallback(async (keywordListId: string) => {
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/keywords`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keywordListId }),
      });

      if (response.ok) {
        // Refresh keyword lists
        await fetchKeywordLists(projectId, currentPage, searchTerm);
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete keyword list');
      }
    } catch (error) {
      throw error; // Re-throw to be handled by KeywordList component
    }
  }, [projectId, currentPage, searchTerm, fetchKeywordLists]);

  // Handle search
  const handleSearch = useCallback((search: string) => {
    setSearchTerm(search);
    setCurrentPage(1);
    if (projectId) {
      fetchKeywordLists(projectId, 1, search);
    }
  }, [projectId, fetchKeywordLists]);

  // Handle pagination
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    if (projectId) {
      fetchKeywordLists(projectId, page, searchTerm);
    }
  }, [projectId, searchTerm, fetchKeywordLists]);

  // Fetch data when projectId changes
  useEffect(() => {
    if (projectId) {
      fetchProject(projectId);
      fetchPages(projectId);
      fetchKeywordLists(projectId);
    }
  }, [projectId, fetchProject, fetchPages, fetchKeywordLists]);


  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center min-h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto text-center py-12">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Error Loading Project</h2>
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={() => router.push('/projects')}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Back to Projects
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const selectedPage = pages.find(p => p.id === selectedPageId);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Keyword Generation</h1>
              <p className="text-gray-600 mt-1">
                Generate and manage AI-powered keywords for{' '}
                <span className="font-medium">{project?.name}</span>
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => router.push(`/projects/${projectId}/content`)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                View Content
              </button>
              <button
                onClick={() => router.push(`/projects/${projectId}`)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Project Overview
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Keyword Generation */}
          <div className="lg:col-span-1">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Generate Keywords</h2>

              {/* Page Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Page to Analyze
                </label>
                {isPagesLoading ? (
                  <div className="text-sm text-gray-500">Loading pages...</div>
                ) : pages.length === 0 ? (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-yellow-800">
                      No pages found. Please{' '}
                      <button
                        onClick={() => router.push(`/projects/${projectId}/content`)}
                        className="underline hover:no-underline"
                      >
                        add content
                      </button>{' '}
                      first.
                    </p>
                  </div>
                ) : (
                  <select
                    value={selectedPageId}
                    onChange={(e) => setSelectedPageId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a page</option>
                    {pages.map(page => (
                      <option key={page.id} value={page.id}>
                        {page.title || 'Untitled Page'} {page.url && `(${page.url})`}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Keyword Generation Form */}
              {selectedPageId && selectedPage && (
                <KeywordGenerationTrigger
                  projectId={projectId}
                  pageId={selectedPageId}
                  pageTitle={selectedPage.title || undefined}
                  onKeywordsGenerated={handleKeywordsGenerated}
                  disabled={!selectedPageId}
                />
              )}
            </div>
          </div>

          {/* Right Column: Keyword Lists */}
          <div className="lg:col-span-2">
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Generated Keywords</h2>

                {/* Search */}
                <div className="w-64">
                  <input
                    type="text"
                    placeholder="Search keyword lists..."
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Keyword Lists */}
              {isKeywordListsLoading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : keywordLists.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                  <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Keywords Generated Yet</h3>
                  <p className="text-gray-600 mb-4">
                    Select a page and generate your first set of AI-powered keywords
                  </p>
                  {pages.length === 0 && (
                    <button
                      onClick={() => router.push(`/projects/${projectId}/content`)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Add Content First
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {keywordLists.map(keywordList => (
                    <KeywordList
                      key={keywordList.id}
                      keywordList={keywordList}
                      onDelete={handleKeywordListDelete}
                      showActions={true}
                    />
                  ))}

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex justify-center space-x-2 mt-6">
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-3 py-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Previous
                      </button>

                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <button
                          key={page}
                          onClick={() => handlePageChange(page)}
                          className={`px-3 py-2 border rounded-md ${
                            page === currentPage
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      ))}

                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ isOpen: false, title: '', message: '' })}
        title={errorModal.title}
        message={errorModal.message}
      />
    </AppLayout>
  );
}