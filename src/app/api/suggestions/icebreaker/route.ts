import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

// 简单内存缓存：5分钟内重复查询直接返回缓存
const cache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCached(key: string): unknown | null {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiry) {
    return entry.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown): void {
  // 清理过期条目
  for (const [k, v] of cache) {
    if (Date.now() >= v.expiry) cache.delete(k);
  }
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL_MS });
}

function getModel(): string {
  return process.env.MINIMAX_MODEL || "MiniMax-M2.7";
}

function getApiKey(): string {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error("Missing env var: MINIMAX_API_KEY");
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

const SYSTEM_PROMPT = `你是 Jeffrey.AI 破冰助手，风格是务实、有点黑色幽默但有帮助的人。帮用户准备发给联系人（称呼"你"）的微信开场白，要像朋友之间发消息那样自然。

## 输出格式（JSON）
{
  "openingLines": ["开场白1", "开场白2", "开场白3"],
  "suggestedTopics": ["话题1", "话题2", "话题3"],
  "recentContext": "记忆点",
  "jeffreyComment": "1句备注"
}

## 要求
- openingLines 要像真人在微信上发的消息，可以稍微长一点（1-2句话），带点语气和情绪
- 绝对不要像AI写的那样正式或书面
- 可以用"嗨"、"最近忙啥"、"好久不见"这种朋友聊天的开头
- suggestedTopics 是对方可能感兴趣的话题，供你自己选择用哪个开场后引入正题
- recentContext 来自上次互动的记忆点，用于自然提起往事
- jeffreyComment 是你给用户的建议，1句话就行
- lastContactDate 超过 60 天时提醒用户关系有点生疏了`;

export async function GET(request: NextRequest) {
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
    const cacheKey = `icebreaker:${personId}`;
    const memoryCached = getCached(cacheKey);
    if (memoryCached) {
      return Response.json(memoryCached);
    }

    // 检查数据库缓存
    const personWithCache = await prisma.person.findUnique({
      where: { id: personId },
      select: {
        name: true,
        icebreakerData: true,
        icebreakerGeneratedAt: true,
      },
    });

    if (personWithCache?.icebreakerData) {
      const cachedData = {
        personName: personWithCache.name,
        ...(personWithCache.icebreakerData as object),
      };
      setCache(cacheKey, cachedData);
      return Response.json(cachedData);
    }

    // 获取人物完整信息用于生成
    const person = await prisma.person.findUnique({
      where: { id: personId },
      include: {
        introducedBy: { select: { name: true } },
      },
    });

    if (!person) {
      return Response.json({ error: "Person not found" }, { status: 404 });
    }

    // 获取最近一次互动
    const lastInteraction = await prisma.interaction.findFirst({
      where: {
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

    // 调用 LLM (Anthropic API 格式)
    const apiResponse = await fetch("https://api.minimaxi.com/anthropic/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getApiKey()}`,
        "x-api-key": getApiKey(),
      },
      body: JSON.stringify({
        model: getModel(),
        messages: [
          { role: "user", content: SYSTEM_PROMPT + "\n\n---\n\n" + userContext },
        ],
        temperature: 0.6,
        max_tokens: 1500,
      }),
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      throw new Error(`MiniMax API error: ${apiResponse.status} - ${errorText}`);
    }

    const apiData = await apiResponse.json();
    // MiniMax 返回的 content 是数组，包含不同类型的块
    const textBlock = apiData.content?.find((c: { type: string }) => c.type === "text");
    const content = textBlock?.text;
    if (!content) {
      throw new Error("LLM returned empty response");
    }

    // 解析 JSON 响应
    let parsed;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ||
                        content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[jsonMatch.length - 1]);
      } else {
        parsed = JSON.parse(content);
      }
    } catch {
      parsed = {
        openingLines: [content],
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
    setCache(cacheKey, result);
    return Response.json(result);
  } catch (error) {
    console.error("Error in GET /api/suggestions/icebreaker:", error);
    const err = error as { message?: string; code?: string };
    return Response.json(
      { error: "Failed to generate icebreaker: " + (err.message || String(error)) },
      { status: 500 }
    );
  }
}
