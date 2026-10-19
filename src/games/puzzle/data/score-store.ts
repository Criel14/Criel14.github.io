import type { GroupId, ReplayRecord, ScoreFilter, ScoreRecord } from '../types';
import { isPuzzleSize } from '../core/board';
import { isGroupId } from '../core/groups';
import { getDB } from './db';
import { DataStoreError, toDataStoreError } from './errors';
import { encodeReplay } from './replay-codec';
import { isReplayRecord, isScoreRecord } from './schema';
import { roundTimeMs } from './time';

function assertFilter(filter: ScoreFilter): void {
  if (
    !isPuzzleSize(filter.size) ||
    (filter.gameMode !== 'normal' && filter.gameMode !== 'blind') ||
    !isGroupId(filter.groupId)
  ) {
    throw new DataStoreError('validation', '成绩筛选条件非法');
  }
}

function normalizeScoreForStorage(score: ScoreRecord): ScoreRecord {
  return {
    ...score,
    durationMs: roundTimeMs(score.durationMs),
    observeMs: roundTimeMs(score.observeMs),
  };
}

function assertScoreReplayPair(score: ScoreRecord, replay: ReplayRecord): void {
  if (!isScoreRecord(score)) {
    throw new DataStoreError('validation', '成绩数据非法');
  }
  if (!isReplayRecord(replay)) {
    throw new DataStoreError('validation', '录像数据非法');
  }
  if (score.id !== replay.scoreId) {
    throw new DataStoreError('validation', '成绩 ID 与录像 scoreId 不一致');
  }
  if (score.moveCount !== replay.moves.length) {
    throw new DataStoreError('validation', '成绩步数与录像步数不一致');
  }
}

/**
 * 按 size + gameMode + groupId 查询成绩桶。
 * 只读取 scores store，不加载任何录像；排序和编号由 core 负责。
 */
export async function listScoresByBucket(filter: ScoreFilter): Promise<ScoreRecord[]> {
  assertFilter(filter);

  try {
    const database = await getDB();
    const scores = await database.getAllFromIndex('scores', 'by-bucket', [
      filter.size,
      filter.gameMode,
      filter.groupId,
    ]);
    return scores.filter(isScoreRecord);
  } catch (error) {
    throw toDataStoreError(error, 'unknown');
  }
}

/** 按主键读取成绩；缺失或损坏返回 null。 */
export async function getScoreById(id: string): Promise<ScoreRecord | null> {
  if (typeof id !== 'string' || id.length === 0) {
    return null;
  }

  try {
    const database = await getDB();
    const score = await database.get('scores', id);
    return isScoreRecord(score) ? score : null;
  } catch (error) {
    throw toDataStoreError(error, 'unknown');
  }
}

/**
 * 原子新增成绩和录像。
 *
 * 两个 store 在同一个事务中写入；任意一边失败都会回滚，避免孤立成绩或孤儿录像。
 * 时间字段在落库前统一保留 3 位小数；传入对象不会被修改。
 */
export async function addScoreWithReplay(score: ScoreRecord, replay: ReplayRecord): Promise<void> {
  assertScoreReplayPair(score, replay);

  const storedScore = normalizeScoreForStorage(score);
  const storedReplay = encodeReplay(replay);

  try {
    const database = await getDB();
    const transaction = database.transaction(['scores', 'replays'], 'readwrite');
    const scores = transaction.objectStore('scores');
    const replays = transaction.objectStore('replays');

    await Promise.all([scores.add(storedScore), replays.add(storedReplay), transaction.done]);
  } catch (error) {
    throw toDataStoreError(error, 'unknown');
  }
}

/** 删除成绩及其录像；不存在时保持幂等。 */
export async function removeScore(id: string): Promise<void> {
  if (typeof id !== 'string' || id.length === 0) {
    return;
  }

  try {
    const database = await getDB();
    const transaction = database.transaction(['scores', 'replays'], 'readwrite');
    const scores = transaction.objectStore('scores');
    const replays = transaction.objectStore('replays');

    await Promise.all([scores.delete(id), replays.delete(id), transaction.done]);
  } catch (error) {
    throw toDataStoreError(error, 'unknown');
  }
}

export async function countScoresByBucket(filter: ScoreFilter): Promise<number> {
  assertFilter(filter);

  try {
    const database = await getDB();
    return await database.countFromIndex('scores', 'by-bucket', [
      filter.size,
      filter.gameMode,
      filter.groupId,
    ]);
  } catch (error) {
    throw toDataStoreError(error, 'unknown');
  }
}

export async function countScoresByGroup(groupId: GroupId): Promise<number> {
  if (!isGroupId(groupId)) {
    throw new DataStoreError('validation', '分组编号非法');
  }

  try {
    const database = await getDB();
    return await database.countFromIndex('scores', 'by-group', groupId);
  } catch (error) {
    throw toDataStoreError(error, 'unknown');
  }
}

export async function countAllScores(): Promise<number> {
  try {
    const database = await getDB();
    return await database.count('scores');
  } catch (error) {
    throw toDataStoreError(error, 'unknown');
  }
}

/**
 * 清空一个成绩桶，同时删除对应录像。
 * 返回删除的成绩条数；按索引主键删除，不加载完整成绩记录。
 */
export async function clearScoresByBucket(filter: ScoreFilter): Promise<number> {
  assertFilter(filter);

  try {
    const database = await getDB();
    const transaction = database.transaction(['scores', 'replays'], 'readwrite');
    const scores = transaction.objectStore('scores');
    const replays = transaction.objectStore('replays');
    const keys = await scores
      .index('by-bucket')
      .getAllKeys([filter.size, filter.gameMode, filter.groupId]);

    const requests: Promise<unknown>[] = [];
    for (const key of keys) {
      const scoreId = String(key);
      requests.push(scores.delete(scoreId), replays.delete(scoreId));
    }
    await Promise.all([...requests, transaction.done]);

    return keys.length;
  } catch (error) {
    throw toDataStoreError(error, 'unknown');
  }
}

/** 清空一个分组下所有阶数/模式的成绩与录像，保留分组和名称。 */
export async function clearScoresByGroup(groupId: GroupId): Promise<number> {
  if (!isGroupId(groupId)) {
    throw new DataStoreError('validation', '分组编号非法');
  }

  try {
    const database = await getDB();
    const transaction = database.transaction(['scores', 'replays'], 'readwrite');
    const scores = transaction.objectStore('scores');
    const replays = transaction.objectStore('replays');
    const keys = await scores.index('by-group').getAllKeys(groupId);

    const requests: Promise<unknown>[] = [];
    for (const key of keys) {
      const scoreId = String(key);
      requests.push(scores.delete(scoreId), replays.delete(scoreId));
    }
    await Promise.all([...requests, transaction.done]);

    return keys.length;
  } catch (error) {
    throw toDataStoreError(error, 'unknown');
  }
}

/** 清空全部成绩与录像；不影响 localStorage 中的设置和外观。 */
export async function clearAllScores(): Promise<void> {
  try {
    const database = await getDB();
    const transaction = database.transaction(['scores', 'replays'], 'readwrite');
    const scores = transaction.objectStore('scores');
    const replays = transaction.objectStore('replays');

    await Promise.all([scores.clear(), replays.clear(), transaction.done]);
  } catch (error) {
    throw toDataStoreError(error, 'unknown');
  }
}
