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
  repelForce: 300,  // 降低排斥力：避免节点被弹飞
  linkForce: 1.0,
  linkDistanceBase: 40,
  damping: 0.98,   // 更高阻尼：速度快速衰减，节点更快稳定
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

  // 上一次初始化的快照（用于幂等检测）
  const lastInitRef = useRef<{ nodeCount: number; linkCount: number; canvasW: number; canvasH: number } | null>(null);

  // 初始化/重启模拟（幂等：只有数据真正变化才重新初始化）
  const initSimulation = useCallback(() => {
    if (!nodesRef.current.length) return;

    const snapshot = {
      nodeCount: nodesRef.current.length,
      linkCount: linksRef.current.length,
      canvasW: canvasSize.width,
      canvasH: canvasSize.height,
    };

    // 幂等检查：节点数、边数、画布尺寸都没变，则跳过初始化
    const last = lastInitRef.current;
    if (
      last &&
      last.nodeCount === snapshot.nodeCount &&
      last.linkCount === snapshot.linkCount &&
      last.canvasW === snapshot.canvasW &&
      last.canvasH === snapshot.canvasH
    ) {
      return;
    }
    lastInitRef.current = snapshot;

    // 终止旧模拟
    if (simRef.current) {
      simRef.current.stop();
    }

    console.error('[ForceSim] NEW init: nodes=' + snapshot.nodeCount + ' links=' + snapshot.linkCount);

    // 预先解析 links 的 source/target 为节点对象
    const nodeById = new Map(nodesRef.current.map(n => [n.id, n]));
    const resolvedLinks = linksRef.current
      .filter(link => {
        const srcId = typeof link.source === 'string' ? link.source : (link.source as any)?.id;
        const tgtId = typeof link.target === 'string' ? link.target : (link.target as any)?.id;
        return srcId && tgtId && nodeById.has(srcId) && nodeById.has(tgtId);
      })
      .map(link => ({
        ...link,
        source: nodeById.get(typeof link.source === 'string' ? link.source : (link.source as any)?.id)!,
        target: nodeById.get(typeof link.target === 'string' ? link.target : (link.target as any)?.id)!,
      }));

    const sim = forceSimulation<SimNode>(nodesRef.current)
      .force('center', forceCenter(canvasSize.width / 2, canvasSize.height / 2).strength(opts.centerForce!))
      .force('charge', forceManyBody<SimNode>().strength(-opts.repelForce!))
      .force('collision', forceCollide<SimNode>().radius(d => Math.sqrt(d.val) * 10 + 20))
      .force('link', forceLink<SimNode, SimNode>(resolvedLinks)
        .distance(d => {
          const srcId = (d.source as SimNode).id;
          const tgtId = (d.target as SimNode).id;
          const key = `${srcId}-${tgtId}`;
          return edgeLengthsRef.current.get(key) ?? opts.linkDistanceBase!;
        })
        .strength(opts.linkForce!)
      )
      .velocityDecay(opts.damping!)
      .alphaDecay(0.3); // 激进衰减：约7帧内稳定

    simRef.current = sim;
    return sim;
  }, [nodesRef, linksRef, edgeLengthsRef, canvasSize, opts]);

  // 驱动 tick（每帧调用多次）
  const tick = useCallback(() => {
    if (!simRef.current) return 0;
    const sim = simRef.current;
    const alpha = sim.alpha();

    // alpha < 0.005 时认为已稳定，不再驱动模拟
    if (alpha < 0.005) {
      return alpha;
    }

    // alpha 较低时减少每帧 ticks 数，减少震荡
    const ticksThisFrame = alpha < 0.05 ? 1 : (opts.ticksPerFrame ?? 2);
    for (let i = 0; i < ticksThisFrame; i++) {
      sim.tick();
    }
    return sim.alpha();
  }, [opts.ticksPerFrame]);

  // 停止模拟
  const stop = useCallback(() => {
    simRef.current?.stop();
  }, []);

  // 重新启动（拖拽释放后）- 禁用，防止节点被弹开
  const reheat = useCallback(() => {
    // 不做任何事，物理模拟只初始化一次
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
  }, [nodesRef]);

  useEffect(() => {
    return () => {
      simRef.current?.stop();
    };
  }, []);

  return { tick, stop, reheat, fixNode, releaseNode, initSimulation };
}
