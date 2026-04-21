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
  const lastHoverRef = useRef<string | null>(null);
  const drawEffectRunsRef = useRef(0);
  const animFrameRef = useRef<number>(0);
  const loopStartedRef = useRef(false); // 幂等：确保动画循环只启动一次
  const draggingRef = useRef<{ id: string; startX: number; startY: number } | null>(null);
  // 用 ref 存储 onTick，避免 effect 因回调引用变化而频繁重启
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  // 节流日志：每 1 秒最多输出一次
  const lastLogRef = useRef<number>(0);
  const throttleLog = (label: string, msg: string) => {
    const now = Date.now();
    if (now - lastLogRef.current > 1000) {
      lastLogRef.current = now;
      console.error('[GraphCanvas] ' + label + ': ' + msg);
    }
  };

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
        onNodeHover(newHoverId);
        canvas.style.cursor = node ? 'grab' : 'default';
        if (newHoverId !== lastHoverRef.current) {
          lastHoverRef.current = newHoverId;
          throttleLog('hover', newHoverId ? newHoverId.slice(0, 8) : 'null');
        }
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

  // 绘制循环
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // DPR 缩放：限制最大为 1.5 倍，避免高分辨率屏幕性能问题
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const internalWidth = Math.round(width * dpr);
    const internalHeight = Math.round(height * dpr);
    canvas.width = internalWidth;
    canvas.height = internalHeight;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // 调试：追踪 effect 是否频繁运行
    const drawEffectRuns = (drawEffectRunsRef.current || 0) + 1;
    drawEffectRunsRef.current = drawEffectRuns;
    if (drawEffectRuns <= 3 || drawEffectRuns % 10 === 0) {
      throttleLog('effect', 'draw effect run #' + drawEffectRuns);
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      const nodes = nodesRef.current;
      const links = linksRef.current;
      const hovered = hoveredNodeId;
      const selected = selectedNodeId;

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

        // 外发光（仅选中时）
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
        ctx.fillStyle = isDimmed ? baseColor + '50' : baseColor;
        ctx.fill();

        // 清晰描边
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = isDimmed ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.85)';
        ctx.lineWidth = isHovered || isSelected ? 2.5 : 1.5;
        ctx.stroke();

        // 标签
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
    // 幂等：即使 effect 重新运行，动画循环也只启动一次
    if (!loopStartedRef.current) {
      loopStartedRef.current = true;
      animFrameRef.current = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      loopStartedRef.current = false;
    };
    // 注意：不放 onTick 进依赖项，避免动画循环频繁重启
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
