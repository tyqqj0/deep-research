// src-refactored/config/schema.ts
import { z } from 'zod';

const AIProviderEnum = z.enum(['google', 'openai', 'anthropic', 'deepseek', 'xai', 'mistral', 'azure', 'openrouter', 'openaicompatible', 'pollinations', 'ollama']);
const SearchProviderEnum = z.enum(['model', 'tavily', 'firecrawl', 'exa', 'bocha', 'searxng']);

export const ServerConfigSchema = z.object({
  ACCESS_PASSWORD: z.string().optional(),
  
  // LLM Provider Keys & URLs
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  GOOGLE_GENERATIVE_AI_API_BASE_URL: z.string().url().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_API_BASE_URL: z.string().url().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_API_BASE_URL: z.string().url().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_API_BASE_URL: z.string().url().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_API_BASE_URL: z.string().url().optional(),
  XAI_API_KEY: z.string().optional(),
  XAI_API_BASE_URL: z.string().url().optional(),
  MISTRAL_API_KEY: z.string().optional(),
  MISTRAL_API_BASE_URL: z.string().url().optional(),
  AZURE_API_KEY: z.string().optional(),
  AZURE_RESOURCE_NAME: z.string().optional(),
  OPENAI_COMPATIBLE_API_KEY: z.string().optional(),
  OPENAI_COMPATIBLE_API_BASE_URL: z.string().url().optional(),
  POLLINATIONS_API_BASE_URL: z.string().url().optional(),
  OLLAMA_API_BASE_URL: z.string().url().optional(),
  
  // Search Provider Keys & URLs
  TAVILY_API_KEY: z.string().optional(),
  TAVILY_API_BASE_URL: z.string().url().optional(),
  FIRECRAWL_API_KEY: z.string().optional(),
  FIRECRAWL_API_BASE_URL: z.string().url().optional(),
  EXA_API_KEY: z.string().optional(),
  EXA_API_BASE_URL: z.string().url().optional(),
  BOCHA_API_KEY: z.string().optional(),
  BOCHA_API_BASE_URL: z.string().url().optional(),
  SEARXNG_API_BASE_URL: z.string().url().optional(),
  
  // MCP Server Config
  MCP_AI_PROVIDER: AIProviderEnum.optional(),
  MCP_SEARCH_PROVIDER: SearchProviderEnum.optional(),
  MCP_THINKING_MODEL: z.string().optional(),
  MCP_TASK_MODEL: z.string().optional(),

  // Head Scripts for analytics or tracking
  HEAD_SCRIPTS: z.string().optional(),
});

export const PublicConfigSchema = z.object({
  NEXT_PUBLIC_DISABLED_AI_PROVIDER: z.string().transform(val => val.split(',')).optional(),
  NEXT_PUBLIC_DISABLED_SEARCH_PROVIDER: z.string().transform(val => val.split(',')).optional(),
  NEXT_PUBLIC_MODEL_LIST: z.string().optional(),
});

export const AppConfigSchema = ServerConfigSchema.merge(PublicConfigSchema).extend({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;
