import type {
  Direction,
  MoveRecord,
  SessionConfig,
  SessionResult,
  SessionState,
  SessionView,
} from '../types';
import { isPuzzleSize, isSolved, isValidBoard } from './board';
import { isGroupId } from './groups';
import { applyMove, isDirection, planLineMove } from './moves';
import { calculateTps } from './score';
import { manhattanDistance } from './scramble';

/**
 * 创建一局游戏。
 *
 * 配置非法时抛 RangeError：这是调用方编程错误或存储数据损坏，
 * 不应静默降级成一局无法解释的游戏。
 * state 会复制 config 和 scramble，避免外部继续修改原数组影响当前局。
 *
 * @param createdAtMs 调用方注入的单调时钟（页面使用 performance.now()），必须为非负有限值。
 */
export function createSession(config: SessionConfig, createdAtMs: number): SessionState {
  if (!isPuzzleSize(config.size)) {
    throw new RangeError('size 必须是 2 到 10 的整数');
  }
  if (!isValidBoard(config.scramble, config.size)) {
    throw new RangeError('scramble 必须是当前阶数的完整排列');
  }
  if (!isGroupId(config.groupId)) {
    throw new RangeError('groupId 必须是 1 到 10 的整数');
  }
  if (!Number.isFinite(config.createdAtEpochMs)) {
    throw new RangeError('createdAtEpochMs 必须是有限数字');
  }
  if (!Number.isFinite(createdAtMs) || createdAtMs < 0) {
    throw new RangeError('createdAtMs 必须是大于等于 0 的有限数字');
  }

  const scramble = [...config.scramble];
  return {
    config: { ...config, scramble },
    board: scramble,
    moves: [],
    phase: 'observing',
    createdAtMs,
    firstMoveAtMs: null,
    solvedAtMs: null,
  };
}

/**
 * 计算本次移动相对创建时刻的时间，并保证单调不减。
 *
 * MoveRecord.timeMs 的不变量是非负、有限、按数组顺序单调不减。
 * 时钟回拨或传入非法时间时夹取到上一移动时间，而不是写入负值或 NaN。
 */
function getMoveTimeMs(state: SessionState, atMs: number): number {
  const previousTimeMs = state.moves.at(-1)?.timeMs ?? 0;
  if (!Number.isFinite(atMs)) {
    return previousTimeMs;
  }
  return Math.max(previousTimeMs, Math.max(0, atMs - state.createdAtMs));
}

/** 把一组方向写入状态；调用方保证至少有一个方向。 */
function applySessionMoves(
  state: SessionState,
  board: SessionState['board'],
  directions: readonly Direction[],
  timeMs: number,
): SessionState {
  const absoluteAtMs = state.createdAtMs + timeMs;
  const firstMoveAtMs = state.firstMoveAtMs ?? absoluteAtMs;
  const nextMoves: MoveRecord[] = directions.map((direction) => ({ direction, timeMs }));
  const solved = isSolved(board, state.config.size);

  return {
    ...state,
    board,
    moves: [...state.moves, ...nextMoves],
    phase: solved ? 'solved' : 'running',
    firstMoveAtMs,
    solvedAtMs: solved ? absoluteAtMs : null,
  };
}

/**
 * 键盘模式：按方块移动方向执行一步。
 * 复原后锁定；方向越界或非法方向返回原 state，不推进计时。
 */
export function moveByDirection(
  state: SessionState,
  direction: Direction,
  atMs: number,
): SessionState {
  if (state.phase === 'solved' || !isDirection(direction)) {
    return state;
  }

  const board = applyMove(state.board, direction, state.config.size);
  if (board === null) {
    return state;
  }

  return applySessionMoves(state, board, [direction], getMoveTimeMs(state, atMs));
}

/**
 * 点击 / 滑动模式：按 planLineMove 一次推动整行或整列。
 * 多步共享同一个 timeMs，moveCount 等于实际步数；没有可移动方块时返回原 state。
 */
export function moveByTile(state: SessionState, tileIndex: number, atMs: number): SessionState {
  if (state.phase === 'solved') {
    return state;
  }

  const plan = planLineMove(state.board, tileIndex, state.config.size);
  if (plan.moves.length === 0) {
    return state;
  }

  return applySessionMoves(state, plan.board, plan.moves, getMoveTimeMs(state, atMs));
}

/**
 * 生成 HUD 视图。
 *
 * - normal 第一次移动前 elapsedMs 为 0；之后从 firstMoveAtMs 计时。
 * - blind 从 createdAtMs 计时，包含观察时间；只有 running 阶段隐藏数字。
 * - observeMs 在第一次移动前返回当前观察时长，首次移动后固定。
 * - solved 后 elapsedMs 以 solvedAtMs 为终点，不受后续 nowMs 影响。
 */
export function getSessionView(state: SessionState, nowMs: number): SessionView {
  const endMs = state.solvedAtMs ?? Number.POSITIVE_INFINITY;
  const rawNowMs = Number.isFinite(nowMs) ? nowMs : state.createdAtMs;
  const currentMs = Math.max(state.createdAtMs, Math.min(rawNowMs, endMs));

  const observeMs =
    state.firstMoveAtMs === null
      ? currentMs - state.createdAtMs
      : Math.max(0, state.firstMoveAtMs - state.createdAtMs);

  const elapsedMs =
    state.config.gameMode === 'normal'
      ? state.firstMoveAtMs === null
        ? 0
        : Math.max(0, currentMs - state.firstMoveAtMs)
      : Math.max(0, currentMs - state.createdAtMs);

  return {
    phase: state.phase,
    elapsedMs,
    observeMs,
    tps: calculateTps(state.moves.length, elapsedMs),
    hideNumbers: state.config.gameMode === 'blind' && state.phase === 'running',
  };
}

/**
 * 复原后返回结算结果；未复原返回 null。
 *
 * createdAtMs 是单调时钟，createdAtEpochMs 是创建时的墙钟时间。
 * 因此 epoch 映射必须使用相对创建时刻的差值：
 *   startedAt  = createdAtEpochMs + (firstMoveAtMs - createdAtMs)  // normal
 *   finishedAt = createdAtEpochMs + (solvedAtMs - createdAtMs)
 * 不能直接把单调时钟值加到 epoch 上，否则 performance.now() 的起始值会污染结果。
 */
export function getSessionResult(state: SessionState): SessionResult | null {
  if (state.phase !== 'solved' || state.firstMoveAtMs === null || state.solvedAtMs === null) {
    return null;
  }

  const { config } = state;
  const observeMs = Math.max(0, state.firstMoveAtMs - state.createdAtMs);
  const durationMs =
    config.gameMode === 'normal'
      ? Math.max(0, state.solvedAtMs - state.firstMoveAtMs)
      : Math.max(0, state.solvedAtMs - state.createdAtMs);
  const startedAt =
    config.gameMode === 'normal' ? config.createdAtEpochMs + observeMs : config.createdAtEpochMs;
  const finishedAt = config.createdAtEpochMs + (state.solvedAtMs - state.createdAtMs);

  return {
    size: config.size,
    gameMode: config.gameMode,
    moveMode: config.moveMode,
    groupId: config.groupId,
    durationMs,
    observeMs,
    moveCount: state.moves.length,
    scramble: [...config.scramble],
    moves: state.moves.map((move) => ({ ...move })),
    manhattanDistance: manhattanDistance(config.scramble, config.size),
    startedAt,
    finishedAt,
    isRetry: config.isRetry,
    ...(config.retryOf === undefined ? {} : { retryOf: config.retryOf }),
  };
}
