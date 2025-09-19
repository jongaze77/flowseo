// @ts-nocheck
import { jest } from '@jest/globals';
import { aiService, aiModelConfigSchema, keywordGenerationRequestSchema } from '../aiService';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as jest.MockedFunction<typeof fetch>;

describe('AIService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Validation Schemas', () => {
    describe('aiModelConfigSchema', () => {
      it('should validate valid OpenAI config', () => {
        const config = {
          provider: 'openai' as const,
          model: 'gpt-4o-mini',
          apiKey: 'sk-test123',
          maxTokens: 4000,
          temperature: 0.7,
        };

        const result = aiModelConfigSchema.parse(config);
        expect(result).toEqual(config);
      });

      it('should validate valid Anthropic config', () => {
        const config = {
          provider: 'anthropic' as const,
          model: 'claude-3-haiku-20240307',
          apiKey: 'sk-ant-test123',
          maxTokens: 2000,
          temperature: 0.5,
        };

        const result = aiModelConfigSchema.parse(config);
        expect(result).toEqual(config);
      });

      it('should apply default values', () => {
        const config = {
          provider: 'openai' as const,
          model: 'gpt-4o-mini',
          apiKey: 'sk-test123',
        };

        const result = aiModelConfigSchema.parse(config);
        expect(result.maxTokens).toBe(4000);
        expect(result.temperature).toBe(0.7);
      });

      it('should reject invalid provider', () => {
        const config = {
          provider: 'invalid',
          model: 'gpt-4o-mini',
          apiKey: 'sk-test123',
        };

        expect(() => aiModelConfigSchema.parse(config)).toThrow();
      });

      it('should reject invalid temperature range', () => {
        const config = {
          provider: 'openai' as const,
          model: 'gpt-4o-mini',
          apiKey: 'sk-test123',
          temperature: 3.0, // Invalid: > 2
        };

        expect(() => aiModelConfigSchema.parse(config)).toThrow();
      });
    });

    describe('keywordGenerationRequestSchema', () => {
      it('should validate valid request', () => {
        const request = {
          content: 'This is test content for keyword generation',
          promptText: 'Generate keywords for: {{content}}',
          targetCount: 100,
          aiConfig: {
            provider: 'openai' as const,
            model: 'gpt-4o-mini',
            apiKey: 'sk-test123',
            maxTokens: 4000,
            temperature: 0.7,
          },
        };

        const result = keywordGenerationRequestSchema.parse(request);
        expect(result).toEqual(request);
      });

      it('should apply default target count', () => {
        const request = {
          content: 'Test content',
          promptText: 'Generate keywords',
          aiConfig: {
            provider: 'openai' as const,
            model: 'gpt-4o-mini',
            apiKey: 'sk-test123',
          },
        };

        const result = keywordGenerationRequestSchema.parse(request);
        expect(result.targetCount).toBe(100);
      });

      it('should reject empty content', () => {
        const request = {
          content: '',
          promptText: 'Generate keywords',
          aiConfig: {
            provider: 'openai' as const,
            model: 'gpt-4o-mini',
            apiKey: 'sk-test123',
          },
        };

        expect(() => keywordGenerationRequestSchema.parse(request)).toThrow();
      });

      it('should reject invalid target count range', () => {
        const request = {
          content: 'Test content',
          promptText: 'Generate keywords',
          targetCount: 250, // Invalid: > 200
          aiConfig: {
            provider: 'openai' as const,
            model: 'gpt-4o-mini',
            apiKey: 'sk-test123',
          },
        };

        expect(() => keywordGenerationRequestSchema.parse(request)).toThrow();
      });
    });
  });

  describe('generateKeywords', () => {
    const validRequest = {
      content: 'This is test content about web development and SEO optimization',
      promptText: 'Generate {{targetCount}} keywords for: {{content}}',
      targetCount: 10,
      aiConfig: {
        provider: 'openai' as const,
        model: 'gpt-4o-mini',
        apiKey: 'sk-test123',
        maxTokens: 4000,
        temperature: 0.7,
      },
    };

    describe('OpenAI Integration', () => {
      it('should generate keywords successfully with OpenAI', async () => {
        const mockResponse = {
          choices: [{
            message: {
              content: JSON.stringify([
                { text: "web development", relevanceScore: 0.95 },
                { text: "SEO optimization", relevanceScore: 0.88 },
                { text: "frontend development", relevanceScore: 0.82 }
              ])
            }
          }],
          usage: { total_tokens: 150 }
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        } as Response);

        const result = await aiService.generateKeywords(validRequest);

        expect(result.error).toBeUndefined();
        expect(result.keywords).toHaveLength(3);
        expect(result.keywords[0]).toEqual({
          text: "web development",
          relevanceScore: 0.95
        });
        expect(result.tokensUsed).toBe(150);
        expect(result.processingTime).toBeGreaterThan(0);

        // Verify API call
        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.openai.com/v1/chat/completions',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Authorization': 'Bearer sk-test123',
              'Content-Type': 'application/json',
            }),
            body: expect.stringContaining('"model":"gpt-4o-mini"'),
          })
        );
      });

      it('should handle OpenAI API errors', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({ error: { message: 'Invalid API key' } }),
        } as Response);

        const result = await aiService.generateKeywords(validRequest);

        expect(result.error).toContain('OpenAI API error: 401');
        expect(result.keywords).toHaveLength(0);
      });

      it('should handle network errors', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        const result = await aiService.generateKeywords(validRequest);

        expect(result.error).toContain('Network error');
        expect(result.keywords).toHaveLength(0);
      });

      it('should handle timeout', async () => {
        // Mock AbortSignal.timeout to simulate timeout
        const abortError = new Error('The operation was aborted due to timeout');
        abortError.name = 'AbortError';
        mockFetch.mockRejectedValueOnce(abortError);

        const result = await aiService.generateKeywords(validRequest);

        expect(result.error).toBeDefined();
        expect(result.keywords).toHaveLength(0);
      });
    });

    describe('Anthropic Integration', () => {
      const anthropicRequest = {
        ...validRequest,
        aiConfig: {
          ...validRequest.aiConfig,
          provider: 'anthropic' as const,
          model: 'claude-3-haiku-20240307',
          apiKey: 'sk-ant-test123',
        }
      };

      it('should generate keywords successfully with Anthropic', async () => {
        const mockResponse = {
          content: [{
            text: JSON.stringify([
              { text: "content marketing", relevanceScore: 0.92 },
              { text: "digital strategy", relevanceScore: 0.87 }
            ])
          }],
          usage: { input_tokens: 50, output_tokens: 75 }
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        } as Response);

        const result = await aiService.generateKeywords(anthropicRequest);

        expect(result.error).toBeUndefined();
        expect(result.keywords).toHaveLength(2);
        expect(result.keywords[0]).toEqual({
          text: "content marketing",
          relevanceScore: 0.92
        });
        expect(result.tokensUsed).toBe(125); // input + output tokens

        // Verify API call
        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.anthropic.com/v1/messages',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Authorization': 'Bearer sk-ant-test123',
              'anthropic-version': '2023-06-01',
            }),
          })
        );
      });

      it('should handle Anthropic API errors', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({ error: { message: 'Rate limit exceeded' } }),
        } as Response);

        const result = await aiService.generateKeywords(anthropicRequest);

        expect(result.error).toContain('Anthropic API error: 429');
        expect(result.keywords).toHaveLength(0);
      });
    });

    describe('Response Parsing', () => {
      it('should parse JSON keywords correctly', async () => {
        const mockResponse = {
          choices: [{
            message: {
              content: '[{"text": "keyword one", "relevanceScore": 0.9}, {"text": "keyword two", "relevanceScore": 0.8}]'
            }
          }],
          usage: { total_tokens: 100 }
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        } as Response);

        const result = await aiService.generateKeywords(validRequest);

        expect(result.keywords).toHaveLength(2);
        expect(result.keywords[0].text).toBe("keyword one");
        expect(result.keywords[1].text).toBe("keyword two");
      });

      it('should fallback to line-by-line parsing for non-JSON responses', async () => {
        const mockResponse = {
          choices: [{
            message: {
              content: 'Here are the keywords:\n1. web development\n2. SEO optimization\n3. frontend coding'
            }
          }],
          usage: { total_tokens: 80 }
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        } as Response);

        const result = await aiService.generateKeywords(validRequest);

        expect(result.keywords).toHaveLength(3);
        expect(result.keywords[0].text).toBe("web development");
        expect(result.keywords[1].text).toBe("SEO optimization");
        expect(result.keywords[2].text).toBe("frontend coding");
      });

      it('should filter out empty keywords', async () => {
        const mockResponse = {
          choices: [{
            message: {
              content: '[{"text": "valid keyword"}, {"text": ""}, {"text": "   "}, {"text": "another valid"}]'
            }
          }],
          usage: { total_tokens: 60 }
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        } as Response);

        const result = await aiService.generateKeywords(validRequest);

        expect(result.keywords).toHaveLength(2);
        expect(result.keywords[0].text).toBe("valid keyword");
        expect(result.keywords[1].text).toBe("another valid");
      });
    });

    describe('Content Length Validation', () => {
      it('should reject content that is too long', async () => {
        const longContent = 'a'.repeat(60000); // > 50KB limit
        const requestWithLongContent = {
          ...validRequest,
          content: longContent,
        };

        const result = await aiService.generateKeywords(requestWithLongContent);

        expect(result.error).toContain('Content too long');
        expect(result.keywords).toHaveLength(0);
      });
    });

    describe('Input Validation', () => {
      it('should handle invalid request data', async () => {
        const invalidRequest = {
          content: '', // Invalid: empty
          promptText: 'Test',
          aiConfig: {
            provider: 'openai' as const,
            model: 'gpt-4o-mini',
            apiKey: 'sk-test123',
          },
        };

        const result = await aiService.generateKeywords(invalidRequest as never);

        expect(result.error).toContain('Validation error');
        expect(result.keywords).toHaveLength(0);
      });
    });
  });

  describe('validateConfig', () => {
    it('should validate valid config', () => {
      const config = {
        provider: 'openai' as const,
        model: 'gpt-4o-mini',
        apiKey: 'sk-test123',
        maxTokens: 4000,
        temperature: 0.7,
      };

      const result = aiService.validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for invalid config', () => {
      const config = {
        provider: 'invalid',
        model: '',
        apiKey: '',
        temperature: 3,
      };

      const result = aiService.validateConfig(config as never);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('testConnection', () => {
    const validConfig = {
      provider: 'openai' as const,
      model: 'gpt-4o-mini',
      apiKey: 'sk-test123',
      maxTokens: 4000,
      temperature: 0.7,
    };

    it('should return success for working connection', async () => {
      const mockResponse = {
        choices: [{ message: { content: '[{"text": "test"}]' } }],
        usage: { total_tokens: 10 }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await aiService.testConnection(validConfig);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return error for failed connection', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'Invalid API key' } }),
      } as Response);

      const result = await aiService.testConnection(validConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('OpenAI API error');
    });

    it('should handle network errors in connection test', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await aiService.testConnection(validConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });
});