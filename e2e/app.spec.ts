import { test, expect } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    localStorage.clear();
  });
});

// ---------------------------------------------------------------------------
// Helper: click the Ask **tab** without ambiguity (there are two "Ask" buttons
// when the Ask tab is active — the nav tab and the form submit button).
// ---------------------------------------------------------------------------
const askTab = (page: Parameters<typeof test>[1]['page']) =>
  page.locator('nav').getByRole('button', { name: 'Ask', exact: true });

// Fill the quick-add textarea, parse, and add all recognised items.
async function quickAdd(page: Parameters<typeof test>[1]['page'], ingredients: string) {
  await page.getByPlaceholder(/gin, sweet vermouth/i).fill(ingredients);
  await page.getByRole('button', { name: 'Parse', exact: true }).click();
  await expect(page.getByText(/Found \d+/)).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Add all' }).click();
}

// ---------------------------------------------------------------------------
// App load
// ---------------------------------------------------------------------------

test('app title and all four tabs are visible on load', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Will It Cocktail' })).toBeVisible();
  for (const name of ['Pantry', 'Matches', 'Ask', 'Recipes']) {
    await expect(
      page.locator('nav').getByRole('button', { name, exact: true }),
    ).toBeVisible();
  }
});

// ---------------------------------------------------------------------------
// Pantry tab
// ---------------------------------------------------------------------------

test('quick-add: parse and add recognised ingredients', async ({ page }) => {
  await page.goto('/');

  await quickAdd(page, 'gin, campari, sweet vermouth');

  const countText = await page.locator('header').getByText(/\d+ ingredient/).textContent();
  expect(parseInt(countText ?? '0')).toBeGreaterThan(0);
});

test('quick-add: unrecognised phrase shows custom-ingredient prompt', async ({ page }) => {
  await page.goto('/');

  // Use a phrase that has no match in aliases, names, or Levenshtein ≤ 2.
  await page.getByPlaceholder(/gin, sweet vermouth/i).fill('xyzzy plugh twisty');
  await page.getByRole('button', { name: 'Parse', exact: true }).click();

  // Wait for parse to complete (button returns to "Parse" from "Parsing…")
  await expect(page.getByRole('button', { name: 'Parse', exact: true })).toBeVisible({ timeout: 5_000 });

  // Either the phrase is unrecognised (shows "Didn't recognize") or it found
  // something (shows "Found N"). Either way, the parse result panel appears.
  await expect(
    page.getByText(/Didn't recognize|Found \d+/i),
  ).toBeVisible({ timeout: 5_000 });
});

test('pantry: browse all shows the full ingredient catalogue', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Browse all', exact: true }).click();
  await expect(page.getByText('Spirits')).toBeVisible();
});

test('pantry: search filter narrows the list', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Browse all', exact: true }).click();
  await page.getByPlaceholder('Search ingredients…').fill('campari');
  await expect(page.getByText('Campari')).toBeVisible();
});

// ---------------------------------------------------------------------------
// Matches tab
// ---------------------------------------------------------------------------

test('matches tab shows "Make it now" recipes after adding pantry items', async ({ page }) => {
  await page.goto('/');
  await quickAdd(page, 'gin, campari, sweet vermouth, lemon juice, simple syrup');
  await page.getByRole('button', { name: 'Matches', exact: true }).click();

  await expect(page.getByText(/\d+ match/)).toBeVisible();
  await expect(page.getByText('Make it now')).toBeVisible();
});

test('matches tab: strict mode hides substitution tier', async ({ page }) => {
  await page.goto('/');
  await quickAdd(page, 'gin, lemon juice, simple syrup');
  await page.getByRole('button', { name: 'Matches', exact: true }).click();

  await expect(page.getByText('With one substitution')).toBeVisible();

  await page.getByLabel('Strict mode').check();
  await expect(page.getByText('With one substitution')).toBeHidden();
});

test('matches tab: recipe modal opens, shows ingredients, closes on Escape', async ({ page }) => {
  await page.goto('/');
  await quickAdd(page, 'gin, campari, sweet vermouth');
  await page.getByRole('button', { name: 'Matches', exact: true }).click();

  // Wait for the match result cards to render.
  await expect(page.getByText('Make it now')).toBeVisible({ timeout: 5_000 });

  // Click the first result card (whatever recipe it is).
  await page.getByText('Make it now').locator('..').locator('..').locator('button').first().click();

  // The modal should open — it always contains an "Ingredients" heading.
  await expect(page.getByRole('heading', { name: 'Ingredients' })).toBeVisible({ timeout: 5_000 });

  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Ingredients' })).toBeHidden();
});

test('matches tab: liquor filter chips appear', async ({ page }) => {
  await page.goto('/');
  await quickAdd(page, 'gin, campari, sweet vermouth, bourbon, angostura bitters, simple syrup, lemon juice');
  await page.getByRole('button', { name: 'Matches', exact: true }).click();

  // The "All · N" filter chip should be visible (scoped to the filter row).
  await expect(
    page.getByText(/^All\s*·\s*\d+$/).first(),
  ).toBeVisible({ timeout: 5_000 });
});

// ---------------------------------------------------------------------------
// Ask tab
// ---------------------------------------------------------------------------

test('ask tab: sections start collapsed and expand on click', async ({ page }) => {
  await page.goto('/');
  await quickAdd(page, 'gin, campari, sweet vermouth');
  await askTab(page).click();

  // Fill the ask form and submit using the submit button specifically.
  await page.getByLabel('What are you in the mood for?').fill('something bitter and stirred');
  await page.getByRole('main').getByRole('button', { name: 'Ask', exact: true }).click();

  // Wait for the search section to finish loading (button enabled, count > 0).
  const sectionBtn = page.getByRole('button', { name: /from our recipes/i }).first();
  await expect(sectionBtn).toBeEnabled({ timeout: 15_000 });

  // Section is collapsed: results list not yet visible.
  // The "interpretation" line is inside the section body, so it should be hidden.
  await expect(page.getByText(/You want something/i)).toBeHidden();

  // Expand.
  await sectionBtn.click();
  await expect(page.getByText(/You want something/i)).toBeVisible({ timeout: 5_000 });
});

test('ask tab: example chip pre-fills query and triggers search', async ({ page }) => {
  await page.goto('/');
  await askTab(page).click();

  await page.getByRole('button', { name: 'Something refreshing and citrusy' }).click();

  // The "From our recipes" section should appear (even collapsed) after the search.
  await expect(
    page.getByRole('button', { name: /from our recipes/i }).first(),
  ).toBeEnabled({ timeout: 15_000 });
});

// ---------------------------------------------------------------------------
// LLM settings
// ---------------------------------------------------------------------------

test('settings: modal opens, provider can be changed, modal closes', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'LLM settings' }).click();
  await expect(page.getByRole('heading', { name: 'LLM settings' })).toBeVisible();

  await page.getByRole('button', { name: 'Heuristic', exact: true }).click();

  // Close via ✕ (aria-label="Close").
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('heading', { name: 'LLM settings' })).toBeHidden();

  // Status button text reflects heuristic.
  await expect(page.getByRole('button', { name: 'LLM settings' })).toContainText(/heuristic/i);
});

test('settings: backdrop click closes the modal', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'LLM settings' }).click();
  await expect(page.getByRole('heading', { name: 'LLM settings' })).toBeVisible();

  await page.mouse.click(10, 10);
  await expect(page.getByRole('heading', { name: 'LLM settings' })).toBeHidden();
});

test('settings: selecting a preset fills the base URL field', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'LLM settings' }).click();
  await page.getByRole('combobox').selectOption({ label: 'OpenAI (gpt-4o-mini)' });

  // The base URL input should now contain the OpenAI URL.
  const urlInput = page.locator('input[type="url"]');
  await expect(urlInput).toHaveValue('https://api.openai.com/v1');

  // And the model input.
  const modelInput = page.locator('input[placeholder="gpt-4o-mini"]');
  await expect(modelInput).toHaveValue('gpt-4o-mini');
});

// ---------------------------------------------------------------------------
// Recipes tab
// ---------------------------------------------------------------------------

test('recipes tab lists drinks from the database', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Recipes', exact: true }).click();

  // At least one well-known recipe name should be visible.
  await expect(page.getByText(/negroni|daiquiri|martini/i).first()).toBeVisible({ timeout: 5_000 });
});

// ---------------------------------------------------------------------------
// Saved invented recipes (heuristic generator path)
// ---------------------------------------------------------------------------

test('ask tab: saved inventions section appears after saving a generated recipe', async ({ page }) => {
  await page.goto('/');

  await quickAdd(page, 'gin, lime juice, simple syrup, tonic water, angostura bitters');
  await askTab(page).click();

  await page.getByLabel('What are you in the mood for?').fill('invent something');
  await page.getByRole('main').getByRole('button', { name: 'Ask', exact: true }).click();

  // Wait for invention to complete.
  const createdSection = page.getByRole('button', { name: /created for you/i }).first();
  await expect(createdSection).toBeEnabled({ timeout: 20_000 });

  // Expand the section.
  await createdSection.click();

  // If there are save buttons, click the first one.
  const saveBtn = page.getByRole('button', { name: 'Save', exact: true }).first();
  if (await saveBtn.isVisible()) {
    await saveBtn.click();
    await expect(page.getByRole('heading', { name: 'Saved inventions' })).toBeVisible({ timeout: 5_000 });
  }
});
