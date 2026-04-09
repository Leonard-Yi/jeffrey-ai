# 页面架构与权限实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement complete page architecture: public landing page, auth page protection, feature page access control, verify-email countdown redirect.

**Architecture:** Landing page as server component detecting session; auth pages as server-component wrappers redirecting authenticated users; proxy.ts (middleware) enforcing feature page protection with email verification check; verify-email page client-side countdown to signin.

**Tech Stack:** Next.js 16 (App Router), NextAuth.js v5 (Auth.js), TypeScript.

---

## 文件变更总览

| 操作 | 文件路径 |
|------|---------|
| Create | `src/app/page.tsx` |
| Modify | `src/app/auth/signin/page.tsx` |
| Modify | `src/app/auth/signup/page.tsx` |
| Modify | `src/proxy.ts` |
| Modify | `src/app/auth/verify-email/page.tsx` |
| Modify | `docs/project-progress.md` |

---

## Task 1: 创建落地页

**Files:**
- Create: `src/app/page.tsx`

- [ ] **Step 1: 创建落地页服务端组件**

```tsx
// src/app/page.tsx
import { auth } from "@/lib/auth"
import Link from "next/link"
import { redirect } from "next/navigation"

export default async function LandingPage() {
  const session = await auth()

  // 已登录用户直接跳转 /input
  if (session) {
    redirect("/input")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-xl w-full p-8 bg-white rounded-lg shadow-md text-center">
        <h1 className="text-4xl font-bold mb-3" style={{ fontFamily: "Georgia, serif" }}>
          Jeffrey.AI
        </h1>
        <p className="text-lg text-gray-600 mb-8">你的 AI 人脉管理助手</p>

        <div className="space-y-6 text-left mb-10">
          <div>
            <h2 className="text-base font-semibold text-gray-800">自然录入</h2>
            <p className="text-sm text-gray-500">对话中轻松记录人际交往，无需手动填写</p>
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-800">关系图谱</h2>
            <p className="text-sm text-gray-500">可视化你的人际网络</p>
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-800">智能建议</h2>
            <p className="text-sm text-gray-500">AI 驱动的社交时机和建议</p>
          </div>
        </div>

        <div className="flex gap-4 justify-center">
          <Link
            href="/auth/signin"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            登录
          </Link>
          <Link
            href="/auth/signup"
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
          >
            注册
          </Link>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add src/app/page.tsx
git commit -m "feat(pages): add landing page at /"
```

---

## Task 2: 为登录页添加服务端登录检测

**Files:**
- Modify: `src/app/auth/signin/page.tsx`（重构成服务端 wrapper + 客户端 form）

- [ ] **Step 1: 将 signin page 改为服务端 wrapper，客户端 form 抽离为 SignInForm**

将现有的 `src/app/auth/signin/page.tsx` 内容拆分为两部分：
- 服务端 page.tsx：检测 session → 有则 redirect `/input`
- 客户端 SignInForm：保留所有现有表单逻辑（useState、handleSubmit 等）

**新的 `src/app/auth/signin/page.tsx`：**

```tsx
// src/app/auth/signin/page.tsx
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import SignInForm from "./SignInForm"

export default async function SignInPage() {
  const session = await auth()
  if (session) redirect("/input")

  return <SignInForm />
}
```

**新的 `src/app/auth/signin/SignInForm.tsx`：**

将原有 page.tsx 中的所有内容（"use client"、imports、SignInContent 函数、Suspense wrapper）移动到此文件，文件改名为 `SignInForm.tsx`，组件名改为 `SignInForm`。

- [ ] **Step 2: 提交**

```bash
git add src/app/auth/signin/page.tsx src/app/auth/signin/SignInForm.tsx
git commit -m "refactor(auth): split signin into server wrapper + client form"
```

---

## Task 3: 为注册页添加服务端登录检测

**Files:**
- Modify: `src/app/auth/signup/page.tsx`（同上，拆分为 server wrapper + client form）

- [ ] **Step 1: 将 signup page 改为服务端 wrapper，客户端 form 抽离为 SignUpForm**

**新的 `src/app/auth/signup/page.tsx`：**

```tsx
// src/app/auth/signup/page.tsx
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import SignUpForm from "./SignUpForm"

export default async function SignUpPage() {
  const session = await auth()
  if (session) redirect("/input")

  return <SignUpForm />
}
```

**新的 `src/app/auth/signup/SignUpForm.tsx`：**

将原有 page.tsx 中的所有内容移动到此文件，组件名改为 `SignUpForm`。

- [ ] **Step 2: 提交**

```bash
git add src/app/auth/signup/page.tsx src/app/auth/signup/SignUpForm.tsx
git commit -m "refactor(auth): split signup into server wrapper + client form"
```

---

## Task 4: 更新 proxy.ts（Middleware）保护逻辑

**Files:**
- Modify: `src/proxy.ts`

- [ ] **Step 1: 读取现有 proxy.ts 内容，理解当前 matcher 和 auth 逻辑**

- [ ] **Step 2: 更新 proxy.ts，添加功能页保护**

修改 `src/proxy.ts`，在现有的 `auth()` 调用基础上，添加 emailVerified 检查：

```ts
// src/proxy.ts
export { auth as proxy } from "@/lib/auth"

export const config = {
  matcher: [
    "/input",
    "/graph",
    "/suggestions",
    "/members",
    "/((?!auth|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
}

// 在 auth 回调中可以通过 token.id 获取用户 id，再查数据库检查 emailVerified
// 建议在 proxy.ts 中用 auth() 获取 session，然后检查：
// - 无 session → /auth/signin?reason=unauthenticated
// - 有 session 但 emailVerified === null → /auth/verify-request
```

具体实现方式：在 `proxy.ts` 中使用 Next.js Middleware 的 `NextRequest` 和 `NextResponse`，从 session 获取用户信息，查询 `emailVerified` 字段（需引入 `@/lib/db` 的 prisma 实例）。

**完整重写 `src/proxy.ts` 如下：**

```ts
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

const PUBLIC_PATHS = ["/", "/auth/signin", "/auth/signup", "/auth/forgot-password",
  "/auth/reset-password", "/auth/verify-email", "/auth/verify-request", "/auth/error"]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 静态资源等直接放行
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/favicon.ico" ||
    pathname.includes(".")
  ) {
    return NextResponse.next()
  }

  // 公开路径放行
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith("/auth/"))) {
    return NextResponse.next()
  }

  // 其他路径需要登录
  const session = await auth()
  if (!session) {
    const signinUrl = new URL("/auth/signin", request.url)
    signinUrl.searchParams.set("reason", "unauthenticated")
    return NextResponse.redirect(signinUrl)
  }

  // 检查邮箱验证
  if (!session.user?.id) {
    const signinUrl = new URL("/auth/signin", request.url)
    signinUrl.searchParams.set("reason", "unauthenticated")
    return NextResponse.redirect(signinUrl)
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailVerified: true },
  })

  if (!user?.emailVerified) {
    return NextResponse.redirect(new URL("/auth/verify-request", request.url))
  }

  return NextResponse.next()
}
```

- [ ] **Step 3: 提交**

```bash
git add src/proxy.ts
git commit -m "feat(middleware): protect feature pages with login + email verification check"
```

---

## Task 5: 更新 signin 页面 reason param 提示

**Files:**
- Modify: `src/app/auth/signin/SignInForm.tsx`

- [ ] **Step 1: 在 SignInForm 中读取 reason query param 并显示提示**

在 `SignInForm` 组件中：

1. 添加 `useSearchParams` 获取 `reason` param
2. 在表单上方（有 error div 的位置）添加条件渲染的提示条

```tsx
// 在 SignInForm.tsx 的 useSearchParams 获取 reason
const searchParams = useSearchParams()
const reason = searchParams.get("reason")

// 在 error div 之前添加提示条（有 reason 时显示，无 reason 时不显示）
{reason === "unauthenticated" && (
  <div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded text-sm">
    访问该页面需要先登录
  </div>
)}
```

- [ ] **Step 2: 提交**

```bash
git add src/app/auth/signin/SignInForm.tsx
git commit -m "feat(auth): show prompt when redirected to signin without login"
```

---

## Task 6: 更新 verify-email 倒计时跳转

**Files:**
- Modify: `src/app/auth/verify-email/page.tsx`

- [ ] **Step 1: 将 verify-email page 拆分为 server wrapper + client form（与 signin/signup 相同模式）**

**新的 `src/app/auth/verify-email/page.tsx`：**

```tsx
// src/app/auth/verify-email/page.tsx
import VerifyEmailForm from "./VerifyEmailForm"

export default function VerifyEmailPage() {
  return <VerifyEmailForm />
}
```

**新的 `src/app/auth/verify-email/VerifyEmailForm.tsx`：**

将现有 `page.tsx` 内容移入 `VerifyEmailForm` 组件，改造 `status === "success"` 分支：

```tsx
// VerifyEmailForm.tsx 中 status === "success" 的分支改为：
if (status === "success") {
  const [countdown, setCountdown] = useState(3)

  useEffect(() => {
    if (countdown <= 0) {
      window.location.href = "/auth/signin"
      return
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-md text-center">
        <h1 className="text-2xl font-bold mb-4 text-green-600">邮箱验证成功</h1>
        <p className="mb-4 text-gray-600">您的邮箱已验证成功。</p>
        <p className="text-sm text-gray-500 mb-4">{countdown}秒后自动跳转登录页...</p>
        <Link href="/auth/signin" className="text-blue-600 hover:underline">
          立即跳转
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add src/app/auth/verify-email/page.tsx src/app/auth/verify-email/VerifyEmailForm.tsx
git commit -m "feat(auth): add 3-second countdown redirect after email verification"
```

---

## Task 7: 更新文档中的功能描述

**Files:**
- Modify: `docs/project-progress.md`

- [ ] **Step 1: 检查 docs/project-progress.md，将所有"智能录入"替换为"自然录入"**

使用 `grep` 查找所有出现"智能录入"的位置，逐个替换。

- [ ] **Step 2: 提交**

```bash
git add docs/project-progress.md
git commit -m "docs: rename '智能录入' to '自然录入' in progress doc"
```

---

## 验证步骤

所有任务完成后，按以下步骤验证：

```bash
# 1. 确保 dev server 未运行
# 如果在运行，kill node 进程

# 2. 重新 build（生产模式验证）
npm run build

# 3. 启动生产 server
npm start

# 4. 手动测试流程：
# - 访问 http://localhost:3000 → 应显示落地页
# - 访问 http://localhost:3000/input → 应跳转 /auth/signin?reason=unauthenticated，页面顶部显示蓝色提示
# - 注册新账号 → /auth/verify-request → 邮箱验证链接 → 验证成功 → 3秒倒计时 → /auth/signin
# - 登录后访问 /auth/signin → 应直接跳转 /input
# - 登录后访问 / → 应直接跳转 /input
```
