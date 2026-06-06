import { Page } from '@playwright/test';

const BASE = 'http://localhost:3000';

export function makeEmail(prefix = 'e2e') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}@test.com`;
}

/** Register via API (fast), then sign in via UI. Saves ~3s vs UI registration. */
export async function registerAndSignIn(
  page: Page,
  email: string,
  password: string,
  name: string,
) {
  // Step 1: Register via API (avoids UI signup page round-trips)
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok && res.status !== 409) {
    throw new Error(`Registration failed: ${res.status}`);
  }
  // 409 = already exists, which is fine

  // Step 2: Sign in via UI (NextAuth credentials flow requires form POST)
  await page.goto('/auth/signin');
  await page.waitForLoadState('networkidle');

  // Handle case where NextAuth auto-redirects authenticated users
  await page.waitForTimeout(500);
  if (page.url().includes('/input') || page.url().includes('/auth/verify')) {
    // Already redirected - session exists, no need to fill login form
    return;
  }

  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button:has-text("登录")').click();
  try {
    await page.waitForURL('**/input**', { timeout: 20000 });
  } catch {
    // Fallback: if redirect didn't happen, try navigating manually
    if (!page.url().includes('/input')) {
      await page.goto('/input');
      await page.waitForLoadState('networkidle');
    }
  }
}

// Legacy alias for backward compatibility with existing tests
export async function signIn(
  page: Page,
  email = 'test@test.com',
  password = 'testpassword',
) {
  // Register via API (ignore if already exists)
  try {
    await fetch(`${BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name: 'Test User' }),
    });
  } catch { /* ignore */ }

  await page.goto('/auth/signin');
  await page.waitForLoadState('networkidle');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button:has-text("登录")').click();
  await page.waitForURL('**/input**', { timeout: 15000 }).catch(() => {
    console.log('Warning: did not redirect to /input, current URL:', page.url());
  });
}

/** Navigate via link click to preserve session cookies */
export async function navigateTo(page: Page, path: string) {
  if (page.url().includes(path)) return;

  const link = page.locator(`a[href="${path}"]`).first();
  if (await link.isVisible({ timeout: 5000 }).catch(() => false)) {
    await link.click();
    await page.waitForLoadState('networkidle');
  } else {
    await page.evaluate((p) => { window.location.href = p; }, `${BASE}${path}`);
    await page.waitForLoadState('networkidle');
  }
}
