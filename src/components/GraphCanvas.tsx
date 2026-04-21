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

  // 将 onTick 存储在 ref 中，这样动画循环不依赖 onTick 的引用
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  // 鼠标事件绑定
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const nodes = nodesRef.current;
      for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i];
        const r = Math.sqrt(node.val) * 10 + 14;
        const dx = pos.x - node.x;
        const dy = pos.y - node.y;
        if (dx * dx + dy * dy <= r * r) {
          draggingRef.current = { id: node.id, startX: pos.x, startY: pos.y };
          onDragStart(node.id, pos.x, pos.y);
          canvas.style.cursor = 'grabbing';
          return;
        }
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      if (draggingRef.current) {
        onDragMove(pos.x, pos.y);
        return;
      }
      // Hover 检测
      const nodes = nodesRef.current;
      let found: SimNode | null = null;
      for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i];
        const r = Math.sqrt(node.val) * 10 + 14;
        const dx = pos.x - node.x;
        const dy = pos.y - node.y;
        if (dx * dx + dy * dy <= r * r) {
          found = node;
          break;
        }
      }
      onNodeHover(found ? found.id : null);
      canvas.style.cursor = found ? 'grab' : 'default';
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
  }, [nodesRef, onNodeHover, onDragStart, onDragMove, onDragEnd]);

  // hover/select 状态存入 ref，draw loop 读取 ref，不因状态变化重启 effect
  const hoveredNodeIdRef = useRef(hoveredNodeId);
  hoveredNodeIdRef.current = hoveredNodeId;
  const selectedNodeIdRef = useRef(selectedNodeId);
  selectedNodeIdRef.current = selectedNodeId;

  // 绘制循环 — 仅依赖 width/height，hover/select 变化不重启循环
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (width === 0 || height === 0) return;

    // DPR 高清渲染
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.scale(dpr, dpr);

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      const nodes = nodesRef.current;
      const links = linksRef.current;
      const hovered = hoveredNodeIdRef.current;
      const selected = selectedNodeIdRef.current;

      // 绘制边
      for (const link of links) {
        const srcId = typeof link.source === 'string' ? link.source : (link.source as SimNode).id;
        const tgtId = typeof link.target === 'string' ? link.target : (link.target as SimNode).id;
        const sourceNode = nodes.find(n => n.id === srcId);
        const targetNode = nodes.find(n => n.id === tgtId);
        if (!sourceNode || !targetNode) continue;

        ctx.beginPath();
        ctx.moveTo(sourceNode.x, sourceNode.y);
        ctx.lineTo(targetNode.x, targetNode.y);
        ctx.strokeStyle = LINK_COLORS[link.type] || '#999';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.globalAlpha = 0.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // 绘制节点
      for (const node of nodes) {
        const r = Math.sqrt(node.val) * 10 + 14;
        const isHovered = node.id === hovered;
        const isSelected = node.id === selected;
        const baseColor = getGroupColor(node.group);

        // 选中时外发光
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

        // 节点主体
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fillStyle = baseColor;
        ctx.fill();
        ctx.strokeStyle = isHovered || isSelected ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.8)';
        ctx.lineWidth = isHovered || isSelected ? 2.5 : 1.5;
        ctx.stroke();

        // 标签
        const fontSize = isHovered || isSelected ? 13 : 12;
        ctx.font = '500 ' + fontSize + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = C.text;
        ctx.fillText(node.label, node.x, node.y + r + 14);
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
  }, [width, height, nodesRef, linksRef]); // 不依赖 hoveredNodeId/selectedNodeId，避免 hover 时重启循环

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}
