// @/infrastructure/utils/id.ts

import { v4 as uuidv4 } from 'uuid';

/**
 * Generates a unique ID for a library item.
 * We can customize this prefix for different entities for better debugging.
 */
export function generateLibraryItemId(): string {
  return `lit_${uuidv4()}`;
}

/**
 * Generates a unique ID for a research tree.
 */
export function generateTreeId(): string {
    return `tree_${uuidv4()}`;
}

/**
 * Generates a unique ID for a tree node.
 */
export function generateNodeId(): string {
    return `node_${uuidv4()}`;
}

/**
 * Generates a unique ID for a workspace.
 */
export function generateWorkspaceId(): string {
    return `ws_${uuidv4()}`;
}

/**
 * Generates a deterministic ID for a citation based on source and target IDs.
 * This ensures that the same citation relationship always has the same ID.
 */
export function generateCitationId(sourceId: string, targetId: string): string {
    return `cit_${sourceId}_${targetId}`;
}
