import { jest } from '@jest/globals';
import {
  validateUrl,
  extractContentFromHtml,
  processMarkdownContent,
  processContent,
  scrapeUrl
} from '../webScraper';

// Mock fetch globally
global.fetch = jest.fn();

describe('webScraper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUrl', () => {
    it('should validate and return a valid HTTPS URL', () => {
      const result = validateUrl('https://example.com');
      expect(result).toBe('https://example.com');
    });

    it('should validate and return a valid HTTP URL', () => {
      const result = validateUrl('http://example.com');
      expect(result).toBe('http://example.com');
    });

    it('should add https:// to URLs without protocol', () => {
      const result = validateUrl('example.com');
      expect(result).toBe('https://example.com');
    });

    it('should throw error for invalid URLs', () => {
      expect(() => validateUrl('not-a-url')).toThrow('Please enter a valid URL');
      expect(() => validateUrl('')).toThrow('Please enter a valid URL');
    });
  });

  describe('extractContentFromHtml', () => {
    it('should extract title and content from basic HTML', () => {
      const html = `
        <html>
          <head><title>Test Page</title></head>
          <body>
            <h1>Main Heading</h1>
            <p>This is the main content of the page.</p>
          </body>
        </html>
      `;

      const result = extractContentFromHtml(html);

      expect(result.title).toBe('Test Page');
      expect(result.content).toContain('Main Heading');
      expect(result.content).toContain('This is the main content');
    });

    it('should remove script and style elements', () => {
      const html = `
        <html>
          <head>
            <title>Test Page</title>
            <style>body { color: red; }</style>
          </head>
          <body>
            <script>console.log('test');</script>
            <p>Main content</p>
          </body>
        </html>
      `;

      const result = extractContentFromHtml(html);

      expect(result.content).not.toContain('console.log');
      expect(result.content).not.toContain('color: red');
      expect(result.content).toContain('Main content');
    });

    it('should extract title from h1 if no title tag', () => {
      const html = `
        <html>
          <body>
            <h1>Page Title from H1</h1>
            <p>Content here</p>
          </body>
        </html>
      `;

      const result = extractContentFromHtml(html);

      expect(result.title).toBe('Page Title from H1');
    });

    it('should extract title from og:title meta tag', () => {
      const html = `
        <html>
          <head>
            <meta property="og:title" content="OG Title">
          </head>
          <body>
            <p>Content here</p>
          </body>
        </html>
      `;

      const result = extractContentFromHtml(html);

      expect(result.title).toBe('OG Title');
    });

    it('should find main content in article tags', () => {
      const html = `
        <html>
          <body>
            <nav>Navigation content</nav>
            <article>
              <h1>Article Title</h1>
              <p>This is the main article content that should be extracted.</p>
            </article>
            <footer>Footer content</footer>
          </body>
        </html>
      `;

      const result = extractContentFromHtml(html);

      expect(result.content).toContain('Article Title');
      expect(result.content).toContain('main article content');
      expect(result.content).not.toContain('Navigation content');
      expect(result.content).not.toContain('Footer content');
    });
  });

  describe('processMarkdownContent', () => {
    it('should extract title from first h1', () => {
      const markdown = `# Main Title

This is some content.

## Subtitle

More content here.`;

      const result = processMarkdownContent(markdown);

      expect(result.title).toBe('Main Title');
      expect(result.content).toContain('Main Title');
      expect(result.content).toContain('This is some content');
    });

    it('should return null title if no h1', () => {
      const markdown = `## Subtitle

This is some content without a main title.`;

      const result = processMarkdownContent(markdown);

      expect(result.title).toBeNull();
      expect(result.content).toContain('Subtitle');
    });

    it('should clean up multiple newlines', () => {
      const markdown = `# Title


Too many newlines here.



Should be cleaned up.`;

      const result = processMarkdownContent(markdown);

      // Should not have more than double newlines
      expect(result.content).not.toMatch(/\n{3,}/);
    });
  });

  describe('scrapeUrl', () => {
    it('should successfully scrape a valid URL', async () => {
      const mockHtml = `
        <html>
          <head><title>Test Page</title></head>
          <body><p>Test content</p></body>
        </html>
      `;

      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: jest.fn().mockResolvedValueOnce(mockHtml),
      } as Response);

      const result = await scrapeUrl('https://example.com');

      expect(result.title).toBe('Test Page');
      expect(result.content).toContain('Test content');
      expect(result.url).toBe('https://example.com');
      expect(result.error).toBeUndefined();
    });

    it('should handle fetch errors gracefully', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(
        new Error('Network error')
      );

      const result = await scrapeUrl('https://example.com');

      expect(result.error).toBe('Network error');
      expect(result.title).toBeNull();
      expect(result.content).toBe('');
    });

    it('should handle HTTP error responses', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      const result = await scrapeUrl('https://example.com');

      expect(result.error).toBe('HTTP 404: Not Found');
    });

    it('should handle non-HTML content types', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
      } as Response);

      const result = await scrapeUrl('https://example.com/api');

      expect(result.error).toBe('URL does not return HTML content');
    });

    it('should handle timeout errors', async () => {
      // Mock AbortError
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';

      (fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(abortError);

      const result = await scrapeUrl('https://example.com');

      expect(result.error).toBe('Request timed out - please try again');
    });

    it('should handle empty content', async () => {
      const mockHtml = '<html><body></body></html>';

      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: jest.fn().mockResolvedValueOnce(mockHtml),
      } as Response);

      const result = await scrapeUrl('https://example.com');

      expect(result.error).toBe('No meaningful content found on this page');
    });
  });

  describe('processContent', () => {
    it('should process URL content type', async () => {
      const mockHtml = `
        <html>
          <head><title>Test Page</title></head>
          <body><p>Test content from URL</p></body>
        </html>
      `;

      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: jest.fn().mockResolvedValueOnce(mockHtml),
      } as Response);

      const result = await processContent('https://example.com', 'url');

      expect(result.title).toBe('Test Page');
      expect(result.content).toContain('Test content from URL');
      expect(result.url).toBe('https://example.com');
    });

    it('should process HTML content type', async () => {
      const html = '<html><head><title>HTML Title</title></head><body><p>HTML content</p></body></html>';

      const result = await processContent(html, 'html');

      expect(result.title).toBe('HTML Title');
      expect(result.content).toContain('HTML content');
      expect(result.url).toBeUndefined();
    });

    it('should process markdown content type', async () => {
      const markdown = '# Markdown Title\n\nMarkdown content here.';

      const result = await processContent(markdown, 'markdown');

      expect(result.title).toBe('Markdown Title');
      expect(result.content).toContain('Markdown content here');
    });

    it('should handle invalid content type', async () => {
      const result = await processContent('test content', 'invalid' as 'url' | 'html' | 'markdown');

      expect(result.error).toBe('Invalid content type');
    });

    it('should return error for failed URL processing', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(
        new Error('Network error')
      );

      const result = await processContent('https://invalid-url.com', 'url');

      expect(result.error).toBe('Network error');
    });
  });
});