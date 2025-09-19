import * as cheerio from 'cheerio';
import { z } from 'zod';

// URL validation schema
export const urlSchema = z.string().url({
  message: "Please enter a valid URL (e.g., https://example.com)"
});

// Content type validation schema
export const contentTypeSchema = z.enum(['url', 'html', 'markdown'], {
  message: "Content type must be 'url', 'html', or 'markdown'"
});

// Scraping result interface
export interface ScrapingResult {
  title: string | null;
  content: string;
  url?: string;
  error?: string;
}

// Configuration for scraping
const SCRAPING_CONFIG = {
  timeout: 10000, // 10 seconds
  maxContentLength: 1000000, // 1MB max content
  userAgent: 'FlowSEO Content Scraper 1.0',
  maxRedirects: 5
};

/**
 * Validates and normalizes a URL
 */
export function validateUrl(url: string): string {
  const result = urlSchema.safeParse(url);
  if (!result.success) {
    throw new Error(result.error.issues[0].message);
  }

  // Ensure URL has protocol
  const normalizedUrl = result.data;
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    return `https://${normalizedUrl}`;
  }

  return normalizedUrl;
}

/**
 * Fetches content from a URL with timeout and error handling
 */
async function fetchUrlContent(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SCRAPING_CONFIG.timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': SCRAPING_CONFIG.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      redirect: 'follow'
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      throw new Error('URL does not return HTML content');
    }

    const content = await response.text();

    if (content.length > SCRAPING_CONFIG.maxContentLength) {
      throw new Error('Content is too large to process');
    }

    return content;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out - please try again');
      }
      throw error;
    }

    throw new Error('Failed to fetch content from URL');
  }
}

/**
 * Extracts and cleans content from HTML
 */
export function extractContentFromHtml(html: string): { title: string | null; content: string } {
  const $ = cheerio.load(html);

  // Remove script and style elements
  $('script, style, noscript, iframe, object, embed').remove();

  // Extract title
  const title = $('title').first().text().trim() ||
                $('h1').first().text().trim() ||
                $('meta[property="og:title"]').attr('content') ||
                null;

  // Extract main content
  let content = '';

  // Try to find main content areas
  const contentSelectors = [
    'main',
    'article',
    '[role="main"]',
    '.content',
    '.main-content',
    '#content',
    '#main-content',
    '.post-content',
    '.entry-content'
  ];

  let contentElement = null;
  for (const selector of contentSelectors) {
    const element = $(selector).first();
    if (element.length > 0 && element.text().trim().length > 100) {
      contentElement = element;
      break;
    }
  }

  // If no main content found, use body
  if (!contentElement) {
    contentElement = $('body');
  }

  // Remove navigation, footer, sidebar elements
  contentElement.find('nav, footer, aside, .navigation, .nav, .footer, .sidebar, .ads, .advertisement').remove();

  // Extract text content
  content = contentElement.text()
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
    .replace(/\n\s*\n/g, '\n') // Remove empty lines
    .trim();

  return {
    title: title || null,
    content: content || ''
  };
}

/**
 * Cleans and processes markdown content
 */
export function processMarkdownContent(markdown: string): { title: string | null; content: string } {
  // Extract title from first h1 if present
  const lines = markdown.split('\n');
  let title: string | null = null;

  const firstH1Match = lines.find(line => line.startsWith('# '));
  if (firstH1Match) {
    title = firstH1Match.replace(/^# /, '').trim();
  }

  // Clean up the markdown content
  const content = markdown
    .replace(/^\s+|\s+$/g, '') // Trim whitespace
    .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double newlines
    .trim();

  return {
    title,
    content
  };
}

/**
 * Scrapes content from a URL
 */
export async function scrapeUrl(url: string): Promise<ScrapingResult> {
  try {
    const validatedUrl = validateUrl(url);
    const html = await fetchUrlContent(validatedUrl);
    const { title, content } = extractContentFromHtml(html);

    if (!content || content.length < 10) {
      throw new Error('No meaningful content found on this page');
    }

    return {
      title,
      content,
      url: validatedUrl
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      title: null,
      content: '',
      url,
      error: errorMessage
    };
  }
}

/**
 * Processes content based on type (url, html, or markdown)
 */
export async function processContent(content: string, contentType: 'url' | 'html' | 'markdown'): Promise<ScrapingResult> {
  try {
    const validatedType = contentTypeSchema.parse(contentType);

    switch (validatedType) {
      case 'url':
        return await scrapeUrl(content);

      case 'html':
        const htmlResult = extractContentFromHtml(content);
        return {
          ...htmlResult,
          content: htmlResult.content || content
        };

      case 'markdown':
        const markdownResult = processMarkdownContent(content);
        return {
          ...markdownResult,
          content: markdownResult.content || content
        };

      default:
        throw new Error('Invalid content type');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to process content';
    return {
      title: null,
      content: '',
      error: errorMessage
    };
  }
}