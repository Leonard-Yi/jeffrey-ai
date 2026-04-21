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
  centerForce: 0.01,
  repelForce: 50,
  linkForce: 0.5,
  linkDistanceBase: 80,
  damping: 0.99,
  ticksPerFrame: 1,
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

  // 幂等检测
  const lastInitRef = useRef<{ nodeCount: number; linkCount: number; canvasW: number; canvasH: number } | null>(null);

  const initSimulation = useCallback(() => {
    if (!nodesRef.current.length) return;
    if (canvasSize.width === 0 || canvasSize.height === 0) return;

    if (simRef.current) {
      simRef.current.stop();
    }

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
      .alphaDecay(0.5);

    simRef.current = sim;
  }, [nodesRef, linksRef, edgeLengthsRef, canvasSize, opts]);

  const tick = useCallback(() => {
    if (!simRef.current) return;
    const sim = simRef.current;
    if (sim.alpha() <= 0) return;
    for (let i = 0; i < (opts.ticksPerFrame ?? 1); i++) {
      sim.tick();
    }
  }, [opts.ticksPerFrame]);

  const stop = useCallback(() => {
    simRef.current?.stop();
  }, []);

  const fixNode = useCallback((nodeId: string, x: number, y: number) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (node) {
      node.fx = x;
      node.fy = y;
    }
  }, [nodesRef]);

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

  return { tick, stop, fixNode, releaseNode, initSimulation };
}
