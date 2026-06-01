# 录入→分析→追问 UX 重构 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现分轮追问体验：用户录入文本后，系统检测模糊指代和缺失字段，按优先级逐轮追问（人名→公司→地点），支持返回修改和跳过。

**Architecture:** 三层改动——(1) System Prompt 重写 + Zod Schema 扩展，让 LLM 输出 missingFields；(2) 服务端双重校验（黑名单+增强完备性检查），兜底 LLM 可能的遗漏；(3) 前端新增 StepIndicator/RoundPrompt/ExtractionPreview 三个组件，实现分轮追问状态机。

**Tech Stack:** TypeScript, Next.js 16 (App Router), React 19, Zod, DeepSeek API

---

## 文件结构

| 文件 | 操作 | 职责 |
|---|---|---|
| `src/schemas/core.ts` | 修改 | 新增 `MissingFieldSchema` 和 `MissingField` 类型 |
| `src/app/api/analyze/route.ts` | 修改 | 重写 System Prompt、Schema 扩展、质量校验、POST 逻辑 |
| `src/components/StepIndicator.tsx` | 新建 | 步骤指示器（①→②→③），当前步骤脉冲动画 |
| `src/components/RoundPrompt.tsx` | 新建 | 单轮追问卡片：优先级标签 + 问题 + 输入框 + 返回/跳过/确认 |
| `src/components/ExtractionPreview.tsx` | 新建 | 已提取字段预览标签组 |
| `src/app/input/page.tsx` | 修改 | 分轮追问状态机、对话历史渲染、新组件集成 |
| `src/test/testExtractor.ts` | 不改 | 该文件使用 `legacy/llmExtractor.ts`（Qwen），不涉及本次改动 |

---

### Task 1: 新增 MissingFieldSchema 到共享 schema

**Files:**
- Modify: `src/schemas/core.ts`

- [ ] **Step 1: 在 core.ts 末尾添加 MissingFieldSchema**

在 `src/schemas/core.ts` 文件的最后（`Interaction` 类型导出之后）添加：

```typescript
// ─────────────────────────────────────────────
// Extraction quality — missing field tracking
// ─────────────────────────────────────────────

export const MissingFieldSchema = z.object({
  /** Which field is missing or vague */
  field: z.enum(["name", "company", "location", "career", "sentiment", "actionItems", "date"]),
  /** How critical this field is */
  priority: z.enum(["high", "mid", "low"]),
  /** Natural Chinese question asking the user for this specific field */
  question: z.string().min(1),
});

export type MissingField = z.infer<typeof MissingFieldSchema>;
```

- [ ] **Step 2: Typecheck 验证**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

预期：无新增类型错误（core.ts 相关的）。

- [ ] **Step 3: Commit**

```bash
git add src/schemas/core.ts
git commit -m "feat(schema): add MissingFieldSchema for extraction quality tracking

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: 重写 System Prompt + 扩展 ExtractionPayloadSchema

**Files:**
- Modify: `src/app/api/analyze/route.ts:1-210`（Schema 定义区 + System Prompt）

- [ ] **Step 1: 导入 MissingFieldSchema**

在 `route.ts` 顶部 import 区添加：

```typescript
import { WeightedTagSchema, ActionItemSchema, MissingFieldSchema } from "@/schemas/core";
```

（`WeightedTagSchema` 和 `ActionItemSchema` 已经在此 import 中，只需添加 `MissingFieldSchema`。）

- [ ] **Step 2: 在 ExtractionPayloadSchema 中添加 missingFields 字段**

找到 `ExtractionPayloadSchema` 定义（约 L23-L33），将其改为：

```typescript
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
```

- [ ] **Step 3: 重写 SYSTEM_PROMPT**

将现有 `SYSTEM_PROMPT`（L103-L190）替换为以下内容：

```typescript
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
```

- [ ] **Step 4: Typecheck 验证**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```

预期：无新增类型错误。`MissingFieldSchema` 需能从 `@/schemas/core` 正确导入。

- [ ] **Step 5: Commit**

```bash
git add src/app/api/analyze/route.ts
git commit -m "feat(analyze): rewrite system prompt with vague-reference detection and missingFields

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: 服务端双重校验（黑名单 + 增强完备性检查）

**Files:**
- Modify: `src/app/api/analyze/route.ts:87-101`（`describeCompleteness` 函数区域）

- [ ] **Step 1: 新增 name 黑名单检测函数**

在 `describeCompleteness` 函数之前插入：

```typescript
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
```

- [ ] **Step 2: 替换 describeCompleteness 为增强版 validateExtractionQuality**

删除现有 `describeCompleteness` 函数（L87-L101），替换为：

```typescript
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
      // 从原文中提取上下文线索，生成自然的追问
      const contextClue = extractContextClue(originalText, person.name);
      issues.push({
        field: "name",
        priority: "high",
        question: contextClue
          ? `文中提到${contextClue}——具体怎么称呼他？总得有个名字吧。`
          : `这位是？总得有个名字或称呼吧。`,
      });
      break; // 只报告一次姓名缺失
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
  // 尝试提取描述性短语作为线索
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
```

- [ ] **Step 3: Typecheck 验证**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

预期：无新增类型错误（`QualityIssue` 是局部 interface，不影响外部）。

- [ ] **Step 4: Commit**

```bash
git add src/app/api/analyze/route.ts
git commit -m "feat(analyze): add server-side name blacklist and enhanced quality validation

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: 更新 POST 处理器使用新校验

**Files:**
- Modify: `src/app/api/analyze/route.ts:454-467`（POST 处理器中的校验区块）

- [ ] **Step 1: 替换服务端校验逻辑**

找到 POST handler 中的校验区块（约 L454-L466），将其替换为：

```typescript
    // 服务器端质量校验：双重检测
    const qualityCheck = validateExtractionQuality(data, normalizedText);

    // LLM 判定 complete 但服务端发现模糊姓名 → 强制 pending
    if (!qualityCheck.valid && data.status === "complete") {
      console.warn(
        "[Jeffrey.AI] Server-side quality check found issues LLM missed:",
        qualityCheck.issues.map((i) => i.field).join(", "),
      );
      data.status = "pending";
      data.missingFields = qualityCheck.issues.map((issue) => ({
        field: issue.field,
        priority: issue.priority,
        question: issue.question,
      }));
      // 向后兼容：followUpQuestion 填入最高优先级的问题
      if (!data.followUpQuestion && qualityCheck.issues.length > 0) {
        data.followUpQuestion = qualityCheck.issues[0].question;
      }
    }

    // 如果 LLM 已经是 pending 但 missingFields 为空，用服务端检测结果填充
    if (data.status === "pending" && (!data.missingFields || data.missingFields.length === 0)) {
      if (qualityCheck.issues.length > 0) {
        data.missingFields = qualityCheck.issues.map((issue) => ({
          field: issue.field,
          priority: issue.priority,
          question: issue.question,
        }));
        console.log(
          "[Jeffrey.AI] Filled missingFields from server-side check:",
          qualityCheck.issues.map((i) => i.field).join(", "),
        );
      }
    }
```

- [ ] **Step 2: 在返回的 JSON 中加入 missingFields**

找到 `return Response.json({...})` 调用（约 L547-L557），在返回对象中添加 `missingFields`：

```typescript
    return Response.json({
      status: data.status,
      jeffreyComment,
      persons: data.persons,
      personIds,
      followUpQuestion: data.followUpQuestion,
      missingFields: data.missingFields || [],
      actionItems: data.actionItems,
      ambiguousPersons: data.status === "ambiguous"
        ? data.persons.filter((p) => p.ambiguous)
        : undefined,
    });
```

- [ ] **Step 3: Typecheck 验证**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/analyze/route.ts
git commit -m "feat(analyze): integrate server-side quality check into POST handler

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: 创建 StepIndicator 组件

**Files:**
- Create: `src/components/StepIndicator.tsx`

- [ ] **Step 1: 创建组件文件**

```typescript
"use client";

import { tokens as C } from "@/lib/design-tokens";

export interface StepInfo {
  label: string;
  status: "done" | "active" | "pending";
}

interface StepIndicatorProps {
  steps: StepInfo[];
  currentLabel?: string;
}

/** 分轮追问步骤指示器：①→②→③，当前步骤脉冲动画 */
export default function StepIndicator({ steps, currentLabel }: StepIndicatorProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        {steps.map((step, i) => (
          <div key={step.label} style={{ display: "flex", alignItems: "center", gap: 0 }}>
            {i > 0 && (
              <div
                style={{
                  width: 32,
                  height: 2,
                  background: step.status === "done" || steps[i - 1]?.status === "done"
                    ? C.success
                    : C.border,
                  flexShrink: 0,
                  transition: "background 0.35s",
                }}
              />
            )}
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 600,
                flexShrink: 0,
                border: `2px solid ${
                  step.status === "done"
                    ? C.success
                    : step.status === "active"
                      ? C.primary
                      : C.borderStrong
                }`,
                color:
                  step.status === "done"
                    ? C.success
                    : step.status === "active"
                      ? C.primary
                      : C.textMuted,
                background:
                  step.status === "active"
                    ? C.primaryDim
                    : step.status === "done"
                      ? C.successBg
                      : "transparent",
                transition: "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
                animation:
                  step.status === "active"
                    ? "stepPulse 1.8s ease-in-out infinite"
                    : "none",
              }}
            >
              {step.status === "done" ? "✓" : i + 1}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-around",
          width: "100%",
          maxWidth: 280,
          marginTop: 6,
          fontSize: 11,
          color: C.textMuted,
        }}
      >
        {steps.map((step) => (
          <span
            key={step.label}
            style={{
              textAlign: "center",
              color:
                step.status === "active"
                  ? C.primary
                  : step.status === "done"
                    ? C.success
                    : C.textMuted,
              fontWeight: step.status === "active" ? 500 : 400,
              transition: "color 0.35s",
            }}
          >
            {step.label}
          </span>
        ))}
      </div>
      {currentLabel && (
        <style>{`
          @keyframes stepPulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(201,169,110,0); }
            50% { box-shadow: 0 0 0 6px rgba(201,169,110,0.15); }
          }
        `}</style>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck 验证**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/StepIndicator.tsx
git commit -m "feat(ui): add StepIndicator component for follow-up round progress

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: 创建 ExtractionPreview 组件

**Files:**
- Create: `src/components/ExtractionPreview.tsx`

- [ ] **Step 1: 创建组件文件**

```typescript
"use client";

import { tokens as C } from "@/lib/design-tokens";
import { SectionLabel } from "@/components/ui/SectionLabel";

interface ExtractedField {
  label: string;
  value: string;
}

interface ExtractionPreviewProps {
  fields: ExtractedField[];
}

/** 已提取字段预览：展示系统自动提取到的字段标签组 */
export default function ExtractionPreview({ fields }: ExtractionPreviewProps) {
  if (fields.length === 0) return null;

  return (
    <div
      style={{
        background: C.bgCard,
        border: `1px solid ${C.border}`,
        borderRadius: C.radiusLg,
        padding: "14px 18px",
      }}
    >
      <SectionLabel>系统已自动提取</SectionLabel>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
        {fields.map((f) => (
          <span
            key={f.label}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 9px",
              borderRadius: C.radiusSm,
              fontSize: 11.5,
              fontWeight: 500,
              background: C.bgElevated,
              color: C.textSecondary,
              border: `1px solid ${C.border}`,
            }}
          >
            {f.label}: {f.value}
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck 验证**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ExtractionPreview.tsx
git commit -m "feat(ui): add ExtractionPreview component for extracted fields

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: 创建 RoundPrompt 组件

**Files:**
- Create: `src/components/RoundPrompt.tsx`

- [ ] **Step 1: 创建组件文件**

```typescript
"use client";

import { useEffect, useRef } from "react";
import { tokens as C } from "@/lib/design-tokens";
import { Button } from "@/components/ui/Button";
import StepIndicator, { type StepInfo } from "./StepIndicator";

export interface MissingFieldQuestion {
  field: string;
  priority: "high" | "mid" | "low";
  question: string;
  detail?: string; // Optional longer hint
}

interface RoundPromptProps {
  /** All missing fields (for step indicator) */
  allFields: MissingFieldQuestion[];
  /** Current question index */
  currentIndex: number;
  /** Pre-filled answer (when going back) */
  defaultValue?: string;
  /** Whether this is the last round */
  isLast: boolean;
  /** Whether showing the back button */
  showBack: boolean;
  /** Called when user confirms their answer */
  onConfirm: (answer: string | null) => void;
  /** Called when user skips */
  onSkip: () => void;
  /** Called when user goes back to previous question */
  onBack: () => void;
}

const PRIORITY_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  high: { label: "🔴 关键", bg: C.errorBg, color: C.error, border: `rgba(224,85,106,0.25)` },
  mid: { label: "🟡 重要", bg: C.warningBg, color: C.warning, border: `rgba(212,168,83,0.25)` },
  low: { label: "⚪ 补充", bg: C.bgElevated, color: C.textMuted, border: `1px solid ${C.borderStrong}` },
};

export default function RoundPrompt({
  allFields,
  currentIndex,
  defaultValue = "",
  isLast,
  showBack,
  onConfirm,
  onSkip,
  onBack,
}: RoundPromptProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const currentField = allFields[currentIndex];
  const priorityCfg = PRIORITY_CONFIG[currentField.priority] || PRIORITY_CONFIG.low;

  useEffect(() => {
    // Auto-focus input on mount and when currentIndex changes
    inputRef.current?.focus();
  }, [currentIndex]);

  const steps: StepInfo[] = allFields.map((f, i) => ({
    label: f.field === "name" ? "姓名" : f.field === "company" ? "公司" : f.field === "location" ? "地点" : f.field === "career" ? "职业" : f.field === "sentiment" ? "情绪" : f.field === "actionItems" ? "行动项" : "日期",
    status: i < currentIndex ? "done" : i === currentIndex ? "active" : "pending",
  }));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      const val = inputRef.current?.value?.trim() || null;
      onConfirm(val);
    }
  };

  return (
    <div
      style={{
        background: `linear-gradient(135deg, rgba(212,168,83,0.06) 0%, rgba(201,169,110,0.03) 100%)`,
        border: `1px solid ${C.borderAccent}`,
        borderRadius: C.radiusLg,
        padding: "18px 20px",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: C.bgElevated,
            border: `1.5px solid ${C.borderStrong}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 600,
            fontSize: 13,
            color: C.primary,
            flexShrink: 0,
          }}
        >
          J
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.primary }}>
          Jeffrey 追问
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "3px 10px",
            borderRadius: 100,
            fontSize: 11.5,
            fontWeight: 600,
            background: priorityCfg.bg,
            color: priorityCfg.color,
            border: `1px solid ${priorityCfg.border}`,
          }}
        >
          {priorityCfg.label}
        </span>
      </div>

      {/* Step indicator */}
      <StepIndicator steps={steps} currentLabel={currentField.field} />

      {/* Question */}
      <div
        style={{
          fontSize: 15,
          color: C.text,
          fontStyle: "italic",
          lineHeight: 1.75,
          padding: "12px 16px",
          background: C.bgElevated,
          borderRadius: C.radiusMd,
          border: `1px solid ${C.border}`,
          marginBottom: 14,
        }}
      >
        <span style={{ display: "block", fontWeight: 500, fontStyle: "normal", marginBottom: 6, color: C.warning }}>
          第 {currentIndex + 1} 问：{steps[currentIndex].label}
        </span>
        {currentField.question}
        {currentField.detail && (
          <span style={{ display: "block", fontSize: 12.5, color: C.textMuted, marginTop: 6, fontStyle: "normal" }}>
            {currentField.detail}
          </span>
        )}
      </div>

      {/* Input row */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          ref={inputRef}
          type="text"
          placeholder={currentField.priority === "high" ? "输入回答..." : "输入或留空跳过..."}
          defaultValue={defaultValue}
          onKeyDown={handleKeyDown}
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: C.radiusMd,
            border: `1.5px solid ${C.borderStrong}`,
            background: C.bg,
            color: C.text,
            fontFamily: "var(--font-body)",
            fontSize: 14,
            outline: "none",
            transition: "border-color 0.15s",
            boxSizing: "border-box",
          }}
          onFocus={(e) => (e.target.style.borderColor = C.primary)}
          onBlur={(e) => (e.target.style.borderColor = C.borderStrong)}
        />
        <Button
          variant="primary"
          onClick={() => {
            const val = inputRef.current?.value?.trim() || null;
            onConfirm(val);
          }}
          style={{ flex: "0 0 auto", minWidth: 80, borderRadius: C.radiusMd }}
        >
          {isLast ? "完成 ✓" : "继续 →"}
        </Button>
      </div>

      {/* Navigation row */}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        {showBack && (
          <Button
            variant="secondary"
            onClick={onBack}
            style={{ flex: "0 0 auto", borderRadius: C.radiusMd, fontSize: 13 }}
          >
            ← 返回修改
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={onSkip}
          style={{ flex: "0 0 auto", borderRadius: C.radiusMd, fontSize: 13 }}
        >
          跳过
        </Button>
        <span style={{ fontSize: 12, color: C.textMuted, alignSelf: "center", marginLeft: "auto" }}>
          {currentIndex + 1}/{allFields.length}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck 验证**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/components/RoundPrompt.tsx
git commit -m "feat(ui): add RoundPrompt component for multi-round follow-up questions

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: 改造 input/page.tsx — 类型定义和状态扩展

**Files:**
- Modify: `src/app/input/page.tsx:26-49`（接口定义区）
- Modify: `src/app/input/page.tsx:155-178`（状态声明区）

- [ ] **Step 1: 新增 MissingField 接口和扩展 ExtractionResponse**

在 `interface ActionItem` 之后（约 L39），添加：

```typescript
interface MissingField {
  field: string;
  priority: 'high' | 'mid' | 'low';
  question: string;
}
```

在 `interface ExtractionResponse` 的 `ambiguousPersons` 之后（约 L48），添加：

```typescript
  missingFields: MissingField[];
```

- [ ] **Step 2: 新增分轮追问状态**

在状态声明区（`const JeffreyInputPage = () => {` 之后的状态声明），在 `const [dialogueComplete, setDialogueComplete]` 之后添加（约 L174）：

```typescript
  // 分轮追问状态
  const [missingFields, setMissingFields] = useState<MissingField[]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [roundAnswers, setRoundAnswers] = useState<Record<string, string | null>>({});
  const [roundHistory, setRoundHistory] = useState<Array<{ field: string; answer: string | null }>>([]);
```

- [ ] **Step 3: 更新 ExtractionResponse 类型引用**

确保步骤 1 中新增的 `missingFields` 字段在前端处理 `data.missingFields` 时类型正确。

- [ ] **Step 4: Typecheck 验证**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add src/app/input/page.tsx
git commit -m "feat(input): add MissingField types and multi-round state to input page

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: 改造 input/page.tsx — 分析结果处理逻辑

**Files:**
- Modify: `src/app/input/page.tsx:300-353`（`handleSubmitWithText` 函数）

- [ ] **Step 1: 更新 handleSubmitWithText 处理 missingFields**

找到 `handleSubmitWithText` 函数（约 L300-L353），在设置 API 返回值状态的位置（约 L317-L324），替换为：

```typescript
      setJeffreyComment(data.jeffreyComment);
      setPersons(data.persons);
      setPersonIds(data.personIds || []);
      setFollowUpQuestion(data.followUpQuestion || '');
      setActionItems(data.actionItems);
      setStatus(data.status);
      setAmbiguousPersons(data.ambiguousPersons || []);
      // 新增：分轮追问数据
      setMissingFields(data.missingFields || []);
      if (data.missingFields && data.missingFields.length > 0) {
        setCurrentRound(0);
        setRoundAnswers({});
        setRoundHistory([]);
      }
```

然后将状态处理逻辑（约 L324-L337）替换为：

```typescript
      if (data.status === 'complete') {
        const jeffreyMsg: ChatMessage = { role: 'jeffrey', content: data.jeffreyComment || '信息已保存。', timestamp: new Date().toLocaleString('zh-CN') };
        setConversationHistory(p => [...p, jeffreyMsg]);
        if (!isFollowUp) {
          const entry: RecentEntry = {
            id: Date.now().toString(),
            text: textToSubmit.slice(0, 60) + (textToSubmit.length > 60 ? '...' : ''),
            timestamp: new Date().toLocaleString(),
            status: data.status,
            relativeTime: '刚刚',
            createdAt: Date.now(),
          };
          const updated = [entry, ...recentEntries.slice(0, 4)];
          setRecentEntries(updated);
          localStorage.setItem(getStorageKey(), JSON.stringify(updated));
          setDialogueComplete(true);
        } else {
          setDialogueComplete(true);
        }
      } else if (data.status === 'pending' && data.missingFields && data.missingFields.length > 0) {
        // 新版分轮追问路径
        setDialogueComplete(false);
      } else if (data.status === 'pending' && data.followUpQuestion) {
        // 旧版兼容：单个追问
        setConversationHistory(p => [...p, { role: 'jeffrey', content: data.followUpQuestion!, timestamp: new Date().toLocaleString('zh-CN') }]);
        setDialogueComplete(false);
      }
```

- [ ] **Step 2: Typecheck 验证**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/app/input/page.tsx
git commit -m "feat(input): handle missingFields in API response for multi-round follow-up

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 10: 改造 input/page.tsx — 渲染分轮追问 UI

**Files:**
- Modify: `src/app/input/page.tsx` — 在 JSX 渲染区域中添加分轮追问 UI

- [ ] **Step 1: 添加导入**

在文件顶部导入区添加：

```typescript
import StepIndicator, { type StepInfo } from '@/components/StepIndicator';
import RoundPrompt, { type MissingFieldQuestion } from '@/components/RoundPrompt';
import ExtractionPreview from '@/components/ExtractionPreview';
```

- [ ] **Step 2: 新增分轮追问处理函数**

在 `handleClear` 函数之前，添加分轮追问的回调函数：

```typescript
  /** 从 missingFields 提取已识别字段用于预览 */
  const getExtractedPreview = (): Array<{ label: string; value: string }> => {
    const previews: Array<{ label: string; value: string }> = [];
    if (persons.length > 0) {
      const p = persons[0];
      if (p.careers.length > 0) previews.push({ label: '职业', value: p.careers.map(c => c.name).join(' / ') });
    }
    if (actionItems.length > 0) previews.push({ label: '行动项', value: actionItems.map(a => a.description).join('、') });
    if (jeffreyComment) {
      // Extract date from existing data context — just mark as extracted
      previews.push({ label: '日期', value: '已识别' });
      previews.push({ label: '情绪', value: '已提取' });
    }
    return previews;
  };

  /** 确认当前轮的回答 */
  const handleRoundConfirm = async (answer: string | null) => {
    const field = missingFields[currentRound].field;
    const newAnswers = { ...roundAnswers, [field]: answer };
    const newHistory = [...roundHistory, { field, answer }];
    setRoundAnswers(newAnswers);
    setRoundHistory(newHistory);

    if (currentRound < missingFields.length - 1) {
      // 进入下一轮
      setCurrentRound(currentRound + 1);
    } else {
      // 最后一轮完成 → 构建累积上下文，发送给 API
      const contextParts: string[] = [];
      for (const h of newHistory) {
        if (h.answer) {
          const label = missingFields.find(f => f.field === h.field)?.question || h.field;
          contextParts.push(`${label}\n回答: ${h.answer}`);
        }
      }
      const accumulatedText = originalInputText
        ? `${originalInputText}\n\n[追问回复]\n${contextParts.join('\n')}`
        : `${inputText}\n\n[追问回复]\n${contextParts.join('\n')}`;
      await handleSubmitWithText(accumulatedText, true);
    }
  };

  /** 跳过当前轮 */
  const handleRoundSkip = () => {
    const field = missingFields[currentRound].field;
    const newAnswers = { ...roundAnswers, [field]: null };
    const newHistory = [...roundHistory, { field, answer: null }];
    setRoundAnswers(newAnswers);
    setRoundHistory(newHistory);

    if (currentRound < missingFields.length - 1) {
      setCurrentRound(currentRound + 1);
    } else {
      // 全部跳过 → 用现有数据提交
      const accumulatedText = originalInputText || inputText;
      handleSubmitWithText(accumulatedText, true);
    }
  };

  /** 返回上一轮 */
  const handleRoundBack = () => {
    if (currentRound > 0) {
      // 移除最后一轮的历史记录
      setRoundHistory(prev => prev.slice(0, -1));
      setCurrentRound(currentRound - 1);
    }
  };

  /** 跳过全部追问 */
  const handleSkipAllRounds = () => {
    setMissingFields([]);
    setCurrentRound(0);
    setDialogueComplete(true);
    setStatus('complete');
    setConversationHistory(p => [...p, {
      role: 'jeffrey' as const,
      content: '好的，信息已记录。如需补充随时告诉我。',
      timestamp: new Date().toLocaleString('zh-CN'),
    }]);
  };
```

- [ ] **Step 3: 在 JSX 渲染区域中添加分轮追问 UI**

找到现有的 Follow-up Question 渲染区块（约 L717-L784），在 `<Card>` 之前插入分轮追问渲染：

```tsx
          {/* Multi-round Follow-up (new) */}
          {status === 'pending' && missingFields.length > 0 && !dialogueComplete && (
            <>
              <RoundPrompt
                allFields={missingFields.map(f => ({
                  field: f.field,
                  priority: f.priority,
                  question: f.question,
                }))}
                currentIndex={currentRound}
                defaultValue={roundAnswers[missingFields[currentRound]?.field] || undefined}
                isLast={currentRound === missingFields.length - 1}
                showBack={currentRound > 0}
                onConfirm={handleRoundConfirm}
                onSkip={handleRoundSkip}
                onBack={handleRoundBack}
              />
              {persons.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <ExtractionPreview fields={getExtractedPreview()} />
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
                <button
                  onClick={handleSkipAllRounds}
                  disabled={isProcessing}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: C.textMuted,
                    fontSize: 12,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  全部跳过，稍后补充
                </button>
              </div>
            </>
          )}
```

- [ ] **Step 4: Typecheck 验证**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```

预期：如果 `RoundPrompt` 的 props 类型不匹配，可能有少量类型错误需要修复。检查并修复。

- [ ] **Step 5: Commit**

```bash
git add src/app/input/page.tsx
git commit -m "feat(input): render multi-round follow-up UI with RoundPrompt and ExtractionPreview

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 11: 清理和边界情况处理

**Files:**
- Modify: `src/app/input/page.tsx:391-396`（`handleClear` 函数）

- [ ] **Step 1: 更新 handleClear 清除分轮追问状态**

在 `handleClear` 中，`setConversationHistory([])` 之后，添加：

```typescript
    setMissingFields([]);
    setCurrentRound(0);
    setRoundAnswers({});
    setRoundHistory([]);
```

- [ ] **Step 2: 更新 ExtractionResponse 接口的 typecheck**

确保 `src/app/input/page.tsx` 中的 `ExtractionResponse` 接口包含 `missingFields`。

- [ ] **Step 3: 处理 pending 状态下的数据保存**

检查当前代码（约 L487-L504）：pending 状态下已在创建 Interaction 记录和 Person 记录。确保当用户通过分轮追问提交最终答案时，`createInteraction=true` 能正确触发完整数据保存。

- [ ] **Step 4: Full typecheck**

```bash
npx tsc --noEmit --pretty 2>&1
```

修复所有类型错误。

- [ ] **Step 5: Commit**

```bash
git add src/app/input/page.tsx
git commit -m "fix(input): clear multi-round state on reset, handle edge cases

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 12: 端到端验证

**Files:** 无新建，验证现有功能

- [ ] **Step 1: Build**

```bash
cd d:/Epstein.AI && taskkill //F //IM node.exe 2>/dev/null; npm run build 2>&1
```

预期：build 成功，无错误。

- [ ] **Step 2: Start and test**

```bash
npm start
```

然后用浏览器或 curl 测试：

```bash
# 测试 1: 模糊人名应触发 pending + missingFields
curl -s -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{"text":"我今天见了一个做区块链的技术大佬，跟他约了下周的咖啡，要继续谈谈收购他那家公司的事情。"}' \
  | node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.log('status:',j.status);console.log('missingFields:',JSON.stringify(j.missingFields,null,2));console.log('persons:',j.persons?.map(p=>p.name))})"

# 测试 2: 具体姓名应正常返回 complete
curl -s -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{"text":"今天跟王总在星巴克聊了AI创业，约了下周给他发BP。"}' \
  | node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.log('status:',j.status);console.log('persons:',j.persons?.map(p=>p.name))})"
```

预期：
- 测试 1: status = "pending", missingFields 至少包含 name
- 测试 2: status = "complete"（姓名具体、有 date、有 sentiment、有 actionItem）

- [ ] **Step 3: Commit (if any fixes)**

如果有任何修复，commit 它们。

```bash
git add -A
git commit -m "fix: e2e verification fixes for multi-round follow-up

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 13: 最终 Typecheck

- [ ] **Step 1: 运行完整 typecheck**

```bash
npx tsc --noEmit --pretty 2>&1
```

确保零错误。

- [ ] **Step 2: 检查 git status**

```bash
git status && git log --oneline -5
```

---

## 实现顺序

```
Task 1 (schema) → Task 2 (prompt) → Task 3 (validation) → Task 4 (POST handler)
                                                              ↓
Task 5 (StepIndicator) → Task 6 (ExtractionPreview) → Task 7 (RoundPrompt)
                                                              ↓
                  Task 8 (types) → Task 9 (logic) → Task 10 (render)
                                                              ↓
                                            Task 11 (cleanup) → Task 12 (e2e) → Task 13 (final check)
```

后端 Tasks 1-4 可以串行，前端 Tasks 5-7（组件创建）可以并行，Tasks 8-10 依赖前端组件完成。
