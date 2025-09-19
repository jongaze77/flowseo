import { jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorModal from '../ErrorModal';

describe('ErrorModal', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const defaultProps = {
    isOpen: true,
    title: 'Error Title',
    message: 'This is an error message',
    onClose: mockOnClose,
  };

  it('should render when isOpen is true', () => {
    render(<ErrorModal {...defaultProps} />);

    expect(screen.getByText('Error Title')).toBeInTheDocument();
    expect(screen.getByText('This is an error message')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('should not render when isOpen is false', () => {
    render(
      <ErrorModal
        {...defaultProps}
        isOpen={false}
      />
    );

    expect(screen.queryByText('Error Title')).not.toBeInTheDocument();
    expect(screen.queryByText('This is an error message')).not.toBeInTheDocument();
  });

  it('should display error icon', () => {
    render(<ErrorModal {...defaultProps} />);

    // Check for error icon (SVG with specific path)
    const errorIcon = screen.getByRole('img', { hidden: true });
    expect(errorIcon).toBeInTheDocument();
    expect(errorIcon).toHaveClass('text-red-600');
  });

  it('should call onClose when Close button is clicked', async () => {
    const user = userEvent.setup();
    render(<ErrorModal {...defaultProps} />);

    const closeButton = screen.getByRole('button', { name: 'Close' });
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should render ReactNode message', () => {
    const complexMessage = (
      <div>
        <p>First paragraph</p>
        <p>Second paragraph with <strong>bold text</strong></p>
      </div>
    );

    render(
      <ErrorModal
        {...defaultProps}
        message={complexMessage}
      />
    );

    expect(screen.getByText('First paragraph')).toBeInTheDocument();
    expect(screen.getByText('Second paragraph with')).toBeInTheDocument();
    expect(screen.getByText('bold text')).toBeInTheDocument();
  });

  it('should have proper styling classes', () => {
    render(<ErrorModal {...defaultProps} />);

    // Check backdrop
    const backdrop = screen.getByRole('button', { name: 'Close' }).closest('.fixed');
    expect(backdrop).toHaveClass('inset-0', 'bg-black', 'bg-opacity-50');

    // Check modal content
    const modal = screen.getByText('Error Title').closest('.bg-white');
    expect(modal).toHaveClass('rounded-lg', 'p-6', 'max-w-md');

    // Check close button
    const closeButton = screen.getByRole('button', { name: 'Close' });
    expect(closeButton).toHaveClass('bg-gray-600', 'hover:bg-gray-700', 'text-white');
  });

  it('should be accessible with proper roles', () => {
    render(<ErrorModal {...defaultProps} />);

    // Title should be a heading
    const title = screen.getByText('Error Title');
    expect(title.tagName).toBe('H3');

    // Button should have proper role
    const closeButton = screen.getByRole('button', { name: 'Close' });
    expect(closeButton).toBeInTheDocument();
  });

  it('should handle empty message', () => {
    render(
      <ErrorModal
        {...defaultProps}
        message=""
      />
    );

    expect(screen.getByText('Error Title')).toBeInTheDocument();
    // Should still render without errors even with empty message
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('should handle long title and message', () => {
    const longTitle = 'A'.repeat(100);
    const longMessage = 'B'.repeat(500);

    render(
      <ErrorModal
        {...defaultProps}
        title={longTitle}
        message={longMessage}
      />
    );

    expect(screen.getByText(longTitle)).toBeInTheDocument();
    expect(screen.getByText(longMessage)).toBeInTheDocument();
  });
});