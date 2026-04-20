import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";

const apiKey = process.env.MINIMAX_API_KEY;
const model = process.env.MINIMAX_MODEL || "MiniMax-M2.7";

const WeightedTagSchema = z.object({
  name: z.string(),
  weight: z.number(),
});

const ActionItemSchema = z.object({
  description: z.string(),
  ownedBy: z.enum(["me", "them", "both"]),
  resolved: z.boolean(),
});

const ExtractedPersonSchema = z.object({
  name: z.string().min(1),
  careers: z.array(WeightedTagSchema).optional().default([]),
  interests: z.array(WeightedTagSchema).optional().default([]),
  vibeTags: z.array(z.string()).optional().default([]),
  ambiguous: z.boolean().optional().default(false),
  ambiguousWith: z.array(z.string()).optional().default([]),
});

const ExtractionPayloadSchema = z.object({
  persons: z.array(ExtractedPersonSchema).default([]),
  date: z.string().datetime({ offset: true }).optional(),
  location: z.string().optional(),
  contextType: z.string().min(1).optional(),
  sentiment: z.string().optional(),
  actionItems: z.array(ActionItemSchema).default([]),
  coreMemories: z.array(z.string()).default([]),
  status: z.enum(["complete", "pending", "ambiguous"]),
  followUpQuestion: z.string().optional(),
});

const extractionInputSchema = zodToJsonSchema(ExtractionPayloadSchema);

const extractionTool = {
  name: "save_extraction",
  description: "将从社交流水账中提取的结构化数据保存到图谱数据库",
  input_schema: extractionInputSchema,
};

const SYSTEM_PROMPT = `你是 Jeffrey.AI 的人脉与社交图谱数据提取专家。

你的唯一任务是：从用户提供的非结构化"社交流水账"文本中，精准提取出结构化的人物信息与互动记录。

## 提取规则

### 人物姓名 (name)
- 必须提取真实姓名或具体称呼（如"老王"、"张总"、"李老师"、"小王"等）

### 人物标签 (careers / interests)
- 采用 { name: string, weight: number } 格式，weight 范围 0.0 ~ 1.0。

### 社交债务 (actionItems)
- ownedBy: "me"（我需要做）| "them"（对方承诺）| "both"（双方）

### 情绪基调 (sentiment)
- 一句话描述整体感受和能量。

### 日期与地点
- 日期格式：YYYY-MM-DDTHH:mm:ss+08:00

## 完备性判断
**status = "complete"**：至少一位人物拥有 career 标签、actionItems 非空、date 非空。

## 重要提示
- 你必须调用 save_extraction 工具。`.trim();

const testText = "今天和老王喝咖啡，他让我帮忙看看BP，下周给他反馈";

const data = JSON.stringify({
  model,
  system: SYSTEM_PROMPT,
  messages: [{ role: "user", content: testText }],
  tools: [extractionTool],
  temperature: 0.3,
  max_tokens: 4000,
});

console.log("Testing with tools and full system prompt...");
console.log("Payload size:", data.length, "bytes");
console.log("Model:", model);

fetch("https://api.minimaxi.com/anthropic/v1/messages", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`,
    "x-api-key": apiKey,
  },
  body: data,
})
  .then((resp) => {
    console.log("HTTP Status:", resp.status);
    return resp.json();
  })
  .then((result) => {
    console.log("Response content count:", result.content?.length);
    const toolUse = result.content?.find((c: any) => c.type === "tool_use");
    const textBlock = result.content?.find((c: any) => c.type === "text");
    console.log("Has tool_use block:", !!toolUse);
    console.log("Has text block:", !!textBlock);
    if (toolUse) {
      console.log("Tool input:", JSON.stringify(toolUse.input).slice(0, 500));
    }
    if (textBlock) {
      console.log("Text content:", textBlock.text?.slice(0, 300));
    }
    console.log("Full response:", JSON.stringify(result).slice(0, 2000));
  })
  .catch((err) => {
    console.error("Fetch error:", err.message);
  });