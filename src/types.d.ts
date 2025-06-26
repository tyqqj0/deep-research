interface Resource {
  id: string;
  name: string;
  type: string;
  size: number;
  status: "unprocessed" | "processing" | "completed" | "failed";
}

interface FileMeta {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

interface Knowledge {
  id: string;
  title: string;
  content: string;
  type: "file" | "url" | "knowledge";
  fileMeta?: FileMeta;
  url?: string;
  createdAt: number;
  updatedAt: number;
}

interface ImageSource {
  url: string;
  description?: string;
}

interface Source {
  title?: string;
  content?: string;
  url: string;
  images?: ImageSource[];
}

interface ThinkingTask {
  id: string;
  type: "thinking";
  depth: number;
  title: string;
  reasoning: string;
}

interface SearchTask {
  id: string;
  type: "search";
  state:
  | "unprocessed"
  | "processing"
  | "completed"
  | "failed"
  | "waiting"
  | "cancelled"
  | "searching"
  | "summarizing";
  query: string;
  title: string;
  researchGoal: string;
  learning: string;
  sources: Source[];
  images: ImageSource[];
  depth: number;
  timerId?: NodeJS.Timeout;
}

export type ResearchItem = ThinkingTask | SearchTask;

interface PartialJson {
  value: JSONValue | undefined;
  state:
  | "undefined-input"
  | "successful-parse"
  | "repaired-parse"
  | "failed-parse";
}

interface WebSearchResult {
  content: string;
  url: string;
  title?: string;
}
