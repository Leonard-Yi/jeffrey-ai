import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";
import { saveExtractionToDb, backfillLegacyEncryption } from "./db";
import { WeightedTagSchema, ActionItemSchema, MissingFieldSchema } from "@/schemas/core";
import { createCryptoStore } from "@/lib/cryptoStore";
import { getEncryptionKeys } from "@/lib/getKeys";
import { prisma } from "@/lib/db";
import { createPseudonymizer } from "@/lib/pseudonymizer";
import { safeLog } from "@/lib/safeLog";
import { encodeSSE } from "@/lib/sse-utils";

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
  missingFields: z.array(MissingFieldSchema).optional().default([]),
});

// ==================== Jeffrey 点评分层系统 ====================

type JeffreyMood = 'sarcastic' | 'appreciative' | 'gentle' | 'observant' | 'neutral';

function getJeffreyMood(opts: {
  hasAnxiety: boolean;
  hasHighValueCareer: boolean;
  hasCareers: boolean;
  meOwedCount: number;
  themOwedCount: number;
}): JeffreyMood {
  if (opts.meOwedCount > 2 || opts.themOwedCount > 2) return 'sarcastic';
  if (opts.hasHighValueCareer && !opts.hasAnxiety) return 'appreciative';
  if (!opts.hasCareers) return 'gentle';
  if (opts.hasAnxiety) return 'observant';
  return 'neutral';
}

function getJeffreyOpening(mood: JeffreyMood, name: string, meOwedCount: number, themOwedCount: number): string {
  const templates: Record<JeffreyMood, string[]> = {
    sarcastic: [
      `先生，${name}已经在案了。欠您${themOwedCount}件事的人——这种资源不盯紧点，转眼就忘。`,
      `${name}...好，记下来了。您现在有${meOwedCount}件事拖着没处理。我帮您记着，您可别忘了。`,
      `${name}的社交价值我帮您评估好了。建议您尽快兑现承诺——人情这东西，过期不候。`,
    ],
    appreciative: [
      `${name}在这个圈子里有些分量。这种人主动维护一下，比躺在通讯录里强十倍。`,
      `${name}？这类资源不常有。建议您主动出击，别等对方先想起来。`,
      `${name}对您来说是块好拼图。要不要趁热度在，约一次？`,
    ],
    gentle: [
      `${name}，已录入。人脉这东西，平时不烧香，急时抱佛脚是没用的。`,
      `${name}已记录。但我得提醒您——关系需要经营，不然就只是认识而已。`,
      `${name}...记下来了。后续怎么维护，可以想想。别等要用了才发现生疏了。`,
    ],
    observant: [
      `${name}目前似乎有些压力。这种时候建立的交情，往往最记得住。`,
      `${name}最近状态值得关注。有时候低谷期的关心，比顺境时的锦上添花更有效。`,
    ],
    neutral: [
      `${name}，已记录在案。`,
      `${name}的情况我整理好了。还有什么要补充的吗？`,
      `收到，${name}的信息已经录入系统。`,
    ],
  };
  const list = templates[mood];
  return list[Math.floor(Math.random() * list.length)];
}

// ==================== 结束 ====================

// ==================== 服务端质量校验 ====================

/** 模糊人名模式：匹配泛指、描述性短语、单字代词等 */
const VAGUE_NAME_PATTERNS: RegExp[] = [
  /^某人$/,
  /^那个人$/,
  /^这位(.{1,6})$/,
  /^那位(.{1,6})$/,
  /^一个.{0,10}的$/,
  /^某个(.{1,6})$/,
  /^他$/,
  /^她$/,
  /^这个(人|家伙|哥们|朋友)$/,
  /^那位$/,
  /^这位$/,
];

function isNameVague(name: string): boolean {
  if (!name || name.trim().length === 0) return true;
  const trimmed = name.trim();
  return VAGUE_NAME_PATTERNS.some((p) => p.test(trimmed));
}

// ==================== 增强版完备性检查 ====================

interface QualityIssue {
  field: string;
  priority: "high" | "mid" | "low";
  question: string;
}

function validateExtractionQuality(
  data: z.infer<typeof ExtractionPayloadSchema>,
  originalText: string,
): { valid: boolean; issues: QualityIssue[] } {
  const issues: QualityIssue[] = [];

  // 1. 检查人物姓名质量（最高优先级）
  for (const person of data.persons) {
    if (isNameVague(person.name)) {
      const contextClue = extractContextClue(originalText, person.name);
      issues.push({
        field: "name",
        priority: "high",
        question: contextClue
          ? `文中提到${contextClue}——具体怎么称呼他？总得有个名字吧。`
          : `这位是？总得有个名字或称呼吧。`,
      });
      break;
    }
  }

  // 2. 检查 career 标签
  const hasCareer = data.persons.some((p) => (p.careers || []).length > 0);
  if (!hasCareer) {
    issues.push({
      field: "career",
      priority: "mid",
      question: data.persons.length > 0
        ? `${data.persons[0].name}现在主要做什么方向？有没有什么专长？`
        : "这次聊的人主要做什么方向？",
    });
  }

  // 3. 检查 sentiment
  if (!(data.sentiment || "").trim()) {
    issues.push({
      field: "sentiment",
      priority: "mid",
      question: "这次互动的整体感觉怎么样？轻松愉快还是有点紧张？",
    });
  }

  // 4. 检查 actionItems
  if ((data.actionItems || []).length === 0) {
    issues.push({
      field: "actionItems",
      priority: "mid",
      question: "这次聊完有没有什么约定或想跟进的事情？",
    });
  }

  // 5. 检查 date
  if (!data.date) {
    issues.push({
      field: "date",
      priority: "high",
      question: "这是什么时候的事？今天还是前几天？",
    });
  }

  return { valid: issues.length === 0, issues };
}

/** 从原文中提取上下文线索，用于生成自然的追问 */
function extractContextClue(text: string, fallbackName: string): string | null {
  const patterns = [
    /一个(做|搞|弄).{2,10}的/,
    /那位?(做|搞|弄).{2,10}的/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[0];
  }
  return null;
}

const SYSTEM_PROMPT = `
你是 Jeffrey.AI 的人脉与社交图谱数据提取专家。

你的唯一任务是：从用户提供的非结构化"社交流水账"文本中，精准提取出结构化的人物信息与互动记录。

## 提取规则

### 人物姓名 (name)
- 必须提取真实姓名或具体可指代的称呼（如"老王"、"张总"、"李老师"、"小王"等）。
- **严禁使用泛指或描述性短语作为姓名**。以下情况必须将 status 设为 "pending" 并在 missingFields 中报告：
  - "某人"、"那个人"、"一个XX的人"、"这位大佬"等无具体指向的称呼
  - 只用代词（"他"、"她"）而无上下文中的具体姓名
  - 用职业描述代替姓名（如"一个投资人"、"那个做AI的"）
- 只有在文中确实没有姓名且用户也未提供任何可用的称呼时，才使用"某人"，且**必须**标记为 pending。

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
- 如果用户说"今天"，上文已被替换为具体日期，直接提取即可。
- **日期是必须提取的字段**，如果用户没有提及具体时间，在 missingFields 中报告。
- **公司/组织名称**：如果文中提到"他那家公司"、"他们公司"等模糊指代，在 missingFields 中报告。

## 完备性判断

**status = "complete"** 必须同时满足：
1. **所有人物拥有具体可指代的姓名**（不是泛指、"某人"、或描述性短语）
2. 至少一位人物拥有 career 标签
3. sentiment 字段非空
4. actionItems 数组非空
5. **date 字段非空**（这次互动是什么时候？）

**status = "pending"**：以上任一条件不满足时：
- 将 status 设为 "pending"
- 在 **missingFields** 数组中列出所有不满足的字段
- 每个 missingField 包含：
  - field: 字段名（"name" | "company" | "location" | "career" | "sentiment" | "actionItems" | "date"）
  - priority: 优先级（"high"=姓名/日期, "mid"=公司/career/sentiment, "low"=地点/其他）
  - question: 一句自然的中文追问，提及上下文信息
- **重要约束**：missingFields 按 priority 排序（high → mid → low）
- 仍然填写 followUpQuestion（向后兼容），内容为第一个（最高优先级）missingField 的 question

**question 示例**（好的追问）：
- 姓名缺失："这位做区块链的——他叫什么名字？总得有个称呼吧。"
- 公司缺失："你提到「他那家公司」——公司叫什么名字？"
- career 缺失："他现在主要的工作方向是什么？"
- 日期缺失："这是什么时候的事？今天还是前几天？"

**question 反例**（不好的追问——太模板化）：
- "请补充缺少的信息"
- "还需要更多数据"
- "信息不完整，请补充"

### 同名检测（自动识别）

若在同一次输入中发现多个姓名可能指向同一人（如"老王"和"王总"），必须：
1. 在该人物对象中设置 ambiguous: true
2. 在 ambiguousWith 数组中填入疑似重复的已有姓名
3. 将 status 设为 "ambiguous"
4. 在 followUpQuestion 中询问："你指的是之前录入的老王吗？"

注意：
- ambiguous 只在提取到"可能是同一人"时触发，不要过度猜测
- 如果用户明确说明是不同人，不要标记 ambiguous

## 重要提示
- 你必须调用 save_extraction 工具，将所有提取结果作为参数传入。不要输出任何纯文本。
- 用户输入的是中文，请确保正确解析 UTF-8 编码的文本。
`.trim();

function getApiKey(): string {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("Missing env var: DEEPSEEK_API_KEY");
  return apiKey;
}

function getModel(): string {
  return process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
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
  const keys = await getEncryptionKeys();
  if (!keys) {
    return Response.json(
      { error: "加密密钥未就绪，请退出登录后重新登录" },
      { status: 401 }
    );
  }
  const { encKey, pseudoKey, userId } = keys;
  const store = createCryptoStore(prisma, encKey);

  // Backfill legacy plaintext fields (one-time, idempotent)
  backfillLegacyEncryption(userId, store, encKey, pseudoKey).then((n) => {
    if (n > 0) console.log(`[Jeffrey.AI] Backfilled encryption for ${n} legacy persons`);
  });

  // Check if key rotation is in progress (blocks writes)
  const analyzingUser = await store.raw.user.findUnique({
    where: { id: userId },
    select: { keyRotationInProgress: true }
  });
  if (analyzingUser?.keyRotationInProgress) {
    return Response.json(
      { error: "密钥更新中，请稍后再试" },
      { status: 423 }
    );
  }

  // Create pseudonymizer (loads pseudonym map into memory)
  const pseudo = await createPseudonymizer(userId, encKey, pseudoKey, store);

  try {
    const rawBody = await request.text();
    safeLog("Request received", "(text pseudonymized, see next log line)");

    const { text } = JSON.parse(rawBody);

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

    // Pseudonymize user input before sending to LLM
    const { sanitizedText } = await pseudo.pseudonymize(normalizedText);
    safeLog("Normalized text (pseudonymized)", sanitizedText);

    const stream = new ReadableStream({
      async start(controller) {
        function emit(event: Parameters<typeof encodeSSE>[0]) {
          controller.enqueue(encodeSSE(event));
        }

        try {
          // Step 1: NER & pseudonymize complete
          emit({
            type: "progress",
            step: "parsing",
            message: "解析文本 & 实体识别",
            detail: "分词、命名实体识别、语境分析",
          });

          // Step 2: Call LLM
          emit({
            type: "progress",
            step: "extracting",
            message: "LLM 提取结构化数据...",
            detail: "调用 DeepSeek 模型进行结构化提取",
          });

          const apiResponse = await fetch("https://api.deepseek.com/anthropic/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${getApiKey()}`,
            },
            body: JSON.stringify({
              model: getModel(),
              system: SYSTEM_PROMPT,
              messages: [{ role: "user", content: sanitizedText }],
              tools: [extractionTool],
              temperature: 0.3,
              max_tokens: 4000,
            }),
            signal: AbortSignal.timeout(45000),
          });

          if (!apiResponse.ok) {
            emit({ type: "error", message: `AI服务暂时不可用 (${apiResponse.status})，请重试` });
            controller.close();
            return;
          }

          const apiData = await apiResponse.json();

          // Parse LLM response
          const toolUseBlock = apiData.content?.find((c: { type: string }) => c.type === "tool_use");
          const textBlock = apiData.content?.find((c: { type: string }) => c.type === "text");

          let rawJson: unknown;
          if (toolUseBlock) {
            rawJson = toolUseBlock.input || {};
          } else if (textBlock?.text) {
            const textContent = textBlock.text;
            const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ||
                              textContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              rawJson = JSON.parse(jsonMatch[jsonMatch.length - 1]);
            } else {
              emit({ type: "error", message: "AI未能正确提取信息，请重试或简化输入" });
              controller.close();
              return;
            }
          } else {
            emit({ type: "error", message: "AI返回空响应，请重试" });
            controller.close();
            return;
          }

          // Depseudonymize
          const rawJsonStr = JSON.stringify(rawJson);
          const depseudonymizedStr = await pseudo.depseudonymize(rawJsonStr);
          rawJson = JSON.parse(depseudonymizedStr);

          // Leak check
          const leaks = pseudo.checkLeaks(JSON.stringify(rawJson));
          if (leaks.length > 0) {
            console.warn("[Jeffrey.AI] ENTITY LEAK DETECTED:", leaks.length, "entities leaked in LLM output");
          }

          // nullToUndefined normalizer
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

          // Zod validation
          const result = ExtractionPayloadSchema.safeParse(nullToUndefined(rawJson));
          if (!result.success) {
            console.error("[Jeffrey.AI] Zod validation failed:", JSON.stringify(result.error.flatten()));
            emit({ type: "error", message: "AI返回格式不完整，请重试或简化输入" });
            controller.close();
            return;
          }

          const data = result.data;

          // Step 3: Quality check
          const qualityCheck = validateExtractionQuality(data, normalizedText);

          // LLM 判定 complete 但服务端发现模糊姓名 → 强制 pending
          if (!qualityCheck.valid && data.status === "complete") {
            console.warn("[Jeffrey.AI] Server-side quality check found issues LLM missed:", qualityCheck.issues.map((i) => i.field).join(", "));
            data.status = "pending";
            // @ts-ignore - QualityIssue.field is always valid MissingField enum at runtime
            data.missingFields = qualityCheck.issues.map((issue) => ({
              field: issue.field,
              priority: issue.priority,
              question: issue.question,
            }));
            if (!data.followUpQuestion && qualityCheck.issues.length > 0) {
              data.followUpQuestion = qualityCheck.issues[0].question;
            }
          }

          // LLM pending 但 missingFields 为空 → 填充
          if (data.status === "pending" && (!data.missingFields || data.missingFields.length === 0)) {
            if (qualityCheck.issues.length > 0) {
              // @ts-ignore - QualityIssue.field is always valid MissingField enum at runtime
              data.missingFields = qualityCheck.issues.map((issue) => ({
                field: issue.field,
                priority: issue.priority,
                question: issue.question,
              }));
              console.log("[Jeffrey.AI] Filled missingFields from server-side check:", qualityCheck.issues.map((i) => i.field).join(", "));
            }
          }

          // 合并服务端额外发现的缺失项
          if (data.status === "pending" && data.missingFields && data.missingFields.length > 0) {
            const existingFields = new Set(data.missingFields.map((f) => f.field));
            // @ts-ignore - QualityIssue.field is always valid MissingField enum at runtime
            const extraIssues = qualityCheck.issues.filter((i) => !existingFields.has(i.field));
            if (extraIssues.length > 0) {
              // @ts-ignore - QualityIssue.field is always valid MissingField enum at runtime
              data.missingFields = [
                ...data.missingFields,
                ...extraIssues.map((issue) => ({
                  field: issue.field,
                  priority: issue.priority,
                  question: issue.question,
                })),
              ].sort((a, b) => {
                const order = { high: 0, mid: 1, low: 2 };
                return order[a.priority] - order[b.priority];
              });
              console.log("[Jeffrey.AI] Merged extra missingFields from server-side:", extraIssues.map((i) => i.field).join(", "));
            }
          }

          const missingCount = data.missingFields?.length || 0;

          emit({
            type: "progress",
            step: "quality_check",
            message: missingCount > 0
              ? `检测到 ${missingCount} 个信息缺口`
              : "所有字段完整",
            detail: missingCount > 0
              ? data.missingFields!.map(f => `${f.field}(${f.priority})`).join("、")
              : "无缺失项",
          });

          // Step 4: DB save
          let personIds: string[] = [];
          if (data.status === "complete") {
            try {
              // @ts-ignore - Zod output type mismatch with manual interface
              const saveResult = await saveExtractionToDb(data, true, userId, store, pseudoKey, encKey);
              personIds = saveResult.personIds;
              console.log("[Jeffrey.AI] Successfully saved complete data to database");
            } catch (dbError) {
              console.error("[Jeffrey.AI] Database save failed:", dbError);
            }
          } else if (data.status === "pending" && data.persons && data.persons.length > 0) {
            try {
              const saveResult = await saveExtractionToDb({
                persons: data.persons,
                date: data.date,
                location: undefined,
                contextType: undefined,
                sentiment: undefined,
                actionItems: [],
                coreMemories: [],
              } as any, true, userId, store, pseudoKey, encKey);
              personIds = saveResult.personIds;
              console.log("[Jeffrey.AI] Saved pending person data with interaction");
            } catch (dbError) {
              console.error("[Jeffrey.AI] Database save (pending) failed:", dbError);
            }
          } else if (data.status === "ambiguous") {
            console.log("[Jeffrey.AI] Ambiguous status detected, returning ambiguous persons for user confirmation");
          }

          // Step 5: Jeffrey comment
          const personNames = data.persons.map(p => p.name).join('、');
          const hasAnxiety = data.persons.some(p =>
            p.vibeTags.some(v => v.includes('焦虑') || v.includes('压力'))
          );
          const meOwedCount = data.actionItems.filter(a => a.ownedBy === 'me').length;
          const themOwedCount = data.actionItems.filter(a => a.ownedBy === 'them').length;
          const allCareers = data.persons.flatMap(p => p.careers.map(c => c.name));
          const allInterests = data.persons.flatMap(p => p.interests.map(i => i.name));
          const hasHighValueCareer = allCareers.some(c =>
            ['投资', '金融', '科技', '创始人', 'CEO', '合伙人', '律师', '医生', '教授'].some(k => c.includes(k))
          );
          const hasCareers = allCareers.length > 0;

          let jeffreyComment = "";
          if (data.persons.length === 0) {
            jeffreyComment = "先生，您告诉我这么多，却没提到任何人的名字。是在考验我的记忆力吗？";
          } else {
            const mood = getJeffreyMood({ hasAnxiety, hasHighValueCareer, hasCareers, meOwedCount, themOwedCount });
            jeffreyComment = getJeffreyOpening(mood, personNames, meOwedCount, themOwedCount);
            if (meOwedCount > 0 && themOwedCount > 0) {
              jeffreyComment += ` 这次互动双方都有承诺要履行——这种"互相亏欠"的状态，其实是最稳固的关系。`;
            } else if (meOwedCount > 0 && mood !== 'sarcastic') {
              jeffreyComment += ` 您有${meOwedCount}件事要做。先生，欠人情是要还的，建议您尽快处理。`;
            } else if (themOwedCount > 0 && mood !== 'sarcastic') {
              jeffreyComment += ` 对方欠您${themOwedCount}件事。这种人情的债，往往比金钱更值得记住。`;
            }
            if (allInterests.length > 0 && (mood === 'neutral' || mood === 'appreciative')) {
              jeffreyComment += ` 对了，${personNames}对${allInterests[0]}感兴趣——这是个不错的切入点。`;
            }
          }

          emit({
            type: "progress",
            step: "done",
            message: "分析完成",
            detail: data.status === "complete" ? "所有字段已提取" : `${missingCount} 个字段待补充`,
          });

          // Final result event
          emit({
            type: "result",
            data: {
              status: data.status,
              jeffreyComment,
              persons: data.persons,
              personIds,
              followUpQuestion: data.followUpQuestion,
              missingFields: data.missingFields || [],
              date: data.date || null,
              sentiment: data.sentiment || null,
              actionItems: data.actionItems,
              ambiguousPersons: data.status === "ambiguous"
                ? data.persons.filter((p) => p.ambiguous)
                : undefined,
            },
          });

          controller.close();
        } catch (error) {
          console.error("[Jeffrey.AI] SSE stream error:", error);
          try {
            emit({ type: "error", message: "Internal server error" });
          } catch {}
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("Error in analyze API:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}