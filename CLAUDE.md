# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**jeffrey-ai** is a TypeScript/Node.js relationship intelligence system. It uses an LLM (Alibaba Qwen via DashScope API) with function calling to extract structured social interaction data from unstructured Chinese-language conversational logs and stores it in a PostgreSQL knowledge graph.

## Server Modes

### Development Mode (`npm run dev`)
- **Port**: 30081 (not 3000, to avoid conflicts)
- **Start**: `npm run dev`
- **Profile**: Uses Turbopack, runs ~18 Node workers, heavy CPU/memory usage
- **When to use**: Active coding, code changes frequently
- **⚠️ Warning**: Dev mode leaves background node processes after termination. Always kill manually:
  ```bash
  # Kill all Epstein-related node processes
  wmic process where "name='node.exe' and CommandLine like '%Epstein%'" get ProcessId | tail -n +2 | xargs -I{} taskkill //F //PID {}
  ```
- **⚠️ Memory issue**: Next.js 16 + Turbopack requires ~22GB+ free RAM. If free RAM is low, dev server will be extremely slow. Close other apps (VSCode, WSL, Docker) before running.

### Production Mode (`npm start`)
- **Port**: 3000
- **Build first**: `npm run build` (requires ~22GB free RAM)
- **Start**: `npm start`
- **Profile**: Single process, minimal CPU/memory (~50MB), stable and fast
- **When to use**: Daily usage, demo, extended sessions

### Workflow
```
改代码 → npm run dev 测试 → 确认没问题 → npm run build && npm start 生产模式
不用 server 时 → 关掉 terminal 或 kill node 进程
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
- **Test isolation** — full pipeline tests prefix all records with `__test__` and clean up before/after to avoid polluting real data
- `tsx` is used as the TypeScript runtime (no build step needed for development)

## Version Control

See [docs/version-control-strategy.md](docs/version-control-strategy.md) for the full strategy.

### Branch Model
```
main          ← 生产环境（受保护，禁止直接推送）
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

# 切回 main 并拉取最新
git checkout main && git pull

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
