import * as d3 from 'd3-force';
import { Node, Edge } from 'reactflow';

// 物理引擎配置常量
export const PHYSICS_CONFIG = {
    // 基础物理参数
    BASE: {
        LINK_DISTANCE: 180, // 节点连接距离
        LINK_STRENGTH: 0.7, // 节点连接强度
        CHARGE_STRENGTH: -600, // 节点排斥力（增加排斥力防止独立节点过近）
        COLLISION_RADIUS: 120, // 节点碰撞半径（适中的碰撞半径）
        CENTER_X: 400, // 中心点X坐标
        CENTER_Y: 300, // 中心点Y坐标       
        CONSTRAINT_STRENGTH: 0.08, // 约束力强度（稍微减弱约束）
    },

    // 详细模式（放大状态）参数
    DETAILED: {
        CHARGE_STRENGTH: -800, // 增加排斥力防止卡片重叠
        COLLISION_RADIUS: 140, // 增加碰撞半径，考虑卡片大小（256px宽 + 边距）
        LINK_DISTANCE: 280, // 增加连接距离，给卡片更多空间
        LINK_STRENGTH: 0.6,
    },

    // 简化模式（缩小状态）参数
    SIMPLIFIED: {
        CHARGE_STRENGTH: -450, // 适中的排斥力，防止小圆点过近
        COLLISION_RADIUS: 50, // 小圆点的碰撞半径（40px直径 + 边距）
        LINK_DISTANCE: 120,
        LINK_STRENGTH: 0.8,
    },

    // 缩放阈值
    ZOOM_THRESHOLD: 0.7,

    // 动画参数
    ANIMATION: {
        ALPHA_TARGET: 0.3,
        ALPHA_MIN: 0.001,
        ALPHA_DECAY: 0.0228,
        VELOCITY_DECAY: 0.4,
    }
};

// 物理引擎工具类
export class CitationGraphPhysics {
    private simulation: d3.Simulation<any, any> | null = null;
    private onTick: () => void;

    constructor(onTick: () => void) {
        this.onTick = onTick;
    }

    /**
     * 创建并启动物理模拟
     */
    start(nodes: Node[], edges: Edge[]): d3.Simulation<any, any> {
        this.stop();

        if (nodes.length === 0) {
            throw new Error('Cannot start physics simulation with empty nodes');
        }

        const { BASE } = PHYSICS_CONFIG;

        this.simulation = d3.forceSimulation(nodes as any)
            .force('link', d3.forceLink(JSON.parse(JSON.stringify(edges)) as any)
                .id((d) => (d as Node).id)
                .distance(BASE.LINK_DISTANCE)
                .strength(BASE.LINK_STRENGTH)
            )
            .force('charge', d3.forceManyBody().strength(BASE.CHARGE_STRENGTH))
            .force('center', d3.forceCenter(BASE.CENTER_X, BASE.CENTER_Y))
            .force('collision', d3.forceCollide().radius(BASE.COLLISION_RADIUS))
            .force('x', d3.forceX(BASE.CENTER_X).strength(BASE.CONSTRAINT_STRENGTH))
            .force('y', d3.forceY(BASE.CENTER_Y).strength(BASE.CONSTRAINT_STRENGTH))
            .alpha(1)
            .alphaDecay(PHYSICS_CONFIG.ANIMATION.ALPHA_DECAY)
            .velocityDecay(PHYSICS_CONFIG.ANIMATION.VELOCITY_DECAY)
            .on('tick', this.onTick);

        // 存储到全局以便其他组件访问
        (window as any).d3_simulation = this.simulation;

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
        delete (window as any).d3_simulation;
    }

    /**
     * 更新物理参数（用于缩放级别变化）
     */
    updateForDetailLevel(level: 'detailed' | 'simplified'): void {
        if (!this.simulation) return;

        const config = level === 'detailed' ? PHYSICS_CONFIG.DETAILED : PHYSICS_CONFIG.SIMPLIFIED;

        this.simulation
            .force('charge', d3.forceManyBody().strength(config.CHARGE_STRENGTH))
            .force('collision', d3.forceCollide().radius(config.COLLISION_RADIUS));

        // 更新连接力
        const linkForce = this.simulation.force('link') as d3.ForceLink<any, any>;
        if (linkForce) {
            linkForce.distance(config.LINK_DISTANCE).strength(config.LINK_STRENGTH);
        }

        this.simulation.alpha(PHYSICS_CONFIG.ANIMATION.ALPHA_TARGET).restart();
    }

    /**
     * 固定节点位置（拖拽开始时）
     */
    fixNode(nodeId: string, x: number, y: number): void {
        if (!this.simulation) return;

        const simNode = this.simulation.nodes().find(n => (n as Node).id === nodeId);
        if (simNode) {
            (simNode as any).fx = x;
            (simNode as any).fy = y;
            this.simulation.alphaTarget(PHYSICS_CONFIG.ANIMATION.ALPHA_TARGET).restart();
        }
    }

    /**
     * 释放节点位置（拖拽结束时）
     */
    releaseNode(nodeId: string): void {
        if (!this.simulation) return;

        const simNode = this.simulation.nodes().find(n => (n as Node).id === nodeId);
        if (simNode) {
            (simNode as any).fx = null;
            (simNode as any).fy = null;
        }
        this.simulation.alphaTarget(0);
    }

    /**
     * 获取当前模拟实例
     */
    getSimulation(): d3.Simulation<any, any> | null {
        return this.simulation;
    }

    /**
     * 重新启动模拟（用于添加新节点/边后）
     */
    restart(alpha: number = PHYSICS_CONFIG.ANIMATION.ALPHA_TARGET): void {
        if (this.simulation) {
            this.simulation.alpha(alpha).restart();
        }
    }
}

// 导出配置常量供其他组件使用
export const ZOOM_THRESHOLD = PHYSICS_CONFIG.ZOOM_THRESHOLD; 