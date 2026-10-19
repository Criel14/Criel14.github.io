import { describe, expect, it } from 'vitest';
import type {
  Board,
  Direction,
  MoveRecord,
  PuzzleSize,
  ReplayRecord,
  ScoreRecord,
  SessionResult,
} from '../types';
import { createSolvedBoard } from './board';
import { applyMove, applyMoves, canMove } from './moves';
import { buildReplayTimeline, getFrameAt } from './replay';
import { createPlayback, play, seekToFrame, updatePlayback } from './replay-playback';
import { createSession, getSessionResult, moveByDirection } from './session';

const EPOCH = 1_700_000_000_000;
const SOLVED_3: Board = [1, 2, 3, 4, 5, 6, 7, 8, 0];

function scoreFromResult(id: string, result: SessionResult): ScoreRecord {
  return {
    id,
    size: result.size,
    gameMode: result.gameMode,
    moveMode: result.moveMode,
    groupId: result.groupId,
    durationMs: result.durationMs,
    observeMs: result.observeMs,
    moveCount: result.moveCount,
    scramble: result.scramble,
    finishedAt: result.finishedAt,
  };
}

function replayFromResult(scoreId: string, result: SessionResult): ReplayRecord {
  return {
    scoreId,
    moves: result.moves,
  };
}

/** 4×4 只差最后一行的三个方块；连续三次 L 即可复原。 */
function solve4x4(gameMode: 'normal' | 'blind' = 'normal'): SessionResult {
  const scramble: Board = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0, 13, 14, 15];
  const created = createSession(
    {
      size: 4,
      gameMode,
      moveMode: 'slide',
      groupId: 1,
      scramble,
      isRetry: false,
      createdAtEpochMs: EPOCH,
    },
    1_000,
  );

  let state = moveByDirection(created, 'L', 3_000);
  state = moveByDirection(state, 'L', 4_000);
  state = moveByDirection(state, 'L', 5_000);

  const result = getSessionResult(state);
  if (result === null) {
    throw new Error('测试用例应当已经复原');
  }
  return result;
}

function createSeededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1_664_525) + 1_013_904_223) >>> 0;
    return value / 0x1_0000_0000;
  };
}

const DIRECTIONS: readonly Direction[] = ['U', 'D', 'L', 'R'];
const OPPOSITE: Record<Direction, Direction> = {
  U: 'D',
  D: 'U',
  L: 'R',
  R: 'L',
};

/**
 * 从复原盘面随机走 moveCount 步得到打乱，再反向走回复原，构造长录像。
 * 使用固定种子的 LCG，保证测试确定性。
 */
function createLongReplay(
  size: PuzzleSize,
  moveCount: number,
): { scramble: Board; moves: MoveRecord[] } {
  const random = createSeededRandom(20261019);
  let board = createSolvedBoard(size);
  const path: Direction[] = [];

  for (let index = 0; index < moveCount; index += 1) {
    const candidates = DIRECTIONS.filter((direction) => canMove(board, direction, size));
    const direction = candidates[Math.floor(random() * candidates.length)];
    const next = applyMove(board, direction, size);
    if (next === null) {
      throw new Error(`测试路径第 ${index + 1} 步应当合法`);
    }
    board = next;
    path.push(direction);
  }

  const solution = [...path].reverse().map((direction) => OPPOSITE[direction]);
  return {
    scramble: board,
    moves: solution.map((direction, index) => ({
      direction,
      timeMs: index + 1,
    })),
  };
}

describe('真实 session 回放集成', () => {
  it('normal 4×4 关键时间点的帧正确', () => {
    const result = solve4x4('normal');
    const score = scoreFromResult('normal-4x4', result);
    const replay = replayFromResult('normal-4x4', result);
    const timeline = buildReplayTimeline(score, replay);

    expect(result).toMatchObject({
      durationMs: 2_000,
      observeMs: 2_000,
      moveCount: 3,
    });
    expect(timeline.frames.map((frame) => frame.timeMs)).toEqual([0, 0, 1_000, 2_000]);
    expect(timeline.frames.at(-1)?.board).toEqual(createSolvedBoard(4));
    expect(timeline.durationMs).toBe(2_000);
    expect(timeline.issues).toEqual([]);

    expect(getFrameAt(timeline, 0)?.step).toBe(0);
    expect(getFrameAt(timeline, 0.5)?.step).toBe(1);
    expect(getFrameAt(timeline, 1_000)?.step).toBe(2);
    expect(getFrameAt(timeline, 2_000)?.step).toBe(3);
  });

  it('blind 4×4 保留观察等待', () => {
    const result = solve4x4('blind');
    const score = scoreFromResult('blind-4x4', result);
    const timeline = buildReplayTimeline(score, replayFromResult('blind-4x4', result));

    expect(result).toMatchObject({ durationMs: 4_000, observeMs: 2_000 });
    expect(timeline.frames.map((frame) => frame.timeMs)).toEqual([0, 2_000, 3_000, 4_000]);
    expect(getFrameAt(timeline, 1_999)?.step).toBe(0);
    expect(getFrameAt(timeline, 2_000)?.step).toBe(1);
    expect(getFrameAt(timeline, 4_000)?.step).toBe(3);
  });

  it('0 步成绩也能播放，停在打乱盘面', () => {
    const score: ScoreRecord = {
      id: 'zero-step',
      size: 3,
      gameMode: 'normal',
      moveMode: 'click',
      groupId: 1,
      durationMs: 1_000,
      observeMs: 0,
      moveCount: 0,
      scramble: SOLVED_3,
      finishedAt: EPOCH,
    };
    const timeline = buildReplayTimeline(score, { scoreId: 'zero-step', moves: [] });

    expect(timeline.frames).toHaveLength(1);
    expect(timeline.durationMs).toBe(1_000);

    const playing = play(createPlayback(timeline), timeline, 0);
    const midway = updatePlayback(playing, timeline, 500);
    expect(midway.frame?.step).toBe(0);
    expect(midway.finished).toBe(false);

    const finished = updatePlayback(playing, timeline, 1_000);
    expect(finished.state.playing).toBe(false);
    expect(finished.frame?.step).toBe(0);
    expect(finished.finished).toBe(true);
  });

  it('seek 到中间帧后可以继续播放', () => {
    const result = solve4x4('normal');
    const timeline = buildReplayTimeline(
      scoreFromResult('seek-4x4', result),
      replayFromResult('seek-4x4', result),
    );

    const seeked = seekToFrame(createPlayback(timeline), timeline, 2, 0);
    expect(seeked.positionMs).toBe(1_000);

    const resumed = play(seeked, timeline, 0);
    const update = updatePlayback(resumed, timeline, 500);
    expect(update.state.positionMs).toBe(1_500);
    expect(update.state.playing).toBe(true);
    expect(update.frame?.step).toBe(2);
  });

  it('10×10、约 3,000 步长录像可构建、seek 和播放到末尾', () => {
    const moveCount = 3_000;
    const { scramble, moves } = createLongReplay(10, moveCount);
    const score: ScoreRecord = {
      id: 'long-10x10',
      size: 10,
      gameMode: 'normal',
      moveMode: 'keyboard',
      groupId: 1,
      durationMs: moveCount,
      observeMs: 0,
      moveCount,
      scramble,
      finishedAt: EPOCH,
    };
    const timeline = buildReplayTimeline(score, { scoreId: score.id, moves });

    expect(timeline.issues).toEqual([]);
    expect(timeline.frames).toHaveLength(moveCount + 1);
    expect(timeline.frames.at(-1)?.step).toBe(moveCount);
    expect(timeline.frames.at(-1)?.board).toEqual(createSolvedBoard(10));
    expect(timeline.durationMs).toBe(moveCount);

    const expectedMid = applyMoves(
      scramble,
      moves.slice(0, 1_500).map((move) => move.direction),
      10,
    );
    expect(timeline.frames[1_500].board).toEqual(expectedMid);
    expect(getFrameAt(timeline, 1_500)?.step).toBe(1_500);

    const seeked = seekToFrame(createPlayback(timeline), timeline, 1_500, 0);
    const playing = play(seeked, timeline, 0);
    const midway = updatePlayback(playing, timeline, 500);
    expect(midway.state.positionMs).toBe(2_000);
    expect(midway.state.playing).toBe(true);
    expect(midway.frame?.step).toBe(2_000);

    const finished = updatePlayback(playing, timeline, 2_000);
    expect(finished.state.positionMs).toBe(moveCount);
    expect(finished.state.playing).toBe(false);
    expect(finished.finished).toBe(true);
    expect(finished.frame?.board).toEqual(createSolvedBoard(10));
  });

  it('issues 非空时仍可播放已构建的前缀', () => {
    const score: ScoreRecord = {
      id: 'broken-replay',
      size: 3,
      gameMode: 'normal',
      moveMode: 'keyboard',
      groupId: 1,
      durationMs: 1_000,
      observeMs: 0,
      moveCount: 1,
      scramble: SOLVED_3,
      finishedAt: EPOCH,
    };
    const timeline = buildReplayTimeline(score, {
      scoreId: score.id,
      moves: [{ direction: 'U', timeMs: 500 }],
    });

    expect(timeline.frames).toHaveLength(1);
    expect(timeline.issues).toEqual([expect.objectContaining({ code: 'invalid-move', step: 1 })]);

    const playing = play(createPlayback(timeline), timeline, 0);
    const update = updatePlayback(playing, timeline, 500);
    expect(update.frame?.step).toBe(0);
    expect(update.state.playing).toBe(true);

    const finished = updatePlayback(playing, timeline, 2_000);
    expect(finished.finished).toBe(true);
    expect(finished.state.playing).toBe(false);
  });
});
