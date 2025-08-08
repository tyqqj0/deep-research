// @/domains/tree/entities/ResearchTree.ts

import { z } from 'zod';

// Define schemas for node and the tree itself for validation
export const TreeNodeSchema = z.object({
  id: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  literatureId: z.string().uuid(),
  visits: z.number().int().min(0),
  wins: z.number(),
});

export const ResearchTreeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  rootNodeId: z.string().uuid(),
  nodes: z.record(z.string().uuid(), TreeNodeSchema),
  createdAt: z.date(),
});

// Define types from schemas
export type TreeNode = z.infer<typeof TreeNodeSchema>;
export type ResearchTreeData = z.infer<typeof ResearchTreeSchema>;

/**
 * Represents the Research Tree data structure.
 * This class encapsulates the tree data and provides methods for manipulating it
 * without any knowledge of persistence or external services.
 */
export class ResearchTree {
  public readonly id: string;
  public name: string;
  public readonly rootNodeId: string;
  private nodes: Map<string, TreeNode>;
  public readonly createdAt: Date;

  constructor(data: ResearchTreeData) {
    // Validate data on construction
    ResearchTreeSchema.parse(data);

    this.id = data.id;
    this.name = data.name;
    this.rootNodeId = data.rootNodeId;
    this.nodes = new Map(Object.entries(data.nodes));
    this.createdAt = data.createdAt;
  }

  public getNode(nodeId: string): TreeNode | undefined {
    return this.nodes.get(nodeId);
  }

  public getRootNode(): TreeNode {
    // The root node is guaranteed to exist by schema validation
    return this.nodes.get(this.rootNodeId)!;
  }

  public getChildren(parentId: string): TreeNode[] {
    const children: TreeNode[] = [];
    for (const node of this.nodes.values()) {
      if (node.parentId === parentId) {
        children.push(node);
      }
    }
    return children;
  }
  
  public getChildNodes(parentId: string): TreeNode[] {
    return this.getChildren(parentId);
  }
  
  public getNodeLiterature(nodeId: string): any {
    // In a real implementation, this would use a service to fetch the literature item
    // For now, we'll just return a placeholder
    const node = this.getNode(nodeId);
    if (!node) {
      return null;
    }
    
    return {
      id: node.literatureId,
      title: `Placeholder Literature for Node ${nodeId}`,
      authors: ['Author 1', 'Author 2'],
      year: '2023',
      citationCount: 10
    };
  }

  public addNode(node: TreeNode): void {
    if (this.nodes.has(node.id)) {
      throw new Error(`Node with id ${node.id} already exists.`);
    }
    if (node.parentId && !this.nodes.has(node.parentId)) {
      throw new Error(`Parent node with id ${node.parentId} does not exist.`);
    }
    this.nodes.set(node.id, node);
  }

  public updateNodeStats(nodeId: string, visits: number, wins: number): void {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node with id ${nodeId} not found.`);
    }
    node.visits = visits;
    node.wins = wins;
  }

  public backpropagate(startNodeId: string, reward: number): void {
    let currentNode = this.nodes.get(startNodeId);
    while (currentNode) {
      currentNode.visits += 1;
      currentNode.wins += reward;
      if (currentNode.parentId) {
        currentNode = this.nodes.get(currentNode.parentId);
      } else {
        break;
      }
    }
  }

  public deleteNode(nodeId: string): void {
    this.nodes.delete(nodeId);
  }

  public toJSON(): ResearchTreeData {
    return {
      id: this.id,
      name: this.name,
      rootNodeId: this.rootNodeId,
      nodes: Object.fromEntries(this.nodes),
      createdAt: this.createdAt,
    };
  }
}
