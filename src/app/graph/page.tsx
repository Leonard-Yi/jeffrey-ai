"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import PersonModal from '@/components/PersonModal';
import Header from '@/components/Header';

// 动态导入 ForceGraph，禁用 SSR
const ForceGraph2D = dynamic(
  () => import('react-force-graph-2d'),
  { ssr: false }
);

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

interface GraphCluster {
  id: string;
  name: string;
  category: "city" | "career" | "interest" | "place" | "vibe";
  memberIds: string[];
  color: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  clusters: GraphCluster[];
}

const LINK_COLORS = {
  interaction: '#60a5fa',      // blue
  introducedBy: '#f59e0b',     // amber
  sharedCareer: '#10b981',     // green
  sharedCity: '#8b5cf6',       // purple
  sharedInterest: '#f97316',   // orange
  sharedPlace: '#ec4899',      // pink
  sharedVibe: '#6366f1',       // indigo
};

const CLUSTER_COLORS: Record<string, string> = {
  city: '#3b82f6',      // blue
  career: '#10b981',    // green
  interest: '#f59e0b',  // amber
  place: '#ec4899',     // pink
  vibe: '#8b5cf6',      // purple
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
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [filter, setFilter] = useState({
    group: '',
    linkType: '',
    minStrength: 0,
  });
  const fgRef = useRef<any>(null);

  useEffect(() => {
    fetchGraphData();
  }, []);

  // 初始化后配置力导向引擎参数
  useEffect(() => {
    if (fgRef.current && graphData.nodes.length > 0) {
      // 等待引擎初始化后配置
      setTimeout(() => {
        // 配置电荷力（节点间排斥力）
        const chargeForce = fgRef.current.d3Force('charge');
        if (chargeForce) {
          // 圈层模式下减弱排斥力，让节点更容易聚集
          const isClusterMode = filter.linkType && ['sharedCareer', 'sharedCity', 'sharedInterest', 'sharedPlace', 'sharedVibe'].includes(filter.linkType);
          chargeForce.strength(isClusterMode ? -100 : -200);
          chargeForce.distanceMin(30);
          chargeForce.distanceMax(200);
        }

        // 配置连线力
        const linkForce = fgRef.current.d3Force('link');
        if (linkForce) {
          const isClusterMode = filter.linkType && ['sharedCareer', 'sharedCity', 'sharedInterest', 'sharedPlace', 'sharedVibe'].includes(filter.linkType);
          linkForce.distance(isClusterMode ? 80 : 100);
          linkForce.strength(isClusterMode ? 0.05 : 0.2);
        }

        // 中心引力
        fgRef.current.d3Force('center')?.strength(0.1);
      }, 100);
    }
  }, [graphData.nodes.length, filter.linkType]);

  const fetchGraphData = async () => {
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
    } catch (error) {
      console.error('Error fetching graph data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNodeClick = (node: GraphNode) => {
    setSelectedNode(node);
  };

  const handleBgClick = () => {
    setSelectedNode(null);
  };

  const getLinkColor = (type: string) => {
    return LINK_COLORS[type as keyof typeof LINK_COLORS] || '#9ca3af';
  };

  const getGroupColor = (group: string) => {
    // Find matching group color or return default
    for (const [key, color] of Object.entries(NODE_COLORS)) {
      if (group.includes(key)) return color;
    }
    return NODE_COLORS.default;
  };

  return (
    <div className="min-h-screen bg-[#f5f3ef] flex flex-col">
      <Header totalCount={graphData.nodes.length} />

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
        <div className="flex-1 h-[calc(100vh-120px)]">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500">加载中...</div>
            </div>
          ) : graphData.nodes.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500 text-center">
                <p className="text-lg mb-2">暂无数据</p>
                <p className="text-sm">请先在录入页面添加人物信息</p>
              </div>
            </div>
          ) : (
            <ForceGraph2D
              ref={fgRef}
              graphData={graphData}
              nodeLabel="label"
              nodeVal={(node: GraphNode) => node.val * 20 + 10}
              nodeColor={(node: GraphNode) => getGroupColor(node.group)}
              nodeAutoColorBy="group"
              // 只有筛选前两种关系时才显示箭头
              linkColor={(link: GraphLink) => {
                if (filter.linkType && filter.linkType !== 'interaction' && filter.linkType !== 'introducedBy') {
                  return 'transparent';
                }
                return getLinkColor(link.type);
              }}
              linkWidth={(link: GraphLink) => {
                if (filter.linkType && filter.linkType !== 'interaction' && filter.linkType !== 'introducedBy') {
                  return 0;
                }
                return Math.sqrt(link.strength) * 3.5;
              }}
              linkDirectionalArrowLength={15}
              linkDirectionalArrowRelPos={0.95}
              linkDirectionalArrowColor={(link: GraphLink) => getLinkColor(link.type)}
              linkCanvasObjectMode="after"
              // @ts-ignore - onRender prop may not exist in type definition but is used at runtime
              onRender={(ctx: CanvasRenderingContext2D) => {
                // 只有筛选后五种关系时才显示圈层
                const showClusters = filter.linkType && ['sharedCareer', 'sharedCity', 'sharedInterest', 'sharedPlace', 'sharedVibe'].includes(filter.linkType);
                if (!showClusters) return;

                const globalScale = fgRef.current?.zoom() || 1;
                if (!graphData.clusters || graphData.clusters.length === 0) return;

                // 根据筛选类型过滤圈层
                const categoryMap: Record<string, string> = {
                  sharedCareer: 'career',
                  sharedCity: 'city',
                  sharedInterest: 'interest',
                  sharedPlace: 'place',
                  sharedVibe: 'vibe',
                };
                const filterCategory = categoryMap[filter.linkType];

                for (const cluster of graphData.clusters) {
                  if (filterCategory && cluster.category !== filterCategory) continue;

                  const members = cluster.memberIds
                    .map(id => graphData.nodes.find(n => n.id === id))
                    .filter((n): n is GraphNode => n !== undefined && (n as any).x !== undefined);

                  if (members.length === 0) continue;

                  // 计算圈层中心点和半径
                  const centerX = members.reduce((sum, n) => sum + (n as any).x, 0) / members.length;
                  const centerY = members.reduce((sum, n) => sum + (n as any).y, 0) / members.length;

                  // 计算覆盖所有成员所需的半径
                  let maxDist = 0;
                  for (const m of members) {
                    const dx = (m as any).x - centerX;
                    const dy = (m as any).y - centerY;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > maxDist) maxDist = dist;
                  }
                  const radius = maxDist + 30; // 额外 30px 边距

                  // 绘制半透明圈层
                  ctx.beginPath();
                  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
                  ctx.fillStyle = cluster.color + '20'; // 20 = 约 12% 不透明度
                  ctx.fill();
                  ctx.strokeStyle = cluster.color + '60'; // 60 = 约 38% 不透明度
                  ctx.lineWidth = 2 / globalScale;
                  ctx.setLineDash([5, 5]); // 虚线边框
                  ctx.stroke();
                  ctx.setLineDash([]); // 重置为实线

                  // 绘制圈层标签
                  ctx.font = `${11 / globalScale}px Sans-Serif`;
                  ctx.fillStyle = cluster.color;
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  const labelPrefix = cluster.category === 'city' ? '📍 ' : cluster.category === 'career' ? '💼 ' : cluster.category === 'interest' ? '📖 ' : cluster.category === 'place' ? '🏠 ' : '💭 ';
                  ctx.fillText(`${labelPrefix}${cluster.name}`, centerX, centerY + radius);
                }
              }}
              onNodeClick={handleNodeClick}
              onBackgroundClick={handleBgClick}
              cooldownTicks={600}
              d3AlphaDecay={0.005}
              d3VelocityDecay={0.4}
              warmupTicks={300}
              nodeCanvasObject={(node: GraphNode, ctx, globalScale) => {
                const label = node.label;
                const fontSize = 14 / globalScale;
                const color = getGroupColor(node.group);

                // Draw node circle
                ctx.beginPath();
                ctx.arc(node.x, node.y, (node.val * 20 + 10), 0, 2 * Math.PI);
                ctx.fillStyle = color;
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2 / globalScale;
                ctx.stroke();

                // Draw label
                ctx.font = `${fontSize}px Sans-Serif`;
                ctx.fillStyle = '#374151';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillText(label, node.x, node.y + (node.val * 20 + 10) + 6);
              }}
              linkCanvasObject={(link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
                // 圈层模式下不显示连线标签
                if (filter.linkType && filter.linkType !== 'interaction' && filter.linkType !== 'introducedBy') {
                  return;
                }

                const start = link.source as any;
                const end = link.target as any;

                if (!start.x || !end.x) return;

                // 标签位置在连线中点
                const midX = (start.x + end.x) / 2;
                const midY = (start.y + end.y) / 2;
                const fontSize = 9 / globalScale;

                ctx.font = `${fontSize}px Sans-Serif`;
                ctx.fillStyle = '#6b7280';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
              }}
            />
          )}
        </div>

        {/* 侧边栏 - 节点详情 */}
        {selectedNode && (
          <div className="w-80 bg-white border-l border-gray-200 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-800">人物详情</h3>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-medium text-lg"
                  style={{ backgroundColor: getGroupColor(selectedNode.group) }}
                >
                  {selectedNode.label.charAt(0)}
                </div>
                <div>
                  <h4 className="font-medium text-gray-800">{selectedNode.label}</h4>
                  <p className="text-sm text-gray-500">{selectedNode.group}</p>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h5 className="text-sm font-medium text-gray-600 mb-2">关系热度</h5>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-amber-500 h-2 rounded-full transition-all"
                    style={{ width: `${selectedNode.val * 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">{Math.round(selectedNode.val * 100)} / 100</p>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h5 className="text-sm font-medium text-gray-600 mb-2">最后联系</h5>
                <p className="text-sm text-gray-700">
                  {new Date(selectedNode.lastContact).toLocaleDateString('zh-CN')}
                </p>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h5 className="text-sm font-medium text-gray-600 mb-2">城市</h5>
                <p className="text-sm text-gray-700">{selectedNode.city || '未设置'}</p>
              </div>

              <button
                onClick={() => setSelectedPersonId(selectedNode.id)}
                className="w-full mt-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 transition"
              >
                查看完整档案
              </button>
            </div>
          </div>
        )}
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
