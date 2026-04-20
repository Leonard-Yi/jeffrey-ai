import { Page, Locator, expect } from '@playwright/test';

export class InputPage {
  readonly page: Page;
  readonly url = '/input';

  // Selectors
  readonly textarea = () => this.page.locator('textarea');
  readonly submitButton = () => this.page.locator('button[type="submit"], button:has-text("提交"), button:has-text("汇报")');
  readonly resultCards = () => this.page.locator('[class*="card"], [class*="person-card"], [data-testid="person-card"]');
  readonly jeffreyBubble = () => this.page.locator('[class*="bubble"], [class*="message"]');
  readonly quickReplies = () => this.page.locator('[class*="quick-reply"], button:has-text("快捷回复")');
  readonly micButton = () => this.page.locator('button[aria-label*="mic"], button[aria-label*="麦克风"]');

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(this.url);
    await this.page.waitForLoadState('networkidle');
  }

  async submitText(text: string) {
    await this.textarea().fill(text);
    await this.submitButton().click();
    await this.page.waitForTimeout(3000); // Wait for LLM response
  }

  async expectResultCard(name: string) {
    await expect(this.resultCards().filter({ hasText: name })).toBeVisible({ timeout: 10000 });
  }

  async expectJeffreyResponse() {
    // Check for Jeffrey bubble
    const bubbleCount = await this.jeffreyBubble().count();
    if (bubbleCount > 0) {
      await expect(this.jeffreyBubble().first()).toBeVisible({ timeout: 10000 });
      return;
    }
    // If no bubble, check if name resolution dialog appeared instead
    const hasNameResolution = await this.isNameResolutionVisible();
    if (!hasNameResolution) {
      // Neither appeared - this is a real failure
      await expect(this.jeffreyBubble().first()).toBeVisible({ timeout: 5000 });
    }
    // If name resolution appeared, that's also acceptable (test should handle)
  }

  async isMicButtonVisible() {
    return this.micButton().isVisible();
  }

  // Check if name resolution dialog is shown (requires user interaction)
  async isNameResolutionVisible() {
    return this.page.locator('text="检测到疑似已有联系人"').isVisible({ timeout: 5000 }).catch(() => false);
  }
}
