'use client';

import { useState, useEffect } from 'react';
import { z } from 'zod';

// Form validation schema
const editProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(255, 'Project name must be less than 255 characters').trim(),
  domain: z.string().max(255, 'Domain must be less than 255 characters').trim().optional().or(z.literal('')),
});

type EditProjectData = z.infer<typeof editProjectSchema>;

interface Project {
  id: string;
  name: string;
  domain: string | null;
  tenantId: string;
  tenantName: string;
  createdAt: string;
  updatedAt: string;
}

interface EditProjectFormProps {
  project: Project;
  isOpen: boolean;
  onProjectUpdated: () => void;
  onCancel: () => void;
}

export default function EditProjectForm({ project, isOpen, onProjectUpdated, onCancel }: EditProjectFormProps) {
  const [formData, setFormData] = useState<EditProjectData>({
    name: project.name,
    domain: project.domain || '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof EditProjectData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Reset form whenever the form is opened with a new project
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: project.name,
        domain: project.domain || '',
      });
      setErrors({});
      setSubmitError(null);
    }
  }, [isOpen, project]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error for this field when user starts typing
    if (errors[name as keyof EditProjectData]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  const validateForm = (): boolean => {
    const result = editProjectSchema.safeParse(formData);

    if (!result.success) {
      const fieldErrors: Partial<Record<keyof EditProjectData, string>> = {};
      result.error.issues.forEach(error => {
        if (error.path.length > 0) {
          const field = error.path[0] as keyof EditProjectData;
          fieldErrors[field] = error.message;
        }
      });
      setErrors(fieldErrors);
      return false;
    }

    setErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const requestData = {
        name: formData.name,
        domain: formData.domain || null,
      };

      const response = await fetch(`/api/v1/projects/${project.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update project');
      }

      // Notify parent component of success
      onProjectUpdated();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: project.name,
      domain: project.domain || '',
    });
    setErrors({});
    setSubmitError(null);
    onCancel();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Edit Project</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-1">
              Project Name *
            </label>
            <input
              type="text"
              id="edit-name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter project name"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name}</p>
            )}
          </div>

          <div>
            <label htmlFor="edit-domain" className="block text-sm font-medium text-gray-700 mb-1">
              Domain (Optional)
            </label>
            <input
              type="text"
              id="edit-domain"
              name="domain"
              value={formData.domain}
              onChange={handleInputChange}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.domain ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="example.com"
            />
            {errors.domain && (
              <p className="mt-1 text-sm text-red-600">{errors.domain}</p>
            )}
          </div>

          {submitError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{submitError}</p>
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex-1 py-2 px-4 rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                isSubmitting
                  ? 'bg-gray-400 cursor-not-allowed text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isSubmitting ? 'Updating...' : 'Update Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}