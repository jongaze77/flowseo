'use client';

import { useState, useEffect } from 'react';
import AppLayout from '../../components/layout/AppLayout';
import CreateProjectForm from '../../components/CreateProjectForm';
import ProjectList from '../../components/ProjectList';

interface Project {
  id: string;
  name: string;
  domain: string | null;
  default_region: 'US' | 'UK' | 'AU' | 'CA';
  tenantId: string;
  tenantName: string;
  createdAt: string;
  updatedAt: string;
}

interface ProjectsResponse {
  projects: Project[];
  count: number;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/v1/projects', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch projects');
      }

      const data: ProjectsResponse = await response.json();
      setProjects(data.projects);
    } catch (error) {
      console.error('Error fetching projects:', error);
      setError(error instanceof Error ? error.message : 'Failed to load projects');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleProjectCreated = () => {
    fetchProjects();
  };

  const handleProjectUpdated = () => {
    fetchProjects();
  };

  const handleProjectDeleted = () => {
    fetchProjects();
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="border-b border-gray-200 pb-6">
          <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600 mt-2">
            Organize your keyword research and SEO work into projects
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="text-sm text-red-600">
                <strong>Error:</strong> {error}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          <CreateProjectForm onProjectCreated={handleProjectCreated} />

          <ProjectList
            projects={projects}
            onProjectUpdated={handleProjectUpdated}
            onProjectDeleted={handleProjectDeleted}
            isLoading={isLoading}
          />
        </div>
      </div>
    </AppLayout>
  );
}