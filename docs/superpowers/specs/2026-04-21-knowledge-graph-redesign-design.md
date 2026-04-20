# Knowledge Graph Redesign — Obsidian-Style Interactive Visualization

**生成时间**: 2026-04-21
**基于**: [docs/knowledge-graph-visualization-research.md](file:///d:/Epstein.AI/docs/knowledge-graph-visualization-research.md)

---

## 1. 目标

将现有图谱从静态 Sigma.js 渲染升级为**Obsidian 风格的流畅交互图谱**：

- **丝滑物理动画**：拖拽节点时相邻节点立即跟随（橡皮筋效果）
- **变长边距几何**：区分 spine（短边）和 bridge（长边），产生有机聚类结构
- **现代浅色视觉**：保持现有浅色背景，节点发光 + 细线边，确保可视性不模糊不突兀
- **全功能保留**：现有筛选、弹窗、刷新、图例等交互不变

---

## 2. 技术架构

### 渲染层选择
- **渲染引擎**：原生 Canvas API（无额外依赖，轻量高性能）
- **理由**：相比 Sigma.js，Canvas 允许细粒度控制物理动画和视觉细节，无需 WebGL 复杂度

### 数据层
- 保留 `src/lib/graphService.ts` 不变，继续提供 `GraphNode[]`、`GraphLink[]`、`GraphCluster[]`
- 在页面组件内构建 `graphology` 实例用于拓扑查询，数据副本用于渲染

### 物理模拟
- **引擎**：`d3-force`（实时物理计算）
- **关键参数**：
  ```javascript
  {
    centerForce: 0.05,    // 低 — 允许有机分散
    repelForce: 4000,     // 高 — 集群分离
    linkForce: 1.0,       // 强 — 紧密连接
    linkDistanceBase: 40, // 短基础距离
    damping: 0.85,        // 平滑沉降
  }
  ```
- **变长边距实现**（核心创新）：
  - **spine**：叶子节点（度 ≤ 2）→ 中心节点，距离 30-50px，短边
  - **bridge**：标签簇之间连接，距离 150-200px，长边
- **拖拽跟随**：拖拽节点排除在物理计算外，相邻节点弹簧力实时响应

### 动画帧
- `requestAnimationFrame` 驱动，每帧执行多次 `d3-force.tick()`（可配置 1-3 次）
- 渲染与物理计算分离，渲染帧率独立控制

---

## 3. 视觉规范

### 画布
- 背景：`bg` token（当前浅色背景）
- 全屏 Canvas，响应式尺寸（监听 resize）

### 节点
- **形状**：圆形
- **尺寸**：`relationshipScore` 映射到 16-40px 半径
- **颜色**：职业色彩映射（现有 `NODE_COLORS` 保持不变）
- **描边**：2px 白色描边，确保浅色背景下清晰可见
- **发光**：hover 时添加 `box-shadow: 0 0 12px <nodeColor>80`，15ms 过渡
- **标签**：节点下方 12px 字号字体，hover 时完整显示，缩放时隐藏远距离标签

### 边
- **粗细**：`strength * 2`，范围 1-5px
- **颜色**：按类型区分（现有 `LINK_COLORS`），透明度 60%
- **变长边距渲染**：
  - spine 边：直线，1.5px
  - bridge 边：贝塞尔曲线，1px

### 交互状态
- **hover 节点**：节点放大 1.2x，相连边高亮，其他节点/边降低透明度到 30%
- **拖拽节点**：跟随鼠标，物理模拟实时响应相邻节点
- **选中节点**：持久高亮 + 打开 PersonModal

---

## 4. 组件结构

```
src/app/graph/page.tsx         # 主页面，状态管理，事件处理
src/components/GraphCanvas.tsx # Canvas 渲染器（纯渲染，无状态）
src/hooks/useForceSimulation.ts # d3-force 物理模拟 hook
src/hooks/useGraphInteraction.ts # 拖拽/hover/选中交互 hook
```

### `useForceSimulation(graphData, options)`
- 输入：`GraphData` + 物理参数
- 输出：`{ nodes, tick, stop, restart }`
- 内部维护 d3-force simulation 实例
- 节点位置以 ref 存储，避免 React 重新渲染

### `useGraphInteraction(canvasRef, nodesRef, simulation)`
- 处理鼠标事件：down/move/up（拖拽）、mousemove（hover）
- 维护 `draggedNode` 状态，通知物理引擎排除被拖拽节点
- 发布 `onNodeClick`、`onNodeHover` 回调

### `GraphCanvas(canvasRef, nodesRef, linksRef)`
- 读取 `nodesRef`（当前帧位置）和 `linksRef`（边数据）
- 执行 Canvas 绑定 drawcall
- 渲染循环：`requestAnimationFrame` → 绘制节点 → 绘制边 → 绘制标签

---

## 5. 功能保留清单

| 功能 | 实现位置 | 状态 |
|-----|---------|-----|
| 职业筛选 | `page.tsx` filter state → `/api/graph?group=` | 保留 |
| 关系类型筛选 | `page.tsx` filter state → `/api/graph?linkType=` | 保留 |
| 强度阈值筛选 | `page.tsx` filter state → `/api/graph?minStrength=` | 保留 |
| 刷新按钮 | `fetchGraphData()` | 保留 |
| 关系类型图例 | 右下角 Card | 保留 |
| 聚类色彩图例 | 顶部 Bar | 保留 |
| PersonModal | `selectedPersonId` state | 保留 |
| 加载状态 | `loading` state | 保留 |
| 空数据状态 | `nodes.length === 0` check | 保留 |

---

## 6. 实现顺序

1. **基础 Canvas 渲染** — 用原生 Canvas 绘制节点和边（静态版本）
2. **d3-force 物理引擎** — 集成 d3-force，计算节点位置
3. **变长边距逻辑** — spine/bridge 分类，计算边长度
4. **拖拽交互** — 鼠标拖拽 + 物理跟随
5. **hover 高亮** — 节点/边悬停状态
6. **视觉细节** — 描边、发光、标签显示/隐藏
7. **集成与测试** — 确保所有现有功能正常

---

## 7. 依赖变更

**新增依赖**：
- `d3-force`（物理模拟）

**保留依赖**：
- `graphology`（数据拓扑查询）
- `react-force-graph-2d`（node_modules 中已存在，但本次不使用）

**移除/不用的依赖**：
- `sigma`（当前使用的 Sigma.js 将被原生 Canvas 替代）

---

## 8. 实现注意事项

**实现过程中必须充分利用网络资源**，避免闭门造车。具体要求：

- **d3-force 物理模拟**：实现前查阅 d3-force 最新文档和最佳实践，确认 `forceSimulation`、`forceLink`、`forceManyBody` 等 API 的正确用法和性能陷阱
- **Canvas 渲染优化**：查阅 Canvas 批量绘制、离屏 Canvas 双缓冲、requestAnimationFrame 节流等成熟方案
- **变长边距参考**：以 [Tendril 实现](https://argobox.pages.dev/posts/2026-02-03-tendril-knowledge-graph-for-web/)为主要参考，结合 [Cytoscape.js 物理模拟教程](https://argobox.pages.dev/posts/building-knowledge-graph-cytoscape/)进行实现
- **拖拽跟随实现**：重点参考 Tendril 文章中的拖拽物理控制代码段
- **开源替代方案**：如 Canvas 实现复杂度超出预期，优先考虑 `react-force-graph-2d`（已安装，开箱即用，自带物理引擎）
- **主动查阅**：实现过程中如遇技术细节不明确，可自行访问上述相关页面获取具体实现代码和方案，务必以具体参考资料为准，而非仅凭推测

---

## 9. 风险与备选

- **性能风险**：d3-force O(n²) 力计算在节点 > 500 时可能卡顿 → 备选：Barnes-Hut 优化或降级到静态渲染
- **Canvas 复杂度**：相比 Sigma.js，Canvas 需要手动管理所有渲染逻辑 → 备选：使用 `react-force-graph-2d` 替代（已安装，开箱即用）
