import { test, expect } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    localStorage.clear();
  });
});

test('golden path: pantry → matches → create → save; settings sections render', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Will It Cocktail' })).toBeVisible();

  const pantryTab = page.getByRole('button', { name: 'Pantry', exact: true });
  await pantryTab.click();

  const textarea = page.getByPlaceholder(/gin, sweet vermouth/i);
  await textarea.fill('gin, sweet vermouth, campari, lime juice, simple syrup, lemon juice');

  await page.getByRole('button', { name: 'Parse', exact: true }).click();

  await expect(page.getByText(/^Found \d+/)).toBeVisible({ timeout: 10_000 });

  await page.getByRole('button', { name: 'Add all' }).click();

  await expect(page.locator('header').getByText(/\d+ ingredient/)).toBeVisible();
  const headerCount = await page
    .locator('header')
    .getByText(/\d+ ingredient/)
    .textContent();
  expect(parseInt(headerCount ?? '0', 10)).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Matches', exact: true }).click();
  await expect(page.getByText(/^\d+ matches?/)).toBeVisible();

  await page.getByRole('button', { name: 'Create', exact: true }).click();

  const candidateCount = await page.getByText(/\d+ candidates? from your pantry/).textContent();
  expect(candidateCount).toMatch(/[1-9]/);

  const firstSaveButton = page.getByRole('button', { name: 'Save', exact: true }).first();
  await firstSaveButton.click();

  await expect(page.getByRole('heading', { name: 'Saved inventions' })).toBeVisible();

  await page.getByRole('button', { name: 'LLM settings' }).click();
  await expect(page.getByRole('heading', { name: 'LLM settings' })).toBeVisible();
  await expect(page.getByText('On-device model (Gemma)')).toBeVisible();
  await expect(page.getByText('Recipe database')).toBeVisible();
  await expect(page.getByText('Android-only. On web')).toBeVisible();

  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('heading', { name: 'LLM settings' })).toBeHidden();
});

test('settings: switch provider to Heuristic and confirm status line', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'LLM settings' }).click();
  await page.getByRole('button', { name: 'Heuristic', exact: true }).click();
  await expect(page.getByText('Offline heuristic selected.')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();

  await expect(page.getByRole('button', { name: 'LLM settings' })).toBeVisible();
});
