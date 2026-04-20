# Knowledge Graph Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将图谱从静态 Sigma.js 渲染升级为 Obsidian 风格的流畅交互图谱，支持丝滑物理动画、变长边距几何、现代浅色视觉，全功能保留。

**Architecture:** 混合架构 — 原生 Canvas 渲染 + d3-force 实时物理模拟。graphService.ts 数据层不变，页面组件重构为 Canvas + hooks 模式。

**Tech Stack:** 原生 Canvas API, d3-force, graphology, React hooks

---

## 文件结构

```
src/app/graph/page.tsx              # 重构：移除 Sigma.js，集成新组件
src/components/GraphCanvas.tsx      # 新建：Canvas 渲染器（纯渲染，无状态）
src/hooks/useForceSimulation.ts     # 新建：d3-force 物理模拟 hook
src/hooks/useGraphInteraction.ts    # 新建：拖拽/hover/选中交互 hook
src/hooks/useSpineBridgeEdges.ts   # 新建：spine/bridge 边长度计算 hook
```

---

## Task 1: 安装 d3-force 依赖

**Files:**
- Modify: `package.json` (新增 d3-force)

- [ ] **Step 1: 安装 d3-force**

Run: `cd d:/Epstein.AI && npm install d3-force`

---

## Task 2: 创建 useForceSimulation Hook

**Files:**
- Create: `src/hooks/useForceSimulation.ts`

- [ ] **Step 1: 创建 useForceSimulation hook**

```typescript
// src/hooks/useForceSimulation.ts
import { useRef, useEffect, useCallback } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
} from 'd3-force';
import type { GraphNode, GraphLink } from '@/lib/graphService';

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
  centerForce: 0.05,
  repelForce: 4000,
  linkForce: 1.0,
  linkDistanceBase: 40,
  damping: 0.85,
  ticksPerFrame: 2,
};

export function useForceSimulation(
  nodesRef: React.MutableRefObject<SimNode[]>,
  linksRef: React.MutableRefObject<GraphLink[]>,
  edgeLengthsRef: React.MutableRefObject<Map<string, number>>,
  canvasSize: { width: number; height: number },
  options: ForceSimOptions = {}
) {
  const simRef = useRef<ReturnType<typeof forceSimulation> | null>(null);
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // 初始化/重启模拟
  const initSimulation = useCallback(() => {
    if (!nodesRef.current.length) return;

    // 终止旧模拟
    if (simRef.current) {
      simRef.current.stop();
    }

    const sim = forceSimulation<SimNode>(nodesRef.current)
      .force('center', forceCenter(canvasSize.width / 2, canvasSize.height / 2).strength(opts.centerForce!))
      .force('charge', forceManyBody<SimNode>().strength(-opts.repelForce!))
      .force('collision', forceCollide<SimNode>().radius(d => Math.sqrt(d.val) * 10 + 20))
      .force('link', forceLink<SimNode, GraphLink>(linksRef.current)
        .id(d => d.source as string)
        .distance(d => {
          const key = `${d.source}-${d.target}`;
          return edgeLengthsRef.current.get(key) ?? opts.linkDistanceBase!;
        })
        .strength(opts.linkForce!)
      )
      .velocityDecay(opts.damping!)
      .alphaDecay(0.01);

    simRef.current = sim;
    return sim;
  }, [nodesRef, linksRef, edgeLengthsRef, canvasSize, opts]);

  // 驱动 tick（每帧调用多次）
  const tick = useCallback(() => {
    if (!simRef.current) return 0;
    const sim = simRef.current;
    for (let i = 0; i < (opts.ticksPerFrame ?? 2); i++) {
      sim.tick();
    }
    return sim.alpha();
  }, [opts.ticksPerFrame]);

  // 停止模拟
  const stop = useCallback(() => {
    simRef.current?.stop();
  }, []);

  // 重新启动（拖拽释放后）
  const reheat = useCallback(() => {
    simRef.current?.alpha(0.3).restart();
  }, []);

  // 固定节点位置（拖拽时）
  const fixNode = useCallback((nodeId: string, x: number, y: number) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (node) {
      node.fx = x;
      node.fy = y;
    }
  }, [nodesRef]);

  // 释放节点（拖拽结束）
  const releaseNode = useCallback((nodeId: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (node) {
      node.fx = null;
      node.fy = null;
    }
    reheat();
  }, [nodesRef, reheat]);

  useEffect(() => {
    return () => {
      simRef.current?.stop();
    };
  }, []);

  return { tick, stop, reheat, fixNode, releaseNode, initSimulation };
}
```

- [ ] **Step 2: 提交**

```bash
git add src/hooks/useForceSimulation.ts
git commit -m "feat(graph): add useForceSimulation hook with d3-force physics"
```

---

## Task 3: 创建 useSpineBridgeEdges Hook

**Files:**
- Create: `src/hooks/useSpineBridgeEdges.ts`

- [ ] **Step 1: 创建 useSpineBridgeEdges hook**

```typescript
// src/hooks/useSpineBridgeEdges.ts
import { useCallback } from 'react';
import type { GraphNode, GraphLink } from '@/lib/graphService';

const SPINE_DEGREE_THRESHOLD = 2;
const SPINE_LENGTH = 40;
const BRIDGE_LENGTH = 160;

export interface EdgeLengthEntry {
  key: string;
  length: number;
  type: 'spine' | 'bridge';
}

export function useSpineBridgeEdges(
  nodes: GraphNode[],
  links: GraphLink[]
) {
  // 计算每个节点的度数
  const degreeMap = useCallback(() => {
    const map = new Map<string, number>();
    for (const link of links) {
      map.set(link.source, (map.get(link.source) ?? 0) + 1);
      map.set(link.target, (map.get(link.target) ?? 0) + 1);
    }
    return map;
  }, [links]);

  // 计算所有边的长度
  const computeEdgeLengths = useCallback((): Map<string, number> => {
    const degree = degreeMap();
    const lengths = new Map<string, number>();

    for (const link of links) {
      const key = `${link.source}-${link.target}`;
      const sourceDeg = degree.get(link.source) ?? 0;
      const targetDeg = degree.get(link.target) ?? 0;

      // Spine: 叶子节点（度≤2）到其他节点
      // Bridge: 两个非叶子节点之间
      const isSpine = sourceDeg <= SPINE_DEGREE_THRESHOLD || targetDeg <= SPINE_DEGREE_THRESHOLD;
      const length = isSpine ? SPINE_LENGTH : BRIDGE_LENGTH;

      lengths.set(key, length);
    }
    return lengths;
  }, [links, degreeMap]);

  return { computeEdgeLengths, SPINE_LENGTH, BRIDGE_LENGTH };
}
```

- [ ] **Step 2: 提交**

```bash
git add src/hooks/useSpineBridgeEdges.ts
git commit -m "feat(graph): add spine/bridge edge length computation"
```

---

## Task 4: 创建 GraphCanvas 组件（静态版本）

**Files:**
- Create: `src/components/GraphCanvas.tsx`

- [ ] **Step 1: 创建 GraphCanvas 组件**

```tsx
// src/components/GraphCanvas.tsx
"use client";

import { useRef, useEffect, useCallback } from 'react';
import { tokens as C } from '@/lib/design-tokens';
import type { SimNode } from '@/hooks/useForceSimulation';
import type { GraphLink } from '@/lib/graphService';

const LINK_COLORS: Record<string, string> = {
  interaction: '#60a5fa',
  introducedBy: '#f59e0b',
  sharedCareer: '#10b981',
  sharedCity: '#8b5cf6',
  sharedInterest: '#f97316',
  sharedPlace: '#ec4899',
  sharedVibe: '#6366f1',
};

const NODE_COLORS: Record<string, string> = {
  default: '#3b82f6',
  '投行': '#10b981',
  '律师': '#f59e0b',
  '医生': '#ef4444',
  '教授': '#8b5cf6',
  '创业者': '#f97316',
  'AI': '#6366f1',
};

function getGroupColor(group: string): string {
  for (const [key, color] of Object.entries(NODE_COLORS)) {
    if (group.includes(key)) return color;
  }
  return NODE_COLORS.default;
}

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
}

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
}: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const draggingRef = useRef<{ id: string; startX: number; startY: number } | null>(null);

  // 查找节点
  const findNodeAt = useCallback((x: number, y: number): SimNode | null => {
    const nodes = nodesRef.current;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const r = Math.sqrt(node.val) * 10 + 12; // 节点半径
      const dx = x - node.x;
      const dy = y - node.y;
      if (dx * dx + dy * dy <= r * r) {
        return node;
      }
    }
    return null;
  }, [nodesRef]);

  // 绑定鼠标事件
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getPos = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onMouseDown = (e: MouseEvent) => {
      const pos = getPos(e);
      const node = findNodeAt(pos.x, pos.y);
      if (node) {
        draggingRef.current = { id: node.id, startX: pos.x, startY: pos.y };
        onDragStart(node.id, pos.x, pos.y);
        canvas.style.cursor = 'grabbing';
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      const pos = getPos(e);
      if (draggingRef.current) {
        onDragMove(pos.x, pos.y);
      } else {
        const node = findNodeAt(pos.x, pos.y);
        onNodeHover(node?.id ?? null);
        canvas.style.cursor = node ? 'grab' : 'default';
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (draggingRef.current) {
        onDragEnd(draggingRef.current.id);
        draggingRef.current = null;
        canvas.style.cursor = 'default';
      }
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', () => onNodeHover(null));

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', () => onNodeHover(null));
    };
  }, [findNodeAt, onNodeHover, onDragStart, onDragMove, onDragEnd]);

  // 绘制循环
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置 canvas 尺寸
    canvas.width = width;
    canvas.height = height;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      const nodes = nodesRef.current;
      const links = linksRef.current;
      const hovered = hoveredNodeId;
      const selected = selectedNodeId;

      // 构建节点 ID set（用于高亮相连边）
      const connectedNodes = new Set<string>();
      if (hovered || selected) {
        const targetId = hovered ?? selected;
        links.forEach(link => {
          if (link.source === targetId) connectedNodes.add(link.target);
          if (link.target === targetId) connectedNodes.add(link.source);
        });
      }

      // 绘制边
      for (const link of links) {
        const sourceNode = nodes.find(n => n.id === link.source);
        const targetNode = nodes.find(n => n.id === link.target);
        if (!sourceNode || !targetNode) continue;

        const isConnected = hovered && (link.source === hovered || link.target === hovered);
        const isSelectedConnected = selected && (link.source === selected || link.target === selected);
        const dimmed = (hovered || selected) && !isConnected && !isSelectedConnected;

        ctx.beginPath();
        ctx.moveTo(sourceNode.x, sourceNode.y);
        ctx.lineTo(targetNode.x, targetNode.y);

        const color = LINK_COLORS[link.type] ?? '#999';
        const alpha = dimmed ? 0.1 : 0.6;
        const lineWidth = isConnected || isSelectedConnected ? 3 : Math.max(link.strength * 2, 1);

        ctx.strokeStyle = color + Math.round(alpha * 255).toString(16).padStart(2, '0');
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }

      // 绘制节点
      for (const node of nodes) {
        const r = Math.sqrt(node.val) * 10 + 12;
        const isHovered = node.id === hovered;
        const isSelected = node.id === selected;
        const dimmed = (hovered || selected) && !isHovered && !isSelected && !connectedNodes.has(node.id);
        const baseColor = getGroupColor(node.group);

        ctx.beginPath();
        ctx.arc(node.x, node.y, isHovered ? r * 1.2 : r, 0, Math.PI * 2);

        // 填充
        ctx.fillStyle = dimmed ? baseColor + '40' : baseColor;
        ctx.fill();

        // 白色描边
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // hover 发光效果
        if (isHovered && !dimmed) {
          ctx.save();
          ctx.shadowColor = baseColor;
          ctx.shadowBlur = 15;
          ctx.beginPath();
          ctx.arc(node.x, node.y, isHovered ? r * 1.2 : r, 0, Math.PI * 2);
          ctx.fillStyle = baseColor + '60';
          ctx.fill();
          ctx.restore();
        }

        // 选中高亮
        if (isSelected) {
          ctx.save();
          ctx.strokeStyle = baseColor;
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.restore();
        }

        // 标签（hover 时或未缩放时显示）
        if (isHovered || isSelected) {
          ctx.font = '12px sans-serif';
          ctx.fillStyle = C.text;
          ctx.textAlign = 'center';
          ctx.fillText(node.label, node.x, node.y + r + 14);
        }
      }
    };

    const loop = () => {
      draw();
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [width, height, hoveredNodeId, selectedNodeId, nodesRef, linksRef]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
      }}
    />
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add src/components/GraphCanvas.tsx
git commit -m "feat(graph): add GraphCanvas component with native Canvas rendering"
```

---

## Task 5: 重构 page.tsx 集成所有组件

**Files:**
- Modify: `src/app/graph/page.tsx`

> 保留所有现有 UI 元素（筛选栏、图例、PersonModal），仅替换渲染部分

- [ ] **Step 1: 重构 page.tsx**

```tsx
// src/app/graph/page.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { tokens as C } from '@/lib/design-tokens';
import GraphCanvas from '@/components/GraphCanvas';
import { useForceSimulation } from '@/hooks/useForceSimulation';
import { useSpineBridgeEdges } from '@/hooks/useSpineBridgeEdges';
import { SimNode } from '@/hooks/useForceSimulation';
import PersonModal from '@/components/PersonModal';
import Header from '@/components/Header';
import type { GraphNode, GraphLink, GraphData, GraphCluster } from '@/lib/graphService';

const CLUSTER_COLORS: Record<string, string> = {
  city: '#3b82f6', career: '#10b981', interest: '#f59e0b', place: '#ec4899', vibe: '#8b5cf6',
};

export default function JeffreyGraphPage() {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [], clusters: [] });
  const [loading, setLoading] = useState(true);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [filter, setFilter] = useState({ group: '', linkType: '', minStrength: 0 });

  // Canvas 尺寸
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  // 渲染数据 refs
  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);
  const edgeLengthsRef = useRef<Map<string, number>>(new Map());

  // spine/bridge 计算
  const { computeEdgeLengths } = useSpineBridgeEdges(graphData.nodes, graphData.links);

  // 物理模拟
  const { tick, fixNode, releaseNode, initSimulation } = useForceSimulation(
    nodesRef,
    linksRef,
    edgeLengthsRef,
    canvasSize
  );

  // 窗口尺寸变化
  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setCanvasSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // 获取数据
  const fetchGraphData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter.group) params.append('group', filter.group);
      if (filter.linkType) params.append('linkType', filter.linkType);
      if (filter.minStrength > 0) params.append('minStrength', filter.minStrength.toString());
      const data: GraphData = await (await fetch(`/api/graph?${params}`)).json();
      setGraphData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchGraphData(); }, [fetchGraphData]);

  // 数据变化时更新 refs
  useEffect(() => {
    if (!graphData.nodes.length) {
      nodesRef.current = [];
      linksRef.current = [];
      return;
    }

    // 初始化节点位置（随机分布在 canvas 内）
    const cx = canvasSize.width / 2;
    const cy = canvasSize.height / 2;
    nodesRef.current = graphData.nodes.map((node, i) => {
      const angle = (i / graphData.nodes.length) * Math.PI * 2;
      const r = 50 + Math.random() * 100;
      return {
        ...node,
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        vx: 0,
        vy: 0,
      };
    });

    linksRef.current = graphData.links;
    edgeLengthsRef.current = computeEdgeLengths();

    // 启动物理模拟
    initSimulation();
  }, [graphData, canvasSize, computeEdgeLengths, initSimulation]);

  // 拖拽回调
  const handleDragStart = useCallback((id: string, x: number, y: number) => {
    fixNode(id, x, y);
  }, [fixNode]);

  const handleDragMove = useCallback((x: number, y: number) => {
    if (nodesRef.current.length > 0) {
      // 找到当前拖拽节点并更新位置
      const dragged = nodesRef.current.find(n => n.fx != null);
      if (dragged) {
        dragged.fx = x;
        dragged.fy = y;
      }
    }
  }, []);

  const handleDragEnd = useCallback((id: string) => {
    releaseNode(id);
  }, [releaseNode]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: C.bg, display: 'flex', flexDirection: 'column' }}>
      <Header />

      {/* Filter Bar */}
      <div style={{ backgroundColor: C.bgCard, borderBottom: `1px solid ${C.border}`, padding: "10px 24px", display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' as const }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, color: C.textSecondary }}>职业</span>
          <input
            type="text"
            value={filter.group}
            onChange={e => setFilter(f => ({ ...f, group: e.target.value }))}
            placeholder="如：AI、投行..."
            style={{ padding: "5px 10px", border: `1.5px solid ${C.borderStrong}`, borderRadius: 7, fontSize: 13, outline: 'none', width: 130, color: C.text }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, color: C.textSecondary }}>关系</span>
          <select
            value={filter.linkType}
            onChange={e => setFilter(f => ({ ...f, linkType: e.target.value }))}
            style={{ padding: "5px 10px", border: `1.5px solid ${C.borderStrong}`, borderRadius: 7, fontSize: 13, outline: 'none', color: C.text, cursor: 'pointer' }}
          >
            <option value="">全部</option>
            <option value="interaction">互动</option>
            <option value="introducedBy">介绍人</option>
            <option value="sharedCareer">同行</option>
            <option value="sharedCity">同城</option>
            <option value="sharedInterest">同好</option>
            <option value="sharedPlace">常去同地</option>
            <option value="sharedVibe">相似性格</option>
          </select>
        </div>
        <button
          onClick={fetchGraphData}
          style={{ padding: "5px 14px", backgroundColor: C.primary, color: C.textInverse, border: "none", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
        >
          刷新
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto', flexWrap: 'wrap' as const }}>
          {(['career', 'city', 'interest', 'place', 'vibe'] as const).map(cat => (
            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: CLUSTER_COLORS[cat] + '99' }} />
              <span style={{ fontSize: 12, color: C.textSecondary }}>
                {cat === 'career' ? '职业' : cat === 'city' ? '城市' : cat === 'interest' ? '兴趣' : cat === 'place' ? '地点' : '性格'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Graph Canvas */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative' }}>
        <GraphCanvas
          nodesRef={nodesRef}
          linksRef={linksRef}
          width={canvasSize.width}
          height={canvasSize.height}
          hoveredNodeId={hoveredNodeId}
          selectedNodeId={selectedPersonId}
          onNodeHover={setHoveredNodeId}
          onNodeClick={setSelectedPersonId}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
        />
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(245,243,239,0.7)' }}>
            <span style={{ color: C.textMuted, fontSize: 14 }}>加载中...</span>
          </div>
        )}
        {!loading && graphData.nodes.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: C.textMuted }}>
              <p style={{ fontSize: 16, marginBottom: 6 }}>暂无数据</p>
              <p style={{ fontSize: 13 }}>请先在录入页面添加人物信息</p>
            </div>
          </div>
        )}
      </div>

      {/* Legend Card */}
      <div style={{
        position: 'absolute', bottom: 20, left: 20,
        backgroundColor: C.bgCard, border: `1px solid ${C.border}`,
        borderRadius: 10, padding: '12px 16px',
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>关系类型</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {[
            ['interaction', '互动', '#60a5fa'],
            ['introducedBy', '介绍人', '#f59e0b'],
            ['sharedCareer', '同行', '#10b981'],
            ['sharedCity', '同城', '#8b5cf6'],
            ['sharedInterest', '同好', '#f97316'],
            ['sharedPlace', '常去同地', '#ec4899'],
            ['sharedVibe', '相似性格', '#6366f1'],
          ].map(([type, label, color]) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: C.textSecondary }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {selectedPersonId && (
        <PersonModal personId={selectedPersonId} onClose={() => setSelectedPersonId(null)} onSaved={fetchGraphData} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add src/app/graph/page.tsx
git commit -m "refactor(graph): replace Sigma.js with Canvas + d3-force physics"
```

---

## Task 6: 集成物理模拟动画帧

**目标：** 让 GraphCanvas 的 RAF 渲染循环同时驱动 d3-force tick()

- [ ] **Step 1: 修改 GraphCanvasProps 和组件**

```tsx
// GraphCanvas.tsx - GraphCanvasProps 改为:
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
  onTick: () => void;  // 新增：驱动物理 tick
}
```

在渲染循环的 `useEffect` 中，将 `draw()` 改为先调用 `onTick()` 再 `draw()`：

```tsx
// 在 const loop = () => { ... } 中:
const loop = () => {
  onTick();  // 驱动物理模拟
  draw();
  animFrameRef.current = requestAnimationFrame(loop);
};
```

- [ ] **Step 2: 修改 page.tsx 传递 tick**

在 page.tsx 中，从 `useForceSimulation` 获取 `tick` 函数，并通过 prop 传递给 GraphCanvas：

```tsx
// page.tsx 中:
// const { tick, fixNode, releaseNode, initSimulation } = useForceSimulation(...)
// 改为:
const { tick, fixNode, releaseNode, initSimulation } = useForceSimulation(
  nodesRef, linksRef, edgeLengthsRef, canvasSize
);

// 在 <GraphCanvas .../> 中添加:
<GraphCanvas
  // ...其他 props
  onTick={tick}
/>
```

- [ ] **Step 3: 提交**

```bash
git add src/components/GraphCanvas.tsx src/app/graph/page.tsx
git commit -m "feat(graph): integrate d3-force tick into render loop"
```

---

## Task 7: 移除 sigma 依赖

**Files:**
- Modify: `package.json` (移除 sigma 相关)

- [ ] **Step 1: 移除 sigma 依赖**

Run: `npm uninstall sigma @react-sigma/core`

---

## Task 8: 手动测试并修复问题

**验证：**
1. 页面加载后物理模拟自动运行，节点逐渐分散
2. 拖拽节点时相邻节点立即跟随
3. 释放节点后自然落位
4. hover 节点时高亮相连边
5. 所有筛选功能正常工作
6. PersonModal 正常弹出
7. 刷新按钮正常工作

---

## 规范检查清单

- [ ] Spec 覆盖：丝滑物理动画 ✓ | 变长边距 ✓ | 现代浅色视觉 ✓ | 全功能保留 ✓
- [ ] 无占位符：所有代码块完整，无 TBD/TODO
- [ ] 类型一致性：GraphNode/GraphLink/SimNode 在所有文件中一致
- [ ] 依赖：d3-force 已添加，sigma 已移除
