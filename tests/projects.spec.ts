import { test, expect } from '@playwright/test';

// Test data
const testTenant = {
  name: 'E2E Test Company Projects',
};

const testUser = {
  username: 'testuser_projects',
  password: 'testpassword123',
};

const testProject = {
  name: 'E2E Test Project',
  domain: 'e2e-test.com',
};

const updatedProject = {
  name: 'Updated E2E Project',
  domain: 'updated-e2e.com',
};

test.describe('Project Management', () => {
  test.beforeEach(async ({ page }) => {
    // Register a new tenant and user for testing
    await page.goto('/register');

    await page.fill('input[name="tenantName"]', testTenant.name);
    await page.fill('input[name="username"]', testUser.username);
    await page.fill('input[name="password"]', testUser.password);

    await page.click('button[type="submit"]');

    // Should be redirected to dashboard after successful registration
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('should complete full project CRUD workflow', async ({ page }) => {
    // Navigate to projects page
    await page.click('a[href="/projects"]');
    await expect(page).toHaveURL('/projects');
    await expect(page.locator('h1')).toContainText('Projects');

    // Initially should show empty state
    await expect(page.locator('text=No projects yet')).toBeVisible();
    await expect(page.locator('text=0 projects')).toBeVisible();

    // Test Project Creation
    await page.click('button:has-text("New Project")');

    // Form should be visible
    await expect(page.locator('label:has-text("Project Name")')).toBeVisible();
    await expect(page.locator('label:has-text("Domain")')).toBeVisible();

    // Fill and submit form
    await page.fill('input[name="name"]', testProject.name);
    await page.fill('input[name="domain"]', testProject.domain);
    await page.click('button:has-text("Create Project")');

    // Should show success and project in list
    await expect(page.locator('text=1 project')).toBeVisible();
    await expect(page.locator(`text=${testProject.name}`)).toBeVisible();
    await expect(page.locator(`text=${testProject.domain}`)).toBeVisible();

    // Test that form is collapsed after creation
    await expect(page.locator('button:has-text("New Project")')).toBeVisible();
    await expect(page.locator('input[name="name"]')).not.toBeVisible();

    // Test Project Update
    await page.click('button:has-text("Edit")');

    // Edit modal should be visible
    await expect(page.locator('h3:has-text("Edit Project")')).toBeVisible();

    // Current values should be pre-filled
    await expect(page.locator('input[name="name"]')).toHaveValue(testProject.name);
    await expect(page.locator('input[name="domain"]')).toHaveValue(testProject.domain);

    // Update values
    await page.fill('input[name="name"]', updatedProject.name);
    await page.fill('input[name="domain"]', updatedProject.domain);
    await page.click('button:has-text("Update Project")');

    // Should show updated values
    await expect(page.locator(`text=${updatedProject.name}`)).toBeVisible();
    await expect(page.locator(`text=${updatedProject.domain}`)).toBeVisible();
    await expect(page.locator(`text=${testProject.name}`)).not.toBeVisible();

    // Test Project Deletion
    await page.click('button:has-text("Delete")');

    // Confirmation modal should appear
    await expect(page.locator('h3:has-text("Delete Project")')).toBeVisible();
    await expect(page.locator(`text=${updatedProject.name}`)).toBeVisible();
    await expect(page.locator('text=This action cannot be undone')).toBeVisible();

    // Cancel first to test cancel functionality
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('h3:has-text("Delete Project")')).not.toBeVisible();
    await expect(page.locator(`text=${updatedProject.name}`)).toBeVisible();

    // Now actually delete
    await page.click('button:has-text("Delete")');
    await page.click('button:has-text("Delete Project")');

    // Should return to empty state
    await expect(page.locator('text=No projects yet')).toBeVisible();
    await expect(page.locator('text=0 projects')).toBeVisible();
    await expect(page.locator(`text=${updatedProject.name}`)).not.toBeVisible();
  });

  test('should show validation errors', async ({ page }) => {
    // Navigate to projects page
    await page.click('a[href="/projects"]');

    // Open form and submit with empty name
    await page.click('button:has-text("New Project")');
    await page.click('button:has-text("Create Project")');

    // Should show validation error
    await expect(page.locator('text=Project name is required')).toBeVisible();

    // Fill name and submit - should work
    await page.fill('input[name="name"]', testProject.name);
    await page.click('button:has-text("Create Project")');

    // Should succeed
    await expect(page.locator(`text=${testProject.name}`)).toBeVisible();
  });

  test('should prevent duplicate project names', async ({ page }) => {
    // Navigate to projects page and create first project
    await page.click('a[href="/projects"]');
    await page.click('button:has-text("New Project")');
    await page.fill('input[name="name"]', testProject.name);
    await page.click('button:has-text("Create Project")');

    // Verify first project created
    await expect(page.locator(`text=${testProject.name}`)).toBeVisible();

    // Try to create second project with same name
    await page.click('button:has-text("New Project")');
    await page.fill('input[name="name"]', testProject.name);
    await page.click('button:has-text("Create Project")');

    // Should show duplicate error
    await expect(page.locator('text=Project name already exists in your organization')).toBeVisible();

    // Should still only have one project
    await expect(page.locator('text=1 project')).toBeVisible();
  });

  test('should show project creation date', async ({ page }) => {
    // Navigate to projects page and create project
    await page.click('a[href="/projects"]');
    await page.click('button:has-text("New Project")');
    await page.fill('input[name="name"]', testProject.name);
    await page.click('button:has-text("Create Project")');

    // Should show creation date (format: "Created Sep 19, 2025")
    const today = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const expectedDatePattern = `Created ${monthNames[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;

    await expect(page.locator(`text=${expectedDatePattern}`)).toBeVisible();
  });

  test('should handle optional domain field', async ({ page }) => {
    // Navigate to projects page and create project without domain
    await page.click('a[href="/projects"]');
    await page.click('button:has-text("New Project")');
    await page.fill('input[name="name"]', testProject.name);
    // Leave domain empty
    await page.click('button:has-text("Create Project")');

    // Should succeed and show project
    await expect(page.locator(`text=${testProject.name}`)).toBeVisible();

    // Should not show domain since it's empty
    await expect(page.locator(`text=${testProject.domain}`)).not.toBeVisible();
  });

  test('should maintain projects count correctly', async ({ page }) => {
    await page.click('a[href="/projects"]');

    // Start with 0 projects
    await expect(page.locator('text=0 projects')).toBeVisible();

    // Create first project
    await page.click('button:has-text("New Project")');
    await page.fill('input[name="name"]', 'Project 1');
    await page.click('button:has-text("Create Project")');
    await expect(page.locator('text=1 project')).toBeVisible();

    // Create second project
    await page.click('button:has-text("New Project")');
    await page.fill('input[name="name"]', 'Project 2');
    await page.click('button:has-text("Create Project")');
    await expect(page.locator('text=2 projects')).toBeVisible();

    // Delete one project
    await page.locator('button:has-text("Delete")').first().click();
    await page.click('button:has-text("Delete Project")');
    await expect(page.locator('text=1 project')).toBeVisible();
  });
});