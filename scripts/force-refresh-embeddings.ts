/**
 * 检测并刷新"脏"embedding（内容变了但向量没更新）的脚本
 *
 * 判断标准：从当前数据库字段重新计算 searchText，与存储的 searchText 比对
 * - 若一致：embedding 有效，无需处理
 * - 若不一致：说明内容在 PATCH 端点之外被改了（如直接 DB 操作、历史脏数据），需重新生成 embedding
 *
 * 安全：只更新 jsonb_array_length("embedding") > 0 的记录（已有 embedding 才检测）
 * 空 embedding 由 backfill-embeddings.ts 处理，本脚本不碰
 *
 * 使用方法：
 *   npx tsx --env-file=.env scripts/force-refresh-embeddings.ts
 *
 * 可在部署后自动触发（如 npm postdeploy 脚本）：
 *   npm run postdeploy
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { buildPersonSearchText, generateEmbedding } from "../src/lib/embedding";

type WeightedTag = { name: string; weight: number };

async function hashString(s: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(s);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function detectAndRefresh() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  // 只查已有 embedding 的记录（避免与 backfill-embeddings.ts 重复劳动）
  const persons = await prisma.$queryRaw<
    Array<{
      id: string;
      name: string;
      careers: unknown;
      interests: unknown;
      vibeTags: string[];
      searchText: string;
    }>
  >`
    SELECT id, name, careers, interests, "vibeTags", "searchText"
    FROM "Person"
    WHERE "deletedAt" IS NULL
      AND jsonb_array_length("embedding") > 0
  `;

  console.log(`[Jeffrey.AI] 检测 ${persons.length} 条已有 embedding 的记录...`);

  const needsRefresh: Array<{ id: string; name: string; reason: string }> = [];

  for (const p of persons) {
    const currentSearchText = buildPersonSearchText({
      name: p.name,
      careers: (p.careers ?? []) as WeightedTag[],
      interests: (p.interests ?? []) as WeightedTag[],
      vibeTags: p.vibeTags ?? [],
    });
    if (currentSearchText !== p.searchText) {
      needsRefresh.push({
        id: p.id,
        name: p.name,
        reason: `searchText 不匹配\n  存储值: ${p.searchText}\n  应为:     ${currentSearchText}`,
      });
    }
  }

  if (needsRefresh.length === 0) {
    console.log(`[Jeffrey.AI] 所有 embedding 均为最新，无需刷新`);
    await prisma.$disconnect();
    return;
  }

  console.log(`\n[Jeffrey.AI] 发现 ${needsRefresh.length} 条脏记录：`);
  for (const r of needsRefresh) {
    console.log(`  - ${r.name}: searchText 不匹配`);
  }
  console.log("");

  let success = 0;
  let failed = 0;

  for (const { id, name } of needsRefresh) {
    try {
      const person = (await prisma.person.findUnique({
        where: { id },
        select: { name: true, careers: true, interests: true, vibeTags: true },
      }))!;

      const searchText = buildPersonSearchText({
        name: person.name,
        careers: (person.careers ?? []) as WeightedTag[],
        interests: (person.interests ?? []) as WeightedTag[],
        vibeTags: person.vibeTags ?? [],
      });

      const embedding = await generateEmbedding(searchText);
      await prisma.person.update({
        where: { id },
        data: { searchText, embedding },
      });
      console.log(`[OK] ${name} (${embedding.length}D)`);
      success++;
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err);
      failed++;
    }
  }

  console.log(`\n完成：成功刷新 ${success} 条，失败 ${failed} 条`);
  await prisma.$disconnect();
}

detectAndRefresh().catch(console.error);
