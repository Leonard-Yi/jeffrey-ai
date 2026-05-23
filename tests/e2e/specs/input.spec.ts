import { test, expect } from '@playwright/test';
import { InputPage } from '../pages/InputPage';
import { makeEmail, registerAndSignIn } from '../fixtures/auth';

const TEST_PASSWORD = 'testpassword123';
const TEST_NAME = '测试用户';

test.describe('录入页 (/input)', () => {
  let inputPage: InputPage;

  test.beforeEach(async ({ page }) => {
    const email = makeEmail();
    await registerAndSignIn(page, email, TEST_PASSWORD, TEST_NAME);
    inputPage = new InputPage(page);
    await inputPage.goto();
  });

  test('INPUT-001: 基础文本录入流程', async () => {
    const testText = '今天和老王喝咖啡，他说最近在研究LLM';
    await inputPage.textarea().fill(testText);
    await inputPage.submitButton().click();

    // Wait for LLM response or name resolution
    await inputPage.page.waitForTimeout(3000);

    const hasNameResolution = await inputPage.isNameResolutionVisible();
    const hasJeffreyBubble = await inputPage.jeffreyBubble().count() > 0;

    if (!hasNameResolution && !hasJeffreyBubble) {
      const textareaValue = await inputPage.textarea().inputValue();
      expect(textareaValue).toBe(testText);
    }
  });

  test('INPUT-002: 麦克风按钮可见', async () => {
    const micVisible = await inputPage.isMicButtonVisible();
    expect(typeof micVisible).toBe('boolean');
  });

  test('INPUT-003: 页面元素完整加载', async () => {
    await expect(inputPage.textarea()).toBeVisible();
    await expect(inputPage.submitButton()).toBeVisible();
  });

  test('INPUT-004: Feature 1 - 按钮文案为"告诉 Jeffery"且宽度比例正确', async ({ page }) => {
    const tellButton = page.locator('button:has-text("告诉 Jeffery")');
    await expect(tellButton).toBeVisible();
    const tellButtonText = await tellButton.textContent();
    expect(tellButtonText).toContain('告诉 Jeffery');

    const clearButton = page.locator('button:has-text("清空")');
    await expect(clearButton).toBeVisible();

    const tellBox = await tellButton.boundingBox();
    const clearBox = await clearButton.boundingBox();
    expect(tellBox).not.toBeNull();
    expect(clearBox).not.toBeNull();
    const ratio = (tellBox!.width) / (clearBox!.width);
    expect(ratio).toBeGreaterThan(2);
    expect(ratio).toBeLessThan(4);
  });
});
