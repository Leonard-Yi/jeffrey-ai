import { Page, Locator, expect } from '@playwright/test';

export class GraphPage {
  readonly page: Page;
  readonly url = '/graph';

  // Graph selectors
  readonly canvas = () => this.page.locator('canvas');
  readonly nodes = () => this.page.locator('[class*="node"], [data-testid="graph-node"]');

  // Filter selectors
  readonly groupFilter = () => this.page.locator('[data-testid="group-filter"]');
  readonly linkTypeFilter = () => this.page.locator('[data-testid="link-type-filter"]');

  // Detail panel
  readonly detailPanel = () => this.page.locator('[class*="panel"], [class*="detail"], [data-testid="person-detail"]');
  readonly closeDetailButton = () => this.page.locator('button:has-text("关闭"), button[aria-label="close"]');

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(this.url);
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(2000); // Wait for graph to render
  }

  async clickNode(index: number = 0) {
    await this.nodes().nth(index).click({ force: true });
  }

  async isDetailPanelVisible() {
    return this.detailPanel().isVisible({ timeout: 5000 }).catch(() => false);
  }

  async filterByGroup(group: string) {
    await this.groupFilter().selectOption(group);
  }
}
