# 图谱重构为 PixiJS + Web Worker — 设计文档

> **日期:** 2026-05-24 | **状态:** 已批准
>
> 参考 Obsidian 图谱实现（PixiJS WebGL 渲染 + Web Worker 力导向 + 渐进渲染），
> 重构当前 Canvas 2D 图谱为高性能 GPU 加速图谱。

## 动机

当前图谱使用 Canvas 2D 渲染，主线程同时承担力导向计算和渲染，节点数超过 30-50 时出现明显卡顿。
Obsidian 的图谱方案（PixiJS + Web Worker）是业界成熟的参考实现：
- PixiJS 使用 WebGL，GPU 加速可流畅渲染数千节点
- 力导向计算在 Web Worker 独立线程，UI 永不阻塞
- 渐进渲染 + 视口裁剪 + lerp 插值确保首帧快速出现且动画丝滑

## 不改的文件

以下文件完全不动，确保 API 接口、数据格式、筛选逻辑、图例、弹窗等全部不变：

- `src/lib/graphService.ts` — API 数据源
- `src/app/api/graph/route.ts` — graph API
- `src/hooks/useSpineBridgeEdges.ts` — 边长度计算
- `src/components/PersonModal.tsx` — 详情弹窗
- 筛选栏、图例卡片、Header 等 page.tsx 中的 UI

## 改动的文件

| 文件 | 动作 | 说明 |
|---|---|---|
| `package.json` | 改 | 添加 `pixi.js` 依赖 (`^8.x`) |
| `src/components/GraphCanvas.tsx` | **完全重写** | 当前 ~250 行 Canvas 2D → ~400 行 PixiJS 渲染器 |
| `src/lib/graphWorker.ts` | **新建** | Web Worker: d3-force 模拟，postMessage 通信 |
| `src/hooks/useForceSimulation.ts` | 改 | 不再直接调 d3-force，改为 Worker 消息桥接 |
| `src/app/graph/page.tsx` | 微调 | 适配新 GraphCanvas props（接口保持兼容） |
| `public/graphWorker.js` | **新建** | 浏览器可加载的 Worker 脚本（从 graphWorker.ts 编译） |

## GraphCanvas 新架构

参考 Obsidian 的 `graph.js` 类结构：

```
GraphCanvas (React wrapper)
└─ GraphRenderer (PixiJS Application)
   ├─ nodes: Map<string, GraphNode>
   ├─ links: GraphLink[]
   ├─ hanger: PIXI.Container     ← 所有节点/边的父容器
   ├─ dragNode / highlightNode   ← 交互状态
   ├─ scale, panX, panY          ← 缩放/平移
   │
   ├─ setData({nodes, links})    ← 接收数据，初始化 Worker
   ├─ renderLoop()               ← rAF 循环：从 Worker 读位置 → lerp → 绘制
   ├─ updateZoom()               ← lerp 缩放动画
   │
   ├─ handleWheel()              ← 鼠标滚轮缩放
   ├─ handlePointerDown/Move/Up()← 拖拽节点、平移画布
   └─ handleResize()             ← 窗口尺寸变化
```

### Node 对象

```typescript
class GraphNode {
  id: string; label: string; type: string;
  x: number; y: number;          // 当前位置
  weight: number;                // 影响节点大小
  color: { rgb: number; a: number } | null;
  
  circle: PIXI.Graphics;         // 节点圆 (WebGL)
  text: PIXI.Text;               // 标签
  rendered: boolean;             // 是否已初始化图形
  
  initGraphics(): boolean;       // 创建 PIXI 对象
  render(): void;                // 更新位置/透明度 (lerp)
  getSize(): number;             // sqrt(weight+1) * 3, 8-30px
  getFillColor(): { rgb, a };   // 从 CSS 变量/design-tokens 读取
}
```

### Link 对象

```typescript
class GraphLink {
  source: GraphNode; target: GraphNode;
  rendered: boolean;
  
  line: PIXI.Sprite;             // 连线
  arrow: PIXI.Graphics;          // 箭头
  px: PIXI.Container;            // 父容器
  
  initGraphics(): void;
  render(): void;                // 更新位置/旋转/透明度
}
```

### 关键数值

| 参数 | 值 | 来源 |
|---|---|---|
| 节点大小 | `clamp(sqrt(weight+1) * 3, 8, 30) * nodeScale` | Obsidian |
| 缩放范围 | `1/4` ~ `1` | Obsidian |
| 缩放速度 | `1.5^(deltaY/120)` | Obsidian |
| 渐进渲染批次 | 50 个/帧 | Obsidian |
| lerp 系数 | 位置 0.85, 透明度 0.2 | Obsidian |
| 力导向阻尼 | 0.99 | 当前值保持 |
| 排斥力 | 50 | 当前值保持 |

## Worker 通信协议

```typescript
// 主线程 → Worker
worker.postMessage({
  nodes: Record<string, [x, y]>,  // 已知位置
  links: [string, string][],      // [sourceId, targetId]
  alpha: number,                  // 模拟冷却因子
  alphaTarget: number,
  run: boolean,
  forces?: Record<string, number>, // 力参数
  forceNode?: { id, x, y } | null, // 固定节点（拖拽中）
});

// Worker → 主线程
self.onmessage = (event) => {
  // 运行 d3-force tick
  // postMessage({ positions: Float32Array, ids: string[] }) 返回
};
```

## 配色方案（CSS 变量驱动）

从 `design-tokens.ts` 的色值注入 PixiJS：

```typescript
// 节点颜色从 group 字段 (career tag) 映射
const NODE_COLORS: Record<string, { rgb: number; a: number }> = {
  default: hexToRgb('#3b82f6'),
  '投行':   hexToRgb('#10b981'),
  '律师':   hexToRgb('#f59e0b'),
  // ... 从 design-tokens graph 字段读取
};

// 边颜色从 link type 映射
const LINK_COLORS: Record<string, { rgb: number; a: number }> = {
  interaction:    hexToRgb('#60a5fa'),
  introducedBy:   hexToRgb('#f59e0b'),
  sharedCareer:   hexToRgb('#10b981'),
  // ...
};

function hexToRgb(hex: string): { rgb: number; a: number } {
  const n = parseInt(hex.slice(1), 16);
  return { rgb: n, a: 1 };
}
```

后续可扩展为真正从 CSS 自定义属性读取（`getComputedStyle`），实现主题自动切换。

## 渐进式渲染与性能

```
每帧 renderLoop:
  1. 从 Worker 读取最新节点位置
  2. 更新 zoom (lerp)
  3. 计算当前视口矩形
  4. 找出距离视口中心最近的 50 个未初始化节点 → initGraphics()
  5. 遍历所有节点：视口外的跳过，视口内的 render()
  6. 遍历所有边：两端都渲染的才 render()
  7. 计数 idleFrames（无变更帧），超过 60 帧跳过 requestAnimationFrame
```

## 交互

保持现有交互行为不变：
- **悬停**: 节点高亮 + 标签加粗
- **点击**: 打开 PersonModal
- **拖拽**: 固定节点位置 (fx/fy)，松手释放
- **滚轮**: 缩放，以鼠标位置为中心
- **平移**: 拖拽空白区域

新增交互（来自 Obsidian）：
- 移动端双指缩放/平移
- 缩放时标签淡入淡出

## 测试策略

由于渲染引擎变更（Canvas 2D → WebGL），E2E 测试需调整：
- Canvas 截图比对不再适用（WebGL 内容不可直接读像素）
- 改为验证：节点计数、API 状态码、过滤器功能、弹窗打开/关闭
- 现有 `graph.spec.ts` 中的 canvas click 测试保持（PixiJS 的 eventMode 支持 DOM 事件）

## 不与加密 worktree 冲突

加密在 `.claude/worktrees/encryption-pseudo` 操作后端文件（`src/lib/crypto.ts`, `auth.ts`, `prisma/`, API routes）。
本次只改前端渲染层（`GraphCanvas.tsx`, `useForceSimulation.ts`, `graph/page.tsx`, `package.json`）。
无共同文件，合并不冲突。

## 实施顺序

1. 安装 pixi.js，验证 WebGL 可用
2. 新建 `graphWorker.ts`，将 d3-force 逻辑移入 Worker
3. 重写 `GraphCanvas.tsx` 为 PixiJS 渲染器
4. 适配 `useForceSimulation.ts` 为 Worker 桥接
5. 微调 `graph/page.tsx` 适配新接口
6. 构建验证 + 手动测试
7. 跑 Playwright E2E 回归
