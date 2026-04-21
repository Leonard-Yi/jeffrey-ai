# Session Summary — 2026-04-21

## 完成的工作

### 图谱可视化重构（Obsidian 风格）

**目标**：将图谱从静态 Sigma.js 渲染升级为流畅交互的 Obsidian 风格。

**技术方案**（方案 C：混合架构）
- 渲染层：原生 Canvas API
- 物理模拟：d3-force 实时计算
- 数据层：保留 graphService.ts 不变

**新增文件**：
| 文件 | 说明 |
|------|------|
| `src/hooks/useForceSimulation.ts` | d3-force 物理引擎 hook |
| `src/hooks/useSpineBridgeEdges.ts` | spine/bridge 边长计算 |
| `src/components/GraphCanvas.tsx` | Canvas 渲染器（原生 API） |

**修改文件**：
| 文件 | 说明 |
|------|------|
| `src/app/graph/page.tsx` | 重构为 Canvas + hooks 模式 |
| `package.json` | 新增 d3-force，移除 sigma/@react-sigma/core |
| `CLAUDE.md` | 更新工作流说明 |

**验证结果**：
- TypeScript 编译：通过（零错误）
- 生产构建：成功（`npm run build`）
- 开发模式：因内存不足（OOM）无法启动 Turbopack

---

## 关键设计参数

### 物理模拟参数（useForceSimulation）
```typescript
{
  centerForce: 0.05,      // 低 — 允许有机分散
  repelForce: 4000,       // 高 — 集群分离
  linkForce: 1.0,         // 强 — 紧密连接
  linkDistanceBase: 40,   // 短基础距离
  damping: 0.85,          // 平滑沉降
  ticksPerFrame: 2,       // 每帧 tick 次数
}
```

### 变长边距（spine/bridge）
```typescript
SPINE_LENGTH = 40     // 叶子节点（度≤2）→ 短边
BRIDGE_LENGTH = 160   // 非叶子节点间 → 长边
```

### 节点视觉
- 半径：`Math.sqrt(val) * 10 + 12`
- 描边：2px 白色（rgba 0.9）
- hover 发光：shadowBlur 15，透明度 0.6

### 边视觉
- 粗细：`strength * 2`，范围 1-5px
- 透明度：0.6（高亮时 1.0，dimmed 时 0.1）

---

## 浏览器端验证（已完成）

通过 `npm run build && npm start` 生产模式 + Playwright E2E 测试验证：

| 测试 | 结果 |
|------|------|
| GRAPH-001: Canvas 加载 | ✅ 通过 |
| GRAPH-002: Canvas 可交互 | ✅ 通过 |
| GRAPH-002b: 录入→图谱显示节点 | ✅ 通过 |
| GRAPH-003: 过滤器可用 | ✅ 通过 |
| 麦克风按钮可见 | ✅ 通过 |
| 完整用户旅程（FULL-001~007） | ✅ 全部通过 |
| 人脉表格（MEMBERS-001~003） | ✅ 全部通过 |
| 合并流程（MERGE-001~007） | ✅ 全部通过 |
| 建议页（SUGGESTIONS-001~004） | ✅ 全部通过 |

**E2E 测试结果：32 passed（sequential workers）**

---

## E2E 测试修复

**修改的文件**：
| 文件 | 修复内容 |
|------|---------|
| `tests/e2e/fixtures/auth.ts` | `signIn` 自动注册用户，解决空数据库无法登录 |
| `tests/e2e/pages/InputPage.ts` | `micButton` 选择器改为 `button:has-text("语音录入")` |
| `tests/e2e/specs/graph.spec.ts` | GRAPH-002 改为 canvas-based；新增 GRAPH-002b 录入后图谱验证 |
| `tests/e2e/specs/mic_test.spec.ts` | 新增语音输入 E2E 测试 |
| `playwright.config.ts` | `workers: 1`（避免 API 速率限制），`timeout: 90000` |

**已知遗留问题**：
- 拖拽跟随效果待生产环境验证（理论参数可能需调优）
- Canvas 性能待节点数 >100 时验证

---

## 技术参考文档

- 设计文档：`docs/superpowers/specs/2026-04-21-knowledge-graph-redesign-design.md`
- 实现计划：`docs/superpowers/plans/2026-04-21-knowledge-graph-redesign.md`
- 研究报告：`docs/knowledge-graph-visualization-research.md`
- Tendril（Obsidian 风格实现参考）：https://argobox.pages.dev/posts/2026-02-03-tendril-knowledge-graph-for-web/

---

## 工作流（已更新至 CLAUDE.md）

```
改代码 → npm run build && npm start 测试 → 确认没问题
禁止使用 npm run dev，这会导致 OOM
不用 server 时 → 关掉 terminal 或 kill node 进程
出现 bug → 使用 /systematic-debugging 技能
完成工作后 → 调用 ecc:e2e 技能跑一个测试
```

**内存不足时**：
```bash
taskkill //F //IM node.exe  # 先清理残留进程
npm run build && npm start
```

---

## Git 分支状态

- 当前分支：`feature/graph-redesign`
- 提交记录：
  - `feat(graph): add useForceSimulation hook with d3-force physics`
  - `feat(graph): add spine/bridge edge length computation`
  - `feat(graph): add GraphCanvas component with native Canvas rendering`
  - `refactor(graph): replace Sigma.js with Canvas + d3-force physics`
  - `chore(graph): remove sigma dependency`
