import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getEncryptionKeys } from "@/lib/getKeys";
import { createCryptoStore } from "@/lib/cryptoStore";
import { createPseudonymizer } from "@/lib/pseudonymizer";
import { encrypt, decrypt } from "@/lib/crypto";

// 简单内存缓存：1分钟内重复查询直接返回缓存
const cache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL_MS = 60 * 1000;
const CACHE_MAX_SIZE = 200;

function getCached(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() < entry.expiry) return entry.data;
  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown): void {
  // 清理过期条目
  const now = Date.now();
  for (const [k, v] of cache) {
    if (now >= v.expiry) cache.delete(k);
  }
  // 若仍超限，淘汰最旧的条目（按 expiry 排序）
  if (cache.size >= CACHE_MAX_SIZE) {
    let oldestKey = "";
    let oldestExpiry = Infinity;
    for (const [k, v] of cache) {
      if (v.expiry < oldestExpiry) {
        oldestExpiry = v.expiry;
        oldestKey = k;
      }
    }
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(key, { data, expiry: now + CACHE_TTL_MS });
}

function getModel(): string {
  return process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
}

function getApiKey(): string {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("Missing env var: DEEPSEEK_API_KEY");
  return apiKey;
}

function getDaysSince(date: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

const SYSTEM_PROMPTS = {
  日常: `你是 Jeffrey.AI 破冰助手，帮用户准备发给联系人的微信开场白。风格：日常亲切，像朋友聊天。

## 输出格式（JSON）
{
  "openingLines": ["开场白1", "开场白2", "开场白3"],
  "suggestedTopics": ["话题1", "话题2", "话题3"],
  "recentContext": "记忆点",
  "jeffreyComment": "1句备注"
}

## 要求
- openingLines 要像朋友微信聊天，稍微随意，带语气和情绪
- 例子："嗨，好久不见！最近咋样"、"最近忙啥呢，有空出来坐坐？"
- suggestedTopics 是对方可能感兴趣的话题
- recentContext 来自上次互动的记忆点
- jeffreyComment 是给用户的建议，1句话`,

  正式: `你是 Jeffrey.AI 破冰助手，帮用户准备发给联系人的开场白。风格：正式得体，适合商务或生疏关系。

## 输出格式（JSON）
{
  "openingLines": ["开场白1", "开场白2", "开场白3"],
  "suggestedTopics": ["话题1", "话题2", "话题3"],
  "recentContext": "记忆点",
  "jeffreyComment": "1句备注"
}

## 要求
- openingLines 要像正式场合的寒暄，礼貌但不生硬
- 例子："您好，最近工作顺利吗？有机会想请教一下"、"您好，上次聊到的项目现在进展如何了"
- suggestedTopics 是对方可能感兴趣的话题
- recentContext 来自上次互动的记忆点
- jeffreyComment 是给用户的建议，1句话`,

  务实: `你是 Jeffrey.AI 破冰助手，帮用户准备发给联系人的开场白。风格：务实直接，废话少，适合时间紧张时快速切入正题。

## 输出格式（JSON）
{
  "openingLines": ["开场白1", "开场白2", "开场白3"],
  "suggestedTopics": ["话题1", "话题2", "话题3"],
  "recentContext": "记忆点",
  "jeffreyComment": "1句备注"
}

## 要求
- openingLines 要简短直接，快速切入，不废话
- 例子："在吗？有个项目想请教你"、"方便聊两句吗，关于XX的"
- suggestedTopics 是对方可能感兴趣的话题
- recentContext 来自上次互动的记忆点
- jeffreyComment 是给用户的建议，1句话`,

  问候: `你是 Jeffrey.AI 破冰助手，帮用户准备发给联系人的问候。风格：轻松问候，关心对方近况，适合关系维护。

## 输出格式（JSON）
{
  "openingLines": ["开场白1", "开场白2", "开场白3"],
  "suggestedTopics": ["话题1", "话题2", "话题3"],
  "recentContext": "记忆点",
  "jeffreyComment": "1句备注"
}

## 要求
- openingLines 要像温暖的问候，关心对方但不打探隐私
- 例子："最近怎么样？希望一切顺利"、"好久没联系了，最近还好吗？"
- suggestedTopics 是对方可能感兴趣的话题
- recentContext 来自上次互动的记忆点
- jeffreyComment 是给用户的建议，1句话`,

  老友: `你是 Jeffrey.AI 破冰助手，帮用户准备发给老朋友的开场白。风格：熟络亲切，像老朋友聊天，有点回忆和共同话题。

## 输出格式（JSON）
{
  "openingLines": ["开场白1", "开场白2", "开场白3"],
  "suggestedTopics": ["话题1", "话题2", "话题3"],
  "recentContext": "记忆点",
  "jeffreyComment": "1句备注"
}

## 要求
- openingLines 要像老朋友聊天，有回忆有温度
- 例子："嘿，还记得上次咱们聊的那个XX吗"、"好久不见老朋友，最近咋样，想起你了"
- suggestedTopics 是对方可能感兴趣的话题
- recentContext 来自上次互动的记忆点
- jeffreyComment 是给用户的建议，1句话`
};

export async function GET(request: NextRequest) {
  const keys = await getEncryptionKeys();
  if (!keys) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { encKey, pseudoKey, userId } = keys;
  const store = createCryptoStore(prisma, encKey);
  const pseudo = await createPseudonymizer(userId, encKey, pseudoKey, store);

  try {
    const { searchParams } = new URL(request.url);
    const personId = searchParams.get("personId");

    if (!personId) {
      return Response.json(
        { error: "personId is required" },
        { status: 400 }
      );
    }

    // 检查内存缓存
    const style = searchParams.get("style") || "日常";
    const validStyles = ["日常", "正式", "务实", "问候", "老友"];
    const selectedStyle = validStyles.includes(style) ? style : "日常";
    const cacheKey = `icebreaker:${personId}:${selectedStyle}`;
    const memoryCached = getCached(cacheKey);
    if (memoryCached) {
      const decrypted = decrypt(memoryCached as string, encKey);
      return Response.json(JSON.parse(decrypted));
    }

    // 获取人物完整信息（store auto-decrypts）
    const person = await store.person.findUnique({
      where: { id: personId, userId },
      include: {
        introducedBy: { select: { name: true } },
      },
    });

    if (!person) {
      return Response.json({ error: "Person not found" }, { status: 404 });
    }

    // 如果 DB 中有缓存，直接返回
    if (person.icebreakerData) {
      const cachedData = {
        personName: person.name,
        ...(person.icebreakerData as object),
      };
      const encryptedResult = encrypt(JSON.stringify(cachedData), encKey);
      setCache(cacheKey, encryptedResult);
      return Response.json(cachedData);
    }

    // 获取最近一次互动
    const lastInteraction = await store.interaction.findFirst({
      where: {
        userId,
        persons: { some: { personId } },
      },
      orderBy: { date: "desc" },
      select: {
        date: true,
        location: true,
        sentiment: true,
        coreMemories: true,
        actionItems: true,
        persons: {
          include: {
            person: { select: { name: true } },
          },
        },
      },
    });

    // 构建用户上下文（精简）
    const careers = (person.careers as Array<{ name: string }>) || [];
    const interests = (person.interests as Array<{ name: string }>) || [];
    const daysAgo = getDaysSince(new Date(person.lastContactDate));
    const recentCoreMemories = lastInteraction
      ? (lastInteraction.coreMemories || [])
      : [];

    const userContext = `【人物】${person.name}
【职业】${careers.map((c) => c.name).join("、") || "未知"}
【兴趣】${interests.map((i) => i.name).join("、") || "无"}
【性格】${(person.vibeTags || []).join("、") || "未知"}
【关系】${person.relationshipScore}/100 | 上次联系：${daysAgo}天前
【记忆】${recentCoreMemories.join("、") || "无"}
【上次互动】${lastInteraction ? `${formatDate(new Date(lastInteraction.date))} | ${lastInteraction.sentiment || "无情绪记录"} | 承诺：${((lastInteraction.actionItems as Array<{description:string}>) || []).map((a) => a.description).join("、") || "无"}` : "无历史记录"}`;

    const systemPrompt = SYSTEM_PROMPTS[selectedStyle as keyof typeof SYSTEM_PROMPTS];

    // 伪名化 combined prompt 后发送给 DeepSeek
    const combinedPrompt = systemPrompt + "\n\n---\n\n" + userContext;
    const { sanitizedText } = await pseudo.pseudonymize(combinedPrompt);

    // 调用 DeepSeek API (Anthropic 兼容格式)
    const apiResponse = await fetch("https://api.deepseek.com/anthropic/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getApiKey()}`,
      },
      body: JSON.stringify({
        model: getModel(),
        messages: [
          { role: "user", content: sanitizedText },
        ],
        temperature: 0.6,
        max_tokens: 1500,
      }),
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      throw new Error(`DeepSeek API error: ${apiResponse.status} - ${errorText}`);
    }

    const apiData = await apiResponse.json();
    // 返回的 content 是数组，包含不同类型的块 (Anthropic 格式)
    const textBlock = apiData.content?.find((c: { type: string }) => c.type === "text");
    const content = textBlock?.text;
    if (!content) {
      throw new Error("LLM returned empty response");
    }

    // 去伪名化 LLM 响应
    const depseudonymized = await pseudo.depseudonymize(content);

    // 检查实体泄漏
    const leaks = pseudo.checkLeaks(depseudonymized);
    if (leaks.length > 0) console.warn("[Jeffrey.AI] ENTITY LEAK in icebreaker:", leaks.join(", "));

    // 解析 JSON 响应
    let parsed;
    try {
      const jsonMatch = depseudonymized.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ||
                        depseudonymized.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[jsonMatch.length - 1]);
      } else {
        parsed = JSON.parse(depseudonymized);
      }
    } catch {
      parsed = {
        openingLines: [depseudonymized],
        suggestedTopics: ["询问近况"],
        recentContext: "无历史记忆可参考",
        jeffreyComment: "先生，建议直接联系对方。",
      };
    }

    const result = {
      personName: person.name,
      openingLines: parsed.openingLines || [],
      suggestedTopics: parsed.suggestedTopics || [],
      recentContext: parsed.recentContext || "无历史记忆",
      jeffreyComment: parsed.jeffreyComment || "",
    };
    const encryptedResult = encrypt(JSON.stringify(result), encKey);
    setCache(cacheKey, encryptedResult);
    return Response.json(result);
  } catch (error) {
    console.error("Error in GET /api/suggestions/icebreaker:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
