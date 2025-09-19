// @ts-nocheck
import { jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ContentPreview from '../ContentPreview';

describe('ContentPreview', () => {
  const mockOnConfirm = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const defaultProps = {
    title: 'Test Page Title',
    content: 'This is the test content that should be displayed in the preview.',
    onConfirm: mockOnConfirm,
    onCancel: mockOnCancel,
  };

  it('should render content preview with title and content', () => {
    render(<ContentPreview {...defaultProps} />);

    expect(screen.getByText('Content Preview')).toBeInTheDocument();
    expect(screen.getByText('Page Title')).toBeInTheDocument();
    expect(screen.getByText('Test Page Title')).toBeInTheDocument();
    expect(screen.getByText(/This is the test content/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Content' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('should display URL when provided', () => {
    render(
      <ContentPreview
        {...defaultProps}
        url="https://example.com"
      />
    );

    expect(screen.getByText('Source URL')).toBeInTheDocument();
    expect(screen.getByText('https://example.com')).toBeInTheDocument();
  });

  it('should not display URL section when not provided', () => {
    render(<ContentPreview {...defaultProps} />);

    expect(screen.queryByText('Source URL')).not.toBeInTheDocument();
  });

  it('should not display title section when title is null', () => {
    render(
      <ContentPreview
        {...defaultProps}
        title={null}
      />
    );

    expect(screen.queryByText('Page Title')).not.toBeInTheDocument();
  });

  it('should display character count', () => {
    const content = 'A'.repeat(500);
    render(
      <ContentPreview
        {...defaultProps}
        content={content}
      />
    );

    expect(screen.getByText('Content (500 characters)')).toBeInTheDocument();
  });

  it('should truncate long content with ellipsis', () => {
    const longContent = 'A'.repeat(1500);
    render(
      <ContentPreview
        {...defaultProps}
        content={longContent}
      />
    );

    // Should show truncation message
    expect(screen.getByText('Preview shows first 1,000 characters. Full content will be saved.')).toBeInTheDocument();

    // Content should be truncated
    const contentElement = screen.getByText(/A+\.\.\./);
    expect(contentElement.textContent).toMatch(/A+\.\.\.$/);
  });

  it('should not show truncation message for short content', () => {
    const shortContent = 'Short content';
    render(
      <ContentPreview
        {...defaultProps}
        content={shortContent}
      />
    );

    expect(screen.queryByText('Preview shows first 1,000 characters. Full content will be saved.')).not.toBeInTheDocument();
  });

  it('should call onConfirm when Save Content button is clicked', async () => {
    const user = userEvent.setup();
    render(<ContentPreview {...defaultProps} />);

    const saveButton = screen.getByRole('button', { name: 'Save Content' });
    await user.click(saveButton);

    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
  });

  it('should call onCancel when Cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<ContentPreview {...defaultProps} />);

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('should disable buttons when loading', () => {
    render(
      <ContentPreview
        {...defaultProps}
        isLoading={true}
      />
    );

    const saveButton = screen.getByRole('button', { name: 'Saving...' });
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });

    expect(saveButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();
  });

  it('should show saving text when loading', () => {
    render(
      <ContentPreview
        {...defaultProps}
        isLoading={true}
      />
    );

    expect(screen.getByText('Saving...')).toBeInTheDocument();
    expect(screen.queryByText('Save Content')).not.toBeInTheDocument();
  });

  it('should preserve whitespace in content display', () => {
    const contentWithWhitespace = `Line 1

Line 2 with   spaces

Line 3`;

    render(
      <ContentPreview
        {...defaultProps}
        content={contentWithWhitespace}
      />
    );

    // Check that whitespace is preserved with pre-wrap
    const contentElement = screen.getByText(contentWithWhitespace);
    expect(contentElement).toHaveClass('whitespace-pre-wrap');
  });

  it('should handle empty content gracefully', () => {
    render(
      <ContentPreview
        {...defaultProps}
        content=""
      />
    );

    expect(screen.getByText('Content (0 characters)')).toBeInTheDocument();
    // Should still render the component without errors
    expect(screen.getByText('Content Preview')).toBeInTheDocument();
  });

  it('should format large character counts with commas', () => {
    const largeContent = 'A'.repeat(10500);
    render(
      <ContentPreview
        {...defaultProps}
        content={largeContent}
      />
    );

    expect(screen.getByText('Content (10,500 characters)')).toBeInTheDocument();
  });
});