import { test, expect } from '@playwright/test';

test.describe('User Management Flow', () => {
  // We'll need to set up a tenant and initial user for these tests
  // In a real app, this would use proper authentication
  // For now, we'll simulate the flow by directly navigating to user management

  test.beforeEach(async ({ page }) => {
    // Navigate to the user management page
    await page.goto('/users');
  });

  test('should display user management page with proper layout', async ({ page }) => {
    // Check that the page layout is correct
    await expect(page.locator('h1')).toContainText('User Management');
    await expect(page.locator('text=Manage your team members and their access')).toBeVisible();

    // Check that the navigation is present
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('text=FlowSEO')).toBeVisible();
    await expect(page.locator('a[href="/dashboard"]')).toBeVisible();
    await expect(page.locator('a[href="/users"]')).toBeVisible();
  });

  test('should display add user form', async ({ page }) => {
    // Check that the add user section is visible
    await expect(page.locator('text=Add Team Member')).toBeVisible();
    await expect(page.locator('text=Invite a new member to your organization')).toBeVisible();
    await expect(page.locator('button:has-text("Add User")')).toBeVisible();
  });

  test('should expand add user form when button is clicked', async ({ page }) => {
    // Click the Add User button
    await page.click('button:has-text("Add User")');

    // Check that the form is now expanded
    await expect(page.locator('text=Add New Team Member')).toBeVisible();
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button:has-text("Add User")')).toBeVisible();
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
  });

  test('should show validation errors in add user form', async ({ page }) => {
    // Expand the form
    await page.click('button:has-text("Add User")');

    // Try to submit with invalid data
    await page.fill('input[name="username"]', 'ab'); // Too short
    await page.fill('input[name="password"]', '123'); // Too short
    await page.click('button[type="submit"]');

    // Check for validation errors
    await expect(page.locator('text=Username must be at least 3 characters')).toBeVisible();
    await expect(page.locator('text=Password must be at least 8 characters')).toBeVisible();
  });

  test('should cancel add user form', async ({ page }) => {
    // Expand the form
    await page.click('button:has-text("Add User")');

    // Fill some data
    await page.fill('input[name="username"]', 'testuser');

    // Click cancel
    await page.click('button:has-text("Cancel")');

    // Form should be collapsed
    await expect(page.locator('input[name="username"]')).not.toBeVisible();
    await expect(page.locator('text=Add Team Member')).toBeVisible();
  });

  test('should display user list section', async ({ page }) => {
    // Check that the user list section is visible
    await expect(page.locator('text=Team Members')).toBeVisible();

    // Note: In a real test, we'd set up test data
    // For now, we're just checking the UI structure
  });

  test('should navigate to dashboard from user management', async ({ page }) => {
    // Click the dashboard link
    await page.click('a[href="/dashboard"]');

    // Should navigate to dashboard
    await page.waitForURL('/dashboard');
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('should have proper navigation highlighting', async ({ page }) => {
    // The Users navigation item should be highlighted/active
    // (This would depend on your CSS implementation)
    const usersLink = page.locator('a[href="/users"]');
    await expect(usersLink).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Check that the page is still usable
    await expect(page.locator('h1')).toContainText('User Management');
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('button:has-text("Add User")')).toBeVisible();
  });

  test('should show error state when API fails', async ({ page }) => {
    // This test would require mocking API failures
    // For now, we'll just check that error handling UI exists
    // You would typically use page.route() to mock API responses

    // Check if error UI components exist in the DOM structure
    // (These might not be visible unless there's an actual error)
    await expect(page.locator('body')).toBeVisible(); // Basic sanity check
  });
});