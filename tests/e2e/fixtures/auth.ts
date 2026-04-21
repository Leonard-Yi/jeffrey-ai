import { test as base } from '@playwright/test';

export const test = base.extend({
  // Auto-login before each test
});

export async function signIn(page: any, email = 'test@test.com', password = 'testpassword') {
  // Create user if not exists (ignore failure = already exists)
  try {
    await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name: 'Test User' }),
    });
  } catch { /* ignore */ }

  await page.goto('/auth/signin');
  await page.waitForLoadState('networkidle');

  // Fill in credentials - use type selector since name is not set
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);

  // Submit the form
  await page.locator('button:has-text("登录")').click();

  // Wait for redirect to input page
  await page.waitForURL('**/input**', { timeout: 15000 }).catch(() => {
    console.log('Warning: did not redirect to /input, current URL:', page.url());
  });
}

// Navigate to a page after login using link click to preserve session
export async function navigateTo(page: any, path: string) {
  // If already on the right page, don't navigate
  if (page.url().includes(path)) {
    return;
  }

  // Use link navigation to preserve session cookie
  // Find a link that contains the path (without the leading slash)
  const linkText = path.replace('/', '');
  const link = page.locator(`a[href="${path}"], a:has-text("${linkText}")`).first();

  if (await link.isVisible({ timeout: 5000 }).catch(() => false)) {
    await link.click();
    await page.waitForLoadState('networkidle');
  } else {
    // Fallback: use evaluate to change location
    await page.evaluate((p) => { window.location.href = p; }, `http://localhost:3000${path}`);
    await page.waitForLoadState('networkidle');
  }
}
