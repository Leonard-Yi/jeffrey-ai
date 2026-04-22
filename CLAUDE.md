# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**jeffrey-ai** is a TypeScript/Node.js relationship intelligence system. It uses an LLM (Alibaba Qwen via DashScope API) with function calling to extract structured social interaction data from unstructured Chinese-language conversational logs and stores it in a PostgreSQL knowledge graph.

## Server Modes

### ⚠️ Development Mode (`npm run dev`) — **已禁用，禁止使用**

Next.js 16 的 Turbopack 会在启动时瞬间产生 10+ 个 node worker 进程（每个 50-60MB），极易导致内存爆满和系统卡顿，且无有效方式禁用 Turbopack。**绝对不要运行 `npm run dev`**。

如确需开发模式调试（非常不推荐），需自行手动运行并密切监控内存：
```bash
npx tsx scripts/check-resources.ts && next dev -p 30081
```

### Production Mode (`npm start`) — **唯一允许的模式**
- **Port**: 3000
- **Build first**: `npm run build` (Node.js capped at 8GB via `NODE_OPTIONS=--max-old-space-size=8192`)
- **Type check separately**: `npm run typecheck` (runs `tsc --noEmit` without triggering bundling)
- **Start**: `npm start`
- **⚠️ Before build**: Kill all node processes first:
  ```bash
  taskkill //F //IM node.exe
  ```
- **Profile**: Single process, minimal CPU/memory (~50MB), stable and fast
- **When to use**: 所有场景（开发、测试、生产）

### Resource Check
```bash
# 启动前检查系统内存（会自动运行，也可以单独跑）
npm run check-mem

# 查看运行中服务器的内存占用
curl http://localhost:3000/api/health
```

### Workflow
```
改代码 → npm run build && npm start 测试 → 确认没问题 → npm run typecheck（类型检查）
不用 server 时 → 关掉 terminal 或 taskkill //F //IM node.exe
出现bug → 使用/systematic-debugging技能
遇到 graph/图谱 相关问题时 → 查阅 `docs/knowledge-graph-visualization-research.md` 第22行"调试经验记录"章节
处理 Vercel/部署 相关问题时 → 查阅 `docs/vercel-deployment.md`，尤其是在commit之后要用vercel CLI手动部署并再次检查版本是否最新
完成工作后 → 调用 ecc:e2e 技能跑一个测试
```

### Prerequisites
Start the PostgreSQL database via Docker before running anything:
```bash
docker-compose up -d
```

### Running Tests
```bash
# Test only the LLM extractor (no DB required)
npx tsx --env-file=.env src/test/testExtractor.ts

# Full end-to-end pipeline test (requires DB running)
npx tsx --env-file=.env src/test/fullPipelineTest.ts
```

These are also available as npm scripts:
```bash
npm run test:extract
npm run test:pipeline
```

### E2E Testing (Playwright)

**⚠️ Before running or writing E2E tests, read [docs/e2e-test-plan.md](docs/e2e-test-plan.md)**

Contains:
- Test structure and Page Object patterns
- Running commands
- **8 debugging lessons** learned from merge flow tests (session handling, condition waiting, CSS selector fragility, etc.)
- Test user setup (`test@test.com`)

### Running Any Script
```bash
npx tsx --env-file=.env <path-to-script>
```

### Database Migrations
```bash
npx prisma migrate dev    # Apply migrations in development
npx prisma migrate deploy # Apply migrations in production
npx prisma studio         # Open Prisma GUI
```

## Architecture

### Data Flow
```
Unstructured Chinese text input
  → llmExtractor.ts  (Qwen LLM + tool calling → structured ExtractionPayload)
  → dbService.ts     (Prisma → PostgreSQL)
```

### Core Models (`prisma/schema.prisma`)
- **Person** — graph node; stores weighted tag arrays (`careers`, `interests` as JSONB), `vibeTags` (text[]), `relationshipScore` (0–100), `lastContactDate`
- **Interaction** — a social event; stores `contextType`, `sentiment`, `actionItems` (JSONB), `coreMemories` (text[])
- **InteractionPerson** — join table for many-to-many Person↔Interaction
- **PersonTag** — denormalized flat index mirroring Person tags for fast clustering queries; rebuilt on every upsert

### LLM Extraction (`src/services/llmExtractor.ts`)
- Model: `qwen3.5-plus` via Alibaba DashScope, accessed through the `openai` SDK pointed at `https://dashscope.aliyuncs.com/compatible-mode/v1`
- Enforces schema via tool calling: the LLM must call `save_extraction` with a payload matching `ExtractionPayloadSchema`
- Returns `status: "complete"` or `status: "pending"` with a `followUpQuestion`
- Completeness is validated both by the LLM and by a deterministic rule (≥1 career, sentiment present, ≥1 actionItem)

### Tag Weight Merging (`src/services/dbService.ts`)
When a Person already exists, tags are merged (not overwritten) with a recency bias:
```
new_weight = prev_weight * 0.7 + incoming_weight * 0.3
```
`RECENCY_BIAS = 0.3` — adjust this constant to tune how quickly new observations override history.

### Zod Schemas (`src/schemas/core.ts`)
All data shapes are defined as Zod schemas. These schemas are converted to JSON Schema via `zod-to-json-schema` and passed directly to the LLM as tool definitions — the single source of truth for both runtime validation and LLM prompting.

## Environment Variables (`.env`)
```
DASHSCOPE_API_KEY=   # Alibaba DashScope API key
DATABASE_URL=        # PostgreSQL connection string
```

## Key Design Decisions
- **Chinese-first** — system prompts, vibe tags, and test data are all in Mandarin
- **Design tokens** — all colors in `src/lib/design-tokens.ts` (LIGHT_THEME/DARK_THEME); components reference tokens, never raw values
- **Frontend design** — use `ecc:frontend-design` skill for UI/styling changes to ensure cohesive design
- **Test isolation** — full pipeline tests prefix all records with `__test__` and clean up before/after to avoid polluting real data
- `tsx` is used as the TypeScript runtime (no build step needed for development)

## Deployment

### Current Platform: Vercel
- **URL**: https://jeffrey-ai.vercel.app
- **Database**: Supabase (Session Pooler for IPv4 compatibility)
- **Branch**: `master` 分支

### ⚠️ Vercel 部署方式：必须手动执行
**Vercel 并不会在 git push 后自动部署，必须手动运行命令：**
```bash
vercel --prod
```
仅 commit + push 不会触发部署。

### Vercel Deployment Checklist
1. 确保修复在 `master` 分支上
2. `git push` 推送代码
3. 运行 `vercel --prod` 手动部署
4. 检查 Vercel Dashboard 确认部署完成，确保版本正确
5. 清除浏览器缓存或用隐私模式验证（避免旧 JS 缓存）

## Common Pitfalls

### Chinese Text / Encoding
- Always specify `charset=utf-8` in Content-Type headers
- Use `request.text()` for raw body parsing, not `request.json()` — avoids encoding issues
- When testing APIs with curl on Windows, use Node.js HTTP client instead (curl corrupts UTF-8)

### Server/Client Component Boundary
- Event handlers (`onClick`, `onMouseEnter`, etc.) belong only in Client Components
- Hooks must be at the top level of components
- If you see "event handlers not valid in Server Component" — move the handler to a Client Component

### Playwright E2E Testing
- **Navigation**: Use link clicks (`page.click('a')`) instead of `page.goto()` — preserves session cookies
- **State waiting**: Use `waitForFunction` for React state, not fixed `waitForTimeout`
- **Selectors**: Avoid inline style selectors (`[style*="..."]`); use semantic selectors or `data-testid`
- **Locators vs ElementHandle**: Prefer locators — ElementHandle goes stale easily
- **Test isolation**: Merge operations soft-delete; reset test data in `beforeEach`

### Type Safety / Zod
- MiniMax API returns `null` for empty fields — use `nullToUndefined()` normalizer before Zod validation
- Array fields from JSONB: always add `?? []` guard before `.join()` or `.map()`
- Recursive Zod schemas can cause TypeScript infinite instantiation — use `@ts-ignore` as workaround

### MiniMax API
- **端点**: `https://api.minimaxi.com/anthropic/v1/messages`（注意是 `minimaxi.com`，不是 `minimax.chat`）
- **Headers**: 需要同时传 `Authorization: Bearer` 和 `x-api-key`
- **Content 格式**: 返回的 `content` 是数组，`type === "tool_use"` 是工具调用，`type === "text"` 是文本，`type === "thinking"` 是思考过程（忽略）
- **Null 值**: MiniMax 返回 `null` 而非 `undefined`，Zod 严格模式会拒绝 — 用 `nullToUndefined()` 归一化后再验证

### Prisma
- JSONB fields default to `null`, not `[]` — add `default([])` in schema or handle null in code
- After schema changes: run `npx prisma generate` before rebuilding

### Build / Memory
- Turbopack starts ~15 workers during build — requires ~22GB available memory
- If build OOMs: close other programs (Docker Desktop, WSL, VSCode) first
- Before any `npm run build`: kill residual node processes to avoid ENOENT errors


## Version Control

See [docs/version-control-strategy.md](docs/version-control-strategy.md) for the full strategy.

### Branch Model
```
master        ← 生产环境（受保护，禁止直接推送）
    ↑
feature/*    ← 新功能分支
hotfix/*     ← 紧急修复分支
```

### Commit Format
```
<类型>(<范围>): <简短描述>

类型: feat | fix | docs | style | refactor | perf | test | chore
```

### Quick Commands
```bash
# 创建功能分支
git checkout -b feature/my-feature

# 提交更改
git add -A && git commit -m "feat(analyze): 添加新功能"

# 切回 master 并拉取最新
git checkout master && git pull

# 查看提交历史
git log --oneline -10
```

### Rollback
```bash
# 回滚单个提交
git revert <commit-hash>

# 回滚到指定版本
git checkout v1.0.0 && npm run build && npm start
```

### ⚠️ Vercel 部署与 Git Branch 对齐
**关键**：Vercel 监听 master 分支。在 worktree 或其他分支上开发的修复必须先合并到 master 才能部署。经常犯的错误是在 feature 分支上修复了 bug 但没有合并，导致在 Vercel 上测试时发现修复没生效。

### Worktree 强制使用规则
**所有新功能/修复必须通过 Worktree 开发，禁止直接在主目录操作**：

```bash
# 创建新功能 Worktree
git worktree add .claude/worktrees/feature/my-feature -b feature/my-feature
cd .claude/worktrees/feature/my-feature
# 开发 → 测试 → 提交

# 完成后切回主目录合并
git checkout master
git merge --no-ff feature/my-feature
git branch -d feature/my-feature
git worktree remove .claude/worktrees/feature/my-feature
```

**为什么**：保持主目录（master 分支）始终处于干净状态，可随时切到其他项目而不影响本项目。

**Worktree 列表**：
- 主目录 (`d:\Epstein.AI`) — master 分支
- `.claude/worktrees/deploy-vercel` — worktree-deploy-vercel
- `.claude/worktrees/fix+merge-bug` — worktree-fix+merge-bug
- `.claude/worktrees/ralph-frontend-redesign` — ralph/frontend-redesign

---

### Parallel Development with Worktrees

**⚠️ Critical: Merge worktrees one at a time**

Using multiple worktrees for parallel development is supported, but merging must follow this order to avoid hidden bugs:

```
1. Worktree A complete → cherry-pick to master → test → confirm stable
2. Worktree B complete → cherry-pick to master → test → confirm stable
3. NEVER cherry-pick multiple worktrees on the same HEAD simultaneously
```

**Why**: Even if Git auto-merges successfully, two worktrees modifying the same file (different regions) may have logical coupling that causes runtime bugs undetectable by Git.

**If two worktrees modify the same area of the same file**: Git will report a conflict and stop — this is actually the safe case. The dangerous case is when Git merges successfully but the combined logic is broken.

**If you must merge simultaneously**: Fully test the first merge before starting the second. Do not assume "no Git conflict = safe".

---

## 工作区规则

**每个项目使用独立的 workspace 目录。所有文件必须放在正确的目录下，不得跨工作区存放文件。**

当前工作区：`D:\Epstein.AI`（主项目）

其他工作区：
- `d:\_workflow_cc` — 其他项目和研究工作区

在开始任何工作时，先确认当前工作区（`pwd` 或窗口标题），所有文件操作必须在当前工作区内完成。
