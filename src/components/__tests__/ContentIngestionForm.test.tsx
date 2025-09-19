import { jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ContentIngestionForm from '../ContentIngestionForm';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as jest.MockedFunction<typeof fetch>;

describe('ContentIngestionForm', () => {
  const mockOnContentSaved = jest.fn();
  const mockProjectId = 'project-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render with URL tab active by default', () => {
    render(
      <ContentIngestionForm
        projectId={mockProjectId}
        onContentSaved={mockOnContentSaved}
      />
    );

    expect(screen.getByText('Add Content to Project')).toBeInTheDocument();
    expect(screen.getByText('Scrape URL')).toBeInTheDocument();
    expect(screen.getByText('Paste HTML')).toBeInTheDocument();
    expect(screen.getByText('Paste Markdown')).toBeInTheDocument();

    // URL tab should be active
    expect(screen.getByLabelText('Website URL')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('https://example.com')).toBeInTheDocument();
  });

  it('should switch to HTML tab when clicked', async () => {
    const user = userEvent.setup();
    render(
      <ContentIngestionForm
        projectId={mockProjectId}
        onContentSaved={mockOnContentSaved}
      />
    );

    const htmlTab = screen.getByText('Paste HTML');
    await user.click(htmlTab);

    expect(screen.getByLabelText('HTML Content')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/<html><body><h1>Your content here/)).toBeInTheDocument();
  });

  it('should switch to Markdown tab when clicked', async () => {
    const user = userEvent.setup();
    render(
      <ContentIngestionForm
        projectId={mockProjectId}
        onContentSaved={mockOnContentSaved}
      />
    );

    const markdownTab = screen.getByText('Paste Markdown');
    await user.click(markdownTab);

    expect(screen.getByLabelText('Markdown Content')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/# Your content here/)).toBeInTheDocument();
  });

  it('should validate required URL input', async () => {
    const user = userEvent.setup();
    render(
      <ContentIngestionForm
        projectId={mockProjectId}
        onContentSaved={mockOnContentSaved}
      />
    );

    const submitButton = screen.getByRole('button', { name: 'Process URL' });
    await user.click(submitButton);

    expect(screen.getByText('Please enter a valid URL (e.g., https://example.com)')).toBeInTheDocument();
  });

  it('should validate required content input for HTML tab', async () => {
    const user = userEvent.setup();
    render(
      <ContentIngestionForm
        projectId={mockProjectId}
        onContentSaved={mockOnContentSaved}
      />
    );

    // Switch to HTML tab
    const htmlTab = screen.getByText('Paste HTML');
    await user.click(htmlTab);

    const submitButton = screen.getByRole('button', { name: 'Process Content' });
    await user.click(submitButton);

    expect(screen.getByText('Content must be at least 10 characters')).toBeInTheDocument();
  });

  it('should successfully process URL content', async () => {
    const user = userEvent.setup();

    // Mock successful API response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'page-123',
        title: 'Test Page',
        content: 'This is the scraped content from the webpage.',
        url: 'https://example.com',
        projectId: mockProjectId,
      }),
    });

    render(
      <ContentIngestionForm
        projectId={mockProjectId}
        onContentSaved={mockOnContentSaved}
      />
    );

    const urlInput = screen.getByLabelText('Website URL');
    const submitButton = screen.getByRole('button', { name: 'Process URL' });

    await user.type(urlInput, 'https://example.com');
    await user.click(submitButton);

    // Should show processing state
    expect(screen.getByText('Processing...')).toBeInTheDocument();

    // Wait for preview to appear
    await waitFor(() => {
      expect(screen.getByText('Content Preview')).toBeInTheDocument();
    });

    expect(screen.getByText('Test Page')).toBeInTheDocument();
    expect(screen.getByText('This is the scraped content from the webpage.')).toBeInTheDocument();
    expect(screen.getByText('https://example.com')).toBeInTheDocument();
  });

  it('should successfully process HTML content', async () => {
    const user = userEvent.setup();

    // Mock successful API response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'page-456',
        title: 'HTML Page',
        content: 'This is the processed HTML content.',
        projectId: mockProjectId,
      }),
    });

    render(
      <ContentIngestionForm
        projectId={mockProjectId}
        onContentSaved={mockOnContentSaved}
      />
    );

    // Switch to HTML tab
    const htmlTab = screen.getByText('Paste HTML');
    await user.click(htmlTab);

    const contentTextarea = screen.getByLabelText('HTML Content');
    const submitButton = screen.getByRole('button', { name: 'Process Content' });

    const htmlContent = '<html><head><title>HTML Page</title></head><body><p>HTML content</p></body></html>';
    await user.type(contentTextarea, htmlContent);
    await user.click(submitButton);

    // Wait for preview to appear
    await waitFor(() => {
      expect(screen.getByText('Content Preview')).toBeInTheDocument();
    });

    expect(screen.getByText('HTML Page')).toBeInTheDocument();
    expect(screen.getByText('This is the processed HTML content.')).toBeInTheDocument();
  });

  it('should handle processing errors with custom error modal', async () => {
    const user = userEvent.setup();

    // Mock API error response
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: 'Failed to fetch content from URL',
      }),
    });

    render(
      <ContentIngestionForm
        projectId={mockProjectId}
        onContentSaved={mockOnContentSaved}
      />
    );

    const urlInput = screen.getByLabelText('Website URL');
    const submitButton = screen.getByRole('button', { name: 'Process URL' });

    await user.type(urlInput, 'https://invalid-url.com');
    await user.click(submitButton);

    // Wait for error modal to appear
    await waitFor(() => {
      expect(screen.getByText('Processing Failed')).toBeInTheDocument();
    });

    expect(screen.getByText('Failed to fetch content from URL')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('should allow custom title input', async () => {
    const user = userEvent.setup();

    render(
      <ContentIngestionForm
        projectId={mockProjectId}
        onContentSaved={mockOnContentSaved}
      />
    );

    const titleInput = screen.getByLabelText('Custom Title (Optional)');
    await user.type(titleInput, 'My Custom Title');

    expect(titleInput).toHaveValue('My Custom Title');
  });

  it('should reset form when switching tabs', async () => {
    const user = userEvent.setup();

    render(
      <ContentIngestionForm
        projectId={mockProjectId}
        onContentSaved={mockOnContentSaved}
      />
    );

    // Type in URL field
    const urlInput = screen.getByLabelText('Website URL');
    await user.type(urlInput, 'https://example.com');

    // Switch to HTML tab
    const htmlTab = screen.getByText('Paste HTML');
    await user.click(htmlTab);

    // Switch back to URL tab
    const urlTab = screen.getByText('Scrape URL');
    await user.click(urlTab);

    // URL field should be empty
    const newUrlInput = screen.getByLabelText('Website URL');
    expect(newUrlInput).toHaveValue('');
  });

  it('should clear field errors when user starts typing', async () => {
    const user = userEvent.setup();

    render(
      <ContentIngestionForm
        projectId={mockProjectId}
        onContentSaved={mockOnContentSaved}
      />
    );

    // Submit empty form to trigger validation error
    const submitButton = screen.getByRole('button', { name: 'Process URL' });
    await user.click(submitButton);

    expect(screen.getByText('Please enter a valid URL (e.g., https://example.com)')).toBeInTheDocument();

    // Start typing - error should disappear
    const urlInput = screen.getByLabelText('Website URL');
    await user.type(urlInput, 'h');

    expect(screen.queryByText('Please enter a valid URL (e.g., https://example.com)')).not.toBeInTheDocument();
  });

  it('should disable form during processing', async () => {
    const user = userEvent.setup();

    // Mock slow API response
    mockFetch.mockImplementationOnce(() =>
      new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: async () => ({ id: 'page-123', title: 'Test', content: 'Content' })
      }), 100))
    );

    render(
      <ContentIngestionForm
        projectId={mockProjectId}
        onContentSaved={mockOnContentSaved}
      />
    );

    const urlInput = screen.getByLabelText('Website URL');
    const submitButton = screen.getByRole('button', { name: 'Process URL' });

    await user.type(urlInput, 'https://example.com');
    await user.click(submitButton);

    // Button should be disabled during processing
    expect(submitButton).toBeDisabled();
    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });
});