// src/hooks/useForceSimulation.ts
import { useRef, useEffect, useCallback } from "react";
import type { GraphNode, GraphLink } from "@/lib/graphService";

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
  options: ForceSimOptions = {},
) {
  const workerRef = useRef<Worker | null>(null);
  const readyRef = useRef(false);
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // 启动 Worker
  useEffect(() => {
    const worker = new Worker("/graphWorker.js");

    worker.onmessage = (event: MessageEvent) => {
      const data = event.data;

      if (data.ready) {
        readyRef.current = true;
        return;
      }

      // 位置更新 — store target positions, render loop will lerp
      const { ids, positions } = data;
      if (!ids || !positions) return;

      const posArray = new Float32Array(positions);
      for (let i = 0; i < ids.length; i++) {
        const node = nodesRef.current.find(n => n.id === ids[i]);
        if (node && node.fx == null) {
          // Store as target for lerp in render loop
          (node as any)._tx = posArray[i * 2];
          (node as any)._ty = posArray[i * 2 + 1];
        }
      }
    };

    worker.onerror = (err) => {
      console.error("[Jeffrey.AI] Graph worker error:", err);
    };

    workerRef.current = worker;

    return () => {
      worker.terminate();
      workerRef.current = null;
      readyRef.current = false;
    };
  }, [nodesRef]);

  const initSimulation = useCallback(() => {
    const worker = workerRef.current;
    if (!worker || !nodesRef.current.length) return;
    if (canvasSize.width === 0 || canvasSize.height === 0) return;

    const nodeMap: Record<string, [number, number]> = {};
    for (const n of nodesRef.current) {
      nodeMap[n.id] = [n.x, n.y];
    }

    const linkPairs: [string, string][] = [];
    const nodeIds = new Set(nodesRef.current.map(n => n.id));
    for (const link of linksRef.current) {
      const srcId = typeof link.source === "string" ? link.source : (link.source as any)?.id;
      const tgtId = typeof link.target === "string" ? link.target : (link.target as any)?.id;
      if (srcId && tgtId && nodeIds.has(srcId) && nodeIds.has(tgtId)) {
        linkPairs.push([srcId, tgtId]);
      }
    }

    worker.postMessage({
      nodes: nodeMap,
      links: linkPairs,
      centerX: canvasSize.width / 2,
      centerY: canvasSize.height / 2,
    });
  }, [nodesRef, linksRef, canvasSize]);

  const tick = useCallback(() => {
    const worker = workerRef.current;
    if (!worker || !readyRef.current) return;
    worker.postMessage({ alpha: 0.3, run: true });
  }, []);

  const fixNode = useCallback(
    (nodeId: string, x: number, y: number) => {
      const node = nodesRef.current.find(n => n.id === nodeId);
      if (node) {
        node.fx = x;
        node.fy = y;
        node.x = x; // render position follows drag
        node.y = y;
        workerRef.current?.postMessage({
          forceNode: { id: nodeId, x, y },
        });
      }
    },
    [nodesRef],
  );

  const releaseNode = useCallback(
    (nodeId: string) => {
      const node = nodesRef.current.find(n => n.id === nodeId);
      if (node) {
        node.fx = null;
        node.fy = null;
        workerRef.current?.postMessage({
          forceNode: { id: nodeId, x: 0, y: 0, release: true },
        });
      }
    },
    [nodesRef],
  );

  const stop = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    readyRef.current = false;
  }, []);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  return { tick, stop, fixNode, releaseNode, initSimulation };
}
