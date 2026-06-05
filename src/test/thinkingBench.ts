// Benchmark: DeepSeek with thinking enabled vs disabled
// Run: npx tsx --env-file=.env src/test/thinkingBench.ts

const KEY = process.env.DEEPSEEK_API_KEY!;
const MODEL = "deepseek-v4-flash";
const API_URL = "https://api.deepseek.com/anthropic/v1/messages";

const SYSTEM_PROMPT = `你是 Jeffrey.AI 的人脉与社交图谱数据提取专家。从用户提供的非结构化文本中提取结构化数据。

## 提取规则
### 人物姓名 (name)
- 必须提取真实姓名或具体可指代的称呼。严禁使用泛指。
- 如果没有明确姓名，使用"某人"并标记 status 为 pending。
### 人物标签 (careers / interests)
- { name: string, weight: number } 格式，weight 0.0~1.0。
### 社交债务 (actionItems) - ownedBy: "me"|"them"|"both"
### 情绪基调 (sentiment) - 一句话描述
### 日期与地点 - ISO-8601 +08:00
### 完备性判断
status = "complete" 必须满足：所有人物有具体姓名、至少一位有career、sentiment非空、actionItems非空、date非空。
status = "pending"：在missingFields中列出缺失字段。

必须调用 save_extraction 工具。`;

const TOOL = {
  name: "save_extraction",
  description: "保存提取的结构化数据",
  input_schema: {
    type: "object",
    properties: {
      persons: { type: "array" },
      date: { type: "string" }, location: { type: "string" },
      sentiment: { type: "string" }, actionItems: { type: "array" },
      coreMemories: { type: "array" },
      status: { type: "string", enum: ["complete", "pending"] },
      missingFields: { type: "array" },
    }
  }
};

const TESTS = [
  { label: "short", text: "今天跟王磊在星巴克聊了AI创业，约了下周三给他发BP。" },
  { label: "medium", text: "昨天下午在国贸见了Sarah和她合伙人赵敏，聊了新做的跨境支付项目。公司叫SwiftPay，刚拿红杉A轮，约了下周五看demo。" },
  { label: "long", text: "晚上跟张总还有他的CTO李明一起吃饭。张总从大厂出来做企业级RAG产品。李明之前在微软做NLP。他们想让我介绍VC。约了下个月去新办公室。" },
];

async function call(text: string, thinking: boolean) {
  const t0 = Date.now();
  const body: Record<string, unknown> = {
    model: MODEL, system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: text }],
    tools: [TOOL], temperature: 0.3, max_tokens: 4000,
  };
  if (!thinking) body.thinking = { type: "disabled" };

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body),
  });
  const ms = Date.now() - t0;
  if (!res.ok) {
    const e = await res.text();
    return { ms, error: `HTTP ${res.status}: ${e.slice(0, 150)}` };
  }
  const data = await res.json() as any;
  const tool = data.content?.find((c: any) => c.type === "tool_use");
  const output = tool?.input || data;
  return { ms, output };
}

async function main() {
  console.log("=== DeepSeek Thinking: ENABLED vs DISABLED ===\n");
  console.log(`Model: ${MODEL}\n`);

  let totalWith = 0, totalWithout = 0, count = 0;

  for (const t of TESTS) {
    console.log(`[${t.label}] ${t.text.length} chars: ${t.text.slice(0, 60)}...`);

    const w = await call(t.text, true);
    const wo = await call(t.text, false);

    if (w.error) console.log(`  WITH:    ${w.ms}ms ERROR: ${w.error}`);
    else console.log(`  WITH:    ${w.ms}ms`);

    if (wo.error) console.log(`  WITHOUT: ${wo.ms}ms ERROR: ${wo.error}`);
    else console.log(`  WITHOUT: ${wo.ms}ms`);

    if (!w.error && !wo.error) {
      const speedup = ((w.ms - wo.ms) / w.ms * 100).toFixed(0);
      const wNames = w.output?.persons?.map((p: any) => p.name).join(", ") || "(none)";
      const woNames = wo.output?.persons?.map((p: any) => p.name).join(", ") || "(none)";
      const wStatus = w.output?.status || "?";
      const woStatus = wo.output?.status || "?";
      console.log(`  Speedup: ${speedup}%`);
      console.log(`  WITH:    persons=[${wNames}] status=${wStatus}`);
      console.log(`  WITHOUT: persons=[${woNames}] status=${woStatus}`);
      if (wNames !== woNames) console.log("  ⚠ NAMES DIFFER!");
      if (wStatus !== woStatus) console.log("  ⚠ STATUS DIFFER!");
      totalWith += w.ms; totalWithout += wo.ms; count++;
    }
    console.log("");
  }

  if (count > 0) {
    console.log("=== SUMMARY ===");
    console.log(`Total WITH thinking:    ${totalWith}ms`);
    console.log(`Total WITHOUT thinking: ${totalWithout}ms`);
    console.log(`Average speedup:        ${((totalWith - totalWithout) / totalWith * 100).toFixed(0)}%`);
  }
}

main().catch(console.error);
