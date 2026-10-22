import type { ReplayRecord, ScoreRecord, SessionResult } from '../types';

/** 一局完成后可以原子写入的成绩摘要与录像。 */
export interface Settlement {
  readonly score: ScoreRecord;
  readonly replay: ReplayRecord;
}

/**
 * 把 solved session 的瞬时结果转换为可保存的成绩与录像。
 *
 * 只保留 ScoreRecord 的事实字段；startedAt、manhattanDistance、isRetry 等
 * 派生或页面状态不落库。重玩结果不计入成绩列表，因此这里直接拒绝。
 */
export function createSettlement(id: string, result: SessionResult): Settlement {
  if (id.trim().length === 0) {
    throw new RangeError('成绩 ID 不能为空');
  }
  if (result.isRetry) {
    throw new RangeError('重玩结果不能保存为成绩');
  }

  const score: ScoreRecord = {
    id,
    size: result.size,
    gameMode: result.gameMode,
    moveMode: result.moveMode,
    groupId: result.groupId,
    durationMs: result.durationMs,
    observeMs: result.observeMs,
    moveCount: result.moveCount,
    scramble: [...result.scramble],
    finishedAt: result.finishedAt,
  };

  const replay: ReplayRecord = {
    scoreId: id,
    moves: result.moves.map((move) => ({ ...move })),
  };

  return { score, replay };
}
