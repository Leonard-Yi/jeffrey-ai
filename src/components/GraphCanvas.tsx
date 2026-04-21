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
  onTick: () => void;
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
  onTick,
}: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const draggingRef = useRef<{ id: string; startX: number; startY: number } | null>(null);

  // 将 onTick 存储在 ref 中，这样动画循环不需要是依赖项
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  // 将 hover/select 状态存储在 ref 中，动画循环读取这些 ref
  // 而不依赖于 React 重新渲染
  const hoveredNodeIdRef = useRef<string | null>(hoveredNodeId);
  const selectedNodeIdRef = useRef<string | null>(selectedNodeId);
  hoveredNodeIdRef.current = hoveredNodeId;
  selectedNodeIdRef.current = selectedNodeId;

  // 节流日志
  const lastLogRef = useRef<number>(0);
  const throttleLog = (label: string, msg: string) => {
    const now = Date.now();
    if (now - lastLogRef.current > 1000) {
      lastLogRef.current = now;
      console.error('[GraphCanvas] ' + label + ': ' + msg);
    }
  };

  // 初始化次数追踪
  const initCountRef = useRef(0);

  // 查找节点
  const findNodeAt = useCallback((canvasX: number, canvasY: number): SimNode | null => {
    const nodes = nodesRef.current;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const r = Math.sqrt(node.val) * 10 + 14;
      const dx = canvasX - node.x;
      const dy = canvasY - node.y;
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

    const onMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const node = findNodeAt(pos.x, pos.y);
      if (node) {
        draggingRef.current = { id: node.id, startX: pos.x, startY: pos.y };
        onDragStart(node.id, pos.x, pos.y);
        canvas.style.cursor = 'grabbing';
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      if (draggingRef.current) {
        onDragMove(pos.x, pos.y);
      } else {
        const node = findNodeAt(pos.x, pos.y);
        const newHoverId = node?.id ?? null;
        const prevHoverId = hoveredNodeIdRef.current;
        if (newHoverId !== prevHoverId) {
          hoveredNodeIdRef.current = newHoverId;
          onNodeHover(newHoverId);
          if (newHoverId !== prevHoverId) {
            throttleLog('hover', newHoverId ? newHoverId.slice(0, 8) : 'null');
          }
        }
        canvas.style.cursor = node ? 'grab' : 'default';
      }
    };

    const onMouseUp = () => {
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

  // 绘制循环（只依赖 nodesRef/linksRef，不依赖 hover/select 状态）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    initCountRef.current++;
    throttleLog('init', 'draw effect run #' + initCountRef.current);

    // DPR 缩放：限制最大为 1.5 倍
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      const nodes = nodesRef.current;
      const links = linksRef.current;
      // 从 ref 读取 hover/select 状态（不触发 React 重新渲染）
      const hovered = hoveredNodeIdRef.current;
      const selected = selectedNodeIdRef.current;

      // 构建高亮连接节点集合
      const connectedNodes = new Set<string>();
      if (hovered || selected) {
        const targetId = hovered ?? selected;
        links.forEach(link => {
          const srcId = typeof link.source === 'string' ? link.source : (link.source as SimNode).id;
          const tgtId = typeof link.target === 'string' ? link.target : (link.target as SimNode).id;
          if (srcId === targetId) connectedNodes.add(tgtId);
          if (tgtId === targetId) connectedNodes.add(srcId);
        });
      }

      // 绘制边
      for (const link of links) {
        const srcId = typeof link.source === 'string' ? link.source : (link.source as SimNode).id;
        const tgtId = typeof link.target === 'string' ? link.target : (link.target as SimNode).id;
        const sourceNode = nodes.find(n => n.id === srcId);
        const targetNode = nodes.find(n => n.id === tgtId);
        if (!sourceNode || !targetNode) continue;

        const isConnected = hovered && (srcId === hovered || tgtId === hovered);
        const isSelectedConnected = selected && (srcId === selected || tgtId === selected);
        const dimmed = (hovered || selected) && !isConnected && !isSelectedConnected;

        ctx.beginPath();
        ctx.moveTo(sourceNode.x, sourceNode.y);
        ctx.lineTo(targetNode.x, targetNode.y);

        const color = LINK_COLORS[link.type] ?? '#999';
        const alpha = dimmed ? 0.08 : 0.5;
        const lineWidth = isConnected || isSelectedConnected ? 2 : Math.max(link.strength * 1.5, 0.8);

        ctx.globalAlpha = alpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // 绘制节点
      for (const node of nodes) {
        const r = Math.sqrt(node.val) * 10 + 14;
        const isHovered = node.id === hovered;
        const isSelected = node.id === selected;
        const isDimmed = (hovered || selected) && !isHovered && !isSelected && !connectedNodes.has(node.id);
        const baseColor = getGroupColor(node.group);

        if (isSelected) {
          ctx.save();
          ctx.shadowColor = baseColor;
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 4, 0, Math.PI * 2);
          ctx.strokeStyle = baseColor;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
        }

        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isDimmed ? baseColor + '50' : baseColor;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = isDimmed ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.85)';
        ctx.lineWidth = isHovered || isSelected ? 2.5 : 1.5;
        ctx.stroke();

        if (!isDimmed) {
          const fontSize = isHovered || isSelected ? 13 : 12;
          ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = C.text;
          ctx.fillText(node.label, node.x, node.y + r + 14);
          ctx.textBaseline = 'alphabetic';
        }
      }
    };

    const loop = () => {
      onTickRef.current();
      draw();
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [width, height, nodesRef, linksRef]); // 不依赖 hoveredNodeId/selectedNodeId！