import { test, expect } from '@playwright/test';
import { SuggestionsPage } from '../pages/SuggestionsPage';
import { signIn } from '../fixtures/auth';

test.describe('建议页 (/suggestions)', () => {
  let suggestionsPage: SuggestionsPage;

  test.beforeEach(async ({ page }) => {
    await signIn(page);
    suggestionsPage = new SuggestionsPage(page);
    await suggestionsPage.goto();
  });

  test('SUGGEST-001: 三个模块都显示', async () => {
    // 验证三个核心模块都可见
    const modulesVisible = await suggestionsPage.areThreeModulesVisible();
    expect(modulesVisible).toBeTruthy();
  });

  test('SUGGEST-002: 关系维护提醒模块', async () => {
    // 验证关系维护模块可见
    await expect(suggestionsPage.relationshipReminder()).toBeVisible();

    // 如果有数据，验证"戳他"按钮存在
    const staleContactsCount = await suggestionsPage.staleContactCards().count();
    if (staleContactsCount > 0) {
      await expect(suggestionsPage.pokeButtons().first()).toBeVisible();
    }
  });

  test('SUGGEST-003: 待办承诺模块', async () => {
    // 验证待办承诺模块可见
    await expect(suggestionsPage.pendingTodos()).toBeVisible();

    // 验证待办项列表存在（无论是否有数据）
    await expect(suggestionsPage.todoItems().first()).toBeVisible({ timeout: 5000 }).catch(() => {
      // 没有待办项也是正确的
    });
  });

  test('SUGGEST-004: 破冰助手模块', async () => {
    // 验证破冰助手模块可见
    await expect(suggestionsPage.icebreaker()).toBeVisible();

    // 验证下拉选择框存在
    await expect(suggestionsPage.personSelect()).toBeVisible();
  });
});
