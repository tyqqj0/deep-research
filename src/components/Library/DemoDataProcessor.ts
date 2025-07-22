/**
 * 演示数据处理器
 * 将JSON文件数据转换为树结构，并处理文献库数据
 */

import { LiteratureItem } from '../../libs/db';
import { MCTSNode } from '../../libs/db';

// JSON文件中的节点结构
interface JsonNode {
  id: string;
  visits: number;
  value: number;
  average_value: number;
  children_ids: string[];
  type: string;
  author: string;
  year: string;
  citations: number;
  abstract: string;
  size: number;
  year_int: number;
  title: string;
}

// JSON文件中的边结构
interface JsonEdge {
  source: string;
  target: string;
  visits: number;
  relation_type: string;
  tvc_relation: string;
  relation_score: number;
  relation: string;
  relation_description: string;
}

// JSON文件结构
interface JsonData {
  nodes: JsonNode[];
  edges: JsonEdge[];
}

// 演示树构建步骤
export interface DemoStep {
  type: 'node' | 'edge';
  nodeId?: string;
  edgeId?: string;
  sourceId?: string;
  targetId?: string;
  delay: number; // 延迟时间（毫秒）
}

export class DemoDataProcessor {
  private jsonData: JsonData | null = null;
  private literatureMap: Map<string, LiteratureItem> = new Map(); // JSON ID -> LiteratureItem
  private mctsNodeMap: Map<string, MCTSNode> = new Map(); // MCTS Node ID -> MCTSNode
  private jsonToMctsNodeMap: Map<string, MCTSNode> = new Map(); // JSON ID -> MCTSNode
  private jsonToLiteratureMap: Map<string, string> = new Map(); // JSON ID -> Literature ID

  /**
   * 加载JSON数据
   */
  async loadJsonData(): Promise<void> {
    try {
      const response = await fetch('/selected_paths_merged_output_with_relations.json');
      this.jsonData = await response.json();
      console.log(`📚 Loaded ${this.jsonData?.nodes.length} nodes and ${this.jsonData?.edges.length} edges`);
    } catch (error) {
      console.error('Failed to load JSON data:', error);
      throw error;
    }
  }

  /**
   * 将JSON节点转换为LiteratureItem
   */
  private convertToLiteratureItem(jsonNode: JsonNode): LiteratureItem {
    return {
      id: this.generateUUID(),
      title: jsonNode.title,
      authors: [jsonNode.author],
      year: jsonNode.year_int,
      source: 'import' as const,
      abstract: jsonNode.abstract,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * 将JSON节点转换为MCTSNode
   */
  private convertToMCTSNode(jsonNode: JsonNode, literatureItem: LiteratureItem): MCTSNode {
    return {
      id: this.generateUUID(),
      parentId: null, // 稍后填充
      libraryItemId: literatureItem.id,
      visits: jsonNode.visits,
      wins: jsonNode.value, // 使用value作为wins
    };
  }

  /**
   * 构建树结构
   */
  private buildTreeStructure(): { rootNode: MCTSNode; allNodes: MCTSNode[] } {
    if (!this.jsonData) {
      throw new Error('JSON data not loaded');
    }

    // 创建所有节点
    const allNodes: MCTSNode[] = [];

    for (const jsonNode of this.jsonData.nodes) {
      const literatureItem = this.convertToLiteratureItem(jsonNode);
      const mctsNode = this.convertToMCTSNode(jsonNode, literatureItem);

      // 建立映射关系
      this.literatureMap.set(jsonNode.id, literatureItem); // JSON ID -> LiteratureItem
      this.mctsNodeMap.set(mctsNode.id, mctsNode); // MCTS Node ID -> MCTSNode
      this.jsonToMctsNodeMap.set(jsonNode.id, mctsNode); // JSON ID -> MCTSNode (关键映射！)
      this.jsonToLiteratureMap.set(jsonNode.id, literatureItem.id); // JSON ID -> Literature ID

      allNodes.push(mctsNode);
    }

    // 建立父子关系
    console.log(`🔗 Building parent-child relationships...`);
    for (const jsonNode of this.jsonData.nodes) {
      const parentNode = this.jsonToMctsNodeMap.get(jsonNode.id); // 使用正确的映射
      if (!parentNode) {
        console.warn(`⚠️ Parent node not found for JSON ID: ${jsonNode.id}`);
        continue;
      }

      console.log(`👨‍👧‍👦 Processing parent: ${jsonNode.id} with ${jsonNode.children_ids.length} children`);

      for (const childId of jsonNode.children_ids) {
        const childNode = this.jsonToMctsNodeMap.get(childId); // 使用正确的映射
        if (childNode) {
          childNode.parentId = parentNode.id;
          console.log(`  ✅ Set parent for ${childId} -> ${parentNode.id}`);
        } else {
          console.warn(`  ⚠️ Child node not found for JSON ID: ${childId}`);
        }
      }
    }

    console.log(`✅ Parent-child relationships established`);

    // 调试：输出所有节点的父子关系
    console.log(`🔍 Final node relationships:`);
    allNodes.forEach(node => {
      console.log(`  Node ${node.id}: parentId=${node.parentId}, libraryItemId=${node.libraryItemId}`);
    });

    // 找到根节点（没有父节点的节点）
    const rootNodes = allNodes.filter(node => !node.parentId);
    const rootNode = rootNodes[0] || allNodes[0]; // 使用第一个根节点或第一个节点

    return { rootNode, allNodes };
  }



  /**
   * 计算节点深度
   */
  private calculateNodeDepth(nodeId: string, visited: Set<string> = new Set()): number {
    if (visited.has(nodeId)) return 0; // 避免循环引用
    visited.add(nodeId);

    const node = this.mctsNodeMap.get(nodeId);
    if (!node || !node.parentId) return 0;

    return 1 + this.calculateNodeDepth(node.parentId, visited);
  }

  /**
   * 生成演示步骤
   */
  generateDemoSteps(): DemoStep[] {
    if (!this.jsonData) {
      throw new Error('JSON data not loaded');
    }

    const steps: DemoStep[] = [];
    const { rootNode, allNodes } = this.buildTreeStructure();

    // 计算每个节点的深度并按深度分组
    const nodesByDepth = new Map<number, MCTSNode[]>();
    for (const node of allNodes) {
      const depth = this.calculateNodeDepth(node.id);
      if (!nodesByDepth.has(depth)) {
        nodesByDepth.set(depth, []);
      }
      nodesByDepth.get(depth)!.push(node);
    }

    // 生成节点添加步骤
    const sortedDepths = Array.from(nodesByDepth.keys()).sort((a, b) => a - b);

    for (const depth of sortedDepths) {
      const nodesAtDepth = nodesByDepth.get(depth)!;

      for (let i = 0; i < nodesAtDepth.length; i++) {
        const node = nodesAtDepth[i];
        steps.push({
          type: 'node',
          nodeId: node.id,
          delay: depth === 0 ? 1000 : 2000 + i * 500, // 根节点快一些，其他节点间隔500ms
        });

        // 如果有父节点，添加连接边
        if (node.parentId) {
          steps.push({
            type: 'edge',
            edgeId: `${node.parentId}-${node.id}`,
            sourceId: node.parentId,
            targetId: node.id,
            delay: 500, // 边在节点后500ms出现
          });
        }
      }
    }

    return steps;
  }

  /**
   * 获取文献数据
   */
  getLiteratureItems(): LiteratureItem[] {
    return Array.from(this.literatureMap.values());
  }

  /**
   * 获取MCTS节点数据
   */
  getMCTSNodes(): MCTSNode[] {
    return Array.from(this.mctsNodeMap.values());
  }

  /**
   * 获取根节点
   */
  getRootNode(): MCTSNode | null {
    const allNodes = this.getMCTSNodes();
    return allNodes.find(node => !node.parentId) || null;
  }

  /**
   * 根据JSON节点ID获取对应的文献ID
   */
  getLiteratureIdByJsonId(jsonId: string): string | null {
    return this.jsonToLiteratureMap.get(jsonId) || null;
  }

  /**
   * 获取根节点对应的文献ID
   */
  getRootLiteratureId(): string | null {
    if (!this.jsonData) return null;

    // 找到根节点（没有父节点的节点）
    const rootJsonNode = this.jsonData.nodes.find(node =>
      !this.jsonData!.nodes.some(otherNode =>
        otherNode.children_ids.includes(node.id)
      )
    );

    if (!rootJsonNode) return null;

    return this.getLiteratureIdByJsonId(rootJsonNode.id);
  }

  /**
   * 更新现有文献的映射关系
   */
  updateExistingLiteratureMapping(titleToIdMap: Map<string, string>): void {
    if (!this.jsonData) return;

    // 遍历JSON节点，更新映射关系
    for (const jsonNode of this.jsonData.nodes) {
      const existingLiteratureId = titleToIdMap.get(jsonNode.id);
      if (existingLiteratureId) {
        // 更新JSON ID到文献ID的映射
        this.jsonToLiteratureMap.set(jsonNode.id, existingLiteratureId);
        console.log(`🔗 Mapped JSON node "${jsonNode.id}" to existing literature ${existingLiteratureId}`);
      }
    }

    console.log(`✅ Updated mappings for ${titleToIdMap.size} existing literature items`);
  }

  /**
   * 生成UUID
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

// 导出单例实例
export const demoDataProcessor = new DemoDataProcessor();
