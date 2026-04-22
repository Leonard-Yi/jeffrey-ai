# Vercel 部署经验汇总

*整理时间: 2026-04-22 | 置信度: 高*

---

## 一、基础部署命令

### 强制重新部署（跳过缓存）

Vercel 有缓存机制，有时部署的是旧 commit。强制重新构建：

```bash
npx vercel --prod --force
```

### 部署后验证

每次部署后立即确认 Vercel 上运行的 commit 是否与本地一致：

```bash
git log --oneline -1        # 本地当前 commit
# Vercel Dashboard → Deployment → 底部查看 commit SHA
```

---

## 二、Vercel 平台特性

### 分支监听规则

**Vercel 只监听 `master` 分支**。在其他分支（feature/worktree）修复的 bug 必须合并到 master 才能部署。

常见错误：在 feature 分支修复了 bug，但忘了合并，导致在 Vercel 上测试时发现修复没生效。

### Build 机器配置

- 机器配置：2 核 8GB
- `npm run build` 需要约 22GB 可用内存
- 内存不足时先关闭其他程序（Docker Desktop、WSL、VSCode）

### 浏览器缓存

部署后清除浏览器缓存或用隐私模式验证，避免旧 JS 缓存导致修复不生效。

---

## 三、数据库连接

### Supabase 连接问题

Supabase 免费版只支持 IPv6 直连，IPv4 直连格式在 Vercel 上会失败。

**解决**：使用 Session Pooler 连接字符串：

```
postgresql://postgres.xxx@aws-1-ap-south-1.pooler.supabase.com:5432/postgres
```

注意：Session Pooler 不支持 IPv4 直连，只能用此格式。

---

## 四、项目部署记录

### 当前部署

- **URL**: https://jeffrey-ai.vercel.app
- **Git**: master 分支，Vercel 自动监听推送
- **数据库**: Supabase PostgreSQL (Session Pooler)

### 历史部署

| 时间 | 事件 |
|------|------|
| 2026-04-11 | 首次 Vercel + Neon Postgres 部署 |
| 2026-04-21 | 切换到 Supabase + Session Pooler，修复 graph 白屏问题 |
| 2026-04-22 | 强制重新部署（commit 版本不一致问题） |

---

## 五、Docker 自部署（备用方案）

如需自部署，服务器内存至少需要 4GB（npm build 阶段需要 ~2GB+）。

相关文件已创建（未使用）：

- `Dockerfile` — 多阶段构建
- `docker-compose.yml` — 包含 app + db
- `.dockerignore`
- `next.config.js` — 已添加 `output: 'standalone'`
