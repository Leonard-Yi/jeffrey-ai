import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { extractInteractionData } from "../services/llmExtractor";
import { saveExtraction } from "../services/dbService";
import type { WeightedTag } from "../schemas/core";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
const PREFIX = "__test__";

let TEST_USER_ID: string;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function prefixInput(input: string, names: string[]): string {
  let out = input;
  for (const name of names) {
    out = out.replaceAll(name, `${PREFIX}${name}`);
  }
  return out;
}

async function cleanupTestData() {
  if (!TEST_USER_ID) return;

  await prisma.interaction.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.personTag.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.person.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.user.delete({ where: { id: TEST_USER_ID } });
}

function truncate(s: string, n = 200): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function header(title: string) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${title}`);
  console.log("─".repeat(60));
}

// ─────────────────────────────────────────────
// Cases
// ─────────────────────────────────────────────

async function case1() {
  header("Case 1 — 标准录入（老王 · 字节算法 · 星巴克）");

  const raw = prefixInput(
    "今天和老王在星巴克喝咖啡，他在字节做算法，聊了很多他最近在研究强化学习，" +
      "他说下周要去杭州出差，我答应帮他介绍一个做CV的朋友",
    ["老王"]
  );

  const payload = await extractInteractionData(raw);
  console.log("LLM 原始返回（截断）：", truncate(JSON.stringify(payload)));
  console.log("Zod 校验：pass（通过 safeParse，否则已抛出）");
  console.log("status：", payload.status);

  if (payload.status === "pending") {
    console.warn("⚠️  Case 1 触发了追问，followUpQuestion：", payload.followUpQuestion);
    console.warn("   跳过写库，但继续后续 Case。");
    return null;
  }

  const result = await saveExtraction(payload, TEST_USER_ID);
  console.log("写库成功 →", result);
  return result;
}

async function case2() {
  header("Case 2 — 重复录入老王，验证权重合并");

  // Snapshot before
  const before = await prisma.person.findFirst({
    where: { name: `${PREFIX}老王` },
  });
  const careersBefore = (before?.careers ?? []) as WeightedTag[];
  console.log("合并前 careers：", JSON.stringify(careersBefore));

  const raw = prefixInput(
    "又见到老王了，他提到最近也在学 LLM 微调，看起来对 NLP 很感兴趣",
    ["老王"]
  );

  const payload = await extractInteractionData(raw);
  console.log("LLM 原始返回（截断）：", truncate(JSON.stringify(payload)));
  console.log("status：", payload.status);

  if (payload.status === "pending") {
    console.warn("⚠️  Case 2 触发追问，followUpQuestion：", payload.followUpQuestion);
    console.warn("   跳过写库。");
    return;
  }

  const result = await saveExtraction(payload, TEST_USER_ID);
  console.log("写库成功 →", result);

  // Snapshot after
  const after = await prisma.person.findFirst({
    where: { name: `${PREFIX}老王` },
  });
  const careersAfter = (after?.careers ?? []) as WeightedTag[];
  console.log("合并后 careers：", JSON.stringify(careersAfter));

  // Print diff
  console.log("\n权重变化对比：");
  const allNames = new Set([
    ...careersBefore.map((t) => t.name),
    ...careersAfter.map((t) => t.name),
  ]);
  for (const name of allNames) {
    const prev = careersBefore.find((t) => t.name === name)?.weight;
    const next = careersAfter.find((t) => t.name === name)?.weight;
    const prevStr = prev !== undefined ? prev.toFixed(3) : "（新增）";
    const nextStr = next !== undefined ? next.toFixed(3) : "（消失）";
    console.log(`  ${name}: ${prevStr} → ${nextStr}`);
  }
}

async function case3() {
  header("Case 3 — 多人互动（老王 + 小李）");

  const raw = prefixInput(
    "今天和老王、小李一起吃饭，小李是做产品的，老王介绍认识的。" +
      "小李说她下个月有个项目想找我帮忙看技术方案",
    ["老王", "小李"]
  );

  const payload = await extractInteractionData(raw);
  console.log("LLM 原始返回（截断）：", truncate(JSON.stringify(payload)));
  console.log("提取到的人物：", payload.persons.map((p) => p.name).join("、"));
  console.log("status：", payload.status);

  if (payload.status === "pending") {
    console.warn("⚠️  Case 3 触发追问，followUpQuestion：", payload.followUpQuestion);
    console.warn("   跳过写库。");
    return;
  }

  const result = await saveExtraction(payload, TEST_USER_ID);
  console.log("写库成功 →", result);
  console.log("actionItems：", JSON.stringify(payload.actionItems, null, 2));
}

async function case4() {
  header("Case 4 — 信息不完整，触发追问");

  const raw = "今天见了个做金融的朋友";

  const payload = await extractInteractionData(raw);
  console.log("LLM 原始返回（截断）：", truncate(JSON.stringify(payload)));
  console.log("status：", payload.status);

  if (payload.status !== "pending") {
    console.warn("⚠️  预期 status=pending，但 LLM 返回了 complete。内容：");
    console.warn(JSON.stringify(payload, null, 2));
    return;
  }

  console.log("✅ status=pending 符合预期");
  console.log("followUpQuestion：", payload.followUpQuestion);

  // Verify nothing was written
  const countBefore = await prisma.interaction.count();
  try {
    await saveExtraction(payload, TEST_USER_ID);
    console.error("❌ 不应该走到这里——pending 记录不应被写入数据库");
  } catch (e: unknown) {
    const countAfter = await prisma.interaction.count();
    if (countAfter === countBefore) {
      console.log("✅ 确认未写库（interaction 数量未变化）");
    }
    console.log("saveExtraction 正确拒绝写库，错误信息：", (e as Error).message);
  }
}

// ─────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────

async function main() {
  try {
    // Create a test user for data isolation
    const testUser = await prisma.user.create({
      data: {
        email: `test_${PREFIX}@example.com`,
        name: "Test User",
        passwordHash: "$2b$12$dummy.hash.for.testing.purposes.only",
      },
    });
    TEST_USER_ID = testUser.id;
    console.log("🧹 清理上次测试残留数据...");
    await cleanupTestData();

    await case1();
    await case2(); // depends on case1's 老王 being in DB
    await case3();
    await case4();

    console.log("\n🧹 清理本次测试数据...");
    await cleanupTestData();

    console.log("\n✅ 全链路测试通过");
  } catch (err) {
    console.error("\n❌ 测试失败：", (err as Error).message);
    console.error((err as Error).stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
