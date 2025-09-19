// @ts-nocheck
import { test, expect } from '@playwright/test';

test.describe('Keyword Generation Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock AI API responses for testing
    await page.route('**/api/v1/ai/test-connection', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.route('**/api/v1/ai/settings', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            aiSettings: [{
              provider: 'openai',
              model: 'gpt-4o-mini',
              hasApiKey: true,
              maxTokens: 4000,
              temperature: 0.7,
            }],
            prompts: [{
              id: 'prompt-1',
              name: 'Default Keyword Generation',
              prompt_text: 'Generate keywords for: {{content}}',
              ai_model: 'gpt-4o-mini',
            }],
          }),
        });
      }
    });

    await page.route('**/api/v1/projects/*/pages/*/keywords', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          keywordList: {
            id: 'keyword-list-1',
            name: 'Test Keywords',
            keywords: [
              { id: 'kw-1', text: 'web development', search_volume: 5000, difficulty: 45 },
              { id: 'kw-2', text: 'SEO optimization', search_volume: 3200, difficulty: 38 },
              { id: 'kw-3', text: 'frontend development', search_volume: 4100, difficulty: 52 },
            ],
            project: { id: 'project-1', name: 'Test Project' },
            page: { id: 'page-1', title: 'Test Page', url: null },
          },
          aiMetadata: {
            tokensUsed: 150,
            processingTime: 2500,
            keywordsGenerated: 3,
          },
        }),
      });
    });

    await page.route('**/api/v1/projects/*/keywords', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [{
              id: 'keyword-list-1',
              name: 'Test Keywords',
              generated_at: new Date().toISOString(),
              keywords: [
                { id: 'kw-1', text: 'web development', search_volume: 5000, difficulty: 45 },
                { id: 'kw-2', text: 'SEO optimization', search_volume: 3200, difficulty: 38 },
                { id: 'kw-3', text: 'frontend development', search_volume: 4100, difficulty: 52 },
              ],
              project: { id: 'project-1', name: 'Test Project' },
              page: { id: 'page-1', title: 'Test Page', url: null },
            }],
            pagination: { page: 1, totalPages: 1, totalCount: 1 },
          }),
        });
      } else if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
    });

    // Mock project and pages endpoints
    await page.route('**/api/v1/projects/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          project: {
            id: 'project-1',
            name: 'Test Project',
            domain: 'example.com',
            tenantId: 'tenant-1',
            tenantName: 'Test Tenant',
          },
        }),
      });
    });

    await page.route('**/api/v1/projects/*/pages', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          pages: [{
            id: 'page-1',
            title: 'Test Page',
            content: 'This is test content about web development and SEO optimization.',
            url: 'https://example.com/test',
            createdAt: new Date().toISOString(),
          }],
        }),
      });
    });
  });

  test('should complete keyword generation workflow', async ({ page }) => {
    // Navigate to keywords page (assuming user is already authenticated)
    await page.goto('/projects/project-1/keywords');

    // Page should load with project information
    await expect(page.getByText('Keyword Generation')).toBeVisible();
    await expect(page.getByText('Test Project')).toBeVisible();

    // Select a page to analyze
    await page.getByRole('combobox').selectOption('page-1');
    await expect(page.getByDisplayValue('page-1')).toBeVisible();

    // Fill in keyword list name
    await page.getByLabel('Keyword List Name').fill('My Test Keywords');

    // Adjust target count
    await page.getByLabel(/Number of Keywords/).fill('50');

    // Select prompt template
    await page.getByLabel('Prompt Template').selectOption('prompt-1');

    // Generate keywords
    await page.getByRole('button', { name: 'Generate Keywords' }).click();

    // Should show progress indicators
    await expect(page.getByText('Generating...')).toBeVisible();
    await expect(page.getByRole('progressbar')).toBeVisible();

    // Wait for completion
    await expect(page.getByText('Generated 3 keywords successfully!')).toBeVisible({ timeout: 10000 });

    // Should show generated keywords in the list
    await expect(page.getByText('My Test Keywords')).toBeVisible();
    await expect(page.getByText('web development')).toBeVisible();
    await expect(page.getByText('SEO optimization')).toBeVisible();
    await expect(page.getByText('frontend development')).toBeVisible();
  });

  test('should handle AI configuration workflow', async ({ page }) => {
    // Navigate to a page where AI settings can be configured
    await page.goto('/projects/project-1/keywords');

    // Check if configuration warning appears when no AI settings
    await page.route('**/api/v1/ai/settings', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          aiSettings: [],
          prompts: [],
        }),
      });
    });

    await page.reload();

    // Should show configuration warning
    await expect(page.getByText('Configuration Required')).toBeVisible();
    await expect(page.getByText('Please configure AI settings')).toBeVisible();
  });

  test('should copy keywords to clipboard', async ({ page }) => {
    await page.goto('/projects/project-1/keywords');

    // Wait for keywords to load
    await expect(page.getByText('Test Keywords')).toBeVisible();

    // Test copy functionality
    await page.getByRole('button', { name: 'Copy' }).first().click();

    // Should show success state
    await expect(page.getByText('Copied!')).toBeVisible();
  });

  test('should delete keyword list', async ({ page }) => {
    await page.goto('/projects/project-1/keywords');

    // Wait for keywords to load
    await expect(page.getByText('Test Keywords')).toBeVisible();

    // Click delete button
    await page.getByRole('button', { name: 'Delete' }).click();

    // Should show confirmation modal
    await expect(page.getByText('Delete Keyword List')).toBeVisible();
    await expect(page.getByText('Are you sure you want to delete')).toBeVisible();

    // Confirm deletion
    await page.getByRole('button', { name: 'Delete' }).last().click();

    // Should remove the keyword list from the page
    await expect(page.getByText('Test Keywords')).not.toBeVisible();
  });

  test('should handle navigation between content and keywords', async ({ page }) => {
    // Start at content page
    await page.goto('/projects/project-1/content');

    // Should have "Generate Keywords" button in header
    await expect(page.getByRole('button', { name: 'Generate Keywords' })).toBeVisible();

    // Click to navigate to keywords page
    await page.getByRole('button', { name: 'Generate Keywords' }).click();

    // Should navigate to keywords page
    await expect(page).toHaveURL('/projects/project-1/keywords');
    await expect(page.getByText('Keyword Generation')).toBeVisible();

    // Should have navigation back to content
    await expect(page.getByRole('button', { name: 'View Content' })).toBeVisible();

    // Click to go back to content
    await page.getByRole('button', { name: 'View Content' }).click();

    // Should navigate back to content page
    await expect(page).toHaveURL('/projects/project-1/content');
  });

  test('should handle error states gracefully', async ({ page }) => {
    // Mock error response for keyword generation
    await page.route('**/api/v1/projects/*/pages/*/keywords', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'AI service unavailable',
          details: 'The AI service is currently experiencing issues',
        }),
      });
    });

    await page.goto('/projects/project-1/keywords');

    // Try to generate keywords
    await page.getByRole('combobox').selectOption('page-1');
    await page.getByLabel('Keyword List Name').fill('Test Keywords');
    await page.getByRole('button', { name: 'Generate Keywords' }).click();

    // Should show error modal
    await expect(page.getByText('Keyword Generation Failed')).toBeVisible();
    await expect(page.getByText('AI service unavailable')).toBeVisible();

    // Close error modal
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByText('Keyword Generation Failed')).not.toBeVisible();
  });

  test('should validate form inputs', async ({ page }) => {
    await page.goto('/projects/project-1/keywords');

    // Try to generate without selecting a page
    await page.getByRole('button', { name: 'Generate Keywords' }).click();

    // Should show validation errors
    await expect(page.getByText('Please select a page')).toBeVisible();

    // Select page but leave name empty
    await page.getByRole('combobox').selectOption('page-1');
    await page.getByLabel('Keyword List Name').clear();
    await page.getByRole('button', { name: 'Generate Keywords' }).click();

    // Should show validation error for name
    await expect(page.getByText('Keyword list name is required')).toBeVisible();
  });

  test('should show keyword statistics and metadata', async ({ page }) => {
    await page.goto('/projects/project-1/keywords');

    // Wait for keyword list to load
    await expect(page.getByText('Test Keywords')).toBeVisible();

    // Should show keyword count
    await expect(page.getByText('Total Keywords: 3')).toBeVisible();

    // Should show average difficulty
    await expect(page.getByText(/Avg\. Difficulty: \d+/)).toBeVisible();

    // Should show individual keyword details
    await expect(page.getByText('Volume: 5,000')).toBeVisible();
    await expect(page.getByText('Volume: 3,200')).toBeVisible();
    await expect(page.getByText('Volume: 4,100')).toBeVisible();

    // Should show difficulty levels
    await expect(page.getByText('Medium (45)')).toBeVisible();
    await expect(page.getByText('Easy (38)')).toBeVisible();
    await expect(page.getByText('Medium (52)')).toBeVisible();
  });
});