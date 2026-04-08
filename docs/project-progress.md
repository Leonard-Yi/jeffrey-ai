# Jeffrey.AI 项目开发记录

**最后更新**: 2026-04-08
**项目状态**: 破冰助手功能完成（风格选择 + 预生成）
**会话 ID**: 008 (破冰助手：风格选择 + 预生成 + 一键批量)

---

## 一、项目愿景

**Jeffrey.AI** 是一个 AI 驱动的中文人脉管理系统，具有以下特点：

1. **自然人机交互** — 用户用中文描述社交互动，AI 自动提取结构化数据
2. **关系图谱可视化** — 将人脉网络以图的形式展示，支持多维度过滤
3. **社交债务追踪** — 记录互动中产生的承诺和待办事项
4. **Jeffrey 人格** — 带黑色幽默风格的 AI 助手人格，提供有态度的反馈

---

## 二、完整开发历程与技术细节

### 阶段 1: 核心数据结构定义 (Schema Design)

**目标**: 定义兼顾"多值标签灵活性"和"查询效率"的数据结构

**关键决策**:

1. **WeightedTag 设计** - 使用 `{ name: string, weight: number }` 而非单纯的 `string[]`
   - `weight` 范围 0.0-1.0，契合 LLM 置信度输出，省去归一化步骤
   - 体现"主业与副业"的侧重差异（如：投行 0.9 vs 木工 0.1）

2. **三维度实体划分**:
   - `careers`: 职业/专业技能 (WeightedTag[]) - 定量，有权重
   - `interests`: 兴趣/爱好 (WeightedTag[]) - 定量，有权重
   - `vibeTags`: 性格/氛围标签 (string[]) - 定性，不强行量化

3. **关系热度设计**:
   - `relationshipScore`: 0-100 动态数值，每次互动递增
   - `lastContactDate`: 追踪最后互动时间

**产出文件**:
- `src/schemas/core.ts` - Zod Schema + TypeScript 类型定义
- `src/schemas/mock.ts` - Mock 数据（老王案例）

---

### 阶段 2: LLM 提取引擎实现

**技术栈**:
- 阿里云百炼 (Bailian) API
- 兼容 OpenAI 接口协议
- 模型：qwen3.5-plus

**核心实现细节**:

1. **Client 初始化** (`src/services/llmExtractor.ts`):
```typescript
const client = new OpenAI({
  baseURL: "https://coding.dashscope.aliyuncs.com/v1",
  apiKey: process.env.DASHSCOPE_API_KEY,
});
```

2. **Structured Output**:
   - 使用 `zod-to-json-schema` 将 Zod Schema 转为 JSON Schema
   - 通过 Tool Calling 强制模型输出标准 JSON
   - `tool_choice: "auto"` + System Prompt 双重约束

3. **完备性检查 + 追问机制**:
   - `status: "complete"`: 至少 1 个 career + sentiment 非空 + 至少 1 个 actionItem
   - `status: "pending"`: 缺失关键信息时生成 `followUpQuestion`
   - 确定性校验兜底（防止 LLM 误判）

4. **健壮性处理**:
   - Tool Call 检测
   - Zod `safeParse` 二次校验
   - 懒加载 Client（避免.env 加载顺序问题）

**问题排查**:
- Qwen3.5-plus 默认开启 thinking 模式，与 tool_choice 冲突
- 解决方案：添加 `extra_body: { enable_thinking: false }`

**产出文件**:
- `src/services/llmExtractor.ts` - 主提取函数
- `src/services/dbService.ts` - 数据库存储服务

---

### 阶段 3: 数据库架构与持久化

**技术栈**:
- Prisma ORM v7
- PostgreSQL (Docker 部署)
- PrismaPg Adapter

**Schema 设计** (`prisma/schema.prisma`):

```prisma
model Person {
  id                String    @id @default(uuid())
  name              String
  careers           Json      @default("[]")  // WeightedTag[]
  interests         Json      @default("[]")  // WeightedTag[]
  vibeTags          String[]  @default([])
  baseCities        String[]  @default([])    // 地理维度
  favoritePlaces    String[]  @default([])
  relationshipScore Float     @default(0)
  lastContactDate   DateTime
  introducedById    String?   // 介绍人关系
  introducedBy      Person?   @relation("Introduction", ...)
}

model Interaction {
  id           String   @id @default(uuid())
  date         DateTime
  location     String?
  contextType  String
  sentiment    String
  actionItems  Json     // ActionItem[]
  coreMemories String[]
  persons      InteractionPerson[]
}

model InteractionPerson {
  personId      String
  interactionId String
  @@id([personId, interactionId])  // 复合主键
}

model PersonTag {
  // 平铺索引表，用于快速聚类查询
  category  String  // "career" | "interest" | "vibe"
  name      String
  weight    Float
}
```

**关键实现**:

1. **权重合并算法** (Recency Bias):
```typescript
const RECENCY_BIAS = 0.3;
new_weight = old_weight × 0.7 + new_weight × 0.3
```
历史积累有惯性，单次提及不会大幅改变标签侧重。

2. **人物对齐逻辑**:
   - 按 `name` 字段 `findFirst` 匹配
   - 存在则更新（权重合并 + 热度递增）
   - 不存在则创建

3. **数据库连接**:
```typescript
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
```

**Prisma 7 配置变更**:
- `schema.prisma` 不再允许 `url` 属性
- 需创建 `prisma.config.ts` 迁移配置

**产出文件**:
- `prisma/schema.prisma`
- `prisma.config.ts`
- `src/services/dbService.ts`
- `src/lib/graphService.ts` (图谱查询服务)

---

### 阶段 4: 人脉图谱服务 (Graph Service)

**目标**: 将数据库数据转换为 react-force-graph 所需的 `{nodes, links}` 格式

**Link 类型扩展**:
| 类型 | 强度计算 | 说明 |
|------|----------|------|
| `interaction` | 0.5 × 互动次数 | 共同参与互动 |
| `introducedBy` | 0.8 (固定) | 介绍人关系 |
| `sharedCareer` | 0.6 × 权重均值 | 职业重叠 |
| `sharedCity` | 0.4 (固定) | 同城 |
| `sharedInterest` | 0.3 × 重叠标签数 | 兴趣重叠 |
| `sharedPlace` | 0.2 (固定) | 常去地点重叠 |
| `sharedVibe` | 0.2 × 重叠标签数 | 性格相似 |

**去重规则**:
- `canonicalKey`: source 永远取 ID 字典序较小者
- 同一对 (source, target) 可能有多种 type，全部保留

**API 参数**:
```
GET /api/graph?group=AI&linkType=sharedInterest&minStrength=0.3
```

**产出文件**:
- `src/lib/graphService.ts`
- `src/app/api/graph/route.ts`
- `scripts/test-graph.ts`

---

### 阶段 5: 前端录入页实现

**技术栈**:
- Next.js 14 App Router
- Tailwind CSS v3
- React 19

**视觉风格迭代**:
1. 第一版：深色主题 (#2d2a1e 背景，#c8a96e 强调色) - 用户不满意
2. 第二版：浅色奶油主题 (#f5f3ef 背景) - 用户认可

**最终布局**:
```
┌─────────────────────────────────────────────────┐
│ Jeffrey.AI  │ 录入 │ 图谱 │ 建议 │  127 联系人  │
├──────────────────┬──────────────────────────────┤
│  左栏 (42%)      │  右栏 (58%)                  │
│  ├ J 头像 + 问候  │  ├ Jeffrey 解读气泡           │
│  ├ 大文本输入框  │  ├ 已提取人物卡片             │
│  ├ 语音按钮      │  ├ 追问区 (pending 时显示)   │
│  ├ 清空/汇报按钮  │  ├ 社交债务列表               │
│  └ 最近录入列表  │                              │
└──────────────────┴──────────────────────────────┘
```

**关键功能**:
1. **语音输入** (Web Speech API):
   - 圆形麦克风按钮，录音时红色边框
   - 识别结果自动填入 textarea

2. **随机问候语**:
   - 5 条预设台词，每次进入随机选择
   - 斜体衬线字体渲染

3. **状态管理**:
   - `status`: complete/pending
   - `selectedQuickReply`: 快速回复选项

4. **本地持久化**:
   - `localStorage` 存储最近 5 条记录

**问题排查**:
1. Hydration 错误 - 添加 `suppressHydrationWarning` 到 `<html>` 标签
2. 模块格式冲突 - 移除 `package.json` 中的 `"type": "commonjs"`
3. Tailwind v4 兼容性 - 降级到 v3.4.0

**产出文件**:
- `src/app/input/page.tsx`
- `src/app/input/layout.tsx`
- `src/app/api/analyze/route.ts`
- `src/app/api/analyze/db.ts`
- `src/app/globals.css`
- `tailwind.config.js`
- `postcss.config.js`

---

### 阶段 6: 前后端整合

**API 数据流**:
```
前端提交 → /api/analyze → LLM 提取 → Zod 验证 → saveExtractionToDb → PostgreSQL
                                            ↓
                                         返回前端
```

**关键实现** (`src/app/api/analyze/route.ts`):
- 直接内联 LLM 调用逻辑（避免模块导入问题）
- 创建 `db.ts` 封装 Prisma 存储（同目录下）
- 仅当 `status === "complete"` 时写入数据库

**验证方法**:
1. 访问 `http://localhost:3000/api/debug` 查看数据库内容
2. 运行 `npm run test:graph` 检查图谱数据
3. 使用 `npx prisma studio` 可视化管理

**产出文件**:
- `src/app/api/analyze/route.ts`
- `src/app/api/analyze/db.ts`
- `src/app/api/debug/route.ts`

---

### 阶段 7: 追问闭环修复与编码问题解决

**问题 1: 追问回复显示 `[object Object]`**

**症状**: 用户点击快捷回复按钮后，LLM 收到的内容是 `[object Object]` 而非实际文本。

**根本原因**: 
1. `originalInputText` 状态在首次提交后未正确保存
2. 快捷回复按钮的 `onClick` 逻辑中，`customReply` 可能存储的是对象而非字符串

**解决方案**:
```typescript
// 修复前
const textToSubmit = followUpReply ? `${originalInputText}\n\n 追问回复：${followUpReply}` : inputText;

// 修复后
const baseText = originalInputText || inputText;
const textToSubmit = followUpReply ? `${baseText}\n\n 追问回复：${followUpReply}` : inputText;

// 按钮点击逻辑添加类型检查
let reply: string;
if (customReply && typeof customReply === 'string' && customReply.trim()) {
  reply = customReply;
} else if (selectedQuickReply && typeof selectedQuickReply === 'string') {
  reply = selectedQuickReply;
} else {
  alert('请输入回复内容或选择快捷回复');
  return;
}
```

**调试日志**: 在 `handleSubmit` 中添加:
```typescript
console.log('[Jeffrey.AI] baseText:', baseText);
console.log('[Jeffrey.AI] followUpReply:', followUpReply);
console.log('[Jeffrey.AI] Submitting text:', textToSubmit);
```

**问题 2: 中文输入乱码**

**症状**: 服务器日志显示 "2024  年 1  月 15  日" 而非 "2024 年 1 月 15 日"。

**可能原因**: 
1. Next.js 开发服务器的请求体解析编码问题
2. 浏览器 fetch 发送时的 Content-Type 未指定 charset

**解决方案**:
```typescript
// 前端
headers: { 'Content-Type': 'application/json; charset=utf-8' }

// 后端
const rawBody = await request.text();
const { text } = JSON.parse(rawBody);
```

**产出文件**:
- `next.config.js` - 添加 charset 响应头
- `src/app/input/page.tsx` - 修复追问逻辑和添加调试日志
- `src/app/api/analyze/route.ts` - 使用 request.text() 解析原始 body

---

## 三、技术架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        前端 (Next.js 16)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ /input       │  │ /graph       │  │ /suggestions │       │
│  │ 输入页面 ✅   │  │ 图谱可视化 ✅ │  │ 建议页面 ✅   │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
                            │
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
┌─────────────────┐ ┌─────────────────┐ ┌──────────────┐
│ /api/analyze    │ │ /api/graph      │ │ /api/debug   │
│ POST 文本→分析   │ │ GET 图谱数据     │ │ GET 调试数据  │
└─────────────────┘ └─────────────────┘ └──────────────┘
         │                  │
         ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                      服务层 (Services)                        │
│  ┌────────────────   ┌────────────────┐   ┌─────────────┐  │
│  │ llmExtractor   │   │ dbService      │   │ graphService│  │
│  │ Qwen + Tool    │   │ Prisma ORM     │   │ 图数据转换   │  │
│  └────────────────   └────────────────   └─────────────  │
└─────────────────────────────────────────────────────────────┘
         │                  │
         ▼                  ▼
┌─────────────────┐ ┌─────────────────┐
│ Qwen3.5-plus    │ │ PostgreSQL 15   │
│ (阿里百炼 API)   │ │ (Docker 容器)    │
└─────────────────┘ └─────────────────┘
```

---

## 四、开发环境配置

### 4.1 前置条件

```bash
# Node.js 版本
node -v  # 推荐 v18+

# pnpm 或 npm
pnpm -v  # 或 npm -v
```

### 4.2 环境变量 (`.env`)

```env
# 阿里 DashScope API Key
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxx

# PostgreSQL 连接字符串
DATABASE_URL=postgresql://admin:mysecretpassword@localhost:5432/jeffrey_db_main
```

### 4.3 启动步骤

```bash
# 1. 启动数据库
docker-compose up -d

# 2. 安装依赖
npm install

# 3. 数据库迁移
npx prisma migrate dev

# 4. 启动开发服务器
npm run dev

# 5. 访问应用
# http://localhost:3000/input
```

---

## 五、测试命令清单

```bash
# 仅测试 LLM 提取 (无需数据库)
npm run test:extract

# 全链路测试 (需先启动数据库)
npm run test:pipeline

# 测试图服务
npm run test:graph

# 查看数据库 (Prisma Studio)
npx prisma studio

# 直接查询数据库
docker exec -it jeffrey_db psql -U admin -d jeffrey_db_main
```

---

## 六、当前进度总结

| 模块 | 进度 | 说明 |
|------|------|------|
| 数据库 Schema | ✅ 100% | 4 个模型 + 索引 |
| LLM 提取服务 | ✅ 100% | Qwen + Tool Calling + 完备性检查 |
| 数据持久化 | ✅ 100% | Prisma + 权重合并 |
| 图数据服务 | ✅ 100% | 7 种关系边计算 + 过滤器 |
| API 路由 | ✅ 100% | /analyze + /graph + /debug + /members + /search |
| 输入页面 | ✅ 100% | 文本 + 语音 + 结果展示 |
| 图谱页面 | ✅ 100% | react-force-graph-2d + 节点详情 + 过滤器 |
| 建议页面 | ✅ 100% | 三大模块：关系维护提醒、待办承诺、破冰助手 |
| 追问闭环 | ✅ 100% | 快捷回复 + 自定义回复 + 重新提交 |
| 人脉表格页面 | ✅ 100% | 动态表格 + 排序 + 筛选 + 左右滑动 |
| 人员详情弹窗 | ✅ 100% | 查看 + 编辑 + 互动历史 |
| 图谱→弹窗联动 | ✅ 100% | 节点点击 → 查看完整档案 |
| 待办行动项增强 | ✅ 100% | 颜色区分归属 + 描述编辑 + 完成切换 |
| 多介绍人支持 | ✅ 100% | 多选复选框 + 姓名显示 + 导航跳转 |
| 全局搜索入口 | ✅ 100% | Header 搜索框 + /api/search 向量搜索 |
| **同人识别-手动合并** | ✅ 100% | 表格多选 + MergeConfirmDialog + 软删除 + 标签迁移 |
| **同人识别-自动预检** | ✅ 100% | 提交前姓名向量匹配 + NameResolutionPrompt + 用户确认 |
| 用户认证 | ❌ 0% | 未开始 |

---

## 七、下一步工作 (优先级排序)

### P0 — 待开发

1. **待办提醒**
   - 基于 `actionItems.resolved = false`
   - 按 `ownedBy = "me"` 过滤
   - 显示待办列表，支持标记完成

2. **语义搜索** ✅ 已完成
   - Header 全局搜索框
   - `/api/search` 向量搜索 (cosine similarity)
   - 搜索结果下拉展示

### P1 — 核心功能完善

3. **同人识别** ✅ 已完成（2026-04-07）
   - 手动合并：人脉表格多选 → 合并按钮 → MergeConfirmDialog
   - 自动预检：提交前 /api/persons/resolve → 向量相似度 → NameResolutionPrompt

### P2 — 工程化与部署

4. **用户认证**
   - 简单的登录/注册
   - 数据库加 `User` 表，`Person.userId` 外键

5. **部署**
   - Vercel 部署 Next.js
   - Railway/Render 部署 PostgreSQL
   - 环境变量配置

---

## 八、关键文件清单

**每次新会话必读**:
1. 本文档 — 了解整体进度
2. `prisma/schema.prisma` — 数据模型
3. `src/services/llmExtractor.ts` — LLM 提取逻辑
4. `src/app/input/page.tsx` — 录入页面

**新增文件**:
- `src/lib/schemaReader.ts` — 列定义 + 辅助函数（renderArray / renderRelativeDate）
- `src/lib/index.ts` — 统一导出
- `src/app/api/members/table/route.ts` — GET 表格数据（排序/筛选）
- `src/app/api/members/[id]/route.ts` — GET 单人详情 + PATCH 编辑
- `src/app/api/interactions/[id]/actionItems/route.ts` — PATCH actionItems 端点
- `src/components/PersonModal.tsx` — 可编辑弹窗组件（MultiIntroducerSelector + 行动项增强）
- `src/app/members/page.tsx` — 人脉表格页面
- `src/app/members/layout.tsx` — 人脉页面布局
- `src/app/api/suggestions/reminders/route.ts` — GET 提醒数据
- `src/app/api/suggestions/icebreaker/route.ts` — GET LLM 生成破冰开场白
- `src/components/SuggestionCard.tsx` — 通用卡片组件
- `src/app/suggestions/page.tsx` — 建议页面（重写）

**调试参考**:
- `src/test/fullPipelineTest.ts` — 端到端测试用例
- `scripts/test-graph.ts` — 图服务测试
- `curl http://localhost:3000/api/members/table` — 测试表格 API

---

## 九、已知问题与注意事项

1. **保存逻辑已实现但未充分测试** — analyze 后会自动调用 saveExtractionToDb
2. **无用户隔离** — 当前所有数据共享，多用户会混淆
3. **语音输入仅限 Chrome** — Web Speech API 兼容性限制
4. **Prisma 7 配置特殊** — 需使用 `prisma.config.ts` 而非 `schema.prisma` 中的 url
5. **图谱页面 SSR 问题** — 使用 dynamic import + ssr: false 解决 window is not defined 错误
6. **LLM 中文编码敏感** — 简短中文输入可能被误判为乱码，建议用户提供完整详细的社交记录（时间 + 地点 + 人物 + 事件 + 后续）
7. **追问状态管理** — originalInputText 必须在首次提交时保存，追问回复发送前需校验类型

---

## 十、会话续接指南

当你开始一个新的 AI 会话时，请按以下步骤续接上下文：

1. **阅读本文档** — 了解项目目标和当前进度
2. **检查数据库状态**:
   ```bash
   docker-compose ps
   ```
3. **验证 API 可用**:
   ```bash
   npm run test:extract  # 测试 LLM
   ```
4. **确认前端运行**:
   ```bash
   curl http://localhost:3000/input
   ```
5. **询问用户**: "今天想要完成什么任务？"
   - 如果是继续开发，参考「下一步工作」优先级
   - 如果是调试问题，先复现再修复

---

## 附录 A: 核心设计决策总结

1. **WeightedTag 用 0-1 而非 0-100**: 契合 LLM 置信度输出，省去归一化步骤
2. **vibeTags 用 string[] 而非 WeightedTag[]**: 定性描述不强行量化
3. **ActionItem 的 ownedBy 字段**: 驱动后续「提醒我」功能
4. **PersonTag 平铺索引表**: JSONB 不适合聚类查询，需镜像为可索引行
5. **权重合并公式 0.7/0.3**: 历史积累有惯性，单次提及不颠覆画像
6. **追问式交互闭环**: 信息不完整时转化为自然追问，而非强行猜测

---

## 附录 B: 常见问题速查

```bash
# PowerShell 删除目录（不是 rm -rf）
Remove-Item -Recurse -Force .next

# PowerShell 与运算（不是 &&）
命令 1; 命令 2

# 重启开发服务器
# Ctrl+C 停止，然后 npm run dev

# 数据库迁移后重新生成客户端
npx prisma generate

# 杀死占用端口的进程 (Windows)
taskkill //F //PID <进程 ID>

# 查看 Next.js 日志
cat .next/dev/logs/next-development.log | tail -50

# 测试 API 编码 (curl)
echo '{"text":"今天见了老王"}' | curl -s -X POST http://localhost:3000/api/analyze -H "Content-Type: application/json" -d @-
```

---

## 附录 C: 本次会话问题排查记录 (2026-03-31)

### 问题 A: 追问回复变成 `[object Object]`

**调试步骤**:
1. 查看浏览器 Console 日志，发现 `Submitting text: \n\n 追问回复：[object Object]`
2. 检查服务器日志，确认接收到的是字符串 `[object Object]`
3. 追踪代码发现 `customReply` 状态未正确校验类型

**修复方法**:
```typescript
// 发送前类型校验
let reply: string;
if (customReply && typeof customReply === 'string' && customReply.trim()) {
  reply = customReply;
} else if (selectedQuickReply && typeof selectedQuickReply === 'string') {
  reply = selectedQuickReply;
} else {
  alert('请输入回复内容或选择快捷回复');
  return;
}
```

**最佳实践**:
- 所有用户输入状态必须在使用前校验 `typeof === 'string'`
- 添加调试日志输出关键变量 (`baseText`, `followUpReply`, `textToSubmit`)
- 空值处理使用 `originalInputText || inputText` 兜底

### 问题 B: 中文乱码 "2024  年 1  月 15  日"

**调试步骤**:
1. 查看服务器日志 `[Jeffrey.AI] Raw body:` 发现乱码
2. 使用 curl 直接测试 API，确认后端处理 UTF-8 正常
3. 定位问题为浏览器到 Next.js 开发服务器的请求编码

**修复方法**:
```typescript
// 前端指定 charset
headers: { 'Content-Type': 'application/json; charset=utf-8' }

// 后端先读取原始文本再解析
const rawBody = await request.text();
const { text } = JSON.parse(rawBody);
```

**最佳实践**:
- Next.js API Route 中使用 `request.text()` 而非 `request.json()` 可避免编码损失
- 创建 `next.config.js` 添加 charset 响应头
- 服务器日志必须输出原始 body 和解析后的值用于对比

### 问题 C: LLM 返回空 persons 数组

**原因**: Zod Schema 要求 `persons.min(1)`，但 LLM 在 pending 状态下可能返回空数组

**修复方法**:
```typescript
// Schema 修改
persons: z.array(ExtractedPersonSchema).default([]),  // 允许空数组
sentiment: z.string().optional(),                      // pending 时可为空
```

**最佳实践**:
- Schema 验证应允许 pending 状态的不完整数据
- 完备性判断由 LLM 的 `status` 字段控制，而非 Schema 强制约束

---

**项目口号**: "了解，先生。" — Jeffrey

---

## 附录 D: 本次会话问题排查记录 (2026-04-04)

### 问题 A: members 页面 Build Error — 残留代码导致解析失败

**症状**: Next.js 编译报错 `Unexpected token. Did you mean '{'>'}`?`，指向 `src/app/members/page.tsx:243`

**根本原因**: 在向已有页面的 JSX 中插入新导航栏时，旧的 `h1` 标题被部分覆盖，但未完全删除，留下孤立的 style 对象和标签碎片：

```tsx
// 残留代码片段
fontSize: "22px",
fontWeight: 700,
color: "#3a2a1a",
margin: 0,
}}
>
  人脉总览
</h1>
```

**修复方法**: 删除所有残留代码片段，确保 JSX 结构完整。

**最佳实践**: 在 Next.js App Router 中插入导航栏时，应找到页面主 return 的最外层 div，从外部包裹 header，而不是在内部插入造成碎片。

### 问题 B: 联系人数量读取 undefined

**症状**: 运行时错误 `Cannot read properties of undefined (reading 'length')`，出现在 `header` 中的 `{rows.length}`

**根本原因**: API 请求失败时 `data.rows` 为 `undefined`，但 `fetchTable` 没有设置空值保护。

**修复方法**:
```typescript
setColumns(data.columns ?? []);
setRows(data.rows ?? []);
```

### 问题 C: PersonModal 数组字段 null 崩溃

**症状**: 运行时错误 `Cannot read properties of undefined (reading 'join')`，出现在 `person.baseCities.join(", ")`

**根本原因**: 数据库中 `String[]` 类型字段（`vibeTags`、`baseCities`、`favoritePlaces`、`coreMemories`）存储的是 `NULL` 而非空数组。Prisma 返回 `null`，调用 `.join()` 报错。

**修复方法**: 所有数组渲染处加空值保护：
```typescript
// API 端
vibeTags: (person.vibeTags ?? []).join(", "),

// 前端组件
value={(person.baseCities ?? []).join(", ") || "—"}
```

**最佳实践**:
- Prisma schema 中 `String[]` 字段必须设置 `default([])`，避免存入 NULL
- 所有 `.join()` 调用前必须做空值保护：`() ?? []`
- 即使 schema 有 `default`，也要防呆处理（数据库已有 NULL 记录时 schema 无法自动迁移）

### 问题 D: FieldCard 编辑状态不生效

**症状**: 点击 PersonModal 中的字段无反应，无法进入编辑模式。

**根本原因**: `FieldCard` 组件用 `editingField === label` 判断当前是否编辑，但传入的 `label` 是中文（"姓名"），而 `editingField` 是英文键名（"name"），永远不相等。

**修复方法**: 给 `FieldCard` 添加独立的 `fieldKey` prop 用于状态判断，`label` 仅用于显示。
```tsx
<FieldCard
  label="姓名"
  fieldKey="name"  // 用于判断编辑状态
  value={person.name}
  ...
/>
```

### 问题 E: PersonModal 未解决行动项计数错误

**症状**: 待办徽章始终显示 0，但实际有未完成任务。

**根本原因**: 代码检查 `completed` 属性，而 Prisma schema 中 `ActionItem` 的字段名是 `resolved`。

**修复方法**:
```typescript
count += interaction.actionItems.filter(
  (item) => !(item as { resolved?: boolean }).resolved
).length;
```

---

## 附录 E: 动态人脉表格功能设计 (2026-04-04)

### 功能概述

新增 schema 驱动的动态人脉表格页面，替代 `/suggestions` 占位页，支持：
1. 查看所有人的结构化信息（表格形式）
2. 按职业/城市筛选
3. 按任意列排序
4. 点击行打开详情弹窗，支持编辑
5. 图谱页面点击节点弹出详情弹窗

### 技术方案

#### 后端

**GET /api/members/table** — 返回 `{ columns, rows }`
- `columns` 由 `src/lib/schemaReader.ts` 中的 `PERSON_COLUMNS` 驱动
- `rows` 包含所有 Person 数据及派生字段（actionItems 数量、introducedBy 名称等）
- Query 参数：`sort`, `order`, `filterCareer`, `filterCity`, `filterInterest`
- 注意：JSONB 字段（careers/interests）的部分名称匹配在 JS 端实现（Prisma `array_contains` 仅支持精确匹配）

**PATCH /api/members/:id** — 部分字段更新
- 支持字段：name, vibeTags, baseCities, favoritePlaces, relationshipScore, lastContactDate, coreMemories
- 实时校验：relationshipScore 限 0-100，name 非空

**GET /api/members/:id** — 返回单人完整详情（含互动历史），用于弹窗展示。

#### 前端

**/members/page.tsx** — 动态表格页面
- 列根据 `columns` 配置渲染，表格容器支持 `overflowX: auto` 左右滑动
- 列头点击排序（仅 string/number/date 类型可排序）
- 筛选栏（职业/城市）

**PersonModal.tsx** — 通用弹窗组件
- 两个场景复用：members 表格行点击 + graph 节点点击
- 功能：展示所有字段、编辑可编辑字段、显示互动历史
- `fieldKey` 独立 prop 用于编辑状态判断

#### 图谱联动
- graph/page.tsx 中，侧边栏添加"查看完整档案"按钮
- 按钮点击 → 打开 PersonModal（不跳转路由）
- Modal 保存后调用 `fetchGraphData` 刷新图谱

### 字段渲染规则

| 字段 | 表格渲染 | 弹窗渲染 |
|------|----------|----------|
| careers/interests | "投行(0.9), 木工(0.1)" | 同上 |
| vibeTags 等 string[] | 逗号拼接 | 逗号拼接 |
| relationshipScore | 进度条 + 颜色 | 进度条 + 数字 |
| lastContactDate | 相对时间 | 相对时间 + 悬停完整日期 |
| introducedBy | 人名 | 人名 |
| actionItems | 徽章"2项待办" | 互动历史列表 |

---

## 附录 F: 本次会话功能增强 (2026-04-04)

### 功能 1: 待办行动项增强

**目标**: 区分"我欠""对方欠""互欠"三种归属，支持编辑描述和标记完成。

**技术实现**:

**前端** — `src/components/PersonModal.tsx`:
- 新增 `ActionItem` 类型：`{ description: string; ownedBy: "me" | "them" | "both"; resolved: boolean }`
- `handleToggleResolved` / `handleSaveActionItem` 两个 handler
- 乐观更新：先改本地状态，再调 API，最后触发 `onSaved?.()` 刷新
- 颜色规则：红 = 我欠，蓝 = 对方欠，橙 = 互欠
- 新增 CSS keyframe 动画：`item-toggle`（圆圈缩放）、`item-complete`（绿色闪烁）
- 已完成项目单独分组展示（最多显示 5 条）

**新增 API 端点** — `src/app/api/interactions/[id]/actionItems/route.ts`:
```typescript
// PATCH — 整体替换 actionItems 数组
{ actionItems: Array<{ description: string; ownedBy: string; resolved: boolean }> }
```

**已知 bug**: `handleToggleResolved` 中 `find()` 返回的是 `InteractionPerson` 对象而非嵌套的 `.interaction` 属性。代码中通过 `interaction.interaction.actionItems` 访问解决。

---

### 功能 2: 职业/兴趣标签权重显示为百分比

**目标**: `renderArray` 函数中 `0.9` 显示为 `90%`。

**修改** — `src/lib/schemaReader.ts`:
```typescript
return named.weight !== undefined
  ? `${named.name}(${Math.round(named.weight * 100)}%)`
  : named.name;
```

---

### 功能 3: 多介绍人支持 (introducedByIds)

**目标**: 介绍人从单一选择改为多选（复选框），支持搜索、打勾选择、可清除。

**数据库变更**:
- `prisma/schema.prisma` 新增 `introducedByIds String[] @default([])`
- 创建迁移: `20260404080333_add_introduced_by_ids`

**后端变更** — `src/app/api/members/[id]/route.ts`:
```typescript
const EDITABLE_FIELDS = [
  ..., "introducedById", "introducedByIds",
] as const;

// introducedByIds 校验：验证每个 ID 对应的人存在
case "introducedByIds": {
  if (value !== null && !Array.isArray(value)) { ... }
  for (const id of value as string[]) {
    const target = await getPrisma().person.findUnique({ where: { id } });
    if (!target) { return 400 error; }
  }
  break;
}
```

**前端变更** — `src/components/PersonModal.tsx`:
- 新增 `MultiIntroducerSelector` 组件（替代原 `PersonSelector`）
- Props: `values: string[]`, `allPersons`, `onNavigate`, `onChange`
- 复选框 UI：打开下拉 → 勾选/取消 → 乐观更新 → 自动保存
- 修复 `onMouseDown.stopPropagation()` 避免点击时 dropdown 误关闭
- 显示：从 `displayNames` 解析所有选中人的姓名，用顿号分隔

**姓名解析问题**: dropdown 关闭时 `persons` 数据为空。解决：在 `PersonModal` 启动时预加载 `/api/members/table` 到 `allPersons` 状态。

---

### 功能 4: 介绍人字段导航跳转

**目标**: 点击介绍人姓名 → 打开该人弹窗；支持多层跳转 + 返回按钮。

**前端变更** — `src/components/PersonModal.tsx`:
- 新增状态：`allPersons`, `navigateStack: string[]`, `initialPersonId`
- `handleNavigateToPerson(targetId)`: 当前 person 入栈 → fetch 新人数据
- `handleGoBack()`: 栈顶 ID 出栈 → fetch 返回
- Modal header 左上角：导航栈非空时显示「← 返回」按钮
- 关闭状态显示：已选人显示为 `{名字} ✎`，名字可点击跳转，✎ 图标点击打开下拉

---

### 技术问题排查记录

#### 问题 A: `actionItems is not iterable` (handleToggleResolved)

**根本原因**: `find()` 返回的是 `InteractionPerson` join 对象（`{ interaction, person }`），不是 `Interaction` 对象。

**修复**: 使用 `ip.interaction.actionItems` 而非 `interaction.actionItems`。

#### 问题 B: `filtered used before initialization`

**根本原因**: `useEffect` 的依赖数组中引用了 `filtered`，但 `filtered` 在组件函数体内定义，顺序早于 useEffect。

**修复**: 重新排序 — `filtered` 在 useEffect 之前定义。

#### 问题 C: 下拉框点击后立即关闭

**根本原因**: `document` 的 `mousedown` 事件在 `togglePerson` 的 `onChange` 之前触发了 `setOpen(false)`。

**修复**: dropdown div 添加 `onMouseDown={(e) => e.stopPropagation()}`。

#### 问题 D: 介绍人选中后显示 ID 而非姓名

**根本原因**: `displayText` 用 `persons.find()` 解析，但 `persons` 只在 dropdown 打开时加载。

**修复**: Modal 启动时预加载 `allPersons`， Selector 组件通过 props 接收。

#### 问题 E: Prisma `introducedByIds` Unknown argument

**根本原因**: `.next` 缓存中有旧的 Prisma client，不知道新字段。

**修复**: `npx prisma generate` + 删除 `.next` 目录。

#### 问题 F: 端口 3002 权限被拒 (EACCES)

**根本原因**: Windows bash 环境无法绑定 3000-3009 端口。

**修复**: `next dev -p 30081` 换高位端口。

---

### 当前已知状态

- ✅ 待办完成/取消功能正常
- ✅ 权重百分比显示正常
- ✅ 多介绍人可保存、可显示、可导航跳转
- ✅ 返回按钮正常
- ⏳ 首次加载时介绍人名字解析可能需要确认（`allPersons` 预加载时序）

---

## 附录 G: 建议页功能 (2026-04-05)

### 功能概述

建议页是 Jeffrey.AI 的"智能大脑"展示窗口，基于已有社交数据主动推荐行动。分为三大模块：

| 模块 | 触发条件 | Jeffrey 口吻示例 |
|------|----------|------------------|
| **关系维护提醒** | `lastContactDate` 超过 30 天 | "老王已经 47 天没联系了，先生。" |
| **待办承诺提醒** | `actionItems.resolved=false, ownedBy=me` | "您有 3 笔社交债务未兑现。" |
| **破冰助手** | 用户选中某人，LLM 生成开场白 | "下次见到他，可以聊聊他最近在研究 LLM 微调。" |

### 技术实现

#### 后端 API

**GET /api/suggestions/reminders** — 返回关系维护 + 待办提醒（纯数据查询，无需 LLM）
- `staleContacts`: `lastContactDate < now - 30 days`，按天数倒序
- `pendingDebts`: `actionItems` 中 `ownedBy='me'` 且 `resolved=false` 的事项

**GET /api/suggestions/icebreaker?personId=xxx** — 调用 MiniMax-M2.7 LLM 生成破冰开场白
- 使用 Anthropic API 格式：`POST https://api.minimaxi.com/anthropic/v1/messages`
- 响应格式：Anthropic content 数组，需遍历找到 `type="text"` 的块
- 返回字段：openingLines, suggestedTopics, recentContext, jeffreyComment

#### 前端页面 (`/suggestions/page.tsx`)

三大模块布局：
1. **关系维护提醒** — 卡片列表，显示联系人姓名、职业、最后联系时间、"戳他"按钮跳转 `/input?personId=xxx`
2. **待办承诺** — 红色左边框样式，显示"我欠"承诺描述和关联人
3. **破冰助手** — 下拉选择联系人后调用 icebreaker API，结果以卡片形式展示开场白、话题建议、记忆切入点和 Jeffrey 备注

#### 环境变量 (`.env`)

```env
MINIMAX_API_KEY=sk-cp-xxxxxxxxxxxxx  # MiniMax API Key
MINIMAX_MODEL=MiniMax-M2.7            # 模型名称
```

### 关键文件

| 文件 | 作用 |
|------|------|
| `src/app/api/suggestions/reminders/route.ts` | 提醒数据查询 |
| `src/app/api/suggestions/icebreaker/route.ts` | LLM 破冰生成 |
| `src/components/SuggestionCard.tsx` | 通用卡片样式组件 |
| `src/app/suggestions/page.tsx` | 建议页主页面 |
| `.env` | 新增 `MINIMAX_API_KEY` 和 `MINIMAX_MODEL` |

### 问题排查记录

#### 问题 A: MiniMax API 404 Not Found

**原因**: API 端点路径错误。

**修复**: 
- 错误端点：`https://api.minimax.chat/v1`
- 正确端点：`https://api.minimaxi.com/anthropic/v1/messages`

#### 问题 B: LLM 返回空 content

**原因**: MiniMax 返回的 content 是数组，包含 `thinking` 和 `text` 两种类型块。

**修复**: 遍历 content 数组找到 `type === "text"` 的块：
```typescript
const textBlock = apiData.content?.find((c) => c.type === "text");
const content = textBlock?.text;
```

#### 问题 C: `Cannot read properties of undefined (reading 'join')`

**原因**: `person.vibeTags` 或 `person.coreMemories` 可能是 undefined。

**修复**: 添加空值保护：
```typescript
const careers = (person.careers as Array<{ name: string }>) || [];
const vibeTags = (person.vibeTags || []).join("、") || "未知";
```

---

### 验收标准达成情况

| 场景 | 状态 |
|------|------|
| 首次访问 `/suggestions` | ✅ 显示 3 个模块 |
| 超过 30 天未联系的人 | ✅ 显示在关系维护提醒 |
| ownedBy=me 的未完成事项 | ✅ 显示在待办承诺 |
| 选择联系人后 LLM 生成开场白 | ✅ 成功调用 MiniMax-M2.7 |
| 点击"戳他"跳转 | ✅ 跳转 `/input?personId=xxx` |
| 无数据时显示占位文案 | ✅ |

---

## 附录 H: 待开发功能想法 (2026-04-05)

### 功能: 同一人识别与合并

**问题背景**: 用户在不同场景下可能用不同称呼指代同一人（如"老王""王总""王老板"都指向同一个人），导致数据库中出现重复条目。

#### 方案 1: 自动模式

**触发时机**: 当 LLM 提取时检测到相似姓名

**识别逻辑**:
- 提取时发现新姓名与已有姓名"相似"（如"老王" vs "王总"）
- 利用 LLM 判断是否可能指向同一人（姓氏相同 + 昵称/敬称模式）
- 当判定为潜在重复时，设置 `status: "ambiguous"`，追问用户确认

**交互流程**:
```
输入: "今天和老王喝咖啡，王总说..."
↓
LLM 提取: 发现 "老王" 和 "王总" 可能是同一人
↓
追问: "你指的是之前录入的老王吗？"
↓
用户确认: "是" → 合并到已有条目
         "不是" → 创建新条目
```

**数据库变更**:
- `Person` 表新增 `aliases: String[]` 字段，存储多个代称
- 或创建 `PersonAlias` 表: `{ id, personId, alias }`

**LLM Prompt 补充**:
```
提取时，如果发现多个姓名可能指向同一人（如"老王"和"王总"），
在 persons 数组中标记 ambiguous: true，并提供 followUpQuestion。
```

#### 方案 2: 手动模式

**触发时机**: 用户在人脉表格页面主动操作

**交互流程**:
1. 用户在表格中选择 2+ 条目
2. 点击"合并"按钮
3. 弹出确认框，显示合并预览（保留哪个作为主条目、合并哪些标签）
4. 用户确认后执行合并

**合并规则**:
- 保留主条目的 `name`，其他条目的姓名移入 `aliases`
- 标签合并：按现有权重合并算法
- 互动记录：合并到主条目下
- 关系分数：取最高值

#### 技术可行性分析

| 方面 | 评估 |
|------|------|
| 自动识别准确率 | 中等 — LLM 可判断"老王"≈"王总"，但跨场景（如"王总"在A公司是投行，在B公司是VC）可能误判 |
| 追问机制 | 已具备 — 可复用现有 `status: "pending"` + `followUpQuestion` 机制 |
| 数据库变更 | 小 — 仅需添加 aliases 字段或新表 |
| 手动合并 UI | 简单 — 表格多选 + 确认弹窗 |

#### 优先级建议

- **短期**: 先实现方案 2（手动合并），UI 和逻辑都简单
- **中期**: 方案 1 的自动识别，利用现有追问机制
- **长期**: 智能合并建议（LLM 推荐哪些条目应该合并）

---

### 功能: 语义搜索

**状态**: 待开发
**优先级**: P0
**描述**: 用户输入自然语言查询，系统返回匹配的人脉列表

**示例**:
- "我认识哪些做投行的人"
- "最近见过谁"
- "谁帮我介绍过朋友"

**技术方案**: LLM 解析意图 → 转换为 Prisma 查询条件 → 返回结果

---

## 附录 I: 本次会话问题修复 (2026-04-05)

### 问题 A: 互动历史未创建（pending 状态跳过 Interaction 创建）

**症状**: 用户录入"今天见了老王"后，"最近联系"更新时间，但弹窗"互动历史"为空。

**根本原因**: LLM 返回 `status: "pending"`（缺少 sentiment、actionItems 等字段），代码走 pending 分支调用 `saveExtractionToDb(data, false)`。由于 `contextType` 和 `sentiment` 都为 `undefined`，触发 db.ts 中的跳过逻辑：

```typescript
// 旧代码 — contextType/sentiment 都为空时跳过
if (!data.contextType && !data.sentiment && !createInteraction) {
  return { interactionId: "", personIds }; // ❌ 跳过创建
}
```

追问回复后 `status` 变成 `"complete"`，但 `data` 仍然是首次录入的数据（无 sentiment/contextType），仍然跳过。

**修复方案**:

1. `saveExtractionToDb` 增加 `createInteraction` 参数，强制创建互动：
```typescript
// db.ts
export async function saveExtractionToDb(data: ExtractionData, createInteraction = false)
if (!data.contextType && !data.sentiment && !createInteraction) {
  return { interactionId: "", personIds };
}
```

2. `route.ts` 中 pending 和 complete 状态都传 `createInteraction=true`：
```typescript
// pending 时
await saveExtractionToDb({ ... } as any, true); // createInteraction=true

// complete 时
await saveExtractionToDb(data, true);
```

**关键日志**（修复后）：
```
[Jeffrey.AI] saveExtractionToDb called: { createInteraction: true, ... }
[Jeffrey.AI] Creating interaction with: { date: '2026-04-05T04:00:00.000Z', ... }
[Jeffrey.AI] Saved pending person data with interaction
```

---

### 问题 B: MiniMax 返回 `null` 导致 Zod 验证失败

**症状**: `API Error: 500 "Failed to analyze input: LLM output failed schema validation... Expected string, received null"`

**根本原因**: MiniMax-M2.7 返回的 JSON 中，某些字段值为 `null`（而非 JavaScript 的 `undefined`）。Zod 严格模式下 `z.string()` 不接受 `null`。

**修复方案**: 解析后做 `null → undefined` 归一化，再送入 Zod：
```typescript
// route.ts — safeParse 前
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
```

---

### 问题 C: 日期正则解析不稳定 → 改为正则匹配

**旧方案**: 完全依赖 LLM 解析"今天""昨天""上周三"等相对日期，LLM 容易返回错误格式或误判。

**新方案**: 在发送给 LLM 前，用正则替换为 ISO-8601 格式：
```typescript
// route.ts — normalizeRelativeDates()
function normalizeRelativeDates(input: string): string {
  const ref = new Date();
  const iso = (d: Date) => `${d.toISOString().split('T')[0]}T12:00:00+08:00`;

  // 直接词：今天、明天、昨天、前天、后天
  // 前缀：天大前、大后、上上/上/下下/下（周偏移）
  // 纯周几：周一、周二...（本周）

  // 示例："上周三" → 计算 ref 日期的周三 + 上周偏移
  // 示例："大前天" → ref - 3 天
  return result;
}
```

**支持格式**:
| 类型 | 示例 | 输出 |
|------|------|------|
| 直接词 | 今天、昨天、前天、明天、后天 | ISO 日期 |
| 前缀+天 | 大前天（-3）、大后天（+3） | ISO 日期 |
| 前缀+周几 | 上周一、下周三、上上周二、下下周五 | ISO 日期 |
| 纯周几 | 周一、周二...（本周） | ISO 日期 |

---

### 问题 D: Build Error — GraphNode 缺少 x/y 属性

**症状**: `Property 'x' does not exist on type 'GraphNode'`

**根本原因**: `react-force-graph-2d` 在运行时给节点添加 `x`、`y` 坐标，但 TypeScript interface 未定义。

**修复**:
```typescript
// graph/page.tsx
interface GraphNode {
  id: string;
  label: string;
  val: number;
  group: string;
  city: string;
  lastContact: string;
  x?: number;  // 运行时由 force-graph 添加
  y?: number;
}
```

---

### 问题 E: Build Error — Zod Schema 类型递归过深

**症状**: `Type instantiation is excessively deep and possibly infinite` 在 `llmExtractor.ts:163`

**根本原因**: `zodToJsonSchema(ExtractionPayloadSchema)` 递归解析带嵌套 Zod schema 的类型，TypeScript 工具链卡住。

**修复**: 在两处使用 `@ts-ignore` 绕过：
```typescript
// llmExtractor.ts:163
// @ts-ignore - Zod schema type recursion workaround
parameters: zodToJsonSchema(ExtractionPayloadSchema) as Record<string, unknown>,
```

```typescript
// route.ts 中同样处理
```

---

### 问题 F: Dev Server 端口冲突

**现象**: 端口 3000 被占用，新启动的服务器报错 `EADDRINUSE`。

**排查方法**:
```bash
netstat -ano | grep :3000   # 查找占用进程的 PID
taskkill //F //PID <PID>    # 杀死进程
```

**当前状态**: 开发服务器偶尔需要手动清理端口，下次会话如遇端口问题，记住先 `netstat -ano | grep :3000` 排查。

---

### 本次会话修改文件清单

| 文件 | 修改内容 |
|------|----------|
| `src/app/api/analyze/route.ts` | 正则日期替换、null→undefined、pending 时 createInteraction=true |
| `src/app/api/analyze/db.ts` | createInteraction 参数、调试日志 |
| `src/services/llmExtractor.ts` | @ts-ignore 绕过 Zod 递归 |
| `src/app/graph/page.tsx` | GraphNode interface 增加 x/y 可选属性 |

---

### 当前功能状态

| 功能 | 状态 |
|------|------|
| 录入 → 互动历史创建 | ✅ 已修复 |
| 日期正则解析 | ✅ 已实现 |
| MiniMax null 兼容性 | ✅ 已修复 |
| Build 无错误 | ✅ |
| Dev server 正常运行 | ✅ (http://localhost:3000) |

---

## 会话 006: 代码库重构 + 版本控制初始化 (2026-04-06)

### 背景问题
仓库存在以下问题：
- 每个 API route 重复创建 Prisma 实例（代码冗余）
- `dbService.ts` 和 `analyze/db.ts` 有重复的 `mergeTags` 函数
- Schema 定义在多处重复
- `ignoreBuildErrors: true` 隐藏 TypeScript 错误
- 调试文件 `debug_search.ts` 在根目录
- `force-graph` 依赖未使用
- 项目未初始化 Git

### 执行的重构

#### 1. 创建共享 Prisma 单例
**新增文件**: `src/lib/db.ts`
```typescript
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

export const prisma = new PrismaClient({ adapter });
```

#### 2. 统一 mergeTags 函数
**新增文件**: `src/lib/dbUtils.ts`
- 将 `mergeTags` 提取到共享工具函数
- 保持 `RECENCY_BIAS = 0.3`

#### 3. 更新 API Routes
所有以下文件已更新使用共享 Prisma 单例：
- `src/app/api/analyze/route.ts`
- `src/app/api/analyze/db.ts`
- `src/app/api/search/route.ts`
- `src/app/api/suggestions/icebreaker/route.ts`
- `src/app/api/suggestions/reminders/route.ts`
- `src/app/api/members/route.ts`
- `src/app/api/members/[id]/route.ts`
- `src/app/api/members/table/route.ts`
- `src/app/api/interactions/[id]/actionItems/route.ts`
- `src/app/api/debug/route.ts`
- `src/lib/graphService.ts`

#### 4. Schema 统一
- `analyze/route.ts` 现在从 `schemas/core.ts` 导入 `WeightedTagSchema` 和 `ActionItemSchema`

#### 5. 其他清理
- `next.config.js`: `ignoreBuildErrors: false`
- 删除 `debug_search.ts`
- 卸载 `force-graph` 依赖

### 版本控制初始化

#### 1. Git 初始化
```bash
git init
git config user.email "developer@jeffrey.ai"
git config user.name "Jeffrey Developer"
```

#### 2. .gitignore 创建
忽略：node_modules, .env, .next, dist, *.log, *.db

#### 3. 初始提交
```bash
git add -A
git commit -m "chore: initial commit"
git tag -a v1.0.0 -m "v1.0.0: 初始稳定版本"
```

#### 4. 版本控制策略文档
**新增文件**: `docs/version-control-strategy.md`

内容包含：
- 分支模型 (Git Flow 简化版)
- 提交规范 (feat/fix/docs 等)
- 语义化版本规则
- 回滚策略
- 保护规则

#### 5. CLAUDE.md 更新
添加版本控制快速参考

### 修改文件清单

| 文件 | 操作 |
|------|------|
| `src/lib/db.ts` | 新增 |
| `src/lib/dbUtils.ts` | 新增 |
| `src/lib/graphService.ts` | 更新 |
| `src/services/dbService.ts` | 更新 |
| `src/app/api/analyze/db.ts` | 更新 |
| `src/app/api/analyze/route.ts` | 更新 |
| `src/app/api/*.ts` (9个) | 更新 |
| `next.config.js` | 更新 |
| `package.json` | 更新 |
| `debug_search.ts` | 删除 |
| `docs/version-control-strategy.md` | 新增 |
| `CLAUDE.md` | 更新 |
| `.gitignore` | 新增 |

### Git 状态

```
326f65f docs: 添加版本控制策略到 CLAUDE.md
6b76125 chore: initial commit
---
v1.0.0
```

### 验证结果
- ✅ TypeScript 编译无错误
- ✅ `npm run build` 构建成功
- ✅ `npm start` 生产服务器运行正常
- ✅ 无遗留僵尸进程

### LLM Provider 确认
- **MiniMax** — 生产环境 LLM（`analyze/route.ts`、`suggestions/*`）
- **DashScope** — Embeddings（`embedding.ts`）+ 测试（`llmExtractor.ts`）

### 后续建议
1. 下次开发前创建功能分支：`git checkout -b feature/my-feature`
2. 重要更改前确认 `npm run build` 成功
3. 参考 `docs/version-control-strategy.md` 进行版本发布

---

## 会话 007: 同人识别功能实现 (2026-04-07)

### 功能概述

同人识别（Same Person Detection）解决用户在不同场景下用不同称呼指代同一人的问题（如"老王""王总""王老板"都指向同一个人），防止数据库中出现重复条目。

**实现的两种方案**：

| 方案 | 触发时机 | 实现状态 |
|------|----------|----------|
| **手动合并** | 用户在成员表格页面多选 → 合并按钮 → 确认弹窗 | ✅ 已完成 |
| **自动检测（预检）** | 提交录入前，提取文本中的姓名 → 向量相似度匹配 → 用户确认后替代 analyze | ✅ 已完成 |

### 方案 1: 手动合并

#### 数据库变更 (`prisma/schema.prisma`)

```prisma
model Person {
  // ... 现有字段 ...
  deletedAt        DateTime?   // 软删除标记
  mergedIntoId     String?     // 合并到的目标人物 ID（为空 = 未被合并）
  mergedInto       Person?     @relation("PersonMerge", fields: [mergedIntoId], references: [id])
  mergedFrom       Person[]    @relation("PersonMerge")
  aliases          String[]    @default([])  // 被合并的曾用名
  @@index([mergedIntoId])
  @@index([deletedAt])
}
```

**合并规则**：
- ** survivor **（接收方）：保留，更新标签、热度等
- ** victim **（被合并方）：软删除（`deletedAt` = now），`mergedIntoId` → survivor
- ** aliases **：victim 的姓名 + victim 所有 aliases → survivor 的 aliases
- ** 标签合并**：recency bias 0.7/0.3 权重合并
- ** InteractionPerson **：迁移到 survivor（通过 delete + create 避免 @@id 冲突）
- ** PersonTag **：按人名迁移并合并权重
- ** 搜索文本**：rebuild `searchText` 和 `embedding`

#### 后端 API

**POST /api/persons/merge**
```typescript
// Request
{ survivorId: string, victimIds: string[] }

// Response
{ success: true, survivor: { id, name, aliases, ... }, mergedCount: number }
```

**关键逻辑**（transaction 内执行）：
1. 收集所有 victim 的 aliases（包括 victim.name 自身）
2. 合并 tags：`mergeTags(survivorTags, victimTags)`
3. union 数组字段：`vibeTags`、`baseCities`、`favoritePlaces`、`coreMemories`
4. 软删除 victim：`deletedAt: new Date()`
5. 迁移 InteractionPerson：delete 旧 + create 新（避免 @@id 冲突）
6. 迁移 PersonTag：按 `personId` 更新或 create
7. 更新 survivor：`aliases`、`careers`、`interests`、`vibeTags` 等
8. rebuild `searchText` + 重新生成 `embedding`

#### 前端 UI

**Members 表格页面** (`src/app/members/page.tsx`)：
- 新增复选框列
- 选中行高亮：`#fef7ec` 背景色
- 合并按钮：红色，`selectedIds.length >= 2` 时显示
- 点击后打开 `MergeConfirmDialog`

**MergeConfirmDialog 组件** (`src/components/MergeConfirmDialog.tsx`)：
- Survivor 卡片：金色边框 + "主档案" 标签
- Victim 卡片：灰色边框 + "将被合并" 标签
- 显示合并统计：标签数量变化、别名列表、互动数量
- 确认按钮：执行合并并刷新表格

#### members table API 更新

**GET /api/members/table** 新增过滤：
```typescript
where: { deletedAt: null, mergedIntoId: null }
```
确保软删除和已合并的记录不出现在表格中。

---

### 方案 2: 自动检测（预检流程）

#### 流程设计

```
用户输入文本 → /api/persons/resolve（姓名预检）
                ↓
         找到匹配候选人？
           ↓ 是
         显示 NameResolutionPrompt（让用户确认）
           ↓
      用户确认/跳过
           ↓
      替换后的文本 → /api/analyze
           ↓ 是（无匹配）
      直接 → /api/analyze
```

#### 后端 API

**POST /api/persons/resolve**
```typescript
// Request
{ text: string }

// Response
{
  resolutions: [{
    mentionedName: string,        // 文本中提到的人名
    candidates: [{
      id: string,
      name: string,               // 数据库中已有姓名
      similarity: number,         // 0-1，1 = exact match
      matchType: "exact" | "embedding",  // exact=姓名相同，embedding=向量相似
      careers: [{ name, weight }]
    }]
  }]
}
```

**姓名提取逻辑** (`extractNames` 函数)：
```typescript
// 触发词模式：和/与/同/跟/和 /、 + 2字中文名
const triggerPattern = /(?:和|与|同|跟|和 |、)([\u4e00-\u9fa5]{2})/g;

// 通用 2 字中文名扫描（排除时间词等）
const namePattern = /([\u4e00-\u9fa5]{2})/g;
const skipWords = ['今天', '昨天', '明天', '前年', '去年', ...];
```

**匹配逻辑**：
1. **Exact match**：数据库中 `name` 或 `aliases` 数组包含提取到的姓名 → similarity = 1.0
2. **Embedding match**：余弦相似度 > 0.5 → similarity = cosine similarity
3. 返回所有匹配，按 similarity 降序

#### 前端组件

**NameResolutionPrompt** (`src/components/NameResolutionPrompt.tsx`)：
- 显示文本中提到的人名
- 每个姓名显示匹配到的候选人卡片（相似度百分比、职业标签）
- 两个按钮：**确认**（用数据库中的已有记录替换）和 **跳过**（直接提交）
- 用户确认后，返回 `Map<originalName, matchedName>`

**Input 页面更新** (`src/app/input/page.tsx`)：
- `handleSubmit()` 先调用 `/api/persons/resolve`
- 有匹配时：显示 `NameResolutionPrompt`，设置 `pendingText` 等待确认
- 用户确认后：`applyNameResolutions()` 替换文本中的姓名，再调用 `/api/analyze`
- 跳过时：直接调用 `/api/analyze`

---

### 本次会话修改文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `prisma/schema.prisma` | 修改 | 新增 `deletedAt`、`mergedIntoId`、`mergedInto`、`mergedFrom`、`aliases` 字段 |
| `src/app/api/persons/merge/route.ts` | 新增 | 手动合并 API |
| `src/app/api/persons/resolve/route.ts` | 新增 | 姓名预检 API |
| `src/components/MergeConfirmDialog.tsx` | 新增 | 合并确认弹窗 |
| `src/components/NameResolutionPrompt.tsx` | 新增 | 姓名预检确认弹窗 |
| `src/app/members/page.tsx` | 修改 | 新增复选框列、合并按钮 |
| `src/app/input/page.tsx` | 修改 | 新增 resolve 调用流程、分辨率确认 |
| `src/app/api/members/table/route.ts` | 修改 | 过滤软删除/已合并记录 |
| `src/app/api/analyze/route.ts` | 修改 | `ExtractedPersonSchema` 新增 `ambiguous`/`ambiguousWith`/`status: "ambiguous"` |
| `src/components/AmbiguousPrompt.tsx` | 新增 | LLM 追问式模糊确认（保留作为 fallback） |

### 调试记录

#### 问题 A: curl 导致中文 JSON 请求乱码

**症状**：`curl -s -X POST http://localhost:3000/api/persons/resolve -d '{"text":"ABC和老王"}'` 返回 `{"resolutions":[]}`，服务器日志显示 `Received text: ����������`。

**排查过程**：
1. 排除数据库问题：数据库中确实有"老王"记录（embedding 也有）
2. 排除 `extractNames` 问题：Node.js 单独测试函数逻辑正确
3. **根因**：Windows bash 下 curl 发送 UTF-8 JSON 时字符损坏

**验证方法**：用 Node.js HTTP client 替代 curl 测试：
```javascript
const http = require('http');
const data = JSON.stringify({text: '老王'});
// 结果：正确返回 {"resolutions":[{"mentionedName":"老王", ...}]}
```

**结论**：API 本身正确，前端 `fetch()` 调用也正确（浏览器处理 UTF-8 无问题）。curl 仅作为调试工具时需注意编码。

#### 问题 B: Next.js 生产服务器端口占用

**解决方法**：
```bash
netstat -ano | grep :3000   # 查找 PID
taskkill //F //PID <PID>     # 杀死进程
npm start                    # 重启
```

### 技术决策

1. **预检在 analyze 之前**：避免让 LLM 判断同名问题，改用向量相似度在提交前过滤
2. **保留 AmbiguousPrompt 作为 fallback**：当 LLM 在 analyze 阶段仍然检测到模糊时使用
3. **soft-delete 而非硬删除**：保留合并历史，便于审计和回滚
4. **合并后 rebuild embedding**：确保 survivor 的语义表示反映完整合并后的信息

### 当前功能状态

| 功能 | 状态 |
|------|------|
| 手动合并 UI + API | ✅ |
| 姓名预检 API + UI | ✅ |
| 前端 resolve → analyze 流程 | ✅ |
| AmbiguousPrompt（fallback）| ✅ |
| 软删除 + mergedIntoId 追踪 | ✅ |
| InteractionPerson 迁移 | ✅ |
| PersonTag 权重迁移 | ✅ |

### 服务管理

- **开发模式**（不推荐）：`npm run dev` - 端口 30081，但会留僵尸进程
- **生产模式**（推荐）：`npm run build && npm start` - 端口 3000，稳定
- **不用时**：关闭 terminal 或 `taskkill //F //PID <node_pid>`

### settings.json 权限模式

已在 `C:\Users\leona\.claude\settings.json` 中设置：
```json
"permissions": {
  "defaultMode": "auto"
}
```
**重启 Claude Code 后生效**，当前会话不受影响。

---

## 附录 J: 本次会话问题修复 (2026-04-08)

### 问题: 人脉页合并功能无法使用

**症状**: 选择两个对象后点击"合并"按钮，页面闪烁但无任何返回结果。

**根本原因**:
1. `/api/members/[id]` API 返回直接是 `person` 对象 `{id, name, careers...}`
2. 但 `handleMergeClick` 期望嵌套结构 `data.person.id`

**修复方案**:
```typescript
// members/page.tsx — 修复前
id: data.person.id,        // ❌ data.person 是 undefined
name: data.person.name,

// 修复后
id: data.id,              // ✅ 直接访问
name: data.name,
```

### 新增功能: 可选择主条目

**问题**: 原实现自动按 relationshipScore 排序，用户无法选择保留哪条记录。

**修复方案**:
- 引入独立 state `survivorIdForMerge` 管理选中的主条目 ID
- `mergePersons` 数组保持原始选择顺序（不变动）
- `MergeConfirmDialog` 改为通过 `survivorId` 而非 `survivor` 对象判断

### 修复屏幕闪烁问题

**问题 1**: 点击合并按钮后到 Dialog 出现期间，按钮消失导致闪烁。

**修复**: 添加 `mergeLoading` 状态，加载期间按钮显示"加载中..."。

**问题 2**: 合并完成后 `fetchTable()` 触发 loading 状态，导致页面闪烁。

**修复**: 改为直接过滤本地 `rows` 状态，移除被合并的记录，不重新请求 API。

### 本次会话修改文件

| 文件 | 修改内容 |
|------|----------|
| `src/app/members/page.tsx` | 修复 API 响应访问、添加 survivor 选择状态、合并后静默更新 |
| `src/components/MergeConfirmDialog.tsx` | props 改为 `survivorId` 而非 `survivor` 对象 |

### Git 提交

```
fa50c7b fix(members): 修复合并功能
```

### 合并后数据处理说明

| 数据类型 | 处理方式 |
|---------|---------|
| 职业/兴趣标签 | 合并，**新权重 = 旧权重×0.7 + 新权重×0.3** |
| 性格标签 | 取并集 |
| 社交债务 (actionItems) | 随互动记录迁移到主条目 |
| 交往记录 | 通过 InteractionPerson 联接表迁移 |
| 别名 | 全部汇总到主条目 |
| 关系评分 | 取 **max** |
| 最近联系时间 | 取 **最新** |
