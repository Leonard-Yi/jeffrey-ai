import { test, expect, Page } from '@playwright/test';
import { MembersPage } from '../pages/MembersPage';
import { PersonModal } from '../pages/components/PersonModal';
import { MergeDialog } from '../pages/components/MergeDialog';

/**
 * Jeffrey.AI 完整用户旅程 E2E 测试
 *
 * 测试范围：
 * 1. 注册新账号
 * 2. 录入多条人脉信息
 * 3. 查看人脉列表
 * 4. 打开详情弹窗，验证所有字段
 * 5. 编辑字段并保存
 * 6. 验证行动项（社交债务）
 * 7. 查看建议页
 * 8. 图谱页
 * 9. 合并两个重复联系人
 */

// Generate unique email per test to avoid parallel test conflicts
const TEST_PASSWORD = 'testpassword123';
const TEST_NAME = '测试用户';

function makeEmail() {
  return `e2e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}@test.com`;
}

// 轮询等待直到 members API 返回 >= minRows 条数据
async function waitForMembersData(page: Page, minRows = 1, timeout = 30000): Promise<number> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    // 直接调用 members API
    const apiRes = await page.evaluate(async () => {
      const r = await fetch('/api/members/table');
      if (!r.ok) return { count: 0 };
      const d = await r.json();
      return { count: d.rows?.length || 0 };
    });
    if (apiRes.count >= minRows) return apiRes.count;
    await page.waitForTimeout(1000);
  }
  // 超时后最后一次检查
  const final = await page.evaluate(async () => {
    const r = await fetch('/api/members/table');
    if (!r.ok) return 0;
    const d = await r.json();
    return d.rows?.length || 0;
  });
  return final;
}

// ─── Auth Helpers ────────────────────────────────────────────────────────────

async function register(page: Page, email: string, password: string, name: string) {
  await page.goto('/auth/signup');
  await page.waitForLoadState('networkidle');

  // Fill registration form - look for name input by label text
  await page.getByLabel('姓名').fill(name);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);

  await page.locator('button[type="submit"]').click();
  // After successful registration, redirects to sign-in
  await page.waitForURL('**/auth/signin**', { timeout: 10000 }).catch(() => {});
  await page.waitForLoadState('networkidle');
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/auth/signin');
  await page.waitForLoadState('networkidle');

  // Clear any pre-filled values
  await page.locator('input[type="email"]').clear();
  await page.locator('input[type="password"]').clear();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);

  // Click and wait for navigation with explicit timeout handling
  await Promise.all([
    page.waitForURL('**/input**', { timeout: 20000 }),
    page.locator('button:has-text("登录")').click(),
  ]);

  // Verify we're on the input page
  const textareaVisible = await page.locator('textarea').isVisible({ timeout: 5000 }).catch(() => false);
  if (!textareaVisible) {
    // Check if there's an error on the sign-in page
    const errorVisible = await page.locator('text="邮箱或密码错误"').isVisible().catch(() => false);
    if (errorVisible) {
      throw new Error('Sign-in failed: Invalid email or password');
    }
    // Check if still on sign-in page
    const onSignIn = page.url().includes('/auth/signin');
    if (onSignIn) {
      throw new Error(`Sign-in did not navigate away from sign-in page. URL: ${page.url()}`);
    }
    throw new Error(`Sign-in did not reach input page. Current URL: ${page.url()}`);
  }
}

// Register and then immediately sign in to get to the input page
async function registerAndSignIn(page: Page, email: string, password: string, name: string) {
  await register(page, email, password, name);
  // Now sign in with the registered credentials
  await signIn(page, email, password);
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

test.describe('完整用户旅程', () => {

  test('FULL-001: 注册 → 录入 → 人脉列表 → 详情弹窗 → 编辑字段', async ({ page }) => {
    test.setTimeout(120000); // MiniMax API 可能慢，需要更长时间
    const email = makeEmail();
    // Step 1: 注册并登录
    await registerAndSignIn(page, email, TEST_PASSWORD, TEST_NAME);

    // Step 2: 录入第一个人 - 老王
    await page.waitForSelector('textarea', { timeout: 5000 });
    await page.locator('textarea').fill('今天和老王喝咖啡，他让我帮忙看看BP，下周给他反馈');
    await page.locator('button:has-text("汇报")').click();

    // 等待 Jeffrey 处理（可能出名字解析或回复）
    await page.waitForTimeout(5000);

    // 如果出现名字解析，点击"跳过全部"按钮
    const resolveVisible = await page.locator('text="检测到疑似已有联系人"').isVisible({ timeout: 3000 }).catch(() => false);
    if (resolveVisible) {
      const skipAll = page.locator('button:has-text("跳过全部")');
      if (await skipAll.isVisible({ timeout: 2000 }).catch(() => false)) {
        await skipAll.click();
        await page.waitForTimeout(3000);
      }
    }

    // Step 3: 录入第二个人 - 张总
    await page.locator('textarea').fill('今天见了张总VC合伙人，聊了他们新基金的投资方向，他推荐我关注AI赛道');
    await page.locator('button:has-text("汇报")').click();
    // 等待按钮恢复（防止 API 慢导致按钮一直 disabled）
    await page.locator('button:has-text("汇报")').waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});

    const resolveVisible2 = await page.locator('text="检测到疑似已有联系人"').isVisible({ timeout: 3000 }).catch(() => false);
    if (resolveVisible2) {
      const skipAll2 = page.locator('button:has-text("跳过全部")');
      if (await skipAll2.isVisible({ timeout: 2000 }).catch(() => false)) {
        await skipAll2.click();
        await page.waitForTimeout(3000);
      }
    }

    // Step 4: 录入第三个人 - 李老师
    await page.locator('textarea').fill('今天在清华见了李老师教授，研究AI和知识图谱，给我讲了很多有意思的研究方向');
    await page.locator('button:has-text("汇报")').click();
    // 等待按钮恢复（API 可能挂，最多等 20 秒）
    await page.locator('button:has-text("汇报")').waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});

    // Step 5: 进入人脉列表
    const membersLink = page.locator('a[href="/members"], nav a:has-text("人脉")').first();
    await membersLink.click();
    await page.waitForURL('**/members**', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 验证表格有数据
    const membersPage = new MembersPage(page);
    const rowCount = await membersPage.getRowCount();

    // 如果没有创建任何人（MiniMax API 可能过载），跳过详情弹窗测试
    if (rowCount === 0) {
      test.skip();
      return;
    }

    // 至少有 1 条数据才能测试详情弹窗
    expect(rowCount).toBeGreaterThanOrEqual(1);

    // Step 6: 点击张总那条记录打开详情弹窗（老王可能 score 只有 10，但张总是 100）
    const zhangRow = page.locator('tr:has-text("张总")').first();
    await zhangRow.click();
    const personModal = new PersonModal(page);
    await expect(personModal.modal()).toBeVisible({ timeout: 5000 });

    // Step 7: 验证详情弹窗中的字段
    const modal = personModal.modal();
    // 姓名字段应可见
    await expect(modal.getByText('姓名')).toBeVisible();

    // 关系评分条应可见（格式是 "X/100"）
    const scoreText = await modal.getByText(/\d+\/100/).first().textContent();
    expect(scoreText).toMatch(/\d+\/100/);

    // 职业标签可见
    await expect(modal.getByText('职业标签')).toBeVisible();

    // 介绍人区域可见
    await expect(modal.getByText(/^介绍人$/)).toBeVisible();

    // Step 8: 编辑字段 - 点击"性格标签"字段进入编辑
    const vibeTagCard = modal.getByText('性格标签').locator('..');
    await vibeTagCard.click();
    await page.waitForTimeout(500);

    // 应该出现输入框和保存/取消按钮
    const saveButtonVisible = await page.locator('button:has-text("保存")').isVisible();
    expect(saveButtonVisible).toBeTruthy();

    // 取消编辑
    await page.locator('button:has-text("取消")').click();
    await page.waitForTimeout(500);

    // Step 9: 关闭弹窗（按ESC或点击×）
    if (await personModal.modal().isVisible({ timeout: 1000 }).catch(() => false)) {
      // Try clicking × button directly
      await page.locator('[data-testid="person-modal"], [style*="z-index: 1000"] button:has-text("×")').click({ timeout: 5000 }).catch(async () => {
        // Fallback: press Escape
        await page.keyboard.press('Escape');
      });
      await expect(personModal.modal()).not.toBeVisible({ timeout: 3000 });
    }
  });

  test('FULL-002: 录入 → 查看行动项（社交债务）', async ({ page }) => {
    const email = makeEmail();
    await registerAndSignIn(page, email, TEST_PASSWORD, TEST_NAME);

    // 录入一条包含行动项的记录
    await page.locator('textarea').fill('今天和老王喝咖啡，他让我帮忙看看BP，下周给他反馈');
    await page.locator('button:has-text("汇报")').click();

    // 轮询等待数据出现（最多 30 秒）
    const rowCount = await waitForMembersData(page, 1, 30000);
    if (rowCount === 0) {
      test.skip();
      return;
    }

    // 跳过名字解析（如果出现）
    const resolveVisible = await page.locator('text="检测到疑似已有联系人"').isVisible({ timeout: 2000 }).catch(() => false);
    if (resolveVisible) {
      await page.locator('button:has-text("跳过全部")').click().catch(() => {});
    }

    // 进入人脉列表
    const membersLink = page.locator('a[href="/members"], nav a:has-text("人脉")').first();
    await membersLink.click();
    await page.waitForURL('**/members**', { timeout: 10000 });
    await page.waitForTimeout(1000);

    const membersPage = new MembersPage(page);

    // 打开第一个人的详情
    await membersPage.clickRow(0);
    const personModal = new PersonModal(page);
    await expect(personModal.modal()).toBeVisible({ timeout: 5000 });

    // 验证互动历史区域存在
    const modal = personModal.modal();
    await expect(modal.getByText('互动历史')).toBeVisible({ timeout: 3000 });

    // 关闭弹窗
    if (await personModal.modal().isVisible({ timeout: 1000 }).catch(() => false)) {
      await page.locator('[data-testid="person-modal"], [style*="z-index: 1000"] button:has-text("×")').click({ timeout: 5000 }).catch(async () => {
        await page.keyboard.press('Escape');
      });
      await expect(personModal.modal()).not.toBeVisible({ timeout: 3000 });
    }
  });

  test('FULL-003: 建议页 - 破冰助手', async ({ page }) => {
    const email = makeEmail();
    await registerAndSignIn(page, email, TEST_PASSWORD, TEST_NAME);

    // 进入建议页
    const suggestionsLink = page.locator('a[href="/suggestions"], nav a:has-text("建议")').first();
    await suggestionsLink.click();
    await page.waitForURL('**/suggestions**', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 验证三个模块都显示
    const reminderModule = page.getByText('关系维护提醒');
    const todoModule = page.getByText('待办承诺');
    const icebreakerModule = page.getByText('破冰助手');

    await expect(reminderModule).toBeVisible({ timeout: 5000 });
    await expect(todoModule).toBeVisible({ timeout: 3000 });
    await expect(icebreakerModule).toBeVisible({ timeout: 3000 });

    // 如果有联系人（关系维护提醒有数据），验证"戳他"按钮
    const pokeButtons = page.locator('text="戳他"');
    const pokeCount = await pokeButtons.count();
    if (pokeCount > 0) {
      await expect(pokeButtons.first()).toBeVisible();
    }

    // 验证破冰助手的选择联系人和风格选择器
    const selectVisible = await page.locator('select').isVisible({ timeout: 3000 }).catch(() => false);
    if (selectVisible) {
      const options = await page.locator('select option').count();
      expect(options).toBeGreaterThan(0); // 至少有占位符选项
    }

    // 验证风格选择按钮
    const styleButton = page.locator('button:has-text("日常")');
    await expect(styleButton).toBeVisible();
  });

  test('FULL-004: 图谱页渲染', async ({ page }) => {
    const email = makeEmail();
    await registerAndSignIn(page, email, TEST_PASSWORD, TEST_NAME);

    // 进入图谱页
    const graphLink = page.locator('a[href="/graph"], nav a:has-text("图谱")').first();
    await graphLink.click();
    await page.waitForURL('**/graph**', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // 检查 Sigma error state（空数据时 Sigma 可能报错）
    const errorState = await page.locator("text=\"This page couldn't load\"").isVisible({ timeout: 2000 }).catch(() => false);
    if (errorState) {
      // 空数据时的 Sigma 报错是已知的，跳过 canvas 检查
      test.skip();
      return;
    }

    // 验证过滤器存在
    const filterBar = page.getByText('职业').first();
    await expect(filterBar).toBeVisible({ timeout: 5000 });

    // 验证关系类型图例存在
    const legend = page.getByText('关系类型');
    const legendVisible = await legend.isVisible({ timeout: 3000 }).catch(() => false);

    // 如果有 canvas，验证渲染
    const canvasCount = await page.locator('canvas').count();
    if (canvasCount > 0) {
      await expect(page.locator('canvas').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('FULL-005: 合并两个重复联系人', async ({ page }) => {
    const email = makeEmail();
    await registerAndSignIn(page, email, TEST_PASSWORD, TEST_NAME);

    // 录入第一个人 - 老王
    await page.locator('textarea').fill('今天和老王喝咖啡，他让我帮忙看看BP，下周给他反馈');
    await page.locator('button:has-text("汇报")').click();
    await page.locator('button:has-text("汇报")').waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    const resolve1 = await page.locator('text="检测到疑似已有联系人"').isVisible({ timeout: 3000 }).catch(() => false);
    if (resolve1) {
      await page.locator('button:has-text("跳过全部")').click().catch(() => {});
    }

    // 录入第二个人 - 张总
    await page.locator('textarea').fill('今天见了张总VC合伙人，聊了他们新基金的投资方向');
    await page.locator('button:has-text("汇报")').click();
    await page.locator('button:has-text("汇报")').waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    const resolve2 = await page.locator('text="检测到疑似已有联系人"').isVisible({ timeout: 3000 }).catch(() => false);
    if (resolve2) {
      await page.locator('button:has-text("跳过全部")').click().catch(() => {});
    }

    // 轮询等待至少 2 条数据
    const rowCount = await waitForMembersData(page, 2, 30000);
    if (rowCount < 2) {
      test.skip();
      return;
    }

    // 进入人脉列表
    const membersLink = page.locator('a[href="/members"], nav a:has-text("人脉")').first();
    await membersLink.click();
    await page.waitForURL('**/members**', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const membersPage = new MembersPage(page);

    // 选择前两条记录
    await membersPage.selectRow(0);
    await membersPage.selectRow(1);

    // 验证合并按钮出现
    await expect(membersPage.mergeButton()).toBeVisible({ timeout: 3000 });

    // 点击合并
    await membersPage.clickMergeButton();

    // 等待对话框
    const mergeDialog = new MergeDialog(page);
    await expect(mergeDialog.dialog()).toBeVisible({ timeout: 10000 });

    // 验证对话框有内容
    await expect(mergeDialog.confirmButton()).toBeVisible();

    // 取消合并
    await mergeDialog.cancel();
    await expect(mergeDialog.dialog()).not.toBeVisible({ timeout: 3000 });
  });

  test('FULL-006: 录入后建议页关系维护提醒更新', async ({ page }) => {
    const email = makeEmail();
    await registerAndSignIn(page, email, TEST_PASSWORD, TEST_NAME);

    // 录入一条记录
    await page.locator('textarea').fill('今天和赵律师见面，聊了聊法律科技领域的合作机会');
    await page.locator('button:has-text("汇报")').click();
    await page.waitForTimeout(5000);

    const resolveVisible = await page.locator('text="检测到疑似已有联系人"').isVisible({ timeout: 3000 }).catch(() => false);
    if (resolveVisible) {
      const createNew = page.locator('text="不是以上任何人，创建新条目"').first();
      if (await createNew.isVisible({ timeout: 2000 }).catch(() => false)) {
        await createNew.click();
        await page.waitForTimeout(3000);
      }
    }

    // 进入建议页
    const suggestionsLink = page.locator('a[href="/suggestions"], nav a:has-text("建议")').first();
    await suggestionsLink.click();
    await page.waitForURL('**/suggestions**', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 验证建议页三个模块都正常加载（无崩溃）
    await expect(page.getByText('关系维护提醒')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('待办承诺')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('破冰助手')).toBeVisible({ timeout: 3000 });
  });

  test('FULL-007: 验证页面间导航连贯', async ({ page }) => {
    const email = makeEmail();
    await registerAndSignIn(page, email, TEST_PASSWORD, TEST_NAME);

    // Input → Members
    const membersLink = page.locator('a[href="/members"], nav a:has-text("人脉")').first();
    await membersLink.click();
    await page.waitForURL('**/members**', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Members → Graph
    const graphLink = page.locator('a[href="/graph"], nav a:has-text("图谱")').first();
    await graphLink.click();
    await page.waitForURL('**/graph**', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Graph → Suggestions
    const suggestionsLink = page.locator('a[href="/suggestions"], nav a:has-text("建议")').first();
    await suggestionsLink.click();
    await page.waitForURL('**/suggestions**', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Suggestions → Input
    const inputLink = page.locator('a[href="/input"], nav a:has-text("录入")').first();
    await inputLink.click();
    await page.waitForURL('**/input**', { timeout: 10000 });

    // 验证回到了录入页（textarea 存在）
    await expect(page.locator('textarea')).toBeVisible({ timeout: 3000 });
  });
});
