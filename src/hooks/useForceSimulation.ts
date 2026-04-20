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