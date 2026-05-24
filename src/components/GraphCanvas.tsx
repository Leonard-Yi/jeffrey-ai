// src/components/GraphCanvas.tsx
"use client";

import { useRef, useEffect, useState } from "react";
import * as PIXI from "pixi.js";
import { tokens as C } from "@/lib/design-tokens";
import type { SimNode } from "@/hooks/useForceSimulation";
import type { GraphLink } from "@/lib/graphService";

// ─── Obsidian-style constants ──────────────────────────────────

// Obsidian uses ~0.2 for dimmed/unconnected nodes (ie constant in graph.js)
const DIM_ALPHA = 0.2;
const NODE_FILL = 0x9CA3AF;   // gray-400
const NODE_STROKE = 0xE5E7EB; // gray-200
const LINK_COLOR = 0x9CA3AF;  // gray-400
const LINK_HIGHLIGHT = 0x6B7280; // gray-500 (slightly darker when highlighted)
const HIGHLIGHT_RING = 0x6B7280; // gray-500

// ─── lerp ───────────────────────────────────────────────────────

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ─── Node graphics class ────────────────────────────────────────

class GraphNodeGfx {
  id: string;
  label: string;
  group: string;
  val: number;
  circle: PIXI.Graphics;
  text: PIXI.Text;

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

  // Obsidian formula: sqrt(weight + 1) × 3, clamped 8–30
  getSize(): number {
    return Math.max(8, Math.min(Math.sqrt(this.val + 1) * 3, 30));
  }

  drawCircle(highlighted: boolean, dimmed: boolean) {
    const g = this.circle;
    const size = this.getSize();
    g.clear();

    // Obsidian style: all nodes same fill color, dimmed when not connected to hover
    g.circle(0, 0, size);
    g.fill({ color: NODE_FILL, alpha: dimmed ? DIM_ALPHA : 0.85 });
    g.stroke({
      color: highlighted ? HIGHLIGHT_RING : NODE_STROKE,
      alpha: highlighted ? 0.9 : 0.5,
      width: highlighted ? 2 : 1,
    });
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

  drawLine(x1: number, y1: number, x2: number, y2: number, highlighted: boolean) {
    const g = this.gfx;
    g.clear();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke({
      color: highlighted ? LINK_HIGHLIGHT : LINK_COLOR,
      alpha: highlighted ? 0.6 : 0.25,
      width: highlighted ? 2 : 1,
    });
  }
}

// ─── Props (保持与原 GraphCanvas 完全相同) ───────────────────────

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
  dataVersion: number; // increments when data changes, triggers graphics sync
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
  dataVersion,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [appReady, setAppReady] = useState(false);
  const appRef = useRef<PIXI.Application | null>(null);
  const hangerRef = useRef<PIXI.Container | null>(null);
  const nodeGfxRef = useRef<Map<string, GraphNodeGfx>>(new Map());
  const linkGfxRef = useRef<GraphLinkGfx[]>([]);
  const animFrameRef = useRef<number>(0);
  const dragRef = useRef<{ id: string } | null>(null);
  const scaleRef = useRef({ current: 1, target: 1 });
  const panRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  // ── PixiJS 初始化 (当 dimensions 就绪时) ──────────────────

  useEffect(() => {
    if (!containerRef.current) return;
    if (width === 0 || height === 0) return;
    if (appRef.current) return;

    const app = new PIXI.Application();
    const initApp = async () => {
      try {
        await app.init({
          width,
          height,
          backgroundAlpha: 0,
          antialias: true,
          autoStart: false, // we control rendering via rAF
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        });

        containerRef.current!.appendChild(app.canvas);

        const hanger = new PIXI.Container();
        app.stage.addChild(hanger);
        hangerRef.current = hanger;

        scaleRef.current.current = 1;
        scaleRef.current.target = 1;
        panRef.current.x = 0;
        panRef.current.y = 0;
        panRef.current.targetX = 0;
        panRef.current.targetY = 0;
        hanger.x = 0;
        hanger.y = 0;
        hanger.scale.set(1);

        appRef.current = app;
        setAppReady(true);
      } catch (e) {
        console.error("[GraphCanvas] PIXI init FAILED:", e);
      }
    };
    initApp();
  }, [width, height]);

  // ── Cleanup on unmount ────────────────────────────────────

  useEffect(() => {
    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
        hangerRef.current = null;
        nodeGfxRef.current.clear();
        linkGfxRef.current = [];
      }
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // ── 事件绑定 ───────────────────────────────────────────────

  useEffect(() => {
    if (!appReady) return;
    const app = appRef.current;
    const hanger = hangerRef.current;
    if (!app || !hanger) return;

    const canvas = app.canvas;

    let isPanning = false;
    let panStart = { x: 0, y: 0 };

    const getCanvasPos = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (width / rect.width),
        y: (e.clientY - rect.top) * (height / rect.height),
      };
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY;
      const factor = Math.pow(1.5, -delta / 120);
      const s = scaleRef.current;
      s.target = Math.min(1, Math.max(0.25, s.target * factor));
    };

    const onPointerDown = (e: PointerEvent) => {
      const pos = getCanvasPos(e);
      const s = scaleRef.current.current;

      // 检查是否点在节点上
      const nodes = nodesRef.current;
      for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i];
        const gfx = nodeGfxRef.current.get(node.id);
        const r = gfx ? gfx.getSize() * 1.5 : 15;
        const dx = (pos.x - panRef.current.x) / s - node.x;
        const dy = (pos.y - panRef.current.y) / s - node.y;
        if (dx * dx + dy * dy <= r * r) {
          dragRef.current = { id: node.id };
          onDragStart(node.id, pos.x, pos.y);
          return;
        }
      }

      // 点在空白区 → 平移
      isPanning = true;
      panStart = { x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e: PointerEvent) => {
      const pos = getCanvasPos(e);

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
        const gfx = nodeGfxRef.current.get(node.id);
        const r = gfx ? gfx.getSize() * 1.5 : 15;
        const dx = (pos.x - panRef.current.x) / s - node.x;
        const dy = (pos.y - panRef.current.y) / s - node.y;
        if (dx * dx + dy * dy <= r * r) {
          found = node.id;
          break;
        }
      }
      onNodeHover(found);
    };

    const onPointerUp = () => {
      if (dragRef.current) {
        onDragEnd(dragRef.current.id);
        dragRef.current = null;
      }
      isPanning = false;
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
  }, [appReady, width, height, nodesRef, onNodeHover, onDragStart, onDragMove, onDragEnd]);

  // ── 数据同步：创建/删除 nodeGfx 和 linkGfx ──────────────────

  useEffect(() => {
    if (!appReady) return;
    const app = appRef.current;
    const hanger = hangerRef.current;
    if (!app || !hanger) return;

    const nodeGfxMap = nodeGfxRef.current;

    // 删除不存在的节点
    const newIds = new Set(nodesRef.current.map(n => n.id));
    for (const [id, gfx] of nodeGfxMap) {
      if (!newIds.has(id)) {
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

    // 重建所有 linkGfx
    for (const l of linkGfxRef.current) {
      hanger.removeChild(l.gfx);
      l.gfx.destroy();
    }
    linkGfxRef.current = [];

    for (const link of linksRef.current) {
      const srcId = typeof link.source === "string" ? link.source : (link.source as any)?.id;
      const tgtId = typeof link.target === "string" ? link.target : (link.target as any)?.id;
      if (srcId && tgtId && nodeGfxMap.has(srcId) && nodeGfxMap.has(tgtId)) {
        const l = new GraphLinkGfx(srcId, tgtId, link.type, link.strength);
        hanger.addChildAt(l.gfx, 0); // 边在节点下面
        linkGfxRef.current.push(l);
      }
    }

    // 绑定节点 click 事件
    for (const [id, gfx] of nodeGfxMap) {
      gfx.circle.off("pointertap");
      gfx.circle.on("pointertap", () => onNodeClick(id));
    }
  }, [appReady, dataVersion, onNodeClick]);

  // ── 渲染循环 ───────────────────────────────────────────────

  const hoveredRef = useRef(hoveredNodeId);
  hoveredRef.current = hoveredNodeId;
  const selectedRef = useRef(selectedNodeId);
  selectedRef.current = selectedNodeId;

  useEffect(() => {
    if (!appReady) return;
    const app = appRef.current;
    const hanger = hangerRef.current;
    if (!app || !hanger) return;

    let running = true;

    const loop = () => {
      if (!running) return;

      // Continuous physics — tick every frame for organic movement
      onTickRef.current();

      const s = scaleRef.current;
      const p = panRef.current;

      // Fast lerp (Obsidian uses 0.85 for zoom/pan)
      s.current = lerp(s.current, s.target, 0.85);
      p.x = lerp(p.x, p.targetX, 0.85);
      p.y = lerp(p.y, p.targetY, 0.85);

      hanger.x = p.x;
      hanger.y = p.y;
      hanger.scale.set(s.current);

      const hovered = hoveredRef.current;
      const selected = selectedRef.current;
      const highlightId = hovered || selected;

      const nodeGfxMap = nodeGfxRef.current;
      const nodes = nodesRef.current;

      // Build connected set for Obsidian-style highlight
      const connectedIds = new Set<string>();
      if (highlightId) {
        connectedIds.add(highlightId);
        for (const l of linkGfxRef.current) {
          if (l.sourceId === highlightId) connectedIds.add(l.targetId);
          if (l.targetId === highlightId) connectedIds.add(l.sourceId);
        }
      }

      // Draw nodes
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const gfx = nodeGfxMap.get(node.id);
        if (!gfx) continue;

        // Lerp towards target position for smooth movement
        const tx = (node as any)._tx;
        const ty = (node as any)._ty;
        // Skip lerp for dragged nodes (fx set) — follow mouse directly
        if (tx != null && ty != null && node.fx == null && node.fy == null) {
          node.x = lerp(node.x, tx, 0.6);
          node.y = lerp(node.y, ty, 0.6);
        }

        const isFocused = node.id === highlightId;
        const isConnected = highlightId && connectedIds.has(node.id);
        const shouldDim = highlightId ? (!isFocused && !isConnected) : false;

        gfx.drawCircle(isFocused, shouldDim);

        gfx.circle.x = node.x;
        gfx.circle.y = node.y;

        gfx.text.style.fontSize = isFocused ? 14 : 12;
        gfx.text.style.fill = isFocused ? C.text : C.textMuted;
        gfx.text.x = node.x;
        gfx.text.y = node.y + gfx.getSize() + 6;
        gfx.text.alpha = Math.min(1, Math.max(0, (s.current - 0.25) * 2));
        if (shouldDim) gfx.text.alpha *= 0.3;
      }

      // Draw links
      const links = linkGfxRef.current;
      for (let i = 0; i < links.length; i++) {
        const l = links[i];
        const srcGfx = nodeGfxMap.get(l.sourceId);
        const tgtGfx = nodeGfxMap.get(l.targetId);
        if (!srcGfx || !tgtGfx) continue;
        const isHighlighted = highlightId
          ? (l.sourceId === highlightId || l.targetId === highlightId)
          : false;
        l.drawLine(
          srcGfx.circle.x, srcGfx.circle.y,
          tgtGfx.circle.x, tgtGfx.circle.y,
          isHighlighted,
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
  }, [appReady]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", overflow: "hidden" }}
    />
  );
}
