import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

const exampleNames = [
  'Simple JSON',
  'Transaction metadata',
  'Deeply nested object',
  'Large array',
  'Long strings',
  'Primitives & numbers',
  'Empty containers',
  'Empty root',
  'URLs & dates',
  'Mixed nested arrays',
  'Performance dataset',
  'Circular & accessor values',
  'Primitive root',
  'Null root',
] as const;

function specimen(page: Page): Locator {
  return page.locator('.specimen-panel');
}

function inspector(page: Page): Locator {
  return specimen(page).locator('.inspector-stage .jg-inspector');
}

async function chooseExample(page: Page, name: string): Promise<void> {
  const choice = page.getByRole('navigation', { name: 'Choose a dataset' })
    .getByRole('button', { name: new RegExp(name, 'i') });
  await choice.click();
  await expect(specimen(page).getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(inspector(page).getByRole('tree', { name: 'JSON data' })).toBeVisible();
}

async function readClipboard(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText());
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'A closer look at your data.' })).toBeVisible();
});

test('all fourteen examples render without browser exceptions', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await expect(page.getByRole('navigation', { name: 'Choose a dataset' }).getByRole('button')).toHaveCount(14);

  for (const name of exampleNames) {
    await chooseExample(page, name);
    expect(await inspector(page).getByRole('treeitem').count()).toBeGreaterThan(0);
  }

  await chooseExample(page, 'Circular & accessor values');
  await expect(inspector(page).locator('[data-path="$.secretGetter"]')).toContainText('Getter');
  await expect(inspector(page).locator('[data-path="$.self"]')).toContainText('Circular');
  expect(errors).toEqual([]);
});

test('search reveals and highlights a value twenty collapsed levels deep', async ({ page }) => {
  await chooseExample(page, 'Deeply nested object');
  await inspector(page).getByRole('button', { name: 'Collapse all', exact: true }).click();
  await expect(inspector(page).getByRole('treeitem')).toHaveCount(1);
  await inspector(page).getByRole('textbox', { name: 'Search JSON' }).fill('treasure');

  const path = `$${'.child'.repeat(20)}.treasure`;
  const match = inspector(page).locator(`[data-path=${JSON.stringify(path)}]`);
  await expect(match.locator('mark')).toHaveText('treasure');
  await expect(match).toContainText('You reached the deepest layer.');
  await match.click();
  await expect(specimen(page).locator('.selection-bar > code')).toHaveText(path);

  await inspector(page).getByRole('button', { name: 'Clear search' }).click();
  await expect(inspector(page).getByRole('textbox', { name: 'Search JSON' })).toHaveValue('');
  await inspector(page).getByRole('textbox', { name: 'Search JSON' }).fill('not-present-xyz');
  await expect(inspector(page).getByText('No matching keys or values.')).toBeVisible();
});

test('copies the entire JSON, selected path, and raw string into the browser clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://127.0.0.1:4173' });
  await page.evaluate(() => navigator.clipboard.writeText(''));
  await inspector(page).getByRole('button', { name: 'Copy JSON', exact: true }).click();
  await expect.poll(() => readClipboard(page)).toContain('txn_demo_8f21c4');
  const copied: unknown = JSON.parse(await readClipboard(page));
  expect(copied).toMatchObject({
    id: 'txn_demo_8f21c4',
    status: 'completed',
    amount: 249.9,
    customer: { email: 'alex@example.com' },
  });

  await inspector(page).locator('[data-path="$.customer.email"]').click();
  await inspector(page).getByRole('button', { name: 'Copy selected path', exact: true }).click();
  await expect.poll(() => readClipboard(page)).toBe('$.customer.email');
  await expect(specimen(page).locator('.selection-bar > code')).toHaveText('$.customer.email');

  await inspector(page).getByRole('button', { name: 'Copy value at $.customer.email', exact: true }).click();
  await expect.poll(() => readClipboard(page)).toBe('alex@example.com');
});

test('long string previews open complete, readable details', async ({ page }) => {
  await chooseExample(page, 'Long strings');
  const paragraph = inspector(page).locator('[data-path="$.paragraph"]');
  await expect(paragraph).toContainText('…');
  await paragraph.getByRole('button', { name: 'Full value', exact: true }).click();
  await expect(inspector(page).locator('.jg-details pre')).toHaveText(
    'Structured data deserves a little clarity. Explore the shape, find the value, and keep the context. '.repeat(8),
  );
  await expect(specimen(page).locator('.selection-bar > code')).toHaveText('$.paragraph');

  await inspector(page).getByRole('button', { name: 'Details', exact: true }).click();
  await expect(inspector(page).locator('.jg-details')).toHaveCount(0);
  await page.locator('.configuration-panel').getByRole('combobox', { name: /String preview/ }).selectOption('80');
  await expect(paragraph).toContainText('…');
  await expect(paragraph.locator('.jg-value')).not.toContainText('Structured data deserves a little clarity. Explore the shape, find the value, and keep the context.');
});

test('live configuration changes theme, expansion, controls, and the generated React code', async ({ page }) => {
  const config = page.locator('.configuration-panel');
  await config.getByRole('radio', { name: 'Dark', exact: true }).check();
  await expect(inspector(page)).toHaveAttribute('data-theme', 'dark');
  await expect(inspector(page)).toHaveCSS('background-color', 'rgb(20, 27, 37)');
  await config.getByLabel('Root label', { exact: true }).fill('payload');
  await expect(inspector(page).locator('[data-path="$"] .jg-key')).toHaveText('payload');

  const depth = config.getByRole('slider', { name: /Initial depth/ });
  await depth.focus();
  await depth.press('Home');
  await expect(depth).toHaveValue('0');
  await expect(inspector(page).getByRole('treeitem')).toHaveCount(1);
  const height = config.getByRole('slider', { name: /Inspector height/ });
  await height.focus();
  await height.press('Home');
  await height.press('ArrowRight');
  await expect(height).toHaveValue('320');
  await expect(inspector(page).getByRole('tree')).toHaveCSS('max-height', '320px');
  await config.getByRole('combobox', { name: /String preview/ }).selectOption('80');
  await config.getByRole('checkbox', { name: /^Search/ }).uncheck();
  await config.getByRole('checkbox', { name: /^Copy actions/ }).uncheck();
  await config.getByRole('checkbox', { name: /^Type labels/ }).uncheck();
  await expect(inspector(page).getByRole('textbox', { name: 'Search JSON' })).toHaveCount(0);
  await expect(inspector(page).getByRole('button', { name: 'Copy JSON', exact: true })).toHaveCount(0);
  await expect(inspector(page).locator('.jg-type')).toHaveCount(0);

  await specimen(page).getByRole('tab', { name: 'React code' }).click();
  const code = specimen(page).locator('.usage-code pre');
  await expect(code).toContainText('rootLabel={"payload"}');
  await expect(code).toContainText('theme="dark"');
  await expect(code).toContainText('defaultExpandedDepth={0}');
  await expect(code).toContainText('maxHeight={320}');
  await expect(code).toContainText('stringLimit={80}');
  await expect(code).toContainText('searchable={false}');
  await expect(code).toContainText('copyable={false}');
  await expect(code).toContainText('showTypes={false}');

  await config.getByRole('button', { name: 'Reset', exact: true }).click();
  await specimen(page).getByRole('tab', { name: 'Inspector', exact: true }).click();
  await expect(inspector(page)).toHaveAttribute('data-theme', 'light');
  await expect(inspector(page).getByRole('textbox', { name: 'Search JSON' })).toBeVisible();
  await expect(inspector(page).getByRole('button', { name: 'Copy JSON', exact: true })).toBeVisible();
  await expect(depth).toHaveValue('2');
  expect(await inspector(page).getByRole('treeitem').count()).toBeGreaterThan(1);

  await page.emulateMedia({ colorScheme: 'dark' });
  await config.getByRole('radio', { name: 'Auto', exact: true }).check();
  await expect(inspector(page)).toHaveAttribute('data-theme', 'auto');
  await expect(inspector(page)).toHaveCSS('background-color', 'rgb(20, 27, 37)');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(inspector(page)).toHaveCSS('background-color', 'rgb(255, 255, 255)');
});

test('large data stays virtualized and a distant JSON path receives selection and focus', async ({ page }) => {
  await chooseExample(page, 'Performance dataset');
  await inspector(page).getByRole('button', { name: 'Expand all', exact: true }).click();
  const tree = inspector(page).getByRole('tree');
  expect(await tree.getByRole('treeitem').count()).toBeLessThanOrEqual(50);
  await expect(inspector(page).locator('.jg-count')).toHaveText('27,001 visible · 27,001 indexed');

  await tree.evaluate((element) => { element.scrollTop = 30000; });
  await expect.poll(async () => {
    const firstPath = await tree.getByRole('treeitem').first().getAttribute('data-path');
    return firstPath !== '$';
  }).toBe(true);
  expect(await tree.getByRole('treeitem').count()).toBeLessThanOrEqual(50);

  await inspector(page).getByRole('textbox', { name: 'Go to path' }).fill('$[2998].name');
  await inspector(page).getByRole('button', { name: 'Navigate to path', exact: true }).click();
  const target = inspector(page).locator('[data-path="$[2998].name"]');
  await expect(target).toHaveAttribute('aria-selected', 'true');
  await expect(target).toBeFocused();
  await expect(target).toContainText('Record 2999');
  await expect(specimen(page).locator('.selection-bar > code')).toHaveText('$[2998].name');
  expect(await tree.getByRole('treeitem').count()).toBeLessThanOrEqual(50);
});

test('tree keyboard navigation continues after a mouse click expands a branch', async ({ page }) => {
  await chooseExample(page, 'Simple JSON');
  await inspector(page).getByRole('button', { name: 'Collapse all', exact: true }).click();
  const root = inspector(page).locator('[data-path="$"]');
  await root.getByRole('button', { name: 'Expand $', exact: true }).click();
  await expect(root).toBeFocused();
  await expect(root).toHaveAttribute('aria-expanded', 'true');

  await page.keyboard.press('ArrowDown');
  await expect(inspector(page).locator('[data-path="$.name"]')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(root).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(root).toHaveAttribute('aria-expanded', 'false');
  await expect(inspector(page).getByRole('treeitem')).toHaveCount(1);
  await page.keyboard.press('ArrowRight');
  await expect(root).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(inspector(page).locator('[data-path="$.name"]')).toBeFocused();
  await page.keyboard.press('End');
  await expect(inspector(page).locator('[data-path="$.dependencies"]')).toBeFocused();
  await page.keyboard.press('Home');
  await expect(root).toBeFocused();
});

test('layouts contain wide values and keep the important controls reachable', async ({ page }) => {
  for (const name of ['Long strings', 'Deeply nested object', 'Performance dataset']) {
    await chooseExample(page, name);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await expect(inspector(page).getByRole('textbox', { name: 'Search JSON' })).toBeVisible();
    await expect(inspector(page).getByRole('button', { name: 'Copy JSON', exact: true })).toBeVisible();
    await expect(inspector(page).getByRole('textbox', { name: 'Go to path' })).toBeVisible();
  }

  const config = page.locator('.configuration-panel');
  await config.getByLabel('Root label', { exact: true }).scrollIntoViewIfNeeded();
  await expect(config.getByLabel('Root label', { exact: true })).toBeVisible();
  await config.getByRole('checkbox', { name: /^Type labels/ }).scrollIntoViewIfNeeded();
  await expect(config.getByRole('checkbox', { name: /^Type labels/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
});
