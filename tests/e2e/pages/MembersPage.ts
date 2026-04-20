import { Page, Locator, expect } from '@playwright/test';

export class MembersPage {
  readonly page: Page;
  readonly url = '/members';

  // Table selectors
  readonly tableRows = () => this.page.locator('tbody tr');
  readonly checkboxes = () => this.page.locator('input[type="checkbox"]');
  // More specific selector: main merge button in filter bar (contains "合并" and "条")
  readonly mergeButton = () => this.page.locator('button:has-text("合并"):has-text("条"), button:has-text("加载中")');

  // Filter selectors
  readonly careerFilter = () => this.page.locator('select, [data-testid="career-filter"]');
  readonly cityFilter = () => this.page.locator('[data-testid="city-filter"]');

  // Column headers
  readonly columnHeaders = () => this.page.locator('th');

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    // Try to use link navigation first (preserves session)
    const membersLink = this.page.locator('a[href="/members"], a:has-text("人脉")').first();
    const linkVisible = await membersLink.isVisible({ timeout: 1000 }).catch(() => false);

    if (linkVisible) {
      await membersLink.click();
      // Wait for URL to change to /members (handles Next.js client-side routing)
      await this.page.waitForURL('**/members**', { timeout: 10000 }).catch(() => {});
    } else {
      // Fallback to direct navigation
      await this.page.goto(this.url);
      await this.page.waitForLoadState('networkidle');
    }
    // Wait for data to load
    await this.page.waitForSelector('tbody tr', { timeout: 10000 }).catch(() => {});
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(2000);
  }

  async selectRow(index: number) {
    await this.checkboxes().nth(index).check();
  }

  async isMergeButtonVisible() {
    return this.mergeButton().isVisible();
  }

  async clickMergeButton() {
    await this.mergeButton().click();
  }

  async sortByColumn(columnName: string) {
    await this.columnHeaders().filter({ hasText: columnName }).click();
  }

  async filterByCareer(career: string) {
    await this.careerFilter().selectOption(career);
  }

  async getRowCount() {
    return this.tableRows().count();
  }

  async clickRow(index: number) {
    await this.tableRows().nth(index).click();
  }
}
