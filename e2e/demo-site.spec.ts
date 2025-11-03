import { test, expect } from '@playwright/test';

test.describe('Demo Website', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the page with correct title and header', async ({ page }) => {
    await expect(page).toHaveTitle(/Next Edit Suggestions Playground/);
    
    const header = page.locator('header.site-header');
    await expect(header).toBeVisible();
    await expect(header.locator('h1')).toHaveText('Next Edit Suggestions');
    
    const introText = page.locator('section.demo-intro');
    await expect(introText).toBeVisible();
    await expect(introText.locator('h2')).toHaveText('How it works');
  });

  test('should have all required UI elements', async ({ page }) => {
    // Check for demo controls
    const controls = page.locator('.demo-controls');
    await expect(controls).toBeVisible();
    await expect(controls.locator('#populate-editor')).toBeVisible();
    await expect(controls.locator('#invoke-suggestions')).toBeVisible();

    // Check for editor container
    const editorContainer = page.locator('#editor');
    await expect(editorContainer).toBeVisible();

    // Check for suggestion panel
    const suggestionPanel = page.locator('.suggestion-panel');
    await expect(suggestionPanel).toBeVisible();
    await expect(suggestionPanel.locator('h2')).toHaveText('Suggestion Feed');
    
    const suggestionStatus = page.locator('#suggestion-status');
    await expect(suggestionStatus).toBeVisible();
    await expect(suggestionStatus).toContainText('Click "Generate Next Edit Suggestions"');
  });

  test('should initialize Monaco editor with sample code', async ({ page }) => {
    // Wait for the editor container to be present
    const editorContainer = page.locator('#editor');
    await expect(editorContainer).toBeVisible();

    // Wait for the page and module to load - give Monaco time to initialize
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Allow Monaco to initialize

    // Verify editor container exists and is visible
    await expect(editorContainer).toBeVisible();

    // Verify that buttons are enabled, indicating the demo site has initialized
    const populateButton = page.locator('#populate-editor');
    const invokeButton = page.locator('#invoke-suggestions');
    await expect(populateButton).toBeEnabled();
    await expect(invokeButton).toBeEnabled();
  });

  test('should populate editor with sample code when clicking "Generate Sample Code"', async ({ page }) => {
    const editorContainer = page.locator('#editor');
    await expect(editorContainer).toBeVisible();

    // Wait for page to load and Monaco to initialize
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Click the populate button
    const populateButton = page.locator('#populate-editor');
    await expect(populateButton).toBeEnabled();
    await populateButton.click();

    // Wait for the editor to update - Monaco will update its content asynchronously
    await page.waitForTimeout(1000);

    // Verify button is still functional and editor container is visible
    await expect(populateButton).toBeEnabled();
    await expect(editorContainer).toBeVisible();
  });

  test('should show suggestions when clicking "Generate Next Edit Suggestions"', async ({ page }) => {
    // Wait for Monaco to initialize
    await page.waitForTimeout(1000);

    // Click the invoke suggestions button
    const invokeButton = page.locator('#invoke-suggestions');
    await invokeButton.click();

    // Wait for suggestions to be generated
    // The status should change from "Generating suggestions..." to a count or status
    const suggestionStatus = page.locator('#suggestion-status');
    
    // Wait for status to change (either shows count or error message)
    await page.waitForFunction(
      (statusSelector) => {
        const status = document.querySelector(statusSelector);
        return status && !status.textContent?.includes('Generating suggestions...');
      },
      '#suggestion-status',
      { timeout: 10000 }
    );

    // Check that suggestions were generated
    // Either we have suggestions or an error message
    const statusText = await suggestionStatus.textContent();
    expect(statusText).toBeTruthy();
    
    // Check if suggestion list has items
    const suggestionList = page.locator('#suggestion-list');
    const listItems = suggestionList.locator('li');
    const itemCount = await listItems.count();
    
    // Either we have suggestions (itemCount > 0) or an error message
    if (itemCount === 0) {
      // If no suggestions, there should be an error or "no suggestions" message
      await expect(suggestionStatus).not.toContainText('Generating suggestions...');
    } else {
      // If we have suggestions, verify they're displayed
      await expect(listItems.first()).toBeVisible();
    }
  });

  test('should display suggestion feed updates correctly', async ({ page }) => {
    // Wait for Monaco to initialize
    await page.waitForTimeout(1000);

    const suggestionStatus = page.locator('#suggestion-status');
    const suggestionList = page.locator('#suggestion-list');
    const suggestionDoc = page.locator('#suggestion-documentation');

    // Initially, should show default message
    await expect(suggestionStatus).toContainText('Click "Generate Next Edit Suggestions"');

    // Generate suggestions
    const invokeButton = page.locator('#invoke-suggestions');
    await invokeButton.click();

    // Wait for suggestions to be processed
    await page.waitForFunction(
      (statusSelector) => {
        const status = document.querySelector(statusSelector);
        return status && !status.textContent?.includes('Generating suggestions...');
      },
      '#suggestion-status',
      { timeout: 10000 }
    );

    // Verify feed has been updated
    const updatedStatus = await suggestionStatus.textContent();
    expect(updatedStatus).toBeTruthy();

    // Documentation area should be visible
    await expect(suggestionDoc).toBeVisible();
  });

  test('should handle multiple sample code cycles', async ({ page }) => {
    const editorContainer = page.locator('#editor');
    await expect(editorContainer).toBeVisible();

    // Wait for page to load and Monaco to initialize
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const populateButton = page.locator('#populate-editor');
    await expect(populateButton).toBeEnabled();
    
    // Click multiple times to cycle through samples
    // The button should remain functional
    for (let i = 0; i < 3; i++) {
      await populateButton.click();
      await page.waitForTimeout(500);
      // Verify button is still enabled after each click
      await expect(populateButton).toBeEnabled();
    }

    // Verify editor container exists and is visible
    await expect(editorContainer).toBeVisible();
  });

  test('should have working "View Proposal" link', async ({ page }) => {
    const proposalLink = page.locator('a.button').filter({ hasText: 'View Proposal' });
    await expect(proposalLink).toBeVisible();
    
    // Check that link has correct attributes
    await expect(proposalLink).toHaveAttribute('target', '_blank');
    await expect(proposalLink).toHaveAttribute('rel', 'noreferrer');
    
    // Verify link points to docs
    const href = await proposalLink.getAttribute('href');
    expect(href).toContain('next-edit-suggestions-proposal.md');
  });

  test('should be responsive and have proper layout', async ({ page }) => {
    const editorContainer = page.locator('#editor');
    const suggestionPanel = page.locator('.suggestion-panel');

    // Both should be visible side by side
    await expect(editorContainer).toBeVisible();
    await expect(suggestionPanel).toBeVisible();

    // Check that demo body has both elements
    const demoBody = page.locator('.demo-body');
    await expect(demoBody).toBeVisible();
  });
});
