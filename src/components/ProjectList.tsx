'use client';

import { useState } from 'react';
import ConfirmationModal from './ui/ConfirmationModal';
import EditProjectForm from './EditProjectForm';

interface Project {
  id: string;
  name: string;
  domain: string | null;
  tenantId: string;
  tenantName: string;
  createdAt: string;
  updatedAt: string;
}

interface ProjectListProps {
  projects: Project[];
  onProjectUpdated: () => void;
  onProjectDeleted: () => void;
  isLoading?: boolean;
}

export default function ProjectList({
  projects,
  onProjectUpdated,
  onProjectDeleted,
  isLoading = false
}: ProjectListProps) {
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const handleDeleteProject = async (projectId: string) => {
    if (deletingProjectId) return; // Prevent multiple requests

    setDeletingProjectId(projectId);
    try {
      const response = await fetch(`/api/v1/projects/${projectId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete project');
      }

      setShowDeleteDialog(null);
      onProjectDeleted();
    } catch (error) {
      console.error('Error deleting project:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete project');
    } finally {
      setDeletingProjectId(null);
    }
  };

  const confirmDelete = (projectId: string) => {
    setShowDeleteDialog(projectId);
  };

  const cancelDelete = () => {
    setShowDeleteDialog(null);
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
  };

  const handleEditCancel = () => {
    setEditingProject(null);
  };

  const handleEditSuccess = () => {
    setEditingProject(null);
    onProjectUpdated();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const projectToDelete = projects.find(p => p.id === showDeleteDialog);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Projects</h3>
        </div>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex-1 space-y-2">
                  <div className="w-32 h-4 bg-gray-200 rounded"></div>
                  <div className="w-24 h-3 bg-gray-200 rounded"></div>
                </div>
                <div className="flex space-x-2">
                  <div className="w-12 h-8 bg-gray-200 rounded"></div>
                  <div className="w-16 h-8 bg-gray-200 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Projects</h3>
          <p className="text-sm text-gray-600 mt-1">
            {projects.length} {projects.length === 1 ? 'project' : 'projects'}
          </p>
        </div>

        {projects.length === 0 ? (
          <div className="p-6 text-center">
            <div className="text-gray-400 text-sm">No projects yet</div>
            <p className="text-xs text-gray-500 mt-1">Create your first project to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {projects.map((project) => (
              <div key={project.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <span className="text-blue-600 font-bold text-sm">
                          {project.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {project.name}
                        </h4>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          {project.domain && (
                            <span className="truncate">{project.domain}</span>
                          )}
                          <span>Created {formatDate(project.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <a
                      href={`/projects/${project.id}/content`}
                      className="text-green-600 hover:text-green-700 text-sm font-medium px-2 py-1 rounded"
                    >
                      Content
                    </a>
                    <button
                      onClick={() => handleEditProject(project)}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium px-2 py-1 rounded"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => confirmDelete(project.id)}
                      disabled={deletingProjectId === project.id}
                      className="text-red-600 hover:text-red-700 text-sm font-medium px-2 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deletingProjectId === project.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!showDeleteDialog}
        title="Delete Project"
        message={
          <>
            Are you sure you want to delete{' '}
            <span className="font-medium">{projectToDelete?.name}</span>?
            <br />
            <br />
            This action cannot be undone and will permanently remove the project and all associated data.
          </>
        }
        confirmLabel="Delete Project"
        cancelLabel="Cancel"
        isConfirming={deletingProjectId === showDeleteDialog}
        onConfirm={() => {
          if (showDeleteDialog) {
            handleDeleteProject(showDeleteDialog);
          }
        }}
        onCancel={cancelDelete}
        variant="danger"
      />

      {/* Edit Project Modal */}
      {editingProject && (
        <EditProjectForm
          project={editingProject}
          isOpen={!!editingProject}
          onProjectUpdated={handleEditSuccess}
          onCancel={handleEditCancel}
        />
      )}
    </>
  );
}