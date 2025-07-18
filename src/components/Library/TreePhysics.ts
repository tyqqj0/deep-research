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
import { getPhysicsParamsForZoom, ZoomLevel } from './TreeVisualizationConfig';

// 树形物理引擎配置
export const TREE_PHYSICS_CONFIG = {
  // 基础物理参数
  BASE: {
    LINK_DISTANCE: 100,        // 父子节点间距离（从150减小到100）
    LINK_STRENGTH: 0.8,        // 连接强度（树形结构需要更强的连接）
    CHARGE_STRENGTH: -400,     // 节点排斥力
    COLLISION_RADIUS: 200,     // 节点碰撞半径（从400减小到200）
    LAYER_SEPARATION: 300,     // 层间垂直距离（从500减小到300）
    SIBLING_SPACING: 120,      // 同层节点间距（从180减小到120）
  },

  // 层级约束参数
  CONSTRAINTS: {
    VERTICAL_STRENGTH: 0.9,   // 垂直层级约束强度（进一步降低到0.15，更贴合层高度）
    HORIZONTAL_STRENGTH: 0.25, // 水平分布约束强度（增加到0.25，避免同层重叠）
    ROOT_ANCHOR_STRENGTH: 0.2, // 根节点锚定强度（保持不变）
  },

  // 动画参数
  ANIMATION: {
    ALPHA_TARGET: 0.1,        // 降低目标alpha，让模拟持续更久
    ALPHA_MIN: 0.005,         // 提高最小alpha，保持活跃状态
    ALPHA_DECAY: 0.01,        // 降低衰减率，延长模拟时间
    VELOCITY_DECAY: 0.3,      // 降低速度衰减，保持动态效果
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
  private currentZoomLevel: ZoomLevel = 'detailed';

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
   * 计算节点的目标位置（支持动态层高度）
   */
  private calculateTargetPositions(nodes: NodeWithLayer[]): Map<string, { x: number; y: number }> {
    const positions = new Map<string, { x: number; y: number }>();

    // 根据当前缩放级别获取物理参数
    const physicsParams = getPhysicsParamsForZoom(this.currentZoomLevel);

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
      const y = startY + layer * physicsParams.LAYER_SEPARATION;
      const nodeCount = layerNodes.length;

      if (nodeCount === 1) {
        // 单个节点居中
        positions.set(layerNodes[0].id, { x: centerX, y });
      } else {
        // 多个节点均匀分布
        const totalWidth = (nodeCount - 1) * physicsParams.SIBLING_SPACING;
        const startX = centerX - totalWidth / 2;

        layerNodes.forEach((node, index) => {
          const x = startX + index * physicsParams.SIBLING_SPACING;
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
   * 计算节点的目标高度（基于层级）
   */
  private calculateTargetHeight(layer: number): number {
    const physicsParams = getPhysicsParamsForZoom(this.currentZoomLevel);
    const startY = 100; // 根节点起始Y位置
    return startY + layer * physicsParams.LAYER_SEPARATION;
  }

  /**
   * 创建简单的层级高度吸引力
   * 每个节点被其计划高度吸引：层数 * 高度系数（根据缩放状态判断）
   */
  private createLayerHeightAttraction(nodes: NodeWithLayer[]): d3.Force<any, any> {
    const { CONSTRAINTS } = TREE_PHYSICS_CONFIG;

    return (alpha: number) => {
      const simulation = this.simulation;
      if (!simulation) return;

      simulation.nodes().forEach((node: any) => {
        // 跳过正在被拖拽的节点（固定的节点）
        if (node.fx !== null && node.fx !== undefined) {
          // 节点被固定，跳过物理计算
          return;
        }

        // 获取节点层级
        const nodeData = nodes.find(n => n.id === node.id);
        const layer = nodeData?.layer || 0;

        // 计算目标高度
        const targetY = this.calculateTargetHeight(layer);

        // 计算当前位置与目标高度的差距
        const deltaY = targetY - node.y;
        const distance = Math.abs(deltaY);

        // 更强的层高度吸引力：增加倍数以更好地贴合层高度
        let attractionStrength = CONSTRAINTS.VERTICAL_STRENGTH * 3.0; // 增加到3倍，更强的层高度吸引

        // 距离很近时仍保持一定吸引力，确保贴合
        if (distance < 60) {
          attractionStrength *= Math.max(0.3, distance / 60); // 最小保持30%的吸引力
        }

        // 添加智能阻尼：如果节点正在向目标移动，减少反向速度
        const velocityTowardsTarget = (deltaY > 0 ? 1 : -1) * node.vy;
        if (velocityTowardsTarget < 0) {
          // 节点正在远离目标，增强吸引力
          attractionStrength *= 1.5;
        } else if (velocityTowardsTarget > Math.abs(deltaY) * 0.08) { // 调整阻尼敏感度
          // 节点速度过快，添加阻尼
          attractionStrength *= 0.4;
          node.vy *= 0.8; // 适度减速
        }

        const attraction = deltaY * attractionStrength * alpha;

        // 应用吸引力到节点的垂直速度
        node.vy += attraction;

        // 调试信息 - 增加输出频率以便观察
        if (Math.random() < 0.05) { // 5%概率输出调试信息
          console.log(`Layer attraction: node ${node.id}, layer ${layer}, targetY: ${targetY.toFixed(1)}, currentY: ${node.y.toFixed(1)}, distance: ${distance.toFixed(1)}, strength: ${attractionStrength.toFixed(2)}, attraction: ${attraction.toFixed(3)}, vy: ${node.vy.toFixed(3)}, fixed: ${node.fx !== null}`);
        }
      });
    };
  }

  /**
   * 创建垂直层级约束力（保留原有功能作为备用）
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
   * 创建纯垂直层级约束力 - 只影响Y轴
   */
  private createPureVerticalLayerForce(_nodes: NodeWithLayer[]): d3.Force<any, any> {
    const { CONSTRAINTS } = TREE_PHYSICS_CONFIG;

    return d3.forceY((d: any) => {
      const targetY = this.calculateTargetHeight(d.layer || 0);
      return targetY;
    }).strength(CONSTRAINTS.VERTICAL_STRENGTH);
  }

  /**
   * 创建水平连接力 - 只影响X轴的父子关系
   */
  private createHorizontalLinkForce(edges: any[]): d3.Force<any, any> {
    return d3.forceLink(edges)
      .id((d: any) => d.id)
      .distance(0) // 不强制距离，只影响水平关系
      .strength((link: any) => {
        // 只在X轴上施加很小的连接力
        return 0.1;
      });
  }

  /**
   * 创建水平居中力 - 确保整体水平居中
   */
  private createHorizontalCenterForce(_nodes: NodeWithLayer[]): d3.Force<any, any> {
    const centerX = this.containerWidth / 2;

    return d3.forceX(centerX).strength(0.05); // 很弱的居中力
  }

  /**
   * 创建纯水平碰撞检测 - 只在X轴上避让，不干扰Y轴层级
   */
  private createHorizontalCollisionForce(): d3.Force<any, any> {
    const radius = this.currentZoomLevel === 'simplified' ? 35 : 100; // 缩小模式从25适度增加到35

    return (alpha: number) => {
      const simulation = this.simulation;
      if (!simulation) return;

      const nodes = simulation.nodes();

      // 只处理水平方向的碰撞检测
      for (let i = 0; i < nodes.length; i++) {
        const nodeA = nodes[i];
        if (nodeA.fx !== null && nodeA.fx !== undefined) continue; // 跳过固定节点

        for (let j = i + 1; j < nodes.length; j++) {
          const nodeB = nodes[j];
          if (nodeB.fx !== null && nodeB.fx !== undefined) continue; // 跳过固定节点

          const dx = nodeB.x - nodeA.x;
          const distance = Math.abs(dx);
          const minDistance = radius * 2;

          // 只在水平方向上检测碰撞
          if (distance < minDistance && distance > 0) {
            const force = (minDistance - distance) / distance * alpha * 0.5;
            const fx = dx * force;

            // 只影响X轴速度，不影响Y轴
            nodeA.vx -= fx;
            nodeB.vx += fx;
          }
        }
      }
    };
  }

  /**
   * 启动树形物理模拟
   */
  start(nodes: Node[], edges: Edge[]): d3.Simulation<any, any> {
    this.stop();

    if (nodes.length === 0) {
      throw new Error('Cannot start tree physics simulation with empty nodes');
    }

    // 创建节点副本，避免直接修改原始数据
    const simulationNodes = JSON.parse(JSON.stringify(nodes));
    const simulationEdges = JSON.parse(JSON.stringify(edges));

    const nodesWithLayer = this.calculateNodeLayers(simulationNodes, simulationEdges);
    const { ANIMATION } = TREE_PHYSICS_CONFIG;

    // 设置初始位置
    const targetPositions = this.calculateTargetPositions(nodesWithLayer);

    nodesWithLayer.forEach((node: any) => {
      const target = targetPositions.get(node.id);
      if (target) {
        // 设置初始位置，如果节点没有位置或位置为(0,0)
        if (!node.position || (node.position.x === 0 && node.position.y === 0)) {
          node.x = target.x;
          node.y = target.y;
        } else {
          // 使用现有位置
          node.x = node.position.x;
          node.y = node.position.y;
        }
      }
    });

    this.simulation = d3.forceSimulation(nodesWithLayer as any)
      // === 垂直力系统：纯层级约束 ===
      // 层级高度约束：纯垂直力，确保节点在正确的层级高度
      .force('layerY', this.createPureVerticalLayerForce(nodesWithLayer))

      // === 水平力系统：纯节点关系约束 ===
      // 连接力：只影响水平位置，保持父子节点水平关系
      .force('linkX', this.createHorizontalLinkForce(simulationEdges as any))
      // 水平分布：同层节点水平分布
      .force('centerX', this.createHorizontalCenterForce(nodesWithLayer))
      // 纯水平碰撞检测：只在X轴上避让，不干扰Y轴层级
      .force('horizontalCollision', this.createHorizontalCollisionForce())

      // === 辅助力系统 ===
      // 轻微的排斥力：防止节点完全重叠
      .force('charge', d3.forceManyBody()
        .strength(-200) // 减小排斥力，避免干扰层级约束
      )

      // 动画参数
      .alpha(1)
      .alphaDecay(ANIMATION.ALPHA_DECAY)
      .velocityDecay(ANIMATION.VELOCITY_DECAY)
      .on('tick', this.onTick);

    // 启动调试信息
    const physicsParams = getPhysicsParamsForZoom(this.currentZoomLevel);
    console.log(`🌳 TreePhysics STARTED - Mode: ${this.currentZoomLevel.toUpperCase()}`);
    console.log(`📐 Layer separation: ${physicsParams.LAYER_SEPARATION}px | Sibling spacing: ${physicsParams.SIBLING_SPACING}px`);

    // 存储到全局以便调试
    (window as any).tree_simulation = this.simulation;
    (window as any).tree_physics = this; // 存储物理引擎实例

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

      // 更新水平居中力
      this.simulation.force('centerX', d3.forceX(centerX).strength(0.05));

      console.log(`📐 Container size updated: ${width}x${height}, centerX: ${centerX}`);
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

  /**
   * 更新缩放级别并调整物理参数
   */
  updateZoomLevel(zoomLevel: ZoomLevel): void {
    if (this.currentZoomLevel === zoomLevel) return;

    this.currentZoomLevel = zoomLevel;

    // 如果模拟正在运行，更新物理参数
    if (this.simulation) {
      const physicsParams = getPhysicsParamsForZoom(zoomLevel);
      console.log(`🔄 ZOOM CHANGE: ${this.currentZoomLevel} → ${zoomLevel}`);
      console.log(`📐 NEW PARAMS: Layer=${physicsParams.LAYER_SEPARATION}px, Sibling=${physicsParams.SIBLING_SPACING}px`);

      // 重新创建纯水平碰撞检测力（半径会根据缩放级别调整）
      this.simulation.force('horizontalCollision', this.createHorizontalCollisionForce());

      // 更新水平居中力
      const centerX = this.containerWidth / 2;
      this.simulation.force('centerX', d3.forceX(centerX).strength(0.05));

      // 重新计算层级高度（会根据缩放级别使用不同的层间距）
      const nodes = this.simulation.nodes();
      if (nodes.length > 0) {
        // 重新创建垂直层级约束力，这会使用新的缩放级别计算目标高度
        this.simulation.force('layerY', this.createPureVerticalLayerForce(nodes as any));

        // 输出节点目标位置变化
        console.log(`🎯 Sample node target heights:`);
        for (let i = 0; i < Math.min(3, nodes.length); i++) {
          const node = nodes[i];
          const layer = node.layer || 0;
          const targetY = this.calculateTargetHeight(layer);
          console.log(`  Node ${node.id}: Layer ${layer} → Y=${targetY}px`);
        }
      }

      // 重启模拟以应用新参数
      this.simulation.alpha(0.8).restart();
    }
  }
}
