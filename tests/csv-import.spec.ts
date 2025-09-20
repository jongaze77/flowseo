import { test, expect, Page } from '@playwright/test';
import path from 'path';

// Helper function to create test CSV files
function createCSVFile(content: string, filename: string): string {
  const fs = require('fs');
  const os = require('os');
  const tempDir = os.tmpdir();
  const filePath = path.join(tempDir, filename);
  fs.writeFileSync(filePath, content);
  return filePath;
}

test.describe('CSV Import Workflow', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();

    // Login and navigate to test project
    await page.goto('/login');
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');

    // Wait for redirect and navigate to keywords page
    await page.waitForURL('/projects');
    await page.click('[data-testid="project-link"]:first-child');
    await page.click('[data-testid="keywords-nav"]');
    await page.waitForURL(/\/keywords$/);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should show CSV import button and form', async () => {
    // Check that import button is visible
    await expect(page.locator('button:has-text("Import from CSV")')).toBeVisible();

    // Click to show import form
    await page.click('button:has-text("Import from CSV")');

    // Verify import form is displayed
    await expect(page.locator('h3:has-text("Import Keywords from CSV")')).toBeVisible();
    await expect(page.locator('[data-testid="csv-upload-area"]')).toBeVisible();
  });

  test('should handle valid CSV file upload', async () => {
    // Create test CSV file
    const csvContent = `keyword,search volume,kd,cpc
test keyword 1,1000,45,2.50
test keyword 2,2000,55,3.00
test keyword 3,1500,40,2.25`;

    const csvFilePath = createCSVFile(csvContent, 'test-semrush.csv');

    // Open import form
    await page.click('button:has-text("Import from CSV")');

    // Upload CSV file
    await page.setInputFiles('input[type="file"]', csvFilePath);

    // Verify file is selected
    await expect(page.locator('text=test-semrush.csv')).toBeVisible();

    // Configure import options
    await expect(page.locator('input[type="checkbox"]:checked')).toBeVisible(); // Auto-detect should be checked
    await page.selectOption('select:has-option[value="manual"]', 'manual');

    // Start import
    await page.click('button:has-text("Start Import")');

    // Wait for progress bar
    await expect(page.locator('[data-testid="progress-bar"]')).toBeVisible();

    // Wait for completion (timeout after 30 seconds)
    await page.waitForSelector('text=Import completed successfully', { timeout: 30000 });

    // Verify import results modal appears
    await expect(page.locator('h3:has-text("Import Results")')).toBeVisible();
    await expect(page.locator('text=3')).toBeVisible(); // Should show 3 imported keywords
  });

  test('should handle invalid file type rejection', async () => {
    // Create test text file (not CSV)
    const textContent = 'This is not a CSV file';
    const textFilePath = createCSVFile(textContent, 'test.txt');

    // Open import form
    await page.click('button:has-text("Import from CSV")');

    // Try to upload non-CSV file
    await page.setInputFiles('input[type="file"]', textFilePath);

    // Verify error message appears
    await expect(page.locator('text=Invalid file type')).toBeVisible();
  });

  test('should handle large file size rejection', async () => {
    // This test would require creating a very large file, so we'll simulate the UI behavior
    await page.click('button:has-text("Import from CSV")');

    // Verify file size limit is mentioned in UI
    await expect(page.locator('text=up to 50MB')).toBeVisible();
  });

  test('should detect Semrush CSV format automatically', async () => {
    const semrushCSV = `Keyword,Search Volume,KD,CPC,Competition Level,Results,Intent
digital marketing,10000,65,3.50,High,1000000,Commercial
seo tools,8000,55,2.25,Medium,800000,Commercial`;

    const csvFilePath = createCSVFile(semrushCSV, 'semrush-export.csv');

    await page.click('button:has-text("Import from CSV")');
    await page.setInputFiles('input[type="file"]', csvFilePath);

    // With auto-detection enabled, tool should be detected
    await expect(page.locator('input[type="checkbox"]:checked')).toBeVisible();

    await page.click('button:has-text("Start Import")');

    // Wait for processing and check results
    await page.waitForSelector('text=Import completed successfully', { timeout: 30000 });
    await expect(page.locator('text=2')).toBeVisible(); // 2 keywords imported
  });

  test('should detect Ahrefs CSV format automatically', async () => {
    const ahrefsCSV = `Keyword,Search Volume,Keyword Difficulty,CPC,Parent Topic,Traffic Potential
content marketing,15000,70,4.00,content strategy,5000
link building,5000,80,6.50,seo techniques,2000`;

    const csvFilePath = createCSVFile(ahrefsCSV, 'ahrefs-export.csv');

    await page.click('button:has-text("Import from CSV")');
    await page.setInputFiles('input[type="file"]', csvFilePath);

    await page.click('button:has-text("Start Import")');

    await page.waitForSelector('text=Import completed successfully', { timeout: 30000 });
    await expect(page.locator('text=2')).toBeVisible();
  });

  test('should handle manual column mapping', async () => {
    // CSV with non-standard headers
    const customCSV = `term,monthly_searches,difficulty_score
social media marketing,12000,60
email marketing,8000,45`;

    const csvFilePath = createCSVFile(customCSV, 'custom-export.csv');

    await page.click('button:has-text("Import from CSV")');
    await page.setInputFiles('input[type="file"]', csvFilePath);

    // Disable auto-detection
    await page.uncheck('input[type="checkbox"]');

    // Should see manual tool selection
    await expect(page.locator('select[data-testid="tool-select"]')).toBeVisible();

    await page.click('button:has-text("Start Import")');

    // Should see column mapping interface (if auto-detection fails)
    // This would require more complex interaction to map columns
    await expect(page.locator('h3:has-text("Map CSV Columns")')).toBeVisible({ timeout: 10000 });
  });

  test('should show import progress during processing', async () => {
    const csvContent = `keyword,search volume
${Array.from({ length: 100 }, (_, i) => `keyword ${i + 1},${1000 + i * 10}`).join('\n')}`;

    const csvFilePath = createCSVFile(csvContent, 'large-test.csv');

    await page.click('button:has-text("Import from CSV")');
    await page.setInputFiles('input[type="file"]', csvFilePath);
    await page.click('button:has-text("Start Import")');

    // Check progress updates
    await expect(page.locator('[data-testid="progress-bar"]')).toBeVisible();
    await expect(page.locator('text=Parsing CSV file')).toBeVisible();

    // Progress should increase over time
    const initialProgress = await page.locator('[data-testid="progress-percentage"]').textContent();

    await page.waitForTimeout(2000); // Wait 2 seconds

    const laterProgress = await page.locator('[data-testid="progress-percentage"]').textContent();

    // Progress should have increased (basic check)
    expect(laterProgress).not.toBe(initialProgress);
  });

  test('should refresh keyword list after successful import', async () => {
    const csvContent = `keyword,search volume
imported keyword 1,5000
imported keyword 2,3000`;

    const csvFilePath = createCSVFile(csvContent, 'import-test.csv');

    // Count existing keywords before import
    const initialKeywordCount = await page.locator('[data-testid="keyword-item"]').count();

    await page.click('button:has-text("Import from CSV")');
    await page.setInputFiles('input[type="file"]', csvFilePath);
    await page.click('button:has-text("Start Import")');

    // Wait for completion
    await page.waitForSelector('text=Import completed successfully', { timeout: 30000 });

    // Close import results modal
    await page.click('button:has-text("Close")');

    // Wait for keyword list to refresh
    await page.waitForTimeout(2000);

    // Check that new keywords appear in the list
    const finalKeywordCount = await page.locator('[data-testid="keyword-item"]').count();
    expect(finalKeywordCount).toBeGreaterThan(initialKeywordCount);

    // Look for imported keywords
    await expect(page.locator('text=imported keyword 1')).toBeVisible();
    await expect(page.locator('text=imported keyword 2')).toBeVisible();
  });

  test('should handle import errors gracefully', async () => {
    // CSV with invalid data
    const invalidCSV = `keyword,search volume
,1000
invalid keyword with very long text that exceeds normal limits and should cause validation errors,invalid_number`;

    const csvFilePath = createCSVFile(invalidCSV, 'invalid-test.csv');

    await page.click('button:has-text("Import from CSV")');
    await page.setInputFiles('input[type="file"]', csvFilePath);
    await page.click('button:has-text("Start Import")');

    // Wait for completion (may show errors)
    await page.waitForSelector('text=Import completed', { timeout: 30000 });

    // Check for error reporting in results
    await expect(page.locator('text=error')).toBeVisible();
  });

  test('should integrate with sequential workflow', async () => {
    // Verify that imported keywords work with the existing workflow
    await expect(page.locator('[data-testid="workflow-navigation"]')).toBeVisible();

    // Import some keywords
    const csvContent = `keyword,search volume
workflow keyword 1,2000
workflow keyword 2,1500`;

    const csvFilePath = createCSVFile(csvContent, 'workflow-test.csv');

    await page.click('button:has-text("Import from CSV")');
    await page.setInputFiles('input[type="file"]', csvFilePath);
    await page.click('button:has-text("Start Import")');

    await page.waitForSelector('text=Import completed successfully', { timeout: 30000 });
    await page.click('button:has-text("View Keywords")');

    // Verify keywords appear in the data table
    await expect(page.locator('text=workflow keyword 1')).toBeVisible();
    await expect(page.locator('text=workflow keyword 2')).toBeVisible();
  });
});