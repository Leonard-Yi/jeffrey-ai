import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";
import { saveExtractionToDb } from "./db";
import { WeightedTagSchema, ActionItemSchema } from "@/schemas/core";

// 复用 schemas/core 的基础类型
const ExtractedPersonSchema = z.object({
  name: z.string().min(1),
  careers: z.array(WeightedTagSchema).optional().default([]),
  interests: z.array(WeightedTagSchema).optional().default([]),
  vibeTags: z.array(z.string()).optional().default([]),
  /// 标记此人物可能与已有记录重复
  ambiguous: z.boolean().optional().default(false),
  /// 若 ambiguous=true，列出疑似重复的已有姓名
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

// 完备性检查函数
function describeCompleteness(data: z.infer<typeof ExtractionPayloadSchema>): string | null {
  const missing: string[] = [];

  const hasCareer = data.persons.some((p) => (p.careers || []).length > 0);
  if (!hasCareer) missing.push("至少一位人物的职业/专长标签（careers）");

  if (!(data.sentiment || "").trim()) missing.push("这次互动的情绪基调（sentiment）");

  if ((data.actionItems || []).length === 0)
    missing.push("待办事项或社交债务（actionItems）");

  if (!data.date) missing.push("这次互动的时间（date）");

  return missing.length > 0 ? missing.join("；") : null;
}

const SYSTEM_PROMPT = `
你是 Jeffrey.AI 的人脉与社交图谱数据提取专家。

你的唯一任务是：从用户提供的非结构化"社交流水账"文本中，精准提取出结构化的人物信息与互动记录。

## 提取规则

### 人物姓名 (name)
- 必须提取真实姓名或具体称呼（如"老王"、"张总"、"李老师"、"小王"等）
- 不要使用职业或描述性词汇作为姓名（不能用"算法专家"、"投资人"等）
- 如果文中没有明确姓名，使用文中提到的称呼（如"老王"）或"某人"

### 人物标签 (careers / interests)
- 采用 { name: string, weight: number } 格式，weight 范围 0.0 ~ 1.0。
- weight 反映在文本中的侧重程度：
  - 被重点介绍、反复提及 → weight 0.7 ~ 1.0
  - 顺带一提、补充信息 → weight 0.1 ~ 0.4
- careers：职业、专业技能、工作领域。
- interests：兴趣、爱好、生活方式。

### 性格/氛围标签 (vibeTags)
- 从描述和语气推断，使用简短中文词组，如 ["务实", "话不多但真诚"]。

### 社交债务 (actionItems)
- ownedBy: "me"（我需要做）| "them"（对方承诺）| "both"（双方）

### 核心记忆点 (coreMemories)
- 只捕捉只有亲历者才知道的具体细节。

### 情绪基调 (sentiment)
- 一句话描述整体感受和能量。

### 日期与地点
- **直接提取用户输入中的日期**，不要自行解释或转换。
- 日期格式：YYYY-MM-DDTHH:mm:ss+08:00（如2026-04-05T12:00:00+08:00）
- 如果用户说"今天"，实际上文已经被替换为具体日期，直接提取即可。
- **日期是必须提取的字段**，如果用户没有提及具体时间，请明确在 followUpQuestion 中询问。

## 完备性判断

**status = "complete"**：同时满足：
1. 至少一位人物拥有 career 标签
2. sentiment 字段非空
3. actionItems 数组非空
4. **date 字段非空**（这次互动是什么时候？）

**status = "pending"**：任一条件不满足时，在 followUpQuestion 填写追问。
- 如果缺少日期，追问示例："这是什么时候的事？今天还是前几天？"
- 如果缺少 career，追问示例："老王这次聊了很多，他现在主要的工作方向是什么？"
- 如果缺少 actionItem，追问示例："这次聊完有没有什么约定或者你想跟进的事情？"

## 同名检测（自动识别）

若在同一次输入中发现多个姓名可能指向同一人（如"老王"和"王总"），必须：

1. 在该人物对象中设置 ambiguous: true
2. 在 ambiguousWith 数组中填入疑似重复的已有姓名（如 ["老王"]）
3. 在 followUpQuestion 中询问："你指的是之前录入的老王吗？"
4. 将 status 设为 "ambiguous"

**判断标准**：姓氏相同 + 昵称/敬称模式（如"老X"="X总"），且文中语境暗示是同一人。

**示例场景**：
输入："今天和王总（老王的大学同学）一起见了小李"
输出：
// 例
{
  "persons": [
    { "name": "王总", "ambiguous": true, "ambiguousWith": ["老王"], "careers": [...] },
    { "name": "小李", "careers": [...] }
  ],
  "status": "ambiguous",
  "followUpQuestion": "你指的是之前录入的老王吗？"
}
// 例 结束

注意：
- ambiguous 只在提取到"可能是同一人"时触发，不要过度猜测
- 如果用户明确说明是不同人（如"老王是父亲，王总是儿子"），不要标记 ambiguous
- ambiguous 和 pending 可以共存（信息不完整时也设为 pending）

## 重要提示
- 你必须调用 save_extraction 工具，将所有提取结果作为参数传入。不要输出任何纯文本。
- 用户输入的是中文，请确保正确解析 UTF-8 编码的文本。
- 如果信息不完整，请先返回 JSON（即使 status 为 "pending"），让用户补充信息。
`.trim();

function getApiKey(): string {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error("Missing env var: MINIMAX_API_KEY");
  return apiKey;
}

function getModel(): string {
  return process.env.MINIMAX_MODEL || "MiniMax-M2.7";
}

// 预先计算 schema JSON，避免类型递归问题
// @ts-ignore - Zod schema type recursion workaround
const extractionInputSchema = zodToJsonSchema(ExtractionPayloadSchema);

const extractionTool: { name: string; description: string; input_schema: object } = {
  name: "save_extraction",
  description: "将从社交流水账中提取的结构化数据保存到图谱数据库",
  input_schema: extractionInputSchema as object,
};

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    console.log("[Jeffrey.AI] Raw body:", rawBody);

    const { text } = JSON.parse(rawBody);

    console.log("[Jeffrey.AI] Received text:", text);
    console.log("[Jeffrey.AI] Text type:", typeof text);
    console.log("[Jeffrey.AI] Text length:", text?.length);

    if (!text) {
      return Response.json(
        { error: "Missing text in request body" },
        { status: 400 }
      );
    }

    if (typeof text !== 'string') {
      return Response.json(
        { error: "Text must be a string, received: " + typeof text },
        { status: 400 }
      );
    }

    // 将相对日期（今天、昨天、前天、大前天、周一、下周一等）替换为 ISO-8601 格式（带北京时间偏移）
    function normalizeRelativeDates(input: string): string {
      const ref = new Date();
      const iso = (d: Date) => `${d.toISOString().split('T')[0]}T12:00:00+08:00`;

      // 汉字星期映射：0=周日，1=周一，...，6=周六
      const weekDayMap: Record<string, number> = {
        "周日": 0, "周一": 1, "周二": 2, "周三": 3, "周四": 4, "周五": 5, "周六": 6,
        "星期日": 0, "星期一": 1, "星期二": 2, "星期三": 3, "星期四": 4, "星期五": 5, "星期六": 6,
      };

      // 单字修饰前缀
      const prefixMap: Record<string, number> = {
        "上上": -14, "上": -7, "下下": 14, "下": 7,
        "大前": -3, "大后": 3,
      };

      // 直接修饰词
      const directMap: Record<string, number> = {
        "今天": 0, "明天": 1, "后天": 2,
        "昨天": -1, "前天": -2,
      };

      let result = input;

      // 1. 处理前缀+天（如 "大前天"、"大后天"、"上昨天"这种不存在的跳过）
      for (const [word, offset] of Object.entries(directMap)) {
        result = result.replace(new RegExp(word, 'g'), () => {
          const d = new Date(ref);
          d.setDate(d.getDate() + offset);
          return iso(d);
        });
      }

      // 2. 处理前缀+周几（如 "上周一"、"下周三"）
      for (const [prefix, prefixOffset] of Object.entries(prefixMap)) {
        for (const [weekday, targetDay] of Object.entries(weekDayMap)) {
          const pattern = new RegExp(`${prefix}${weekday}`, 'g');
          result = result.replace(pattern, () => {
            const d = new Date(ref);
            const current = d.getDay();
            let diff = (targetDay - current) + prefixOffset;
            // 避免原地打转：如果 diff=0（罕见，如"上周一"正好是周一），再减7天
            if (diff === 0 && prefixOffset !== 0) diff = prefixOffset > 0 ? -7 : 7;
            d.setDate(d.getDate() + diff);
            return iso(d);
          });
        }
      }

      // 3. 处理纯周几（如 "周一"，表示本周）
      for (const [weekday, targetDay] of Object.entries(weekDayMap)) {
        const pattern = new RegExp(`(?<!上|下|大)(${weekday})(?!天)`, 'g');
        result = result.replace(pattern, () => {
          const d = new Date(ref);
          const current = d.getDay();
          const diff = targetDay - current;
          d.setDate(d.getDate() + diff);
          return iso(d);
        });
      }

      return result;
    }

    const normalizedText = normalizeRelativeDates(text);
    console.log("[Jeffrey.AI] Normalized text:", normalizedText);

    // 调用 MiniMax LLM (Anthropic API 格式)
    const apiResponse = await fetch("https://api.minimaxi.com/anthropic/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getApiKey()}`,
        "x-api-key": getApiKey(),
      },
      body: JSON.stringify({
        model: getModel(),
        system: SYSTEM_PROMPT,
        messages: [
          { role: "user", content: normalizedText },
        ],
        tools: [extractionTool],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      throw new Error(`MiniMax API error: ${apiResponse.status} - ${errorText}`);
    }

    const apiData = await apiResponse.json();

    // 从 content 数组中找到 tool_use 块
    const toolUseBlock = apiData.content?.find((c: { type: string }) => c.type === "tool_use");
    const textBlock = apiData.content?.find((c: { type: string }) => c.type === "text");

    let rawJson: unknown;

    if (toolUseBlock) {
      // 工具调用结果 - input 已经是对象
      rawJson = toolUseBlock.input || {};
    } else if (textBlock?.text) {
      // 如果没有调用工具，尝试从文本中解析 JSON
      const textContent = textBlock.text;
      const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ||
                        textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        rawJson = JSON.parse(jsonMatch[jsonMatch.length - 1]);
      } else {
        throw new Error(`LLM did not call tool and no JSON found. Response: ${textContent.slice(0, 200)}`);
      }
    } else {
      throw new Error("LLM returned empty response: " + JSON.stringify(apiData));
    }

    // MiniMax may return null instead of undefined — normalize before Zod validation
    function nullToUndefined(obj: unknown): unknown {
      if (obj === null) return undefined;
      if (Array.isArray(obj)) return obj.map(nullToUndefined);
      if (obj && typeof obj === "object") {
        return Object.fromEntries(
          Object.entries(obj as Record<string, unknown>).map(
            ([k, v]) => [k, nullToUndefined(v)]
          )
        );
      }
      return obj;
    }

    const result = ExtractionPayloadSchema.safeParse(nullToUndefined(rawJson));

    if (!result.success) {
      console.error(
        "[Jeffrey.AI] Zod validation failed for LLM output:",
        JSON.stringify(result.error.flatten(), null, 2)
      );
      throw new Error(`LLM output failed schema validation: ${result.error.message}`);
    }

    const data = result.data;

    // 服务器端完备性检查：如果缺少日期，强制设为 pending
    const missing = describeCompleteness(data);
    if (missing && data.status === "complete") {
      console.warn("[Jeffrey.AI] LLM marked complete but missing fields:", missing);
      // date 缺失时不设为 pending，因为可能通过追问补全
      // 但如果确实无法获取，才在追问回复时用当前日期兜底
    }

    // 当状态为 complete 时写入完整数据（包括互动记录）
    if (data.status === "complete") {
      try {
        // @ts-ignore - Zod output type mismatch with manual interface
        await saveExtractionToDb(data, true); // createInteraction=true，确保追问回复后能创建互动
        console.log("[Jeffrey.AI] Successfully saved complete data to database");
      } catch (dbError) {
        console.error("[Jeffrey.AI] Database save failed:", dbError);
        // 不抛出错误，继续返回数据给前端
      }
    } else if (data.status === "pending" && data.persons && data.persons.length > 0) {
      // pending 状态时，只要有日期和人物，也创建互动记录（只是数据可能不完整）
      // 这样用户的每次输入都能留下互动历史
      try {
        await saveExtractionToDb({
          persons: data.persons,
          date: data.date,
          location: undefined,
          contextType: undefined,
          sentiment: undefined,
          actionItems: [],
          coreMemories: [],
        } as any, true); // createInteraction=true，确保pending时也创建互动
        console.log("[Jeffrey.AI] Saved pending person data with interaction");
      } catch (dbError) {
        console.error("[Jeffrey.AI] Database save (pending) failed:", dbError);
      }
    } else if (data.status === "ambiguous") {
      // ambiguous 状态：不创建真正的 Interaction 记录
      // 仅返回 ambiguousPersons 列表供前端展示确认选项
      console.log("[Jeffrey.AI] Ambiguous status detected, returning ambiguous persons for user confirmation");
    }

    // 生成 Jeffrey 风格的评论
    const personNames = data.persons.map(p => p.name).join(',');
    const hasAnxiety = data.persons.some(p =>
      p.vibeTags.some(v => v.includes('焦虑') || v.includes('压力'))
    );
    const meOwedCount = data.actionItems.filter(a => a.ownedBy === 'me').length;
    const themOwedCount = data.actionItems.filter(a => a.ownedBy === 'them').length;

    // 分析人物价值
    const allCareers = data.persons.flatMap(p => p.careers.map(c => c.name));
    const allInterests = data.persons.flatMap(p => p.interests.map(i => i.name));
    const hasHighValueCareer = allCareers.some(c =>
      ['投资', '金融', '科技', '创始人', 'CEO', '合伙人', '律师', '医生', '教授'].some(keyword => c.includes(keyword))
    );
    const hasUniqueInterest = allInterests.length > 0;

    let jeffreyComment = "";

    // Jeffrey 的毒舌点评
    if (data.persons.length === 0) {
      jeffreyComment = "先生，您告诉我这么多，却没提到任何人的名字。是在考验我的记忆力吗？";
    } else {
      // 开场白
      if (hasAnxiety) {
        jeffreyComment += `${personNames}目前似乎有些焦虑。这种时候建立的交情，往往最记得住。`;
      } else if (hasHighValueCareer) {
        jeffreyComment += `${personNames}在这个圈子里应该有些分量。建议您主动保持联系，别等对方先找你。`;
      } else {
        jeffreyComment += `${personNames}，已经记录在案。人脉这东西，平时不烧香，急时抱佛脚是没用的。`;
      }

      // 社交债务点评
      if (meOwedCount > 0 && themOwedCount > 0) {
        jeffreyComment += ` 这次互动双方都有承诺要履行——这种"互相亏欠"的状态，其实是最稳固的关系。`;
      } else if (meOwedCount > 0) {
        jeffreyComment += ` 您有${meOwedCount}件事要做。先生，欠人情是要还的，建议您尽快处理。`;
      } else if (themOwedCount > 0) {
        jeffreyComment += ` 对方欠您${themOwedCount}件事。这种人情的债，往往比金钱更值得记住。`;
      }

      // 兴趣点评
      if (hasUniqueInterest) {
        const topInterest = allInterests[0];
        jeffreyComment += ` 对了，${personNames}对${topInterest}感兴趣——这是个不错的切入点，比聊工作容易拉近距离。`;
      }
    }

    return Response.json({
      status: data.status,
      jeffreyComment,
      persons: data.persons,
      followUpQuestion: data.followUpQuestion,
      actionItems: data.actionItems,
      ambiguousPersons: data.status === "ambiguous"
        ? data.persons.filter((p) => p.ambiguous)
        : undefined,
    });
  } catch (error) {
    console.error("Error in analyze API:", error);
    return Response.json(
      { error: "Failed to analyze input: " + (error as Error).message },
      { status: 500 }
    );
  }
}
