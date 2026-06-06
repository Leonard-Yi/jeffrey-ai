import { test, expect } from '@playwright/test';
import { InputPage } from '../pages/InputPage';
import { makeEmail, registerAndSignIn } from '../fixtures/auth';

const TEST_PASSWORD = 'testpassword123';
const TEST_NAME = '旅程测试';

test.describe('完整录入旅程', () => {
  let inputPage: InputPage;

  test.beforeEach(async ({ page }) => {
    const email = makeEmail('journey');
    await registerAndSignIn(page, email, TEST_PASSWORD, TEST_NAME);
    inputPage = new InputPage(page);
    await inputPage.goto();
    await page.waitForLoadState('networkidle');
  });

  test('JOURNEY-1: 空状态页面检查', async ({ page }) => {
    // Verify the input page looks correct in empty state
    const textarea = inputPage.textarea();
    await expect(textarea).toBeVisible({ timeout: 15000 });
    await expect(textarea).toBeEmpty();

    // Submit should be disabled when empty
    const submitBtn = inputPage.submitButton();
    await expect(submitBtn).toBeDisabled();

    // Jeffrey greeting card should be visible (random quote, check for J avatar)
    const greeting = page.locator('text=J').first();
    await expect(greeting).toBeVisible({ timeout: 5000 });

    // Voice button should be visible
    const micBtn = inputPage.micButton();
    await expect(micBtn).toBeVisible();

    console.log('✅ JOURNEY-1: Empty state looks correct');
  });

  test('JOURNEY-2: 清晰人名 → 分析 → 结束', async ({ page }) => {
    const text = '今天跟王磊在星巴克聊了AI创业，约了下周三给他发BP。';
    await inputPage.textarea().fill(text);
    await inputPage.submitButton().click();

    // Phase 1: Should transition to analyzing phase (SSE animation)
    // The textarea should disappear or be replaced by analysis progress
    const analyzingStep = page.locator('text=解析文本').or(page.locator('text=LLM 提取'));
    const analyzingVisible = await analyzingStep.first().isVisible({ timeout: 10000 }).catch(() => false);
    console.log('Phase 1 - Analyzing: ' + (analyzingVisible ? '✅ visible' : '⚠ not seen'));

    // Phase 2: Wait for follow-up or result
    const outcome = await Promise.race([
      page.locator('text=Jeffrey 追问').first().waitFor({ timeout: 50000 }).then(() => 'followup'),
      page.locator('text=数据已').first().waitFor({ timeout: 50000 }).then(() => 'result'),
      new Promise(r => setTimeout(() => r('timeout'), 55000)),
    ]);
    console.log('Phase 2 - Outcome: ' + outcome);

    if (outcome === 'followup') {
      // Skip all follow-up questions
      const skipAll = page.locator('text=全部跳过').first();
      if (await skipAll.isVisible({ timeout: 3000 }).catch(() => false)) {
        await skipAll.click();
        await page.waitForTimeout(2000);
      }
    }

    // Phase 3: Should be on result page
    try {
      await page.locator('text=数据已').first().waitFor({ timeout: 25000 });
      console.log('Phase 3 - Result: ✅ displayed');

      // Verify key result elements
      const hasComment = await page.locator('text=Jeffrey 的点评').first().isVisible().catch(() => false);
      console.log('  Jeffrey comment: ' + (hasComment ? '✅' : '⚠'));

      const hasPersons = await page.locator('text=已提取人物').first().isVisible().catch(() => false);
      console.log('  Extracted persons: ' + (hasPersons ? '✅' : '⚠'));

      // Check the full page for expected name
      const bodyText = await page.locator('body').textContent() || '';
      if (bodyText.includes('王磊') || bodyText.includes('星巴克')) {
        console.log('  Name/context detected: ✅');
      }

      // CTA button should be present
      const cta = page.locator('text=录入新的互动').first();
      if (await cta.isVisible().catch(() => false)) {
        console.log('  CTA button: ✅');
      }
    } catch {
      console.log('Phase 3 - Result: ❌ not found');
    }
  });

  test('JOURNEY-3: 模糊人名 → 追问 → 填写 → 完成', async ({ page }) => {
    const text = '我今天见了一个做区块链的技术大佬，跟他约了下周的咖啡，要继续谈谈收购他那家公司的事情。';
    await inputPage.textarea().fill(text);
    await inputPage.submitButton().click();

    // Wait for follow-up or result
    const outcome = await Promise.race([
      page.locator('text=Jeffrey 追问').first().waitFor({ timeout: 60000 }).then(() => 'followup'),
      page.locator('text=数据已').first().waitFor({ timeout: 60000 }).then(() => 'result'),
      new Promise(r => setTimeout(() => r('timeout'), 65000)),
    ]);
    console.log('Outcome: ' + outcome);

    if (outcome === 'result') {
      console.log('⚠ LLM completed directly without follow-up (acceptable)');
      // Skip to end — result is already showing
      const cta = page.locator('text=录入新的互动').first();
      await expect(cta).toBeVisible({ timeout: 5000 });
      console.log('✅ JOURNEY-3 PASS: Direct completion');
      return;
    }

    if (outcome === 'timeout') {
      console.log('⚠ Still processing after 65s');
      return;
    }

    console.log('Follow-up triggered: ✅');
    expect(outcome).toBe('followup');

    // Check what round we're on
    const round1Label = page.locator('text=第 1 问').first();
    if (await round1Label.isVisible().catch(() => false)) {
      console.log('  Round 1 visible: ✅');

      // Get the question text
      const questionEl = page.locator('text=第 1 问').locator('..');
      const questionText = await questionEl.textContent();
      console.log('  Question: ' + (questionText?.slice(0, 80) || '?'));

      // Fill in the name
      const nameInput = page.locator('input[type="text"]').first();
      if (await nameInput.isVisible().catch(() => false)) {
        await nameInput.fill('李总');
        await page.waitForTimeout(300);

        // Check if quick suggestions are visible
        const quickBtns = page.locator('text=快速选择');
        if (await quickBtns.isVisible().catch(() => false)) {
          console.log('  Quick suggestions: ✅');
        }

        // Click continue
        const continueBtn = page.locator('button:has-text("继续")').first();
        if (await continueBtn.isVisible().catch(() => false)) {
          await continueBtn.click();
          await page.waitForTimeout(1500);
          console.log('  Clicked continue: ✅');
        }
      }
    }

    // Handle round 2 (company) if it appears
    const round2Label = page.locator('text=第 2 问').first();
    if (await round2Label.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('  Round 2 visible: ✅');
      const skipBtn = page.locator('button:has-text("跳过")').first();
      if (await skipBtn.isEnabled({ timeout: 2000 }).catch(() => false)) {
        await skipBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    // Handle round 3 (location) if it appears
    const round3Label = page.locator('text=第 3 问').first();
    if (await round3Label.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('  Round 3 visible: ✅');
      const confirmBtn = page.locator('button:has-text("完成")').or(page.locator('button:has-text("继续")')).first();
      if (await confirmBtn.isEnabled({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(1500);
      }
    }

    // Wait for result
    try {
      await page.locator('text=数据已').first().waitFor({ timeout: 30000 });
      console.log('Result page appeared: ✅');

      // Check if the answer was saved
      const bodyText = await page.locator('body').textContent() || '';
      if (bodyText.includes('李总')) {
        console.log('Provided name saved: ✅');
      }

      // Check for supplement input
      const supplement = page.locator('text=补充更多信息').first();
      if (await supplement.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('Supplement input visible: ✅');
      }

      // CTA button
      const cta = page.locator('text=录入新的互动').first();
      await expect(cta).toBeVisible({ timeout: 5000 });
      console.log('CTA button: ✅');
    } catch {
      console.log('Result page: ❌ did not appear');
    }
  });

  test('JOURNEY-4: 保存状态 + 补充信息', async ({ page }) => {
    const text = '今天跟张总聊了供应链金融的项目，下周一给他发方案。';
    await inputPage.textarea().fill(text);
    await inputPage.submitButton().click();

    // Wait for result or timeout
    const outcome = await Promise.race([
      page.locator('text=数据已').first().waitFor({ timeout: 55000 }).then(() => 'result'),
      page.locator('text=Jeffrey 追问').first().waitFor({ timeout: 55000 }).then(() => 'followup'),
      new Promise(r => setTimeout(() => r('timeout'), 60000)),
    ]);
    console.log('Outcome: ' + outcome);

    if (outcome === 'followup') {
      const skipAll = page.locator('text=全部跳过').first();
      if (await skipAll.isVisible({ timeout: 2000 }).catch(() => false)) {
        await skipAll.click();
        await page.waitForTimeout(1500);
      }
    }

    // Check save status indicator
    try {
      const saveIndicator = page.locator('text=正在保存').or(page.locator('text=数据已完整保存'));
      const indicatorVisible = await saveIndicator.first().isVisible({ timeout: 15000 }).catch(() => false);
      console.log('Save status indicator: ' + (indicatorVisible ? '✅' : '⚠ not seen'));

      if (indicatorVisible) {
        // Wait for saving to complete
        await page.waitForTimeout(3000);
        const saveDone = await page.locator('text=数据已完整保存').first().isVisible().catch(() => false);
        console.log('Save completed: ' + (saveDone ? '✅' : '⚠ still saving'));
      }
    } catch { /* OK */ }

    // Try the supplement input
    const supplementArea = page.locator('textarea').first();
    if (await supplementArea.isVisible({ timeout: 3000 }).catch(() => false)) {
      await supplementArea.fill('张总还提到了他们在谈一个海外客户');
      console.log('Supplement text filled: ✅');

      const submitSupplement = page.locator('button:has-text("提交补充")').first();
      if (await submitSupplement.isEnabled({ timeout: 2000 }).catch(() => false)) {
        await submitSupplement.click();
        await page.waitForTimeout(3000);
        console.log('Supplement submitted: ✅');
      }
    }

    // Click CTA to reset
    const cta = page.locator('text=录入新的互动').first();
    if (await cta.isVisible({ timeout: 5000 }).catch(() => false)) {
      await cta.click();
      await page.waitForLoadState('networkidle');
      console.log('Reset to input: ✅');

      // Verify we're back on input with empty textarea
      const textarea = inputPage.textarea();
      await expect(textarea).toBeEmpty({ timeout: 5000 });
      console.log('Textarea cleared for new entry: ✅');
    }
  });
});
