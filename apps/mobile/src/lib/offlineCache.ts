import * as SQLite from 'expo-sqlite';
import { Memory } from '@lighthouse/shared';

let db: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('lighthouse_cache.db');
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        horizon TEXT NOT NULL,
        data TEXT NOT NULL,
        cachedAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_memories_horizon ON memories(horizon);

      CREATE TABLE IF NOT EXISTS pending_creates (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      );
    `);
  }
  return db;
}

/** Save an array of memories for a given horizon to the local cache. */
export async function cacheMemories(horizon: string, memories: Memory[]): Promise<void> {
  try {
    const database = await getDb();
    const now = Date.now();
    await database.withTransactionAsync(async () => {
      // Clear existing entries for this horizon then re-insert
      await database.runAsync('DELETE FROM memories WHERE horizon = ?', [horizon]);
      for (const memory of memories) {
        await database.runAsync(
          'INSERT OR REPLACE INTO memories (id, horizon, data, cachedAt) VALUES (?, ?, ?, ?)',
          [memory.id, horizon, JSON.stringify(memory), now]
        );
      }
    });
  } catch {
    // Cache writes are best-effort — never block the UI
  }
}

/** Load cached memories for a horizon. Returns empty array if nothing cached. */
export async function getCachedMemories(horizon: string): Promise<Memory[]> {
  try {
    const database = await getDb();
    const rows = await database.getAllAsync<{ data: string }>(
      'SELECT data FROM memories WHERE horizon = ? ORDER BY rowid DESC',
      [horizon]
    );
    return rows.map((r) => JSON.parse(r.data) as Memory);
  } catch {
    return [];
  }
}

/** Queue a memory create for later sync (when back online). */
export async function queueMemoryCreate(payload: Record<string, unknown>): Promise<string> {
  const database = await getDb();
  const id = `pending_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  await database.runAsync(
    'INSERT INTO pending_creates (id, payload, createdAt) VALUES (?, ?, ?)',
    [id, JSON.stringify(payload), Date.now()]
  );
  return id;
}

/** Get all queued creates waiting to be synced. */
export async function getPendingCreates(): Promise<Array<{ id: string; payload: Record<string, unknown> }>> {
  try {
    const database = await getDb();
    const rows = await database.getAllAsync<{ id: string; payload: string }>(
      'SELECT id, payload FROM pending_creates ORDER BY createdAt ASC'
    );
    return rows.map((r) => ({ id: r.id, payload: JSON.parse(r.payload) }));
  } catch {
    return [];
  }
}

/** Remove a pending create after it has been successfully synced. */
export async function clearPendingCreate(id: string): Promise<void> {
  try {
    const database = await getDb();
    await database.runAsync('DELETE FROM pending_creates WHERE id = ?', [id]);
  } catch {}
}

/** Clear all cached memories (e.g. on logout). */
export async function clearCache(): Promise<void> {
  try {
    const database = await getDb();
    await database.execAsync('DELETE FROM memories; DELETE FROM pending_creates;');
  } catch {}
}
