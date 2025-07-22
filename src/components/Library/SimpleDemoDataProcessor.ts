/**
 * 简化的演示数据处理器
 * 方案A：基于TreeService的直接构建
 */

import { LiteratureItem } from '../../libs/db';

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

// 简化的构建步骤
export interface BuildStep {
  type: 'add-node';
  parentJsonId: string;
  childJsonId: string;
  delay: number;
  depth: number;
}

export class SimpleDemoDataProcessor {
  private jsonData: JsonData | null = null;
  private literatureMapping = new Map<string, string>(); // JSON ID → Literature ID
  private parentChildMap = new Map<string, string[]>(); // Parent JSON ID → Children JSON IDs
  private childParentMap = new Map<string, string>(); // Child JSON ID → Parent JSON ID

  /**
   * 加载JSON数据
   */
  async loadJsonData(): Promise<void> {
    try {
      const response = await fetch('/selected_paths_merged_output_with_relations.json');
      this.jsonData = await response.json();
      
      // 建立父子关系映射
      this.buildParentChildMaps();
      
      console.log(`📚 Loaded ${this.jsonData?.nodes.length} nodes and ${this.jsonData?.edges.length} edges`);
      console.log(`🔗 Built parent-child relationships`);
    } catch (error) {
      console.error('Failed to load JSON data:', error);
      throw error;
    }
  }

  /**
   * 建立父子关系映射 - 方案B：选择主要父节点
   */
  private buildParentChildMaps(): void {
    if (!this.jsonData) return;

    console.log(`🔗 Building parent-child maps from ${this.jsonData.nodes.length} nodes...`);

    // 临时存储：子节点 -> 所有可能的父节点
    const childToParentsMap = new Map<string, JsonNode[]>();

    // 第一步：收集所有父子关系
    for (const node of this.jsonData.nodes) {
      // 建立父→子映射
      this.parentChildMap.set(node.id, node.children_ids);

      // 收集子→父关系（可能有多个父节点）
      for (const childId of node.children_ids) {
        if (!childToParentsMap.has(childId)) {
          childToParentsMap.set(childId, []);
        }
        childToParentsMap.get(childId)!.push(node);
      }
    }

    // 第二步：为每个子节点选择主要父节点（年份最早的）
    console.log(`🎯 Resolving multi-parent conflicts...`);
    console.log(`📊 Total children with parents: ${childToParentsMap.size}`);

    let multiParentCount = 0;
    for (const [childId, parents] of childToParentsMap.entries()) {
      if (parents.length > 1) {
        multiParentCount++;
        // 多个父节点，选择年份最早的
        const primaryParent = parents.reduce((earliest, current) => {
          return current.year_int < earliest.year_int ? current : earliest;
        });

        console.log(`🔀 Multi-parent conflict #${multiParentCount} for "${childId}":`);
        console.log(`  📚 Candidates: ${parents.map(p => `${p.id} (${p.year_int})`).join(', ')}`);
        console.log(`  ✅ Selected: ${primaryParent.id} (${primaryParent.year_int}) - earliest year`);

        this.childParentMap.set(childId, primaryParent.id);
      } else {
        // 只有一个父节点
        this.childParentMap.set(childId, parents[0].id);
        // 只显示前几个单父节点的日志，避免太多
        if (this.childParentMap.size <= 5) {
          console.log(`  📎 ${childId} -> ${parents[0].id} (${parents[0].year_int})`);
        }
      }
    }

    console.log(`✅ Conflict resolution completed: ${multiParentCount} multi-parent conflicts resolved`);

    // 特别检查 "Long Short-Term Memory" 的父节点
    const lstmParent = this.childParentMap.get("Long Short-Term Memory");
    console.log(`🔍 "Long Short-Term Memory" parent: ${lstmParent}`);

    console.log(`🗺️ Parent-child mappings built:`, {
      parents: this.parentChildMap.size,
      children: this.childParentMap.size,
      multiParentConflicts: Array.from(childToParentsMap.values()).filter(parents => parents.length > 1).length
    });

    // 调试：找出根节点（没有父节点的节点）
    const allNodeIds = this.jsonData.nodes.map(n => n.id);
    const rootNodes = allNodeIds.filter(id => !this.childParentMap.has(id));
    console.log(`🌱 Root nodes found: ${rootNodes.length}`, rootNodes);
  }

  /**
   * 将JSON节点转换为LiteratureItem
   */
  private convertToLiteratureItem(jsonNode: JsonNode): Omit<LiteratureItem, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      title: jsonNode.title,
      authors: [jsonNode.author],
      year: jsonNode.year_int,
      source: 'import' as const,
      abstract: jsonNode.abstract,
    };
  }

  /**
   * 准备文献数据：转换并添加到文献库
   */
  async prepareLiterature(addLibraryItemFn: (item: any) => Promise<any>): Promise<void> {
    if (!this.jsonData) {
      throw new Error('JSON data not loaded');
    }

    console.log(`📚 Preparing ${this.jsonData.nodes.length} literature items...`);
    
    let addedCount = 0;
    let skippedCount = 0;

    for (const jsonNode of this.jsonData.nodes) {
      try {
        const literatureData = this.convertToLiteratureItem(jsonNode);
        const result = await addLibraryItemFn(literatureData);

        if (result.success) {
          // 建立映射关系
          this.literatureMapping.set(jsonNode.id, result.item.id);
          addedCount++;
          console.log(`✅ Added: ${jsonNode.title} -> ${result.item.id}`);
        } else {
          skippedCount++;
          console.log(`📋 Skipped: ${jsonNode.title}`);
        }
      } catch (error) {
        // 处理重复项错误，静默跳过但尝试建立映射
        if (error instanceof Error && error.message.includes('Duplicate item found')) {
          skippedCount++;
          console.log(`📋 Skipped (duplicate): ${jsonNode.title}`);

          // 重复项需要建立映射关系！
          // 从错误信息中提取或者直接查找现有文献
          // 这里我们先记录，稍后在updateExistingLiteratureMapping中处理
        } else {
          console.error(`❌ Failed to add: ${jsonNode.title}`, error);
        }
      }
    }

    console.log(`✅ Literature preparation completed:`);
    console.log(`  - Added: ${addedCount} new items`);
    console.log(`  - Skipped: ${skippedCount} duplicates`);
  }

  /**
   * 更新现有文献的映射关系
   */
  updateExistingLiteratureMapping(existingItems: LiteratureItem[]): void {
    if (!this.jsonData) {
      console.warn('⚠️ JSON data not loaded, cannot update mappings');
      return;
    }

    console.log(`🔄 Updating mappings for existing literature...`);
    console.log(`📊 Existing items: ${existingItems.length}, JSON nodes: ${this.jsonData.nodes.length}`);

    let mappedCount = 0;

    for (const jsonNode of this.jsonData.nodes) {
      // 如果已经有映射了，跳过
      if (this.literatureMapping.has(jsonNode.id)) {
        continue;
      }

      const existingItem = existingItems.find(item =>
        item.title.toLowerCase().trim() === jsonNode.title.toLowerCase().trim()
      );

      if (existingItem) {
        this.literatureMapping.set(jsonNode.id, existingItem.id);
        mappedCount++;
        console.log(`🔗 Mapped existing: ${jsonNode.title} -> ${existingItem.id}`);
      } else {
        console.log(`🔍 No match found for: ${jsonNode.title}`);
        // 显示前几个现有文献的标题作为参考
        if (mappedCount === 0 && existingItems.length > 0) {
          console.log(`📋 Sample existing titles:`, existingItems.slice(0, 3).map(item => item.title));
        }
      }
    }

    console.log(`✅ Updated mappings for ${mappedCount} items (total mappings: ${this.literatureMapping.size})`);
  }

  /**
   * 计算节点深度
   */
  private calculateNodeDepth(nodeId: string, visited = new Set<string>()): number {
    if (visited.has(nodeId)) return 0; // 避免循环引用
    visited.add(nodeId);

    const parentId = this.childParentMap.get(nodeId);
    if (!parentId) return 0; // 根节点

    return 1 + this.calculateNodeDepth(parentId, visited);
  }

  /**
   * 按深度分组节点
   */
  private groupNodesByDepth(): Map<number, JsonNode[]> {
    if (!this.jsonData) return new Map();

    const nodesByDepth = new Map<number, JsonNode[]>();

    for (const node of this.jsonData.nodes) {
      const depth = this.calculateNodeDepth(node.id);
      
      if (!nodesByDepth.has(depth)) {
        nodesByDepth.set(depth, []);
      }
      nodesByDepth.get(depth)!.push(node);
    }

    return nodesByDepth;
  }

  /**
   * 生成构建步骤
   */
  generateBuildSteps(): BuildStep[] {
    if (!this.jsonData) {
      throw new Error('JSON data not loaded');
    }

    const steps: BuildStep[] = [];
    const nodesByDepth = this.groupNodesByDepth();
    const sortedDepths = Array.from(nodesByDepth.keys()).sort((a, b) => a - b);

    console.log(`🏗️ Generating build steps for ${sortedDepths.length} depth levels...`);

    // 获取根节点ID用于验证
    const rootJsonId = this.getRootJsonId();
    console.log(`🌱 Root node for build steps: ${rootJsonId}`);

    for (const depth of sortedDepths) {
      if (depth === 0) continue; // 跳过根节点

      const nodesAtDepth = nodesByDepth.get(depth)!;
      console.log(`📐 Depth ${depth}: ${nodesAtDepth.length} nodes`);

      for (let i = 0; i < nodesAtDepth.length; i++) {
        const node = nodesAtDepth[i];
        const parentId = this.childParentMap.get(node.id);

        if (parentId) {
          // 验证第一层的父节点是否是根节点
          if (depth === 1 && parentId !== rootJsonId) {
            console.warn(`⚠️ Depth 1 node ${node.id} has parent ${parentId}, but root is ${rootJsonId}`);
          }

          steps.push({
            type: 'add-node',
            parentJsonId: parentId,
            childJsonId: node.id,
            delay: 1500 + i * 300, // 基础延迟 + 同层间隔
            depth: depth
          });
        } else {
          console.warn(`⚠️ Node at depth ${depth} has no parent: ${node.id}`);
        }
      }
    }

    console.log(`✅ Generated ${steps.length} build steps`);
    return steps;
  }

  /**
   * 获取根节点的文献ID
   */
  getRootLiteratureId(): string | null {
    if (!this.jsonData) {
      console.error('❌ JSON data not loaded');
      return null;
    }

    // 找到根节点（没有父节点的节点）
    const rootNode = this.jsonData.nodes.find(node =>
      !this.childParentMap.has(node.id)
    );

    console.log('🔍 Root node search:', {
      totalNodes: this.jsonData.nodes.length,
      childParentMapSize: this.childParentMap.size,
      rootNodeFound: !!rootNode,
      rootNodeId: rootNode?.id,
      rootNodeTitle: rootNode?.title
    });

    // 调试：显示前几个父子关系
    console.log('🔍 Sample parent-child relationships:');
    const sampleEntries = Array.from(this.childParentMap.entries()).slice(0, 5);
    sampleEntries.forEach(([child, parent]) => {
      console.log(`  ${child} -> ${parent}`);
    });

    if (!rootNode) {
      console.error('❌ Root node not found in JSON data');
      console.log('📊 Child-parent relationships:', Array.from(this.childParentMap.entries()).slice(0, 5));
      return null;
    }

    const literatureId = this.literatureMapping.get(rootNode.id);
    console.log('🔍 Root literature mapping:', {
      rootJsonId: rootNode.id,
      literatureId: literatureId,
      mappingExists: this.literatureMapping.has(rootNode.id),
      totalMappings: this.literatureMapping.size
    });

    return literatureId || null;
  }

  /**
   * 根据JSON ID获取文献ID
   */
  getLiteratureId(jsonId: string): string | null {
    return this.literatureMapping.get(jsonId) || null;
  }

  /**
   * 获取根节点的JSON ID
   */
  getRootJsonId(): string | null {
    if (!this.jsonData) return null;

    // 找到根节点（没有父节点的节点）
    const rootNode = this.jsonData.nodes.find(node =>
      !this.childParentMap.has(node.id)
    );

    return rootNode?.id || null;
  }

  /**
   * 获取所有映射关系
   */
  getAllMappings(): Map<string, string> {
    return new Map(this.literatureMapping);
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const nodesByDepth = this.groupNodesByDepth();
    return {
      totalNodes: this.jsonData?.nodes.length || 0,
      totalEdges: this.jsonData?.edges.length || 0,
      mappedLiterature: this.literatureMapping.size,
      depthLevels: nodesByDepth.size,
      nodesByDepth: Object.fromEntries(
        Array.from(nodesByDepth.entries()).map(([depth, nodes]) => [depth, nodes.length])
      )
    };
  }
}

// 导出单例实例
export const simpleDemoDataProcessor = new SimpleDemoDataProcessor();
