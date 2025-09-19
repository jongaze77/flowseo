import { jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AISettingsForm from '../AISettingsForm';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as jest.MockedFunction<typeof fetch>;

describe('AISettingsForm', () => {
  const mockOnSaved = jest.fn();
  const mockOnCancel = jest.fn();

  const defaultProps = {
    tenantId: 'tenant-1',
    onSaved: mockOnSaved,
    onCancel: mockOnCancel,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render form with default values', () => {
    render(<AISettingsForm {...defaultProps} />);

    expect(screen.getByText('AI Configuration')).toBeInTheDocument();
    expect(screen.getByText('Configure your AI provider settings for keyword generation')).toBeInTheDocument();

    // Check form fields
    expect(screen.getByLabelText('AI Provider *')).toBeInTheDocument();
    expect(screen.getByLabelText('Model *')).toBeInTheDocument();
    expect(screen.getByLabelText('API Key *')).toBeInTheDocument();
    expect(screen.getByLabelText(/Max Tokens/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Temperature/)).toBeInTheDocument();
    expect(screen.getByLabelText('Prompt Name *')).toBeInTheDocument();
    expect(screen.getByLabelText('Prompt Template *')).toBeInTheDocument();

    // Check buttons
    expect(screen.getByRole('button', { name: 'Test Connection' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Configuration' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('should render with initial configuration values', () => {
    const initialConfig = {
      provider: 'anthropic' as const,
      model: 'claude-3-haiku-20240307',
      apiKey: 'sk-ant-test123',
      maxTokens: 2000,
      temperature: 0.5,
      name: 'Custom Prompt',
      promptText: 'Custom prompt template',
    };

    render(<AISettingsForm {...defaultProps} initialConfig={initialConfig} />);

    expect(screen.getByDisplayValue('anthropic')).toBeInTheDocument();
    expect(screen.getByDisplayValue('claude-3-haiku-20240307')).toBeInTheDocument();
    expect(screen.getByDisplayValue('sk-ant-test123')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Custom Prompt')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Custom prompt template')).toBeInTheDocument();
  });

  it('should update model options when provider changes', async () => {
    const user = userEvent.setup();
    render(<AISettingsForm {...defaultProps} />);

    const providerSelect = screen.getByLabelText('AI Provider *');

    // Initially OpenAI should be selected with OpenAI models
    expect(screen.getByText('GPT-4 Turbo (Latest)')).toBeInTheDocument();

    // Change to Anthropic
    await user.selectOptions(providerSelect, 'anthropic');

    // Should now show Anthropic models
    expect(screen.getByText('Claude 3.5 Sonnet (Latest)')).toBeInTheDocument();
    expect(screen.queryByText('GPT-4 Turbo (Latest)')).not.toBeInTheDocument();
  });

  it('should test connection successfully', async () => {
    const user = userEvent.setup();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    render(<AISettingsForm {...defaultProps} />);

    // Fill in required fields
    await user.type(screen.getByLabelText('API Key *'), 'sk-test123');

    // Click test connection
    await user.click(screen.getByRole('button', { name: 'Test Connection' }));

    await waitFor(() => {
      expect(screen.getByText('Connection successful! AI service is working properly.')).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/v1/ai/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.stringContaining('sk-test123'),
    });
  });

  it('should handle test connection failure', async () => {
    const user = userEvent.setup();

    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid API key' }),
    } as Response);

    render(<AISettingsForm {...defaultProps} />);

    // Fill in required fields
    await user.type(screen.getByLabelText('API Key *'), 'invalid-key');

    // Click test connection
    await user.click(screen.getByRole('button', { name: 'Test Connection' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid API key')).toBeInTheDocument();
    });
  });

  it('should save configuration successfully', async () => {
    const user = userEvent.setup();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    render(<AISettingsForm {...defaultProps} />);

    // Fill in required fields
    await user.type(screen.getByLabelText('API Key *'), 'sk-test123');
    await user.type(screen.getByLabelText('Prompt Name *'), 'Test Prompt');

    // Click save
    await user.click(screen.getByRole('button', { name: 'Save Configuration' }));

    await waitFor(() => {
      expect(mockOnSaved).toHaveBeenCalled();
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/v1/ai/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.stringContaining('tenant-1'),
    });
  });

  it('should handle save failure with error modal', async () => {
    const user = userEvent.setup();

    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Save failed' }),
    } as Response);

    render(<AISettingsForm {...defaultProps} />);

    // Fill in required fields
    await user.type(screen.getByLabelText('API Key *'), 'sk-test123');
    await user.type(screen.getByLabelText('Prompt Name *'), 'Test Prompt');

    // Click save
    await user.click(screen.getByRole('button', { name: 'Save Configuration' }));

    // Should show error modal
    await waitFor(() => {
      expect(screen.getByText('Save Failed')).toBeInTheDocument();
      expect(screen.getByText('Save failed')).toBeInTheDocument();
    });

    expect(mockOnSaved).not.toHaveBeenCalled();
  });

  it('should validate required fields', async () => {
    const user = userEvent.setup();
    render(<AISettingsForm {...defaultProps} />);

    // Try to save without filling required fields
    await user.click(screen.getByRole('button', { name: 'Save Configuration' }));

    // Should show validation errors
    expect(screen.getByText('API key is required')).toBeInTheDocument();
    expect(screen.getByText('Prompt name is required')).toBeInTheDocument();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockOnSaved).not.toHaveBeenCalled();
  });

  it('should validate prompt text length', async () => {
    const user = userEvent.setup();
    render(<AISettingsForm {...defaultProps} />);

    // Clear default prompt and add short text
    const promptTextarea = screen.getByLabelText('Prompt Template *');
    await user.clear(promptTextarea);
    await user.type(promptTextarea, 'short');

    // Fill other required fields
    await user.type(screen.getByLabelText('API Key *'), 'sk-test123');

    // Try to save
    await user.click(screen.getByRole('button', { name: 'Save Configuration' }));

    // Should show validation error
    expect(screen.getByText('Prompt must be at least 10 characters')).toBeInTheDocument();
  });

  it('should handle temperature slider changes', async () => {
    const user = userEvent.setup();
    render(<AISettingsForm {...defaultProps} />);

    const temperatureSlider = screen.getByDisplayValue('0.7');

    await user.clear(temperatureSlider);
    await user.type(temperatureSlider, '1.2');

    // Temperature should update in the label
    expect(screen.getByText(/Temperature \(1\.2\)/)).toBeInTheDocument();
  });

  it('should handle max tokens slider changes', async () => {
    const user = userEvent.setup();
    render(<AISettingsForm {...defaultProps} />);

    const maxTokensSlider = screen.getByDisplayValue('4000');

    await user.clear(maxTokensSlider);
    await user.type(maxTokensSlider, '2000');

    // Max tokens should update in the label
    expect(screen.getByText(/Max Tokens \(2000\)/)).toBeInTheDocument();
  });

  it('should call onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<AISettingsForm {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should not render cancel button when onCancel is not provided', () => {
    render(<AISettingsForm tenantId="tenant-1" onSaved={mockOnSaved} />);

    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  it('should clear test result when form changes', async () => {
    const user = userEvent.setup();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    render(<AISettingsForm {...defaultProps} />);

    // Fill API key and test connection
    await user.type(screen.getByLabelText('API Key *'), 'sk-test123');
    await user.click(screen.getByRole('button', { name: 'Test Connection' }));

    await waitFor(() => {
      expect(screen.getByText('Connection successful! AI service is working properly.')).toBeInTheDocument();
    });

    // Change provider - should clear test result
    const providerSelect = screen.getByLabelText('AI Provider *');
    await user.selectOptions(providerSelect, 'anthropic');

    expect(screen.queryByText('Connection successful! AI service is working properly.')).not.toBeInTheDocument();
  });

  it('should show loading state during test connection', async () => {
    const user = userEvent.setup();

    // Create a promise that we can control
    let resolvePromise: (value: Response) => void;
    const testPromise = new Promise<Response>((resolve) => {
      resolvePromise = resolve;
    });

    mockFetch.mockReturnValueOnce(testPromise);

    render(<AISettingsForm {...defaultProps} />);

    // Fill API key and start test
    await user.type(screen.getByLabelText('API Key *'), 'sk-test123');
    await user.click(screen.getByRole('button', { name: 'Test Connection' }));

    // Should show loading state
    expect(screen.getByRole('button', { name: 'Testing...' })).toBeInTheDocument();

    // Resolve the promise
    resolvePromise!({
      ok: true,
      json: async () => ({ success: true }),
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Test Connection' })).toBeInTheDocument();
    });
  });

  it('should show loading state during save', async () => {
    const user = userEvent.setup();

    // Create a promise that we can control
    let resolvePromise: (value: Response) => void;
    const savePromise = new Promise<Response>((resolve) => {
      resolvePromise = resolve;
    });

    mockFetch.mockReturnValueOnce(savePromise);

    render(<AISettingsForm {...defaultProps} />);

    // Fill required fields and start save
    await user.type(screen.getByLabelText('API Key *'), 'sk-test123');
    await user.type(screen.getByLabelText('Prompt Name *'), 'Test Prompt');
    await user.click(screen.getByRole('button', { name: 'Save Configuration' }));

    // Should show loading state
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeInTheDocument();

    // Resolve the promise
    resolvePromise!({
      ok: true,
      json: async () => ({ success: true }),
    });

    await waitFor(() => {
      expect(mockOnSaved).toHaveBeenCalled();
    });
  });
});