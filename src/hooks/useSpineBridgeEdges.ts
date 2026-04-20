import { useCallback } from 'react';
import type { GraphNode, GraphLink } from '@/lib/graphService';

const SPINE_DEGREE_THRESHOLD = 2;
const SPINE_LENGTH = 40;
const BRIDGE_LENGTH = 160;

export interface EdgeLengthEntry {
  key: string;
  length: number;
  type: 'spine' | 'bridge';
}

export function useSpineBridgeEdges(
  nodes: GraphNode[],
  links: GraphLink[]
) {
  // 计算每个节点的度数
  const degreeMap = useCallback(() => {
    const map = new Map<string, number>();
    for (const link of links) {
      map.set(link.source, (map.get(link.source) ?? 0) + 1);
      map.set(link.target, (map.get(link.target) ?? 0) + 1);
    }
    return map;
  }, [links]);

  // 计算所有边的长度
  const computeEdgeLengths = useCallback((): Map<string, number> => {
    const degree = degreeMap();
    const lengths = new Map<string, number>();

    for (const link of links) {
      const key = `${link.source}-${link.target}`;
      const sourceDeg = degree.get(link.source) ?? 0;
      const targetDeg = degree.get(link.target) ?? 0;

      // Spine: 叶子节点（度≤2）到其他节点
      // Bridge: 两个非叶子节点之间
      const isSpine = sourceDeg <= SPINE_DEGREE_THRESHOLD || targetDeg <= SPINE_DEGREE_THRESHOLD;
      const length = isSpine ? SPINE_LENGTH : BRIDGE_LENGTH;

      lengths.set(key, length);
    }
    return lengths;
  }, [links, degreeMap]);

  return { computeEdgeLengths, SPINE_LENGTH, BRIDGE_LENGTH };
}