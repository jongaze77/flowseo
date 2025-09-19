'use client';

import { useState, useEffect, useCallback } from 'react';
import { z } from 'zod';
import ErrorModal from './ui/ErrorModal';

// Validation schema for keyword generation
const keywordGenerationSchema = z.object({
  keywordListName: z.string().min(1, 'Keyword list name is required').max(100, 'Name is too long'),
  targetCount: z.number().min(1, 'Must generate at least 1 keyword').max(200, 'Cannot generate more than 200 keywords'),
  promptName: z.string().min(1, 'Please select a prompt'),
});

interface AIPrompt {
  id: string;
  name: string;
  prompt_text: string;
  ai_model: string;
}

interface AISettings {
  provider: string;
  model: string;
  hasApiKey: boolean;
  maxTokens: number;
  temperature: number;
}

interface KeywordGenerationTriggerProps {
  projectId: string;
  pageId: string;
  pageTitle?: string;
  onKeywordsGenerated: (keywordListId: string) => void;
  disabled?: boolean;
}

interface GenerationProgress {
  stage: 'preparing' | 'ai_processing' | 'saving' | 'complete';
  message: string;
  progress: number; // 0-100
}

export default function KeywordGenerationTrigger({
  projectId,
  pageId,
  pageTitle,
  onKeywordsGenerated,
  disabled = false
}: KeywordGenerationTriggerProps) {
  // Form state
  const [keywordListName, setKeywordListName] = useState('');
  const [targetCount, setTargetCount] = useState(100);
  const [selectedPromptId, setSelectedPromptId] = useState('');

  // Available options state
  const [availablePrompts, setAvailablePrompts] = useState<AIPrompt[]>([]);
  const [aiSettings, setAiSettings] = useState<AISettings[]>([]);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null);

  // Form validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Error modal state
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title: string; message: string }>({
    isOpen: false,
    title: '',
    message: ''
  });

  const showError = (title: string, message: string) => {
    setErrorModal({ isOpen: true, title, message });
  };

  const loadAISettings = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/ai/settings');
      const data = await response.json();

      if (response.ok && data.success) {
        setAiSettings(data.aiSettings || []);
        setAvailablePrompts(data.prompts || []);

        // Auto-select first prompt if available
        if (data.prompts?.length > 0 && !selectedPromptId) {
          setSelectedPromptId(data.prompts[0].id);
        }
      } else {
        showError('Settings Load Failed', data.error || 'Failed to load AI settings');
      }
    } catch {
      showError('Settings Load Failed', 'Failed to load AI settings. Please try again.');
    }
  }, []);

  // Load available prompts and AI settings on mount
  useEffect(() => {
    loadAISettings();
  }, [loadAISettings]);

  // Auto-generate keyword list name when page title changes
  useEffect(() => {
    if (pageTitle && !keywordListName) {
      const timestamp = new Date().toLocaleDateString();
      setKeywordListName(`Keywords for "${pageTitle}" - ${timestamp}`);
    }
  }, [pageTitle, keywordListName]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    try {
      keywordGenerationSchema.parse({
        keywordListName,
        targetCount,
        promptName: selectedPromptId,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.issues.forEach(err => {
          const field = err.path[0] === 'promptName' ? 'selectedPromptId' : err.path[0] as string;
          newErrors[field] = err.message;
        });
      }
    }

    // Check if AI is configured
    if (aiSettings.length === 0) {
      newErrors.general = 'No AI providers configured. Please configure AI settings first.';
    } else if (!aiSettings.some(setting => setting.hasApiKey)) {
      newErrors.general = 'No API keys configured. Please add API keys in AI settings.';
    }

    // Check if prompts are available
    if (availablePrompts.length === 0) {
      newErrors.general = 'No prompts configured. Please create a prompt template first.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const updateProgress = (stage: GenerationProgress['stage'], message: string, progress: number) => {
    setGenerationProgress({ stage, message, progress });
  };

  const generateKeywords = async () => {
    if (!validateForm()) return;

    setIsGenerating(true);
    setErrors({});

    try {
      updateProgress('preparing', 'Preparing keyword generation...', 10);

      // Get selected prompt details
      const selectedPrompt = availablePrompts.find(p => p.id === selectedPromptId);
      if (!selectedPrompt) {
        throw new Error('Selected prompt not found');
      }

      // Get AI settings for the prompt's model
      const aiConfig = aiSettings.find(setting => setting.model === selectedPrompt.ai_model);
      if (!aiConfig || !aiConfig.hasApiKey) {
        throw new Error(`No API key configured for model: ${selectedPrompt.ai_model}`);
      }

      updateProgress('preparing', 'Configuring AI parameters...', 20);

      // Prepare request payload
      const requestPayload = {
        keywordListName,
        promptText: selectedPrompt.prompt_text,
        targetCount,
        aiConfig: {
          provider: aiConfig.provider,
          model: aiConfig.model,
          apiKey: 'stored_securely', // API will use stored key
          maxTokens: aiConfig.maxTokens,
          temperature: aiConfig.temperature,
        },
      };

      updateProgress('ai_processing', 'Sending content to AI for analysis...', 30);

      // Make API request
      const response = await fetch(`/api/v1/projects/${projectId}/pages/${pageId}/keywords`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });

      updateProgress('ai_processing', 'AI is generating keywords...', 70);

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Keyword generation failed');
      }

      updateProgress('saving', 'Saving generated keywords...', 90);

      // Simulate brief save time for better UX
      await new Promise(resolve => setTimeout(resolve, 500));

      updateProgress('complete', `Generated ${data.keywordList?.keywords?.length || 0} keywords successfully!`, 100);

      // Wait a moment to show completion, then callback
      setTimeout(() => {
        setGenerationProgress(null);
        setIsGenerating(false);
        onKeywordsGenerated(data.keywordList?.id);
      }, 1500);

    } catch (error) {
      console.error('Keyword generation error:', error);
      setGenerationProgress(null);
      setIsGenerating(false);
      showError(
        'Keyword Generation Failed',
        error instanceof Error ? error.message : 'An unexpected error occurred during keyword generation'
      );
    }
  };

  const getProgressBarColor = () => {
    if (!generationProgress) return 'bg-blue-600';

    switch (generationProgress.stage) {
      case 'preparing': return 'bg-blue-600';
      case 'ai_processing': return 'bg-purple-600';
      case 'saving': return 'bg-green-600';
      case 'complete': return 'bg-green-600';
      default: return 'bg-blue-600';
    }
  };

  const hasConfigurationIssues = aiSettings.length === 0 || !aiSettings.some(s => s.hasApiKey) || availablePrompts.length === 0;

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Generate Keywords with AI</h3>
        <p className="text-gray-600">
          Use AI to analyze your page content and generate relevant SEO keywords
        </p>
      </div>

      {/* Configuration Warning */}
      {hasConfigurationIssues && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Configuration Required</h3>
              <p className="mt-1 text-sm text-yellow-700">
                Please configure AI settings and create prompt templates before generating keywords.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Keyword List Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Keyword List Name *
          </label>
          <input
            type="text"
            value={keywordListName}
            onChange={(e) => setKeywordListName(e.target.value)}
            placeholder="e.g., Keywords for Homepage - 12/25/2024"
            disabled={isGenerating || disabled}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
          />
          {errors.keywordListName && <p className="mt-1 text-sm text-red-600">{errors.keywordListName}</p>}
        </div>

        {/* Settings Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Target Count */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of Keywords ({targetCount})
            </label>
            <input
              type="range"
              min="10"
              max="200"
              step="10"
              value={targetCount}
              onChange={(e) => setTargetCount(Number(e.target.value))}
              disabled={isGenerating || disabled}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>10 (Quick)</span>
              <span>200 (Comprehensive)</span>
            </div>
            {errors.targetCount && <p className="mt-1 text-sm text-red-600">{errors.targetCount}</p>}
          </div>

          {/* Prompt Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Prompt Template *
            </label>
            <select
              value={selectedPromptId}
              onChange={(e) => setSelectedPromptId(e.target.value)}
              disabled={isGenerating || disabled || availablePrompts.length === 0}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
            >
              {availablePrompts.length === 0 ? (
                <option value="">No prompts available</option>
              ) : (
                <>
                  <option value="">Select a prompt template</option>
                  {availablePrompts.map(prompt => (
                    <option key={prompt.id} value={prompt.id}>
                      {prompt.name} ({prompt.ai_model})
                    </option>
                  ))}
                </>
              )}
            </select>
            {errors.selectedPromptId && <p className="mt-1 text-sm text-red-600">{errors.selectedPromptId}</p>}
          </div>
        </div>

        {/* General Errors */}
        {errors.general && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{errors.general}</p>
          </div>
        )}

        {/* Progress Bar */}
        {generationProgress && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-700">{generationProgress.message}</span>
              <span className="text-gray-500">{generationProgress.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor()}`}
                style={{ width: `${generationProgress.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Generate Button */}
        <div className="flex justify-end">
          <button
            onClick={generateKeywords}
            disabled={isGenerating || disabled || hasConfigurationIssues}
            className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Generating...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Generate Keywords</span>
              </>
            )}
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