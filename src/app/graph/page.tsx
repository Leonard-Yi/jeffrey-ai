"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import Graph from 'graphology';
import { circular } from 'graphology-layout';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import PersonModal from '@/components/PersonModal';
import Header from '@/components/Header';
import { tokens as C } from '@/lib/design-tokens';

interface GraphNode {
  id: string; label: string; val: number; group: string;
  city: string; lastContact: string; x?: number; y?: number;
}
interface GraphLink { source: string; target: string; type: string; strength: number; }
interface GraphData { nodes: GraphNode[]; links: GraphLink[]; clusters: GraphCluster[]; }
interface GraphCluster {
  id: string; name: string; category: "city" | "career" | "interest" | "place" | "vibe";
  memberIds: string[]; color: string;
}

// ─── Colors ─────────────────────────────────────────
const LINK_COLORS: Record<string, string> = {
  interaction: '#60a5fa', introducedBy: '#f59e0b', sharedCareer: '#10b981',
  sharedCity: '#8b5cf6', sharedInterest: '#f97316', sharedPlace: '#ec4899', sharedVibe: '#6366f1',
};
const CLUSTER_COLORS: Record<string, string> = {
  city: '#3b82f6', career: '#10b981', interest: '#f59e0b', place: '#ec4899', vibe: '#8b5cf6',
};
const NODE_COLORS: Record<string, string> = {
  default: '#3b82f6', '投行': '#10b981', '律师': '#f59e0b', '医生': '#ef4444',
  '教授': '#8b5cf6', '创业者': '#f97316', 'AI': '#6366f1',
};

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12,
      padding: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 2px 12px rgba(0,0,0,0.04)",
      ...style,
    }}>{children}</div>
  );
}

const JeffreyGraphPage = () => {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [], clusters: [] });
  const [loading, setLoading] = useState(true);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [graphInstance, setGraphInstance] = useState<Graph | null>(null);
  const [sigmaReady, setSigmaReady] = useState(false);
  const [filter, setFilter] = useState({ group: '', linkType: '', minStrength: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<any>(null);

  const getGroupColor = (group: string) => {
    for (const [key, color] of Object.entries(NODE_COLORS)) {
      if (group.includes(key)) return color;
    }
    return NODE_COLORS.default;
  };

  const fetchGraphData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter.group) params.append('group', filter.group);
      if (filter.linkType) params.append('linkType', filter.linkType);
      if (filter.minStrength > 0) params.append('minStrength', filter.minStrength.toString());
      const data: GraphData = await (await fetch(`/api/graph?${params}`)).json();
      setGraphData(data);
      const graph = new Graph();
      data.nodes.forEach((node: GraphNode) => {
        graph.addNode(node.id, {
          label: node.label, size: Math.max(node.val * 20 + 12, 18),
          color: getGroupColor(node.group), group: node.group,
          city: node.city, lastContact: node.lastContact, val: node.val,
        });
      });
      data.links.forEach((link: GraphLink) => {
        try { if (!graph.hasEdge(link.source, link.target)) graph.addEdge(link.source, link.target); }
        catch {}
      });
      circular.assign(graph);
      forceAtlas2.assign(graph, { iterations: 100, settings: { gravity: 1, scalingRatio: 10, strongGravityMode: true, barnesHutOptimize: false } });
      setGraphInstance(graph);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { fetchGraphData(); }, [fetchGraphData]);

  useEffect(() => {
    import('sigma').then(mod => { setSigmaReady(true); (window as any).SigmaClass = mod.Sigma; });
  }, []);

  useEffect(() => {
    if (!graphInstance || !containerRef.current || !sigmaReady) return;
    const SigmaClass = (window as any).SigmaClass;
    if (!SigmaClass) return;
    if (sigmaRef.current) { sigmaRef.current.kill(); sigmaRef.current = null; }
    try {
      const sigma = new SigmaClass(graphInstance, containerRef.current, {
        renderEdgeLabels: false, defaultEdgeColor: '#999', defaultNodeColor: '#999',
        labelColor: { color: '#374151' }, labelSize: 14, labelFont: 'sans-serif',
        allowInvalidContainer: true, labelRenderedSize: { min: 12, max: 20 },
      });
      sigma.on('clickNode', ({ node }: { node: string }) => setSelectedPersonId(node));
      sigma.on('clickStage', () => setSelectedPersonId(null));
      sigmaRef.current = sigma;
    } catch (err) { console.error(err); }
    return () => { if (sigmaRef.current) { sigmaRef.current.kill(); sigmaRef.current = null; } };
  }, [graphInstance, sigmaReady]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: C.bg, display: 'flex', flexDirection: 'column' }}>
      <Header />

      {/* Filter Bar */}
      <div style={{ backgroundColor: C.bgCard, borderBottom: `1px solid ${C.border}`, padding: "10px 24px", display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' as const }}>
        {/* Group Filter */}
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

        {/* Link Type Filter */}
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

        {/* Refresh Button */}
        <button
          onClick={fetchGraphData}
          style={{
            padding: "5px 14px", backgroundColor: C.primary, color: C.textInverse,
            border: "none", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}
        >
          刷新
        </button>

        {/* Legend */}
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
      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={containerRef} style={{ width: '100%', height: 'calc(100vh - 120px)', minHeight: 400 }} />
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
          {Object.entries(LINK_COLORS).map(([type, color]) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: C.textSecondary }}>
                {type === 'interaction' && '互动'}{type === 'introducedBy' && '介绍人'}{type === 'sharedCareer' && '同行'}
                {type === 'sharedCity' && '同城'}{type === 'sharedInterest' && '同好'}{type === 'sharedPlace' && '常去同地'}{type === 'sharedVibe' && '相似性格'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Person Modal */}
      {selectedPersonId && (
        <PersonModal personId={selectedPersonId} onClose={() => setSelectedPersonId(null)} onSaved={fetchGraphData} />
      )}
    </div>
  );
};

export default JeffreyGraphPage;
