# Jeffrey.AI 前端重设计 PRD

## Problem Statement

Jeffrey.AI 的现有前端存在以下问题：

1. **设计语言不一致** — Landing page、Auth pages、业务页面各用各的样式系统，部分页面用 CSS 变量、部分用 Tailwind、部分 inline styles
2. **视觉风格不鲜明** — 现有"暖色编辑风"偏平淡，缺乏品牌个性，无法体现 Jeffrey "黑色幽默管家"的人设
3. **文案生硬** — Jeffrey 的语言像英文直译，三流角色感强，不够自然和贴合情境
4. **交互体验单调** — 页面缺少动画、微交互和视觉反馈，Jeffrey 的语音输出仅为文字
5. **无品牌吉祥物** — 缺少视觉锚点，用户对 Jeffrey 品牌的记忆点不够强

## Evidence

- `globals.css` 和 `design-tokens.ts` 中同时存在两套色彩系统（light mode 的 cream/amber 和 dark academia 的 walnut/bronze）
- Auth 页面混用 Tailwind (`className`) 和 CSS 变量
- 各页面自定义 Card/Button 实现，无统一组件
- `jeffrey-quotes.ts` 文案示例：`"您的社交生活需要一点推动，先生。"` — 明显翻译腔

## Proposed Solution

全面重构 Jeffrey.AI 前端，采用 **Dark Academia Premium** 风格，建立统一的 Design System，并新增 TTS 语音输出和品牌吉祥物。

## Key Hypothesis

We believe a **dark premium aesthetic + expressive mascot + voice output** will make Jeffrey.AI feel like a refined, memorable product that users genuinely enjoy interacting with — not just a utility. We'll know we're right when users describe Jeffrey as "那个下巴很性感的 AI" rather than just "一个人脉管理工具"。

## What We're NOT Building

- 不改变核心功能逻辑（录入/图谱/人脉表/建议）
- 不做响应式移动端适配（当前仅桌面端）
- 不迁移到其他框架（Next.js + React 保持不变）

---

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Design token 覆盖率 | ≥90% 的页面组件使用 `design-tokens.ts` | 代码审查 |
| Build type check | 0 TypeScript errors | `npm run build` |
| 文案用户满意度 | 用户能用自然语言描述 Jeffrey 的性格 | 访谈/反馈 |

## Open Questions

- [ ] MiniMax TTS API 的具体 endpoint 和鉴权方式尚未确认
- [ ] 吉祥物的 SVG/动画实现方案待定（纯 SVG vs Lottie vs CSS animation）
- [ ] TTS 流式输出的前端音频播放方案待定（Web Audio API vs HTMLAudioElement）

---

## Users & Context

**Primary User**
- **Who**: 中国一线城市 25-40 岁专业人士，有大量社交需求但记忆力有限
- **Current behavior**: 用微信备注、Excel、或脑子记人际关系，混乱且易忘
- **Trigger**: 刚见完一个人，想记录；或者突然想起"上次见那人是什么时候来着"
- **Success state**: 录入 → AI 整理 → 随时可查可用

**Job to Be Done**
When 我刚见完一个人，我希望 用自然语言随手记录，我希望 so Jeffrey 自动帮我结构化整理，我就能 随时查询、不会忘记任何重要的人和信息。

**Non-Users**
- 技术背景强的用户（可能觉得 AI 提取不够精准）
- 不习惯语音/对话式交互的用户
- 对中文社交数据上云有隐私顾虑的用户

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | Dark Academia Design System | 统一所有页面的视觉语言 |
| Must | Shared UI Component Library | Card, Button, Input, Badge, Tag, Avatar, SectionLabel |
| Must | Jeffrey Voice Rewrite | 自然、洞察、有点干，不是三流角色 |
| Must | Landing Page Redesign | 第一印象决定用户留存 |
| Must | Auth Pages Redesign | 注册登录体验也是品牌一部分 |
| Should | Header Component Redesign | 全局导航，体验一致 |
| Should | Input Page Redesign | 核心交互页面，Jeffrey 出镜率最高 |
| Should | Members/Graph/Suggestions Pages Redesign | 业务页面风格统一 |
| Should | MiniMax TTS Streaming | 语音输出，提升交互沉浸感 |
| Could | Jeffrey Mascot (Vault-style chin) | 视觉吉祥物，品牌记忆点 |
| Won't | PersonModal Redesign | 已有的 modal，可后续优化 |

### MVP Scope

Phase 1 仅包含：Design System + Shared Components + Landing + Auth + Header + Jeffrey Voice Rewrite。验证视觉风格和文案方向正确后，再推进 TTS 和吉祥物。

### User Flow

**Landing → 注册/登录 → Input 录入 → 查看 Members/Graph → 接受 Suggestions 提醒**

Critical path: Landing → Auth → Input（最短路径到价值）

---

## Technical Approach

**Feasibility**: HIGH — 纯前端改动，不涉及 API 变更

**Architecture Notes**
- 所有 design tokens 集中在 `src/lib/design-tokens.ts`，导出 `tokens` 和 `C` 别名
- 所有 UI 组件集中在 `src/components/ui/`，统一导出 `index.ts`
- Global CSS 在 `src/app/globals.css`，定义 CSS 变量和基础 class
- `jeffrey-quotes.ts` 作为单一文案来源，`ui.copy` 对象提供所有 UI 文本

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| 切换到深色主题后部分页面仍用亮色背景 | 中 | 代码审查 + Design Token 强制覆盖 |
| TTS API 延迟影响体验 | 低 | 流式输出 + UI 先展示文字 |
| 吉祥物动画导致性能问题 | 低 | 使用 CSS animation 而非 JS 动画 |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP |
|---|-------|-------------|--------|----------|---------|-----|
| 1 | Design System Foundation | tokens.ts + globals.css + UI components | **Done** | - | - | - |
| 2 | Landing + Auth Pages | Landing page + SignIn/SignUp redesign | **Done** | - | 1 | - |
| 3 | Header + Input Page | Header redesign + Input page redesign | pending | - | 1 | - |
| 4 | Business Pages | Members + Graph + Suggestions redesign | pending | - | 3 | - |
| 5 | MiniMax TTS Integration | Streaming TTS for Jeffrey speech | pending | - | 2 | - |
| 6 | Jeffrey Mascot | Vault-style chin avatar with expressions + TTS sync | pending | with 5 | 2 | - |

### Phase Details

**Phase 1: Design System Foundation**
- Goal: 建立统一的设计语言基础
- Scope: tokens.ts, globals.css, UI component library (Card, Button, Input, Badge, Tag, Avatar, SectionLabel)
- Success signal: `npm run build` 无 TypeScript errors，所有新组件可正常渲染

**Phase 2: Landing + Auth Pages**
- Goal: 用户第一眼和注册登录体验
- Scope: Landing page, SignInForm, SignUpForm, AuthCard
- Success signal: 页面视觉风格统一，深色主题，文案自然

**Phase 3: Header + Input Page**
- Goal: 全局导航和核心录入体验
- Scope: Header component, Input page
- Success signal: Header 在所有页面保持一致，Input 页面 Jeffrey 文案自然不生硬

**Phase 4: Business Pages**
- Goal: 人脉/图谱/建议页面风格统一
- Scope: Members page, Graph page, Suggestions page, PersonModal
- Success signal: 所有业务页面使用 Dark Academia 风格，Design tokens 覆盖率 ≥90%

**Phase 5: MiniMax TTS Integration**
- Goal: Jeffrey 语音流式输出
- Scope: TTS API service, streaming audio playback, UI trigger on Jeffrey speech display
- Success signal: 用户点击播放按钮，Jeffrey 的文字以语音形式流式输出

**Phase 6: Jeffrey Mascot**
- Goal: Vault-style 吉祥物，品牌视觉锚点
- Scope: Chin avatar SVG component, expression states, TTS sync animation
- Success signal: 吉祥物在 Input/Suggestions 页面显示，TTS 播放时伴随口型/动作动画

---

## Dark Academia Design System

### Color Palette

```
Background:
  bg:         #141210   (Deep walnut black)
  bgElevated: #1c1917   (Elevated surface)
  bgCard:     #231f1b   (Card/surface)
  bgHover:    #2a2520   (Hover state)
  bgActive:   #332c26   (Active/selected)

Text:
  text:         #f5f0e8  (Warm ivory)
  textSecondary: #a8a29e (Muted stone)
  textMuted:    #78716c  (Subtle)

Brand:
  primary:     #c9956a   (Antique bronze)
  primaryHover: #d4a87a (Bronze highlight)
  accent:      #e8b86d  (Warm gold)

Borders:
  border:       #2e2925
  borderStrong: #3d3530
  borderAccent: rgba(201, 149, 106, 0.3)
```

### Typography

```
Display: 'Cormorant Garamond', Georgia, serif
Body:    'DM Sans', system sans-serif
Mono:    'JetBrains Mono', monospace
```

### Component Token Mapping

| Old Token | New Token |
|-----------|-----------|
| `C.surface` | `C.bgCard` |
| `C.surfaceAlt` | `C.bgHover` |
| `C.primary` | `C.primary` (unchanged) |
| `C.accent` | `C.accent` (unchanged) |
| `C.text` | `C.text` (unchanged) |

---

## Jeffrey Voice Guidelines

### Voice Principles
- **Natural Chinese** — 不是翻译腔，像受过教育的中国人说话
- **Observant** — 对人际关系有洞察，不说废话
- **Dry wit** — 黑色幽默但不刻薄，有品位
- **Warm underneath** — 底层是关心的，不是冷漠的
- **Concise** — 简短有力，不啰嗦
- **Varied** — 不同情境下语气不同：有时温和、有时调侃、从不刻薄

### Tone by Context

| Context | Tone | Example |
|---------|------|---------|
| Input greeting | Casual nudge | "今天见了谁？" |
| Idle reminder | Gently teasing | "你上次提到的那个人，最近有联系吗？" |
| Analysis result | Insightful, brief | "关系热度上升了，但上次承诺的事还没兑现。" |
| Follow-up question | Genuinely curious | "他做哪个方向的？" |
| Error | Direct, not harsh | "这步走不通，换个方式试试。" |
| Empty state | Warm, encouraging | "还没有记录。从今天的第一杯咖啡开始吧。" |

### Taboo (避免)
- ❌ "先生"（翻译腔）
- ❌ "您的..."（过于正式）
- ❌ "我洗耳恭听"（翻译腔 + 过于被动）
- ❌ "别担心"（居高临下感）

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| 设计风格 | Dark Academia Premium | Light editorial, Brutalist, Retro | 更符合 Jeffrey 管家人设，差异化强 |
| 色彩方案 | Walnut + Bronze + Ivory | Blue + Gray, Purple + Gold | 温暖不冰冷，有品质感 |
| 字体 | Cormorant Garamond (display) + DM Sans (body) | Space Grotesk, Inter | Garamond 有文化感，DM Sans 现代可读 |
| 组件架构 | 集中 design tokens + 共享组件 | 各页面独立实现 | 确保一致性，减少重复代码 |
| 文案语调 | 自然、洞察、有点干 | 俏皮、正式、卖萌 | 符合"有品位管家"定位 |
| TTS 方案 | MiniMax 流式 TTS | 预录音 + HTMLAudioElement | 流式延迟低，MiniMax 中文效果好 |
| 吉祥物方案 | SVG CSS 动画下巴 | Lottie, GIF, Three.js | 轻量、可交互、风格匹配 |

---

## MiniMax TTS Integration Plan

### API Details (TBD - needs confirmation)
- **Endpoint**: `POST /v1/t2a/turbo` (text-to-audio)
- **Model**: `speech-02-hd` (or `speech-02`)
- **Stream**: 支持流式输出（SSE）
- **Auth**: API Key in header

### Implementation Approach
1. 创建 `src/services/tts.ts` — MiniMax TTS client
2. 使用 `fetch` + `ReadableStream` 实现流式播放
3. 在 `jeffrey-quotes.ts` 或 `ui.copy` 中定义各场景对应的 TTS text
4. 在 Input/Suggestions 页面添加播放按钮（Jeffrey 说话时触发）

### Audio Playback
- 使用 Web Audio API 播放流式音频
- 支持中断（用户新输入时停止当前播放）

---

## Jeffrey Mascot Design Spec

### Concept
**Vault-style 下巴吉祥物** — 以 Jeffery 下巴为核心视觉元素，风格借鉴 Fallout Vault Boy，但更简洁现代。

### Visual Elements
- 标志性元素：性感的下巴轮廓 + 侧脸剪影
- 表情状态：`idle`, `speaking`, `thinking`, `smiling`, `warning`
- 风格：单色线条画（antique bronze 色），背景透明
- 尺寸：40px（header avatar）/ 80px（input page）/ 200px（landing hero）

### Animation States
| State | Animation | Trigger |
|-------|-----------|---------|
| idle | 微弱的呼吸动画（scale 0.98-1.02） | 页面加载完成 |
| speaking | 口型开合 + 轻微左右摇头 | TTS 播放中 |
| thinking | 轻微上下点头 | AI 处理中 |
| smiling | 嘴角上扬 | 用户操作成功 |
| warning | 轻微颤抖 | 社交债务提醒 |

### TTS Sync
- TTS 流开始 → mascot 进入 `speaking` 状态
- TTS 流结束 → mascot 返回 `idle` 状态
- 口型动画频率与语速匹配

---

## Research Summary

**Market Context**
- 人脉管理工具市场已有不少产品（脉脉、LinkedIn、Notion CRM），但普遍偏工具感
- AI + 人脉的结合产品少，已有的多侧重求职/招聘场景
- 中文语境下的"黑色幽默管家"定位在市场上属于空白

**Technical Context**
- Next.js 16 + Turbopack 构建系统正常
- TypeScript strict mode 已启用
- Design tokens 集中管理方案可行
- MiniMax TTS API 尚未集成，需确认 endpoint

---

*Generated: 2026-04-20*
*Status: DRAFT - needs validation*
