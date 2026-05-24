// src/lib/graphWorker.ts
// Web Worker — runs d3-force simulation, communicates via postMessage

import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
} from "d3-force";

interface SimNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number | null;
  fy?: number | null;
  val: number;
}

interface WorkerMessage {
  nodes: Record<string, [number, number]>;
  links: [string, string][];
  alpha: number;
  alphaTarget: number;
  run: boolean;
  centerX?: number;
  centerY?: number;
  forceNode?: { id: string; x: number; y: number; release?: boolean } | null;
}

let simNodes: SimNode[] = [];
let sim: ReturnType<typeof forceSimulation> | null = null;

function initSimulation(
  nodes: SimNode[],
  links: [string, string][],
  centerX: number,
  centerY: number,
) {
  if (sim) { sim.stop(); }

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const resolvedLinks = links
    .filter(([src, tgt]) => nodeMap.has(src) && nodeMap.has(tgt))
    .map(([src, tgt]) => ({
      source: nodeMap.get(src)!,
      target: nodeMap.get(tgt)!,
    }));

  const REPEL_FORCE = 50;
  const LINK_FORCE = 0.5;
  const LINK_DISTANCE = 80;

  sim = forceSimulation<SimNode>(nodes)
    .force("center", forceCenter(centerX, centerY).strength(0.01))
    .force("charge", forceManyBody<SimNode>().strength(-REPEL_FORCE))
    .force("collision", forceCollide<SimNode>().radius(d => Math.sqrt(d.val) * 10 + 20))
    .force("link", forceLink<SimNode, any>(resolvedLinks)
      .distance(LINK_DISTANCE)
      .strength(LINK_FORCE),
    )
    .velocityDecay(0.6)   // softer damping for organic drift
    .alphaDecay(0.05)    // slow decay, simulation stays alive longer
    .stop();
}

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const msg = event.data;

  if (!sim && msg.nodes) {
    const centerX = msg.centerX ?? 0;
    const centerY = msg.centerY ?? 0;

    simNodes = Object.entries(msg.nodes).map(([id, [x, y]]) => ({
      id,
      x,
      y,
      vx: 0,
      vy: 0,
      val: 0.5,
    }));

    initSimulation(simNodes, msg.links, centerX, centerY);
  }

  if (msg.forceNode) {
    const node = simNodes.find(n => n.id === msg.forceNode!.id);
    if (node) {
      if (msg.forceNode.release) {
        node.fx = null;
        node.fy = null;
      } else {
        node.fx = msg.forceNode.x;
        node.fy = msg.forceNode.y;
      }
    }
  }

  if (msg.run && sim) {
    // Only force alpha if explicitly provided (drag re-heat).
    // Otherwise let it decay naturally — stops nodes from spinning forever.
    if (msg.alpha !== undefined) sim.alpha(Math.max(sim.alpha(), msg.alpha));
    sim.tick(10);

    const posBuffer = new Float32Array(simNodes.length * 2);
    const ids: string[] = [];
    for (let i = 0; i < simNodes.length; i++) {
      const n = simNodes[i];
      posBuffer[i * 2] = n.x;
      posBuffer[i * 2 + 1] = n.y;
      ids.push(n.id);
    }

    const done = sim.alpha() <= sim.alphaMin();
    self.postMessage({ ids, positions: posBuffer.buffer, done }, [
      posBuffer.buffer,
    ] as any);
  }
};

self.postMessage({ ready: true });
