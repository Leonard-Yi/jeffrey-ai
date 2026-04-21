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

    console.error('[ForceSim] initSimulation called, nodes:', nodesRef.current.length);

    // 预先解析 links 的 source/target 为节点对象（而不是让 d3-force 用 .id() 查找）
    // 这样完全避免了 d3-force 内部节点查找的问题
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

    console.error('[ForceSim] resolvedLinks:', resolvedLinks.length, 'node IDs:', [...nodeById.keys()]);
    for (const l of resolvedLinks) {
      console.error('[ForceSim] resolved link source id:', (l.source as SimNode).id, 'target id:', (l.target as SimNode).id);
    }

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
      .alphaDecay(0.01);

    simRef.current = sim;
    lastAlphaRef.current = 0;
    return sim;
  }, [nodesRef, linksRef, edgeLengthsRef, canvasSize, opts]);

  // 驱动 tick（每帧调用多次）
  const lastAlphaRef = useRef(0);
  const tick = useCallback(() => {
    if (!simRef.current) return 0;
    const sim = simRef.current;
    for (let i = 0; i < (opts.ticksPerFrame ?? 2); i++) {
      sim.tick();
    }
    const alpha = sim.alpha();
    if (Math.abs(alpha - lastAlphaRef.current) > 0.05) {
      console.error('[ForceSim] alpha jump:', lastAlphaRef.current.toFixed(3), '->', alpha.toFixed(3));
      lastAlphaRef.current = alpha;
    }
    return alpha;
  }, [opts.ticksPerFrame]);

  // 停止模拟
  const stop = useCallback(() => {
    simRef.current?.stop();
  }, []);

  // 重新启动（拖拽释放后）
  const reheat = useCallback(() => {
    console.error('[ForceSim] reheat called!');
    simRef.current?.alpha(0.1).restart();
  }, []);

  // 固定节点位置（拖拽时）
  const fixNode = useCallback((nodeId: string, x: number, y: number) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (node) {
      node.fx = x;
      node.fy = y;
    }
  }, [nodesRef]);

  // 释放节点（拖拽结束）- 不要 reheating，否则会弹开刚放好的节点
  const releaseNode = useCallback((nodeId: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (node) {
      node.fx = null;
      node.fy = null;
    }
    // 不调用 reheat()，让节点自然停在当前位置
  }, [nodesRef]);

  useEffect(() => {
    return () => {
      simRef.current?.stop();
    };
  }, []);

  return { tick, stop, reheat, fixNode, releaseNode, initSimulation };
}