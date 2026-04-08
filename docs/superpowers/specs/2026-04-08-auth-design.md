# 用户认证与多用户数据隔离设计

**日期：** 2026-04-08
**状态：** 已批准

## 1. 概述

为 Epstein.AI 添加用户认证系统和多用户数据隔离。使用 NextAuth.js + Credentials Provider + 邮箱密码登录，支持多用户注册、邮箱验证、密码重置。所有用户数据通过 `userId` 字段隔离。

## 2. 技术选型

- **认证框架：** NextAuth.js v5 (Beta)
- **数据库 Adapter：** @auth/prisma-adapter
- **密码加密：** bcrypt
- **邮件服务：** SMTP (nodemailer)
- **Session 策略：** JWT

## 3. 数据模型变更

### 3.1 新增 Model

```prisma
model User {
  id            String    @id @default(uuid())
  email         String    @unique
  passwordHash  String
  name          String?
  emailVerified DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts      Account[]
  sessions      Session[]
  persons       Person[]
  interactions  Interaction[]
}

model Account {
  id                String  @id @default(uuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(uuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String   @unique
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

### 3.2 修改现有 Model

```prisma
model Person {
  // ... 现有字段 ...
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model Interaction {
  // ... 现有字段 ...
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

**注意：** `PersonTag` 和 `InteractionPerson` 通过级联自动隔离。

## 4. API 设计

### 4.1 认证 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/[...nextauth]` | NextAuth 处理函数 |
| GET | `/api/auth/verify-email` | 邮箱验证 |
| POST | `/api/auth/forgot-password` | 发送密码重置邮件 |
| POST | `/api/auth/reset-password` | 重置密码 |

### 4.2 数据 API 改造

所有数据 API 需要在 `where` 条件中加入 `userId` 过滤：

```typescript
// GET /api/members
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const persons = await prisma.person.findMany({
    where: { userId: session.user.id },
    // ... 其他条件
  })
}
```

**需要改造的 API：**
- `/api/members` — 成员列表
- `/api/members/[id]` — 成员详情/修改/删除
- `/api/members/count` — 成员数量
- `/api/members/table` — 表格数据
- `/api/analyze` — 分析输入
- `/api/graph` — 图谱数据
- `/api/search` — 搜索
- `/api/persons/[id]/icebreaker` — 破冰助手
- `/api/persons/merge` — 合并人物
- `/api/persons/resolve` — 消歧
- `/api/interactions/[id]/actionItems` — 行动项
- `/api/suggestions/*` — 建议相关

### 4.3 注册 API 响应

```typescript
// POST /api/auth/register
// Request: { email, password, name }
// Response: { success: true, message: "验证邮件已发送" }
// Error: { error: "邮箱已被注册" } 409
```

## 5. 前端页面

### 5.1 认证页面

| 路径 | 说明 |
|------|------|
| `/auth/signin` | 登录页 |
| `/auth/signup` | 注册页 |
| `/auth/error` | 错误页 |
| `/auth/verify-request` | 验证邮件已发送提示 |
| `/auth/verify-email` | 邮箱验证成功页 |
| `/auth/forgot-password` | 忘记密码页 |
| `/auth/reset-password` | 重置密码页 |

### 5.2 路由保护

创建 `src/middleware.ts`：

```typescript
export { auth as middleware } from "@/lib/auth"

export const config = {
  matcher: ["/((?!auth|api/auth|_next/static|_next/image|favicon.ico).*)"]
}
```

未登录用户访问受保护页面时，重定向到 `/auth/signin`。

## 6. 邮件模板

### 6.1 邮箱验证邮件

**主题：** 验证您的邮箱地址

**内容：**
```
您好 {name}，

请点击以下链接验证您的邮箱地址：

{verificationUrl}

如果这不是您的操作，请忽略此邮件。

— Jeffrey.AI
```

### 6.2 密码重置邮件

**主题：** 重置您的密码

**内容：**
```
您好 {name}，

请点击以下链接重置您的密码：

{resetUrl}

此链接 1 小时后失效。

如果这不是您的操作，请忽略此邮件。

— Jeffrey.AI
```

## 7. 环境变量

```env
# NextAuth (必填)
AUTH_SECRET=generate-with-openssl-rand-base64-32
NEXTAUTH_URL=http://localhost:30081

# SMTP (必填，用于邮件验证/密码重置)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=password
EMAIL_FROM=noreply@example.com
```

## 8. 实现顺序

1. **Phase 1：数据库迁移**
   - 添加 User, Account, Session, VerificationToken Model
   - 为 Person, Interaction 添加 userId 字段

2. **Phase 2：认证核心**
   - 安装依赖 (next-auth, bcrypt, nodemailer)
   - 配置 NextAuth
   - 实现注册/登录/登出 API
   - 创建认证页面

3. **Phase 3：路由保护**
   - 部署 Next.js Middleware
   - 在所有 API 添加 userId 过滤

4. **Phase 4：邮件功能**
   - 配置 SMTP
   - 实现邮件发送 (验证/密码重置)

5. **Phase 5：数据迁移**
   - 为现有数据指定 owner (第一个注册用户或指定 admin)

## 9. 安全考虑

- 密码使用 bcrypt 加密 (cost factor 12)
- JWT Session 有效期 30 天
- 邮箱验证 Token 有效期 24 小时
- 密码重置 Token 有效期 1 小时
- 所有密码重置 Token 使用后即失效
- 连续登录失败 5 次后锁定 15 分钟
