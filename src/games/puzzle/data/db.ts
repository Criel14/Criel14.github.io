import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { GameMode, GroupId, PuzzleSize, ScoreRecord } from '../types';
import { DataStoreError, toDataStoreError } from './errors';
import type { StoredReplayV2 } from './replay-codec';

export const DB_NAME = 'puzzle.v2';
export const DB_VERSION = 2;

export interface PuzzleDB extends DBSchema {
  scores: {
    key: string;
    value: ScoreRecord;
    indexes: {
      'by-bucket': [PuzzleSize, GameMode, GroupId];
      'by-event': [PuzzleSize, GameMode];
    };
  };
  replays: {
    key: string;
    value: StoredReplayV2;
  };
}

let dbPromise: Promise<IDBPDatabase<PuzzleDB>> | null = null;

function openPuzzleDatabase(): Promise<IDBPDatabase<PuzzleDB>> {
  let rejectBlocked: ((reason: DataStoreError) => void) | undefined;
  const blockedPromise = new Promise<never>((_, reject) => {
    rejectBlocked = reject;
  });

  const openPromise = openDB<PuzzleDB>(DB_NAME, DB_VERSION, {
    upgrade(database, oldVersion) {
      if (oldVersion === 1) {
        // v2 尚未上线：旧版本使用全局 groupId 1–10 和 by-group 索引，
        // 分组模型改为事件级后直接重建 store，避免新旧槽位混在一起。
        if (database.objectStoreNames.contains('scores')) {
          database.deleteObjectStore('scores');
        }
        if (database.objectStoreNames.contains('replays')) {
          database.deleteObjectStore('replays');
        }
      }

      const scores = database.createObjectStore('scores', { keyPath: 'id' });
      scores.createIndex('by-bucket', ['size', 'gameMode', 'groupId']);
      scores.createIndex('by-event', ['size', 'gameMode']);
      database.createObjectStore('replays', { keyPath: 'scoreId' });
    },
    blocked() {
      rejectBlocked?.(
        new DataStoreError('blocked', '数据库被其他标签页阻塞，请关闭其他页面后重试'),
      );
    },
    blocking() {
      // 当前页阻塞了其他标签页的升级请求，主动让出连接。
      void closeDB();
    },
    terminated() {
      dbPromise = null;
    },
  });

  return Promise.race([openPromise, blockedPromise]).catch((error: unknown) => {
    // blocked 先失败时，openPromise 仍可能稍后成功；成功后的连接必须关闭。
    void openPromise.then((database) => database.close()).catch(() => undefined);
    throw toDataStoreError(error, 'unavailable');
  });
}

/**
 * 获取页面级单例连接。
 * 打开失败会清空缓存，下一次调用可以重新尝试。
 */
export function getDB(): Promise<IDBPDatabase<PuzzleDB>> {
  if (!dbPromise) {
    dbPromise = openPuzzleDatabase().catch((error: unknown) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

/** 关闭连接；测试和版本升级时会调用。 */
export async function closeDB(): Promise<void> {
  const current = dbPromise;
  dbPromise = null;
  if (!current) {
    return;
  }

  try {
    const database = await current;
    database.close();
  } catch {
    // 连接本来就是失败状态，无需再次抛错。
  }
}

/** 删除整个数据库；仅用于测试与维护入口。 */
export async function deletePuzzleDB(): Promise<void> {
  await closeDB();
  try {
    await deleteDB(DB_NAME);
  } catch (error) {
    throw toDataStoreError(error, 'unknown');
  }
}
