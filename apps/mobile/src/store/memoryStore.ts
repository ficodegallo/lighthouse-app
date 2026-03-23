import { create } from 'zustand';
import { Memory, MemoryDraft } from '@lighthouse/shared';
import { api } from '../services/api';

interface MemoryStore {
  memories: Memory[];
  isLoading: boolean;
  error: string | null;

  // Capture flow state
  captureMode: 'voice' | 'text';
  pendingDraft: MemoryDraft | null;
  isClassifying: boolean;

  setCaptureMode: (mode: 'voice' | 'text') => void;
  setPendingDraft: (draft: MemoryDraft | null) => void;

  classify: (content: string) => Promise<MemoryDraft>;
  confirmMemory: (draft: MemoryDraft) => Promise<Memory>;
  fetchMemories: (horizon?: string) => Promise<void>;
  archiveMemory: (id: string) => Promise<void>;
}

export const useMemoryStore = create<MemoryStore>((set, get) => ({
  memories: [],
  isLoading: false,
  error: null,
  captureMode: 'voice',
  pendingDraft: null,
  isClassifying: false,

  setCaptureMode: (mode) => set({ captureMode: mode }),
  setPendingDraft: (draft) => set({ pendingDraft: draft }),

  classify: async (content: string) => {
    set({ isClassifying: true, error: null });
    try {
      const result = await api.memories.classify(content);
      const draft = (result as any).draft as MemoryDraft;
      set({ pendingDraft: draft, isClassifying: false });
      return draft;
    } catch (err) {
      set({ isClassifying: false, error: (err as Error).message });
      throw err;
    }
  },

  confirmMemory: async (draft: MemoryDraft) => {
    const memory = await api.memories.create({
      content: draft.content,
      type: draft.type,
      horizon: draft.horizon,
      summary: draft.summary,
    });
    // Prepend to local list
    set((state) => ({
      memories: [memory, ...state.memories],
      pendingDraft: null,
    }));
    return memory;
  },

  fetchMemories: async (horizon?: string) => {
    set({ isLoading: true, error: null });
    try {
      const memories = await api.memories.list(horizon ? { horizon } : {});
      set({ memories, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: (err as Error).message });
    }
  },

  archiveMemory: async (id: string) => {
    await api.memories.archive(id);
    set((state) => ({
      memories: state.memories.filter((m) => m.id !== id),
    }));
  },
}));
