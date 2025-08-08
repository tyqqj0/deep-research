import { create } from "zustand";
import { persist, type StorageValue } from "zustand/middleware";
import type { TaskStore } from "./task";
import { researchStore } from "@/utils/storage";
import { customAlphabet } from "nanoid";
import { clone, pick } from "radash";

export interface ResearchHistory extends TaskStore {
  createdAt: number;
  updatedAt?: number;
}

export interface HistoryStore {
  history: ResearchHistory[];
}

interface HistoryFunction {
  save: (taskStore: TaskStore) => string;
  load: (id: string) => TaskStore | void;
  update: (id: string, taskStore: TaskStore) => boolean;
  remove: (id: string) => boolean;
}

const nanoid = customAlphabet("1234567890abcdefghijklmnopqrstuvwxyz", 12);

export const useHistoryStore = create(
  persist<HistoryStore & HistoryFunction>(
    (set, get) => ({
      history: [],
      save: (taskStore) => {
        // Save tasks with a title or question immediately upon creation
        if (taskStore.title || taskStore.question) {
          const topicKey = taskStore.title || taskStore.question;

          // 🎯 检查是否已存在相同话题的记录，避免重复保存
          const existingRecord = get().history.find(record =>
            (record.title || record.question) === topicKey
          );

          if (existingRecord) {
            console.log("[HistoryStore] Topic already exists, updating instead of creating new:", {
              existingId: existingRecord.id,
              topic: topicKey
            });
            // 更新现有记录而不是创建新记录
            const updatedHistory = get().history.map(item => {
              if (item.id === existingRecord.id) {
                return {
                  ...clone(taskStore),
                  id: existingRecord.id,
                  createdAt: existingRecord.createdAt,
                  updatedAt: Date.now(),
                } as ResearchHistory;
              }
              return item;
            });
            set(() => ({ history: updatedHistory }));
            return existingRecord.id;
          }

          // 创建新记录
          const id = nanoid();
          const newHistory: ResearchHistory = {
            ...clone(taskStore),
            id,
            createdAt: Date.now(),
          };
          set((state) => ({ history: [newHistory, ...state.history] }));
          console.log("[HistoryStore] Saved new history:", { id, title: taskStore.title, question: taskStore.question });
          return id;
        }
        return "";
      },
      load: (id) => {
        const current = get().history.find((item) => item.id === id);
        if (current) return clone(current);
      },
      update: (id, taskStore) => {
        const newHistory = get().history.map((item) => {
          if (item.id === id) {
            return {
              ...clone(taskStore),
              updatedAt: Date.now(),
            } as ResearchHistory;
          } else {
            return item;
          }
        });
        set(() => ({ history: [...newHistory] }));
        return true;
      },
      remove: (id) => {
        set((state) => ({
          history: state.history.filter((item) => item.id !== id),
        }));
        return true;
      },
    }),
    {
      name: "historyStore",
      version: 1,
      storage: {
        getItem: async (key: string) => {
          return await researchStore.getItem<
            StorageValue<HistoryStore & HistoryFunction>
          >(key);
        },
        setItem: async (
          key: string,
          store: StorageValue<HistoryStore & HistoryFunction>
        ) => {
          return await researchStore.setItem(key, {
            state: pick(store.state, ["history"]),
            version: store.version,
          });
        },
        removeItem: async (key: string) => await researchStore.removeItem(key),
      },
    }
  )
);
