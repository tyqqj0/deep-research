import { create } from "zustand";
import { persist } from "zustand/middleware";
import { pick } from "radash";
import { nanoid } from "nanoid";
import type {
  ResearchItem,
  Resource,
  SearchTask,
  Source,
  ImageSource,
  ThinkingTask,
} from "@/types";

export interface TaskStore {
  id: string;
  question: string;
  resources: Resource[];
  query: string;
  questions: string;
  feedback: string;
  reportPlan: string;
  suggestion: string;
  tasks: ResearchItem[];
  requirement: string;
  title: string;
  finalReport: string;
  sources: Source[];
  images: ImageSource[];
  knowledgeGraph: string;
  maxDepth: number;
  researchStatus: "idle" | "wider-research" | "deeper-research" | "stopping";
  currentDepth: number;
}

interface TaskFunction {
  update: (tasks: ResearchItem[]) => void;
  setId: (id: string) => void;
  setTitle: (title: string) => void;
  setSuggestion: (suggestion: string) => void;
  setRequirement: (requirement: string) => void;
  setQuery: (query: string) => void;
  addTasks: (tasks: ResearchItem[]) => void;
  updateTask: (id: string, task: Partial<SearchTask | ThinkingTask>) => void;
  removeTask: (id: string) => boolean;
  setQuestion: (question: string) => void;
  addResource: (resource: Resource) => void;
  updateResource: (id: string, resource: Partial<Resource>) => void;
  removeResource: (id: string) => boolean;
  updateQuestions: (questions: string) => void;
  updateReportPlan: (plan: string) => void;
  updateFinalReport: (report: string) => void;
  setSources: (sources: Source[]) => void;
  setImages: (images: Source[]) => void;
  setFeedback: (feedback: string) => void;
  updateKnowledgeGraph: (knowledgeGraph: string) => void;
  setMaxDepth: (depth: number) => void;
  setResearchStatus: (
    status: "idle" | "wider-research" | "deeper-research" | "stopping"
  ) => void;
  setCurrentDepth: (depth: number) => void;
  getTasksByDepth: (depth: number) => ResearchItem[];
  isDepthCompleted: (depth: number) => boolean;
  removeTasksByDepth: (depth: number) => void;
  clear: () => void;
  reset: () => void;
  backup: () => Omit<TaskStore, "thinkingProcess">;
  restore: (taskStore: TaskStore) => void;
}

const defaultValues: TaskStore = {
  id: "",
  question: "",
  resources: [],
  query: "",
  questions: "",
  feedback: "",
  reportPlan: "",
  suggestion: "",
  tasks: [],
  requirement: "",
  title: "",
  finalReport: "",
  sources: [],
  images: [],
  knowledgeGraph: "",
  maxDepth: 3,
  researchStatus: "idle",
  currentDepth: 0,
};

export const useTaskStore = create(
  persist<TaskStore & TaskFunction>(
    (set, get) => ({
      ...defaultValues,
      update: (tasks) => set(() => ({ tasks: [...tasks] })),
      setId: (id) => set(() => ({ id })),
      setTitle: (title) => set(() => ({ title })),
      setSuggestion: (suggestion) => set(() => ({ suggestion })),
      setRequirement: (requirement) => set(() => ({ requirement })),
      setQuery: (query) => set(() => ({ query })),
      addTasks: (tasks) => {
        set((state) => ({ tasks: [...state.tasks, ...tasks] }));
      },
      updateTask: (id, task) => {
        const newTasks = get().tasks.map((item) => {
          if (item.id === id) {
            return { ...item, ...task };
          }
          return item;
        }) as ResearchItem[];
        set(() => ({ tasks: [...newTasks] }));
      },
      removeTask: (id) => {
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== id),
        }));
        return true;
      },
      setQuestion: (question) => set(() => ({ question })),
      addResource: (resource) =>
        set((state) => ({ resources: [resource, ...state.resources] })),
      updateResource: (id, resource) => {
        const newResources = get().resources.map((item) => {
          return item.id === id ? { ...item, ...resource } : item;
        });
        set(() => ({ resources: [...newResources] }));
      },
      removeResource: (id) => {
        set((state) => ({
          resources: state.resources.filter((resource) => resource.id !== id),
        }));
        return true;
      },
      updateQuestions: (questions) => set(() => ({ questions })),
      updateReportPlan: (plan) => set(() => ({ reportPlan: plan })),
      updateFinalReport: (report) => set(() => ({ finalReport: report })),
      setSources: (sources) => set(() => ({ sources })),
      setImages: (images) => set(() => ({ images })),
      setFeedback: (feedback) => set(() => ({ feedback })),
      updateKnowledgeGraph: (knowledgeGraph) => set(() => ({ knowledgeGraph })),
      setMaxDepth: (depth) => set(() => ({ maxDepth: depth })),
      setResearchStatus: (status) => set(() => ({ researchStatus: status })),
      setCurrentDepth: (depth) => set(() => ({ currentDepth: depth })),
      getTasksByDepth: (depth) => {
        const { tasks } = get();
        return tasks.filter((t) => (t as any).depth === depth);
      },
      isDepthCompleted: (depth) => {
        const { tasks } = get();
        const tasksAtDepth = tasks.filter((t) => (t as any).depth === depth);
        const searchTasks = tasksAtDepth.filter(
          (t): t is SearchTask => t.type === "search"
        );

        if (searchTasks.length === 0) return false;

        return searchTasks.every(
          (t) =>
            t.state === "completed" ||
            t.state === "failed" ||
            t.state === "cancelled"
        );
      },
      removeTasksByDepth: (depth) => {
        set((state) => {
          const newTasks: ResearchItem[] = state.tasks.filter(
            (t) => (t as any).depth !== depth
          );
          return { tasks: newTasks };
        });
      },
      clear: () => set(() => ({ tasks: [] })),
      reset: () => set(() => ({ ...defaultValues })),
      backup: () => {
        const { ...rest } = get();
        return {
          ...pick(rest, Object.keys(defaultValues) as (keyof TaskStore)[]),
        } as TaskStore;
      },
      restore: (taskStore) => set(() => ({ ...taskStore })),
    }),
    {
      name: "research",
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error("Failed to rehydrate task store", error);
        }
        if (state) {
          const migratedTasks = state.tasks.map((task: any) => {
            // Check for old search tasks that are missing the `type` property
            if (
              task &&
              typeof task === "object" &&
              !task.type &&
              task.query
            ) {
              return { ...task, type: "search" };
            }
            return task;
          });
          state.tasks = migratedTasks;
        }
      },
    }
  )
);
