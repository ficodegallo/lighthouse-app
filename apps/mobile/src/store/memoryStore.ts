import { create } from 'zustand';
import { Memory, MemoryDraft } from '@lighthouse/shared';
import { api } from '../services/api';
import {
  cacheMemories,
  getCachedMemories,
  queueMemoryCreate,
  getPendingCreates,
  clearPendingCreate,
} from '../lib/offlineCache';

interface MemoryStore {
  memories: Memory[];
  isLoading: boolean;
  isOffline: boolean;
  error: string | null;
  pendingCount: number;

  // Capture flow state
  captureMode: 'voice' | 'text';
  pendingDraft: MemoryDraft | null;
  isClassifying: boolean;

  setCaptureMode: (mode: 'voice' | 'text') => void;
  setPendingDraft: (draft: MemoryDraft | null) => void;

  classify: (content: string) => Promise<MemoryDraft>;
  confirmMemory: (draft: MemoryDraft) => Promise<Memory | null>;
  fetchMemories: (horizon?: string) => Promise<void>;
  archiveMemory: (id: string) => Promise<void>;
  syncPending: () => Promise<void>;
}

export const useMemoryStore = create<MemoryStore>((set, get) => ({
  memories: [],
  isLoading: false,
  isOffline: false,
  error: null,
  pendingCount: 0,
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
    const payload = {
      content: draft.content,
      type: draft.type,
      horizon: draft.horizon,
      summary: draft.summary,
      extractedDateTime: draft.extractedDateTime,
    };

    try {
      const memory = await api.memories.create(payload);
      // Prepend to local list and update cache
      set((state) => ({ memories: [memory, ...state.memories], pendingDraft: null }));
      return memory;
    } catch {
      // Offline — queue locally and show optimistic entry
      await queueMemoryCreate(payload);
      const optimistic: Memory = {
        id: `optimistic_${Date.now()}`,
        userId: '',
        content: draft.content,
        type: draft.type,
        horizon: draft.horizon,
        summary: draft.summary,
        createdBy: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'active' as any,
        personIds: [],
      };
      set((state) => ({
        memories: [optimistic, ...state.memories],
        pendingDraft: null,
        pendingCount: state.pendingCount + 1,
        isOffline: true,
      }));
      return null;
    }
  },

  fetchMemories: async (horizon?: string) => {
    set({ isLoading: true, error: null });
    try {
      const memories = await api.memories.list(horizon ? { horizon } : {});
      set({ memories, isLoading: false, isOffline: false });
      // Write to cache for offline use
      if (horizon) await cacheMemories(horizon, memories);
    } catch {
      // Offline — serve from cache
      const cached = horizon ? await getCachedMemories(horizon) : [];
      set({
        memories: cached,
        isLoading: false,
        isOffline: cached.length > 0,
        error: cached.length === 0 ? 'Could not connect. Check your network.' : null,
      });
    }
  },

  archiveMemory: async (id: string) => {
    // Optimistic remove — fire and forget
    set((state) => ({ memories: state.memories.filter((m) => m.id !== id) }));
    try {
      await api.memories.archive(id);
    } catch {
      // Archive failures are silent — memory is removed from UI regardless
    }
  },

  syncPending: async () => {
    const pending = await getPendingCreates();
    if (pending.length === 0) return;

    let synced = 0;
    for (const item of pending) {
      try {
        await api.memories.create(item.payload as any);
        await clearPendingCreate(item.id);
        synced++;
      } catch {
        break; // Still offline — stop trying
      }
    }

    if (synced > 0) {
      set((state) => ({
        pendingCount: Math.max(0, state.pendingCount - synced),
        isOffline: state.pendingCount - synced > 0,
      }));
      // Refresh the current view
      await get().fetchMemories();
    }
  },
}));
