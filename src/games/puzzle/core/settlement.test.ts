import { describe, expect, it } from 'vitest';
import type { Board, SessionResult } from '../types';
import { createSettlement } from './settlement';

const EPOCH = 1_700_000_000_000;
const SCRAMBLE: Board = [1, 2, 0, 3];

function createResult(overrides: Partial<SessionResult> = {}): SessionResult {
  return {
    size: 2,
    gameMode: 'normal',
    moveMode: 'slide',
    groupId: 1,
    durationMs: 1_234.5,
    observeMs: 500,
    moveCount: 2,
    scramble: SCRAMBLE,
    moves: [
      { direction: 'L', timeMs: 500 },
      { direction: 'U', timeMs: 1_234.5 },
    ],
    manhattanDistance: 2,
    startedAt: EPOCH + 500,
    finishedAt: EPOCH + 1_734.5,
    isRetry: false,
    ...overrides,
  };
}

describe('createSettlement', () => {
  it('只映射成绩事实字段，并生成对应的录像', () => {
    const result = createResult();
    const settlement = createSettlement('score-1', result);

    expect(settlement.score).toEqual({
      id: 'score-1',
      size: 2,
      gameMode: 'normal',
      moveMode: 'slide',
      groupId: 1,
      durationMs: 1_234.5,
      observeMs: 500,
      moveCount: 2,
      scramble: SCRAMBLE,
      finishedAt: EPOCH + 1_734.5,
    });
    expect(settlement.replay).toEqual({
      scoreId: 'score-1',
      moves: [
        { direction: 'L', timeMs: 500 },
        { direction: 'U', timeMs: 1_234.5 },
      ],
    });
    expect(settlement.score).not.toHaveProperty('startedAt');
    expect(settlement.score).not.toHaveProperty('manhattanDistance');
    expect(settlement.score).not.toHaveProperty('isRetry');
    expect(settlement.score).not.toHaveProperty('retryOf');
    expect(settlement.score).not.toHaveProperty('moves');
  });

  it('复制打乱和移动数组，不共享入参引用', () => {
    const result = createResult();
    const settlement = createSettlement('score-1', result);

    expect(settlement.score.scramble).not.toBe(result.scramble);
    expect(settlement.replay.moves).not.toBe(result.moves);
    expect(settlement.replay.moves[0]).not.toBe(result.moves[0]);
  });

  it('拒绝重玩结果和空 ID', () => {
    expect(() =>
      createSettlement('score-1', createResult({ isRetry: true, retryOf: 'old-score' })),
    ).toThrow(RangeError);
    expect(() => createSettlement('', createResult())).toThrow(RangeError);
    expect(() => createSettlement('   ', createResult())).toThrow(RangeError);
  });
});
