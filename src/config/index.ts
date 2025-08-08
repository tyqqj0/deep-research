// src-refactored/config/index.ts
import { AppConfigSchema, AppConfig } from './schema';

class ConfigService {
  private readonly config: AppConfig;

  constructor() {
    console.log("Initializing ConfigService...");
    const result = AppConfigSchema.safeParse({
        // Server-side variables
        ACCESS_PASSWORD: process.env.ACCESS_PASSWORD,
        GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
        GOOGLE_GENERATIVE_AI_API_BASE_URL: process.env.GOOGLE_GENERATIVE_AI_API_BASE_URL,
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
        OPENROUTER_API_BASE_URL: process.env.OPENROUTER_API_BASE_URL,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        OPENAI_API_BASE_URL: process.env.OPENAI_API_BASE_URL,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        ANTHROPIC_API_BASE_URL: process.env.ANTHROPIC_API_BASE_URL,
        DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
        DEEPSEEK_API_BASE_URL: process.env.DEEPSEEK_API_BASE_URL,
        XAI_API_KEY: process.env.XAI_API_KEY,
        XAI_API_BASE_URL: process.env.XAI_API_BASE_URL,
        MISTRAL_API_KEY: process.env.MISTRAL_API_KEY,
        MISTRAL_API_BASE_URL: process.env.MISTRAL_API_BASE_URL,
        AZURE_API_KEY: process.env.AZURE_API_KEY,
        AZURE_RESOURCE_NAME: process.env.AZURE_RESOURCE_NAME,
        OPENAI_COMPATIBLE_API_KEY: process.env.OPENAI_COMPATIBLE_API_KEY,
        OPENAI_COMPATIBLE_API_BASE_URL: process.env.OPENAI_COMPATIBLE_API_BASE_URL,
        POLLINATIONS_API_BASE_URL: process.env.POLLINATIONS_API_BASE_URL,
        OLLAMA_API_BASE_URL: process.env.OLLAMA_API_BASE_URL,
        TAVILY_API_KEY: process.env.TAVILY_API_KEY,
        TAVILY_API_BASE_URL: process.env.TAVILY_API_BASE_URL,
        FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
        FIRECRAWL_API_BASE_URL: process.env.FIRECRAWL_API_BASE_URL,
        EXA_API_KEY: process.env.EXA_API_KEY,
        EXA_API_BASE_URL: process.env.EXA_API_BASE_URL,
        BOCHA_API_KEY: process.env.BOCHA_API_KEY,
        BOCHA_API_BASE_URL: process.env.BOCHA_API_BASE_URL,
        SEARXNG_API_BASE_URL: process.env.SEARXNG_API_BASE_URL,
        MCP_AI_PROVIDER: process.env.MCP_AI_PROVIDER,
        MCP_SEARCH_PROVIDER: process.env.MCP_SEARCH_PROVIDER,
        MCP_THINKING_MODEL: process.env.MCP_THINKING_MODEL,
        MCP_TASK_MODEL: process.env.MCP_TASK_MODEL,
        HEAD_SCRIPTS: process.env.HEAD_SCRIPTS,

        // Public variables
        NEXT_PUBLIC_DISABLED_AI_PROVIDER: process.env.NEXT_PUBLIC_DISABLED_AI_PROVIDER,
        NEXT_PUBLIC_DISABLED_SEARCH_PROVIDER: process.env.NEXT_PUBLIC_DISABLED_SEARCH_PROVIDER,
        NEXT_PUBLIC_MODEL_LIST: process.env.NEXT_PUBLIC_MODEL_LIST,
        
        // Node environment
        NODE_ENV: process.env.NODE_ENV,
    });

    if (!result.success) {
      console.error("❌ Invalid environment variables:", result.error.flatten().fieldErrors);
      // In a real app, you'd want to throw an error to prevent startup
      throw new Error("Invalid environment variables provided.");
    }
    
    this.config = result.data;
    console.log("✅ ConfigService initialized successfully.");
  }

  public get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  public getAll(): AppConfig {
    return this.config;
  }
}

// Singleton instance
const configService = new ConfigService();
export default configService;
