import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GameMode, MoveRecord, PuzzleSize, ReplayRecord, ScoreRecord } from '../types';
import { createSolvedBoard } from '../core/board';
import { closeDB, deletePuzzleDB, getDB } from './db';
import { DataStoreError } from './errors';
import { loadReplay } from './replay-store';
import { roundTimeMs } from './time';
import type { StoredReplayV2 } from './replay-codec';
import {
  addScoreWithReplay,
  clearAllScores,
  clearScoresByBucket,
  clearScoresByEvent,
  countAllScores,
  countScoresByBucket,
  countScoresByEvent,
  getScoreById,
  listScoresByBucket,
  probeScoreStorage,
  removeScore,
} from './score-store';

const EPOCH = 1_700_000_000_000;

function createScore(overrides: Partial<ScoreRecord> = {}): ScoreRecord {
  const size = overrides.size ?? 3;
  return {
    id: 'score-1',
    size,
    gameMode: 'normal',
    moveMode: 'slide',
    groupId: 1,
    durationMs: 1_000,
    observeMs: 0,
    moveCount: 0,
    scramble: createSolvedBoard(size),
    finishedAt: EPOCH,
    ...overrides,
  };
}

function createReplay(scoreId = 'score-1', moves: readonly MoveRecord[] = []): ReplayRecord {
  return { scoreId, moves };
}

async function expectNoOrphanReplays(): Promise<void> {
  const database = await getDB();
  const scoreIds = await database.getAllKeys('scores');
  const replayIds = await database.getAllKeys('replays');

  expect(new Set(replayIds)).toEqual(new Set(scoreIds));
}

beforeEach(async () => {
  await deletePuzzleDB();
});

afterEach(async () => {
  await closeDB();
  await deletePuzzleDB();
});

describe('probeScoreStorage', () => {
  it('IndexedDB 可用时正常打开连接', async () => {
    await expect(probeScoreStorage()).resolves.toBeUndefined();
  });
});

describe('addScoreWithReplay / loadReplay', () => {
  it('原子保存成绩和录像，并把时间保留到 3 位小数', async () => {
    await addScoreWithReplay(
      createScore({ durationMs: 1.2346, observeMs: 0.5678 }),
      createReplay(),
    );

    expect(await getScoreById('score-1')).toMatchObject({
      durationMs: 1.235,
      observeMs: 0.568,
    });
    expect(await loadReplay('score-1')).toEqual(createReplay());
    await expectNoOrphanReplays();
  });

  it('重复 ID 时事务回滚，不覆盖旧成绩或留下孤立录像', async () => {
    await addScoreWithReplay(createScore(), createReplay());

    await expect(
      addScoreWithReplay(
        createScore({ moveCount: 1 }),
        createReplay('score-1', [{ direction: 'U', timeMs: 0 }]),
      ),
    ).rejects.toMatchObject({ code: 'validation' });

    expect(await getScoreById('score-1')).toMatchObject({ moveCount: 0 });
    expect(await loadReplay('score-1')).toEqual(createReplay());
    await expectNoOrphanReplays();
  });

  it('校验成绩 ID、步数和数据格式', async () => {
    await expect(
      addScoreWithReplay(createScore({ id: 'a' }), createReplay('b')),
    ).rejects.toBeInstanceOf(DataStoreError);

    await expect(
      addScoreWithReplay(createScore({ id: 'a', moveCount: 1 }), createReplay('a')),
    ).rejects.toMatchObject({ code: 'validation' });

    await expect(
      addScoreWithReplay(createScore({ id: 'a', durationMs: -1 }), createReplay('a')),
    ).rejects.toMatchObject({ code: 'validation' });
  });

  it('保存并读取 3,000 步长录像', async () => {
    const moves: MoveRecord[] = Array.from({ length: 3_000 }, (_, index) => ({
      direction: index % 2 === 0 ? 'U' : 'D',
      timeMs: index + 0.1234,
    }));
    const score = createScore({
      id: 'long',
      size: 10,
      moveCount: moves.length,
      durationMs: 3_000,
    });

    await addScoreWithReplay(score, createReplay('long', moves));

    const replay = await loadReplay('long');
    expect(replay?.moves).toHaveLength(3_000);
    expect(replay?.moves[0].timeMs).toBe(0.123);
    expect(replay?.moves.at(-1)?.timeMs).toBe(roundTimeMs(2_999.1234));
  });
});

describe('查询与计数', () => {
  it('按桶读取，按事件跨分组计数', async () => {
    await addScoreWithReplay(createScore({ id: 'a' }), createReplay('a'));
    await addScoreWithReplay(createScore({ id: 'b', size: 4 }), createReplay('b'));
    await addScoreWithReplay(createScore({ id: 'c', gameMode: 'blind' }), createReplay('c'));
    await addScoreWithReplay(createScore({ id: 'd', groupId: 2 }), createReplay('d'));

    const bucket = { size: 3, gameMode: 'normal', groupId: 1 } as const;
    expect((await listScoresByBucket(bucket)).map((score) => score.id)).toEqual(['a']);
    expect(await countScoresByBucket(bucket)).toBe(1);
    expect(await countScoresByEvent(3, 'normal')).toBe(2);
    expect(await countScoresByEvent(3, 'blind')).toBe(1);
    expect(await countScoresByEvent(4, 'normal')).toBe(1);
    expect(await countAllScores()).toBe(4);
  });

  it('删除单条成绩时同时删除录像', async () => {
    await addScoreWithReplay(createScore({ id: 'a' }), createReplay('a'));
    await addScoreWithReplay(createScore({ id: 'b' }), createReplay('b'));

    await removeScore('a');
    await removeScore('missing');

    expect(await getScoreById('a')).toBeNull();
    expect(await loadReplay('a')).toBeNull();
    expect(await getScoreById('b')).not.toBeNull();
    expect(await loadReplay('b')).not.toBeNull();
    await expectNoOrphanReplays();
  });
});

describe('清空', () => {
  it('按桶清空只删除目标桶，并返回数量', async () => {
    await addScoreWithReplay(createScore({ id: 'a' }), createReplay('a'));
    await addScoreWithReplay(createScore({ id: 'b', size: 4 }), createReplay('b'));
    await addScoreWithReplay(createScore({ id: 'c', gameMode: 'blind' }), createReplay('c'));

    expect(await clearScoresByBucket({ size: 3, gameMode: 'normal', groupId: 1 })).toBe(1);

    expect(await getScoreById('a')).toBeNull();
    expect(await loadReplay('a')).toBeNull();
    expect(await getScoreById('b')).not.toBeNull();
    expect(await getScoreById('c')).not.toBeNull();
    await expectNoOrphanReplays();
  });

  it('按事件清空只删除该事件的 5 个分组，其他事件保留', async () => {
    await addScoreWithReplay(createScore({ id: 'a' }), createReplay('a'));
    await addScoreWithReplay(createScore({ id: 'b', groupId: 2 }), createReplay('b'));
    await addScoreWithReplay(createScore({ id: 'c', gameMode: 'blind' }), createReplay('c'));
    await addScoreWithReplay(createScore({ id: 'd', size: 4 }), createReplay('d'));
    await addScoreWithReplay(createScore({ id: 'e', groupId: 5 }), createReplay('e'));

    expect(await clearScoresByEvent(3, 'normal')).toBe(3);

    expect(await countScoresByEvent(3, 'normal')).toBe(0);
    expect(await getScoreById('a')).toBeNull();
    expect(await getScoreById('b')).toBeNull();
    expect(await getScoreById('e')).toBeNull();
    expect(await getScoreById('c')).not.toBeNull();
    expect(await getScoreById('d')).not.toBeNull();
    expect(await loadReplay('c')).not.toBeNull();
    expect(await loadReplay('d')).not.toBeNull();
    await expectNoOrphanReplays();
  });

  it('清空全部成绩与录像', async () => {
    await addScoreWithReplay(createScore({ id: 'a' }), createReplay('a'));
    await addScoreWithReplay(createScore({ id: 'b' }), createReplay('b'));

    await clearAllScores();

    expect(await countAllScores()).toBe(0);
    expect(await getScoreById('a')).toBeNull();
    expect(await loadReplay('a')).toBeNull();
    await expectNoOrphanReplays();

    await clearAllScores();
  });
});

describe('损坏数据', () => {
  it('过滤损坏成绩，损坏录像返回 null', async () => {
    const database = await getDB();
    await database.put('scores', {
      ...createScore({ id: 'bad' }),
      durationMs: Number.NaN,
    } as unknown as ScoreRecord);
    await database.put('replays', {
      scoreId: 'bad',
      directions: 'X',
      timeDeltas: [0],
    } as StoredReplayV2);

    expect(await getScoreById('bad')).toBeNull();
    expect(await listScoresByBucket({ size: 3, gameMode: 'normal', groupId: 1 })).toEqual([]);
    expect(await loadReplay('bad')).toBeNull();
  });
});

describe('参数边界', () => {
  it('空 ID 查询/删除安全返回', async () => {
    expect(await getScoreById('')).toBeNull();
    expect(await loadReplay('')).toBeNull();
    await expect(removeScore('')).resolves.toBeUndefined();
  });

  it('非法事件参数拒绝按事件操作', async () => {
    await expect(countScoresByEvent(11 as PuzzleSize, 'normal')).rejects.toMatchObject({
      code: 'validation',
    });
    await expect(countScoresByEvent(3, 'other' as GameMode)).rejects.toMatchObject({
      code: 'validation',
    });
    await expect(clearScoresByEvent(3, 'other' as GameMode)).rejects.toMatchObject({
      code: 'validation',
    });
  });
});
