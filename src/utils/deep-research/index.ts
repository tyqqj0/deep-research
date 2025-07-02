export { ResearchEngine } from "./core/ResearchEngine";
export { createDeepResearchAdapter } from "./legacy/useDeepResearchAdapter";
export { SearchStrategy } from "./strategies/SearchStrategy";
export { DeeperStrategy } from "./strategies/DeeperStrategy";
export { RetryManager } from "./services/RetryManager";

// Default export for backward compatibility
export { ResearchEngine as default } from "./core/ResearchEngine";