# Jeffrey.AI 项目定义

**创建日期**: 2026-03-31
**最后更新**: 2026-04-04
**文档性质**: 项目高层定义 — 稳定、少变动
**阅读场景**: 理解项目愿景、架构决策、核心设计

---

## 一、项目愿景

**Jeffrey.AI** 是一个 AI 驱动的"第二大脑"社交管理系统。

### 核心价值
从非结构化的中文社交记录中自动提取结构化的人际关系数据，构建可查询、可可视化的社交知识图谱。

### 要解决的问题
| 问题 | 现状 | Jeffrey 的方案 |
|------|------|----------------|
| 社交数据碎片化 | 记录散落在微信、日程、笔记中 | 统一入口，AI 自动结构化 |
| 人脉管理低效 | 难以追踪关系、共同点、承诺 | 图谱可视化 + 社交债务追踪 |
| 信息检索困难 | 无法回答"我认识哪些做 X 的人" | 语义搜索 + 标签聚类 |

### 产品定位
- **中文优先** — prompt、测试数据、标签均为中文
- **LLM 驱动** — Qwen3.5-plus 理解非结构化文本
- **互动为核心** — 以 Interaction 为基本记录单元
- **量化关系** — 0-100 分关系强度 + 加权标签
- **人格化 AI** — "Jeffrey"黑色幽默管家风格
- **多元视图** — 图谱 (直观) + 表格 (高效) 双模式

---

## 二、系统架构

### 数据流

```
用户输入 (中文社交流水账)
       │
       ▼
┌──────────────────┐
│  LLM 提取层       │  Qwen3.5-plus + Tool Calling
│  llmExtractor.ts │  Zod Schema 验证 + 完备性检查
└────────┬─────────┘
         │ ExtractionPayload
         ▼
┌──────────────────┐
│  数据持久化层     │  Prisma ORM
│  dbService.ts    │  标签权重合并 (recency bias 0.3)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  PostgreSQL 15   │  Docker 容器
│  (知识图谱)      │  4 个核心表
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  图数据服务       │  多类型关系边计算
│  graphService.ts │  7 种连接类型 + 过滤器
└────────┬─────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│                    Next.js API 层                        │
├─────────────────────────────────────────────────────────┤
│  POST /api/analyze    │  GET /api/graph                │
│  文本 → 结构化提取     │  图谱数据 (节点+边)             │
├─────────────────────────────────────────────────────────┤
│  GET /api/members/table  │  GET/PATCH /api/members/:id │
│  表格数据 (排序/筛选)    │  单人详情 / 编辑              │
├─────────────────────────────────────────────────────────┤
│  GET /api/debug        │                                │
│  调试数据               │                                │
└─────────────────────────────────────────────────────────┘
```

### 前端页面矩阵

| 页面 | 路由 | 用途 | 核心组件 |
|------|------|------|----------|
| 录入页 | `/input` | 文本/语音输入 → AI 提取 | 追问闭环、Jeffrey 评论 |
| 图谱页 | `/graph` | 关系网络可视化 | react-force-graph-2d |
| 人脉表 | `/members` | 结构化列表浏览 | 动态表格 + PersonModal |
| 详情弹窗 | — | 人物完整档案 + 编辑 | PersonModal (复用) |

### 技术栈

| 层次 | 技术选型 |
|------|----------|
| 框架 | Next.js 16 + React 19 |
| 语言 | TypeScript 5.4+ |
| 数据库 | PostgreSQL 15 (Prisma 7.6 ORM) |
| LLM | Qwen3.5-plus (阿里百炼) |
| 可视化 | react-force-graph-2d |
| 验证 | Zod + zod-to-json-schema |
| 部署 | Vercel (前端) + Railway/Render (数据库) |

---

## 三、核心数据模型

### 实体关系图

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│   Person    │◄────────│ InteractionPerson│─────────►│ Interaction │
│  (人脉节点)  │         │   (连接表)        │         │  (社交事件)  │
├─────────────┤         ├──────────────────┤         ├─────────────┤
│ id          │         │ personId    (PK) │         │ id          │
│ name        │         │ interactionId(PK)│         │ date        │
│ careers[]   │◄───────►│                  │◄────────│ location    │
│ interests[] │         │                  │         │ contextType │
│ vibeTags[]  │         └──────────────────┘         │ sentiment   │
│ relationshipScore   │                              │ actionItems │
│ lastContactDate     │         ┌──────────────┐    │ coreMemories│
│ introducedById ─────┼────────►│   PersonTag  │    └─────────────┘
└─────────────────────┘         │  (扁平索引)  │
                                └──────────────┘
```

### 模型关键字段

**Person** — 人脉节点
| 字段 | 类型 | 说明 |
|------|------|------|
| careers | `[{name, weight}]` | 加权职业标签 |
| interests | `[{name, weight}]` | 加权兴趣标签 |
| vibeTags | `string[]` | 性格/氛围标签 |
| relationshipScore | `float 0-100` | 关系强度分 |
| baseCities | `string[]` | 所在城市 |

**Interaction** — 社交事件
| 字段 | 类型 | 说明 |
|------|------|------|
| contextType | `string` | "咖啡"、"饭局"、"微信语音" |
| sentiment | `string` | "轻松愉快"、"高能量" |
| actionItems | `[{desc, ownedBy, resolved}]` | 社交债务 |
| coreMemories | `string[]` | 亲历者才知道的细节 |

---

## 四、核心算法

### 1. 标签权重合并

当同一个人重复出现时，标签权重按以下规则合并：

```
new_weight = prev_weight × 0.7 + incoming_weight × 0.3
```

- **RECENCY_BIAS = 0.3** — 新观察的权重占比
- 可调节此常数控制历史信号衰减速度

### 2. 关系强度更新

```
newScore = min(100, existing.relationshipScore + 2)
```
- 每次新互动 +2 分，上限 100

### 3. 图关系边类型

| 边类型 | 触发条件 | 强度计算 |
|--------|----------|----------|
| interaction | 共同参与互动 | 基础 0.5，多次叠加 |
| introducedBy | 介绍人关系 | 0.8 |
| sharedCareer | 共同职业标签 | 0.6 × 平均权重 |
| sharedCity | 共同城市 | 0.4 |
| sharedInterest | 共同兴趣 | 0.3 × 数量 |
| sharedPlace | 共同地点 | 0.2 |
| sharedVibe | 共同性格标签 | 0.2 × 数量 |

---

## 五、关键设计决策

| 决策 | 理由 | 实现方式 |
|------|------|----------|
| **中文优先** | 目标用户是中文使用者 | prompt、测试数据、vibe 标签均为中文 |
| **Tool Calling** | LLM 生成结构化数据的最可靠方式 | Qwen + OpenAI SDK 兼容模式 |
| **Zod 双用途** | 减少 schema 维护成本 | 运行时验证 + JSON Schema 生成 |
| **加权标签** | 区分"核心身份"和"顺带一提" | `[{name, weight}]` 而非 `string[]` |
| **完备性双重检查** | 防止 LLM 漏字段 | LLM 判断 + 确定性规则验证 |
| **pending 状态** | 信息不完整时不脏写 | 生成自然语言追问 |
| **测试隔离** | 避免污染真实数据 | `__test__` 前缀 + 自动清理 |
| **图谱+表格双视图** | 图谱直观、表格高效，互补 | react-force-graph + 动态表格 |
| **Schema 驱动表格** | 列定义与渲染逻辑解耦 | `schemaReader.ts` 中 `PERSON_COLUMNS` |
| **复用 PersonModal** | 避免重复：表格行点击 + 图谱节点点击共用 | `PersonModal.tsx` 组件 |

---

## 六、项目结构

```
d:\Epstein.AI\
│
├── docs/
│   ├── project-definition.md       # 本文档 — 项目定义 (稳定)
│   └── project-progress.md         # 进展记录 (频繁更新)
│
├── prisma/
│   └── schema.prisma               # 数据库模型定义
│
├── src/
│   ├── schemas/
│   │   └── core.ts                 # Zod Schema
│   ├── services/
│   │   ├── llmExtractor.ts         # LLM 提取服务
│   │   └── dbService.ts            # 数据持久化
│   ├── lib/
│   │   ├── graphService.ts         # 图数据转换
│   │   └── schemaReader.ts         # 表格列定义 + 渲染辅助
│   ├── components/
│   │   └── PersonModal.tsx         # 可复用人物详情弹窗
│   └── app/
│       ├── input/page.tsx          # 录入页面
│       ├── graph/page.tsx          # 图谱页面
│       ├── members/
│       │   ├── page.tsx            # 人脉表格页面
│       │   └── layout.tsx          # 表格页面布局
│       └── api/
│           ├── analyze/route.ts    # POST 分析接口
│           ├── graph/route.ts      # GET 图谱接口
│           ├── members/
│           │   ├── table/route.ts  # GET 表格数据
│           │   └── [id]/route.ts   # GET/PATCH 单人详情
│           └── debug/route.ts      # GET 调试数据
│
├── src/test/
│   ├── testExtractor.ts            # LLM 单元测试
│   └── fullPipelineTest.ts         # 端到端测试
│
├── docker-compose.yml              # PostgreSQL 容器编排
├── package.json
└── CLAUDE.md                       # 开发指南
```

---

## 七、相关文档

- **[project-progress.md](./project-progress.md)** — 当前开发进度、下一步行动、会话续接指南
- **[CLAUDE.md](../CLAUDE.md)** — 开发命令、环境配置、测试指南

---

## 八、架构演进思考

### 当前架构评估

**已完成的部分**:
- ✅ 数据模型层 (4 表 + 索引)
- ✅ LLM 提取管道 (Qwen → Zod → DB)
- ✅ 图谱视图 (force-graph)
- ✅ 表格视图 (动态列 + 排序 + 筛选)
- ✅ 人物详情弹窗 (复用设计)
- ✅ 追问交互闭环

**待完善的部分**:
- ❌ 建议/推荐页
- ❌ 语义搜索
- ❌ 待办提醒系统
- ❌ 用户认证

### 架构扩展方向

#### 方向 A: 智能推荐引擎
```
现有数据 → 推荐服务 → "该联系老王了" / "你们有共同话题：投行"
```
- 利用 `coreMemories` + `lastContactDate`
- LLM 生成个性化开场白
- 基于共同标签的"人脉发现"

#### 方向 B: 数据导入
```
微信聊天记录 → 预处理 → 分段输入 → 批量提取 → 入库
```
- 文本分割策略 (按天/按人)
- 进度展示
- 去重逻辑

#### 方向 C: 多用户支持
```
User 表 → Person.userId 外键 → 数据隔离
```
- 认证方案选择 (NextAuth / Clerk / 自建)
- 每个用户独立的社交图谱

---

**项目口号**: "了解，先生。" — Jeffrey
