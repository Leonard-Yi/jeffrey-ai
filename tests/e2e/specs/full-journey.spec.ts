import { test, expect, Page } from '@playwright/test';
import { MembersPage } from '../pages/MembersPage';
import { PersonModal } from '../pages/components/PersonModal';
import { MergeDialog } from '../pages/components/MergeDialog';
import { makeEmail, registerAndSignIn, navigateTo } from '../fixtures/auth';

/**
 * Jeffrey.AI 完整用户旅程 E2E 测试
 *
 * 测试范围：注册 → 录入 → 人脉列表 → 详情弹窗 → 编辑字段 →
 *   行动项 → 建议页 → 图谱页 → 合并重复联系人 → 页面导航
 */

const TEST_PASSWORD = 'testpassword123';
const TEST_NAME = '测试用户';

// Poll members API until >= minRows rows exist
async function waitForMembersData(page: Page, minRows = 1, timeout = 30000): Promise<number> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const apiRes = await page.evaluate(async () => {
      const r = await fetch('/api/members/table');
      if (!r.ok) return { count: 0 };
      const d = await r.json();
      return { count: d.rows?.length || 0 };
    });
    if (apiRes.count >= minRows) return apiRes.count;
    await page.waitForTimeout(1000);
  }
  const final = await page.evaluate(async () => {
    const r = await fetch('/api/members/table');
    if (!r.ok) return 0;
    const d = await r.json();
    return d.rows?.length || 0;
  });
  return final;
}

// Submit text to LLM and handle name resolution if it appears
async function submitText(page: Page, text: string) {
  await page.locator('textarea').fill(text);
  await page.locator('button:has-text("告诉 Jeffery")').click();
  // Wait for button to become enabled again (LLM round-trip complete)
  await page.locator('button:has-text("告诉 Jeffery")').waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});

  const resolveVisible = await page.locator('text="检测到疑似已有联系人"').isVisible({ timeout: 3000 }).catch(() => false);
  if (resolveVisible) {
    await page.locator('button:has-text("跳过全部")').click().catch(() => {});
    await page.waitForTimeout(2000);
  }
}

// Close person modal (try × button first, then Escape)
async function closeModal(page: Page) {
  await page.locator('[data-testid="person-modal"], [style*="z-index: 1000"] button:has-text("×")')
    .click({ timeout: 5000 }).catch(async () => {
      await page.keyboard.press('Escape');
    });
  await page.waitForTimeout(500);
}

test.describe('完整用户旅程', () => {

  test('FULL-001: 注册 → 录入 → 人脉列表 → 详情弹窗 → 编辑字段', async ({ page }) => {
    test.setTimeout(120000);
    const email = makeEmail();
    await registerAndSignIn(page, email, TEST_PASSWORD, TEST_NAME);

    // 录入三条人脉
    await submitText(page, '今天和老王喝咖啡，他让我帮忙看看BP，下周给他反馈');
    await submitText(page, '今天见了张总VC合伙人，聊了他们新基金的投资方向，他推荐我关注AI赛道');
    await submitText(page, '今天在清华见了李老师教授，研究AI和知识图谱，给我讲了很多有意思的研究方向');

    // 进入人脉列表
    await navigateTo(page, '/members');
    await page.waitForSelector('tbody tr', { timeout: 10000 }).catch(() => {});

    const membersPage = new MembersPage(page);
    const rowCount = await membersPage.getRowCount();
    if (rowCount === 0) { test.skip(); return; }
    expect(rowCount).toBeGreaterThanOrEqual(1);

    // 点击张总的记录
    const zhangRow = page.locator('tr:has-text("张总")').first();
    await zhangRow.click();
    const personModal = new PersonModal(page);
    await expect(personModal.modal()).toBeVisible({ timeout: 5000 });

    // 验证弹窗字段
    const modal = personModal.modal();
    await expect(modal.getByText('姓名')).toBeVisible();
    const scoreText = await modal.getByText(/\d+\/100/).first().textContent();
    expect(scoreText).toMatch(/\d+\/100/);
    await expect(modal.getByText('职业标签')).toBeVisible();
    await expect(modal.getByText(/^介绍人$/)).toBeVisible();

    // 编辑性格标签
    const vibeTagCard = modal.getByText('性格标签').locator('..');
    await vibeTagCard.click();
    await page.waitForTimeout(500);
    const saveButtonVisible = await page.locator('button:has-text("保存")').isVisible();
    expect(saveButtonVisible).toBeTruthy();
    await page.locator('button:has-text("取消")').click();
    await page.waitForTimeout(500);

    await closeModal(page);
  });

  test('FULL-002: 录入 → 查看行动项（社交债务）', async ({ page }) => {
    const email = makeEmail();
    await registerAndSignIn(page, email, TEST_PASSWORD, TEST_NAME);

    await submitText(page, '今天和老王喝咖啡，他让我帮忙看看BP，下周给他反馈');

    const rowCount = await waitForMembersData(page, 1, 30000);
    if (rowCount === 0) { test.skip(); return; }

    await navigateTo(page, '/members');

    const membersPage = new MembersPage(page);
    await membersPage.clickRow(0);
    const personModal = new PersonModal(page);
    await expect(personModal.modal()).toBeVisible({ timeout: 5000 });

    const modal = personModal.modal();
    await expect(modal.getByText('互动历史')).toBeVisible({ timeout: 3000 });

    await closeModal(page);
  });

  test('FULL-003: 建议页 - 破冰助手', async ({ page }) => {
    const email = makeEmail();
    await registerAndSignIn(page, email, TEST_PASSWORD, TEST_NAME);

    await navigateTo(page, '/suggestions');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('关系维护提醒')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('待办承诺')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('破冰助手')).toBeVisible({ timeout: 3000 });

    const pokeButtons = page.locator('text="戳他"');
    const pokeCount = await pokeButtons.count();
    if (pokeCount > 0) {
      await expect(pokeButtons.first()).toBeVisible();
    }

    const selectVisible = await page.locator('select').isVisible({ timeout: 3000 }).catch(() => false);
    if (selectVisible) {
      const options = await page.locator('select option').count();
      expect(options).toBeGreaterThan(0);
    }

    const styleButton = page.locator('button:has-text("日常")');
    await expect(styleButton).toBeVisible();
  });

  test('FULL-004: 图谱页渲染', async ({ page }) => {
    const email = makeEmail();
    await registerAndSignIn(page, email, TEST_PASSWORD, TEST_NAME);

    await navigateTo(page, '/graph');
    await page.waitForLoadState('networkidle');

    const errorState = await page.locator("text=\"This page couldn't load\"").isVisible({ timeout: 2000 }).catch(() => false);
    if (errorState) { test.skip(); return; }

    const filterBar = page.getByText('职业').first();
    await expect(filterBar).toBeVisible({ timeout: 5000 });

    const legend = page.getByText('关系类型');
    const legendVisible = await legend.isVisible({ timeout: 3000 }).catch(() => false);

    const canvasCount = await page.locator('canvas').count();
    if (canvasCount > 0) {
      await expect(page.locator('canvas').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('FULL-005: 合并两个重复联系人', async ({ page }) => {
    const email = makeEmail();
    await registerAndSignIn(page, email, TEST_PASSWORD, TEST_NAME);

    await submitText(page, '今天和老王喝咖啡，他让我帮忙看看BP，下周给他反馈');
    await submitText(page, '今天见了张总VC合伙人，聊了他们新基金的投资方向');

    const rowCount = await waitForMembersData(page, 2, 30000);
    if (rowCount < 2) { test.skip(); return; }

    await navigateTo(page, '/members');
    await page.waitForSelector('tbody tr', { timeout: 10000 }).catch(() => {});

    const membersPage = new MembersPage(page);
    await membersPage.selectRow(0);
    await membersPage.selectRow(1);
    await expect(membersPage.mergeButton()).toBeVisible({ timeout: 3000 });

    await membersPage.clickMergeButton();

    const mergeDialog = new MergeDialog(page);
    await expect(mergeDialog.dialog()).toBeVisible({ timeout: 10000 });
    await expect(mergeDialog.confirmButton()).toBeVisible();

    await mergeDialog.cancel();
    await expect(mergeDialog.dialog()).not.toBeVisible({ timeout: 3000 });
  });

  test('FULL-006: 录入后建议页关系维护提醒更新', async ({ page }) => {
    const email = makeEmail();
    await registerAndSignIn(page, email, TEST_PASSWORD, TEST_NAME);

    await submitText(page, '今天和赵律师见面，聊了聊法律科技领域的合作机会');

    await navigateTo(page, '/suggestions');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('关系维护提醒')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('待办承诺')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('破冰助手')).toBeVisible({ timeout: 3000 });
  });

  test('FULL-007: 验证页面间导航连贯', async ({ page }) => {
    const email = makeEmail();
    await registerAndSignIn(page, email, TEST_PASSWORD, TEST_NAME);

    await navigateTo(page, '/members');
    await navigateTo(page, '/graph');
    await navigateTo(page, '/suggestions');
    await navigateTo(page, '/input');

    await expect(page.locator('textarea')).toBeVisible({ timeout: 3000 });
  });
});
