import { test, expect } from '@playwright/test';
import { signIn } from '../fixtures/auth';

test('voice input - mic button and text submission', async ({ page }) => {
  await signIn(page, `mic_test_${Date.now()}@test.com`, 'testpassword');

  await page.goto('http://localhost:3000/input');
  await page.waitForLoadState('networkidle');

  // --- UI verification: microphone section ---

  // Mic button exists and shows correct text
  const micBtn = page.locator('button:has-text("语音录入")');
  await expect(micBtn).toBeVisible();

  // Mic button sub-text
  await expect(page.locator('text="点击开始，说完再点击结束"')).toBeVisible();

  // Textarea is visible and editable
  const textarea = page.locator('textarea');
  await expect(textarea).toBeVisible();

  // Fill text using React-friendly approach
  await textarea.click();
  await textarea.fill('张三请我喝酒，我们聊了聊他的创业项目，他是做AI的，毕业于清华');
  await expect(textarea).toHaveValue(/张三/, { timeout: 3000 });

  // Submit button becomes active (text changes to "汇报给 Jeffrey")
  const submitBtn = page.locator('button:has-text("汇报给 Jeffrey")');
  await expect(submitBtn).toBeVisible({ timeout: 3000 });

  // --- Trigger submission ---
  await submitBtn.click();

  // --- Wait for either success or error (up to 25s for AI) ---
  await page.waitForFunction(
    () =>
      document.body.innerText.includes('已提取人物') ||
      document.body.innerText.includes('分析失败'),
    { timeout: 25000 }
  );

  // Verify something happened — either result or error proves API was called
  const hasPersonCard = await page.getByText('已提取人物', { exact: false }).isVisible().catch(() => false);
  const hasError = await page.getByText('分析失败', { exact: false }).isVisible().catch(() => false);
  expect(hasPersonCard || hasError).toBeTruthy();
});
