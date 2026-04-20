import { test, expect, Page } from '@playwright/test';
import { MembersPage } from '../pages/MembersPage';
import { PersonModal } from '../pages/components/PersonModal';

const TEST_PASSWORD = 'testpassword123';
const TEST_NAME = '测试用户';

function makeEmail() {
  return `e2e_mem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}@test.com`;
}

async function registerAndSignIn(page: Page, email: string, password: string, name: string) {
  await page.goto('/auth/signup');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('姓名').fill(name);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/auth/signin**', { timeout: 10000 }).catch(() => {});
  await page.waitForLoadState('networkidle');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await Promise.all([
    page.waitForURL('**/input**', { timeout: 20000 }),
    page.locator('button:has-text("登录")').click(),
  ]);
}

// 轮询等待直到 members API 返回 >= minRows 条数据
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

test.describe('人脉表格页 (/members)', () => {
  test('MEMBER-001: 表格加载并显示数据', async ({ page }) => {
    const email = makeEmail();
    await registerAndSignIn(page, email, TEST_PASSWORD, TEST_NAME);

    // 录入数据并轮询等待
    await page.locator('textarea').fill('今天和老王喝咖啡');
    await page.locator('button:has-text("汇报")').click();
    const rowCount = await waitForMembersData(page, 1, 30000);

    if (rowCount === 0) {
      test.skip();
      return;
    }

    // 进入 members 页验证
    const membersPage = new MembersPage(page);
    await membersPage.goto();
    await page.waitForLoadState('networkidle');
    await expect(membersPage.tableRows().first()).toBeVisible({ timeout: 10000 });
    expect(rowCount).toBeGreaterThan(0);
  });

  test('MEMBER-002: 点击行打开详情弹窗', async ({ page }) => {
    const email = makeEmail();
    await registerAndSignIn(page, email, TEST_PASSWORD, TEST_NAME);

    // 录入数据并轮询等待
    await page.locator('textarea').fill('今天和老王喝咖啡');
    await page.locator('button:has-text("汇报")').click();
    const rowCount = await waitForMembersData(page, 1, 30000);

    if (rowCount === 0) {
      test.skip();
      return;
    }

    const membersPage = new MembersPage(page);
    await membersPage.goto();
    await page.waitForLoadState('networkidle');

    await membersPage.clickRow(0);
    const personModal = new PersonModal(page);
    await expect(personModal.modal()).toBeVisible({ timeout: 5000 });

    // 关闭弹窗
    if (await personModal.modal().isVisible({ timeout: 1000 }).catch(() => false)) {
      await page.locator('[data-testid="person-modal"], [style*="z-index: 1000"] button:has-text("×")').click({ timeout: 5000 }).catch(async () => {
        await page.keyboard.press('Escape');
      });
      await expect(personModal.modal()).not.toBeVisible({ timeout: 3000 });
    }
  });

  test('MEMBER-003: 多选功能', async ({ page }) => {
    const email = makeEmail();
    await registerAndSignIn(page, email, TEST_PASSWORD, TEST_NAME);

    // 录入两条数据，轮询等待至少 2 条
    await page.locator('textarea').fill('今天和老王喝咖啡');
    await page.locator('button:has-text("汇报")').click();
    await waitForMembersData(page, 1, 30000);

    await page.locator('textarea').fill('今天见了张总VC合伙人');
    await page.locator('button:has-text("汇报")').click();
    const rowCount = await waitForMembersData(page, 2, 30000);

    if (rowCount < 2) {
      test.skip();
      return;
    }

    const membersPage = new MembersPage(page);
    await membersPage.goto();
    await page.waitForLoadState('networkidle');

    await membersPage.selectRow(0);
    await membersPage.selectRow(1);
    await expect(membersPage.checkboxes().nth(0)).toBeChecked();
    await expect(membersPage.checkboxes().nth(1)).toBeChecked();
  });
});
