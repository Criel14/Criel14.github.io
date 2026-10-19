import { describe, expect, it } from 'vitest';
import type { Board, Direction, PuzzleSize, ReplayRecord, ScoreRecord } from '../types';
import { buildReplayTimeline, getFrameAt, getFrameIndexAt } from './replay';

const TWO_MOVE_SCRAMBLE: Board = [1, 2, 3, 4, 0, 5, 7, 8, 6];
const AFTER_L: Board = [1, 2, 3, 4, 5, 0, 7, 8, 6];
const SOLVED_3: Board = [1, 2, 3, 4, 5, 6, 7, 8, 0];
const EPOCH = 1_700_000_000_000;

function createScore(overrides: Partial<ScoreRecord> = {}): ScoreRecord {
  return {
    id: 'score-1',
    size: 3,
    gameMode: 'normal',
    moveMode: 'slide',
    groupId: 1,
    durationMs: 2_000,
    observeMs: 1_000,
    moveCount: 2,
    scramble: TWO_MOVE_SCRAMBLE,
    finishedAt: EPOCH,
    ...overrides,
  };
}

function createReplay(overrides: Partial<ReplayRecord> = {}): ReplayRecord {
  return {
    scoreId: 'score-1',
    moves: [
      { direction: 'L', timeMs: 1_000 },
      { direction: 'U', timeMs: 3_000 },
    ],
    ...overrides,
  };
}

describe('buildReplayTimeline', () => {
  it('0 步成绩只有打乱首帧', () => {
    const timeline = buildReplayTimeline(
      createScore({ moveCount: 0, durationMs: 1_500 }),
      createReplay({ moves: [] }),
    );

    expect(timeline.frames).toEqual([
      {
        board: TWO_MOVE_SCRAMBLE,
        step: 0,
        timeMs: 0,
      },
    ]);
    expect(timeline.durationMs).toBe(1_500);
    expect(timeline.issues).toEqual([]);
  });

  it('normal 扣除观察时间，同时间的多步一起显示', () => {
    const timeline = buildReplayTimeline(createScore(), createReplay());

    expect(timeline.frames.map((frame) => frame.timeMs)).toEqual([0, 0, 2_000]);
    expect(timeline.frames.map((frame) => frame.step)).toEqual([0, 1, 2]);
    expect(timeline.frames[1].board).toEqual(AFTER_L);
    expect(timeline.frames[2].board).toEqual(SOLVED_3);
    expect(timeline.durationMs).toBe(2_000);
    expect(timeline.issues).toEqual([]);

    // 0 时刻优先显示打乱盘面；跨过 0 后显示同时间组的最后一帧。
    expect(getFrameAt(timeline, 0)?.step).toBe(0);
    expect(getFrameAt(timeline, 0.5)?.step).toBe(1);
    expect(getFrameAt(timeline, 2_000)?.step).toBe(2);
  });

  it('blind 保留观察等待，首步前仍显示打乱盘面', () => {
    const timeline = buildReplayTimeline(
      createScore({
        gameMode: 'blind',
        durationMs: 6_000,
        observeMs: 3_000,
      }),
      createReplay({
        moves: [
          { direction: 'L', timeMs: 3_000 },
          { direction: 'U', timeMs: 6_000 },
        ],
      }),
    );

    expect(timeline.frames.map((frame) => frame.timeMs)).toEqual([0, 3_000, 6_000]);
    expect(timeline.durationMs).toBe(6_000);
    expect(getFrameAt(timeline, 2_999)?.step).toBe(0);
    expect(getFrameAt(timeline, 3_000)?.step).toBe(1);
    expect(getFrameAt(timeline, 6_000)?.step).toBe(2);
  });

  it('moveCount 不一致时记录 issue，但仍继续构建', () => {
    const timeline = buildReplayTimeline(createScore({ moveCount: 3 }), createReplay());

    expect(timeline.frames).toHaveLength(3);
    expect(timeline.issues).toEqual([expect.objectContaining({ code: 'move-count-mismatch' })]);
  });

  it('初始盘面或阶数非法时返回空时间轴', () => {
    const invalidBoard = buildReplayTimeline(createScore({ scramble: [1, 2, 3] }), createReplay());
    const invalidSize = buildReplayTimeline(
      createScore({ size: 11 as unknown as PuzzleSize }),
      createReplay(),
    );

    for (const timeline of [invalidBoard, invalidSize]) {
      expect(timeline.frames).toEqual([]);
      expect(timeline.durationMs).toBe(0);
      expect(timeline.issues).toEqual([expect.objectContaining({ code: 'invalid-board' })]);
    }
  });

  it('非法方向在当前盘面无法执行时保留已构建帧并停止', () => {
    const invalidDirection = buildReplayTimeline(
      createScore({ scramble: SOLVED_3, moveCount: 1, durationMs: 1_000 }),
      createReplay({
        moves: [{ direction: 'X' as unknown as Direction, timeMs: 1_000 }],
      }),
    );
    const impossibleMove = buildReplayTimeline(
      createScore({ scramble: SOLVED_3, moveCount: 1, durationMs: 1_000 }),
      createReplay({
        moves: [{ direction: 'U', timeMs: 1_000 }],
      }),
    );

    for (const timeline of [invalidDirection, impossibleMove]) {
      expect(timeline.frames).toHaveLength(1);
      expect(timeline.frames[0].board).toEqual(SOLVED_3);
      expect(timeline.issues).toEqual([expect.objectContaining({ code: 'invalid-move', step: 1 })]);
    }
  });

  it('时间倒退、负数或 NaN 时夹到上一帧并记录 issue', () => {
    const timeline = buildReplayTimeline(
      createScore({ observeMs: 0, durationMs: 3_000, moveCount: 3 }),
      createReplay({
        moves: [
          { direction: 'U', timeMs: 1_000 },
          { direction: 'D', timeMs: 500 },
          { direction: 'U', timeMs: Number.NaN },
        ],
      }),
    );

    expect(timeline.frames.map((frame) => frame.timeMs)).toEqual([0, 1_000, 1_000, 1_000]);
    expect(timeline.issues).toEqual([
      expect.objectContaining({ code: 'non-monotonic-time', step: 2 }),
      expect.objectContaining({ code: 'non-monotonic-time', step: 3 }),
    ]);
  });

  it('负的 move.timeMs 也按非法时间处理', () => {
    const timeline = buildReplayTimeline(
      createScore({ observeMs: 0, durationMs: 1_000, moveCount: 2 }),
      createReplay({
        moves: [
          { direction: 'U', timeMs: -5 },
          { direction: 'D', timeMs: 1_000 },
        ],
      }),
    );

    expect(timeline.frames.map((frame) => frame.timeMs)).toEqual([0, 0, 1_000]);
    expect(timeline.issues).toEqual([
      expect.objectContaining({ code: 'non-monotonic-time', step: 1 }),
    ]);
  });

  it('durationMs 小于末帧时取末帧时间', () => {
    const timeline = buildReplayTimeline(createScore({ durationMs: 500 }), createReplay());

    expect(timeline.frames.at(-1)?.timeMs).toBe(2_000);
    expect(timeline.durationMs).toBe(2_000);
  });

  it('durationMs 非有限或负数时按末帧时间处理', () => {
    for (const durationMs of [Number.NaN, Number.POSITIVE_INFINITY, -100]) {
      const timeline = buildReplayTimeline(createScore({ durationMs }), createReplay());
      expect(timeline.durationMs).toBe(2_000);
    }
  });

  it('observeMs 非法时按 0 处理', () => {
    const timeline = buildReplayTimeline(
      createScore({ observeMs: Number.NaN }),
      createReplay({
        moves: [
          { direction: 'L', timeMs: 1_000 },
          { direction: 'U', timeMs: 3_000 },
        ],
      }),
    );

    expect(timeline.frames.map((frame) => frame.timeMs)).toEqual([0, 1_000, 3_000]);
  });

  it('不修改入参，且首帧不引用外部 scramble 数组', () => {
    const scramble = [...TWO_MOVE_SCRAMBLE];
    const score = createScore({ scramble });
    const replay = createReplay();
    const scoreBefore = structuredClone(score);
    const replayBefore = structuredClone(replay);

    const timeline = buildReplayTimeline(score, replay);

    expect(score).toEqual(scoreBefore);
    expect(replay).toEqual(replayBefore);

    scramble[0] = 99;
    expect(timeline.frames[0].board).toEqual(TWO_MOVE_SCRAMBLE);
  });
});

describe('getFrameIndexAt / getFrameAt', () => {
  const timeline = buildReplayTimeline(createScore(), createReplay());

  it('空时间轴返回 -1 / null', () => {
    const empty = buildReplayTimeline(createScore({ scramble: [1, 2, 3] }), createReplay());

    expect(getFrameIndexAt(empty, 0)).toBe(-1);
    expect(getFrameAt(empty, 0)).toBeNull();
  });

  it('首帧前、非有限位置和 0 时刻显示首帧', () => {
    expect(getFrameIndexAt(timeline, -1)).toBe(0);
    expect(getFrameIndexAt(timeline, Number.NaN)).toBe(0);
    expect(getFrameAt(timeline, Number.POSITIVE_INFINITY)?.step).toBe(0);
    expect(getFrameAt(timeline, 0)?.step).toBe(0);
  });

  it('中间位置返回最后一个不超过 positionMs 的帧', () => {
    expect(getFrameIndexAt(timeline, 0.5)).toBe(1);
    expect(getFrameAt(timeline, 1_999)?.step).toBe(1);
  });

  it('末帧之后停在末帧', () => {
    expect(getFrameIndexAt(timeline, 99_999)).toBe(2);
    expect(getFrameAt(timeline, 99_999)?.step).toBe(2);
  });

  it('多个帧共享时间时，非首帧位置显示同时间组的最后一帧', () => {
    const tied = buildReplayTimeline(
      createScore({ observeMs: 0, durationMs: 1_000, moveCount: 3 }),
      createReplay({
        moves: [
          { direction: 'U', timeMs: 0 },
          { direction: 'D', timeMs: 0 },
          { direction: 'U', timeMs: 1_000 },
        ],
      }),
    );

    expect(getFrameAt(tied, 0)?.step).toBe(0);
    expect(getFrameAt(tied, 0.5)?.step).toBe(2);
    expect(getFrameAt(tied, 1_000)?.step).toBe(3);
  });
});
