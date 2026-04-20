import { Page, Locator, expect } from '@playwright/test';

export class NameResolvePrompt {
  readonly page: Page;
  readonly prompt = () => this.page.locator('[data-testid="name-resolve-prompt"], [role="dialog"]:has-text("姓名")');
  readonly candidateCards = () => this.page.locator('[data-testid="candidate-card"]');
  readonly confirmButton = () => this.page.locator('button:has-text("确认"), button:has-text("替换")');
  readonly skipButton = () => this.page.locator('button:has-text("跳过"), button:has-text("直接提交")');

  constructor(page: Page) {
    this.page = page;
  }

  async isOpen() {
    return this.prompt().isVisible({ timeout: 5000 });
  }

  async confirmResolution() {
    await this.confirmButton().click();
    await this.page.waitForTimeout(1000);
  }

  async skipResolution() {
    await this.skipButton().click();
    await this.page.waitForTimeout(1000);
  }

  async expectCandidatesCount(minCount: number) {
    const count = await this.candidateCards().count();
    expect(count).toBeGreaterThanOrEqual(minCount);
  }
}
