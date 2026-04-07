"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import Graph from 'graphology';
import { circular } from 'graphology-layout';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import PersonModal from '@/components/PersonModal';
import Header from '@/components/Header';

interface GraphNode {
  id: string;
  label: string;
  val: number;
  group: string;
  city: string;
  lastContact: string;
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string;
  target: string;
  type: string;
  strength: number;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  clusters: GraphCluster[];
}

interface GraphCluster {
  id: string;
  name: string;
  category: "city" | "career" | "interest" | "place" | "vibe";
  memberIds: string[];
  color: string;
}

const LINK_COLORS: Record<string, string> = {
  interaction: '#60a5fa',
  introducedBy: '#f59e0b',
  sharedCareer: '#10b981',
  sharedCity: '#8b5cf6',
  sharedInterest: '#f97316',
  sharedPlace: '#ec4899',
  sharedVibe: '#6366f1',
};

const CLUSTER_COLORS: Record<string, string> = {
  city: '#3b82f6',
  career: '#10b981',
  interest: '#f59e0b',
  place: '#ec4899',
  vibe: '#8b5cf6',
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

const JeffreyGraphPage = () => {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [], clusters: [] });
  const [loading, setLoading] = useState(true);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [graphInstance, setGraphInstance] = useState<Graph | null>(null);
  const [sigmaReady, setSigmaReady] = useState(false);
  const [filter, setFilter] = useState({
    group: '',
    linkType: '',
    minStrength: 0,
  });
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

      const response = await fetch(`/api/graph?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch graph data');

      const data = await response.json();
      setGraphData(data);

      // 创建 graphology 图实例
      const graph = new Graph();

      // 添加节点 - 增大尺寸以提升点击区域
      data.nodes.forEach((node: GraphNode) => {
        graph.addNode(node.id, {
          label: node.label,
          size: Math.max(node.val * 20 + 12, 18), // 最小18px，最大约32px
          color: getGroupColor(node.group),
          group: node.group,
          city: node.city,
          lastContact: node.lastContact,
          val: node.val,
        });
      });

      // 添加边 - 先不加任何属性，确认最小配置能工作
      data.links.forEach((link: GraphLink) => {
        try {
          if (!graph.hasEdge(link.source, link.target)) {
            graph.addEdge(link.source, link.target);
          }
        } catch (e) {
          // 忽略重复边或无效边
        }
      });

      // 计算布局 - 先用 circular 初始化位置，再用 ForceAtlas2
      circular.assign(graph);

      // 运行 ForceAtlas2 让节点分散
      forceAtlas2.assign(graph, {
        iterations: 100,
        settings: {
          gravity: 1,
          scalingRatio: 10,
          strongGravityMode: true,
          barnesHutOptimize: false,
        },
      });

      setGraphInstance(graph);
    } catch (error) {
      console.error('Error fetching graph data:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchGraphData();
  }, [fetchGraphData]);

  // 加载 sigma
  useEffect(() => {
    import('sigma').then((mod) => {
      setSigmaReady(true);
      (window as any).SigmaClass = mod.Sigma;
    });
  }, []);

  // 创建 Sigma 实例
  useEffect(() => {
    if (!graphInstance || !containerRef.current || !sigmaReady) return;

    const SigmaClass = (window as any).SigmaClass;
    if (!SigmaClass) return;

    // 销毁旧的 Sigma 实例
    if (sigmaRef.current) {
      sigmaRef.current.kill();
      sigmaRef.current = null;
    }

    try {
      // 创建新的 Sigma 实例
      const sigma = new SigmaClass(graphInstance, containerRef.current, {
        renderEdgeLabels: false,
        defaultEdgeColor: '#999',
        defaultNodeColor: '#999',
        labelColor: { color: '#374151' },
        labelSize: 14,
        labelFont: 'sans-serif',
        allowInvalidContainer: true,
        // 增大标签渲染区域以提升可读性
        labelRenderedSize: { min: 12, max: 20 },
      });

      // 节点点击事件 - 打开 PersonModal
      sigma.on('clickNode', ({ node }: { node: string }) => {
        setSelectedPersonId(node);
      });

      // 背景点击事件
      sigma.on('clickStage', () => {
        setSelectedPersonId(null);
      });

      sigmaRef.current = sigma;
    } catch (error) {
      console.error('Sigma initialization error:', error);
    }

    return () => {
      if (sigmaRef.current) {
        sigmaRef.current.kill();
        sigmaRef.current = null;
      }
    };
  }, [graphInstance, sigmaReady]);

  return (
    <div className="min-h-screen bg-[#f5f3ef] flex flex-col">
      <Header />

      {/* 过滤器 */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 flex-wrap">
        <label className="text-sm text-gray-600">
          职业筛选:
          <input
            type="text"
            value={filter.group}
            onChange={(e) => setFilter({ ...filter, group: e.target.value })}
            placeholder="如：AI、投行、律师..."
            className="ml-2 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-amber-300"
          />
        </label>
        <label className="text-sm text-gray-600">
          关系类型:
          <select
            value={filter.linkType}
            onChange={(e) => setFilter({ ...filter, linkType: e.target.value })}
            className="ml-2 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-amber-300"
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
        </label>
        <button
          onClick={fetchGraphData}
          className="px-4 py-1.5 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 transition"
        >
          刷新
        </button>

        {/* 圈层图例 */}
        <div className="flex items-center gap-3 ml-auto text-xs">
          <span className="text-gray-500">
            {filter.linkType && ['sharedCareer', 'sharedCity', 'sharedInterest', 'sharedPlace', 'sharedVibe'].includes(filter.linkType) ? '圈层:' : '箭头:'}
          </span>
          {filter.linkType === 'sharedCareer' || !filter.linkType ? (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CLUSTER_COLORS.career + '60' }}></div>
              <span className="text-gray-600">职业</span>
            </div>
          ) : null}
          {filter.linkType === 'sharedCity' || !filter.linkType ? (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CLUSTER_COLORS.city + '60' }}></div>
              <span className="text-gray-600">城市</span>
            </div>
          ) : null}
          {filter.linkType === 'sharedInterest' || !filter.linkType ? (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CLUSTER_COLORS.interest + '60' }}></div>
              <span className="text-gray-600">兴趣</span>
            </div>
          ) : null}
          {filter.linkType === 'sharedPlace' || !filter.linkType ? (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CLUSTER_COLORS.place + '60' }}></div>
              <span className="text-gray-600">地点</span>
            </div>
          ) : null}
          {filter.linkType === 'sharedVibe' || !filter.linkType ? (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CLUSTER_COLORS.vibe + '60' }}></div>
              <span className="text-gray-600">性格</span>
            </div>
          ) : null}
          {filter.linkType === 'interaction' && (
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-0.5" style={{ backgroundColor: LINK_COLORS.interaction }}></div>
              <span className="text-gray-600">互动</span>
            </div>
          )}
          {filter.linkType === 'introducedBy' && (
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-0.5" style={{ backgroundColor: LINK_COLORS.introducedBy }}></div>
              <span className="text-gray-600">介绍人</span>
            </div>
          )}
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex relative">
        {/* 图谱 */}
        <div
          className="flex-1"
          style={{ height: 'calc(100vh - 120px)', minHeight: '400px' }}
          ref={containerRef}
        >
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500">加载中...</div>
            </div>
          )}
          {!loading && graphData.nodes.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500 text-center">
                <p className="text-lg mb-2">暂无数据</p>
                <p className="text-sm">请先在录入页面添加人物信息</p>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* 图例 */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 border border-gray-200">
        <h4 className="text-xs font-medium text-gray-600 mb-2">关系类型</h4>
        <div className="space-y-1">
          {Object.entries(LINK_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-gray-600">
                {type === 'interaction' && '互动'}
                {type === 'introducedBy' && '介绍人'}
                {type === 'sharedCareer' && '同行'}
                {type === 'sharedCity' && '同城'}
                {type === 'sharedInterest' && '同好'}
                {type === 'sharedPlace' && '常去同地'}
                {type === 'sharedVibe' && '相似性格'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 人员详情弹窗 */}
      {selectedPersonId && (
        <PersonModal
          personId={selectedPersonId}
          onClose={() => setSelectedPersonId(null)}
          onSaved={fetchGraphData}
        />
      )}
    </div>
  );
};

export default JeffreyGraphPage;
