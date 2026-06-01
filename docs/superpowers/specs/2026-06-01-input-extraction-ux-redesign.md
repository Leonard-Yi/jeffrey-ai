# 录入→分析→追问 用户体验闭环重设计

**日期**: 2026-06-01
**状态**: 已批准，待实现
**原型文件**: `.superpowers/brainstorm/802-1780308221/content/strategy-b-full.html`

---

## 1. 问题诊断

用户输入："我今天见了一个做区块链的技术大佬，跟他约了下周的咖啡，要继续谈谈收购他那家公司的事情。"

**五层断裂**：

| 层 | 位置 | 问题 |
|---|---|---|
| 1 | `SYSTEM_PROMPT` (L113) | 明确指示 LLM "没有名字就用'某人'"，但未要求在产出"某人"时设 pending |
| 2 | `describeCompleteness()` (L87-101) | 只检查 careers/sentiment/actionItems/date，不检查 name 质量 |
| 3 | `pseudonymizer.ts` | jieba NER 只标注专有名词(nr tag)，"某人"/泛指不会被检测 |
| 4 | 追问回路 | completeness check 通过(status=complete)，追问根本不触发 |
| 5 | `input/page.tsx` | 前端静默展示"某人"，无任何警告或高亮 |

**根因**：整个系统把"名字质量"当作不存在的问题。LLM 忠实执行了 fallback 指令，但没有任何下游机制来修正它。

---

## 2. 设计目标

1. 用户录入文本后，系统检测**所有**模糊或缺失的字段
2. 按优先级分轮追问（人名 > 公司名 > 地点 > 其他）
3. 每轮展示：步骤指示器 + 已确认字段 + 当前问题
4. 支持返回修改和跳过
5. 最终结果清晰展示"已保存了什么"

---

## 3. 架构概览

```
用户输入文本
  → POST /api/analyze
    → 假名化（现有）
    → LLM 提取（改进 prompt）
    → Zod 校验（现有）
    → 服务端质量校验（新增）
      ├── name 黑名单匹配（"某人"、"那个人"、"一个XX的YY"等）
      ├── NER 一致性检查（原文是否有对应的专有名词）
      └── 缺失字段检测（所有关键字段）
    → 返回 ExtractionPayload + missingFields[]
  → 前端接收
    ├── status=complete → 直接展示最终结果
    └── status=pending → 进入分轮追问
      ├── Round 1: 人名（关键）
      ├── Round 2: 公司名（重要）
      ├── Round 3: 地点（补充）
      └── ... 后续轮次按需
        → 每轮可返回修改 / 跳过
        → 最终 POST /api/analyze（附带累计上下文）
          → 保存完整数据
```

---

## 4. 改动范围

### 4.1 System Prompt（`src/app/api/analyze/route.ts`）

**新增规则**：

```
### 模糊指代检测（新增）

当人物姓名出现以下情况时，status 必须设为 "pending"：
- 使用"某人"、"那个人"、"这位大佬"等泛指
- 使用描述性短语代替姓名（如"一个做区块链的"、"一个投资人"）
- 只使用了代词（"他"、"她"）而无具体称呼

### 字段完备性判断（修订）

status = "complete" 必须同时满足：
1. 所有人物拥有具体可指代的姓名（不是泛指或"某人"）
2. 至少一位人物拥有 career 标签
3. sentiment 非空
4. actionItems 非空
5. date 非空

### 缺失字段报告（新增）

当 status = "pending" 时，在 missingFields 数组中列出所有缺失/模糊的字段：
- 每个字段包含：field（字段名）、priority（"high"|"mid"|"low"）、question（追问文案）
- 按 priority 排序：high → mid → low
- question 要自然口语化，提及上下文信息
```

### 4.2 Zod Schema 扩展

```typescript
const MissingFieldSchema = z.object({
  field: z.enum(["name", "company", "location", "career", "sentiment", "actionItems", "date"]),
  priority: z.enum(["high", "mid", "low"]),
  question: z.string().min(1),
});

// 加入 ExtractionPayloadSchema
missingFields: z.array(MissingFieldSchema).optional().default([]),
```

### 4.3 服务端质量校验（新增函数）

```typescript
const NAME_BLACKLIST = [
  /^某人$/, /^那个人$/, /^这位(.{1,4})$/, /^那位(.{1,4})$/,
  /^一个.{0,10}的$/, /^某个(.{1,4})$/,
  /^他$/, /^她$/, /^这个(人|家伙|哥们|朋友)$/,
];

function isNameVague(name: string): boolean {
  return NAME_BLACKLIST.some(pattern => pattern.test(name));
}

// 增强版完备性检查
function validateExtractionQuality(
  data: ExtractionPayload,
  originalText: string,
  nerEntities: Entity[]
): { valid: boolean; missingFields: MissingField[] } {
  // 1. 检查人名质量
  // 2. 检查 NER 一致性（原文中有实体但 LLM 没提取到？）
  // 3. 检查所有字段完备性
  // 返回缺失字段列表，按 priority 排序
}
```

### 4.4 前端改动（`src/app/input/page.tsx`）

**新增组件**：
- `StepIndicator` — 步骤指示器（①→②→③），当前活跃项脉冲动画
- `RoundPrompt` — 单轮追问卡片，包含：优先级标签、问题文案、输入框、返回/跳过/确认按钮
- `ExtractionPreview` — 已提取字段预览区

**状态管理**：
```typescript
interface FollowUpState {
  currentRound: number;
  missingFields: MissingField[];
  answers: Record<string, string | null>;
  roundHistory: Array<{ field: string; answer: string | null }>;
}
```

**交互逻辑**：
1. API 返回 status=pending + missingFields → 进入分轮模式
2. 每轮展示 stepIndicator + 当前问题
3. 确认 → 保存答案，进入下一轮
4. 返回 → 回到上一轮，保留之前填写的值
5. 跳过 → 答案记为 null，进入下一轮
6. 最后一轮完成 → 发送累计上下文给 API → 保存 → 展示最终结果

### 4.5 API 上下文累积

多轮追问中，每次提交时将**完整对话上下文**发给 `/api/analyze`：

```
原始文本: "..."
追问回复:
  Q1 (人名): "王总"
  Q2 (公司名): (跳过)
  Q3 (地点): "线上会议"
```

LLM 据此重新提取完整的 ExtractionPayload。

---

## 5. UI 设计规范

- 配色沿用现有 design tokens (`src/lib/design-tokens.ts`)，不做全局改动
- 步骤指示器：`var(--primary)` 高亮当前步骤，`var(--success)` 标记已完成
- 优先级标签：high=红色(error) / mid=金色(warning) / low=灰色(text-muted)
- 追问卡片：`border-accent` 金色边框，轻微渐变背景
- 动画：`fadeInUp` 0.45s cubic-bezier，逐项 stagger 0.07s
- 当前步骤脉冲动画：`box-shadow` 1.8s ease-in-out infinite
- 返回按钮仅在第一轮之后显示

---

## 6. 不做的事（本期）

- 历史录入的批量修复 — 不影响已有数据
- 语音录入的追问 — 现有语音走同一 `/api/analyze` 端点，文本路径修好后自动受益

---

## 7. 验收标准

1. 输入"我今天见了一个做区块链的技术大佬..." → LLM 返回 status=pending，missingFields 包含 name
2. 输入"今天跟老王在星巴克聊了AI创业" → status=complete（名字具体）
3. 分轮追问中，跳过人名 → 最终结果显示"某人（待补充）"
4. 返回修改 → 上一轮的输入值被保留
5. 服务端黑名单触发：name="某人" 即使 LLM 标记 complete 也强制 pending
6. 所有现有测试通过（`npm run test:extract`, `npm run test:pipeline`）
