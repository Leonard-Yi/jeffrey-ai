import { Page, Locator, expect } from '@playwright/test';

export class SuggestionsPage {
  readonly page: Page;
  readonly url = '/suggestions';

  // Module sections (match actual DOM structure)
  readonly relationshipReminder = () => this.page.getByText('关系维护提醒', { exact: false });
  readonly pendingTodos = () => this.page.getByText('待办承诺', { exact: false });
  readonly icebreaker = () => this.page.getByText('破冰助手', { exact: false });

  // Relationship reminder
  readonly staleContactCards = () => this.page.locator('[data-testid="stale-contact"]');
  readonly pokeButtons = () => this.page.locator('button:has-text("戳他")');

  // Pending todos
  readonly todoItems = () => this.page.locator('[data-testid="todo-item"]');

  // Icebreaker
  readonly personSelect = () => this.page.locator('select, [data-testid="person-select"]');
  readonly generateButton = () => this.page.locator('button:has-text("生成"), button:has-text("破冰")');
  readonly icebreakerResult = () => this.page.locator('[data-testid="icebreaker-result"]');

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(this.url);
    await this.page.waitForLoadState('networkidle');
  }

  async areThreeModulesVisible() {
    const reminder = await this.relationshipReminder().isVisible();
    const todos = await this.pendingTodos().isVisible();
    const ice = await this.icebreaker().isVisible();
    return reminder && todos && ice;
  }

  async selectPersonForIcebreaker(name: string) {
    await this.personSelect().selectOption({ label: name });
  }

  async generateIcebreaker() {
    await this.generateButton().click();
    await this.page.waitForTimeout(3000); // Wait for LLM response
  }

  async isIcebreakerResultVisible() {
    return this.icebreakerResult().isVisible({ timeout: 10000 });
  }
}
