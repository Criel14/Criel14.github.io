import type { Board, MoveRecord, ReplayRecord, ScoreRecord } from '../types';
import { isPuzzleSize, isValidBoard } from './board';
import { applyMove, isDirection } from './moves';

/**
 * 回放时间轴上的一帧。
 *
 * timeMs 是“播放时间轴”，不是 MoveRecord.timeMs：
 * - normal 会扣掉观察时间；
 * - blind 保留观察等待。
 */
export interface ReplayFrame {
  readonly board: Board;
  /** 已应用的步数；0 表示打乱盘面。 */
  readonly step: number;
  /** 播放时间轴毫秒，从 0 开始单调不减。 */
  readonly timeMs: number;
}

/** 构建时间轴时发现的数据问题；不抛异常，由回放页决定如何提示。 */
export type ReplayIssueCode =
  'invalid-board' | 'move-count-mismatch' | 'invalid-move' | 'non-monotonic-time';

export interface ReplayIssue {
  readonly code: ReplayIssueCode;
  readonly message: string;
  /** 1-based 步号；与具体移动无关的 issue 省略。 */
  readonly step?: number;
}

export interface ReplayTimeline {
  readonly scoreId: string;
  readonly frames: readonly ReplayFrame[];
  /** 播放总时长，单位 ms；保证不小于最后一帧的 timeMs。 */
  readonly durationMs: number;
  readonly issues: readonly ReplayIssue[];
}

/**
 * 根据成绩摘要和录像构建回放时间轴。
 *
 * 设计取舍：
 * - 每一步都保存完整棋盘，换取 seek 的简单实现；10×10 的常见长录像仍可接受。
 * - 数据损坏时尽量保留可播放的前缀，不因为一条坏记录让回放页崩溃。
 * - 初始盘面非法是致命问题，直接返回空时间轴。
 *
 * @param score 成绩摘要；scramble 是开局盘面，observeMs 用于 normal 时间偏移。
 * @param replay 与成绩对应的移动序列；moveCount 不一致只记录 issue，不停止构建。
 */
export function buildReplayTimeline(score: ScoreRecord, replay: ReplayRecord): ReplayTimeline {
  if (
    !isPuzzleSize(score.size) ||
    !Array.isArray(score.scramble) ||
    !isValidBoard(score.scramble, score.size)
  ) {
    return {
      scoreId: score.id,
      frames: [],
      durationMs: 0,
      issues: [
        {
          code: 'invalid-board',
          message: '初始盘面或阶数非法，无法构建回放',
        },
      ],
    };
  }

  const issues: ReplayIssue[] = [];
  const moves: readonly MoveRecord[] = Array.isArray(replay.moves) ? replay.moves : [];

  if (score.moveCount !== moves.length) {
    issues.push({
      code: 'move-count-mismatch',
      message: `成绩步数 ${score.moveCount} 与录像步数 ${moves.length} 不一致`,
    });
  }

  // 成绩数据正常时 observeMs 一定合法；这里做防御性归一化，避免坏数据产生 NaN 时间。
  const observeMs = Number.isFinite(score.observeMs) ? Math.max(0, score.observeMs) : 0;
  const frames: ReplayFrame[] = [
    {
      board: [...score.scramble],
      step: 0,
      timeMs: 0,
    },
  ];

  let board: Board = frames[0].board;
  let previousTimeMs = 0;

  for (let index = 0; index < moves.length; index += 1) {
    const move: MoveRecord = moves[index];
    const step = index + 1;

    if (!isDirection(move.direction)) {
      issues.push({
        code: 'invalid-move',
        message: `第 ${step} 步方向非法，回放在此停止`,
        step,
      });
      break;
    }

    const nextBoard = applyMove(board, move.direction, score.size);
    if (nextBoard === null) {
      issues.push({
        code: 'invalid-move',
        message: `第 ${step} 步在当前盘面无法执行，回放在此停止`,
        step,
      });
      break;
    }

    const rawTime = score.gameMode === 'normal' ? move.timeMs - observeMs : move.timeMs;
    const invalidTime =
      !Number.isFinite(move.timeMs) ||
      move.timeMs < 0 ||
      !Number.isFinite(rawTime) ||
      rawTime < previousTimeMs;

    let timeMs = Math.max(0, rawTime);
    if (invalidTime) {
      issues.push({
        code: 'non-monotonic-time',
        message: `第 ${step} 步时间非法或回退，已夹到上一帧时间`,
        step,
      });
      timeMs = previousTimeMs;
    }

    frames.push({ board: nextBoard, step, timeMs });
    board = nextBoard;
    previousTimeMs = timeMs;
  }

  const lastFrameTime = frames.at(-1)?.timeMs ?? 0;
  const scoreDuration = Number.isFinite(score.durationMs) ? Math.max(0, score.durationMs) : 0;

  return {
    scoreId: score.id,
    frames,
    durationMs: Math.max(scoreDuration, lastFrameTime),
    issues,
  };
}

/**
 * 返回当前应显示的帧下标；空时间轴返回 -1。
 *
 * 取帧规则：
 * - positionMs 非有限或不超过首帧时间时显示首帧，保证 0 时刻看到打乱盘面；
 * - 其他情况返回最后一个 timeMs <= positionMs 的帧；
 * - 超过末帧时间时停在末帧。
 */
export function getFrameIndexAt(timeline: ReplayTimeline, positionMs: number): number {
  const { frames } = timeline;
  if (frames.length === 0) {
    return -1;
  }

  if (!Number.isFinite(positionMs) || positionMs <= frames[0].timeMs) {
    return 0;
  }

  let low = 0;
  let high = frames.length - 1;

  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (frames[mid].timeMs <= positionMs) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return low;
}

/** 返回 positionMs 对应的帧；空时间轴返回 null。 */
export function getFrameAt(timeline: ReplayTimeline, positionMs: number): ReplayFrame | null {
  const index = getFrameIndexAt(timeline, positionMs);
  return index < 0 ? null : (timeline.frames[index] ?? null);
}
