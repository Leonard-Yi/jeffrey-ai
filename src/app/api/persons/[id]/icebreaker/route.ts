import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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

// POST /api/persons/[id]/icebreaker - Generate and store icebreaker for a person
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 获取风格参数
    let style = "日常";
    try {
      const body = await request.json();
      style = body.style || "日常";
    } catch {}
    const validStyles = ["日常", "正式", "务实", "问候", "老友"];
    const selectedStyle = validStyles.includes(style) ? style : "日常";
    const systemPrompt = SYSTEM_PROMPTS[selectedStyle as keyof typeof SYSTEM_PROMPTS];

    // 获取人物信息
    const person = await prisma.person.findUnique({
      where: { id },
      include: {
        introducedBy: { select: { name: true } },
      },
    });

    if (!person) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    // 获取最近一次互动
    const lastInteraction = await prisma.interaction.findFirst({
      where: {
        persons: { some: { personId: id } },
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

    // 构建用户上下文
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

    // 调用 LLM
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
          { role: "user", content: systemPrompt + "\n\n---\n\n" + userContext },
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

    // 存入数据库
    const result = {
      openingLines: parsed.openingLines || [],
      suggestedTopics: parsed.suggestedTopics || [],
      recentContext: parsed.recentContext || "无历史记忆",
      jeffreyComment: parsed.jeffreyComment || "",
    };

    await prisma.person.update({
      where: { id },
      data: {
        icebreakerData: result,
        icebreakerGeneratedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Error generating icebreaker:", error);
    const err = error as { message?: string };
    return NextResponse.json(
      { error: "Failed to generate icebreaker: " + (err.message || String(error)) },
      { status: 500 }
    );
  }
}

// GET /api/persons/[id]/icebreaker - Get cached icebreaker or generate if missing
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const person = await prisma.person.findUnique({
      where: { id },
      select: {
        name: true,
        icebreakerData: true,
        icebreakerGeneratedAt: true,
      },
    });

    if (!person) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    // 如果有缓存，直接返回
    if (person.icebreakerData) {
      return NextResponse.json({
        personName: person.name,
        ...(person.icebreakerData as object),
        cached: true,
        generatedAt: person.icebreakerGeneratedAt,
      });
    }

    // 无缓存，返回错误让前端知道需要生成
    return NextResponse.json(
      { error: "Icebreaker not yet generated", needsGeneration: true },
      { status: 404 }
    );
  } catch (error) {
    console.error("Error getting icebreaker:", error);
    return NextResponse.json(
      { error: "Failed to get icebreaker" },
      { status: 500 }
    );
  }
}