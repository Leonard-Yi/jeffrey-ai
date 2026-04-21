"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { tokens as C } from '@/lib/design-tokens';
import GraphCanvas from '@/components/GraphCanvas';
import { useForceSimulation } from '@/hooks/useForceSimulation';
import { useSpineBridgeEdges } from '@/hooks/useSpineBridgeEdges';
import { SimNode } from '@/hooks/useForceSimulation';
import PersonModal from '@/components/PersonModal';
import Header from '@/components/Header';
import type { GraphNode, GraphLink, GraphData, GraphCluster } from '@/lib/graphService';

const CLUSTER_COLORS: Record<string, string> = {
  city: '#3b82f6', career: '#10b981', interest: '#f59e0b', place: '#ec4899', vibe: '#8b5cf6',
};

export default function JeffreyGraphPage() {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [], clusters: [] });
  const [loading, setLoading] = useState(true);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [filter, setFilter] = useState({ group: '', linkType: '', minStrength: 0 });

  // Canvas dimensions — 初始为 0，等 ResizeObserver 给出真实尺寸后再渲染画布
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Render data refs
  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);
  const edgeLengthsRef = useRef<Map<string, number>>(new Map());

  // spine/bridge calculation
  const { computeEdgeLengths } = useSpineBridgeEdges(graphData.nodes, graphData.links);

  // Physics simulation
  const { tick, fixNode, releaseNode, initSimulation } = useForceSimulation(
    nodesRef,
    linksRef,
    edgeLengthsRef,
    canvasSize
  );

  // Window resize
  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setCanvasSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Fetch data
  const fetchGraphData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter.group) params.append('group', filter.group);
      if (filter.linkType) params.append('linkType', filter.linkType);
      if (filter.minStrength > 0) params.append('minStrength', filter.minStrength.toString());
      const res = await fetch(`/api/graph?${params}`);
      if (!res.ok) {
        console.error(`Graph API error: ${res.status}`);
        setGraphData({ nodes: [], links: [], clusters: [] });
        return;
      }
      const data: GraphData = await res.json();
      setGraphData(data);
    } catch (err) {
      console.error(err);
      setGraphData({ nodes: [], links: [], clusters: [] });
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchGraphData(); }, [fetchGraphData]);

  // Update refs when data changes — 仅在 graphData 变化时重置节点位置
  // canvasSize 不在依赖数组中，避免尺寸更新时重新初始化节点
  const canvasSizeRef = useRef(canvasSize);
  canvasSizeRef.current = canvasSize;

  useEffect(() => {
    if (!graphData.nodes.length) {
      nodesRef.current = [];
      linksRef.current = [];
      return;
    }

    // 必须等到有真实画布尺寸才能初始化（canvasSize 初始为 0×0）
    const { width, height } = canvasSizeRef.current;
    if (width === 0 || height === 0) return;

    // Place ALL nodes at canvas center initially
    const cx = width / 2;
    const cy = height / 2;

    // Create node map first
    const nodeMap = new Map(graphData.nodes.map(n => [n.id, true]));

    nodesRef.current = graphData.nodes.map((node) => {
      // Small random offset from center so nodes don't all start at exact same point
      const jitter = 20;
      return {
        ...node,
        x: cx + (Math.random() - 0.5) * jitter,
        y: cy + (Math.random() - 0.5) * jitter,
        vx: 0,
        vy: 0,
      };
    });

    // Filter links to only include those where BOTH source and target exist in nodes
    // Deep clone to avoid D3 forceLink mutating the original graphData.links objects
    linksRef.current = graphData.links
      .filter(link => nodeMap.has(link.source as string) && nodeMap.has(link.target as string))
      .map(link => ({ ...link }));
    edgeLengthsRef.current = computeEdgeLengths();

    // Start physics simulation
    initSimulation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphData]); // 故意不依赖 canvasSize，避免尺寸变化时重置节点位置

  // canvasSize 变化时只更新模拟中心力，不重置节点
  useEffect(() => {
    if (canvasSize.width > 0 && canvasSize.height > 0 && nodesRef.current.length > 0) {
      initSimulation();
    }
  }, [canvasSize, initSimulation]);

  // Drag callbacks
  const handleDragStart = useCallback((id: string, x: number, y: number) => {
    fixNode(id, x, y);
  }, [fixNode]);

  const handleDragMove = useCallback((x: number, y: number) => {
    if (nodesRef.current.length > 0) {
      const dragged = nodesRef.current.find(n => n.fx != null);
      if (dragged) {
        dragged.fx = x;
        dragged.fy = y;
      }
    }
  }, []);

  const handleDragEnd = useCallback((id: string) => {
    releaseNode(id);
  }, [releaseNode]);

  return (
    <div style={{ height: '100vh', overflow: 'hidden', backgroundColor: C.bg, display: 'flex', flexDirection: 'column' }}>
      <Header />

      {/* Filter Bar */}
      <div style={{ backgroundColor: C.bgCard, borderBottom: `1px solid ${C.border}`, padding: "10px 24px", display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' as const }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, color: C.textSecondary }}>职业</span>
          <input
            type="text"
            value={filter.group}
            onChange={e => setFilter(f => ({ ...f, group: e.target.value }))}
            placeholder="如：AI、投行..."
            style={{ padding: "5px 10px", border: `1.5px solid ${C.borderStrong}`, borderRadius: 7, fontSize: 13, outline: 'none', width: 130, color: C.text }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, color: C.textSecondary }}>关系</span>
          <select
            value={filter.linkType}
            onChange={e => setFilter(f => ({ ...f, linkType: e.target.value }))}
            style={{ padding: "5px 10px", border: `1.5px solid ${C.borderStrong}`, borderRadius: 7, fontSize: 13, outline: 'none', color: C.text, cursor: 'pointer' }}
          >
            <option value="">全部</option>
            <option value="interaction">互动</option>
            <option value="introducedBy">介绍人</option>
            <option value="sharedCareer">同行</option>
            <option value="sharedCity">同城</option>
            <option value="sharedInterest">同好</option>
            <option value="sharedPlace">常去同地</option>
            <option value="sharedVibe">相似性格</option>
          </select>
        </div>
        <button
          onClick={fetchGraphData}
          style={{ padding: "5px 14px", backgroundColor: C.primary, color: C.textInverse, border: "none", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
        >
          刷新
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto', flexWrap: 'wrap' as const }}>
          {(['career', 'city', 'interest', 'place', 'vibe'] as const).map(cat => (
            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: CLUSTER_COLORS[cat] + '99' }} />
              <span style={{ fontSize: 12, color: C.textSecondary }}>
                {cat === 'career' ? '职业' : cat === 'city' ? '城市' : cat === 'interest' ? '兴趣' : cat === 'place' ? '地点' : '性格'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Graph Canvas */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
        <GraphCanvas
          nodesRef={nodesRef}
          linksRef={linksRef}
          width={canvasSize.width}
          height={canvasSize.height}
          hoveredNodeId={hoveredNodeId}
          selectedNodeId={selectedPersonId}
          onNodeHover={setHoveredNodeId}
          onNodeClick={setSelectedPersonId}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onTick={tick}
        />
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(245,243,239,0.7)' }}>
            <span style={{ color: C.textMuted, fontSize: 14 }}>加载中...</span>
          </div>
        )}
        {!loading && graphData.nodes.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: C.textMuted }}>
              <p style={{ fontSize: 16, marginBottom: 6 }}>暂无数据</p>
              <p style={{ fontSize: 13 }}>请先在录入页面添加人物信息</p>
            </div>
          </div>
        )}
      </div>

      {/* Legend Card */}
      <div style={{
        position: 'absolute', bottom: 20, left: 20,
        backgroundColor: C.bgCard, border: `1px solid ${C.border}`,
        borderRadius: 10, padding: '12px 16px',
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>关系类型</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {[
            ['interaction', '互动', '#60a5fa'],
            ['introducedBy', '介绍人', '#f59e0b'],
            ['sharedCareer', '同行', '#10b981'],
            ['sharedCity', '同城', '#8b5cf6'],
            ['sharedInterest', '同好', '#f97316'],
            ['sharedPlace', '常去同地', '#ec4899'],
            ['sharedVibe', '相似性格', '#6366f1'],
          ].map(([type, label, color]) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: C.textSecondary }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {selectedPersonId && (
        <PersonModal personId={selectedPersonId} onClose={() => setSelectedPersonId(null)} onSaved={fetchGraphData} />
      )}
    </div>
  );
}