import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { closeDB, DB_NAME, DB_VERSION, deletePuzzleDB, getDB } from './db';

afterEach(async () => {
  await deletePuzzleDB();
});

describe('getDB', () => {
  it('创建 scores / replays store 和索引', async () => {
    const database = await getDB();

    expect(DB_NAME).toBe('puzzle.v2');
    expect(DB_VERSION).toBe(1);
    expect(database.objectStoreNames.contains('scores')).toBe(true);
    expect(database.objectStoreNames.contains('replays')).toBe(true);

    const scores = database.transaction('scores').store;
    expect(scores.indexNames.contains('by-bucket')).toBe(true);
    expect(scores.indexNames.contains('by-group')).toBe(true);

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

  it('deletePuzzleDB 会关闭当前连接并删除数据库', async () => {
    const database = await getDB();
    expect(database.objectStoreNames.contains('scores')).toBe(true);

    await deletePuzzleDB();
    const reopened = await getDB();

    expect(reopened.objectStoreNames.contains('scores')).toBe(true);
  });
});
