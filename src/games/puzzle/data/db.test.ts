import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { afterEach, describe, expect, it } from 'vitest';
import { closeDB, DB_NAME, DB_VERSION, deletePuzzleDB, getDB } from './db';

afterEach(async () => {
  await deletePuzzleDB();
});

describe('getDB', () => {
  it('创建 scores / replays store 和事件级索引', async () => {
    const database = await getDB();

    expect(DB_NAME).toBe('puzzle.v2');
    expect(DB_VERSION).toBe(2);
    expect(database.objectStoreNames.contains('scores')).toBe(true);
    expect(database.objectStoreNames.contains('replays')).toBe(true);

    const scores = database.transaction('scores').store;
    expect(scores.indexNames.contains('by-bucket')).toBe(true);
    expect(scores.indexNames.contains('by-event')).toBe(true);
    expect([...scores.indexNames]).not.toContain('by-group');

    const replays = database.transaction('replays').store;
    expect(replays.keyPath).toBe('scoreId');
  });

  it('同一页面复用连接，关闭后可以重新打开', async () => {
    const first = await getDB();
    expect(await getDB()).toBe(first);

    await closeDB();
    const second = await getDB();

    expect(second).not.toBe(first);
    expect(second.objectStoreNames.contains('scores')).toBe(true);
  });

  it('从 v1 升级时重建 store，移除 by-group 和旧成绩', async () => {
    const legacy = await openDB(DB_NAME, 1, {
      upgrade(database) {
        const scores = database.createObjectStore('scores', { keyPath: 'id' });
        scores.createIndex('by-bucket', ['size', 'gameMode', 'groupId']);
        scores.createIndex('by-group', 'groupId');
        database.createObjectStore('replays', { keyPath: 'scoreId' });
      },
    });
    await legacy.put('scores', { id: 'old-score' });
    legacy.close();

    const database = await getDB();
    const scores = database.transaction('scores').store;

    expect(DB_VERSION).toBe(2);
    expect([...scores.indexNames]).not.toContain('by-group');
    expect(scores.indexNames.contains('by-event')).toBe(true);
    expect(await database.count('scores')).toBe(0);
  });

  it('deletePuzzleDB 会关闭当前连接并删除数据库', async () => {
    const database = await getDB();
    expect(database.objectStoreNames.contains('scores')).toBe(true);

    await deletePuzzleDB();
    const reopened = await getDB();

    expect(reopened.objectStoreNames.contains('scores')).toBe(true);
  });
});
