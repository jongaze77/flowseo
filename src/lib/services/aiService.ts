import { z } from 'zod';

// AI Provider types
export type AIProvider = 'openai' | 'anthropic';

// AI Model configuration schema
export const aiModelConfigSchema = z.object({
  provider: z.enum(['openai', 'anthropic']),
  model: z.string(),
  apiKey: z.string(),
  maxTokens: z.number().optional().default(4000),
  temperature: z.number().min(0).max(2).optional().default(0.7),
});

export type AIModelConfig = z.infer<typeof aiModelConfigSchema>;

// Keyword generation request schema
export const keywordGenerationRequestSchema = z.object({
  content: z.string().min(1, "Content is required for keyword generation"),
  promptText: z.string().min(1, "Prompt text is required"),
  targetCount: z.number().min(1).max(200).default(100),
  aiConfig: aiModelConfigSchema,
});

export type KeywordGenerationRequest = z.infer<typeof keywordGenerationRequestSchema>;

// Generated keyword interface
export interface GeneratedKeyword {
  text: string;
  relevanceScore?: number;
  searchVolume?: number;
  difficulty?: number;
}

// AI service response interface
export interface AIServiceResponse {
  keywords: GeneratedKeyword[];
  tokensUsed?: number;
  processingTime: number;
  error?: string;
}

// AI service configuration
const AI_SERVICE_CONFIG = {
  timeout: 30000, // 30 seconds for AI processing
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  maxContentLength: 50000, // 50KB max content for AI processing
};

// Default prompt template for keyword generation
export const DEFAULT_KEYWORD_PROMPT = `You are an expert SEO keyword researcher. Analyze the following content and generate exactly {{targetCount}} relevant keywords for SEO purposes.

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

/**
 * AI Service for keyword generation
 */
export class AIService {
  private static instance: AIService;

  private constructor() {}

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  /**
   * Generate keywords from content using AI
   */
  async generateKeywords(request: KeywordGenerationRequest): Promise<AIServiceResponse> {
    const startTime = Date.now();

    try {
      // Validate request
      const validatedRequest = keywordGenerationRequestSchema.parse(request);

      // Validate content length
      if (validatedRequest.content.length > AI_SERVICE_CONFIG.maxContentLength) {
        throw new Error(`Content too long. Maximum ${AI_SERVICE_CONFIG.maxContentLength} characters allowed.`);
      }

      // Prepare prompt
      const prompt = this.preparePrompt(validatedRequest.promptText, validatedRequest.content, validatedRequest.targetCount);

      // Generate keywords based on provider
      let aiResponse: AIServiceResponse;

      switch (validatedRequest.aiConfig.provider) {
        case 'openai':
          aiResponse = await this.callOpenAI(prompt, validatedRequest.aiConfig);
          break;
        case 'anthropic':
          aiResponse = await this.callAnthropic(prompt, validatedRequest.aiConfig);
          break;
        default:
          throw new Error(`Unsupported AI provider: ${validatedRequest.aiConfig.provider}`);
      }

      aiResponse.processingTime = Date.now() - startTime;
      return aiResponse;

    } catch (error) {
      const processingTime = Date.now() - startTime;

      if (error instanceof z.ZodError) {
        return {
          keywords: [],
          processingTime,
          error: `Validation error: ${error.errors.map(e => e.message).join(', ')}`
        };
      }

      return {
        keywords: [],
        processingTime,
        error: error instanceof Error ? error.message : 'Unknown AI service error'
      };
    }
  }

  /**
   * Prepare prompt with template substitution
   */
  private preparePrompt(promptTemplate: string, content: string, targetCount: number): string {
    return promptTemplate
      .replace(/\{\{content\}\}/g, content.substring(0, AI_SERVICE_CONFIG.maxContentLength))
      .replace(/\{\{targetCount\}\}/g, targetCount.toString());
  }

  /**
   * Call OpenAI API for keyword generation
   */
  private async callOpenAI(prompt: string, config: AIModelConfig): Promise<AIServiceResponse> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model || 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: config.maxTokens,
        temperature: config.temperature,
      }),
      signal: AbortSignal.timeout(AI_SERVICE_CONFIG.timeout),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content received from OpenAI API');
    }

    return {
      keywords: this.parseKeywordsFromResponse(content),
      tokensUsed: data.usage?.total_tokens,
      processingTime: 0, // Will be set by caller
    };
  }

  /**
   * Call Anthropic Claude API for keyword generation
   */
  private async callAnthropic(prompt: string, config: AIModelConfig): Promise<AIServiceResponse> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model || 'claude-3-haiku-20240307',
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
      }),
      signal: AbortSignal.timeout(AI_SERVICE_CONFIG.timeout),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Anthropic API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;

    if (!content) {
      throw new Error('No content received from Anthropic API');
    }

    return {
      keywords: this.parseKeywordsFromResponse(content),
      tokensUsed: data.usage?.input_tokens + data.usage?.output_tokens,
      processingTime: 0, // Will be set by caller
    };
  }

  /**
   * Parse keywords from AI response
   */
  private parseKeywordsFromResponse(content: string): GeneratedKeyword[] {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in AI response');
      }

      const keywords = JSON.parse(jsonMatch[0]);

      if (!Array.isArray(keywords)) {
        throw new Error('AI response is not an array');
      }

      return keywords.map((keyword: any) => ({
        text: keyword.text || '',
        relevanceScore: keyword.relevanceScore || undefined,
        searchVolume: keyword.searchVolume || undefined,
        difficulty: keyword.difficulty || undefined,
      })).filter(k => k.text.trim().length > 0);

    } catch (error) {
      // Fallback: try to extract keywords line by line
      const lines = content.split('\n').filter(line => line.trim());
      const keywords: GeneratedKeyword[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('[') && !trimmed.startsWith(']') && !trimmed.startsWith('{') && !trimmed.startsWith('}')) {
          // Remove common prefixes and clean up
          const cleaned = trimmed
            .replace(/^[-*•]\s*/, '')
            .replace(/^\d+\.\s*/, '')
            .replace(/^["']|["']$/g, '')
            .trim();

          if (cleaned) {
            keywords.push({ text: cleaned });
          }
        }
      }

      return keywords;
    }
  }

  /**
   * Validate AI configuration
   */
  validateConfig(config: Partial<AIModelConfig>): { valid: boolean; errors: string[] } {
    try {
      aiModelConfigSchema.parse(config);
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        };
      }
      return { valid: false, errors: ['Unknown validation error'] };
    }
  }

  /**
   * Test AI service connection
   */
  async testConnection(config: AIModelConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const testRequest: KeywordGenerationRequest = {
        content: 'Test content for AI connection',
        promptText: 'Generate 3 test keywords: {{content}}',
        targetCount: 3,
        aiConfig: config,
      };

      const response = await this.generateKeywords(testRequest);

      if (response.error) {
        return { success: false, error: response.error };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }
}

// Export singleton instance
export const aiService = AIService.getInstance();