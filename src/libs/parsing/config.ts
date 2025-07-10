/**
 * Configuration for Mineru API integration
 * Users should update these values with their actual API credentials
 */

export interface MineruConfig {
  apiToken: string;
  baseUrl: string;
  pollInterval: number; // in milliseconds
  maxPollTimeout: number; // in milliseconds
}

// Default configuration
export const DEFAULT_MINERU_CONFIG: MineruConfig = {
  // TODO: Replace with your actual Mineru API token
  apiToken: process.env.MINERU_API_TOKEN || 'your-mineru-api-token-here',
  
  // TODO: Replace with actual Mineru API base URL
  baseUrl: process.env.MINERU_BASE_URL || 'https://api.mineru.com/v1',
  
  // Poll every 5 seconds for task completion
  pollInterval: 5000,
  
  // Maximum polling time: 30 minutes
  maxPollTimeout: 30 * 60 * 1000
};

/**
 * Validate Mineru configuration
 */
export function validateMineruConfig(config: MineruConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.apiToken || config.apiToken === 'your-mineru-api-token-here') {
    errors.push('API token is not configured. Please set MINERU_API_TOKEN environment variable or update the config.');
  }

  if (!config.baseUrl || config.baseUrl.includes('example.com')) {
    errors.push('Base URL is not configured. Please set MINERU_BASE_URL environment variable or update the config.');
  }

  if (config.pollInterval < 1000) {
    errors.push('Poll interval should be at least 1000ms to avoid API rate limits.');
  }

  if (config.maxPollTimeout < 60000) {
    errors.push('Maximum poll timeout should be at least 60 seconds.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get current Mineru configuration with validation
 */
export function getMineruConfig(): { config: MineruConfig; warnings: string[] } {
  const config = { ...DEFAULT_MINERU_CONFIG };
  const validation = validateMineruConfig(config);
  
  if (!validation.valid) {
    console.warn('⚠️  Mineru configuration issues detected:');
    validation.errors.forEach(error => console.warn(`   - ${error}`));
  }

  return {
    config,
    warnings: validation.errors
  };
}