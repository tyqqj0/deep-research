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
    useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
    Users,
    Calendar,
    Maximize2,
    Network,
    RefreshCw,
    Zap,
    ZapOff
} from "lucide-react";
import { LibraryItem } from '@/libs/db';
import { libraryService } from '@/libs/db/LibraryService';
import { useLibraryStore } from '@/store/libraryStore';
import * as d3 from 'd3-force';


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
                                className='w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-mono cursor-pointer bg-gradient-to-br from-blue-400 to-indigo-500 shadow-lg'
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
    const { setNodes, getNodes } = useReactFlow();
    const lastKnownLevel = useRef<'detailed' | 'simplified'>('detailed');
    const ZOOM_THRESHOLD = 0.7;

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

            // Dynamically update physics based on detail level
            const simulation = (window as any).d3_simulation;
            if (simulation) {
                if (targetLevel === 'detailed') {
                    // Increase forces to prevent overlap of large nodes
                    simulation.force('charge', d3.forceManyBody().strength(-800));
                    simulation.force('collision', d3.forceCollide().radius(120));
                } else {
                    // Use weaker forces for smaller nodes
                    simulation.force('charge', d3.forceManyBody().strength(-400));
                    simulation.force('collision', d3.forceCollide().radius(60));
                }
                simulation.alpha(0.3).restart();
            }
        }
    }, [zoom, setNodes]);

    return null;
};


interface CitationGraphProps {
    onNodeClick: (itemId: string) => void;
    className?: string;
}

function CitationGraph({ onNodeClick, className }: CitationGraphProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const { items: allItems, isLoading: isItemsLoading, isInitialized: isStoreInitialized, initialize } = useLibraryStore();

    const [isExpanded, setIsExpanded] = useState(false);
    const [isLayouting, setIsLayouting] = useState(true);
    const [isPhysicsEnabled, setIsPhysicsEnabled] = useState(false);
    const simulationRef = useRef<d3.Simulation<any, any> | null>(null);

    useEffect(() => {
        if (!isStoreInitialized) {
            initialize();
        }
    }, [isStoreInitialized, initialize]);

    const stopPhysicsSimulation = useCallback(() => {
        simulationRef.current?.stop();
        simulationRef.current = null;
    }, []);

    const runPhysicsSimulation = useCallback((simNodes: Node[], simEdges: Edge[]) => {
        stopPhysicsSimulation();
        if (!isPhysicsEnabled || simNodes.length === 0) return;

        const simulation = d3.forceSimulation(simNodes as any)
            .force('link', d3.forceLink(JSON.parse(JSON.stringify(simEdges)) as any).id((d) => (d as Node).id).distance(150).strength(0.5)) // Pass a deep copy to prevent mutation
            .force('charge', d3.forceManyBody().strength(-400))
            .force('center', d3.forceCenter(400, 300))
            .force('collision', d3.forceCollide().radius(60))
            .on('tick', () => {
                setNodes(prevNodes => prevNodes.map(n => {
                    const simNode = simulation.nodes().find(sn => (sn as Node).id === n.id);
                    return simNode ? { ...n, position: { x: (simNode as any).x, y: (simNode as any).y } } : n;
                }));
            });
        simulationRef.current = simulation;
        (window as any).d3_simulation = simulation; // Store simulation instance globally for access
    }, [isPhysicsEnabled, setNodes, stopPhysicsSimulation]);

    const fetchDataAndLayout = useCallback(async () => {
        if (!isStoreInitialized) return;
        setIsLayouting(true);

        try {
            const items = await libraryService.getAllLibraryItems();
            if (items.length === 0) {
                setNodes([]);
                setEdges([]);
                return;
            }

            const citations = await libraryService.getAllCitations();
            const nodeIds = new Set(items.map(item => item.id));

            const graphNodes: Node<LiteratureNodeData>[] = items.map(item => ({
                id: item.id,
                type: 'adaptive',
                position: { x: 0, y: 0 },
                data: { item, label: item.title, onNodeClick, levelOfDetail: 'detailed' },
            }));

            const graphEdges: Edge[] = citations
                .filter(c => nodeIds.has(c.source) && nodeIds.has(c.target) && c.source !== c.target) // Prevent self-loops
                .map(c => ({
                    id: `${c.source}-${c.target}`,
                    source: c.source,
                    target: c.target,
                    type: 'default', // Use default bezier curve for better routing
                    animated: true,
                    markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
                }));

            const { nodes: staticNodes } = calculateStaticLayout(graphNodes, graphEdges);
            setNodes(staticNodes);
            setEdges(graphEdges);

            if (isPhysicsEnabled) {
                runPhysicsSimulation(staticNodes, graphEdges);
            }
        } catch (error) {
            console.error("[Graph] Failed to layout data:", error);
        } finally {
            setIsLayouting(false);
        }
    }, [isStoreInitialized, onNodeClick, setNodes, setEdges, isPhysicsEnabled, runPhysicsSimulation]);

    useEffect(() => {
        fetchDataAndLayout();
        return () => {
            stopPhysicsSimulation();
            delete (window as any).d3_simulation; // Clean up global instance on unmount
        }
    }, [fetchDataAndLayout, stopPhysicsSimulation]);

    const togglePhysics = useCallback(() => {
        setIsPhysicsEnabled(enabled => {
            const newIsEnabled = !enabled;
            if (newIsEnabled) {
                runPhysicsSimulation(nodes, edges);
            } else {
                stopPhysicsSimulation();
                fetchDataAndLayout(); // Recalculate static layout
            }
            return newIsEnabled;
        });
    }, [nodes, edges, runPhysicsSimulation, stopPhysicsSimulation, fetchDataAndLayout]);

    const onNodeDragStart = (event: React.MouseEvent, node: Node) => {
        if (!isPhysicsEnabled || !simulationRef.current) return;
        const simulation = simulationRef.current;

        const simNode = simulation.nodes().find(n => (n as Node).id === node.id);
        if (simNode) {
            (simNode as any).fx = node.position.x;
            (simNode as any).fy = node.position.y;
            simulation.alphaTarget(0.3).restart();
        }
    };

    const onNodeDrag = (event: React.MouseEvent, node: Node) => {
        if (!isPhysicsEnabled || !simulationRef.current) return;
        const simulation = simulationRef.current;

        const simNode = simulation.nodes().find(n => (n as Node).id === node.id);
        if (simNode) {
            (simNode as any).fx = node.position.x;
            (simNode as any).fy = node.position.y;
        }
    };

    const onNodeDragStop = (event: React.MouseEvent, node: Node) => {
        if (!isPhysicsEnabled || !simulationRef.current) return;
        const simulation = simulationRef.current;

        const simNode = simulation.nodes().find(n => (n as Node).id === node.id);
        if (simNode) {
            (simNode as any).fx = null;
            (simNode as any).fy = null;
        }
        simulation.alphaTarget(0);
    };


    if (isItemsLoading || !isStoreInitialized) {
        return (
            <Card className={className}>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Network className="h-5 w-5" />全局知识图谱</CardTitle></CardHeader>
                <CardContent><div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div></div></CardContent>
            </Card>
        );
    }

    return (
        <Card className={`${className} flex flex-col`}>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base"><Network className="h-5 w-5" />全局知识图谱</CardTitle>
                    <div className="flex gap-2">
                        <Button variant={isPhysicsEnabled ? "default" : "outline"} size="sm" onClick={togglePhysics} className="flex items-center gap-1">
                            {isPhysicsEnabled ? <Zap className="h-4 w-4" /> : <ZapOff className="h-4 w-4" />}
                            {isPhysicsEnabled ? '物理引擎' : '静态布局'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={fetchDataAndLayout} disabled={isLayouting}>
                            {isLayouting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setIsExpanded(!isExpanded)}>
                            <Maximize2 className="h-4 w-4 mr-1" />
                            {isExpanded ? '收起' : '展开'}
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0 flex-1">
                <div className={`transition-all duration-300 relative ${isExpanded ? 'h-[80vh]' : 'h-full'}`}>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        nodeTypes={nodeTypes}
                        fitView
                        nodesDraggable={true}
                        onNodeDragStart={onNodeDragStart}
                        onNodeDrag={onNodeDrag}
                        onNodeDragStop={onNodeDragStop}
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
                </div>
            </CardContent>
        </Card>
    );
}

export function GlobalCitationGraph(props: CitationGraphProps) {
    return (
        <ReactFlowProvider>
            <CitationGraph {...props} />
        </ReactFlowProvider>
    )
} 