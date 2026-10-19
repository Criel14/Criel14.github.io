import type { MoveRecord, ReplayRecord } from '../types';
import { isDirection } from '../core/moves';
import { DataStoreError } from './errors';
import { roundTimeMs } from './time';

/** 单条录像允许的最大步数；防止损坏数据分配超大数组。 */
export const MAX_REPLAY_MOVES = 100_000;

export interface StoredReplayV2 {
  readonly scoreId: string;
  /** 每个字符一步，只允许 U/D/L/R，长度等于步数。 */
  readonly directions: string;
  /**
   * 时间增量，单位 ms，与 directions 等长。
   * 第 0 项是相对创建时刻的 timeMs；后续项是相对上一步的增量。
   * 持久化时统一四舍五入到 3 位小数。
   */
  readonly timeDeltas: readonly number[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function validationError(message: string): DataStoreError {
  return new DataStoreError('validation', message);
}

/**
 * 校验 IndexedDB 中的紧凑录像结构。
 * 这里只做存储格式校验，不校验 directions 能否在当前盘面执行；后者属于回放逻辑。
 */
export function isStoredReplayV2(value: unknown): value is StoredReplayV2 {
  if (!isRecord(value)) {
    return false;
  }

  const { scoreId, directions, timeDeltas } = value;
  if (typeof scoreId !== 'string' || scoreId.length === 0) {
    return false;
  }
  if (typeof directions !== 'string' || directions.length > MAX_REPLAY_MOVES) {
    return false;
  }
  if (!Array.isArray(timeDeltas) || timeDeltas.length !== directions.length) {
    return false;
  }
  if (timeDeltas.length > MAX_REPLAY_MOVES) {
    return false;
  }

  for (const direction of directions) {
    if (!isDirection(direction)) {
      return false;
    }
  }

  let cumulativeTimeMs = 0;
  for (const delta of timeDeltas) {
    if (typeof delta !== 'number' || !Number.isFinite(delta) || delta < 0) {
      return false;
    }
    cumulativeTimeMs = roundTimeMs(cumulativeTimeMs + delta);
    if (!Number.isFinite(cumulativeTimeMs) || cumulativeTimeMs > Number.MAX_SAFE_INTEGER) {
      return false;
    }
  }

  return true;
}

/**
 * 把运行时 ReplayRecord 编码为紧凑格式。
 *
 * 时间先按绝对时间四舍五入到 3 位小数，再计算增量；这样解码后的
 * 累计误差不会随步数累加，也不会出现长录像常见的浮点尾数。
 */
export function encodeReplay(replay: ReplayRecord): StoredReplayV2 {
  if (typeof replay.scoreId !== 'string' || replay.scoreId.length === 0) {
    throw validationError('录像 scoreId 必须是非空字符串');
  }
  if (!Array.isArray(replay.moves)) {
    throw validationError('录像 moves 必须是数组');
  }
  if (replay.moves.length > MAX_REPLAY_MOVES) {
    throw validationError(`录像步数不能超过 ${MAX_REPLAY_MOVES}`);
  }

  const directions: string[] = [];
  const timeDeltas: number[] = [];
  let previousOriginalTimeMs = 0;
  let previousRoundedTimeMs = 0;

  for (let index = 0; index < replay.moves.length; index += 1) {
    const move: MoveRecord = replay.moves[index];
    const step = index + 1;

    if (!isDirection(move.direction)) {
      throw validationError(`第 ${step} 步方向非法`);
    }
    if (!Number.isFinite(move.timeMs) || move.timeMs < 0) {
      throw validationError(`第 ${step} 步时间必须是非负有限数`);
    }
    if (move.timeMs < previousOriginalTimeMs) {
      throw validationError(`第 ${step} 步时间回退`);
    }

    const roundedTimeMs = roundTimeMs(move.timeMs);
    if (roundedTimeMs > Number.MAX_SAFE_INTEGER) {
      throw validationError(`第 ${step} 步时间超过可安全存储的范围`);
    }

    const delta = roundTimeMs(roundedTimeMs - previousRoundedTimeMs);
    if (delta < 0) {
      throw validationError(`第 ${step} 步时间增量非法`);
    }

    directions.push(move.direction);
    timeDeltas.push(delta);
    previousOriginalTimeMs = move.timeMs;
    previousRoundedTimeMs = roundedTimeMs;
  }

  return {
    scoreId: replay.scoreId,
    directions: directions.join(''),
    timeDeltas,
  };
}

/** 解码紧凑录像；格式非法返回 null，不把异常抛到页面。 */
export function decodeReplay(stored: unknown): ReplayRecord | null {
  if (!isStoredReplayV2(stored)) {
    return null;
  }

  const moves: MoveRecord[] = [];
  let timeMs = 0;

  for (let index = 0; index < stored.directions.length; index += 1) {
    const direction = stored.directions[index];
    if (!isDirection(direction)) {
      return null;
    }

    timeMs = roundTimeMs(timeMs + stored.timeDeltas[index]);
    moves.push({ direction, timeMs });
  }

  return {
    scoreId: stored.scoreId,
    moves,
  };
}
