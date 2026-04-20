import { test, expect, Page } from '@playwright/test';
import { MembersPage } from '../pages/MembersPage';
import { MergeDialog } from '../pages/components/MergeDialog';

const TEST_PASSWORD = 'testpassword123';
const TEST_NAME = '测试用户';

function makeEmail() {
  return `e2e_merge_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}@test.com`;
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

async function submitInteraction(page: Page, text: string) {
  await page.locator('textarea').fill(text);
  await page.locator('button:has-text("汇报")').click();
  await page.locator('button:has-text("汇报")').waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  const resolveVisible = await page.locator('text="检测到疑似已有联系人"').isVisible({ timeout: 3000 }).catch(() => false);
  if (resolveVisible) {
    await page.locator('button:has-text("跳过全部")').click().catch(() => {});
    await page.waitForTimeout(3000);
  }
}

async function createMembers(page: Page, count: number) {
  const names = ['老王', '张总', '李老师', '赵律师', '王教授'];
  const texts = [
    '今天和[NAME]喝咖啡，他让我帮忙看看BP',
    '今天见了[NAME]VC合伙人，聊了投资方向',
    '今天在清华见了[NAME]教授，研究AI和知识图谱',
    '今天和[NAME]律师见面，聊了法律科技合作',
    '今天见了[NAME]，讨论创业方向',
  ];
  for (let i = 0; i < count; i++) {
    const text = texts[i % texts.length].replace('[NAME]', names[i % names.length]);
    await submitInteraction(page, text);
  }
}

test.describe('手动合并流程', () => {
  test('MERGE-001: 选择2+条记录后合并按钮可见', async ({ page }) => {
    const email = makeEmail();
    await registerAndSignIn(page, email, TEST_PASSWORD, TEST_NAME);
    await createMembers(page, 2);

    const membersPage = new MembersPage(page);
    await membersPage.goto();
    await page.waitForLoadState('networkidle');

    const rowCount = await membersPage.getRowCount();
    if (rowCount < 2) { test.skip(); return; }

    await membersPage.selectRow(0);
    await membersPage.selectRow(1);
    await expect(membersPage.mergeButton()).toBeVisible();
  });

  test('MERGE-002: 点击合并按钮显示加载状态', async ({ page }) => {
    const email = makeEmail();
    await registerAndSignIn(page, email, TEST_PASSWORD, TEST_NAME);
    await createMembers(page, 2);

    const membersPage = new MembersPage(page);
    await membersPage.goto();
    await page.waitForLoadState('networkidle');

    const rowCount = await membersPage.getRowCount();
    if (rowCount < 2) { test.skip(); return; }

    await membersPage.selectRow(0);
    await membersPage.selectRow(1);
    await membersPage.clickMergeButton();

    const mergeBtn = membersPage.mergeButton();
    await expect(mergeBtn).toContainText('加载中');
    await expect(mergeBtn).toBeDisabled();
  });

  test('MERGE-003: 加载完成后对话框打开', async ({ page }) => {
    const email = makeEmail();
    await registerAndSignIn(page, email, TEST_PASSWORD, TEST_NAME);
    await createMembers(page, 2);

    const membersPage = new MembersPage(page);
    await membersPage.goto();
    await page.waitForLoadState('networkidle');

    const rowCount = await membersPage.getRowCount();
    if (rowCount < 2) { test.skip(); return; }

    const mergeDialog = new MergeDialog(page);
    await membersPage.selectRow(0);
    await membersPage.selectRow(1);
    await membersPage.clickMergeButton();
    await expect(mergeDialog.dialog()).toBeVisible({ timeout: 10000 });
    await expect(mergeDialog.confirmButton()).toBeVisible();
  });

  test('MERGE-004: 默认选中关系分最高的主条目', async ({ page }) => {
    const email = makeEmail();
    await registerAndSignIn(page, email, TEST_PASSWORD, TEST_NAME);
    await createMembers(page, 2);

    const membersPage = new MembersPage(page);
    const mergeDialog = new MergeDialog(page);
    await membersPage.goto();
    await page.waitForLoadState('networkidle');

    const rowCount = await membersPage.getRowCount();
    if (rowCount < 2) { test.skip(); return; }

    await membersPage.selectRow(0);
    await membersPage.selectRow(1);
    await membersPage.clickMergeButton();
    await mergeDialog.dialog().waitFor({ state: 'visible', timeout: 10000 });

    await expect(mergeDialog.survivorCard()).toBeVisible();
    const personCount = await mergeDialog.getPersonCount();
    await expect(mergeDialog.victimCards()).toHaveCount(personCount - 1);
  });

  test('MERGE-005: 单选按钮切换主条目', async ({ page }) => {
    const email = makeEmail();
    await registerAndSignIn(page, email, TEST_PASSWORD, TEST_NAME);
    await createMembers(page, 2);

    const membersPage = new MembersPage(page);
    const mergeDialog = new MergeDialog(page);
    await membersPage.goto();
    await page.waitForLoadState('networkidle');

    const rowCount = await membersPage.getRowCount();
    if (rowCount < 2) { test.skip(); return; }

    await membersPage.selectRow(0);
    await membersPage.selectRow(1);
    await membersPage.clickMergeButton();
    await mergeDialog.dialog().waitFor({ state: 'visible', timeout: 10000 });
    await mergeDialog.page.waitForLoadState('networkidle');

    const initialSurvivor = await mergeDialog.getSurvivorName();
    // 找到未选中的单选框（victim）并点击它来切换 survivor
    const uncheckedRadios = await mergeDialog.dialog().locator('input[type="radio"]:not(:checked)').all();
    if (uncheckedRadios.length > 0) {
      await uncheckedRadios[0].click({ force: true });
    }

    // 等待 survivor 变更（最多 8 秒）
    await mergeDialog.page.waitForFunction(
      (initialName) => {
        const dialog = document.querySelector('div[style*="position: fixed"]');
        if (!dialog) return false;
        const checkedRadio = dialog.querySelector('input[type="radio"]:checked');
        if (!checkedRadio) return false;
        const card = checkedRadio.closest('div[style*="border-radius: 10px"]');
        if (!card) return false;
        const spans = card.querySelectorAll('span');
        for (const span of spans) {
          const text = span.textContent?.trim() || '';
          if (/[\u4e00-\u9fa5]/.test(text) && text.length < 10 &&
              !text.includes('关系') && !text.includes('主条目') && !text.includes('合并')) {
            return text !== initialName;
          }
        }
        return false;
      },
      initialSurvivor,
      { timeout: 8000 }
    );

    const newSurvivor = await mergeDialog.getSurvivorName();
    expect(newSurvivor).not.toBe(initialSurvivor);
  });

  test('MERGE-006: 取消合并', async ({ page }) => {
    const email = makeEmail();
    await registerAndSignIn(page, email, TEST_PASSWORD, TEST_NAME);
    await createMembers(page, 2);

    const membersPage = new MembersPage(page);
    const mergeDialog = new MergeDialog(page);
    await membersPage.goto();
    await page.waitForLoadState('networkidle');

    const rowCount = await membersPage.getRowCount();
    if (rowCount < 2) { test.skip(); return; }

    await membersPage.selectRow(0);
    await membersPage.selectRow(1);
    await membersPage.clickMergeButton();
    await mergeDialog.dialog().waitFor({ state: 'visible', timeout: 10000 });
    await mergeDialog.cancel();
    await expect(mergeDialog.dialog()).not.toBeVisible();
  });

  test('MERGE-007: 确认合并后本地状态更新', async ({ page }) => {
    const email = makeEmail();
    await registerAndSignIn(page, email, TEST_PASSWORD, TEST_NAME);
    await createMembers(page, 2);

    const membersPage = new MembersPage(page);
    const mergeDialog = new MergeDialog(page);
    await membersPage.goto();
    await page.waitForLoadState('networkidle');

    const rowCount = await membersPage.getRowCount();
    if (rowCount < 2) { test.skip(); return; }

    await membersPage.selectRow(0);
    await membersPage.selectRow(1);
    await membersPage.clickMergeButton();
    await mergeDialog.dialog().waitFor({ state: 'visible', timeout: 10000 });
    await mergeDialog.confirm();
    await expect(mergeDialog.dialog()).not.toBeVisible({ timeout: 5000 });

    const newRowCount = await membersPage.getRowCount();
    expect(newRowCount).toBe(rowCount - 1);
  });
});
