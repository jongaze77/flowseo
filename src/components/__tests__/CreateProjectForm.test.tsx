import { jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateProjectForm from '../CreateProjectForm';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as jest.MockedFunction<typeof fetch>;

describe('CreateProjectForm', () => {
  const mockOnProjectCreated = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render initial collapsed state', () => {
    render(<CreateProjectForm onProjectCreated={mockOnProjectCreated} />);

    expect(screen.getByText('Create New Project')).toBeInTheDocument();
    expect(screen.getByText('Start organizing your keyword research')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Project' })).toBeInTheDocument();

    // Form should not be visible initially
    expect(screen.queryByLabelText('Project Name *')).not.toBeInTheDocument();
  });

  it('should expand form when New Project button is clicked', async () => {
    const user = userEvent.setup();
    render(<CreateProjectForm onProjectCreated={mockOnProjectCreated} />);

    const newProjectButton = screen.getByRole('button', { name: 'New Project' });
    await user.click(newProjectButton);

    expect(screen.getByLabelText('Project Name *')).toBeInTheDocument();
    expect(screen.getByLabelText('Domain (Optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Project' })).toBeInTheDocument();
  });

  it('should successfully create a project', async () => {
    const user = userEvent.setup();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'project-123',
        name: 'Test Project',
        domain: 'example.com',
        tenantId: 'tenant-123',
      }),
    });

    render(<CreateProjectForm onProjectCreated={mockOnProjectCreated} />);

    // Open form
    await user.click(screen.getByRole('button', { name: 'New Project' }));

    // Fill form
    await user.type(screen.getByLabelText('Project Name *'), 'Test Project');
    await user.type(screen.getByLabelText('Domain (Optional)'), 'example.com');

    // Submit
    await user.click(screen.getByRole('button', { name: 'Create Project' }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test Project',
          domain: 'example.com',
        }),
      });
    });

    await waitFor(() => {
      expect(mockOnProjectCreated).toHaveBeenCalled();
    });
  });

  it('should show validation errors for invalid input', async () => {
    const user = userEvent.setup();
    render(<CreateProjectForm onProjectCreated={mockOnProjectCreated} />);

    // Open form
    await user.click(screen.getByRole('button', { name: 'New Project' }));

    // Try to submit with empty name
    await user.click(screen.getByRole('button', { name: 'Create Project' }));

    await waitFor(() => {
      expect(screen.getByText('Project name is required')).toBeInTheDocument();
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should handle API errors', async () => {
    const user = userEvent.setup();

    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: 'Project name already exists in your organization',
      }),
    });

    render(<CreateProjectForm onProjectCreated={mockOnProjectCreated} />);

    // Open form and fill
    await user.click(screen.getByRole('button', { name: 'New Project' }));
    await user.type(screen.getByLabelText('Project Name *'), 'Duplicate Project');
    await user.click(screen.getByRole('button', { name: 'Create Project' }));

    await waitFor(() => {
      expect(screen.getByText('Project name already exists in your organization')).toBeInTheDocument();
    });

    expect(mockOnProjectCreated).not.toHaveBeenCalled();
  });

  it('should reset form when canceled', async () => {
    const user = userEvent.setup();
    render(<CreateProjectForm onProjectCreated={mockOnProjectCreated} />);

    // Open form and fill
    await user.click(screen.getByRole('button', { name: 'New Project' }));
    await user.type(screen.getByLabelText('Project Name *'), 'Test Project');

    // Cancel
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // Form should be collapsed
    expect(screen.queryByLabelText('Project Name *')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Project' })).toBeInTheDocument();
  });

  it('should clear field errors when user starts typing', async () => {
    const user = userEvent.setup();
    render(<CreateProjectForm onProjectCreated={mockOnProjectCreated} />);

    // Open form
    await user.click(screen.getByRole('button', { name: 'New Project' }));

    // Submit to trigger validation error
    await user.click(screen.getByRole('button', { name: 'Create Project' }));

    await waitFor(() => {
      expect(screen.getByText('Project name is required')).toBeInTheDocument();
    });

    // Start typing to clear error
    await user.type(screen.getByLabelText('Project Name *'), 'Test');

    await waitFor(() => {
      expect(screen.queryByText('Project name is required')).not.toBeInTheDocument();
    });
  });
});