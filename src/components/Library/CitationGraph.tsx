"use client";

import React, { memo, useCallback, useState, useEffect, useRef } from 'react';
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
    useViewport,
    ReactFlowProvider,
    useReactFlow,
    Connection,
    addEdge,
    ConnectionMode,
    EdgeMouseHandler
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
    Users,
    Calendar,
    Maximize2,
    Network,
    RefreshCw,
    Zap,
    ZapOff,
    Link2,
    Check,
    X
} from "lucide-react";
import { LibraryItem } from '@/libs/db';
import { libraryService } from '@/libs/db/LibraryService';
import { useLibraryStore } from '@/store/libraryStore';
import { toast } from 'sonner';
import { CitationGraphPhysics, ZOOM_THRESHOLD } from './CitationGraphPhysics';


interface LiteratureNodeData {
    item: LibraryItem;
    label: string; // for simplified node
    onNodeClick: (itemId: string) => void;
    levelOfDetail: 'detailed' | 'simplified';
}

const AdaptiveNode = memo(({ data }: { data: LiteratureNodeData }) => {
    const { item, onNodeClick, levelOfDetail } = data;

    const isDetailed = levelOfDetail === 'detailed';

    return (
        <div className={`relative flex items-center justify-center transition-all duration-300 ${isDetailed ? 'w-56 h-24' : 'w-10 h-10'}`}>
            {/* Detailed Card View */}
            <div
                className={`absolute transition-all duration-300 ease-in-out ${isDetailed ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}
                style={{ pointerEvents: isDetailed ? 'all' : 'none' }}
            >
                <Card
                    className="w-56 p-2 cursor-pointer border-2 hover:border-blue-500"
                    onClick={() => onNodeClick(item.id)}
                >
                    <h3 className="font-semibold text-xs leading-tight mb-1 truncate">{item.title}</h3>
                    <div className="space-y-1 text-muted-foreground text-[10px]">
                        <div className="flex items-center gap-1 truncate">
                            <Users className="h-3 w-3 flex-shrink-0" />
                            <span>{item.authors.slice(0, 1).join(', ')}{item.authors.length > 1 ? ' et al.' : ''}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 flex-shrink-0" />
                            <span>{item.year}</span>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Simplified Circle View */}
            <div
                className={`absolute transition-all duration-300 ease-in-out ${!isDetailed ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`}
                style={{ pointerEvents: !isDetailed ? 'all' : 'none' }}
            >
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div
                                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-mono cursor-pointer shadow-lg bg-gradient-to-br from-blue-400 to-indigo-500"
                                onClick={() => onNodeClick(item.id)}
                            >
                                {item.title.slice(0, 2)}
                            </div>
                        </TooltipTrigger>
                        <TooltipContent><p>{item.title}</p></TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>

            {/* Handles should be outside the transitioning elements but relative to the container */}
            <Handle type="target" position={Position.Left} className="!bg-transparent" />
            <Handle type="source" position={Position.Right} className="!bg-transparent" />
        </div>
    );
});
AdaptiveNode.displayName = 'AdaptiveNode';


const nodeTypes: NodeTypes = {
    adaptive: AdaptiveNode,
};

const calculateStaticLayout = (nodes: Node[], edges: Edge[]) => {
    if (nodes.length === 0) return { nodes, edges };
    const numNodes = nodes.length;
    const numCols = Math.ceil(Math.sqrt(numNodes));
    const PADDING_X = 300;
    const PADDING_Y = 150;

    const layoutedNodes = nodes.map((node, index) => {
        const col = index % numCols;
        const row = Math.floor(index / numCols);
        return {
            ...node,
            position: { x: col * PADDING_X, y: row * PADDING_Y },
        };
    });
    return { nodes: layoutedNodes, edges };
};

const ViewportMonitor = () => {
    const { zoom } = useViewport();
    const { setNodes } = useReactFlow();
    const lastKnownLevel = useRef<'detailed' | 'simplified'>('detailed');

    useEffect(() => {
        const targetLevel = zoom < ZOOM_THRESHOLD ? 'simplified' : 'detailed';

        if (targetLevel !== lastKnownLevel.current) {
            lastKnownLevel.current = targetLevel;

            // Update node data for visual transition
            setNodes(nds =>
                nds.map(n => ({
                    ...n,
                    data: {
                        ...n.data,
                        levelOfDetail: targetLevel,
                    }
                }))
            );

            // Update physics parameters based on detail level
            const physics = (window as any).citationGraphPhysics as CitationGraphPhysics;
            if (physics) {
                physics.updateForDetailLevel(targetLevel);
            }
        }
    }, [zoom, setNodes]);

    return null;
};


interface CitationGraphProps {
    onNodeClick: (itemId: string) => void;
    className?: string;
    onExpandToggle?: (expanded: boolean) => void; // 添加展开状态回调
}

function CitationGraph({ onNodeClick, className, onExpandToggle }: CitationGraphProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const {
        items: allItems,
        isLoading: isItemsLoading,
        isInitialized: isStoreInitialized,
        citationVersion, // 🎯 监听citation版本变化
        initialize,
        createManualCitationLink,
        deleteCitationLink
    } = useLibraryStore();

    const [isExpanded, setIsExpanded] = useState(false);
    const [isLayouting, setIsLayouting] = useState(true);
    const [isPhysicsEnabled, setIsPhysicsEnabled] = useState(true); // 默认开启物理效果

    // 删除确认对话框状态
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [edgeToDelete, setEdgeToDelete] = useState<{ edge: Edge, sourceItem: LibraryItem, targetItem: LibraryItem } | null>(null);

    const physicsRef = useRef<CitationGraphPhysics | null>(null);

    // 🎯 缓存上次的数据特征，避免不必要的重新计算
    const lastDataSignatureRef = useRef<string>('');

    useEffect(() => {
        if (!isStoreInitialized) {
            initialize();
        }
    }, [isStoreInitialized, initialize]);

    // 初始化物理引擎
    useEffect(() => {
        const onTick = () => {
            setNodes(prevNodes => {
                const physics = physicsRef.current;
                if (!physics) return prevNodes;

                const simulation = physics.getSimulation();
                if (!simulation) return prevNodes;

                return prevNodes.map(n => {
                    const simNode = simulation.nodes().find(sn => (sn as Node).id === n.id);
                    return simNode ? { ...n, position: { x: (simNode as any).x, y: (simNode as any).y } } : n;
                });
            });
        };

        physicsRef.current = new CitationGraphPhysics(onTick);
        (window as any).citationGraphPhysics = physicsRef.current;

        return () => {
            if (physicsRef.current) {
                physicsRef.current.stop();
                physicsRef.current = null;
            }
            delete (window as any).citationGraphPhysics;
        };
    }, [setNodes]);

    const fetchDataAndLayout = useCallback(async () => {
        if (!isStoreInitialized) return;
        setIsLayouting(true);

        try {
            console.log(`[Graph] 🔄 Updating layout - Items: ${allItems.length}, Citation Version: ${citationVersion}`);

            // 🎯 优先使用store中的数据，确保数据一致性
            const items = allItems.length > 0 ? allItems : await libraryService.getAllLibraryItems();
            if (items.length === 0) {
                console.log('[Graph] ⚠️ No items found, clearing graph');
                setNodes([]);
                setEdges([]);
                return;
            }

            const citations = await libraryService.getAllCitations();
            console.log(`[Graph] 📊 Data loaded - ${items.length} items, ${citations.length} citations`);

            // 🎯 生成数据特征签名，检查是否真的需要重新布局
            const dataSignature = `${items.length}-${citations.length}-${citationVersion}`;
            if (dataSignature === lastDataSignatureRef.current) {
                console.log('[Graph] ⏭️ Data signature unchanged, skipping layout recalculation');
                setIsLayouting(false);
                return;
            }
            lastDataSignatureRef.current = dataSignature;
            console.log(`[Graph] 🔄 Data signature changed: ${dataSignature}`);

            const nodeIds = new Set(items.map(item => item.id));

            const graphNodes: Node<LiteratureNodeData>[] = items.map(item => ({
                id: item.id,
                type: 'adaptive',
                position: { x: 0, y: 0 },
                data: {
                    item,
                    label: item.title,
                    onNodeClick: onNodeClick,
                    levelOfDetail: 'detailed'
                },
            }));

            const graphEdges: Edge[] = citations
                .filter(c => nodeIds.has(c.source) && nodeIds.has(c.target) && c.source !== c.target)
                .map(c => ({
                    id: `${c.source}-${c.target}`,
                    source: c.source,
                    target: c.target,
                    type: 'default',
                    animated: true,
                    markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
                }));

            // console.log(`[Graph] Created ${graphEdges.length} edges`);

            if (isPhysicsEnabled && physicsRef.current && graphNodes.length > 0) {
                // 使用物理引擎布局
                const { nodes: staticNodes } = calculateStaticLayout(graphNodes, graphEdges);
                setNodes(staticNodes);
                setEdges(graphEdges);

                // 启动物理模拟
                physicsRef.current.start(staticNodes, graphEdges);
            } else {
                // 使用静态布局
                const { nodes: staticNodes } = calculateStaticLayout(graphNodes, graphEdges);
                setNodes(staticNodes);
                setEdges(graphEdges);
            }
        } catch (error) {
            console.error("[Graph] Failed to layout data:", error);
        } finally {
            setIsLayouting(false);
        }
    }, [isStoreInitialized, setNodes, setEdges, isPhysicsEnabled, onNodeClick, allItems.length, citationVersion]);

    // 🎯 响应式更新：监听文献数量和citation版本变化
    useEffect(() => {
        console.log(`[Graph] Triggering layout update: ${allItems.length} items, citation version: ${citationVersion}`);
        fetchDataAndLayout();
    }, [fetchDataAndLayout]);

    const togglePhysics = useCallback(() => {
        setIsPhysicsEnabled(enabled => {
            const newIsEnabled = !enabled;
            if (newIsEnabled && physicsRef.current && nodes.length > 0) {
                physicsRef.current.start(nodes, edges);
            } else if (physicsRef.current) {
                physicsRef.current.stop();
                fetchDataAndLayout(); // 重新计算静态布局
            }
            return newIsEnabled;
        });
    }, [nodes, edges, fetchDataAndLayout]);

    // 强制重启物理引擎（用于配置更新后立即应用）
    const forceRestartPhysics = useCallback(() => {
        if (physicsRef.current && nodes.length > 0 && isPhysicsEnabled) {
            console.log('[Graph] Force restarting physics with new config...');
            physicsRef.current.stop();
            physicsRef.current.start(nodes, edges);
            toast.success('物理引擎已重启，新配置已应用');
        }
    }, [nodes, edges, isPhysicsEnabled]);

    const onNodeDragStart = (event: React.MouseEvent, node: Node) => {
        if (!isPhysicsEnabled || !physicsRef.current) return;
        physicsRef.current.fixNode(node.id, node.position.x, node.position.y);
    };

    const onNodeDrag = (event: React.MouseEvent, node: Node) => {
        if (!isPhysicsEnabled || !physicsRef.current) return;
        physicsRef.current.fixNode(node.id, node.position.x, node.position.y);
    };

    const onNodeDragStop = (event: React.MouseEvent, node: Node) => {
        if (!isPhysicsEnabled || !physicsRef.current) return;
        physicsRef.current.releaseNode(node.id);
    };

    // 处理拖拽连接
    const onConnect = useCallback(async (connection: Connection) => {
        if (!connection.source || !connection.target) return;

        const sourceItem = allItems.find(item => item.id === connection.source);
        const targetItem = allItems.find(item => item.id === connection.target);

        if (!sourceItem || !targetItem) return;

        try {
            console.log(`[Graph] Creating connection via drag: ${connection.source} -> ${connection.target}`);
            const success = await createManualCitationLink(connection.source, connection.target);

            if (success) {
                toast.success(`已创建链接：${sourceItem.title} → ${targetItem.title}`);
                console.log(`[Graph] Connection created successfully, graph will auto-refresh via version change`);
                // 🎯 不需要手动刷新，citationVersion变化会自动触发重新布局
            } else {
                toast.info("链接已存在");
                console.log(`[Graph] Connection already exists`);
            }
        } catch (error) {
            console.error("Error creating connection:", error);
            toast.error("创建连接失败");
        }
    }, [allItems, createManualCitationLink, fetchDataAndLayout]);

    // 处理边的右键点击删除
    const onEdgeContextMenu: EdgeMouseHandler = useCallback(async (event, edge) => {
        event.preventDefault();

        const sourceItem = allItems.find(item => item.id === edge.source);
        const targetItem = allItems.find(item => item.id === edge.target);

        if (!sourceItem || !targetItem) return;

        // 设置要删除的边信息并打开确认对话框
        setEdgeToDelete({ edge, sourceItem, targetItem });
        setDeleteDialogOpen(true);
    }, [allItems]);

    // 确认删除边
    const handleConfirmDelete = useCallback(async () => {
        if (!edgeToDelete) return;

        const { edge, sourceItem, targetItem } = edgeToDelete;

        try {
            console.log(`[Graph] Deleting edge via store: ${edge.source} -> ${edge.target}`);
            await deleteCitationLink(edge.source, edge.target);

            toast.success(`已删除引用关系：${sourceItem.title} → ${targetItem.title}`);
            console.log(`[Graph] Edge deleted successfully, graph will auto-refresh via version change`);

            // 🎯 不需要手动刷新，citationVersion变化会自动触发重新布局
        } catch (error) {
            console.error("Error deleting edge:", error);
            toast.error("删除引用关系失败");
        } finally {
            setDeleteDialogOpen(false);
            setEdgeToDelete(null);
        }
    }, [edgeToDelete, deleteCitationLink, fetchDataAndLayout]);

    // 取消删除
    const handleCancelDelete = useCallback(() => {
        setDeleteDialogOpen(false);
        setEdgeToDelete(null);
    }, []);

    // 处理展开/收起切换
    const handleExpandToggle = useCallback(() => {
        const newExpanded = !isExpanded;
        setIsExpanded(newExpanded);
        // 通知父组件状态变化
        if (onExpandToggle) {
            onExpandToggle(newExpanded);
        }
    }, [isExpanded, onExpandToggle]);


    if (isItemsLoading || !isStoreInitialized) {
        return (
            <Card className={className}>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Network className="h-5 w-5" />全局知识图谱</CardTitle></CardHeader>
                <CardContent><div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div></div></CardContent>
            </Card>
        );
    }

    return (
        <>
            <Card className={`${className} flex flex-col`}>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-base"><Network className="h-5 w-5" />全局知识图谱</CardTitle>
                        <div className="flex gap-2">
                            <Button variant={isPhysicsEnabled ? "default" : "outline"} size="sm" onClick={togglePhysics} className="flex items-center gap-1">
                                {isPhysicsEnabled ? <Zap className="h-4 w-4" /> : <ZapOff className="h-4 w-4" />}
                                {isPhysicsEnabled ? '物理引擎' : '静态布局'}
                            </Button>
                            {/* {isPhysicsEnabled && (
                                <Button variant="outline" size="sm" onClick={forceRestartPhysics} className="flex items-center gap-1">
                                    <RefreshCw className="h-4 w-4" />
                                    重启物理引擎
                                </Button>
                            )} */}
                            <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                <Link2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                <span className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                                    拖拽连接已启用
                                </span>
                            </div>
                            <Button variant="outline" size="sm" onClick={fetchDataAndLayout} disabled={isLayouting}>
                                {isLayouting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleExpandToggle}>
                                <Maximize2 className="h-4 w-4 mr-1" />
                                {isExpanded ? '收起' : '展开'}
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0 flex-1">
                    <div className="transition-all duration-300 relative h-full">
                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onConnect={onConnect}
                            onEdgeContextMenu={onEdgeContextMenu}
                            nodeTypes={nodeTypes}
                            fitView
                            nodesDraggable={true}
                            onNodeDragStart={onNodeDragStart}
                            onNodeDrag={onNodeDrag}
                            onNodeDragStop={onNodeDragStop}
                            connectionMode={ConnectionMode.Loose}
                            connectOnClick={false}
                            proOptions={{ hideAttribution: true }}
                        >
                            <Controls showInteractive={false} />
                            <MiniMap nodeColor="#3b82f6" maskColor="rgba(0, 0, 0, 0.2)" style={{ width: 120, height: 80 }} />
                            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
                            <ViewportMonitor />
                        </ReactFlow>
                        {isLayouting && (
                            <div className="absolute inset-0 bg-white/50 dark:bg-black/50 flex items-center justify-center z-10">
                                <div className="text-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                                    <p className="text-sm font-medium">正在计算布局...</p>
                                </div>
                            </div>
                        )}
                        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
                            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 text-sm shadow-lg">
                                <p className="text-gray-800 dark:text-gray-200 font-medium">
                                    💡 拖拽节点边缘的小圆点到另一个节点创建引用关系 | 右键点击连接线删除关系
                                </p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 删除确认对话框 */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>确认删除引用关系</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-2">
                                <p>您确定要删除以下引用关系吗？</p>
                                {edgeToDelete && (
                                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border">
                                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                            {edgeToDelete.sourceItem.title}
                                        </div>
                                        <div className="flex items-center justify-center my-2">
                                            <div className="text-gray-500 dark:text-gray-400">↓</div>
                                        </div>
                                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                            {edgeToDelete.targetItem.title}
                                        </div>
                                    </div>
                                )}
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    此操作无法撤销。
                                </p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={handleCancelDelete}>取消</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDelete}
                            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                        >
                            删除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

export function GlobalCitationGraph(props: CitationGraphProps) {
    return (
        <ReactFlowProvider>
            <CitationGraph {...props} />
        </ReactFlowProvider>
    )
} 