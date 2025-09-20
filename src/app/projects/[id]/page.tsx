'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '../../../hooks/useRequireAuth';

interface Project {
  id: string;
  name: string;
  default_region: string;
  created_at: string;
}

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
  created_at: string;
}

interface KeywordList {
  id: string;
  name: string;
  region: string;
  keywords: Array<{
    id: string;
    text: string;
    search_volume: number | null;
    difficulty: number | null;
  }>;
  generated_at: string;
}

export default function ProjectOverview({ params }: { params: Promise<{ id: string }> }) {
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [keywordLists, setKeywordLists] = useState<KeywordList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const { user } = useRequireAuth();

  useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  useEffect(() => {
    if (!resolvedParams?.id || !user) return;

    const fetchProjectData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch project details
        const projectResponse = await fetch(`/api/v1/projects/${resolvedParams.id}`);
        if (!projectResponse.ok) {
          if (projectResponse.status === 401) {
            throw new Error('Authentication expired. Please log in again.');
          }
          throw new Error('Failed to fetch project');
        }
        const projectData = await projectResponse.json();
        setProject(projectData.project);

        // Fetch pages
        const pagesResponse = await fetch(`/api/v1/projects/${resolvedParams.id}/pages`);
        if (!pagesResponse.ok) {
          if (pagesResponse.status === 401) {
            throw new Error('Authentication expired. Please log in again.');
          }
          throw new Error('Failed to fetch pages');
        }
        const pagesData = await pagesResponse.json();
        setPages(pagesData.data || []);

        // Fetch keyword lists
        const keywordsResponse = await fetch(`/api/v1/projects/${resolvedParams.id}/keywords`);
        if (!keywordsResponse.ok) {
          if (keywordsResponse.status === 401) {
            throw new Error('Authentication expired. Please log in again.');
          }
          throw new Error('Failed to fetch keywords');
        }
        const keywordsData = await keywordsResponse.json();
        setKeywordLists(keywordsData.data || []);

      } catch (err) {
        console.error('Error fetching project data:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);

        // Redirect to login if authentication expired
        if (errorMessage.includes('Authentication expired')) {
          setTimeout(() => {
            router.push('/login');
          }, 2000);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProjectData();
  }, [resolvedParams?.id, user, router]);

  const getRegionStats = () => {
    const regions = ['UK', 'US', 'AU', 'CA'];
    return regions.map(region => {
      const analyzedPages = pages.filter(page => {
        const status = page.analysis_status?.[region];
        return status?.analyzed;
      }).length;

      const totalKeywords = keywordLists
        .filter(list => list.region === region)
        .reduce((sum, list) => sum + list.keywords.length, 0);

      return {
        region,
        analyzedPages,
        totalPages: pages.length,
        totalKeywords,
        completionPercentage: pages.length > 0 ? Math.round((analyzedPages / pages.length) * 100) : 0
      };
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading project overview...</p>
        </div>
      </div>
    );
  }

  if (error) {
    const isAuthError = error.includes('Authentication expired');
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-lg mb-4">Error: {error}</div>
          {isAuthError && (
            <p className="text-gray-600 mb-4">You will be redirected to login in 2 seconds...</p>
          )}
          <div className="space-x-3">
            {isAuthError ? (
              <button
                onClick={() => router.push('/login')}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
              >
                Login Now
              </button>
            ) : (
              <button
                onClick={() => router.push('/dashboard')}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
              >
                Back to Dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-600 text-lg mb-4">Project not found</div>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const regionStats = getRegionStats();
  const totalKeywords = keywordLists.reduce((sum, list) => sum + list.keywords.length, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
              <p className="text-gray-600 mt-2">
                Default Region: {project.default_region} • Created: {new Date(project.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => router.push(`/projects/${project.id}/content`)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Manage Content
              </button>
              <button
                onClick={() => router.push(`/projects/${project.id}/keywords`)}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
              >
                Generate Keywords
              </button>
            </div>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-2xl font-semibold text-gray-900">{pages.length}</p>
                <p className="text-gray-600">Total Pages</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a.997.997 0 01-1.414 0l-7-7A1.997 1.997 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-2xl font-semibold text-gray-900">{totalKeywords}</p>
                <p className="text-gray-600">Total Keywords</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-2xl font-semibold text-gray-900">{keywordLists.length}</p>
                <p className="text-gray-600">Keyword Lists</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-2xl font-semibold text-gray-900">{project.default_region}</p>
                <p className="text-gray-600">Default Region</p>
              </div>
            </div>
          </div>
        </div>

        {/* Regional Analysis Progress */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Regional Analysis Progress</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {regionStats.map((stat) => (
              <div key={stat.region} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">{stat.region}</h4>
                  <span className="text-sm text-gray-600">{stat.completionPercentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                  <div
                    className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${stat.completionPercentage}%` }}
                  ></div>
                </div>
                <div className="text-sm text-gray-600">
                  <p>{stat.analyzedPages} / {stat.totalPages} pages analyzed</p>
                  <p>{stat.totalKeywords} keywords generated</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Pages */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Pages</h3>
            {pages.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No pages added yet</p>
                <button
                  onClick={() => router.push(`/projects/${project.id}/content`)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                >
                  Add Your First Page
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {pages.slice(0, 5).map((page) => (
                  <div key={page.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900">{page.title || 'Untitled Page'}</h4>
                      <p className="text-sm text-gray-500">{page.url || 'No URL'}</p>
                    </div>
                    <div className="text-sm text-gray-600">
                      {new Date(page.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
                {pages.length > 5 && (
                  <button
                    onClick={() => router.push(`/projects/${project.id}/content`)}
                    className="text-purple-600 hover:text-purple-700 text-sm font-medium"
                  >
                    View all {pages.length} pages →
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Recent Keyword Lists */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Keyword Lists</h3>
            {keywordLists.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No keywords generated yet</p>
                <button
                  onClick={() => router.push(`/projects/${project.id}/keywords`)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                >
                  Generate Keywords
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {keywordLists.slice(0, 5).map((list) => (
                  <div key={list.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900">{list.name}</h4>
                      <p className="text-sm text-gray-500">{list.region} • {list.keywords.length} keywords</p>
                    </div>
                    <div className="text-sm text-gray-600">
                      {new Date(list.generated_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
                {keywordLists.length > 5 && (
                  <button
                    onClick={() => router.push(`/projects/${project.id}/keywords`)}
                    className="text-purple-600 hover:text-purple-700 text-sm font-medium"
                  >
                    View all {keywordLists.length} lists →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}