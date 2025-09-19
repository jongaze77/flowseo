'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '../../../components/layout/AppLayout';
import AISettingsForm from '../../../components/AISettingsForm';
import ErrorModal from '../../../components/ui/ErrorModal';
import { useAuth } from '../../../hooks/useAuth';
import { PROMPT_TYPE_LABELS } from '../../../lib/services/aiService';

interface AISettings {
  provider: string;
  model: string;
  hasApiKey: boolean;
  maxTokens: number;
  temperature: number;
  updatedAt: string;
}

interface Prompt {
  id: string;
  name: string;
  prompt_text: string;
  ai_model: string;
  prompt_type: string;
  is_default: boolean;
  is_enabled: boolean;
  created_at: string;
}

export default function AISettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [aiSettings, setAiSettings] = useState<AISettings[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);

  // Error modal state
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title: string; message: string }>({
    isOpen: false,
    title: '',
    message: ''
  });

  const showError = (title: string, message: string) => {
    setErrorModal({ isOpen: true, title, message });
  };

  const fetchAISettings = useCallback(async () => {
    try {
      setIsLoading(true);

      const response = await fetch('/api/v1/ai/settings', {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setAiSettings(data.aiSettings || []);
        setPrompts(data.prompts || []);
      } else {
        showError('Load Failed', data.error || 'Failed to load AI settings');
      }
    } catch (error) {
      console.error('AI settings fetch error:', error);
      showError('Load Failed', 'Failed to load AI settings. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchAISettings();
  }, [fetchAISettings]);

  const handleSettingsSaved = () => {
    setShowForm(false);
    setEditingPrompt(null);
    fetchAISettings();
  };

  const handleEditPrompt = (prompt: Prompt) => {
    setEditingPrompt(prompt);
    setShowForm(true);
  };

  const handleDuplicatePrompt = (prompt: Prompt) => {
    setEditingPrompt({ ...prompt, id: '', name: `${prompt.name} (Copy)` });
    setShowForm(true);
  };

  const handleDeletePrompt = async (promptId: string) => {
    if (!confirm('Are you sure you want to delete this prompt? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/ai/settings?promptId=${promptId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        fetchAISettings(); // Refresh the list
      } else {
        showError('Delete Failed', data.error || 'Failed to delete prompt');
      }
    } catch (error) {
      console.error('Prompt delete error:', error);
      showError('Delete Failed', 'Failed to delete prompt. Please try again.');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center min-h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </AppLayout>
    );
  }

  if (showForm) {
    // Find the corresponding AI settings for the model provider
    const modelProvider = editingPrompt?.ai_model ?
      (editingPrompt.ai_model.startsWith('gpt') ? 'openai' :
       editingPrompt.ai_model.includes('claude') ? 'anthropic' : 'openai') : 'openai';
    const correspondingAiSetting = aiSettings.find(setting => setting.provider === modelProvider);

    const initialConfig = editingPrompt ? {
      provider: modelProvider as 'openai' | 'anthropic',
      model: editingPrompt.ai_model,
      apiKey: correspondingAiSetting?.hasApiKey ? '••••••••••••' : '', // Show masked key if exists
      maxTokens: correspondingAiSetting?.maxTokens || 4000,
      temperature: correspondingAiSetting?.temperature || 0.7,
      name: editingPrompt.name,
      promptText: editingPrompt.prompt_text,
      promptType: editingPrompt.prompt_type,
      isDefault: editingPrompt.is_default,
      isEnabled: editingPrompt.is_enabled,
      id: editingPrompt.id, // Pass the prompt ID for editing
    } : undefined;

    return (
      <AppLayout>
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <button
              onClick={() => {
                setShowForm(false);
                setEditingPrompt(null);
              }}
              className="inline-flex items-center text-blue-600 hover:text-blue-800 cursor-pointer"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to AI Settings
            </button>
          </div>

          <AISettingsForm
            tenantId={user?.tenantId || ''}
            initialConfig={initialConfig}
            onSaved={handleSettingsSaved}
            onCancel={() => {
              setShowForm(false);
              setEditingPrompt(null);
            }}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AI Settings</h1>
              <p className="text-gray-600 mt-1">
                Configure AI providers and prompts for keyword generation
              </p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
            >
              Add New Configuration
            </button>
          </div>
        </div>

        <div className="space-y-8">
          {/* AI Provider Settings */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">AI Provider Configurations</h2>
              <p className="text-sm text-gray-600 mt-1">
                Your configured AI providers and their settings
              </p>
            </div>

            <div className="p-6">
              {aiSettings.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No AI Providers Configured</h3>
                  <p className="text-gray-600 mb-4">
                    Configure your first AI provider to start generating keywords
                  </p>
                  <button
                    onClick={() => setShowForm(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer"
                  >
                    Configure AI Provider
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {aiSettings.map((setting, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                          <h3 className="font-medium text-gray-900 capitalize">{setting.provider}</h3>
                        </div>
                        <span className="text-xs text-gray-500">{setting.hasApiKey ? 'Configured' : 'No API Key'}</span>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Model:</span>
                          <span className="text-gray-900">{setting.model}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Max Tokens:</span>
                          <span className="text-gray-900">{setting.maxTokens}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Temperature:</span>
                          <span className="text-gray-900">{setting.temperature}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Updated:</span>
                          <span className="text-gray-900">{formatDate(setting.updatedAt)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Prompt Templates */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Prompt Templates</h2>
              <p className="text-sm text-gray-600 mt-1">
                Your saved prompt templates for keyword generation
              </p>
            </div>

            <div className="p-6">
              {prompts.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Prompt Templates</h3>
                  <p className="text-gray-600 mb-4">
                    Create your first prompt template to customize keyword generation
                  </p>
                  <button
                    onClick={() => setShowForm(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer"
                  >
                    Create Prompt Template
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {prompts.map((prompt) => (
                    <div key={prompt.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <h3 className="font-medium text-gray-900">{prompt.name}</h3>
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {PROMPT_TYPE_LABELS[prompt.prompt_type as keyof typeof PROMPT_TYPE_LABELS] || prompt.prompt_type}
                          </span>
                          {prompt.is_default && (
                            <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded font-medium">
                              Default
                            </span>
                          )}
                          {!prompt.is_enabled && (
                            <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded">
                              Disabled
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {prompt.ai_model}
                          </span>
                          <button
                            onClick={() => handleDuplicatePrompt(prompt)}
                            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 rounded border border-gray-300 cursor-pointer transition-colors"
                          >
                            Duplicate
                          </button>
                          <button
                            onClick={() => handleEditPrompt(prompt)}
                            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 hover:text-blue-900 rounded border border-blue-300 cursor-pointer transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeletePrompt(prompt.id)}
                            className="px-3 py-1 text-sm bg-red-100 text-red-700 hover:bg-red-200 hover:text-red-900 rounded border border-red-300 cursor-pointer transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      <div className="text-sm text-gray-600 mb-2">
                        Created: {formatDate(prompt.created_at)}
                      </div>

                      <div className="bg-gray-50 rounded p-3">
                        <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono max-h-24 overflow-y-auto">
                          {prompt.prompt_text.substring(0, 200)}
                          {prompt.prompt_text.length > 200 && '...'}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ isOpen: false, title: '', message: '' })}
        title={errorModal.title}
        message={errorModal.message}
      />
    </AppLayout>
  );
}