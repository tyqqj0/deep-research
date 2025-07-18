"use client";

import React, { memo, useCallback, useState, useEffect, useMemo, useRef } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  Edge,
  Node,
  NodeTypes,
  MarkerType,
  Position,
  Handle,
  useReactFlow,
  Connection,
  addEdge,
  ConnectionMode,
  EdgeMouseHandler,
  ReactFlowProvider,
  useViewport,
  Panel
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { TreePhysics } from './TreePhysics';
import {
  TREE_VISUALIZATION_CONFIG,
  EdgeType,
  ZoomLevel,
  getPhysicsParamsForZoom
} from './TreeVisualizationConfig';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  TreePine,
  Play,
  Plus,
  Trash2,
  Move,
  BarChart3,
  RefreshCw,
  Maximize2,
  MoreVertical,
  Eye,
  Edit,
  Package,
  Zap,
  ZapOff,
  Calendar
} from "lucide-react";
import { MCTSNode, LibraryItem } from '@/libs/db';
import { useTree } from '@/hooks/useTree';
import { useLibraryStore } from '@/store/libraryStore';
import { toast } from 'sonner';

// 组件Props接口
interface TreeVisualizationProps {
  treeId?: string;                    // 可选：指定树ID
  mode: 'view' | 'edit' | 'embedded'; // 显示模式
  height?: string;                    // 可定制高度
  className?: string;                 // 自定义样式
  showControls?: boolean;             // 是否显示React Flow控制按钮
  showMiniMap?: boolean;              // 是否显示小地图
  showTreeSelector?: boolean;         // 是否显示树选择器
  showNodeStats?: boolean;            // 是否显示MCTS统计信息
  enablePhysics?: boolean;            // 是否启用物理效果
  edgeType?: 'smoothstep' | 'step' | 'straight'; // 连线类型
  onNodeSelect?: (node: MCTSNode) => void;
  onTreeChange?: (treeId: string) => void;
  onNodeAdd?: (parentId: string, itemId: string) => void;
  onNodeDelete?: (nodeId: string) => void;
}

// 自定义树节点组件 - 支持两级缩放
const TreeNode = memo(({ data }: { data: any }) => {
  const { node, literatureItem, isSelected, mode, showStats, levelOfDetail = 'detailed' } = data;
  const isEditable = mode === 'edit';
  const isDetailed = levelOfDetail === 'detailed';

  // 调试：随机输出节点渲染信息
  if (Math.random() < 0.001) { // 5%概率
    console.log(`🎨 Node ${node.id} rendering: ${levelOfDetail} mode (${isDetailed ? 'detailed' : 'simplified'})`);
  }

  // 计算UCT值和胜率
  const winRate = node.visits > 0 ? (node.wins / node.visits) : 0;
  const uctValue = node.visits > 0 ? winRate + Math.sqrt(2 * Math.log(100) / node.visits) : 0;

  // 动态计算节点宽度
  const calculateNodeWidth = () => {
    if (!isDetailed) return 'w-12';

    const title = literatureItem?.title || '';
    const authors = literatureItem?.authors || [];
    const hasStats = showStats && node.visits > 0;

    // 基础宽度计算
    let width = 280; // 基础宽度

    // 根据标题长度调整
    if (title.length > 80) {
      width = 420;
    } else if (title.length > 60) {
      width = 380;
    } else if (title.length > 40) {
      width = 340;
    } else if (title.length > 20) {
      width = 300;
    }

    // 根据作者数量调整
    if (authors.length > 4) {
      width += 30;
    } else if (authors.length > 2) {
      width += 15;
    }

    // 如果有统计信息，确保有足够空间显示3个Badge
    if (hasStats) {
      width = Math.max(width, 360);
    }

    // 限制最大最小宽度
    width = Math.max(240, Math.min(450, width));

    return width;
  };

  const nodeWidth = calculateNodeWidth();

  return (
    <div className={`relative flex items-center justify-center transition-all duration-300 ${isDetailed ? `h-auto min-h-[144px]` : 'w-12 h-12'}`} style={{ width: isDetailed ? `${nodeWidth}px` : '48px' }}>
      {/* 详细卡片视图 */}
      <div
        className={`absolute transition-all duration-300 ease-in-out ${isDetailed ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}
        style={{ pointerEvents: isDetailed ? 'all' : 'none' }}
      >
        <div className={`
          bg-white border-2 rounded-lg shadow-md p-4 w-80 min-h-[140px]
          ${isSelected ? 'border-blue-500 shadow-lg' : 'border-gray-200'}
          ${isEditable ? 'hover:border-blue-300 cursor-pointer' : ''}
        `}>
          <div className="space-y-2">
            {/* 论文标题 */}
            <div className="font-semibold text-sm text-gray-900 line-clamp-2">
              {literatureItem?.title || 'Loading...'}
            </div>

            {/* 作者信息 */}
            {literatureItem?.authors && (
              <div className="text-xs text-gray-600 line-clamp-1">
                {literatureItem.authors.slice(0, 2).join(', ')}
                {literatureItem.authors.length > 2 && ' et al.'}
              </div>
            )}

            {/* 年份和MCTS统计信息整合显示 - 分两行避免拥挤 */}
            <div className="space-y-2">
              {/* 第一行：年份 */}
              {literatureItem?.year && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-gray-500" />
                  <Badge variant="outline" className="text-xs">
                    {literatureItem.year}
                  </Badge>
                </div>
              )}

              {/* 第二行：MCTS统计信息 - 紧凑显示 */}
              {showStats && node.visits > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700 px-2 py-1">
                    访问: {node.visits}
                  </Badge>
                  <Badge variant="secondary" className="text-xs bg-green-50 text-green-700 px-2 py-1">
                    胜率: {(winRate * 100).toFixed(1)}%
                  </Badge>
                  <Badge variant="secondary" className="text-xs bg-purple-50 text-purple-700 px-2 py-1">
                    UCT: {uctValue.toFixed(2)}
                  </Badge>
                </div>
              )}
            </div>

            {/* 编辑模式下的操作按钮 */}
            {isEditable && (
              <div className="flex justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => data.onAddChild?.(node.id)}>
                      <Plus className="h-3 w-3 mr-2" />
                      添加子节点
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => data.onDelete?.(node.id)}>
                      <Trash2 className="h-3 w-3 mr-2" />
                      删除节点
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 简化圆形视图 */}
      <div
        className={`absolute transition-all duration-300 ease-in-out ${!isDetailed ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`}
        style={{ pointerEvents: !isDetailed ? 'all' : 'none' }}
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-mono cursor-pointer shadow-lg
                  ${isSelected ? 'bg-gradient-to-br from-blue-600 to-indigo-700 ring-2 ring-blue-300' : 'bg-gradient-to-br from-blue-400 to-indigo-500'}
                  ${isEditable ? 'hover:from-blue-500 hover:to-indigo-600' : ''}
                `}
              >
                {literatureItem?.title?.slice(0, 2) || 'N'}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="max-w-xs">
                <p className="font-medium">{literatureItem?.title || 'Loading...'}</p>
                {literatureItem?.year && <p className="text-xs text-gray-500">{literatureItem.year}</p>}
                {showStats && node.visits > 0 && (
                  <p className="text-xs text-gray-500">
                    访问: {node.visits} | 胜率: {(winRate * 100).toFixed(1)}%
                  </p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Handles应该在过渡元素外部但相对于容器 */}
      <Handle type="target" position={Position.Top} className="!bg-transparent" />
      <Handle type="source" position={Position.Bottom} className="!bg-transparent" />
    </div>
  );
});

TreeNode.displayName = 'TreeNode';

// 树形视图缩放监控组件
const TreeViewportMonitor = memo(() => {
  const { zoom } = useViewport();
  const { setNodes } = useReactFlow();
  const lastKnownLevel = useRef<'detailed' | 'simplified'>('detailed');

  useEffect(() => {
    const threshold = TREE_VISUALIZATION_CONFIG.VISUALIZATION.ZOOM.THRESHOLD;
    const targetLevel = zoom < threshold ? 'simplified' : 'detailed';

    if (targetLevel !== lastKnownLevel.current) {
      console.log(`🔍 ZOOM TRIGGER: ${zoom.toFixed(2)} (threshold: ${threshold}) → ${targetLevel.toUpperCase()}`);
      lastKnownLevel.current = targetLevel;

      // 更新节点数据以进行视觉过渡
      setNodes(nds => {
        const updatedNodes = nds.map(n => ({
          ...n,
          data: {
            ...n.data,
            levelOfDetail: targetLevel,
          }
        }));
        console.log(`📝 Updated ${updatedNodes.length} nodes to ${targetLevel} mode`);
        return updatedNodes;
      });

      // 更新物理引擎的缩放级别
      const physics = (window as any).tree_physics;
      if (physics && physics.updateZoomLevel) {
        physics.updateZoomLevel(targetLevel);
        console.log(`✅ Physics updated to ${targetLevel} mode`);
      } else {
        console.warn(`⚠️ Physics engine not found:`, {
          tree_physics: (window as any).tree_physics,
          tree_simulation: (window as any).tree_simulation,
          hasUpdateMethod: physics?.updateZoomLevel
        });
      }
    }
  }, [zoom, setNodes]);

  return null;
});

TreeViewportMonitor.displayName = 'TreeViewportMonitor';

// 简单的调试信息组件
const LayerDebugInfo = memo(() => {
  const { getNodes } = useReactFlow();

  const layerInfo = useMemo(() => {
    const nodes = getNodes();
    const layers = new Map<number, number>();

    nodes.forEach(node => {
      const layer = node.data?.node?.layer || 0;
      layers.set(layer, (layers.get(layer) || 0) + 1);
    });

    return Array.from(layers.entries()).sort((a, b) => a[0] - b[0]);
  }, [getNodes]);

  return (
    <Panel position="top-left" className="pointer-events-none">
      <div style={{
        background: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: '8px',
        fontSize: '12px',
        borderRadius: '4px',
        pointerEvents: 'auto'
      }}>
        <div>层级吸引力调试:</div>
        {layerInfo.map(([layer, count]) => (
          <div key={layer}>
            Layer {layer}: {count} 个节点 (目标Y: {100 + layer * 200})
          </div>
        ))}
      </div>
    </Panel>
  );
});

LayerDebugInfo.displayName = 'LayerDebugInfo';

// 节点类型定义
const nodeTypes: NodeTypes = {
  treeNode: TreeNode,
};

// 树选择器组件
const TreeSelector = memo(({
  selectedTreeId,
  onTreeSelect
}: {
  selectedTreeId?: string;
  onTreeSelect: (treeId: string) => void;
}) => {
  const { trees } = useLibraryStore();



  return (
    <div className="flex items-center gap-2 mb-4 relative z-50">
      <TreePine className="h-4 w-4 text-green-600" />
      <Select value={selectedTreeId || ""} onValueChange={onTreeSelect}>
        <SelectTrigger className="w-[300px]">
          <SelectValue placeholder="选择一个文献树..." />
        </SelectTrigger>
        <SelectContent className="z-[9999]">
          {trees.length === 0 ? (
            <SelectItem value="no-trees" disabled>
              <span className="text-gray-500">暂无可用的文献树</span>
            </SelectItem>
          ) : (
            trees.map((tree) => (
              <SelectItem key={tree.id} value={tree.id}>
                <div className="flex flex-col">
                  <span className="font-medium">{tree.name}</span>
                  <span className="text-xs text-gray-500">
                    {Object.keys(tree.nodes).length} 个节点
                  </span>
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

    </div>
  );
});

TreeSelector.displayName = 'TreeSelector';

// 主组件
const TreeVisualizationInner = memo((props: TreeVisualizationProps) => {
  const {
    treeId: propTreeId,
    mode = 'view',
    height = '600px',
    className = '',
    showControls = true,
    showMiniMap = true,
    showTreeSelector = true,
    showNodeStats = true,
    enablePhysics = TREE_VISUALIZATION_CONFIG.PHYSICS.ENABLED_BY_DEFAULT,
    edgeType = TREE_VISUALIZATION_CONFIG.VISUALIZATION.DEFAULT_EDGE_TYPE,
    onNodeSelect,
    onTreeChange,
    onNodeAdd,
    onNodeDelete
  } = props;

  // 状态管理
  const [selectedTreeId, setSelectedTreeId] = useState<string | undefined>(propTreeId);
  const [nodes, setNodes, defaultOnNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [nodeToDelete, setNodeToDelete] = useState<string | null>(null);
  const [physicsEngine, setPhysicsEngine] = useState<TreePhysics | null>(null);
  const [usePhysicsLayout, setUsePhysicsLayout] = useState(enablePhysics);
  const [currentEdgeType, setCurrentEdgeType] = useState<'smoothstep' | 'step' | 'straight'>(edgeType);

  // Hooks
  const {
    tree,
    nodes: treeNodes,
    selectedNode,
    treeStats,
    isLoading,
    error,
    selectNode,
    addNode,
    deleteNode,
    runMCTSSimulation,
    getNodeLiteratureItem
  } = useTree(selectedTreeId || null);

  const { items: libraryItems, trees, initialize } = useLibraryStore();
  const reactFlowInstance = useReactFlow();



  // 初始化物理引擎
  useEffect(() => {
    if (enablePhysics && !physicsEngine) {
      const engine = new TreePhysics(() => {
        // 物理引擎tick回调：更新节点位置
        setNodes((prevNodes) => {
          const simulation = engine.getSimulation();
          if (!simulation) return prevNodes;

          return prevNodes.map(n => {
            const simNode = simulation.nodes().find((sn: any) => sn.id === n.id);
            if (!simNode) return n;

            // 检查节点是否被用户拖拽
            const isBeingDragged = n.dragging;

            // 如果节点正在被拖拽，不更新其位置
            if (isBeingDragged) {
              return n;
            }

            // 检查物理引擎中的节点是否被固定
            const isFixed = simNode.fx !== null && simNode.fx !== undefined;

            // 如果节点在物理引擎中被固定，不更新位置
            if (isFixed) {
              return n;
            }

            // 更新节点位置
            return {
              ...n,
              position: { x: simNode.x, y: simNode.y }
            };
          });
        });
      });
      setPhysicsEngine(engine);

      // 将引擎实例存储到全局变量以便缩放监听器访问
      (window as any).tree_physics = engine;
      console.log(`🔧 Physics engine initialized and stored globally`);
    }

    return () => {
      if (physicsEngine) {
        physicsEngine.stop();
        // 清理全局引用
        (window as any).tree_physics = null;
        (window as any).tree_simulation = null;
      }
    };
  }, [enablePhysics, setNodes]);

  // 传统布局算法：使用dagre进行树形布局
  const getDagreLayoutedElements = useCallback((nodes: Node[], edges: Edge[]) => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: 'TB', ranksep: 100, nodesep: 80 });

    nodes.forEach((node) => {
      dagreGraph.setNode(node.id, { width: 250, height: 120 });
    });

    edges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      return {
        ...node,
        position: {
          x: nodeWithPosition.x - 125,
          y: nodeWithPosition.y - 60,
        },
      };
    });

    return { nodes: layoutedNodes, edges };
  }, []);

  // 物理布局：启动物理引擎
  const applyPhysicsLayout = useCallback((nodes: Node[], edges: Edge[]) => {
    if (physicsEngine && nodes.length > 0) {
      try {
        // 先应用传统布局作为初始位置
        const { nodes: initialNodes } = getDagreLayoutedElements(nodes, edges);

        // 启动物理引擎
        physicsEngine.stop();
        physicsEngine.start(initialNodes, edges);

        return { nodes: initialNodes, edges };
      } catch (error) {
        console.error('Physics engine error:', error);
        // 回退到传统布局
        return getDagreLayoutedElements(nodes, edges);
      }
    }
    return { nodes, edges };
  }, [physicsEngine, getDagreLayoutedElements]);

  // 统一的布局方法
  const getLayoutedElements = useCallback((nodes: Node[], edges: Edge[]) => {
    if (usePhysicsLayout && physicsEngine) {
      return applyPhysicsLayout(nodes, edges);
    } else {
      return getDagreLayoutedElements(nodes, edges);
    }
  }, [usePhysicsLayout, physicsEngine, applyPhysicsLayout, getDagreLayoutedElements]);

  // 将树数据转换为React Flow格式
  const convertTreeToFlowData = useCallback(async () => {
    if (!tree || !treeNodes.length) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // 获取所有节点的文献信息
    const nodeDataPromises = treeNodes.map(async (node) => {
      const literatureItem = await getNodeLiteratureItem(node.id);
      return { node, literatureItem };
    });

    const nodeDataArray = await Promise.all(nodeDataPromises);

    // 创建节点
    const flowNodes: Node[] = nodeDataArray.map(({ node, literatureItem }) => ({
      id: node.id,
      type: 'treeNode',
      position: { x: 0, y: 0 }, // 将由布局算法重新计算
      data: {
        node,
        literatureItem,
        isSelected: selectedNode?.id === node.id,
        mode,
        showStats: showNodeStats,
        onAddChild: mode === 'edit' ? handleAddChild : undefined,
        onDelete: mode === 'edit' ? handleDeleteNode : undefined,
      },
    }));

    // 创建边
    const flowEdges: Edge[] = treeNodes
      .filter(node => node.parentId !== null)
      .map(node => ({
        id: `${node.parentId}-${node.id}`,
        source: node.parentId!,
        target: node.id,
        type: currentEdgeType,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
        },
        style: {
          strokeWidth: 2,
          stroke: '#64748b',
        },
      }));

    // 应用布局
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(flowNodes, flowEdges);
    
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [tree, treeNodes, selectedNode, mode, showNodeStats, getNodeLiteratureItem, getLayoutedElements]);

  // 处理树选择
  const handleTreeSelect = useCallback((treeId: string) => {
    setSelectedTreeId(treeId);
    onTreeChange?.(treeId);
  }, [onTreeChange]);

  // 处理节点点击
  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    const mctsNode = node.data.node as MCTSNode;
    selectNode(mctsNode.id);
    onNodeSelect?.(mctsNode);
  }, [selectNode, onNodeSelect]);

  // 处理节点拖拽开始
  const handleNodeDragStart = useCallback((event: React.MouseEvent, node: Node) => {
    // 标记节点为拖拽状态
    setNodes(nodes => nodes.map(n =>
      n.id === node.id ? { ...n, dragging: true } : n
    ));

    if (usePhysicsLayout && physicsEngine) {
      // 在拖拽开始时固定节点位置
      const simulation = physicsEngine.getSimulation();
      if (simulation) {
        const simNode = simulation.nodes().find((sn: any) => sn.id === node.id);
        if (simNode) {
          simNode.fx = node.position.x;
          simNode.fy = node.position.y;
          console.log(`Node ${node.id} drag started, fixed at (${node.position.x}, ${node.position.y})`);
        }
      }
    }
  }, [setNodes, usePhysicsLayout, physicsEngine]);

  // 自定义节点变化处理，同步物理引擎
  const onNodesChange = useCallback((changes: any[]) => {
    defaultOnNodesChange(changes);

    // 如果启用了物理引擎，同步位置变化到物理引擎
    if (usePhysicsLayout && physicsEngine) {
      const simulation = physicsEngine.getSimulation();
      if (simulation) {
        changes.forEach(change => {
          if (change.type === 'position' && change.position) {
            const simNode = simulation.nodes().find((sn: any) => sn.id === change.id);
            if (simNode) {
              simNode.x = change.position.x;
              simNode.y = change.position.y;
              // 在拖拽过程中不解除固定状态
              // console.log(`Node ${change.id} position updated in physics: (${change.position.x}, ${change.position.y})`);
            }
          }
        });
      }
    }
  }, [defaultOnNodesChange, usePhysicsLayout, physicsEngine]);

  // 处理节点拖拽结束，重启物理引擎
  const handleNodeDragStop = useCallback((_event: React.MouseEvent, node: Node) => {
    // 取消拖拽状态
    setNodes(nodes => nodes.map(n =>
      n.id === node.id ? { ...n, dragging: false } : n
    ));

    if (usePhysicsLayout && physicsEngine) {
      // 更新物理引擎中对应节点的位置
      const simulation = physicsEngine.getSimulation();
      if (simulation) {
        const simNode = simulation.nodes().find((sn: any) => sn.id === node.id);
        if (simNode) {
          // 更新节点位置
          simNode.x = node.position.x;
          simNode.y = node.position.y;

          console.log(`Node ${node.id} drag stopped at (${node.position.x}, ${node.position.y})`);

          // 立即解除固定状态，让物理引擎接管
          simNode.fx = null;
          simNode.fy = null;
          console.log(`Node ${node.id} unfixed immediately, ready for layer attraction`);

          // 重启物理模拟以应用层级吸引力
          physicsEngine.restart();
        }
      }
    }
  }, [setNodes, usePhysicsLayout, physicsEngine]);

  // 处理添加子节点
  const handleAddChild = useCallback((parentNodeId: string) => {
    // 这里应该打开一个对话框让用户选择要添加的文献
    // 暂时使用第一个可用的文献项作为示例
    if (libraryItems.length > 0) {
      const randomItem = libraryItems[Math.floor(Math.random() * libraryItems.length)];
      addNode(parentNodeId, randomItem.id)
        .then(() => {
          toast.success('节点添加成功');
          onNodeAdd?.(parentNodeId, randomItem.id);
        })
        .catch((error) => {
          toast.error(`添加节点失败: ${error.message}`);
        });
    } else {
      toast.error('没有可用的文献项');
    }
  }, [libraryItems, addNode, onNodeAdd]);

  // 处理删除节点
  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodeToDelete(nodeId);
    setDeleteDialogOpen(true);
  }, []);

  // 确认删除节点
  const confirmDeleteNode = useCallback(() => {
    if (nodeToDelete) {
      deleteNode(nodeToDelete)
        .then(() => {
          toast.success('节点删除成功');
          onNodeDelete?.(nodeToDelete);
        })
        .catch((error) => {
          toast.error(`删除节点失败: ${error.message}`);
        })
        .finally(() => {
          setDeleteDialogOpen(false);
          setNodeToDelete(null);
        });
    }
  }, [nodeToDelete, deleteNode, onNodeDelete]);

  // 处理MCTS模拟
  const handleRunMCTS = useCallback(() => {
    if (!selectedTreeId) {
      toast.error('请先选择一个树');
      return;
    }

    runMCTSSimulation()
      .then(() => {
        toast.success('MCTS模拟完成');
      })
      .catch((error) => {
        toast.error(`MCTS模拟失败: ${error.message}`);
      });
  }, [selectedTreeId, runMCTSSimulation]);

  // 自动布局
  const handleAutoLayout = useCallback(() => {
    if (nodes.length > 0) {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges);
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);

      // 适应视图
      setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.2 });
      }, 100);
    }
  }, [nodes, edges, getLayoutedElements, setNodes, setEdges, reactFlowInstance]);

  // 切换物理引擎
  const handleTogglePhysics = useCallback(() => {
    const newUsePhysics = !usePhysicsLayout;
    setUsePhysicsLayout(newUsePhysics);

    if (newUsePhysics && physicsEngine && nodes.length > 0) {
      // 启动物理引擎
      applyPhysicsLayout(nodes, edges);
    } else if (!newUsePhysics && physicsEngine) {
      // 停止物理引擎，应用传统布局
      physicsEngine.stop();
      const { nodes: layoutedNodes, edges: layoutedEdges } = getDagreLayoutedElements(nodes, edges);
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    }
  }, [usePhysicsLayout, physicsEngine, nodes, edges, applyPhysicsLayout, getDagreLayoutedElements, setNodes, setEdges]);

  // 监听树数据变化，更新可视化
  useEffect(() => {
    convertTreeToFlowData();
  }, [convertTreeToFlowData]);

  // 处理拖拽连接
  const onConnect = useCallback(async (connection: Connection) => {
    if (!connection.source || !connection.target || !selectedTreeId) {
      toast.error('连接失败：缺少必要信息');
      return;
    }

    // 防止自连接
    if (connection.source === connection.target) {
      toast.error('不能连接到自己');
      return;
    }

    try {
      // 检查是否会形成循环
      const sourceNode = treeNodes.find(n => n.id === connection.source);
      const targetNode = treeNodes.find(n => n.id === connection.target);

      if (!sourceNode || !targetNode) {
        toast.error('找不到对应的节点');
        return;
      }

      // 在树中添加新的父子关系（将target作为source的子节点）
      await addNode(connection.source, targetNode.libraryItemId);
      toast.success('节点连接成功');
      onNodeAdd?.(connection.source, targetNode.libraryItemId);
    } catch (error) {
      console.error('连接节点失败:', error);
      toast.error(`连接失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }, [selectedTreeId, treeNodes, addNode, onNodeAdd]);

  // 初始适应视图（仅在首次加载时）
  const hasInitializedView = useRef(false);
  useEffect(() => {
    if (nodes.length > 0 && !hasInitializedView.current) {
      hasInitializedView.current = true;
      setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.2 });
      }, 100);
    }
  }, [nodes.length > 0, reactFlowInstance]);

  const isEditable = mode === 'edit';
  const isEmbedded = mode === 'embedded';

  return (
    <div className={`tree-visualization ${mode}-mode ${className} relative`} style={{ height }}>
      {/* 紧凑工具栏 - 树选择器和控制按钮在同一行 */}
      {(showTreeSelector || isEditable) && !isEmbedded && (
        <div className="flex items-center justify-between gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
          {/* 左侧：树选择器 */}
          {showTreeSelector && (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <TreePine className="h-4 w-4 text-green-600 flex-shrink-0" />
              <Select value={selectedTreeId || ""} onValueChange={handleTreeSelect}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="选择一个文献树..." />
                </SelectTrigger>
                <SelectContent className="z-[9999]">
                  {trees.length === 0 ? (
                    <SelectItem value="no-trees" disabled>
                      <span className="text-gray-500">暂无可用的文献树</span>
                    </SelectItem>
                  ) : (
                    trees.map((tree) => (
                      <SelectItem key={tree.id} value={tree.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{tree.name}</span>
                          <span className="text-xs text-gray-500">
                            {Object.keys(tree.nodes).length} 个节点
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 中间：操作按钮 */}
          {isEditable && (
            <div className="flex items-center gap-2">
              <Button
                onClick={handleRunMCTS}
                disabled={!selectedTreeId || isLoading}
                size="sm"
                className="flex items-center gap-1"
              >
                <Play className="h-3 w-3" />
                MCTS
              </Button>

              <Button
                onClick={handleAutoLayout}
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
              >
                <RefreshCw className="h-3 w-3" />
                布局
              </Button>

              <Button
                onClick={handleTogglePhysics}
                variant={usePhysicsLayout ? "default" : "outline"}
                size="sm"
                className="flex items-center gap-1"
              >
                {usePhysicsLayout ? <Zap className="h-3 w-3" /> : <ZapOff className="h-3 w-3" />}
                {usePhysicsLayout ? '物理' : '静态'}
              </Button>

              {/* <div className="flex items-center gap-1">
                <span className="text-xs text-gray-600">连线:</span>
                <Select value={currentEdgeType} onValueChange={(value: 'smoothstep' | 'step' | 'straight') => {
                  setCurrentEdgeType(value);
                  // 直接更新现有边的类型
                  setEdges(currentEdges =>
                    currentEdges.map(edge => ({
                      ...edge,
                      type: value
                    }))
                  );
                }}>
                  <SelectTrigger className="w-[100px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bezier">曲线</SelectItem>
                    <SelectItem value="step">直角</SelectItem>
                    <SelectItem value="straight">直线</SelectItem>
                  </SelectContent>
                </Select>
              </div> */}
            </div>
          )}

          {/* 右侧：统计信息 */}
          {treeStats && isEditable && (
            <div className="flex items-center gap-3 text-xs text-gray-600 flex-shrink-0">
              <span>节点: {treeStats.totalNodes}</span>
              <span>深度: {treeStats.maxDepth}</span>
              <span>胜率: {(treeStats.averageWinRate * 100).toFixed(1)}%</span>
            </div>
          )}
        </div>
      )}

      {/* React Flow 可视化区域 */}
      <div className="relative bg-gray-50 rounded-lg border z-10" style={{ height: isEditable ? 'calc(100% - 120px)' : '100%' }}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>加载中...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
            <div className="text-red-600 text-center">
              <div className="font-medium">加载失败</div>
              <div className="text-sm">{error}</div>
            </div>
          </div>
        )}

        {!selectedTreeId && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
            <div className="text-gray-500 text-center">
              <TreePine className="h-12 w-12 mx-auto mb-2 text-gray-400" />
              <div className="font-medium">请选择一个文献树</div>
              <div className="text-sm">选择或创建一个树来开始可视化</div>
            </div>
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onNodeDragStart={handleNodeDragStart}
          onNodeDragStop={handleNodeDragStop}
          onConnect={isEditable ? onConnect : undefined}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          nodesDraggable={true}
          nodesConnectable={isEditable}
          elementsSelectable={true}
        >
          <TreeViewportMonitor />
          {/* 层级调试信息 */}
          {usePhysicsLayout && <LayerDebugInfo />}
          {showControls && !isEmbedded && <Controls />}
          {showMiniMap && !isEmbedded && (
            <MiniMap
              nodeColor="#64748b"
              maskColor="rgba(0, 0, 0, 0.1)"
              className="bg-white border rounded"
            />
          )}
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        </ReactFlow>
      </div>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除节点</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将删除该节点及其所有子节点。此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteNode}>
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});

TreeVisualizationInner.displayName = 'TreeVisualizationInner';

// 导出包装了ReactFlowProvider的组件
export const TreeVisualization = memo((props: TreeVisualizationProps) => {
  return (
    <TooltipProvider>
      <ReactFlowProvider>
        <TreeVisualizationInner {...props} />
      </ReactFlowProvider>
    </TooltipProvider>
  );
});

TreeVisualization.displayName = 'TreeVisualization';
