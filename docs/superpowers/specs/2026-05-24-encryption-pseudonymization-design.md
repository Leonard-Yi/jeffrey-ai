# Jeffrey.AI 端到端加密与假名化设计

**日期**: 2026-05-24  
**状态**: 设计完成  
**建议分阶段实施**: 此功能涉及加密基础设施、假名化引擎、密码轮换三大独立子系统，建议按 Phase 顺序推进，每阶段独立可验证。
**目标**: 确保用户数据全程加密，服务器/数据库管理员无法查看明文；LLM 只接收假名化后的文本。

---

## 1. 架构总览

```
用户浏览器                    Next.js API 层                    DeepSeek
    │                            │                                │
    │ POST /api/analyze          │                                │
    │ {text: "今天和老王..."}    │                                │
    │ ─────────────────────────> │                                │
    │                            │ 1. JWT 提取 enc_key, pseudo_key
    │                            │ 2. nodejieba 分词提取实体      │
    │                            │ 3. 查 pseudonym_map 内存缓存   │
    │                            │ 4. 替换 "老王→Person_A7B3"    │
    │                            │ 5. 假名化文本发送 ──────────> │
    │                            │                                │ 6. LLM 提取结构化数据
    │                            │ 7. 还原假名为真实名称   <───── │
    │                            │ 8. 检查 LLM 返回无实体泄露     │
    │                            │ 9. enc_key 加密所有字段        │
    │                            │ 10. Prisma upsert 密文入库     │
    │ 返回结果                   │                                │
    │ <───────────────────────── │                                │
```

---

## 2. 密钥派生与管理

### 2.1 派生流程

```
password + salt(16B random) → Argon2id → master_key (32 bytes)
                                │
                    ┌───────────┴───────────┐
                    ↓                       ↓
              enc_key (32B)           pseudo_key (32B)
              AES-256-GCM             HMAC-SHA256
              数据库字段加密/解密      假名确定性生成
```

- `salt` — 注册时随机生成 16 bytes，明文存 User 表（新增列 `keySalt`）
- `enc_key` / `pseudo_key` — 登录成功时派生，写入 JWT session payload
- 密钥永远不落磁盘

### 2.2 JWT Session 存储

NextAuth `jwt` callback 在登录时将密钥加入 token：

```typescript
// auth.ts jwt callback
jwt({ token, user, trigger }) {
  if (trigger === "signIn") {
    const { encKey, pseudoKey } = deriveKeys(password, user.keySalt);
    token.encKey = encKey;      // 32 bytes → base64
    token.pseudoKey = pseudoKey; // 32 bytes → base64
  }
  return token;
}
```

JWT 续期时直接复制旧 token 中的密钥，无需重新输入密码：

```typescript
// session callback 中不变，enc_key 随 token 生命周期自动续传
```

### 2.3 密钥生命周期

- **创建**: 注册 + 登录时从密码派生
- **续期**: JWT session 自动续期，密钥从旧 token 复制
- **销毁**: 登出时 JWT 被清除，密钥从内存消失
- **轮换**: 改密码时旧密钥解密、新密钥重加密（见第 7 节）
- **强制重登**: 7 天后 JWT 硬过期，需重新登录（限制密钥在 cookie 中的存活时间）

### 2.4 密码捕获时机

加密密钥需要明文密码来派生，但密码在 bcrypt hash 后不再可恢复。两个捕获点：

**注册时** (`POST /api/auth/register`):
1. 收到明文密码 → 派生 `enc_key`, `pseudo_key`
2. 用 bcrypt hash 密码 → 存 `passwordHash`
3. 用 `enc_key` 加密一条初始的 `PseudonymMap`（空表，作为密钥校验标记）
4. 存 `keySalt`
5. 明文密码直接丢弃，不落盘

**登录时** (NextAuth Credentials `authorize` callback):
1. 收到明文密码 → 验证 bcrypt hash
2. 成功则派生 `enc_key`, `pseudo_key`
3. 写入 JWT token payload
4. 明文密码直接丢弃

### 2.5 多设备支持

同一用户多台设备用相同密码登录 → 派生相同密钥 → 都能解密同一份 DB 数据。正常工作。

---

## 3. 数据库加密

### 3.1 加密格式

每个字段独立加密，存储格式：
```
v1:<base64_nonce_12bytes>:<base64_ciphertext>
```

- AES-256-GCM，每次加密产生随机 12-byte nonce
- 相同明文两次加密产出不同密文
- 版本前缀 `v1` 预留未来算法升级

### 3.2 加密字段清单

#### Person 表

| 字段 | 类型 | 加密 | 原因 |
|------|------|------|------|
| id | UUID | 否 | 外键引用 |
| userId | String | 否 | 索引关联 |
| name | String | **是** | PII |
| aliases | String[] | **是** | PII |
| careers | Json | **是** | PII |
| interests | Json | **是** | PII |
| vibeTags | String[] | **是** | PII |
| baseCities | String[] | **是** | PII |
| favoritePlaces | String[] | **是** | PII |
| searchText | String | **是** | PII |
| icebreakerData | Json | **是** | 含敏感上下文 |
| embedding | Json | **是** | 可从向量反推原文 |
| relationshipScore | Float | 否 | 排序需要，仅数字 |
| lastContactDate | DateTime | 否 | 排序需要 |
| createdAt | DateTime | 否 | 元数据 |
| updatedAt | DateTime | 否 | 元数据 |
| deletedAt | DateTime | 否 | 元数据 |
| mergedIntoId | String | 否 | 仅 ID |
| introducedById | String | 否 | 仅 ID |
| introducedByIds | String[] | 否 | 仅 ID |
| icebreakerGeneratedAt | DateTime | 否 | 元数据 |
| encryption_version | Int | 否 | 密钥版本标记 |

#### Interaction 表

| 字段 | 类型 | 加密 | 原因 |
|------|------|------|------|
| id | UUID | 否 | PK |
| userId | String | 否 | 索引 |
| date | DateTime | 否 | 排序 |
| location | String | **是** | PII |
| contextType | String | **是** | PII |
| sentiment | String | **是** | PII |
| actionItems | Json | **是** | PII |
| coreMemories | String[] | **是** | 高度敏感 |
| createdAt | DateTime | 否 | 元数据 |

#### 新增 PseudonymMap 表

```prisma
model PseudonymMap {
  id              String   @id @default(uuid())
  userId          String
  encryptedEntity String   // enc_key 加密的真实实体名
  entityType      String   // 'person' | 'place' | 'org'
  pseudonym       String   // "Person_A7B3" (明文，假名不敏感)
  entityHash      String   // HMAC-SHA256(realName + disambigFactor, pseudo_key) → 去重用
  disambigFactor  String   // 去歧义因子：首次出现时间戳或上下文 hash
  usageCount      Int      @default(1)
  createdAt       DateTime @default(now())
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, entityHash])
  @@index([userId])
}
```

### 3.3 cryptoStore — Prisma 封装

API 层不直接调用 `prisma.person.create(...)`，而是通过 `cryptoStore`：

```typescript
// src/lib/cryptoStore.ts
const store = createCryptoStore(prisma, encKey);

// API 层使用方式不变，但数据自动加密/解密
await store.person.findMany({ where: { userId } });
// → 自动解密返回

await store.person.upsert({ where, create, update });
// → 自动加密写入
```

cryptoStore 对每个模型包装了 `findMany`、`findUnique`、`create`、`update`、`upsert`、`delete` 方法，在读写前后自动加解密所有标记为加密的字段。

### 3.4 嵌套 Relation 解密

```typescript
await store.person.findUnique({
  where: { id },
  include: {
    introducedBy: true,   // name 自动解密
    interactions: {
      include: {
        interaction: true // location, coreMemories 自动解密
      }
    }
  }
});
```

cryptoStore 递归处理所有 include 嵌套，对每个关联记录自动解密其加密字段。

### 3.5 Prisma Schema 变更汇总

```prisma
model User {
  // ... existing fields ...
  keySalt                String?      // 16B random, base64 encoded, for key derivation
  keyRotationInProgress  Boolean      @default(false)
  pseudonymMaps          PseudonymMap[]
}

model Person {
  // ... existing fields ...
  encryptionVersion  Int  @default(1)  // key version for rotation recovery
}

model Interaction {
  // ... existing fields ...
  encryptionVersion  Int  @default(1)
}

model PseudonymMap {
  id              String   @id @default(uuid())
  userId          String
  encryptedEntity String   // enc_key 加密的真实实体名
  entityType      String   // 'person' | 'place' | 'org'
  pseudonym       String   // "Person_A7B3"
  entityHash      String   // HMAC-SHA256(realName + disambigFactor, pseudo_key)
  disambigFactor  String   // 去歧义因子
  usageCount      Int      @default(1)
  createdAt       DateTime @default(now())
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, entityHash])
  @@index([userId])
}
```

### 3.6 搜索与筛选

数据库加密后 `WHERE` 条件对密文无效。解决方案：
1. 查询该用户所有数据（按 userId 过滤）
2. 全量解密到内存
3. JS 层执行筛选、排序、分页

`/api/members/table` 和 `/api/search` 等路由改为：`findAll → decryptAll → filterInMemory → sortInMemory → paginateInMemory`。用户数据量级（通常 < 1000 条）在内存中完全可行。

---

## 4. 假名化引擎

### 4.1 整体流程

```
用户输入原文
  → nodejieba 分词 + 词性标注 (nr=人名, ns=地名, nt=机构名)
  → 对每个实体: HMAC-SHA256(name + disambigFactor, pseudo_key) → entityHash
  → 查 PseudonymMap 内存缓存
    → 命中: 复用已有假名
    → 未命中: 生成新假名 "Person_{hash前8字符}", 写入 DB + 内存缓存
  → 替换原文中所有实体为假名
  → 发送给 DeepSeek
  → LLM 返回假名化结果
  → 还原所有假名为真实名称
  → 检查返回内容是否有已知实体泄露（兜底）
  → 加密写入 DB
```

### 4.2 实体检测

使用 `nodejieba`（Node.js 结巴分词）做本地 NER：

- 词性标注识别实体类型：`nr`(人名), `ns`(地名), `nt`(机构名)
- 速度: 毫秒级，不调外部 API
- 不完美识别：对昵称（"老王"、"阿杰"）可能漏掉

### 4.3 确定性假名生成

```
entityHash = HMAC-SHA256(realName + "|" + disambigFactor, pseudo_key).toString('hex').slice(0, 12)
pseudonym  = typePrefix + "_" + entityHash
```

- typePrefix: `Person` / `Place` / `Org`
- 示例: `Person_a7b3c8d9`, `Place_f2e1a0b3`

### 4.4 同名去歧义

当 nodejieba 从上下文中能检测到是新人（不同时间、不同上下文），disambigFactor 不同 → 不同 entityHash → 不同假名。

首次提取实体时，LLM 返回的人物的 careers、interests 等可用来判断是否为同一人。如果 nodejieba 不确定，留待 LLM 分析结束后由用户手动确认人名解析。

disambigFactor 优先使用上下文的前 64 字符 hash — 同一个人在不同对话里通常会被同一上下文匹配到。

### 4.5 映射表内存缓存

登录后一次性加载该用户所有 PseudonymMap 到内存（Map 结构），后续查表不访 DB。新实体添加到 Map 时同步异步写 DB。每小时从 DB 刷新一次。

### 4.6 漏网之鱼的兜底

nodejieba 可能漏识别部分实体。LLM 返回后，遍历返回内容中的所有字符串（name、careers、interests、coreMemories、actionItems），检查是否匹配 PseudonymMap 中的 `encryptedEntity`（先解密所有已知实体名，再检查返回值是否包含）。如果匹配到，说明假名化阶段漏掉了这个实体，自动替换后写入 DB，并在服务器日志中标记告警。

---

## 5. 日志安全

### 5.1 全局规则

**任何包含用户数据的 console.log / console.error 必须先经过假名化**。不得在日志中输出明文实体名。

### 5.2 实现

封装 `safeLog` 工具函数：

```typescript
// src/lib/safeLog.ts
function safeLog(pseudoKey: string, prefix: string, text: string) {
  const sanitized = pseudonymize(text, pseudoKey); // 复用假名化引擎
  console.log(`[Jeffrey.AI] ${prefix}:`, sanitized);
}
```

所有 `console.log(rawBody)` / `console.log(userText)` 替换为 `safeLog(pseudoKey, "Raw body", rawBody)`。

### 5.3 API 错误响应

保持现有规则：对外一律返回 `{ error: "Internal server error" }`，不暴露内部细节。

---

## 6. 冰破助手 / 建议路由的假名化

`/api/suggestions/icebreaker` 和 `/api/persons/[id]/icebreaker` 目前将人物信息直接拼成 prompt 发给 DeepSeek。改为：

1. 从 DB 读取人物信息 → 通过 cryptoStore 自动解密得到明文
2. 明文内容经过假名化引擎替换实体名
3. 拼成 prompt 发给 DeepSeek
4. LLM 返回的 icebreaker 内容中的假名还原为真实名称
5. 返回给前端的是真实名称

---

## 7. 密码轮换

### 7.1 流程

```
用户输入旧密码 + 新密码
  → 派生旧密钥 + 新密钥
  → 设置 DB flag: keyRotationInProgress = true (阻塞并发写入)
  → 遍历所有 Person 行:
      decrypt with oldKey → encrypt with newKey → write back
      update encryption_version = newVersion
  → 遍历所有 Interaction 行: 同上
  → 遍历 PseudonymMap: encryptedEntity 用新密钥重加密
  → 更新 User.keySalt (新 salt)
  → 清除 DB flag
  → 更新 JWT session 中的密钥
  → 前端展示:
    "🔐 正在用您的旧密钥解密数据..."
    "🔐 正在用新密钥重新加密..."
    "✅ 密钥轮换完成，您的数据已用新密码保护"
```

### 7.2 崩溃恢复

每行有 `encryption_version` 字段。轮换开始时 version 从 1 → 2。如果中途崩溃，重启后查询 `version=1` 的行继续处理，`version=2` 的行跳过。基于 version 的幂等续传，不会出现混合状态。

### 7.3 并发控制

轮换期间设置 `User.keyRotationInProgress = true`。所有写操作（/api/analyze、/api/persons/merge 等）在开始时检查此 flag，若为 true 则返回错误 "密钥更新中，请稍后再试"。

### 7.4 忘记密码

不提供密码重置 + 数据恢复。用户可选择"重置账户"—删除所有加密数据，重新开始。此操作需要用户输入当前密码确认。

---

## 8. 缓存安全

`/api/suggestions/icebreaker` 当前有 5 分钟内存缓存（Map），存的是解密后的明文 icebreaker 数据。改为：

- TTL 缩至 60 秒
- 或改为存密文，查缓存时用当前请求的密钥解密（额外开销可忽略）

推荐存密文方案：缓存 key 不变，value 存加密后的 icebreaker 结果。查缓存时用 `enc_key` 解密一次。

---

## 9. 前端影响

### 9.1 登录 / 注册

- 注册: 生成 `keySalt`，存储到 User 表
- 登录: 从密码派生密钥，写入 JWT session

### 9.2 改密码页面

- 输入旧密码 + 新密码
- 调用 `POST /api/auth/change-password`
- 轮换期间展示进度文案

### 9.3 数据页面（录入、人脉、图谱、建议）

- 无感知改动 — API 层透明加解密，返回给前端的始终是明文
- 唯一可感知的变化：加密后数据量小时，列表加载可能略慢（全量解密到内存再筛选）

---

## 10. 部署注意事项

### 10.1 Vercel 环境变量

`AUTH_SECRET` 必须足够强且保密（JWT 签名依赖它）。

### 10.2 nodejieba 依赖

`nodejieba` 是 Native addon。Vercel 无服务器函数可能不支持原生模块，需提前测试。备选方案：`@node-rs/jieba`（Rust 实现的 wasm/napi 版本，兼容 serverless）。

### 10.3 多实例

内存缓存不跨实例共享，但不影响正确性（最多每个实例各自从 DB 加载一次）。伪名映射表每次从 DB 全量加载，开销可接受。

---

## 11. 已知限制与风险

| 限制/风险 | 应对 |
|-----------|------|
| 假名化不是完全匿名化 | 用户协议说明风险 |
| nodejieba 对昵称识别不完美 | 兜底泄露检测 + 告警 |
| 加密后搜索/排序只能内存做 | 数据 < 1000 可行，未来可加 encrypted index |
| 密钥在 JWT 中存在时间窗口 | 7 天强制重登 |
| 忘记密码数据不可恢复 | 用户确认接受 |

---

## 12. 文件清单

| 文件 | 职责 |
|------|------|
| `src/lib/crypto.ts` | Argon2id 密钥派生、AES-256-GCM 加解密 |
| `src/lib/cryptoStore.ts` | Prisma 封装，读写时自动加解密 + 嵌套 relation 处理 |
| `src/lib/pseudonymizer.ts` | NER 实体检测、假名替换/还原、映射表管理、泄露兜底检测 |
| `src/lib/safeLog.ts` | 日志输出的假名化包装 |
| `src/lib/keyRotation.ts` | 密码轮换流程、version 管理、崩溃续传 |
| `prisma/schema.prisma` | 新增 PseudonymMap、User.keySalt/encryptionVersion/keyRotationInProgress、Person.encryptionVersion、Interaction.encryptionVersion |
| `src/app/api/auth/change-password/route.ts` | 密码轮换 API |
| `src/app/api/analyze/route.ts` | 集成假名化+加密（重构） |
| `src/app/api/suggestions/icebreaker/route.ts` | 集成假名化 |
| `src/app/api/suggestions/icebreaker-stream/route.ts` | 集成假名化 |
| `src/app/api/persons/[id]/icebreaker/route.ts` | 集成假名化 |
| `src/app/api/members/table/route.ts` | 全量解密→内存筛选 |
| `src/app/api/search/route.ts` | 全量解密→内存搜索 |

---

## 13. 建议实施阶段

### Phase 1 — 加密基础设施（核心）
1. `src/lib/crypto.ts` — 密钥派生 + AES 加解密
2. Prisma schema 变更（User、Person、Interaction、PseudonymMap）
3. `src/lib/cryptoStore.ts` — Prisma 透明加解密封装
4. 注册/登录流程改造（密码捕获 + 密钥派生 + JWT 存储）
5. `src/app/api/analyze/route.ts` — 集成 cryptoStore
6. 全量 E2E 测试验证加密链路

**验证标准**: 注册新用户 → 录入文本 → 查 DB 确认 Person/Interaction 字段为密文 → 前端正常显示明文

### Phase 2 — 假名化引擎
1. `src/lib/pseudonymizer.ts` — NER + 假名替换/还原 + 映射表管理
2. `src/lib/safeLog.ts` — 日志假名化
3. `/api/analyze` — 集成假名化：原文→假名→LLM→还原→入库
4. `/api/suggestions/icebreaker` — 集成假名化
5. `/api/suggestions/icebreaker-stream` — 集成假名化
6. `/api/persons/[id]/icebreaker` — 集成假名化
7. E2E 测试验证假名化链路

**验证标准**: 提交含人名的文本 → 检查 server 日志中无真实人名 → 检查 DeepSeek 请求日志只有假名 → 前端正常显示真实名称

### Phase 3 — 密码轮换 + 兜底
1. `src/lib/keyRotation.ts` — 轮换流程
2. `src/app/api/auth/change-password/route.ts` — API
3. 前端改密码页面
4. 泄露兜底检测
5. 缓存安全改造
6. 全量 E2E 测试（含改密码流程）

**验证标准**: 改密码 → 旧密钥无法解密 → 新密钥正常工作 → 所有数据可用
