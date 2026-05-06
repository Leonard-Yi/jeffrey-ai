# Code Review Report — 2026-04-27

## 概述

对 Jeffrey.AI 项目进行了全面代码审查，覆盖 22 个 API 路由、11 个 lib 工具、10 个前端组件、8 个页面。共发现 15 个问题，其中 **5 Critical/High 已修复**，**5 Medium 已修复**，**5 Medium/Low 待处理**。

---

## 已修复问题（2026-04-27）

### Critical

**C1. `prisma.$disconnect()` 破坏全局单例**
- 文件：`src/app/api/debug/route.ts`
- 问题：debug 路由在 `finally` 块中调用 `prisma.$disconnect()`，但 `prisma` 是全局共享单例（`src/lib/db.ts`）。一旦调用，共享连接被关闭，后续所有数据库请求崩溃。
- 修复：移除 `finally` 块，统一错误响应为 `"Internal server error"`

**C2. API 路由泄露内部错误信息（8 个端点）**
- 涉及文件：`search`、`members/[id]`、`members/table`、`persons/merge`、`persons/resolve`、`debug`、`analyze`、`suggestions/icebreaker`
- 问题：`(error as Error).message` 直接返回给客户端，可能暴露数据库结构、文件路径、第三方 API 响应等敏感信息
- 修复：统一改为 `{ error: "Internal server error" }`，仅服务端 `console.error` 保留详情

### High

**H3. 冰 breaker 缓存无上限增长**
- 文件：`src/app/api/suggestions/icebreaker/route.ts`
- 问题：`Map<string, { data, expiry }>` 缓存仅在 `setCache` 时清理过期项，若大量请求命中缓存（走 `getCached`），过期条目永不清理，随人物数量线性增长。
- 修复：
  - 添加 `CACHE_MAX_SIZE = 200` 上限
  - 超限时按 expiry 淘汰最旧条目（LRU）
  - `getCached` 也执行过期清理

**H4. API 端点缺少运行时输入验证**
- 涉及文件：`persons/merge`、`persons/resolve`、`interactions/[id]/actionItems`、`search`
- 问题：使用裸 `as` 类型断言，无 Zod 运行时验证，恶意请求可传入任意 JSON 破坏业务逻辑
- 修复：为所有 4 个端点添加 Zod schema 验证，400 返回第一条错误信息

**H5. Auth 页面 CSS 类名未定义**
- 涉及文件：`auth/forgot-password`、`auth/reset-password`、`auth/verify-email`、`auth/error`、`auth/verify-request`
- 问题：使用 `auth-card-title`、`auth-alert`、`auth-input` 等类名，但 `globals.css` 仅定义了 `.card`、`.btn` 等通用类，`auth-` 前缀变体不存在，样式完全失效。
- 修复：在 `globals.css` 中新增 `.auth-card-title`、`.auth-form-group`、`.auth-label`、`.auth-input`、`.auth-button`、`.auth-alert-success`、`.auth-alert-error` 样式定义

### Medium

**M6. PersonModal.tsx 过大（~1400 行）**
- 文件：`src/components/PersonModal.tsx`
- 问题：内嵌 `MultiIntroducerSelector`（~230 行）和 `FieldCard`（~70 行）组件，单文件过大难以维护
- 修复：拆分为独立文件 `src/components/MultiIntroducerSelector.tsx` 和 `src/components/FieldCard.tsx`，PersonModal 重写为 ~500 行，使用 design tokens

**M7. 硬编码色值绕过设计系统**
- 涉及文件：`PersonModal.tsx`（STYLES 对象 190 行）、`NameResolutionPrompt.tsx`、`SuggestionCard.tsx`
- 问题：使用原始 hex 色值（如 `#3a2a1a`、`#c8a96e`），与 `src/lib/design-tokens.ts` 设计系统不一致，改主题需改多处
- 修复：全部迁移到 `tokens as C` 对象引用

**M9. GraphCanvas mouseleave 事件监听器无法清理**
- 文件：`src/components/GraphCanvas.tsx:131`
- 问题：`canvas.addEventListener('mouseleave', () => onNodeHover(null))` 使用箭头函数，`removeEventListener` 时传入不同引用，清理无效
- 修复：提取为具名函数 `const onMouseLeave = () => onNodeHover(null)`，正确 cleanup

**M10. 无 React Error Boundary**
- 问题：app 目录下无 `error.tsx`，任何未捕获的 React 渲染错误导致整页白屏
- 修复：为 `input`、`graph`、`members`、`suggestions` 四个关键路由段添加 `error.tsx`

---

## 待处理问题（已记录，建议近期修复）

### Medium

**M8. UI 组件库未被充分使用**
- 问题：
  - auth 表单（SignInForm, SignUpForm）手动渲染 input/button，未使用 `ui/Input`、`ui/Button`
  - `input/page.tsx` 内联的 `JeffreyAvatar`、`TagPill`、`StatusDot` 与 `ui/Avatar`、`ui/Tag`、`ui/Badge` 重复
  - `suggestions/page.tsx` 内联 SVG 图标可提取复用
- 影响：代码重复，样式不一致
- 建议：统一使用 `src/components/ui/` 组件库

**M12. 不一致的验证模式**
- 问题：Zod schema 验证（`register`、`analyze`）和手动内联验证（多数其他端点）并存。手动验证依赖 TypeScript `as` 断言，无运行时安全保障
- 建议：建立统一验证模式，所有 API 入口使用 Zod schema（已在 H4 中完成主要端点）

### Low

**L13. `C` / `tokens` 双重导出命名混淆**
- 文件：`src/lib/design-tokens.ts`
- 问题：同时导出 `tokens` 和 `C`（同一对象），代码中混用 `{ tokens as C }` 和 `{ C }` 导入方式
- 建议：统一为一个导出名

**L14. `AuthLayout` 和 `AuthCard` 视觉重叠**
- 文件：`src/components/AuthLayout.tsx` + `src/app/auth/_components/AuthCard.tsx`
- 问题：两者都有装饰性圆圈和 "Jeffrey.AI" 品牌标识，嵌套使用时可能重复渲染

**L15. 遗留 Qwen 提取服务（已评估）**
- 文件：`src/services/llmExtractor.ts`（DashScope `qwen3.5-plus`）、`src/services/dbService.ts`
- 结论：主应用已全面使用 MiniMax API（`src/app/api/analyze/route.ts`），但测试脚本（`src/test/testExtractor.ts`、`src/test/fullPipelineTest.ts`）依赖这些服务，**暂时保留**
- 建议：确认测试脚本用途后决定是否迁移到 MiniMax 或删除

---

## 架构观察（供参考）

### 已确认的安全实践
- **密码比较**：使用 bcrypt dummy hash 防止时序攻击（`src/lib/auth.ts`）
- **用户枚举防护**：forgot-password 返回相同消息无论用户是否存在
- **JWT session**：NextAuth v5 JWT 策略，无数据库 session 泄漏风险
- **Prisma 单例**：全局共享 `PrismaClient` 实例，连接复用

### 性能观察
- **搜索路由**（`search/route.ts`）：每次请求全表扫描 + O(n) cosine similarity 计算，无索引加速，大数据集需优化
- **图谱路由**（`graph/route.ts`）：嵌套 `include` 链可能产生 N+1 查询，需注意
- **embedding 队列**（`embeddingQueue.ts`）：最大并发 2，队列满时静默丢弃任务，需监控

### 代码质量观察
- **两套样式系统并存**：inline `style={C.primary}` 和 CSS 类名 `.auth-card-title`，维护成本高
- **组件拆分不足**：`input/page.tsx`（~820 行）、`suggestions/page.tsx`（~400 行）过大
- **无数据获取库**：全用 `useEffect + fetch`，无请求去重/缓存/乐观更新封装

---

## 验证清单

修复后需验证：
- [ ] `npm run build && npm start` 正常启动
- [ ] `npm run typecheck` 无错误
- [ ] 调用 `/api/debug` 后其他 API 仍正常工作
- [ ] 向各 API 发送错误请求，响应无敏感信息
- [ ] `/auth/forgot-password` 等页面样式正常
- [ ] E2E 测试通过：`npx playwright test`
