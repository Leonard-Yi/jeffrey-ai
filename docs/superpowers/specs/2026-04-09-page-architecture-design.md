# 页面架构与权限设计

> **For agentic workers:** This spec defines the complete page system for Jeffrey.AI — page list, access control, routing logic, and landing page content.

**Goal:** Clarify all pages, their access rules, and navigation flows between them.

**Architecture:** Public landing page for unauthenticated users; all feature pages protected by login + email verification; auth pages protected from already-logged-in users.

**Tech Stack:** Next.js 16 (App Router), NextAuth.js v5 (Auth.js), middleware-based route protection.

---

## 1. 页面清单

| 路径 | 名称 | 访问权限 |
|------|------|---------|
| `/` | 落地页 | 公开；已登录用户 → `/input` |
| `/auth/signin` | 登录页 | 未登录用户；已登录用户 → `/input` |
| `/auth/signup` | 注册页 | 未登录用户；已登录用户 → `/input` |
| `/auth/verify-email` | 邮箱验证 | 公开（通过邮件链接访问） |
| `/auth/verify-request` | 验证提示页 | 注册后未验证用户 |
| `/auth/forgot-password` | 忘记密码 | 公开 |
| `/auth/reset-password` | 重置密码页 | 公开（URL 带 token） |
| `/auth/error` | 错误页 | 公开 |
| `/input` | 录入页 | 需登录 + 已验证邮箱 |
| `/graph` | 图谱页 | 需登录 + 已验证邮箱 |
| `/suggestions` | 建议页 | 需登录 + 已验证邮箱 |
| `/members` | 人脉页 | 需登录 + 已验证邮箱 |

---

## 2. 路由保护规则（Middleware / proxy.ts）

所有功能页（`/input`、`/graph`、`/suggestions`、`/members`）统一在 `proxy.ts` 中检查：

```
未登录 → redirect /auth/signin?reason=unauthenticated
已登录但未验证邮箱 → redirect /auth/verify-request
```

---

## 3. 核心跳转逻辑

### 3.1 未登录访问功能页
```
用户直接访问 /input
  → proxy.ts 检测到未登录
  → redirect /auth/signin?reason=unauthenticated
  → signin 页读取 reason param
  → 顶部显示提示："访问该页面需要先登录"
  → 用户登录成功
  → redirect callbackUrl（默认 /input）
```

### 3.2 已登录用户访问 /
```
访问 /
  → 服务端组件检测 session
  → 有 session → redirect /input
  → 无 session → 渲染落地页
```

### 3.3 已登录用户访问认证页
```
访问 /auth/signin 或 /auth/signup
  → 服务端组件检测 session
  → 有 session → redirect /input
  → 无 session → 正常渲染
```

### 3.4 注册流程
```
用户注册提交
  → 创建用户，发送验证邮件
  → redirect /auth/verify-request
  → 页面提示："验证邮件已发送，请去邮箱点击验证链接"

用户点击邮件中的验证链接
  → GET /auth/verify-email?token=xxx
  → 后端验证 token，成功则更新 emailVerified
  → 返回 { success: true }

前端收到 success
  → 显示"验证成功，3秒后自动跳转登录页..."
  → 3秒倒计时
  → redirect /auth/signin
  → （不在此处自动登录，注册和登录是两个独立步骤）

用户在登录页登录
  → redirect callbackUrl（默认 /input）
```

### 3.5 未验证用户访问功能页
```
proxy.ts 检测到已登录但 emailVerified === null
  → redirect /auth/verify-request
  → 页面提示："请先去邮箱验证您的账号"
```

### 3.6 忘记密码 / 重置密码
```
访问 /auth/forgot-password
  → 输入邮箱 → 后端发送重置邮件
  → 邮件含 /auth/reset-password?token=xxx 链接

点击重置链接
  → /auth/reset-password?token=xxx
  → 输入新密码 → 后端验证 token 并更新密码
  → redirect /auth/signin
```

---

## 4. 落地页内容（`/`）

**产品名称：** Jeffrey.AI

**一句话描述：** 你的 AI 人脉管理助手

**核心功能列表（3条）：**
- **自然录入**：对话中轻松记录人际交往，无需手动填写
- **关系图谱**：可视化你的人际网络
- **智能建议**：AI 驱动的社交时机和建议

**行动入口：**
- 「登录」按钮 → `/auth/signin`
- 「注册」按钮 → `/auth/signup`

**视觉风格：** 简洁克制，白底 + 少量文字，不花哨

---

## 5. 登录页提示信息（`/auth/signin`）

页面顶部根据 `reason` query param 显示不同提示：

| reason param | 提示内容 |
|-------------|---------|
| `unauthenticated` | 访问该页面需要先登录 |
| （无 param） | （不显示提示，正常登录表单）|

提示样式：黄色/蓝色信息条，位于表单上方。

---

## 6. 验证成功页（`/auth/verify-email`）

验证成功后不跳 `/input`（用户尚未登录），而是：

```
验证成功
  → 显示成功消息："邮箱验证成功！"
  → 显示倒计时："3秒后自动跳转登录页..."
  → 3秒后 → redirect /auth/signin
```

倒计时使用 `setTimeout` + `useState` + `useEffect` 实现，纯客户端逻辑。

---

## 7. 现有 Header 保持不变

`src/components/Header.tsx` 已有完整逻辑：
- 有 session → 显示用户邮箱 + 退出按钮
- 无 session → 仅显示导航和搜索栏

无需修改。

---

## 8. 实现任务清单

### Task 1: 创建落地页
- 新建 `src/app/page.tsx`
- 服务端组件，检测 session → 有则 redirect `/input`，无则渲染落地页
- 落地页 UI：简洁白底，产品名 + 描述 + 3个功能点 + 登录/注册按钮

### Task 2: Auth 页面服务端保护
- 修改 `/auth/signin/page.tsx`：服务端检测 session，有则 redirect `/input`
- 修改 `/auth/signup/page.tsx`：同上
- （可选：其他 auth 页面同样处理）

### Task 3: 更新 proxy.ts（Middleware）保护逻辑
- 扩展 `matcher` 包含所有功能页（`/input`、`/graph`、`/suggestions`、`/members`）
- 检查 session：
  - 无 session → redirect `/auth/signin?reason=unauthenticated`
  - 有 session 但未验证邮箱 → redirect `/auth/verify-request`

### Task 4: 更新 signin 页面提示
- 修改 `/auth/signin/page.tsx`：读取 `?reason=unauthenticated` query param
- 有 param 时在表单上方显示提示条："访问该页面需要先登录"

### Task 5: 更新 verify-email 倒计时跳转
- 修改 `/auth/verify-email/page.tsx`：验证成功后显示 3 秒倒计时
- 倒计时结束 → redirect `/auth/signin`

### Task 6: 更新文档中的功能描述
- 检查 `docs/project-progress.md`，将"智能录入"相关描述改为"自然录入"
- 如有其他文档提及"智能录入"，一并更新

---

## 9. 落地页 UI 草图

```
┌──────────────────────────────────────────────┐
│  Jeffrey.AI                                   │
│                                              │
│  你的 AI 人脉管理助手                          │
│                                              │
│  ── 自然录入                                  │
│     对话中轻松记录人际交往，无需手动填写         │
│                                              │
│  ── 关系图谱                                  │
│     可视化你的人际网络                         │
│                                              │
│  ── 智能建议                                  │
│     AI 驱动的社交时机和建议                    │
│                                              │
│  [登录]  [注册]                               │
└──────────────────────────────────────────────┘
```

---

## 10. 移除功能点说明

**「智能录入」相关内容全部移除：**
- 原 auth 设计文档中提到的"智能录入"改为"自然录入"
- `docs/project-progress.md` 等文档中同步更新
- 后续规划文档中不再出现"智能录入"字样
