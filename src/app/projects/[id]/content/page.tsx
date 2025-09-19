'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '../../../../components/layout/AppLayout';
import ContentIngestionForm from '../../../../components/ContentIngestionForm';

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

interface ProjectContentPageProps {
  params: Promise<{ id: string }>;
}

export default function ProjectContentPage({ params }: ProjectContentPageProps) {
  const router = useRouter();
  const [projectId, setProjectId] = useState<string>('');
  const [project, setProject] = useState<Project | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPagesLoading, setIsPagesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        method: 'GET',
        credentials: 'include',
      });

      if (response.status === 404) {
        router.push('/projects');
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch project');
      }

      const projectData: Project = await response.json();
      setProject(projectData);
    } catch (error) {
      console.error('Error fetching project:', error);
      setError(error instanceof Error ? error.message : 'Failed to load project');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  // Fetch pages for project
  const fetchPages = useCallback(async (id: string) => {
    try {
      setIsPagesLoading(true);

      const response = await fetch(`/api/v1/projects/${id}/pages`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch pages');
      }

      const data = await response.json();
      setPages(data.pages || []);
    } catch (error) {
      console.error('Error fetching pages:', error);
      // Don't set error state for pages loading failure - just log it
    } finally {
      setIsPagesLoading(false);
    }
  }, []);

  // Load project when projectId changes
  useEffect(() => {
    if (projectId) {
      fetchProject(projectId);
      fetchPages(projectId);
    }
  }, [projectId, fetchProject, fetchPages]);

  const handleContentSaved = () => {
    // Refresh pages list when new content is saved
    if (projectId) {
      fetchPages(projectId);
    }
  };

  const handleBackToProjects = () => {
    router.push('/projects');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const truncateContent = (content: string, maxLength: number = 150) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !project) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="text-sm text-red-600">
                <strong>Error:</strong> {error || 'Project not found'}
              </div>
            </div>
          </div>
          <button
            onClick={handleBackToProjects}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            ← Back to Projects
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="border-b border-gray-200 pb-6">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={handleBackToProjects}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-2 inline-flex items-center"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
                Back to Projects
              </button>
              <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
              <p className="text-gray-600 mt-2">
                Add and manage content for keyword research and SEO analysis
              </p>
              {project.domain && (
                <p className="text-sm text-gray-500 mt-1">Domain: {project.domain}</p>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => router.push(`/projects/${projectId}/keywords`)}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Generate Keywords</span>
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

        {/* Content Ingestion Form */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ContentIngestionForm
              projectId={projectId}
              onContentSaved={handleContentSaved}
            />
          </div>

          {/* Existing Content Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-gray-200 rounded-lg">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Existing Content</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {pages.length} {pages.length === 1 ? 'page' : 'pages'}
                </p>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {isPagesLoading ? (
                  <div className="p-4">
                    <div className="animate-pulse space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="space-y-2">
                          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : pages.length === 0 ? (
                  <div className="p-4 text-center">
                    <div className="text-gray-400 text-sm">No content yet</div>
                    <p className="text-xs text-gray-500 mt-1">Add your first content to get started</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {pages.map((page) => (
                      <div key={page.id} className="p-4">
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <h4 className="text-sm font-medium text-gray-900 line-clamp-2">
                              {page.title || 'Untitled Content'}
                            </h4>
                          </div>

                          {page.url && (
                            <p className="text-xs text-blue-600 truncate">{page.url}</p>
                          )}

                          <p className="text-xs text-gray-600 line-clamp-3">
                            {truncateContent(page.content)}
                          </p>

                          <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-500">
                              Added {formatDate(page.createdAt)}
                            </p>
                            <button
                              onClick={() => router.push(`/projects/${projectId}/keywords`)}
                              className="px-3 py-1 text-xs bg-purple-100 text-purple-700 hover:bg-purple-200 hover:text-purple-900 rounded border border-purple-300 cursor-pointer transition-colors"
                            >
                              Generate Keywords →
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}