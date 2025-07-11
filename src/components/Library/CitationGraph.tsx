"use client";

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import ReactFlow, {
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    Edge,
    Node,
    NodeTypes,
    MarkerType,
    Position,
    Handle,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Users,
    Calendar,
    ExternalLink,
    Maximize2,
    Network,
    RefreshCw
} from "lucide-react";
import { LibraryItem } from '@/libs/db';
import { libraryService } from '@/libs/db/LibraryService';
import { useLibraryStore } from '@/store/libraryStore';

interface GlobalCitationGraphProps {
    onNodeClick: (itemId: string) => void;
    className?: string;
}

interface LiteratureNodeData {
    item: LibraryItem;
    onNodeClick: (itemId: string) => void;
}

// 简化的布局函数 - 使用固定位置布局
const calculateLayout = (nodes: Node[], edges: Edge[]) => {
    if (nodes.length === 0) return { nodes, edges };

    // 固定位置，方便调试
    const positions = [
        { x: 200, y: 200 },
        { x: 600, y: 200 },
        { x: 400, y: 400 },
        { x: 200, y: 400 },
        { x: 600, y: 400 }
    ];

    const layoutedNodes = nodes.map((node, index) => {
        const position = positions[index % positions.length];

        return {
            ...node,
            position,
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
        };
    });

    return { nodes: layoutedNodes, edges };
};

// 自定义节点组件
const LiteratureNode = React.memo(({ data }: { data: LiteratureNodeData }) => {
    const { item, onNodeClick } = data;

    return (
        <div
            onClick={() => onNodeClick(item.id)}
            className="rounded-lg p-3 cursor-pointer transition-all duration-200 hover:scale-105 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 border-2 border-blue-200 dark:border-blue-600 shadow-md hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-400 relative"
            style={{ width: 220, height: 80 }}
        >
            {/* 连接点 - 这是关键！ */}
            <Handle
                type="target"
                position={Position.Left}
                style={{ background: '#3b82f6', width: 8, height: 8 }}
            />
            <Handle
                type="source"
                position={Position.Right}
                style={{ background: '#3b82f6', width: 8, height: 8 }}
            />

            <h3 className="font-semibold text-xs leading-tight mb-1 truncate text-blue-900 dark:text-blue-100">
                {item.title}
            </h3>

            <div className="space-y-1 text-blue-700 dark:text-blue-300 text-[10px]">
                <div className="flex items-center gap-1 truncate">
                    <Users className="h-3 w-3 flex-shrink-0" />
                    <span>{item.authors.slice(0, 1).join(', ')}{item.authors.length > 1 ? ' et al.' : ''}</span>
                </div>
                <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 flex-shrink-0" />
                    <span>{item.year}</span>
                </div>
            </div>
        </div>
    );
});

LiteratureNode.displayName = 'LiteratureNode';

const nodeTypes: NodeTypes = {
    literature: LiteratureNode,
};

export function GlobalCitationGraph({ onNodeClick, className }: GlobalCitationGraphProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const { items: allItems, isLoading: isItemsLoading, initialize } = useLibraryStore();
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [isLayouting, setIsLayouting] = useState(true);
    const [isStoreInitialized, setIsStoreInitialized] = useState(false);

    // 确保 store 已初始化
    useEffect(() => {
        const initializeStore = async () => {
            try {
                await initialize();
                setIsStoreInitialized(true);
            } catch (error) {
                console.error('[Graph] Failed to initialize store:', error);
            }
        };

        if (!isStoreInitialized) {
            initializeStore();
        }
    }, [initialize, isStoreInitialized]);

    const fetchDataAndLayout = useCallback(async () => {
        if (!isStoreInitialized) {
            return;
        }

        // 如果还在加载或没有数据，尝试直接从服务层获取
        let itemsToUse = allItems;
        if (!isItemsLoading && allItems.length === 0) {
            try {
                itemsToUse = await libraryService.getAllLibraryItems();
            } catch (error) {
                console.error('[Graph] Failed to fetch items directly:', error);
                setIsLayouting(false);
                return;
            }
        }

        if (itemsToUse.length === 0) {
            setIsLayouting(false);
            return;
        }

        setIsLayouting(true);

        try {
            // 获取所有引文链接
            const allCitations = await libraryService.getAllCitations();

            // 创建节点
            const literatureNodes: Node[] = itemsToUse.map(item => ({
                id: item.id,
                type: 'literature',
                position: { x: 0, y: 0 },
                data: { item, onNodeClick },
            }));

            // 创建边 - 只包含存在于节点中的链接，排除自引用
            const nodeIds = new Set(itemsToUse.map(item => item.id));
            const validCitations = allCitations.filter(link =>
                nodeIds.has(link.source) &&
                nodeIds.has(link.target) &&
                link.source !== link.target
            );

            const literatureEdges: Edge[] = validCitations.map((link, index) => ({
                id: `${link.source}-${link.target}`,
                source: link.source,
                target: link.target,
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#3b82f6', strokeWidth: 2 },
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: '#3b82f6',
                    width: 20,
                    height: 20
                },
                label: '引用',
                labelStyle: {
                    fontSize: 12,
                    fontWeight: 'bold',
                    fill: '#3b82f6',
                    background: 'white',
                    padding: '2px 4px',
                    borderRadius: '4px',
                },
            }));

            // 应用布局
            const { nodes: layoutedNodes, edges: layoutedEdges } = calculateLayout(
                literatureNodes,
                literatureEdges
            );

            setNodes(layoutedNodes);
            setEdges(layoutedEdges);
        } catch (error) {
            console.error("[Graph] Failed to fetch or layout graph data:", error);
        } finally {
            setIsLayouting(false);
        }
    }, [allItems, isItemsLoading, onNodeClick, setNodes, setEdges, isStoreInitialized]);

    // 当 store 初始化完成或文献数据变化时，重新获取数据
    useEffect(() => {
        if (isStoreInitialized) {
            fetchDataAndLayout();
        }
    }, [isStoreInitialized, fetchDataAndLayout]);

    if (isItemsLoading || !isStoreInitialized) {
        return (
            <Card className={className}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Network className="h-5 w-5" />
                        全局知识图谱
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center h-48">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={className}>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Network className="h-5 w-5" />
                        全局知识图谱
                    </CardTitle>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={fetchDataAndLayout}
                            disabled={isLayouting}
                        >
                            {isLayouting ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                                <RefreshCw className="h-4 w-4" />
                            )}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsExpanded(!isExpanded)}
                        >
                            <Maximize2 className="h-4 w-4 mr-1" />
                            {isExpanded ? '收起' : '展开'}
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className={`transition-all duration-300 relative ${isExpanded ? 'h-[80vh]' : 'h-[400px]'}`}>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        nodeTypes={nodeTypes}
                        fitView={false}
                        fitViewOptions={{ padding: 50 }}
                        minZoom={0.5}
                        maxZoom={2}
                        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
                        proOptions={{ hideAttribution: true }}
                    >
                        <Controls showInteractive={false} />
                        <MiniMap
                            nodeColor="#3b82f6"
                            maskColor="rgba(0, 0, 0, 0.2)"
                        />
                        <Background variant="dots" gap={16} size={1} />
                    </ReactFlow>
                    {isLayouting && (
                        <div className="absolute inset-0 bg-white/50 dark:bg-black/50 flex items-center justify-center z-10">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                                <p className="text-sm font-medium">正在计算布局...</p>
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
} 