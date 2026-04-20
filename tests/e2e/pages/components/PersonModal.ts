import { Page, Locator, expect } from '@playwright/test';

export class PersonModal {
  readonly page: Page;
  readonly modal = () => this.page.locator('[data-testid="person-modal"], [style*="z-index: 1000"]');
  readonly closeButton = () => this.page.locator('button:has-text("关闭"), button[aria-label="close"], [data-testid="close-modal"]');

  // Fields
  readonly nameField = () => this.page.locator('[data-testid="field-name"], [data-testid="name"]');
  readonly careerField = () => this.page.locator('[data-testid="field-careers"], [data-testid="careers"]');
  readonly vibeTagsField = () => this.page.locator('[data-testid="field-vibeTags"], [data-testid="vibe-tags"]');

  // Interaction history
  readonly interactionHistory = () => this.page.locator('[data-testid="interaction-history"]');
  readonly interactionItems = () => this.page.locator('[data-testid="interaction-item"]');

  constructor(page: Page) {
    this.page = page;
  }

  async isOpen() {
    return this.modal().isVisible({ timeout: 5000 });
  }

  async close() {
    await this.closeButton().click();
    await this.page.waitForTimeout(500);
  }

  async expectFieldVisible(fieldName: string) {
    await expect(this.page.locator(`[data-testid*="${fieldName}"]`)).toBeVisible();
  }

  async getInteractionCount() {
    return this.interactionItems().count();
  }
}
