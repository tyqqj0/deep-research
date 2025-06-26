import { create } from "zustand";
import { persist } from "zustand/middleware";
import { pick } from "radash";
import { nanoid } from "nanoid";

export interface TaskStore {
  id: string;
  question: string;
  resources: Resource[];
  query: string;
  questions: string;
  feedback: string;
  reportPlan: string;
  suggestion: string;
  tasks: SearchTask[];
  requirement: string;
  title: string;
  finalReport: string;
  sources: Source[];
  images: ImageSource[];
  knowledgeGraph: string;
  maxDepth: number;
  thinkingProcess: string;
}

interface TaskFunction {
  update: (tasks: SearchTask[]) => void;
  setId: (id: string) => void;
  setTitle: (title: string) => void;
  setSuggestion: (suggestion: string) => void;
  setRequirement: (requirement: string) => void;
  setQuery: (query: string) => void;
  addTask: (
    task: Omit<SearchTask, "id" | "state" | "learning" | "sources" | "images">
  ) => SearchTask;
  updateTask: (id: string, task: Partial<SearchTask>) => void;
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
  updateThinkingProcess: (text: string) => void;
  clear: () => void;
  reset: () => void;
  backup: () => TaskStore;
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
  thinkingProcess: "",
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
      addTask: (task) => {
        const newTask: SearchTask = {
          ...task,
          id: nanoid(),
          state: "unprocessed",
          learning: "",
          sources: [],
          images: [],
        };
        set((state) => ({ tasks: [...state.tasks, newTask] }));
        return newTask;
      },
      updateTask: (id, task) => {
        const newTasks = get().tasks.map((item) => {
          if (item.id === id) {
            return { ...item, ...task };
          }
          return item;
        });
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
      updateThinkingProcess: (text) => set(() => ({ thinkingProcess: text })),
      clear: () => set(() => ({ tasks: [] })),
      reset: () => set(() => ({ ...defaultValues })),
      backup: () => {
        return {
          ...pick(get(), Object.keys(defaultValues) as (keyof TaskStore)[]),
        } as TaskStore;
      },
      restore: (taskStore) => set(() => ({ ...taskStore })),
    }),
    { name: "research" }
  )
);
