import { test, expect } from '@playwright/test';

// Test data
const testTenant = {
  name: 'E2E Test Company Content',
};

const testUser = {
  username: 'testuser_content',
  password: 'testpassword123',
};

const testProject = {
  name: 'Content Test Project',
  domain: 'content-test.com',
};

const testContent = {
  html: `<html>
    <head><title>Test HTML Page</title></head>
    <body>
      <h1>Main Heading</h1>
      <p>This is test HTML content for the content ingestion feature.</p>
      <p>It contains multiple paragraphs to test content extraction.</p>
    </body>
  </html>`,
  markdown: `# Test Markdown Page

This is test markdown content for the content ingestion feature.

## Section 1

Content with **bold** and *italic* text.

## Section 2

More content to test the markdown processing.`,
  url: 'https://example.com', // This would normally be mocked in a real test
};

test.describe('Content Ingestion', () => {
  test.beforeEach(async ({ page }) => {
    // Register a new tenant and user for testing
    await page.goto('/register');

    await page.fill('input[name="tenantName"]', testTenant.name);
    await page.fill('input[name="username"]', testUser.username);
    await page.fill('input[name="password"]', testUser.password);

    await page.click('button[type="submit"]');

    // Should be redirected to dashboard after successful registration
    await expect(page).toHaveURL('/dashboard');

    // Create a test project
    await page.click('a[href="/projects"]');
    await expect(page).toHaveURL('/projects');

    await page.click('button:has-text("New Project")');
    await page.fill('input[name="name"]', testProject.name);
    await page.fill('input[name="domain"]', testProject.domain);
    await page.click('button[type="submit"]:has-text("Create Project")');

    // Wait for project to appear in list
    await expect(page.locator(`text=${testProject.name}`)).toBeVisible();
  });

  test('should navigate to content ingestion page', async ({ page }) => {
    // Click Content button for the test project
    const projectRow = page.locator(`text=${testProject.name}`).locator('..');
    await projectRow.locator('a:has-text("Content")').click();

    // Should navigate to content page
    await expect(page.url()).toMatch(/\/projects\/[^\/]+\/content$/);
    await expect(page.locator('h1')).toContainText(testProject.name);
    await expect(page.locator('text=Add and manage content for keyword research')).toBeVisible();
  });

  test('should display content ingestion form with tabs', async ({ page }) => {
    // Navigate to content page
    const projectRow = page.locator(`text=${testProject.name}`).locator('..');
    await projectRow.locator('a:has-text("Content")').click();

    // Check form title
    await expect(page.locator('text=Add Content to Project')).toBeVisible();

    // Check tabs
    await expect(page.locator('button:has-text("Scrape URL")')).toBeVisible();
    await expect(page.locator('button:has-text("Paste HTML")')).toBeVisible();
    await expect(page.locator('button:has-text("Paste Markdown")')).toBeVisible();

    // Default tab should be URL
    await expect(page.locator('label:has-text("Website URL")')).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    // Navigate to content page
    const projectRow = page.locator(`text=${testProject.name}`).locator('..');
    await projectRow.locator('a:has-text("Content")').click();

    // Try to submit empty URL form
    await page.click('button:has-text("Process URL")');
    await expect(page.locator('text=Please enter a valid URL')).toBeVisible();

    // Switch to HTML tab and try to submit empty
    await page.click('button:has-text("Paste HTML")');
    await page.click('button:has-text("Process Content")');
    await expect(page.locator('text=Content must be at least 10 characters')).toBeVisible();
  });

  test('should process HTML content successfully', async ({ page }) => {
    // Navigate to content page
    const projectRow = page.locator(`text=${testProject.name}`).locator('..');
    await projectRow.locator('a:has-text("Content")').click();

    // Switch to HTML tab
    await page.click('button:has-text("Paste HTML")');

    // Fill in HTML content
    await page.fill('textarea[id="htmlContent"]', testContent.html);

    // Submit form
    await page.click('button:has-text("Process Content")');

    // Should show processing state
    await expect(page.locator('text=Processing...')).toBeVisible();

    // Should show content preview
    await expect(page.locator('text=Content Preview')).toBeVisible();
    await expect(page.locator('text=Test HTML Page')).toBeVisible();
    await expect(page.locator('text=Main Heading')).toBeVisible();
    await expect(page.locator('text=test HTML content for the content ingestion')).toBeVisible();

    // Should show character count
    await expect(page.locator('text=Content (')).toBeVisible();
    await expect(page.locator('text=characters)')).toBeVisible();
  });

  test('should process markdown content successfully', async ({ page }) => {
    // Navigate to content page
    const projectRow = page.locator(`text=${testProject.name}`).locator('..');
    await projectRow.locator('a:has-text("Content")').click();

    // Switch to Markdown tab
    await page.click('button:has-text("Paste Markdown")');

    // Fill in markdown content
    await page.fill('textarea[id="markdownContent"]', testContent.markdown);

    // Submit form
    await page.click('button:has-text("Process Content")');

    // Should show content preview
    await expect(page.locator('text=Content Preview')).toBeVisible();
    await expect(page.locator('text=Test Markdown Page')).toBeVisible();
    await expect(page.locator('text=test markdown content for the content ingestion')).toBeVisible();
  });

  test('should save content and show in sidebar', async ({ page }) => {
    // Navigate to content page
    const projectRow = page.locator(`text=${testProject.name}`).locator('..');
    await projectRow.locator('a:has-text("Content")').click();

    // Initially sidebar should show no content
    await expect(page.locator('text=No content yet')).toBeVisible();
    await expect(page.locator('text=0 pages')).toBeVisible();

    // Add HTML content
    await page.click('button:has-text("Paste HTML")');
    await page.fill('textarea[id="htmlContent"]', testContent.html);
    await page.click('button:has-text("Process Content")');

    // Confirm save
    await expect(page.locator('text=Content Preview')).toBeVisible();
    await page.click('button:has-text("Save Content")');

    // Should return to form and show content in sidebar
    await expect(page.locator('text=Add Content to Project')).toBeVisible();
    await expect(page.locator('text=1 page')).toBeVisible();
    await expect(page.locator('text=Test HTML Page')).toBeVisible();
  });

  test('should allow custom title override', async ({ page }) => {
    // Navigate to content page
    const projectRow = page.locator(`text=${testProject.name}`).locator('..');
    await projectRow.locator('a:has-text("Content")').click();

    // Add custom title
    await page.fill('input[id="title"]', 'My Custom Title');

    // Add HTML content
    await page.click('button:has-text("Paste HTML")');
    await page.fill('textarea[id="htmlContent"]', testContent.html);
    await page.click('button:has-text("Process Content")');

    // Should show custom title in preview (if used by backend)
    await expect(page.locator('text=Content Preview')).toBeVisible();
  });

  test('should handle content cancellation', async ({ page }) => {
    // Navigate to content page
    const projectRow = page.locator(`text=${testProject.name}`).locator('..');
    await projectRow.locator('a:has-text("Content")').click();

    // Add HTML content
    await page.click('button:has-text("Paste HTML")');
    await page.fill('textarea[id="htmlContent"]', testContent.html);
    await page.click('button:has-text("Process Content")');

    // Should show preview
    await expect(page.locator('text=Content Preview')).toBeVisible();

    // Cancel
    await page.click('button:has-text("Cancel")');

    // Should return to form
    await expect(page.locator('text=Add Content to Project')).toBeVisible();
    await expect(page.locator('text=No content yet')).toBeVisible();
  });

  test('should reset form when switching tabs', async ({ page }) => {
    // Navigate to content page
    const projectRow = page.locator(`text=${testProject.name}`).locator('..');
    await projectRow.locator('a:has-text("Content")').click();

    // Fill URL field
    await page.fill('input[id="url"]', 'https://example.com');

    // Switch to HTML tab
    await page.click('button:has-text("Paste HTML")');

    // Switch back to URL tab
    await page.click('button:has-text("Scrape URL")');

    // URL field should be empty
    await expect(page.locator('input[id="url"]')).toHaveValue('');
  });

  test('should show proper loading states', async ({ page }) => {
    // Navigate to content page
    const projectRow = page.locator(`text=${testProject.name}`).locator('..');
    await projectRow.locator('a:has-text("Content")').click();

    // Add HTML content
    await page.click('button:has-text("Paste HTML")');
    await page.fill('textarea[id="htmlContent"]', testContent.html);

    // Click submit and check for loading state
    await page.click('button:has-text("Process Content")');

    // Should show processing state
    await expect(page.locator('text=Processing...')).toBeVisible();

    // Button should be disabled
    await expect(page.locator('button:has-text("Processing...")')).toBeDisabled();
  });

  test('should maintain project context throughout workflow', async ({ page }) => {
    // Navigate to content page
    const projectRow = page.locator(`text=${testProject.name}`).locator('..');
    await projectRow.locator('a:has-text("Content")').click();

    // Check project context is displayed
    await expect(page.locator('h1')).toContainText(testProject.name);
    await expect(page.locator(`text=Domain: ${testProject.domain}`)).toBeVisible();

    // Back to projects should work
    await page.click('button:has-text("Back to Projects")');
    await expect(page).toHaveURL('/projects');
  });

  test('should display content details in sidebar', async ({ page }) => {
    // Navigate to content page
    const projectRow = page.locator(`text=${testProject.name}`).locator('..');
    await projectRow.locator('a:has-text("Content")').click();

    // Add content with both HTML and Markdown to test multiple entries
    await page.click('button:has-text("Paste HTML")');
    await page.fill('textarea[id="htmlContent"]', testContent.html);
    await page.click('button:has-text("Process Content")');
    await page.click('button:has-text("Save Content")');

    // Add second piece of content
    await page.click('button:has-text("Paste Markdown")');
    await page.fill('textarea[id="markdownContent"]', testContent.markdown);
    await page.click('button:has-text("Process Content")');
    await page.click('button:has-text("Save Content")');

    // Should show both pieces of content
    await expect(page.locator('text=2 pages')).toBeVisible();
    await expect(page.locator('text=Test HTML Page')).toBeVisible();
    await expect(page.locator('text=Test Markdown Page')).toBeVisible();

    // Should show timestamps
    await expect(page.locator('text=Added')).toBeVisible();
  });

  test('should handle authentication requirement', async ({ page }) => {
    // Log out first
    await page.click('button:has-text("Logout")');
    await expect(page).toHaveURL('/login');

    // Try to access content page directly
    await page.goto('/projects/some-id/content');

    // Should redirect to login
    await expect(page).toHaveURL('/login');
  });
});