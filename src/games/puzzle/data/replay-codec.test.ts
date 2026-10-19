import { describe, expect, it } from 'vitest';
import type { MoveRecord, ReplayRecord } from '../types';
import { DataStoreError } from './errors';
import { decodeReplay, encodeReplay, isStoredReplayV2, MAX_REPLAY_MOVES } from './replay-codec';
import { roundTimeMs } from './time';

function createReplay(moves: readonly MoveRecord[], scoreId = 'score-1'): ReplayRecord {
  return { scoreId, moves };
}

function expectDataStoreError(action: () => void, code: DataStoreError['code']): void {
  try {
    action();
    throw new Error('预期抛出 DataStoreError');
  } catch (error) {
    expect(error).toBeInstanceOf(DataStoreError);
    expect((error as DataStoreError).code).toBe(code);
  }
}

describe('encodeReplay / decodeReplay', () => {
  it('把绝对时间四舍五入到 3 位小数并编码为增量', () => {
    const stored = encodeReplay(
      createReplay([
        { direction: 'L', timeMs: 0.1234 },
        { direction: 'U', timeMs: 1.2346 },
      ]),
    );

    expect(stored).toEqual({
      scoreId: 'score-1',
      directions: 'LU',
      timeDeltas: [0.123, 1.112],
    });

    expect(decodeReplay(stored)?.moves).toEqual([
      { direction: 'L', timeMs: 0.123 },
      { direction: 'U', timeMs: 1.235 },
    ]);
  });

  it('0 步录像往返一致', () => {
    const stored = encodeReplay(createReplay([]));

    expect(stored).toEqual({ scoreId: 'score-1', directions: '', timeDeltas: [] });
    expect(decodeReplay(stored)).toEqual({ scoreId: 'score-1', moves: [] });
  });

  it('拒绝非法方向、负时间、时间回退和超长录像', () => {
    expectDataStoreError(
      () => encodeReplay(createReplay([{ direction: 'X' as MoveRecord['direction'], timeMs: 0 }])),
      'validation',
    );
    expectDataStoreError(
      () => encodeReplay(createReplay([{ direction: 'U', timeMs: -0.001 }])),
      'validation',
    );
    expectDataStoreError(
      () =>
        encodeReplay(
          createReplay([
            { direction: 'U', timeMs: 2 },
            { direction: 'D', timeMs: 1 },
          ]),
        ),
      'validation',
    );
    // 即使四舍五入后相同，也应按原始时间判断回退。
    expectDataStoreError(
      () =>
        encodeReplay(
          createReplay([
            { direction: 'U', timeMs: 1.2344 },
            { direction: 'D', timeMs: 1.2343 },
          ]),
        ),
      'validation',
    );

    const tooManyMoves = new Array<MoveRecord>(MAX_REPLAY_MOVES + 1).fill({
      direction: 'U',
      timeMs: 0,
    });
    expectDataStoreError(() => encodeReplay(createReplay(tooManyMoves)), 'validation');
  });

  it('3,000 步和 10,000 步录像往返一致', () => {
    for (const count of [3_000, 10_000]) {
      const moves = Array.from({ length: count }, (_, index) => ({
        direction: (index % 2 === 0 ? 'U' : 'D') as MoveRecord['direction'],
        timeMs: index + 0.1234,
      }));
      const stored = encodeReplay(createReplay(moves));
      const decoded = decodeReplay(stored);

      expect(decoded?.moves).toHaveLength(count);
      expect(decoded?.moves[0]).toEqual({ direction: 'U', timeMs: 0.123 });
      expect(decoded?.moves.at(-1)?.timeMs).toBe(roundTimeMs(count - 1 + 0.1234));
      expect(decoded?.moves.every((move) => roundTimeMs(move.timeMs) === move.timeMs)).toBe(true);
    }
  });
});

describe('isStoredReplayV2', () => {
  it('接受合法紧凑录像', () => {
    expect(
      isStoredReplayV2({
        scoreId: 'score-1',
        directions: 'LU',
        timeDeltas: [0.123, 1.112],
      }),
    ).toBe(true);
  });

  it('拒绝长度、方向、增量和 scoreId 非法', () => {
    expect(isStoredReplayV2({ scoreId: 'score-1', directions: 'LU', timeDeltas: [0.1] })).toBe(
      false,
    );
    expect(isStoredReplayV2({ scoreId: 'score-1', directions: 'LX', timeDeltas: [0, 0] })).toBe(
      false,
    );
    expect(isStoredReplayV2({ scoreId: 'score-1', directions: 'LU', timeDeltas: [0, -0.1] })).toBe(
      false,
    );
    expect(
      isStoredReplayV2({ scoreId: 'score-1', directions: 'LU', timeDeltas: [0, Number.NaN] }),
    ).toBe(false);
    expect(isStoredReplayV2({ scoreId: '', directions: '', timeDeltas: [] })).toBe(false);
  });

  it('拒绝损坏数据，decodeReplay 返回 null', () => {
    expect(decodeReplay(null)).toBeNull();
    expect(decodeReplay({ scoreId: 'score-1', directions: 'X', timeDeltas: [0] })).toBeNull();
  });
});
