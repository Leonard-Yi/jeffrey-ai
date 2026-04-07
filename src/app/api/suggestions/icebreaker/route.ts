import { NextRequest } from "next/server";
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

const SYSTEM_PROMPT = `你是 Jeffrey.AI 的破冰助手。你的任务是为一顿即将到来的社交准备个性化开场白。

## 输出要求

请生成以下内容，使用中文回复，保持 Jeffrey 黑色幽默但有建设性的风格：

1. **openingLines** (3条): 适合寒暄开场的句子，从中选择1-2个自然引入正题
   - 格式：自然对话风格，不要太正式
   - 例子："最近还在研究 LLM 微调吗？之前听你说挺感兴趣的。"

2. **suggestedTopics** (3条): 基于兴趣标签和核心记忆，建议的聊天话题
   - 格式：直接可用的对话切入角度
   - 例子："木工，最近有没有继续做？"

3. **recentContext** (1条): 上次见面的记忆点，用于自然提起
   - 格式：可以无缝衔接上次话题的句子
   - 例子："上次你说你爸是木匠，聊到挺有感触的。"

4. **jeffreyComment** (1条): 你（Jeffrey）对这次见面的备注
   - 风格：黑色幽默，有建设性
   - 格式：1-2句话，结尾带"先生"或不带均可
   - 例子："关系评分还不错，但他似乎对投行有点倦怠，可以聊聊别的方向。"

## 重要提示
- 如果 coreMemories 为空，不要虚构内容，openingLines 可以更通用
- 如果 lastContactDate 超过 60 天，jeffreyComment 可以提醒一下
- 保持真实感，不要过度热情

请以 JSON 格式返回，结构如下：
{
  "openingLines": ["...", "...", "..."],
  "suggestedTopics": ["...", "...", "..."],
  "recentContext": "...",
  "jeffreyComment": "..."
}`;

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

    // 获取人物信息
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

    // 构建用户上下文
    const careers = (person.careers as Array<{ name: string }>) || [];
    const interests = (person.interests as Array<{ name: string }>) || [];
    const daysAgo = getDaysSince(new Date(person.lastContactDate));
    // 核心记忆来自最近一次互动
    const recentCoreMemories = lastInteraction
      ? (lastInteraction.coreMemories || [])
      : [];

    let userContext = `姓名：${person.name}
职业标签：${careers.map((c) => c.name).join("、") || "未知"}
兴趣标签：${interests.map((i) => i.name).join("、") || "未知"}
性格标签：${(person.vibeTags || []).join("、") || "未知"}
关系评分：${person.relationshipScore}/100
上次联系：${formatDate(new Date(person.lastContactDate))} (${daysAgo}天前)
核心记忆：${recentCoreMemories.join("、") || "无"}
介绍人：${person.introducedBy?.name || "无"}`;

    if (lastInteraction) {
      const actionItems = (lastInteraction.actionItems as Array<{
        description: string;
        ownedBy: string;
        resolved: boolean;
      }>) || [];
      userContext += `

## 最近一次互动
时间：${formatDate(new Date(lastInteraction.date))}
地点：${lastInteraction.location || "未知"}
情绪：${lastInteraction.sentiment}
承诺：${actionItems.map((a) => a.description).join("、") || "无"}`;
    } else {
      userContext += `

## 最近一次互动
（无历史互动记录）`;
    }

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
        temperature: 0.7,
        max_tokens: 2000,
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

    return Response.json({
      personName: person.name,
      openingLines: parsed.openingLines || [],
      suggestedTopics: parsed.suggestedTopics || [],
      recentContext: parsed.recentContext || "无历史记忆",
      jeffreyComment: parsed.jeffreyComment || "",
    });
  } catch (error) {
    console.error("Error in GET /api/suggestions/icebreaker:", error);
    const err = error as { message?: string; code?: string };
    return Response.json(
      { error: "Failed to generate icebreaker: " + (err.message || String(error)) },
      { status: 500 }
    );
  }
}
