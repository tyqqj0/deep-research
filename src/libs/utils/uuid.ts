import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a standard UUID v4
 * 
 * @returns {string} A valid UUID v4 string (e.g., "123e4567-e89b-12d3-a456-426614174000")
 */
export function generateUUID(): string {
  return uuidv4();
}

/**
 * Generate a UUID for library items
 * 
 * @returns {string} A valid UUID v4 string
 */
export function generateLibraryItemId(): string {
  return generateUUID();
}

/**
 * Generate a UUID for literature trees
 * 
 * @returns {string} A valid UUID v4 string
 */
export function generateTreeId(): string {
  return generateUUID();
}

/**
 * Generate a UUID for MCTS nodes
 * 
 * @returns {string} A valid UUID v4 string
 */
export function generateNodeId(): string {
  return generateUUID();
}

/**
 * Validate if a string is a valid UUID
 * 
 * @param {string} id - The string to validate
 * @returns {boolean} True if valid UUID, false otherwise
 */
export function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Generate a short display ID for UI purposes (first 8 characters)
 * 
 * @param {string} uuid - Full UUID string
 * @returns {string} Short display ID
 */
export function getShortId(uuid: string): string {
  return uuid.substring(0, 8);
}