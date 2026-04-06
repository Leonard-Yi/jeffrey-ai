import OpenAI from "openai";
import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";
import { WeightedTagSchema, ActionItemSchema } from "../schemas/core";

// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────

const MODEL = "qwen3.5-plus" as const;

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) throw new Error("Missing env var: DASHSCOPE_API_KEY");
    _client = new OpenAI({
      baseURL: "https://coding.dashscope.aliyuncs.com/v1",
      apiKey,
    });
  }
  return _client;
}

// ─────────────────────────────────────────────
// LLM-facing extraction schema
// ─────────────────────────────────────────────

const ExtractedPersonSchema = z.object({
  name: z.string().min(1),
  careers: z.array(WeightedTagSchema),
  interests: z.array(WeightedTagSchema),
  vibeTags: z.array(z.string()),
});

/**
 * What "complete" means for a single extracted record:
 *   - At least one person with at least one career tag
 *   - A non-empty sentiment string
 *   - At least one actionItem
 *
 * If any of these are absent, the LLM marks status "pending" and provides
 * a followUpQuestion to prompt the user for the missing detail.
 */
const ExtractionPayloadSchema = z.object({
  persons: z.array(ExtractedPersonSchema).min(1),
  date: z.string().datetime({ offset: true }),
  location: z.string().optional(),
  contextType: z.string().min(1),
  sentiment: z.string(),
  actionItems: z.array(ActionItemSchema),
  coreMemories: z.array(z.string()),

  /**
   * "complete"  — all required fields are present; record is ready to save.
   * "pending"   — one or more key fields are missing; followUpQuestion is set.
   */
  status: z.enum(["complete", "pending"]),

  /**
   * Only present when status === "pending".
   * A natural, conversational question in Chinese that asks the user for the
   * specific missing information (career tag, sentiment, or action item).
   */
  followUpQuestion: z.string().optional(),
});

export type ExtractionPayload = z.infer<typeof ExtractionPayloadSchema>;
export type ExtractedPerson = z.infer<typeof ExtractedPersonSchema>;

// ─────────────────────────────────────────────
// Completeness check (pure function, no LLM)
// ─────────────────────────────────────────────

/**
 * Returns a human-readable description of what is missing,
 * or null if the record is complete.
 */
function describeCompleteness(payload: ExtractionPayload): string | null {
  const missing: string[] = [];

  const hasCareer = payload.persons.some((p) => p.careers.length > 0);
  if (!hasCareer) missing.push("至少一位人物的职业/专长标签（careers）");

  if (!payload.sentiment.trim()) missing.push("这次互动的情绪基调（sentiment）");

  if (payload.actionItems.length === 0)
    missing.push("待办事项或社交债务（actionItems）");

  if (!payload.date) missing.push("这次互动的时间（date）");

  return missing.length > 0 ? missing.join("；") : null;
}

// ─────────────────────────────────────────────
// Prompts
// ─────────────────────────────────────────────

const SYSTEM_PROMPT = `
你是 Jeffrey.Ai 的人脉与社交图谱数据提取专家。

你的唯一任务是：从用户提供的非结构化"社交流水账"文本中，精准提取出结构化的人物信息与互动记录。

## 提取规则

### 人物标签 (careers / interests)
- 采用 { name: string, weight: number } 格式，weight 范围 0.0 ~ 1.0。
- weight 反映**在文本中的侧重程度**：
  - 被重点介绍、反复提及 → weight 0.7 ~ 1.0
  - 顺带一提、补充信息 → weight 0.1 ~ 0.4
  - 示例："他最近在做投行，但也迷上了做木工" → careers: [{name:"投行", weight:0.9}, {name:"木工", weight:0.1}]
- careers：职业、专业技能、工作领域。
- interests：兴趣、爱好、生活方式。

### 性格/氛围标签 (vibeTags)
- 从描述和语气推断，使用简短中文词组，如 ["务实", "话不多但真诚"]。

### 社交债务 (actionItems)
- ownedBy: "me"（我需要做）| "them"（对方承诺）| "both"（双方）

### 核心记忆点 (coreMemories)
- 只捕捉只有亲历者才知道的具体细节，有温度、有细节的信息。

### 情绪基调 (sentiment)
- 一句话描述整体感受和能量。

### 日期与地点
- 具体时间转 ISO-8601（中国 +08:00）。"今天"等模糊表述用今天日期 + 12:00:00。
- 地点若未提及则省略。

## 完备性判断与追问规则

提取完成后，按以下规则设置 status 字段：

**status = "complete"（无需追问）**：同时满足以下三个条件：
1. 至少一位人物拥有 career 标签
2. sentiment 字段非空
3. actionItems 数组非空
4. **date 字段非空**（这次互动是什么时候？）

**status = "pending"（需要追问）**：以上任一条件不满足时：
- 将 status 设为 "pending"
- 在 followUpQuestion 字段填写一个自然、口语化的中文问题，询问用户缺失的那个信息
- followUpQuestion 要具体，提及当事人姓名，不要用模板化语言
- 示例（缺少 date）："这是什么时候的事？今天还是前几天？"
- 示例（缺少 career）："老王这次聊了很多，他现在主要的工作方向是什么？投行还是转型了？"
- 示例（缺少 actionItem）："这次聊完有没有什么约定或者你想跟进的事情？"

## 重要提示
- 如果文中涉及多个人，请为每个人分别生成一个 person 对象。
- 你必须调用 save_extraction 工具，将所有提取结果作为参数传入。不要输出任何纯文本。
`.trim();

// ─────────────────────────────────────────────
// Tool definition
// ─────────────────────────────────────────────

const extractionTool: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "save_extraction",
    description: "将从社交流水账中提取的结构化数据保存到图谱数据库",
    // @ts-ignore - Zod schema type recursion workaround
    parameters: zodToJsonSchema(ExtractionPayloadSchema) as Record<string, unknown>,
  },
};

// ─────────────────────────────────────────────
// Main extractor
// ─────────────────────────────────────────────

export async function extractInteractionData(
  userInput: string
): Promise<ExtractionPayload> {
  const response = await getClient().chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userInput },
    ],
    tools: [extractionTool],
    tool_choice: "auto",
    temperature: 0.2,
    // @ts-expect-error: Bailian/Qwen extension field
    extra_body: { enable_thinking: false },
  });

  const toolCall = response.choices[0]?.message?.tool_calls?.[0];

  if (!toolCall || toolCall.function.name !== "save_extraction") {
    throw new Error(
      `LLM did not invoke the expected tool. Raw response: ${JSON.stringify(response.choices[0]?.message)}`
    );
  }

  let rawJson: unknown;
  try {
    rawJson = JSON.parse(toolCall.function.arguments);
  } catch {
    throw new Error(
      `LLM returned malformed JSON in tool arguments: ${toolCall.function.arguments}`
    );
  }

  const result = ExtractionPayloadSchema.safeParse(rawJson);

  if (!result.success) {
    console.error(
      "[Jeffrey.Ai] Zod validation failed for LLM output:",
      JSON.stringify(result.error.flatten(), null, 2)
    );
    throw new Error(`LLM output failed schema validation: ${result.error.message}`);
  }

  // Secondary completeness check: if the LLM marked "complete" but our
  // deterministic rule disagrees, override to "pending" and generate a
  // follow-up question ourselves so the user always gets one.
  const missing = describeCompleteness(result.data);
  if (missing && result.data.status === "complete") {
    console.warn(
      "[Jeffrey.Ai] LLM marked complete but deterministic check found missing:",
      missing
    );
    return {
      ...result.data,
      status: "pending",
      followUpQuestion:
        result.data.followUpQuestion ??
        `这次记录还缺少一些信息（${missing}），能补充一下吗？`,
    };
  }

  return result.data;
}
