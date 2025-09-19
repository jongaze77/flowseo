import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  const timestamp = Date.now();
  const username = `testuser${timestamp}`;
  const password = 'password123';
  const tenantName = `Test Company ${timestamp}`;

  test.beforeEach(async ({ page }) => {
    // Clear any existing authentication
    await page.context().clearCookies();
  });

  test('should display login form', async ({ page }) => {
    await page.goto('/login');

    // Check that the login form is visible
    await expect(page.locator('h2')).toContainText('Sign in to your account');

    // Check that all form fields are present
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('input[name="tenantId"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    // Try to login with invalid credentials
    await page.fill('input[name="username"]', 'invaliduser');
    await page.fill('input[name="password"]', 'wrongpassword');

    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator('text=Invalid credentials')).toBeVisible();
  });

  test('should require username and password', async ({ page }) => {
    await page.goto('/login');

    // Try to submit empty form
    await page.click('button[type="submit"]');

    // Should show validation error
    await expect(page.locator('text=Username and password are required')).toBeVisible();
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    // Try to access protected dashboard page
    await page.goto('/dashboard');

    // Should redirect to login page
    await expect(page).toHaveURL(/.*\/login/);
    await expect(page.locator('h2')).toContainText('Sign in to your account');

    // URL should contain redirect parameter
    await expect(page).toHaveURL(/.*redirectTo=/);
  });

  test('should complete full authentication flow', async ({ page }) => {
    // First, register a new user
    await page.goto('/register');

    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);
    await page.fill('input[name="tenantName"]', tenantName);

    await page.click('button[type="submit"]');

    // Wait for success message and auto-redirect
    await expect(page.locator('text=Welcome to FlowSEO!')).toBeVisible();

    // Should automatically redirect to dashboard after successful registration
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Should show user information in navigation
    await expect(page.locator('nav')).toContainText(username);
    await expect(page.locator('nav')).toContainText(tenantName);

    // Logout
    await page.click('button:has-text("' + username.charAt(0).toUpperCase() + '")');
    await page.click('button:has-text("Sign out")');

    // Should redirect to login page
    await expect(page).toHaveURL(/.*\/login/);

    // Now test manual login
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);

    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Should show user information again
    await expect(page.locator('nav')).toContainText(username);
    await expect(page.locator('nav')).toContainText(tenantName);
  });

  test('should maintain session across page refreshes', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*\/dashboard/);

    // Refresh the page
    await page.reload();

    // Should still be authenticated
    await expect(page).toHaveURL(/.*\/dashboard/);
    await expect(page.locator('nav')).toContainText(username);
  });

  test('should protect user management page', async ({ page }) => {
    // Try to access users page without authentication
    await page.goto('/users');

    // Should redirect to login
    await expect(page).toHaveURL(/.*\/login/);

    // Login first
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    // Now should be able to access users page
    await page.goto('/users');
    await expect(page).toHaveURL(/.*\/users/);
    await expect(page.locator('h1')).toContainText('User Management');
  });

  test('should handle redirect after login', async ({ page }) => {
    // Try to access users page (should redirect to login with redirect param)
    await page.goto('/users');
    await expect(page).toHaveURL(/.*\/login.*redirectTo=%2Fusers/);

    // Login
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    // Should redirect back to users page
    await expect(page).toHaveURL(/.*\/users/);
    await expect(page.locator('h1')).toContainText('User Management');
  });

  test('should handle session expiration', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*\/dashboard/);

    // Clear cookies to simulate session expiration
    await page.context().clearCookies();

    // Try to access protected page
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('should show tenant-specific user menu', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*\/dashboard/);

    // Click on user menu
    await page.click('button:has-text("' + username.charAt(0).toUpperCase() + '")');

    // Should show tenant name in dropdown
    await expect(page.locator('[role="menu"], .absolute')).toContainText(tenantName);
    await expect(page.locator('[role="menu"], .absolute')).toContainText('Sign out');
  });
});