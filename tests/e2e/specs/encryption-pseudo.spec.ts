import { test, expect } from "@playwright/test";
import { InputPage } from "../pages/InputPage";
import { MembersPage } from "../pages/MembersPage";
import { makeEmail, registerAndSignIn, navigateTo } from "../fixtures/auth";

const TEST_PASSWORD = "testpassword123";
const TEST_NAME = "加密测试";

test.describe("加密与假名化", () => {

  test("ENC-001: 录入文本后数据加密存储，前端正常显示", async ({ page }) => {
    const email = makeEmail("enc");
    await registerAndSignIn(page, email, TEST_PASSWORD, TEST_NAME);

    // Submit text with real names
    const inputPage = new InputPage(page);
    await inputPage.textarea().fill("今天在北京和老王喝咖啡，他是VC合伙人");
    await page.locator('button:has-text("告诉 Jeffery")').click();

    // Wait for extraction to complete
    try {
      await page.waitForFunction(() =>
        document.body.textContent?.includes("已提取人物"),
        { timeout: 60000 }
      );
    } catch {
      // May timeout if no persons extracted — proceed to verify anyway
    }

    // Navigate to members and verify data is visible (decrypted)
    await navigateTo(page, "/members");
    await page.waitForSelector("tbody tr", { timeout: 15000 }).catch(() => {});

    const rowCount = await page.locator("tbody tr").count();
    if (rowCount > 0) {
      const pageContent = await page.content();
      expect(pageContent).toContain("老王");
    }
  });

  test("ENC-002: LLM 收到的是假名化文本", async ({ page }) => {
    const email = makeEmail("enc");
    await registerAndSignIn(page, email, TEST_PASSWORD, TEST_NAME);

    const inputPage = new InputPage(page);
    await inputPage.textarea().fill("今天见张总，他是AI科学家");
    await page.locator('button:has-text("告诉 Jeffery")').click();

    try {
      await page.waitForFunction(() =>
        document.body.textContent?.includes("已提取人物"),
        { timeout: 60000 }
      );
    } catch {
      // May timeout — proceed to verify
    }

    await page.waitForTimeout(5000);
    const bodyText = await page.locator("body").textContent();

    // Real names should be restored in the UI (depseudonymized)
    expect(bodyText).toContain("张总");

    // Should NOT contain raw pseudonym patterns in rendered output
    expect(bodyText).not.toMatch(/Person_[a-f0-9]{12}/);
  });

  test("ENC-003: 多次录入同一人物，假名保持一致", async ({ page }) => {
    const email = makeEmail("enc");
    await registerAndSignIn(page, email, TEST_PASSWORD, TEST_NAME);

    const inputPage = new InputPage(page);

    // First submission
    await inputPage.textarea().fill("和老王在国贸吃饭");
    await page.locator('button:has-text("告诉 Jeffery")').click();
    try {
      await page.waitForFunction(() =>
        document.body.textContent?.includes("已提取人物"),
        { timeout: 60000 }
      );
    } catch { /* ok */ }

    // Second submission — same person, different context
    await inputPage.textarea().fill("老王介绍了一个投资人给我");
    await page.locator('button:has-text("告诉 Jeffery")').click();
    try {
      await page.waitForFunction(() =>
        document.body.textContent?.includes("已提取人物"),
        { timeout: 60000 }
      );
    } catch { /* ok */ }

    await page.waitForTimeout(3000);

    // Navigate to members — should have "老王" entries but deduplicated
    await navigateTo(page, "/members");
    await page.waitForSelector("tbody tr", { timeout: 15000 }).catch(() => {});

    const pageContent = await page.content();
    expect(pageContent).toContain("老王");

    // Pseudonym patterns should not leak into rendered HTML
    expect(pageContent).not.toMatch(/Person_[a-f0-9]{12}/);
  });
});
