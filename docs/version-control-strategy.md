# 版本控制策略

**创建日期**: 2026-04-06
**文档性质**: 运维指南 — 稳定、少变动
**阅读场景**: Git 操作、分支管理、发布流程、回滚执行

---

## 一、分支模型

采用 **Git Flow** 简化版：

```
main          ← 生产环境代码（始终稳定）
    ↑
    │ merge
    │
feature/*     ← 新功能开发分支
    │         ← 从 main 创建，开发完成后合并回 main
hotfix/*      ← 紧急修复分支（从 main 创建，修复后合并回 main）
```

### 分支命名规范
```
feature/<功能描述>     例: feature/user-table-view
hotfix/<问题描述>     例: hotfix/login-crash
release/<版本号>       例: release/v1.2.0
```

---

## 二、提交规范

### 提交信息格式
```
<类型>(<范围>): <简短描述>

[可选正文]

[可选脚注]
```

### 类型
| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档变更 |
| `style` | 代码格式（不影响功能） |
| `refactor` | 重构（不影响功能） |
| `perf` | 性能优化 |
| `test` | 测试相关 |
| `chore` | 构建/工具变更 |

### 示例
```
feat(analyze): 添加相对日期解析支持

解析用户输入中的"今天"、"昨天"、"上周一"等相对日期，
转换为标准 ISO-8601 格式。

Closes #123
```

---

## 三、版本号规则

采用 **语义化版本 (SemVer)**：
```
主版本.次版本.修订号
  1    .  2   .  0
```

| 变更 | 说明 |
|------|------|
| **主版本 (1.x.x)** | 不兼容的 API 变更 |
| **次版本 (x.2.x)** | 向后兼容的功能新增 |
| **修订号 (x.x.0)** | 向后兼容的 Bug 修复 |

### 发布流程
```bash
# 1. 创建发布分支
git checkout main
git pull
git checkout -b release/v1.2.0

# 2. 测试并修复问题
# ...

# 3. 合并到 main 并打标签
git checkout main
git merge release/v1.2.0 --no-ff
git tag -a v1.2.0 -m "版本 1.2.0：新增 XX 功能"

# 4. 删除发布分支
git branch -d release/v1.2.0
```

---

## 四、回滚策略

### 场景 1：代码回滚（未发布）

```bash
# 查看最近提交
git log --oneline -10

# 回滚到上一个稳定版本
git revert <commit-hash>

# 或硬回滚（慎用！）
git reset --hard <commit-hash>
git push --force
```

### 场景 2：生产环境回滚

```bash
# 查看可用标签
git tag -l

# 回滚到指定版本
git checkout v1.1.0
npm run build
npm start
```

### 场景 3：数据库迁移回滚

```bash
# 查看迁移状态
npx prisma migrate status

# 回滚到上一个迁移
npx prisma migrate revert

# 严重情况：重置数据库（慎用！数据会丢失）
npx prisma migrate reset
```

---

## 五、保护规则

### Main 分支保护
```
✓ 禁止直接推送
✓ 需要 Pull Request 审查
✓ 需要通过 CI/CD
✓ 禁止 force push
```

### 生产部署前检查清单
- [ ] `npm run build` 构建成功
- [ ] `npm run test:pipeline` 端到端测试通过
- [ ] 数据库迁移已测试
- [ ] 回滚方案已确认

---

## 六、快速命令备忘

```bash
# 初始化仓库后添加所有文件
git add -A
git commit -m "chore: initial commit"

# 创建功能分支
git checkout -b feature/my-feature

# 切回 main 并拉取最新
git checkout main && git pull

# 合并功能分支
git merge feature/my-feature --no-ff

# 创建标签
git tag -a v1.0.0 -m "版本 1.0.0"

# 推送所有标签
git push --tags

# 查看所有分支
git branch -a

# 删除本地分支
git branch -d feature/my-feature

# 删除远程分支
git push origin --delete feature/my-feature
```

---

## 七、回滚演练建议

每季度进行一次回滚演练，确保：
1. 熟悉回滚命令
2. 验证备份可用
3. 记录回滚时间

---

**相关文档**:
- [CLAUDE.md](../CLAUDE.md) — 开发命令、环境配置
- [project-definition.md](./project-definition.md) — 项目定义
