'use client';

import { useState, useEffect } from 'react';
import { z } from 'zod';
import ErrorModal from './ui/ErrorModal';

// AI configuration validation schemas
const aiConfigSchema = z.object({
  provider: z.enum(['openai', 'anthropic'], { message: 'Please select a valid AI provider' }),
  model: z.string().min(1, 'Model name is required'),
  apiKey: z.string().min(1, 'API key is required'),
  maxTokens: z.number().min(100).max(8000).default(4000),
  temperature: z.number().min(0).max(2).default(0.7),
});

const promptConfigSchema = z.object({
  name: z.string().min(1, 'Prompt name is required').max(100, 'Name is too long'),
  promptText: z.string().min(10, 'Prompt must be at least 10 characters').max(5000, 'Prompt is too long'),
});

type AIProvider = 'openai' | 'anthropic';

interface AIConfig {
  provider: AIProvider;
  model: string;
  apiKey: string;
  maxTokens: number;
  temperature: number;
}

interface PromptConfig {
  name: string;
  promptText: string;
}

interface AISettingsFormProps {
  tenantId: string;
  initialConfig?: Partial<AIConfig & PromptConfig>;
  onSaved: () => void;
  onCancel?: () => void;
}

// Predefined model options
const MODEL_OPTIONS = {
  openai: [
    { value: 'gpt-4o', label: 'GPT-4 Turbo (Latest)' },
    { value: 'gpt-4o-mini', label: 'GPT-4 Mini (Cost-effective)' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (Fast)' },
  ],
  anthropic: [
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (Latest)' },
    { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku (Fast)' },
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus (Most Capable)' },
  ],
};

// Default prompt template
const DEFAULT_PROMPT_TEXT = `You are an expert SEO keyword researcher. Analyze the following content and generate exactly {{targetCount}} relevant keywords for SEO purposes.

Rules:
1. Focus on primary topics, entities, and concepts from the content
2. Include both short-tail (1-2 words) and long-tail (3+ words) keywords
3. Prioritize commercial intent and search potential
4. Avoid overly generic terms
5. Include relevant semantic variations

Content to analyze:
{{content}}

Return ONLY a JSON array of keywords in this exact format:
[
  {"text": "keyword phrase", "relevanceScore": 0.95},
  {"text": "another keyword", "relevanceScore": 0.88}
]

Generate exactly {{targetCount}} keywords:`;

export default function AISettingsForm({ tenantId, initialConfig, onSaved, onCancel }: AISettingsFormProps) {
  // AI Configuration state
  const [provider, setProvider] = useState<AIProvider>(initialConfig?.provider || 'openai');
  const [model, setModel] = useState(initialConfig?.model || '');
  const [apiKey, setApiKey] = useState(initialConfig?.apiKey || '');
  const [maxTokens, setMaxTokens] = useState(initialConfig?.maxTokens || 4000);
  const [temperature, setTemperature] = useState(initialConfig?.temperature || 0.7);

  // Prompt Configuration state
  const [promptName, setPromptName] = useState(initialConfig?.name || 'Default Keyword Generation');
  const [promptText, setPromptText] = useState(initialConfig?.promptText || DEFAULT_PROMPT_TEXT);

  // Form state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Error modal state
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title: string; message: string }>({
    isOpen: false,
    title: '',
    message: ''
  });

  // Update model options when provider changes
  useEffect(() => {
    if (!model || !MODEL_OPTIONS[provider].find(option => option.value === model)) {
      setModel(MODEL_OPTIONS[provider][0]?.value || '');
    }
  }, [provider, model]);

  // Clear test result when form changes
  useEffect(() => {
    setTestResult(null);
  }, [provider, model, apiKey, promptText]);

  const showError = (title: string, message: string) => {
    setErrorModal({ isOpen: true, title, message });
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Validate AI config
    try {
      aiConfigSchema.parse({ provider, model, apiKey, maxTokens, temperature });
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach(err => {
          newErrors[err.path[0] as string] = err.message;
        });
      }
    }

    // Validate prompt config
    try {
      promptConfigSchema.parse({ name: promptName, promptText });
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach(err => {
          newErrors[err.path[0] === 'name' ? 'promptName' : 'promptText'] = err.message;
        });
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const testConnection = async () => {
    if (!validateForm()) return;

    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/v1/ai/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider,
          model,
          apiKey,
          maxTokens,
          temperature,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setTestResult({ success: true, message: 'Connection successful! AI service is working properly.' });
      } else {
        setTestResult({ success: false, message: data.error || 'Connection test failed' });
      }
    } catch (error) {
      setTestResult({ success: false, message: 'Failed to test connection. Please check your settings.' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);

    try {
      const response = await fetch('/api/v1/ai/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantId,
          aiConfig: {
            provider,
            model,
            apiKey,
            maxTokens,
            temperature,
          },
          promptConfig: {
            name: promptName,
            promptText,
          },
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        onSaved();
      } else {
        showError('Save Failed', data.error || 'Failed to save AI settings');
      }
    } catch (error) {
      showError('Save Failed', 'Failed to save AI settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-sm border">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">AI Configuration</h2>
        <p className="text-gray-600">Configure your AI provider settings for keyword generation</p>
      </div>

      <div className="space-y-8">
        {/* AI Provider Configuration */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Provider Settings</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Provider Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                AI Provider *
              </label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as AIProvider)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic Claude</option>
              </select>
              {errors.provider && <p className="mt-1 text-sm text-red-600">{errors.provider}</p>}
            </div>

            {/* Model Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Model *
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {MODEL_OPTIONS[provider].map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {errors.model && <p className="mt-1 text-sm text-red-600">{errors.model}</p>}
            </div>

            {/* API Key */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Key *
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={`Enter your ${provider === 'openai' ? 'OpenAI' : 'Anthropic'} API key`}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {errors.apiKey && <p className="mt-1 text-sm text-red-600">{errors.apiKey}</p>}
            </div>

            {/* Advanced Settings */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Tokens ({maxTokens})
              </label>
              <input
                type="range"
                min="100"
                max="8000"
                step="100"
                value={maxTokens}
                onChange={(e) => setMaxTokens(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>100 (Fast)</span>
                <span>8000 (Detailed)</span>
              </div>
              {errors.maxTokens && <p className="mt-1 text-sm text-red-600">{errors.maxTokens}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Temperature ({temperature})
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0 (Focused)</span>
                <span>2 (Creative)</span>
              </div>
              {errors.temperature && <p className="mt-1 text-sm text-red-600">{errors.temperature}</p>}
            </div>
          </div>

          {/* Test Connection */}
          <div className="mt-6">
            <button
              onClick={testConnection}
              disabled={isTesting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isTesting ? 'Testing...' : 'Test Connection'}
            </button>

            {testResult && (
              <div className={`mt-3 p-3 rounded-md ${testResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                {testResult.message}
              </div>
            )}
          </div>
        </div>

        {/* Prompt Configuration */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Prompt Template</h3>

          <div className="space-y-4">
            {/* Prompt Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prompt Name *
              </label>
              <input
                type="text"
                value={promptName}
                onChange={(e) => setPromptName(e.target.value)}
                placeholder="e.g., Default Keyword Generation"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {errors.promptName && <p className="mt-1 text-sm text-red-600">{errors.promptName}</p>}
            </div>

            {/* Prompt Text */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prompt Template *
              </label>
              <div className="mb-2">
                <p className="text-sm text-gray-600">
                  Use <code className="bg-gray-200 px-1 rounded">{'{{content}}'}</code> for the page content and{' '}
                  <code className="bg-gray-200 px-1 rounded">{'{{targetCount}}'}</code> for the number of keywords to generate.
                </p>
              </div>
              <textarea
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                rows={12}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                placeholder="Enter your prompt template..."
              />
              {errors.promptText && <p className="mt-1 text-sm text-red-600">{errors.promptText}</p>}
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-4 pt-6 border-t">
          {onCancel && (
            <button
              onClick={onCancel}
              disabled={isSaving}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>

      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ isOpen: false, title: '', message: '' })}
        title={errorModal.title}
        message={errorModal.message}
      />
    </div>
  );
}