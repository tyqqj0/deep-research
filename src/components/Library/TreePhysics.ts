/**
 * 🌳 TreePhysics - 树形结构物理引擎
 * 
 * 🎯 核心功能:
 * - 基于D3-Force的树形布局物理模拟
 * - 层级约束：同层节点水平对齐，不同层垂直分离
 * - 物理效果：节点间斥力、连接弹力、碰撞检测
 * - 自适应参数：根据树的深度和节点数量调整物理参数
 * 
 * 📐 与CitationGraph的区别:
 * - 树形结构有明确的层级关系
 * - 需要垂直层级约束和水平分布
 * - 根节点固定在顶部中心
 * - 子节点在父节点下方均匀分布
 */

import * as d3 from 'd3-force';
import { Node, Edge } from 'reactflow';
import { MCTSNode } from '@/libs/db';

// 树形物理引擎配置
export const TREE_PHYSICS_CONFIG = {
  // 基础物理参数
  BASE: {
    LINK_DISTANCE: 150,        // 父子节点间距离
    LINK_STRENGTH: 0.8,        // 连接强度（树形结构需要更强的连接）
    CHARGE_STRENGTH: -400,     // 节点排斥力
    COLLISION_RADIUS: 100,     // 节点碰撞半径
    LAYER_SEPARATION: 200,     // 层间垂直距离
    SIBLING_SPACING: 180,      // 同层节点间距
  },

  // 层级约束参数
  CONSTRAINTS: {
    VERTICAL_STRENGTH: 0.3,    // 垂直层级约束强度
    HORIZONTAL_STRENGTH: 0.1,  // 水平分布约束强度
    ROOT_ANCHOR_STRENGTH: 0.5, // 根节点锚定强度
  },

  // 动画参数
  ANIMATION: {
    ALPHA_TARGET: 0.3,
    ALPHA_MIN: 0.001,
    ALPHA_DECAY: 0.0228,
    VELOCITY_DECAY: 0.4,
  }
};

// 节点层级信息接口
interface NodeWithLayer extends Node {
  layer?: number;
  parentId?: string;
  siblingIndex?: number;
  siblingCount?: number;
}

export class TreePhysics {
  private simulation: d3.Simulation<any, any> | null = null;
  private onTick: () => void;
  private containerWidth: number;
  private containerHeight: number;

  constructor(onTick: () => void, containerWidth = 800, containerHeight = 600) {
    this.onTick = onTick;
    this.containerWidth = containerWidth;
    this.containerHeight = containerHeight;
  }

  /**
   * 计算节点的层级信息
   */
  private calculateNodeLayers(nodes: Node[], edges: Edge[]): NodeWithLayer[] {
    const nodeMap = new Map<string, NodeWithLayer>();
    const layerMap = new Map<string, number>();
    
    // 初始化节点映射
    nodes.forEach(node => {
      const nodeWithLayer: NodeWithLayer = { ...node };
      nodeMap.set(node.id, nodeWithLayer);
    });

    // 构建父子关系映射
    const childrenMap = new Map<string, string[]>();
    const parentMap = new Map<string, string>();
    
    edges.forEach(edge => {
      const parentId = edge.source as string;
      const childId = edge.target as string;
      
      if (!childrenMap.has(parentId)) {
        childrenMap.set(parentId, []);
      }
      childrenMap.get(parentId)!.push(childId);
      parentMap.set(childId, parentId);
    });

    // 找到根节点（没有父节点的节点）
    const rootNodes = nodes.filter(node => !parentMap.has(node.id));
    
    // BFS计算层级
    const queue: { nodeId: string; layer: number }[] = [];
    rootNodes.forEach(root => {
      queue.push({ nodeId: root.id, layer: 0 });
      layerMap.set(root.id, 0);
    });

    while (queue.length > 0) {
      const { nodeId, layer } = queue.shift()!;
      const children = childrenMap.get(nodeId) || [];
      
      children.forEach(childId => {
        const childLayer = layer + 1;
        layerMap.set(childId, childLayer);
        queue.push({ nodeId: childId, layer: childLayer });
      });
    }

    // 计算同层节点的兄弟信息
    const layerNodes = new Map<number, string[]>();
    layerMap.forEach((layer, nodeId) => {
      if (!layerNodes.has(layer)) {
        layerNodes.set(layer, []);
      }
      layerNodes.get(layer)!.push(nodeId);
    });

    // 更新节点信息
    const result: NodeWithLayer[] = [];
    nodes.forEach(node => {
      const nodeWithLayer = nodeMap.get(node.id)!;
      const layer = layerMap.get(node.id) || 0;
      const siblings = layerNodes.get(layer) || [];
      
      nodeWithLayer.layer = layer;
      nodeWithLayer.parentId = parentMap.get(node.id);
      nodeWithLayer.siblingIndex = siblings.indexOf(node.id);
      nodeWithLayer.siblingCount = siblings.length;
      
      result.push(nodeWithLayer);
    });

    return result;
  }

  /**
   * 计算节点的目标位置
   */
  private calculateTargetPositions(nodes: NodeWithLayer[]): Map<string, { x: number; y: number }> {
    const positions = new Map<string, { x: number; y: number }>();
    const { BASE } = TREE_PHYSICS_CONFIG;
    
    const centerX = this.containerWidth / 2;
    const startY = 100; // 根节点起始Y位置

    // 按层级分组
    const layerGroups = new Map<number, NodeWithLayer[]>();
    nodes.forEach(node => {
      const layer = node.layer || 0;
      if (!layerGroups.has(layer)) {
        layerGroups.set(layer, []);
      }
      layerGroups.get(layer)!.push(node);
    });

    // 为每层计算位置
    layerGroups.forEach((layerNodes, layer) => {
      const y = startY + layer * BASE.LAYER_SEPARATION;
      const nodeCount = layerNodes.length;
      
      if (nodeCount === 1) {
        // 单个节点居中
        positions.set(layerNodes[0].id, { x: centerX, y });
      } else {
        // 多个节点均匀分布
        const totalWidth = (nodeCount - 1) * BASE.SIBLING_SPACING;
        const startX = centerX - totalWidth / 2;
        
        layerNodes.forEach((node, index) => {
          const x = startX + index * BASE.SIBLING_SPACING;
          positions.set(node.id, { x, y });
        });
      }
    });

    return positions;
  }

  /**
   * 创建层级约束力
   */
  private createLayerConstraints(nodes: NodeWithLayer[]): d3.Force<any, any> {
    const targetPositions = this.calculateTargetPositions(nodes);
    const { CONSTRAINTS } = TREE_PHYSICS_CONFIG;

    return d3.forceX((d: any) => {
      const target = targetPositions.get(d.id);
      return target ? target.x : this.containerWidth / 2;
    }).strength(CONSTRAINTS.HORIZONTAL_STRENGTH);
  }

  /**
   * 创建垂直层级约束力
   */
  private createVerticalConstraints(nodes: NodeWithLayer[]): d3.Force<any, any> {
    const targetPositions = this.calculateTargetPositions(nodes);
    const { CONSTRAINTS } = TREE_PHYSICS_CONFIG;

    return d3.forceY((d: any) => {
      const target = targetPositions.get(d.id);
      return target ? target.y : 100;
    }).strength(CONSTRAINTS.VERTICAL_STRENGTH);
  }

  /**
   * 启动树形物理模拟
   */
  start(nodes: Node[], edges: Edge[]): d3.Simulation<any, any> {
    this.stop();

    if (nodes.length === 0) {
      throw new Error('Cannot start tree physics simulation with empty nodes');
    }

    const nodesWithLayer = this.calculateNodeLayers(nodes, edges);
    const { BASE, ANIMATION } = TREE_PHYSICS_CONFIG;

    // 设置初始位置
    const targetPositions = this.calculateTargetPositions(nodesWithLayer);
    nodesWithLayer.forEach(node => {
      const target = targetPositions.get(node.id);
      if (target && (!node.position || (node.position.x === 0 && node.position.y === 0))) {
        node.position = { x: target.x, y: target.y };
      }
    });

    this.simulation = d3.forceSimulation(nodesWithLayer as any)
      // 连接力：保持父子节点连接
      .force('link', d3.forceLink(JSON.parse(JSON.stringify(edges)) as any)
        .id((d) => (d as Node).id)
        .distance(BASE.LINK_DISTANCE)
        .strength(BASE.LINK_STRENGTH)
      )
      // 排斥力：防止节点重叠
      .force('charge', d3.forceManyBody()
        .strength(BASE.CHARGE_STRENGTH)
      )
      // 碰撞检测：防止节点重叠
      .force('collision', d3.forceCollide()
        .radius(BASE.COLLISION_RADIUS)
        .strength(0.7)
      )
      // 水平约束：同层节点水平分布
      .force('x', this.createLayerConstraints(nodesWithLayer))
      // 垂直约束：不同层垂直分离
      .force('y', this.createVerticalConstraints(nodesWithLayer))
      // 动画参数
      .alpha(1)
      .alphaDecay(ANIMATION.ALPHA_DECAY)
      .velocityDecay(ANIMATION.VELOCITY_DECAY)
      .on('tick', this.onTick);

    // 存储到全局以便调试
    (window as any).tree_simulation = this.simulation;

    return this.simulation;
  }

  /**
   * 停止物理模拟
   */
  stop(): void {
    if (this.simulation) {
      this.simulation.stop();
      this.simulation = null;
    }
    delete (window as any).tree_simulation;
  }

  /**
   * 更新容器尺寸
   */
  updateContainerSize(width: number, height: number): void {
    this.containerWidth = width;
    this.containerHeight = height;
    
    if (this.simulation) {
      // 重新计算中心点
      const centerX = width / 2;
      const centerY = height / 2;
      
      // 更新约束力
      this.simulation.force('x', d3.forceX(centerX).strength(0.1));
    }
  }

  /**
   * 重新启动模拟（用于数据更新后）
   */
  restart(): void {
    if (this.simulation) {
      this.simulation.alpha(1).restart();
    }
  }

  /**
   * 获取当前模拟状态
   */
  getSimulation(): d3.Simulation<any, any> | null {
    return this.simulation;
  }
}
