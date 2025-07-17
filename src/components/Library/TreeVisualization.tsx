"use client";

import React, { memo, useCallback, useState, useEffect, useMemo } from 'react';
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
  ReactFlowProvider
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { TreePhysics } from './TreePhysics';
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
  ZapOff
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
  onNodeSelect?: (node: MCTSNode) => void;
  onTreeChange?: (treeId: string) => void;
  onNodeAdd?: (parentId: string, itemId: string) => void;
  onNodeDelete?: (nodeId: string) => void;
}

// 自定义树节点组件
const TreeNode = memo(({ data }: { data: any }) => {
  const { node, literatureItem, isSelected, mode, showStats } = data;
  const isEditable = mode === 'edit';
  
  // 计算UCT值和胜率
  const winRate = node.visits > 0 ? (node.wins / node.visits) : 0;
  const uctValue = node.visits > 0 ? winRate + Math.sqrt(2 * Math.log(100) / node.visits) : 0;
  
  return (
    <div className={`
      bg-white border-2 rounded-lg shadow-md p-3 min-w-[200px] max-w-[300px]
      ${isSelected ? 'border-blue-500 shadow-lg' : 'border-gray-200'}
      ${isEditable ? 'hover:border-blue-300 cursor-pointer' : ''}
    `}>
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      
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
        
        {/* 年份 */}
        {literatureItem?.year && (
          <Badge variant="outline" className="text-xs">
            {literatureItem.year}
          </Badge>
        )}
        
        {/* MCTS统计信息 */}
        {showStats && (
          <div className="grid grid-cols-2 gap-1 text-xs">
            <div className="bg-blue-50 px-2 py-1 rounded">
              <div className="text-blue-600 font-medium">访问: {node.visits}</div>
            </div>
            <div className="bg-green-50 px-2 py-1 rounded">
              <div className="text-green-600 font-medium">胜率: {(winRate * 100).toFixed(1)}%</div>
            </div>
            {node.visits > 0 && (
              <div className="col-span-2 bg-purple-50 px-2 py-1 rounded">
                <div className="text-purple-600 font-medium">UCT: {uctValue.toFixed(3)}</div>
              </div>
            )}
          </div>
        )}
        
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
      
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
});

TreeNode.displayName = 'TreeNode';

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
    enablePhysics = true,
    onNodeSelect,
    onTreeChange,
    onNodeAdd,
    onNodeDelete
  } = props;

  // 状态管理
  const [selectedTreeId, setSelectedTreeId] = useState<string | undefined>(propTreeId);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [nodeToDelete, setNodeToDelete] = useState<string | null>(null);
  const [physicsEngine, setPhysicsEngine] = useState<TreePhysics | null>(null);
  const [usePhysicsLayout, setUsePhysicsLayout] = useState(enablePhysics);

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
        if (nodes.length > 0) {
          setNodes((currentNodes) =>
            currentNodes.map((node) => ({
              ...node,
              position: {
                x: (node as any).x || node.position.x,
                y: (node as any).y || node.position.y,
              },
            }))
          );
        }
      });
      setPhysicsEngine(engine);
    }

    return () => {
      if (physicsEngine) {
        physicsEngine.stop();
      }
    };
  }, [enablePhysics, physicsEngine, nodes.length, setNodes]);

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
        physicsEngine.stop();
        physicsEngine.start(nodes, edges);
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
        type: 'smoothstep',
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

  // 自动适应视图
  useEffect(() => {
    if (nodes.length > 0) {
      setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.2 });
      }, 100);
    }
  }, [nodes, reactFlowInstance]);

  const isEditable = mode === 'edit';
  const isEmbedded = mode === 'embedded';

  return (
    <div className={`tree-visualization ${mode}-mode ${className} relative`} style={{ height }}>
      {/* 树选择器 */}
      {showTreeSelector && !isEmbedded && (
        <div className="space-y-2">
          <TreeSelector
            selectedTreeId={selectedTreeId}
            onTreeSelect={handleTreeSelect}
          />


        </div>
      )}

      {/* 工具栏 */}
      {isEditable && (
        <div className="flex items-center gap-2 mb-4 p-2 bg-gray-50 rounded-lg">
          <Button
            onClick={handleRunMCTS}
            disabled={!selectedTreeId || isLoading}
            size="sm"
            className="flex items-center gap-2"
          >
            <Play className="h-3 w-3" />
            运行MCTS
          </Button>
          
          <Button
            onClick={handleAutoLayout}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-3 w-3" />
            重新布局
          </Button>

          <Button
            onClick={handleTogglePhysics}
            variant={usePhysicsLayout ? "default" : "outline"}
            size="sm"
            className="flex items-center gap-2"
          >
            {usePhysicsLayout ? <Zap className="h-3 w-3" /> : <ZapOff className="h-3 w-3" />}
            {usePhysicsLayout ? '物理效果' : '静态布局'}
          </Button>

          {treeStats && (
            <div className="flex items-center gap-4 ml-auto text-sm text-gray-600">
              <span>节点: {treeStats.totalNodes}</span>
              <span>深度: {treeStats.maxDepth}</span>
              <span>平均胜率: {(treeStats.averageWinRate * 100).toFixed(1)}%</span>
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
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          fitView
          fitViewOptions={{ padding: 0.2 }}
        >
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
