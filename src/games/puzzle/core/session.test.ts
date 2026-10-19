import { describe, expect, it } from 'vitest';
import type { Board, Direction, GroupId, PuzzleSize, SessionConfig } from '../types';
import {
  createSession,
  getSessionResult,
  getSessionView,
  moveByDirection,
  moveByTile,
} from './session';

const EPOCH = 1_700_000_000_000;
const CREATED_AT = 1_000;
const SOLVED_3: Board = [1, 2, 3, 4, 5, 6, 7, 8, 0];
/** 3×3，空白在中心；先 L 再 U 可以复原。 */
const TWO_MOVE_SCRAMBLE: Board = [1, 2, 3, 4, 0, 5, 7, 8, 6];

function createConfig(overrides: Partial<SessionConfig> = {}): SessionConfig {
  return {
    size: 3,
    gameMode: 'normal',
    moveMode: 'slide',
    groupId: 1,
    scramble: TWO_MOVE_SCRAMBLE,
    isRetry: false,
    createdAtEpochMs: EPOCH,
    ...overrides,
  };
}

function startSession(overrides: Partial<SessionConfig> = {}) {
  return createSession(createConfig(overrides), CREATED_AT);
}

describe('createSession', () => {
  it('初始化观察阶段与空移动记录', () => {
    const state = startSession();

    expect(state).toMatchObject({
      phase: 'observing',
      createdAtMs: CREATED_AT,
      firstMoveAtMs: null,
      solvedAtMs: null,
      moves: [],
    });
    expect(state.board).toEqual(TWO_MOVE_SCRAMBLE);
    expect(state.config.createdAtEpochMs).toBe(EPOCH);
  });

  it('复制打乱数组，外部修改不影响当前局', () => {
    const scramble = [...TWO_MOVE_SCRAMBLE];
    const state = createSession(createConfig({ scramble }), CREATED_AT);

    scramble[0] = 99;

    expect(state.board).toEqual(TWO_MOVE_SCRAMBLE);
    expect(state.config.scramble).toEqual(TWO_MOVE_SCRAMBLE);
  });

  it('拒绝非法阶数', () => {
    const invalidSize = 11 as unknown as PuzzleSize;
    expect(() => createSession(createConfig({ size: invalidSize }), CREATED_AT)).toThrow(
      RangeError,
    );
  });

  it('拒绝长度或内容不合法的打乱', () => {
    expect(() => createSession(createConfig({ scramble: [1, 2, 3] }), CREATED_AT)).toThrow(
      RangeError,
    );
    expect(() =>
      createSession(createConfig({ scramble: [1, 1, 2, 3, 4, 5, 6, 7, 0] }), CREATED_AT),
    ).toThrow(RangeError);
  });

  it('拒绝非法分组编号', () => {
    const invalidGroupId = 0 as unknown as GroupId;
    expect(() => createSession(createConfig({ groupId: invalidGroupId }), CREATED_AT)).toThrow(
      RangeError,
    );
  });

  it('拒绝非法 epoch 或单调时钟', () => {
    expect(() => createSession(createConfig({ createdAtEpochMs: Number.NaN }), CREATED_AT)).toThrow(
      RangeError,
    );
    expect(() => createSession(createConfig(), -1)).toThrow(RangeError);
    expect(() => createSession(createConfig(), Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('moveByDirection', () => {
  it('第一次有效移动进入 running 并记录相对创建时刻的时间', () => {
    const state = startSession();
    const next = moveByDirection(state, 'L', 2_000);

    expect(next.phase).toBe('running');
    expect(next.firstMoveAtMs).toBe(2_000);
    expect(next.solvedAtMs).toBeNull();
    expect(next.board).toEqual([1, 2, 3, 4, 5, 0, 7, 8, 6]);
    expect(next.moves).toEqual([{ direction: 'L', timeMs: 1_000 }]);
  });

  it('复原后进入 solved 并锁定棋盘', () => {
    const running = moveByDirection(startSession(), 'L', 2_000);
    const solved = moveByDirection(running, 'U', 4_000);

    expect(solved.phase).toBe('solved');
    expect(solved.board).toEqual(SOLVED_3);
    expect(solved.solvedAtMs).toBe(4_000);
    expect(moveByDirection(solved, 'D', 5_000)).toBe(solved);
  });

  it('越界方向或非法方向不改变状态', () => {
    const atCorner = createSession(createConfig({ scramble: SOLVED_3 }), CREATED_AT);
    const invalidDirection = 'X' as unknown as Direction;

    expect(moveByDirection(atCorner, 'U', 2_000)).toBe(atCorner);
    expect(moveByDirection(atCorner, 'L', 2_000)).toBe(atCorner);
    expect(moveByDirection(atCorner, invalidDirection, 2_000)).toBe(atCorner);
  });

  it('时钟回拨时 timeMs 保持非负且单调不减', () => {
    const first = moveByDirection(startSession(), 'L', 900);
    const second = moveByDirection(first, 'U', 950);

    expect(first.firstMoveAtMs).toBe(CREATED_AT);
    expect(second.moves.map((move) => move.timeMs)).toEqual([0, 0]);
    expect(second.solvedAtMs).toBe(CREATED_AT);
  });

  it('不修改入参 state', () => {
    const state = startSession();
    const before = structuredClone(state);

    moveByDirection(state, 'L', 2_000);

    expect(state).toEqual(before);
  });
});

describe('moveByTile', () => {
  const SCRAMBLE_4: Board = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0, 13, 14, 15];
  const SOLVED_4: Board = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];

  function start4(): ReturnType<typeof createSession> {
    return createSession(createConfig({ size: 4, scramble: SCRAMBLE_4 }), CREATED_AT);
  }

  it('整行移动记录多步并共享同一个时间', () => {
    const state = start4();
    const next = moveByTile(state, 15, 3_000);

    expect(next.moves).toHaveLength(3);
    expect(next.moves).toEqual([
      { direction: 'L', timeMs: 2_000 },
      { direction: 'L', timeMs: 2_000 },
      { direction: 'L', timeMs: 2_000 },
    ]);
    expect(next.board).toEqual(SOLVED_4);
    expect(next.phase).toBe('solved');
    expect(next.firstMoveAtMs).toBe(3_000);
    expect(next.solvedAtMs).toBe(3_000);
  });

  it('不同行列、点击空白或非法索引时不移动', () => {
    const state = start4();

    expect(moveByTile(state, 1, 3_000)).toBe(state);
    expect(moveByTile(state, 12, 3_000)).toBe(state);
    expect(moveByTile(state, -1, 3_000)).toBe(state);
    expect(moveByTile(state, 16, 3_000)).toBe(state);
  });

  it('复原后拒绝继续移动', () => {
    const solved = moveByTile(start4(), 15, 3_000);

    expect(moveByTile(solved, 0, 4_000)).toBe(solved);
  });

  it('不修改入参 state 或棋盘', () => {
    const state = start4();
    const before = structuredClone(state);

    moveByTile(state, 15, 3_000);

    expect(state).toEqual(before);
  });
});

describe('getSessionView', () => {
  it('normal 第一次移动前只累计观察时间，elapsed 为 0', () => {
    const view = getSessionView(startSession(), 1_750);

    expect(view).toEqual({
      phase: 'observing',
      elapsedMs: 0,
      observeMs: 750,
      tps: 0,
      hideNumbers: false,
    });
  });

  it('normal 从第一次移动开始计时', () => {
    const running = moveByDirection(startSession(), 'L', 2_000);
    const view = getSessionView(running, 3_500);

    expect(view.phase).toBe('running');
    expect(view.elapsedMs).toBe(1_500);
    expect(view.observeMs).toBe(1_000);
    expect(view.tps).toBeCloseTo(2 / 3, 10);
    expect(view.hideNumbers).toBe(false);
  });

  it('normal 结算后时间冻结', () => {
    const solved = moveByDirection(moveByDirection(startSession(), 'L', 2_000), 'U', 4_000);
    const view = getSessionView(solved, 99_000);

    expect(view.elapsedMs).toBe(2_000);
    expect(view.observeMs).toBe(1_000);
    expect(view.tps).toBeCloseTo(1, 10);
  });

  it('blind 从创建时刻计时，并在 running 阶段隐藏数字', () => {
    const created = startSession({ gameMode: 'blind' });
    const observing = getSessionView(created, 3_000);

    expect(observing).toMatchObject({
      phase: 'observing',
      elapsedMs: 2_000,
      observeMs: 2_000,
      hideNumbers: false,
    });

    const running = moveByDirection(created, 'L', 4_000);
    const view = getSessionView(running, 6_000);

    expect(view.elapsedMs).toBe(5_000);
    expect(view.observeMs).toBe(3_000);
    expect(view.hideNumbers).toBe(true);
  });

  it('blind 复原后恢复数字并冻结时间', () => {
    const running = moveByDirection(startSession({ gameMode: 'blind' }), 'L', 4_000);
    const solved = moveByDirection(running, 'U', 7_000);
    const view = getSessionView(solved, 12_000);

    expect(view.elapsedMs).toBe(6_000);
    expect(view.observeMs).toBe(3_000);
    expect(view.hideNumbers).toBe(false);
    expect(view.tps).toBeCloseTo(2 / 6, 10);
  });

  it('nowMs 早于创建时刻或非法时按 0 计时处理', () => {
    const state = startSession();

    expect(getSessionView(state, 0)).toMatchObject({ elapsedMs: 0, observeMs: 0 });
    expect(getSessionView(state, Number.NaN)).toMatchObject({ elapsedMs: 0, observeMs: 0 });
  });
});

describe('getSessionResult', () => {
  it('未复原时返回 null', () => {
    expect(getSessionResult(startSession())).toBeNull();
    expect(getSessionResult(moveByDirection(startSession(), 'L', 2_000))).toBeNull();
  });

  it('normal 结果包含事实字段并按剩余字段派生时间', () => {
    const solved = moveByDirection(moveByDirection(startSession(), 'L', 2_000), 'U', 4_000);
    const result = getSessionResult(solved);

    expect(result).toEqual({
      size: 3,
      gameMode: 'normal',
      moveMode: 'slide',
      groupId: 1,
      durationMs: 2_000,
      observeMs: 1_000,
      moveCount: 2,
      scramble: TWO_MOVE_SCRAMBLE,
      moves: [
        { direction: 'L', timeMs: 1_000 },
        { direction: 'U', timeMs: 3_000 },
      ],
      manhattanDistance: 2,
      startedAt: EPOCH + 1_000,
      finishedAt: EPOCH + 3_000,
      isRetry: false,
    });
    expect(result!.startedAt + result!.durationMs).toBe(result!.finishedAt);
  });

  it('blind 时长包含观察时间，startedAt 为创建时刻', () => {
    const running = moveByDirection(startSession({ gameMode: 'blind' }), 'L', 4_000);
    const solved = moveByDirection(running, 'U', 7_000);
    const result = getSessionResult(solved);

    expect(result).toMatchObject({
      durationMs: 6_000,
      observeMs: 3_000,
      startedAt: EPOCH,
      finishedAt: EPOCH + 6_000,
    });
  });

  it('重玩结果保留 retry 标记但不影响其他字段', () => {
    const solved = moveByDirection(
      moveByDirection(startSession({ isRetry: true, retryOf: 'score-1' }), 'L', 2_000),
      'U',
      4_000,
    );
    const result = getSessionResult(solved);

    expect(result).toMatchObject({ isRetry: true, retryOf: 'score-1', moveCount: 2 });
  });
});
