import { Page, Locator, expect } from '@playwright/test';

export class MergeDialog {
  readonly page: Page;
  // Dialog: finds overlay div containing "合并" text
  readonly dialog = () => this.page.locator('div[style*="position: fixed"]:has-text("合并")');
  // All person cards in the merge dialog - select by the card structure
  readonly personCards = () => this.dialog().locator('div[style*="border-radius: 10px"][style*="padding: 12px"]');
  // Radio buttons for selecting survivor
  readonly radioButtons = () => this.dialog().locator('input[type="radio"]');
  // The checked radio's parent card = survivor
  readonly survivorCard = () => this.dialog().locator('input[type="radio"]:checked').locator('..', { hasText: '主条目' }).first();
  // Unchecked radios = victims
  readonly victimCards = () => this.dialog().locator('input[type="radio"]:not(:checked)');
  // Confirm button with loading state text
  readonly confirmButton = () => this.dialog().locator('button:has-text("确认")');
  // Cancel button
  readonly cancelButton = () => this.dialog().locator('button:has-text("取消")');
  // Loading state button text
  readonly loadingButton = () => this.dialog().locator('button:has-text("合并中")');
  // Merge count header
  readonly mergeHeader = () => this.dialog().locator('h2:has-text("合并")');

  constructor(page: Page) {
    this.page = page;
  }

  async isOpen() {
    return this.dialog().isVisible({ timeout: 5000 });
  }

  async getPersonCount() {
    const text = await this.mergeHeader().textContent();
    const match = text?.match(/合并 (\d+) 条/);
    return match ? parseInt(match[1]) : 0;
  }

  async getSurvivorName() {
    await this.survivorCard().waitFor({ state: 'visible' });
    // Additional wait for React to fully render
    await this.page.waitForTimeout(500);
    // Use page.evaluate - find dialog by fixed position and text content
    const name = await this.page.evaluate(() => {
      const fixedDivs = document.querySelectorAll('div[style*="position: fixed"]');
      let dialog = null;
      for (const div of fixedDivs) {
        if (div.textContent?.includes('合并') && div.textContent?.includes('主条目')) {
          dialog = div;
          break;
        }
      }
      if (!dialog) return '';
      const checkedRadio = dialog.querySelector('input[type="radio"]:checked');
      if (!checkedRadio) return '';
      const cardContent = checkedRadio.closest('div[style*="border-radius: 10px"]');
      if (!cardContent) return '';
      const spans = cardContent.querySelectorAll('span');
      for (const span of spans) {
        const text = span.textContent?.trim() || '';
        if (/[\u4e00-\u9fa5]/.test(text) && text.length < 10 && !text.includes('关系') && !text.includes('主条目') && !text.includes('合并')) {
          return text;
        }
      }
      return '';
    });
    return name || '';
  }

  async selectSurvivorByIndex(index: number) {
    const radios = await this.radioButtons().all();
    if (index >= 0 && index < radios.length) {
      await radios[index].click({ force: true });
      // Wait for DOM to update: verify the clicked radio is now checked AND visible
      await this.page.waitForFunction(
        (selectedIndex) => {
          const radios = document.querySelectorAll('input[type="radio"]');
          return (radios[selectedIndex] as HTMLInputElement)?.checked === true;
        },
        index,
        { timeout: 5000 }
      );
      // Additional wait for React to propagate the state change to the DOM
      await this.page.waitForTimeout(500);
    }
  }

  async confirm() {
    await this.confirmButton().click();
    await this.page.waitForTimeout(1500);
  }

  async cancel() {
    await this.cancelButton().click();
    await this.page.waitForTimeout(500);
  }

  async expectSurvivorVisible() {
    await expect(this.survivorCard()).toBeVisible();
  }

  async expectVictimsCount(count: number) {
    await expect(this.victimCards()).toHaveCount(count);
  }
}
