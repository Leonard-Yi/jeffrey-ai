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

    if (highlighted) {
      g.lineStyle(2.5, 0xffffff, 0.95);
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

  drawLine(x1: number, y1: number, x2: number, y2: number, alpha: number) {
    const g = this.gfx;
    const color = LINK_COLORS[this.type] ?? 0x999999;
    g.clear();
    g.lineStyle(1.5, color, 0.5 * alpha);
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
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
  const hangerRef = useRef<PIXI.Container | null>(null);
  const nodeGfxRef = useRef<Map<string, GraphNodeGfx>>(new Map());
  const linkGfxRef = useRef<GraphLinkGfx[]>([]);
  const animFrameRef = useRef<number>(0);
  const dragRef = useRef<{ id: string } | null>(null);
  const scaleRef = useRef({ current: 0.5, target: 0.5 });
  const panRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  // ── PixiJS 初始化 (once) ──────────────────────────────────

  useEffect(() => {
    if (!containerRef.current) return;
    if (width === 0 || height === 0) return;
    if (appRef.current) return; // already initialized

    const app = new PIXI.Application();
    const init = async () => {
      await app.init({
        width,
        height,
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      containerRef.current!.appendChild(app.canvas);

      const hanger = new PIXI.Container();
      app.stage.addChild(hanger);
      hangerRef.current = hanger;

      scaleRef.current.current = 0.5;
      scaleRef.current.target = 0.5;
      panRef.current.x = width / 2;
      panRef.current.y = height / 2;
      panRef.current.targetX = panRef.current.x;
      panRef.current.targetY = panRef.current.y;
      hanger.x = panRef.current.x;
      hanger.y = panRef.current.y;
      hanger.scale.set(0.5);

      appRef.current = app;
    };
    init();

    return () => {
      // cleanup handled by key change
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 当 width/height 从 0 变为有值时，初始化 ────────────────

  useEffect(() => {
    if (!appRef.current && width > 0 && height > 0 && containerRef.current) {
      const app = new PIXI.Application();
      const initApp = async () => {
        await app.init({
          width,
          height,
          backgroundAlpha: 0,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        });
        containerRef.current!.appendChild(app.canvas);

        const hanger = new PIXI.Container();
        app.stage.addChild(hanger);
        hangerRef.current = hanger;

        scaleRef.current.current = 0.5;
        scaleRef.current.target = 0.5;
        panRef.current.x = width / 2;
        panRef.current.y = height / 2;
        panRef.current.targetX = panRef.current.x;
        panRef.current.targetY = panRef.current.y;
        hanger.x = panRef.current.x;
        hanger.y = panRef.current.y;
        hanger.scale.set(0.5);

        appRef.current = app;
      };
      initApp();
    }
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
  }, [width, height, nodesRef, onNodeHover, onDragStart, onDragMove, onDragEnd]);

  // ── 数据同步：创建/删除 nodeGfx 和 linkGfx ──────────────────

  useEffect(() => {
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
  }, [nodesRef, linksRef, onNodeClick]);

  // ── 渲染循环 ───────────────────────────────────────────────

  const hoveredRef = useRef(hoveredNodeId);
  hoveredRef.current = hoveredNodeId;
  const selectedRef = useRef(selectedNodeId);
  selectedRef.current = selectedNodeId;

  useEffect(() => {
    const app = appRef.current;
    const hanger = hangerRef.current;
    if (!app || !hanger) return;

    let running = true;

    const loop = () => {
      if (!running) return;

      onTickRef.current();

      const s = scaleRef.current;
      const p = panRef.current;

      // lerp zoom + pan
      s.current = lerp(s.current, s.target, 0.15);
      p.x = lerp(p.x, p.targetX, 0.15);
      p.y = lerp(p.y, p.targetY, 0.15);

      hanger.x = p.x;
      hanger.y = p.y;
      hanger.scale.set(s.current);

      const hovered = hoveredRef.current;
      const selected = selectedRef.current;

      // 绘制节点
      const nodeGfxMap = nodeGfxRef.current;
      const nodes = nodesRef.current;
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const gfx = nodeGfxMap.get(node.id);
        if (!gfx) continue;

        const highlighted = node.id === hovered || node.id === selected;
        gfx.drawCircle(highlighted, false);

        gfx.circle.x = node.x;
        gfx.circle.y = node.y;

        const fontSize = highlighted ? 14 : 12;
        gfx.text.style.fontSize = fontSize;
        gfx.text.style.fill = highlighted ? C.primary : C.text;
        gfx.text.x = node.x;
        gfx.text.y = node.y + gfx.getSize() + 6;
        gfx.text.alpha = Math.min(1, Math.max(0, (s.current - 0.25) * 2));
      }

      // 绘制边
      const links = linkGfxRef.current;
      for (let i = 0; i < links.length; i++) {
        const l = links[i];
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
  }, [nodesRef, linksRef]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", overflow: "hidden" }}
    />
  );
}
