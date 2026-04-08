import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

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
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

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
      where: { id: personId, userId: session.user.id },
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
        userId: session.user.id,
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

    // 调用 MiniMax API，使用流式响应
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
        stream: true,
      }),
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      throw new Error(`MiniMax API error: ${apiResponse.status} - ${errorText}`);
    }

    // 创建流式响应，解析 MiniMax SSE 格式并重新格式化
    const stream = new ReadableStream({
      async start(controller) {
        const reader = apiResponse.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";

        // 发送初始连接消息
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected" })}\n\n`));

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const dataStr = line.slice(6).trim();
                if (!dataStr || dataStr === "[DONE]") continue;

                try {
                  const data = JSON.parse(dataStr);

                  // MiniMax 流式事件
                  if (data.type === "content_block_delta" && data.delta?.type === "text_delta") {
                    fullText += data.delta.text;

                    // 发送累积的文本（带完整 JSON 结构预览）
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                      type: "delta",
                      text: fullText
                    })}\n\n`));
                  } else if (data.type === "message_delta") {
                    // 消息完成，发送最终 JSON
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                      type: "done",
                      text: fullText
                    })}\n\n`));
                  }
                } catch {
                  // 忽略解析错误
                }
              }
            }
          }
        } catch (e) {
          console.error("Stream error:", e);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error in GET /api/suggestions/icebreaker-stream:", error);
    const err = error as { message?: string; code?: string };
    return Response.json(
      { error: "Failed to generate icebreaker: " + (err.message || String(error)) },
      { status: 500 }
    );
  } finally {
    await prisma?.$disconnect();
  }
}