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
      onTick();  // 驱动物理模拟
      draw();
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [width, height, hoveredNodeId, selectedNodeId, nodesRef, linksRef, onTick]);

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
