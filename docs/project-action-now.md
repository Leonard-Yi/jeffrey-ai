# 建议页 (`/suggestions`) 功能需求文档

**创建日期**: 2026-04-05
**文档性质**: 功能需求 + 技术实现计划
**状态**: 待开发

---

## 一、功能概述

建议页是 Jeffrey.AI 的"智能大脑"展示窗口，基于已有的社交数据主动为用户推荐行动。主要分为三大模块：

| 模块 | 触发条件 | Jeffrey 口吻示例 |
|------|----------|------------------|
| **关系维护提醒** | `lastContactDate` 超过 30 天 | "老王已经 47 天没联系了，先生。是感情淡了，还是在憋大招？" |
| **待办承诺提醒** | `actionItems.resolved=false, ownedBy=me` | "您有 3 笔社交债务未兑现，Jeffrey 都记着呢。" |
| **破冰助手** | 用户选中某人，LLM 生成开场白 | "下次见到他，可以聊聊他最近在研究 LLM 微调。" |

---

## 二、数据需求分析

### 2.1 现有数据结构

**Person 字段** (可用于推荐):
```typescript
{
  id, name,
  careers: [{name, weight}],      // 职业标签 (加权)
  interests: [{name, weight}],    // 兴趣标签 (加权)
  vibeTags: string[],             // 性格标签
  relationshipScore: 0-100,        // 关系评分
  lastContactDate: DateTime,      // 最近联系时间
  coreMemories: string[],         // 核心记忆 (关键！)
  introducedBy: Person | null,     // 介绍人
}
```

**Interaction 字段** (用于历史):
```typescript
{
  id, date, location, contextType,
  sentiment,                        // 互动情绪
  actionItems: [{
    description,                   // 承诺内容
    ownedBy: "me" | "them" | "both",
    resolved: boolean
  }],
  coreMemories: string[],          // 本次互动细节
}
```

### 2.2 需要新增的 API 端点

#### `GET /api/suggestions/reminders`
返回关系维护 + 待办提醒，**无需 LLM**，纯数据查询：

```typescript
Response {
  staleContacts: Array<{
    id: string;
    name: string;
    lastContactDate: string;      // 相对时间 "47天前"
    daysSinceContact: number;
    careers: string;              // 渲染后的职业
    relationshipScore: number;
    reason: string;               // "很久没联系了" / "关系评分较低"
  }>;

  pendingDebts: Array<{
    id: string;
    personId: string;
    personName: string;
    description: string;
    interactionDate: string;
    daysSinceCreated: number;
  }>;
}
```

**查询逻辑**:
- `staleContacts`: `lastContactDate < now - 30 days`，按 `daysSinceContact` 倒序
- `pendingDebts`: `actionItems.resolved=false AND ownedBy='me'`，按 `daysSinceCreated` 倒序

#### `GET /api/suggestions/icebreaker?personId=xxx`
调用 LLM 生成破冰开场白：

```typescript
// Request
{ personId: string }

// Response
{
  personName: string,
  openingLines: string[],         // 3-5 条可选开场白
  suggestedTopics: string[],      // 建议话题
  recentContext: string,          // "上次见面你们聊了《三体》结局"
  jeffreyComment: string;         // Jeffrey 风格的备注
}
```

---

## 三、页面布局设计

```
┌─────────────────────────────────────────────────────────────┐
│ Jeffrey.AI  │ 录入 │ 图谱 │ 人脉 │ 建议 │                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  "您的社交生活需要一点推动，先生。"                           │
│  — Jeffrey                                                  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🔔 关系维护提醒 (3)                    [查看全部 →] │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │ 👤 老王  ·  投行  ·  47天未联系  ·  💬 戳他 │   │   │
│  │  │    关系评分 75  ·  上次：星巴克喝咖啡        │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │ 👤 小李  ·  产品经理  ·  35天未联系  ·  💬 戳他│   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📋 待办承诺 (2)                      [查看全部 →] │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │ 🔴 我欠  ·  把《木工基础》链接发给老王  · 3天│   │   │
│  │  │ 🔴 我欠  ·  帮他介绍做CV的朋友        ·  7天│   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  💡 破冰助手                                        │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │ 选择联系人：  [🔍 搜索...]                  │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 四、LLM Prompt — 破冰助手

```markdown
你是 Jeffrey.AI 的破冰助手。你的任务是为一顿即将到来的社交准备个性化开场白。

## 用户信息

姓名：{personName}
职业标签：{careers}
兴趣标签：{interests}
性格标签：{vibeTags}
关系评分：{relationshipScore}/100
上次联系：{lastContactDate} ({daysAgo}天前)
核心记忆：{coreMemories}
介绍人：{introducedByName}

## 最近一次互动
时间：{interactionDate}
地点：{interactionLocation}
情绪：{sentiment}
承诺：{actionItems}

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
```

---

## 五、技术实现计划

### 5.1 文件变更

```
src/app/
├── api/suggestions/
│   ├── reminders/route.ts      # GET 提醒数据
│   └── icebreaker/route.ts     # GET LLM 生成开场白
├── suggestions/
│   ├── page.tsx               # 主页面
│   └── layout.tsx             # 布局
└── components/
    └── SuggestionCard.tsx     # 通用卡片组件
```

### 5.2 核心逻辑

**reminders/route.ts — 数据查询**:
```typescript
// 关系维护提醒
const staleContacts = await prisma.person.findMany({
  where: {
    lastContactDate: { lt: subDays(new Date(), 30) }
  },
  orderBy: { lastContactDate: 'asc' },
  take: 10,
  include: { interactions: { include: { interaction: true } } }
});

// 待办提醒
const pendingDebts = await prisma.interaction.findMany({
  where: {
    actionItems: { isEmpty: false }
  },
  include: {
    persons: { include: { person: { select: { id: true, name: true } } } }
  }
});
// 过滤 resolved=false AND ownedBy='me'
```

**icebreaker/route.ts — LLM 调用**:
```typescript
// 构建上下文
const person = await prisma.person.findUnique({ ... });
const lastInteraction = await prisma.interaction.findFirst({
  where: { persons: { some: { personId: personId } } },
  orderBy: { date: 'desc' }
});

// 调用 LLM
const response = await openai.chat.completions.create({
  model: "qwen3.5-plus",
  messages: [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserContext(person, lastInteraction) }
  ],
  temperature: 0.7
});

// 返回 structured response
```

---

## 六、验收标准

| 场景 | 预期结果 |
|------|----------|
| 首次访问 `/suggestions` | 显示 3 个模块（维护提醒/待办/破冰助手） |
| 有超过 30 天未联系的人 | 显示在"关系维护提醒"列表 |
| 有 `ownedBy=me` 的未完成事项 | 显示在"待办承诺"列表 |
| 选择一个联系人 | 调用 LLM，返回 3 条开场白 + 话题建议 |
| 点击"戳他" | 跳转 `/input` 页面，预填联系人和备忘 |
| 无数据时 | 显示友好占位文案 |

---

## 七、Jeffrey 风格文案参考

### 关系维护提醒
```
"老王已经 47 天没联系了，先生。是感情淡了，还是在憋大招？"
"小李的关系评分只有 45 分，再不维护就要降级了。"
"您似乎对张总有些懈怠，他的木工课学得怎么样了？"
```

### 待办承诺
```
"您有 3 笔社交债务未兑现，Jeffrey 都记着呢。"
"那本《木工基础》的链接还欠着呢，先生。"
"介绍 CV 朋友的事拖了 7 天了，再不兑现老王要急了。"
```

### 破冰助手
```
"你们上次聊了《三体》结局，可以从这儿自然切入。"
"他对投行似乎有点倦怠，聊点别的可能更顺畅。"
"上次见面氛围不错，这次可以深入聊聊他的 LLM 研究。"
```

---

**项目口号**: "了解，先生。" — Jeffrey
