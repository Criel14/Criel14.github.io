import { describe, expect, it } from 'vitest';
import type { Board, ScoreRecord } from '../types';
import {
  buildChartSeries,
  computeAoAt,
  computeBestAo,
  computeScoreHighlights,
  computeScoreStats,
  SESSION_GAP_MS,
} from './stats';

const BASE_FINISHED_AT = 1_700_000_000_000;
const SCRAMBLE: Board = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 0, 15];

function createScore(overrides: Partial<ScoreRecord> = {}): ScoreRecord {
  return {
    id: 'score-1',
    size: 4,
    gameMode: 'normal',
    moveMode: 'slide',
    groupId: 1,
    durationMs: 10_000,
    observeMs: 2_000,
    moveCount: 50,
    scramble: SCRAMBLE,
    finishedAt: BASE_FINISHED_AT,
    ...overrides,
  };
}

/**
 * 按相邻间隔构造成绩：gaps[i] 表示第 i+1 条开始到第 i 条完成的间隔。
 * 要求 gaps[i] + duration[i+1] > 0，保证 finishedAt 仍按数组顺序递增。
 */
function createScoresWithGaps(
  durations: readonly number[],
  gaps: readonly number[],
): ScoreRecord[] {
  let finishedAt = BASE_FINISHED_AT;

  return durations.map((durationMs, index) => {
    if (index > 0) {
      finishedAt += gaps[index - 1] + durationMs;
    }
    return createScore({
      id: `score-${index + 1}`,
      durationMs,
      moveCount: 10 + index,
      observeMs: 1_000 + index,
      finishedAt,
    });
  });
}

function uniformGaps(count: number, gapMs = 60_000): number[] {
  return Array.from({ length: Math.max(0, count - 1) }, () => gapMs);
}

describe('computeAoAt', () => {
  it('不足窗口或索引越界返回 null', () => {
    const four = createScoresWithGaps([1000, 2000, 3000, 4000], uniformGaps(4));

    expect(computeAoAt(four, 3, 5)).toBeNull();
    expect(computeAoAt(four, -1, 5)).toBeNull();
    expect(computeAoAt(four, 4, 5)).toBeNull();
    expect(computeAoAt(four, 0, 2)).toBeNull();
    expect(computeAoAt([], 0, 5)).toBeNull();
  });

  it('5 条成绩去掉最小和最大值后求平均', () => {
    const scores = createScoresWithGaps([1000, 2000, 3000, 4000, 5000], uniformGaps(5));

    expect(computeAoAt(scores, 4, 5)).toBe(3000);
  });

  it('12 条成绩刚好满足 ao12', () => {
    const durations = Array.from({ length: 12 }, (_, index) => (index + 1) * 1000);
    const scores = createScoresWithGaps(durations, uniformGaps(12));

    expect(computeAoAt(scores, 11, 12)).toBe(6500);
    expect(computeAoAt(scores, 10, 12)).toBeNull();
  });

  it('间隔恰好 5 分钟有效，超过 1ms 无效', () => {
    const exact = createScoresWithGaps(
      [1000, 1000, 1000, 1000, 1000],
      uniformGaps(5, SESSION_GAP_MS),
    );
    const over = createScoresWithGaps(
      [1000, 1000, 1000, 1000, 1000],
      uniformGaps(5, SESSION_GAP_MS + 1),
    );

    expect(computeAoAt(exact, 4, 5)).toBe(1000);
    expect(computeAoAt(over, 4, 5)).toBeNull();
  });

  it('窗口内任意一对超时则整体无效', () => {
    const gaps = [60_000, SESSION_GAP_MS + 1, 60_000, 60_000];
    const scores = createScoresWithGaps([1000, 1000, 1000, 1000, 1000], gaps);

    expect(computeAoAt(scores, 4, 5)).toBeNull();
  });

  it('负间隔超过阈值或 NaN 无效', () => {
    // 第 2 局 duration 很长，开始时刻比第 1 局完成早 400 秒；
    // finishedAt 仍递增，保证数组顺序不变。
    const scores = createScoresWithGaps(
      [1000, 600_000, 1000, 1000, 1000],
      [-400_000, 60_000, 60_000, 60_000],
    );
    expect(computeAoAt(scores, 4, 5)).toBeNull();

    const withNaN = createScoresWithGaps([1000, 1000, 1000, 1000, 1000], uniformGaps(5));
    withNaN[4] = { ...withNaN[4], finishedAt: Number.NaN };
    expect(computeAoAt(withNaN, 4, 5)).toBeNull();
  });

  it('时长非法时窗口无效，不返回 NaN', () => {
    const scores = createScoresWithGaps([1000, 2000, 3000, 4000, 0], uniformGaps(5));

    expect(computeAoAt(scores, 4, 5)).toBeNull();
  });
});

describe('computeBestAo', () => {
  it('没有足够成绩或没有有效窗口时返回 null', () => {
    const four = createScoresWithGaps([1000, 2000, 3000, 4000], uniformGaps(4));
    const overGap = createScoresWithGaps(
      [1000, 1000, 1000, 1000, 1000],
      uniformGaps(5, SESSION_GAP_MS + 1),
    );

    expect(computeBestAo(four, 5)).toBeNull();
    expect(computeBestAo(overGap, 5)).toBeNull();
    expect(computeBestAo([], 5)).toBeNull();
  });

  it('取所有有效 aoN 中的最小值', () => {
    const scores = createScoresWithGaps([1000, 9000, 2000, 3000, 4000, 5000], uniformGaps(6));

    expect(computeBestAo(scores, 5)).toBe(3000);
    expect(computeBestAo(scores, 12)).toBeNull();
  });
});

describe('computeScoreStats', () => {
  it('空桶返回 count 0 与全 null', () => {
    expect(computeScoreStats([])).toEqual({
      count: 0,
      bestTimeMs: null,
      averageTimeMs: null,
      bestStep: null,
      averageStep: null,
      bestTps: null,
      averageTps: null,
      bestAo5Ms: null,
      bestAo12Ms: null,
      averageObserveMs: null,
    });
  });

  it('单条成绩的最佳值与平均值相同', () => {
    const stats = computeScoreStats([createScore()]);

    expect(stats).toEqual({
      count: 1,
      bestTimeMs: 10_000,
      averageTimeMs: 10_000,
      bestStep: 50,
      averageStep: 50,
      bestTps: 5,
      averageTps: 5,
      bestAo5Ms: null,
      bestAo12Ms: null,
      averageObserveMs: 2_000,
    });
  });

  it('时间/步数/TPS/观察时间使用算术平均', () => {
    const scores = [
      createScore({
        id: 'a',
        durationMs: 10_000,
        moveCount: 10,
        observeMs: 1_000,
        finishedAt: BASE_FINISHED_AT,
      }),
      createScore({
        id: 'b',
        durationMs: 20_000,
        moveCount: 20,
        observeMs: 2_000,
        finishedAt: BASE_FINISHED_AT + 30_000,
      }),
      createScore({
        id: 'c',
        durationMs: 30_000,
        moveCount: 30,
        observeMs: 3_000,
        finishedAt: BASE_FINISHED_AT + 60_000,
      }),
    ];
    const stats = computeScoreStats(scores);

    expect(stats).toMatchObject({
      bestTimeMs: 10_000,
      averageTimeMs: 20_000,
      bestStep: 10,
      averageStep: 20,
      bestTps: 1,
      averageTps: 1,
      averageObserveMs: 2_000,
    });
  });

  it('平均不是去尾平均，极端值也参与', () => {
    const scores = [
      createScore({ id: 'a', durationMs: 1_000, finishedAt: BASE_FINISHED_AT }),
      createScore({ id: 'b', durationMs: 2_000, finishedAt: BASE_FINISHED_AT + 10_000 }),
      createScore({ id: 'c', durationMs: 30_000, finishedAt: BASE_FINISHED_AT + 20_000 }),
    ];

    expect(computeScoreStats(scores).averageTimeMs).toBe(11_000);
  });

  it('TPS 为 0 或非法值时跳过，不污染平均与最佳值', () => {
    const scores = [
      createScore({ id: 'valid', durationMs: 10_000, moveCount: 50 }),
      createScore({ id: 'zero', durationMs: 0, moveCount: 10 }),
      createScore({ id: 'nan', durationMs: Number.NaN, moveCount: 10 }),
    ];
    const stats = computeScoreStats(scores);

    expect(stats.bestTps).toBe(5);
    expect(stats.averageTps).toBe(5);
  });

  it('bestAo5 / bestAo12 来自有效窗口，入参顺序不影响结果', () => {
    const scores = createScoresWithGaps([1000, 2000, 3000, 4000, 5000], uniformGaps(5));

    expect(computeScoreStats(scores).bestAo5Ms).toBe(3000);
    expect(computeScoreStats(scores).bestAo12Ms).toBeNull();
    expect(computeScoreStats([...scores].reverse()).bestAo5Ms).toBe(3000);
  });
});

describe('computeScoreHighlights', () => {
  it('空成绩返回空数组', () => {
    expect(computeScoreHighlights([])).toEqual([]);
  });

  it('单条成绩同时是最好和最差，ao 不足窗口时不高亮', () => {
    expect(computeScoreHighlights([createScore()])).toEqual([
      {
        scoreId: 'score-1',
        bestTime: true,
        worstTime: true,
        bestStep: true,
        worstStep: true,
        bestTps: true,
        worstTps: true,
        bestAo5: false,
        worstAo5: false,
        bestAo12: false,
        worstAo12: false,
      },
    ]);
  });

  it('并列值时全部标记', () => {
    const scores = [
      createScore({ id: 'a', durationMs: 10_000, moveCount: 50, finishedAt: BASE_FINISHED_AT }),
      createScore({
        id: 'b',
        durationMs: 10_000,
        moveCount: 50,
        finishedAt: BASE_FINISHED_AT + 100_000,
      }),
      createScore({
        id: 'c',
        durationMs: 30_000,
        moveCount: 30,
        finishedAt: BASE_FINISHED_AT + 200_000,
      }),
    ];
    const [first, second, third] = computeScoreHighlights(scores);

    expect(first).toMatchObject({
      bestTime: true,
      worstTime: false,
      bestStep: false,
      worstStep: true,
      bestTps: true,
      worstTps: false,
    });
    expect(second).toMatchObject({
      bestTime: true,
      worstTime: false,
      bestStep: false,
      worstStep: true,
      bestTps: true,
      worstTps: false,
    });
    expect(third).toMatchObject({
      bestTime: false,
      worstTime: true,
      bestStep: true,
      worstStep: false,
      bestTps: false,
      worstTps: true,
    });
  });

  it('TPS 为 0 的成绩不参与 TPS 高低亮', () => {
    const scores = [
      createScore({
        id: 'fast',
        durationMs: 10_000,
        moveCount: 50,
        finishedAt: BASE_FINISHED_AT,
      }),
      createScore({
        id: 'slow',
        durationMs: 10_000,
        moveCount: 20,
        finishedAt: BASE_FINISHED_AT + 100_000,
      }),
      createScore({
        id: 'zero',
        durationMs: 0,
        moveCount: 10,
        finishedAt: BASE_FINISHED_AT + 200_000,
      }),
    ];
    const [fast, slow, zero] = computeScoreHighlights(scores);

    expect(fast).toMatchObject({ bestTps: true, worstTps: false });
    expect(slow).toMatchObject({ bestTps: false, worstTps: true });
    expect(zero).toMatchObject({ bestTps: false, worstTps: false });
  });

  it('ao5 最好/最差只标记有效窗口', () => {
    const scores = createScoresWithGaps([1000, 2000, 3000, 4000, 5000, 6000], uniformGaps(6));
    const highlights = computeScoreHighlights(scores);

    expect(highlights[4]).toMatchObject({ bestAo5: true, worstAo5: false });
    expect(highlights[5]).toMatchObject({ bestAo5: false, worstAo5: true });
    expect(highlights.slice(0, 4).every((item) => !item.bestAo5 && !item.worstAo5)).toBe(true);
    expect(highlights.every((item) => !item.bestAo12 && !item.worstAo12)).toBe(true);
  });

  it('ao 窗口全部失效时不高亮任何 ao', () => {
    const scores = createScoresWithGaps(
      [1000, 2000, 3000, 4000, 5000],
      uniformGaps(5, SESSION_GAP_MS + 1),
    );

    expect(computeScoreHighlights(scores).every((item) => !item.bestAo5 && !item.worstAo5)).toBe(
      true,
    );
  });

  it('返回顺序与入参一致，内部排序不影响 scoreId 对齐', () => {
    const chronological = createScoresWithGaps([3000, 1000, 2000], uniformGaps(3));
    const reversed = [...chronological].reverse();
    const highlights = computeScoreHighlights(reversed);

    expect(highlights.map((item) => item.scoreId)).toEqual(reversed.map((score) => score.id));
    expect(highlights.find((item) => item.scoreId === 'score-2')).toMatchObject({
      bestTime: true,
      worstTime: false,
    });
    expect(highlights.find((item) => item.scoreId === 'score-1')).toMatchObject({
      bestTime: false,
      worstTime: true,
    });
  });
});

describe('buildChartSeries', () => {
  it('空成绩返回空数组', () => {
    expect(buildChartSeries([])).toEqual({
      labels: [],
      timeSeconds: [],
      steps: [],
    });
  });

  it('按完成时间排序并派生连续编号', () => {
    const late = createScore({
      id: 'late',
      durationMs: 12_340,
      moveCount: 30,
      finishedAt: BASE_FINISHED_AT + 2_000,
    });
    const early = createScore({
      id: 'early',
      durationMs: 5_000,
      moveCount: 10,
      finishedAt: BASE_FINISHED_AT,
    });
    const middle = createScore({
      id: 'middle',
      durationMs: 8_000,
      moveCount: 20,
      finishedAt: BASE_FINISHED_AT + 1_000,
    });

    expect(buildChartSeries([late, early, middle])).toEqual({
      labels: [1, 2, 3],
      timeSeconds: [5, 8, 12.34],
      steps: [10, 20, 30],
    });
  });
});
