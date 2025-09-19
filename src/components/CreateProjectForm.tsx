'use client';

import { useState, useEffect } from 'react';
import { z } from 'zod';

// Form validation schema
const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(255, 'Project name must be less than 255 characters').trim(),
  domain: z.string().max(255, 'Domain must be less than 255 characters').trim().optional().or(z.literal('')),
});

type CreateProjectData = z.infer<typeof createProjectSchema>;

interface CreateProjectFormProps {
  onProjectCreated: () => void;
}

export default function CreateProjectForm({ onProjectCreated }: CreateProjectFormProps) {
  const [formData, setFormData] = useState<CreateProjectData>({
    name: '',
    domain: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof CreateProjectData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Reset form whenever the form is shown
  useEffect(() => {
    if (showForm) {
      setFormData({ name: '', domain: '' });
      setErrors({});
      setSubmitError(null);
    }
  }, [showForm]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error for this field when user starts typing
    if (errors[name as keyof CreateProjectData]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  const validateForm = (): boolean => {
    const result = createProjectSchema.safeParse(formData);

    if (!result.success) {
      const fieldErrors: Partial<Record<keyof CreateProjectData, string>> = {};
      result.error.issues.forEach(error => {
        if (error.path.length > 0) {
          const field = error.path[0] as keyof CreateProjectData;
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

      const response = await fetch('/api/v1/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create project');
      }

      // Reset form and close
      setFormData({ name: '', domain: '' });
      setShowForm(false);
      onProjectCreated();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setFormData({ name: '', domain: '' });
    setErrors({});
    setSubmitError(null);
    setShowForm(false);
  };

  if (!showForm) {
    return (
      <div className="bg-white rounded-lg shadow border">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Create New Project</h3>
              <p className="text-sm text-gray-600 mt-1">Start organizing your keyword research</p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
            >
              New Project
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow border">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Create New Project</h3>
      </div>

      <form
        key={showForm ? 'form-visible' : 'form-hidden'}
        onSubmit={handleSubmit}
        className="p-6 space-y-4"
        autoComplete="off"
      >
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Project Name *
          </label>
          <input
            type="text"
            id="name"
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
          <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-1">
            Domain (Optional)
          </label>
          <input
            type="text"
            id="domain"
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
          <p className="mt-1 text-xs text-gray-500">
            Associate this project with a specific domain for better organization
          </p>
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
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium"
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
            {isSubmitting ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  );
}