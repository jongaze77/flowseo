import { test, expect } from '@playwright/test';

test.describe('User Registration Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the registration page
    await page.goto('/register');
  });

  test('should display registration form', async ({ page }) => {
    // Check that the registration form is visible
    await expect(page.locator('h2')).toContainText('Create Account');

    // Check that all form fields are present
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('input[name="tenantName"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should successfully register a new user and tenant', async ({ page }) => {
    // Generate unique username to avoid conflicts
    const timestamp = Date.now();
    const username = `testuser${timestamp}`;
    const password = 'password123';
    const tenantName = `Test Company ${timestamp}`;

    // Fill out the registration form
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);
    await page.fill('input[name="tenantName"]', tenantName);

    // Submit the form
    await page.click('button[type="submit"]');

    // Wait for success message
    await expect(page.locator('text=Registration Successful!')).toBeVisible();
    await expect(page.locator('text=Your account and tenant have been created successfully.')).toBeVisible();
  });

  test('should show validation errors for invalid input', async ({ page }) => {
    // Submit form with invalid data
    await page.fill('input[name="username"]', 'ab'); // Too short
    await page.fill('input[name="password"]', '123'); // Too short
    await page.fill('input[name="tenantName"]', ''); // Empty

    await page.click('button[type="submit"]');

    // Check for validation error messages
    await expect(page.locator('text=Username must be at least 3 characters')).toBeVisible();
    await expect(page.locator('text=Password must be at least 8 characters')).toBeVisible();
    await expect(page.locator('text=Tenant name is required')).toBeVisible();
  });

  test('should redirect to dashboard after successful registration', async ({ page }) => {
    // Generate unique data
    const timestamp = Date.now();
    const username = `testuser${timestamp}`;
    const password = 'password123';
    const tenantName = `Test Company ${timestamp}`;

    // Fill out and submit registration form
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);
    await page.fill('input[name="tenantName"]', tenantName);
    await page.click('button[type="submit"]');

    // Wait for success message
    await expect(page.locator('text=Registration Successful!')).toBeVisible();
    await expect(page.locator('text=Redirecting to your dashboard...')).toBeVisible();

    // Wait for redirect to dashboard
    await page.waitForURL('/dashboard');
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('should clear field errors when user starts typing', async ({ page }) => {
    // Submit form with invalid data to trigger errors
    await page.fill('input[name="username"]', 'ab');
    await page.click('button[type="submit"]');

    // Verify error is shown
    await expect(page.locator('text=Username must be at least 3 characters')).toBeVisible();

    // Start typing in the username field
    await page.fill('input[name="username"]', 'valid_username');

    // Error should disappear
    await expect(page.locator('text=Username must be at least 3 characters')).not.toBeVisible();
  });

  test('should disable submit button while submitting', async ({ page }) => {
    const timestamp = Date.now();

    await page.fill('input[name="username"]', `testuser${timestamp}`);
    await page.fill('input[name="password"]', 'password123');
    await page.fill('input[name="tenantName"]', `Test Company ${timestamp}`);

    // Click submit and immediately check if button is disabled
    await page.click('button[type="submit"]');

    // Check that the button shows submitting state
    await expect(page.locator('button[type="submit"]')).toContainText('Creating Account...');
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
  });

  test('should have proper form labels and accessibility', async ({ page }) => {
    // Check that form labels are properly associated
    await expect(page.locator('label[for="username"]')).toContainText('Username');
    await expect(page.locator('label[for="password"]')).toContainText('Password');
    await expect(page.locator('label[for="tenantName"]')).toContainText('Team/Organization Name');

    // Check input attributes
    await expect(page.locator('input[name="username"]')).toHaveAttribute('type', 'text');
    await expect(page.locator('input[name="password"]')).toHaveAttribute('type', 'password');
    await expect(page.locator('input[name="tenantName"]')).toHaveAttribute('type', 'text');
  });
});