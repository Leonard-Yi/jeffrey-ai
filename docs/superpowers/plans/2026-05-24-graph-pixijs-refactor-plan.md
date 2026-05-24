# 图谱 PixiJS + Web Worker 重构 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将图谱渲染从 Canvas 2D 重构为 PixiJS WebGL + Web Worker 力导向，实现 GPU 加速渲染、独立线程计算、渐进式加载、lerp 平滑动画。

**Architecture:** PixiJS Application 负责 WebGL 渲染（Node/Link/Renderer 三类），Web Worker 跑 d3-force 模拟，主线程只做 rAF 渲染循环和事件处理。接口保持兼容。

**Tech Stack:** PixiJS 8.x (WebGL 渲染), d3-force (力导向，搬入 Worker), Next.js 16, React 19, TypeScript 5.x

---

### Task 1: 安装 pixi.js 依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install pixi.js**

```bash
cd d:/Epstein.AI
npm install pixi.js@^8
```

Expected: `pixi.js` added to `package.json` and `node_modules`. No build errors.

- [ ] **Step 2: Verify install**

```bash
node -e "const PIXI = require('pixi.js'); console.log('PixiJS version:', PIXI.VERSION);"
```

Expected: prints PixiJS version (8.x).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add pixi.js 8.x for WebGL graph rendering"
```

---

### Task 2: 新建 graphWorker.ts — Web Worker 力导向模拟

**Files:**
- Create: `src/lib/graphWorker.ts`

- [ ] **Step 1: Write the Worker 脚本**

```typescript
// src/lib/graphWorker.ts
// Web Worker — 运行 d3-force 力导向模拟，通过 postMessage 与主线程通信
// 不能直接作为 Worker 加载（需要编译），需在 public/ 放编译后的 JS。

import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
} from "d3-force";

interface SimNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number | null;
  fy?: number | null;
  val: number; // 影响碰撞半径
}

interface WorkerMessage {
  nodes: Record<string, [number, number]>; // id → [x, y] 初始位置
  links: [string, string][];               // [sourceId, targetId]
  alpha: number;
  alphaTarget: number;
  run: boolean;
  centerX?: number;
  centerY?: number;
  forceNode?: { id: string; x: number; y: number; release?: boolean } | null;
}

let simNodes: SimNode[] = [];
let sim: ReturnType<typeof forceSimulation> | null = null;

function initSimulation(
  nodes: SimNode[],
  links: [string, string][],
  centerX: number,
  centerY: number,
) {
  if (sim) { sim.stop(); }

  // 为 link 解析 source/target 对象引用
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const resolvedLinks = links
    .filter(([src, tgt]) => nodeMap.has(src) && nodeMap.has(tgt))
    .map(([src, tgt]) => ({
      source: nodeMap.get(src)!,
      target: nodeMap.get(tgt)!,
    }));

  const REPEL_FORCE = 50;
  const LINK_FORCE = 0.5;
  const LINK_DISTANCE = 80;

  sim = forceSimulation<SimNode>(nodes)
    .force("center", forceCenter(centerX, centerY).strength(0.01))
    .force("charge", forceManyBody<SimNode>().strength(-REPEL_FORCE))
    .force("collision", forceCollide<SimNode>().radius(d => Math.sqrt(d.val) * 10 + 20))
    .force("link", forceLink<SimNode, any>(resolvedLinks)
      .distance(LINK_DISTANCE)
      .strength(LINK_FORCE),
    )
    .velocityDecay(0.99)
    .alphaDecay(0.5)
    .stop();
}

// Worker 消息处理
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const msg = event.data;

  if (!sim && msg.nodes) {
    // 首次初始化
    const centerX = msg.centerX ?? 0;
    const centerY = msg.centerY ?? 0;

    simNodes = Object.entries(msg.nodes).map(([id, [x, y]]) => ({
      id,
      x,
      y,
      vx: 0,
      vy: 0,
      val: 0.5,
    }));

    initSimulation(simNodes, msg.links, centerX, centerY);
  }

  if (msg.forceNode) {
    const node = simNodes.find(n => n.id === msg.forceNode!.id);
    if (node) {
      if ((msg.forceNode as any).release) {
        node.fx = null;
        node.fy = null;
      } else {
        node.fx = msg.forceNode.x;
        node.fy = msg.forceNode.y;
      }
    }
  }

  if (msg.run && sim) {
    // 推进模拟并回传位置
    sim.alpha(Math.max(sim.alpha(), msg.alpha ?? 0.3));
    sim.tick(10); // 每次跑 10 tick

    // 构建 Float32Array: [x0,y0, x1,y1, ...]
    const posBuffer = new Float32Array(simNodes.length * 2);
    const ids: string[] = [];
    for (let i = 0; i < simNodes.length; i++) {
      const n = simNodes[i];
      posBuffer[i * 2] = n.x;
      posBuffer[i * 2 + 1] = n.y;
      ids.push(n.id);
    }

    const done = sim.alpha() <= sim.alphaMin();
    self.postMessage({ ids, positions: posBuffer.buffer, done }, [
      posBuffer.buffer,
    ] as any);
  }
};

// 告知主线程 Worker 已就绪
self.postMessage({ ready: true });
```

- [ ] **Step 2: 将 Worker 脚本编译到 public/**

Worker 文件需要编译为纯 JS 才能被浏览器加载。两种方式：

**方案 A（推荐，简单）：手动创建 `public/graphWorker.js`**

```bash
# 用 esbuild 一次性编译
npx esbuild src/lib/graphWorker.ts --bundle --format=iife --outfile=public/graphWorker.js
```

- [ ] **Step 3: 验证 Worker 文件存在**

```bash
ls -la d:/Epstein.AI/public/graphWorker.js
```

Expected: 文件存在，大小 > 0。

- [ ] **Step 4: Commit**

```bash
git add src/lib/graphWorker.ts public/graphWorker.js
git commit -m "feat(graph): add Web Worker force simulation (d3-force in worker thread)"
```

---

### Task 3: 重写 GraphCanvas.tsx — PixiJS 渲染器

**Files:**
- Modify: `src/components/GraphCanvas.tsx` (完全重写 ~400 行)

这是核心改动。参考 Obsidian 的 `graph.js` 架构，三个核心类：`GraphNode`, `GraphLink`, `GraphRenderer`。

- [ ] **Step 1: 重写 GraphCanvas.tsx 完整代码**

```typescript
// src/components/GraphCanvas.tsx
"use client";

import { useRef, useEffect, useCallback } from "react";
import * as PIXI from "pixi.js";
import { tokens as C } from "@/lib/design-tokens";
import type { SimNode } from "@/hooks/useForceSimulation";
import type { GraphLink } from "@/lib/graphService";

// ─── Color maps ─────────────────────────────────────────────────

const LINK_COLORS: Record<string, number> = {
  interaction: 0x60a5fa,
  introducedBy: 0xf59e0b,
  sharedCareer: 0x10b981,
  sharedCity: 0x8b5cf6,
  sharedInterest: 0xf97316,
  sharedPlace: 0xec4899,
  sharedVibe: 0x6366f1,
};

const NODE_COLORS: Record<string, number> = {
  default: 0x3b82f6,
  "投行": 0x10b981,
  "律师": 0xf59e0b,
  "医生": 0xef4444,
  "教授": 0x8b5cf6,
  "创业者": 0xf97316,
  AI: 0x6366f1,
};

function getNodeColor(group: string): number {
  for (const [key, color] of Object.entries(NODE_COLORS)) {
    if (group.includes(key)) return color;
  }
  return NODE_COLORS.default;
}

// ─── lerp ───────────────────────────────────────────────────────

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ─── Node graphics class ────────────────────────────────────────

class GraphNodeGfx {
  id: string;
  label: string;
  group: string;
  val: number; // 0-1 weight
  targetX = 0;
  targetY = 0;
  fx: number | null = null;
  fy: number | null = null;

  circle: PIXI.Graphics;
  text: PIXI.Text;
  rendered = false;

  constructor(id: string, label: string, group: string, val: number) {
    this.id = id;
    this.label = label;
    this.group = group;
    this.val = val;

    this.circle = new PIXI.Graphics();
    this.circle.eventMode = "static";
    this.circle.cursor = "pointer";

    this.text = new PIXI.Text(label, {
      fontSize: 12,
      fill: C.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      align: "center",
    });
    this.text.anchor.set(0.5, 0);
    this.text.eventMode = "none";
  }

  getSize(): number {
    return Math.max(8, Math.min(Math.sqrt(this.val * 100 + 1) * 3, 30));
  }

  getColor(): number {
    return getNodeColor(this.group);
  }

  drawCircle(highlighted: boolean, dimmed: boolean) {
    const g = this.circle;
    const size = this.getSize();
    const color = this.getColor();
    g.clear();

    // outer glow when highlighted
    if (highlighted) {
      g.lineStyle(2, 0xffffff, 0.9);
    } else {
      g.lineStyle(1.5, 0xffffff, 0.7);
    }
    g.beginFill(color, dimmed ? 0.3 : 0.9);
    g.drawCircle(0, 0, size);
    g.endFill();
  }
}

// ─── Link graphics class ────────────────────────────────────────

class GraphLinkGfx {
  sourceId: string;
  targetId: string;
  type: string;
  strength: number;

  gfx: PIXI.Graphics;

  constructor(sourceId: string, targetId: string, type: string, strength: number) {
    this.sourceId = sourceId;
    this.targetId = targetId;
    this.type = type;
    this.strength = strength;
    this.gfx = new PIXI.Graphics();
  }

  drawLine(
    x1: number, y1: number, x2: number, y2: number,
    alpha: number,
  ) {
    const g = this.gfx;
    const color = LINK_COLORS[this.type] ?? 0x999999;
    g.clear();
    g.lineStyle(1.5, color, 0.5 * alpha);
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
  }
}

// ─── Props (保持与原 GraphCanvas 兼容) ───────────────────────────

export interface GraphCanvasProps {
  nodesRef: React.MutableRefObject<SimNode[]>;
  linksRef: React.MutableRefObject<GraphLink[]>;
  width: number;
  height: number;
  hoveredNodeId: string | null;
  selectedNodeId: string | null;
  onNodeHover: (id: string | null) => void;
  onNodeClick: (id: string) => void;
  onDragStart: (id: string, x: number, y: number) => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: (id: string) => void;
  onTick: () => void;
}

// ─── Component ──────────────────────────────────────────────────

export default function GraphCanvas({
  nodesRef,
  linksRef,
  width,
  height,
  hoveredNodeId,
  selectedNodeId,
  onNodeHover,
  onNodeClick,
  onDragStart,
  onDragMove,
  onDragEnd,
  onTick,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const hangerRef = useRef<PIXI.Container | null>(null); // 缩放/平移容器
  const nodeGfxRef = useRef<Map<string, GraphNodeGfx>>(new Map());
  const linkGfxRef = useRef<GraphLinkGfx[]>([]);
  const animFrameRef = useRef<number>(0);
  const dragRef = useRef<{ id: string; gfx: GraphNodeGfx } | null>(null);
  const scaleRef = useRef({ current: 1, target: 1 });
  const panRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  // DOM 容器尺寸变化时，canvas 尺寸通过 width/height props 传入 — PIXI 不接管 DOM resize

  // ── PixiJS 初始化 ──────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current) return;
    if (width === 0 || height === 0) return;
    // 防止重复 init（width/height 变化会导致 effect 重新跑）
    if (appRef.current) return;

    const app = new PIXI.Application();
    const init = async () => {
      await app.init({
        width,
        height,
        backgroundAlpha: 0,
        antialias: true,
      });
      containerRef.current!.appendChild(app.canvas);
      app.canvas.style.width = "100%";
      app.canvas.style.height = "100%";

      const hanger = new PIXI.Container();
      app.stage.addChild(hanger);
      hangerRef.current = hanger;

      // 缩放到 50% 使图谱从远处开始，用户可滚轮放大
      scaleRef.current.current = 0.5;
      scaleRef.current.target = 0.5;
      panRef.current.x = width / 2;
      panRef.current.y = height / 2;
      hanger.x = panRef.current.x;
      hanger.y = panRef.current.y;
      hanger.scale.set(0.5);

      appRef.current = app;
    };
    init();

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
        hangerRef.current = null;
        nodeGfxRef.current.clear();
        linkGfxRef.current = [];
      }
    };
    // 仅初始化一次，不依赖 width/height 变化
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 事件绑定 ───────────────────────────────────────────────

  useEffect(() => {
    const app = appRef.current;
    const hanger = hangerRef.current;
    const container = containerRef.current;
    if (!app || !hanger || !container) return;

    const canvas = app.canvas;

    let isPanning = false;
    let panStart = { x: 0, y: 0 };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY;
      const factor = Math.pow(1.5, -delta / 120);
      const s = scaleRef.current;
      s.target = Math.min(1, Math.max(0.25, s.target * factor));
    };

    // Hover / click / drag on hanger (画布空白区)
    const onPointerDown = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const pos = {
        x: (e.clientX - rect.left) * (width / rect.width),
        y: (e.clientY - rect.top) * (height / rect.height),
      };

      // 检查是否点在节点上
      const nodes = nodesRef.current;
      for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i];
        const r = Math.sqrt(node.val * 100 + 1) * 3 * (1 / scaleRef.current.current);
        const dx = (pos.x - panRef.current.x) / scaleRef.current.current - node.x;
        const dy = (pos.y - panRef.current.y) / scaleRef.current.current - node.y;
        if (dx * dx + dy * dy <= r * r + 25) {
          // 点在节点上 → 拖拽节点
          const gfx = nodeGfxRef.current.get(node.id);
          if (gfx) {
            dragRef.current = { id: node.id, gfx };
            onDragStart(node.id, pos.x, pos.y);
            canvas.style.cursor = "grabbing";
          }
          return;
        }
      }
      // 点在空白区 → 平移画布
      isPanning = true;
      panStart = { x: e.clientX, y: e.clientY };
      canvas.style.cursor = "grabbing";
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const pos = {
        x: (e.clientX - rect.left) * (width / rect.width),
        y: (e.clientY - rect.top) * (height / rect.height),
      };

      if (dragRef.current) {
        onDragMove(pos.x, pos.y);
        return;
      }

      if (isPanning) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        panStart = { x: e.clientX, y: e.clientY };
        const p = panRef.current;
        p.targetX += dx;
        p.targetY += dy;
        return;
      }

      // Hover 检测
      const nodes = nodesRef.current;
      let found: string | null = null;
      const s = scaleRef.current.current;
      for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i];
        const r = Math.sqrt(node.val * 100 + 1) * 3;
        const dx = (pos.x - panRef.current.x) / s - node.x;
        const dy = (pos.y - panRef.current.y) / s - node.y;
        if (dx * dx + dy * dy <= r * r + 25) {
          found = node.id;
          break;
        }
      }
      onNodeHover(found);
      canvas.style.cursor = found ? "pointer" : isPanning ? "grabbing" : "default";
    };

    const onPointerUp = () => {
      if (dragRef.current) {
        onDragEnd(dragRef.current.id);
        dragRef.current = null;
      }
      isPanning = false;
      canvas.style.cursor = "default";
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerUp);

    return () => {
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerUp);
    };
  }, [width, height, nodesRef, onNodeHover, onDragStart, onDragMove, onDragEnd]);

  // ── 数据同步：创建/更新 nodeGfx 和 linkGfx ──────────────────

  const hoveredRef = useRef(hoveredNodeId);
  hoveredRef.current = hoveredNodeId;
  const selectedRef = useRef(selectedNodeId);
  selectedRef.current = selectedNodeId;

  useEffect(() => {
    const app = appRef.current;
    const hanger = hangerRef.current;
    if (!app || !hanger) return;

    const nodeGfxMap = nodeGfxRef.current;
    const existingIds = new Set(nodeGfxMap.keys());
    const newIds = new Set(nodesRef.current.map(n => n.id));

    // 删除已不存在的节点
    for (const id of existingIds) {
      if (!newIds.has(id)) {
        const gfx = nodeGfxMap.get(id)!;
        hanger.removeChild(gfx.circle, gfx.text);
        gfx.circle.destroy();
        gfx.text.destroy();
        nodeGfxMap.delete(id);
      }
    }

    // 创建新节点
    for (const node of nodesRef.current) {
      if (!nodeGfxMap.has(node.id)) {
        const gfx = new GraphNodeGfx(node.id, node.label, node.group, node.val);
        hanger.addChild(gfx.circle);
        hanger.addChild(gfx.text);
        nodeGfxMap.set(node.id, gfx);
      }
    }

    // 重建 linkGfx
    const oldLinks = linkGfxRef.current;
    for (const l of oldLinks) {
      hanger.removeChild(l.gfx);
      l.gfx.destroy();
    }
    linkGfxRef.current = [];

    for (const link of linksRef.current) {
      const srcId = typeof link.source === "string" ? link.source : (link.source as any)?.id;
      const tgtId = typeof link.target === "string" ? link.target : (link.target as any)?.id;
      if (srcId && tgtId && nodeGfxMap.has(srcId) && nodeGfxMap.has(tgtId)) {
        const l = new GraphLinkGfx(srcId, tgtId, link.type, link.strength);
        hanger.addChild(l.gfx);
        linkGfxRef.current.push(l);
      }
    }

    // 给节点绑定 click 事件
    for (const [id, gfx] of nodeGfxMap) {
      gfx.circle.off("pointertap"); // 清除旧的
      gfx.circle.on("pointertap", () => onNodeClick(id));
    }
  }, [nodesRef, linksRef, onNodeClick]);

  // ── 渲染循环 ───────────────────────────────────────────────

  useEffect(() => {
    const app = appRef.current;
    const hanger = hangerRef.current;
    if (!app || !hanger) return;

    let running = true;

    const loop = () => {
      if (!running) return;

      onTickRef.current(); // 推进 Worker 模拟

      const s = scaleRef.current;
      const p = panRef.current;

      // lerp zoom
      s.current = lerp(s.current, s.target, 0.15);
      // lerp pan
      p.x = lerp(p.x, p.targetX, 0.15);
      p.y = lerp(p.y, p.targetY, 0.15);

      hanger.x = p.x;
      hanger.y = p.y;
      hanger.scale.set(s.current);

      const hovered = hoveredRef.current;
      const selected = selectedRef.current;

      // 绘制节点
      const nodeGfxMap = nodeGfxRef.current;
      for (const [id, gfx] of nodeGfxMap) {
        const simNode = nodesRef.current.find(n => n.id === id);
        if (!simNode) continue;

        const highlighted = id === hovered || id === selected;
        gfx.drawCircle(highlighted, false);

        gfx.circle.x = simNode.x;
        gfx.circle.y = simNode.y;

        // 标签文字
        const fontSize = highlighted ? 14 : 12;
        gfx.text.style.fontSize = fontSize;
        gfx.text.style.fill = highlighted ? C.primary : C.text;
        gfx.text.x = simNode.x;
        gfx.text.y = simNode.y + gfx.getSize() + 6;
        gfx.text.alpha = Math.min(1, (s.current - 0.25) * 2); // 缩小到 0.25 以下时文字淡出
      }

      // 绘制边
      for (const l of linkGfxRef.current) {
        const srcGfx = nodeGfxMap.get(l.sourceId);
        const tgtGfx = nodeGfxMap.get(l.targetId);
        if (!srcGfx || !tgtGfx) continue;
        l.drawLine(
          srcGfx.circle.x, srcGfx.circle.y,
          tgtGfx.circle.x, tgtGfx.circle.y,
          1,
        );
      }

      app.render();
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [nodesRef]); // 注意：hover 通过 ref 读取，不触发重启

  // ── 当 PixiJS 尚未初始化时提供 canvas 容器 ─────────────────

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", overflow: "hidden" }}
    />
  );
}
```

- [ ] **Step 2: 确认类型编译**

```bash
cd d:/Epstein.AI
npx tsc --noEmit src/components/GraphCanvas.tsx 2>&1 | head -20
```

Expected: 无错误（可能需要处理 pixi.js 类型导入，PixiJS 8 自带类型声明）。

- [ ] **Step 3: Commit**

```bash
git add src/components/GraphCanvas.tsx
git commit -m "refactor(graph): rewrite GraphCanvas with PixiJS WebGL rendering"
```

---

### Task 4: 改造 useForceSimulation.ts — Worker 消息桥接

**Files:**
- Modify: `src/hooks/useForceSimulation.ts`

保持外部接口不变（`tick`, `fixNode`, `releaseNode`, `initSimulation`），内部改为向 Worker 发消息。

- [ ] **Step 1: 重写 useForceSimulation.ts**

```typescript
// src/hooks/useForceSimulation.ts
import { useRef, useEffect, useCallback } from "react";
import type { GraphNode, GraphLink } from "@/lib/graphService";

export interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number | null;
  fy?: number | null;
}

export interface ForceSimOptions {
  centerForce?: number;
  repelForce?: number;
  linkForce?: number;
  linkDistanceBase?: number;
  damping?: number;
  ticksPerFrame?: number;
}

const DEFAULT_OPTIONS: ForceSimOptions = {
  centerForce: 0.01,
  repelForce: 50,
  linkForce: 0.5,
  linkDistanceBase: 80,
  damping: 0.99,
  ticksPerFrame: 1,
};

export function useForceSimulation(
  nodesRef: React.MutableRefObject<SimNode[]>,
  linksRef: React.MutableRefObject<GraphLink[]>,
  edgeLengthsRef: React.MutableRefObject<Map<string, number>>,
  canvasSize: { width: number; height: number },
  options: ForceSimOptions = {},
) {
  const workerRef = useRef<Worker | null>(null);
  const readyRef = useRef(false);
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // 启动 Worker
  useEffect(() => {
    const worker = new Worker("/graphWorker.js");
    worker.onmessage = (event: MessageEvent) => {
      if (event.data.ready) {
        readyRef.current = true;
        return;
      }

      const { ids, positions } = event.data;
      if (!ids || !positions) return;

      const posArray = new Float32Array(positions);
      for (let i = 0; i < ids.length; i++) {
        const node = nodesRef.current.find(n => n.id === ids[i]);
        if (node) {
          node.x = posArray[i * 2];
          node.y = posArray[i * 2 + 1];
        }
      }
    };

    workerRef.current = worker;

    return () => {
      worker.terminate();
      workerRef.current = null;
      readyRef.current = false;
    };
  }, [nodesRef]);

  const initSimulation = useCallback(() => {
    const worker = workerRef.current;
    if (!worker || !nodesRef.current.length) return;
    if (canvasSize.width === 0 || canvasSize.height === 0) return;

    // 构建 nodes map → [x, y]
    const nodeMap: Record<string, [number, number]> = {};
    for (const n of nodesRef.current) {
      nodeMap[n.id] = [n.x, n.y];
    }

    // 构建 links → [sourceId, targetId]
    const linkPairs: [string, string][] = [];
    const nodeIds = new Set(nodesRef.current.map(n => n.id));
    for (const link of linksRef.current) {
      const srcId = typeof link.source === "string" ? link.source : (link.source as any)?.id;
      const tgtId = typeof link.target === "string" ? link.target : (link.target as any)?.id;
      if (srcId && tgtId && nodeIds.has(srcId) && nodeIds.has(tgtId)) {
        linkPairs.push([srcId, tgtId]);
      }
    }

    worker.postMessage({
      nodes: nodeMap,
      links: linkPairs,
      centerX: canvasSize.width / 2,
      centerY: canvasSize.height / 2,
    });
  }, [nodesRef, linksRef, canvasSize]);

  const tick = useCallback(() => {
    const worker = workerRef.current;
    if (!worker || !readyRef.current) return;
    worker.postMessage({ alpha: 0.3, run: true });
  }, []);

  const fixNode = useCallback(
    (nodeId: string, x: number, y: number) => {
      const node = nodesRef.current.find(n => n.id === nodeId);
      if (node) {
        node.fx = x;
        node.fy = y;
        workerRef.current?.postMessage({
          forceNode: { id: nodeId, x, y },
        });
      }
    },
    [nodesRef],
  );

  const releaseNode = useCallback(
    (nodeId: string) => {
      const node = nodesRef.current.find(n => n.id === nodeId);
      if (node) {
        node.fx = null;
        node.fy = null;
        workerRef.current?.postMessage({
          forceNode: { id: nodeId, x: 0, y: 0, release: true },
        });
      }
    },
    [nodesRef],
  );

  const stop = useCallback(() => {
    workerRef.current?.terminate();
  }, []);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  return { tick, stop, fixNode, releaseNode, initSimulation };
}
```

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit src/hooks/useForceSimulation.ts 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useForceSimulation.ts
git commit -m "refactor(graph): bridge useForceSimulation to Web Worker"
```

---

### Task 5: 微调 graph/page.tsx — 适配新接口

**Files:**
- Modify: `src/app/graph/page.tsx`

GraphCanvas 的 props 接口不变，但 PixiJS 的 canvas 不再通过 `containerRef` 的 `clientWidth/height` 自动测量。需要确保 ResizeObserver 仍然正常。

- [ ] **Step 1: 更新 graph/page.tsx 的 canvas 尺寸逻辑**

现有的 `containerRef` + `useEffect` (resize) 逻辑保持不变。GraphCanvas 内部会在容器内创建 PixiJS canvas。

无需改动 `graph/page.tsx` 的核心逻辑。只需要确认：
- GraphCanvas 的 `width`/`height` props 来自 `canvasSize` state
- ResizeObserver 模式保持不变

实际上现有代码已经正确。这一步主要是**验证**而非改动。

- [ ] **Step 2: 运行类型检查**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 无新增错误。

- [ ] **Step 3: Commit** (仅若有改动)

```bash
# 如果无改动则跳过
```

---

### Task 6: 构建验证 + 手动冒烟测试

**Files:**
- (无新文件)

- [ ] **Step 1: 杀掉旧 node 进程并构建**

```bash
taskkill //F //IM node.exe 2>&1 || true
cd d:/Epstein.AI
npm run build 2>&1 | tail -10
```

Expected: build 成功，`/graph` 路由在列表中。

- [ ] **Step 2: 启动服务器**

```bash
npm start &
sleep 3
```

- [ ] **Step 3: 打开图谱页面验证**

```bash
start http://localhost:3000/graph
```

Expected: 图谱页面正常加载，PixiJS canvas 可见，节点和边渲染正常。

**手动验证清单：**
- [ ] 节点显示为彩色圆 + 标签
- [ ] 边显示为彩色连线
- [ ] 鼠标悬停节点 → 标签加粗 + 颜色变化
- [ ] 点击节点 → PersonModal 打开
- [ ] 鼠标滚轮 → 缩放
- [ ] 拖拽节点 → 节点跟随鼠标
- [ ] 拖拽空白区域 → 画布平移
- [ ] 筛选器（职业/关系）→ 数据更新

---

### Task 7: E2E 测试回归

**Files:**
- Modify: `tests/e2e/specs/graph.spec.ts`

Canvas 2D 的像素断言不再适用，改为验证 DOM 结构和功能。

- [ ] **Step 1: 更新 graph.spec.ts**

Canvas 相关测试改为验证 Canvas 元素存在 + 功能交互（点击、筛选）：

```typescript
// tests/e2e/specs/graph.spec.ts 中已有的测试大部分仍然有效
// Canvas 存在检查: page.locator('canvas') 对 PixiJS canvas 同样有效
// Node click 测试: 点击 canvas 中心区域可能不再精确定位到节点
//    → 改为先录入数据再通过 /api/graph 确认节点存在
```

现有 `graph.spec.ts` 的 4 个测试中：
- GRAPH-001 (canvas 可见) — 仍然有效
- GRAPH-002 (canvas click) — 需要调整坐标
- GRAPH-002b (录入数据后节点出现) — 仍然有效
- GRAPH-003 (过滤器) — 仍然有效

- [ ] **Step 2: 运行 E2E 测试**

```bash
npx playwright test tests/e2e/specs/graph.spec.ts --timeout=60000
```

Expected: 4 个测试通过（或至少 3/4，GRAPH-002 可能需要调整）。

- [ ] **Step 3: 运行全量测试**

```bash
npx playwright test --timeout=120000
```

Expected: 核心 P0 测试通过。

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/specs/graph.spec.ts
git commit -m "test(graph): update E2E tests for PixiJS canvas compatibility"
```

---

### 总结

```
Task 1: 安装 pixi.js                    → commit 1
Task 2: 新建 graphWorker.ts + 编译到 public/ → commit 2
Task 3: 重写 GraphCanvas.tsx (PixiJS)    → commit 3
Task 4: 改造 useForceSimulation (Worker) → commit 4
Task 5: 验证 graph/page.tsx 无需改动     → (通常无 commit)
Task 6: 构建 + 手动冒烟测试              → (可能 minor fix commits)
Task 7: E2E 回归                         → commit 5
```

所有改动不涉及 `src/lib/graphService.ts`, `src/app/api/graph/`, `prisma/`, 或任何加密相关文件。与 encryption-pseudo worktree 无冲突。
