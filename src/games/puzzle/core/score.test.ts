import { describe, expect, it } from 'vitest';
import type { Board, ScoreRecord } from '../types';
import {
  assignNumbers,
  calculateTps,
  compareScores,
  filterScoresByBucket,
  getBucketKey,
  getScoreStartedAt,
  sortScores,
} from './score';

const scramble: Board = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 0, 15];

/** 生成测试成绩；只覆盖用例关心的字段，其余使用合法默认值。 */
function createScore(overrides: Partial<ScoreRecord> = {}): ScoreRecord {
  return {
    id: 'score-1',
    size: 4,
    gameMode: 'normal',
    moveMode: 'slide',
    groupId: 1,
    durationMs: 10_000,
    observeMs: 500,
    moveCount: 20,
    scramble,
    finishedAt: 1_000_000,
    ...overrides,
  };
}

describe('calculateTps', () => {
  it('按有效用时计算每秒步数', () => {
    expect(calculateTps(20, 10_000)).toBe(2);
    expect(calculateTps(15, 5_000)).toBe(3);
    expect(calculateTps(1, 500)).toBe(2);
  });

  it('时长为 0 时返回 0', () => {
    expect(calculateTps(10, 0)).toBe(0);
  });

  it('时长为负数时返回 0', () => {
    expect(calculateTps(10, -1)).toBe(0);
  });

  it('步数为 0 时返回 0', () => {
    expect(calculateTps(0, 10_000)).toBe(0);
  });
});

describe('compareScores', () => {
  it('按完成时刻升序排列', () => {
    const earlier = createScore({ id: 'b', finishedAt: 1_000 });
    const later = createScore({ id: 'a', finishedAt: 2_000 });

    expect(compareScores(earlier, later)).toBeLessThan(0);
    expect(compareScores(later, earlier)).toBeGreaterThan(0);
  });

  it('完成时刻相同时按 id 升序排列', () => {
    const first = createScore({ id: 'a', finishedAt: 1_000 });
    const second = createScore({ id: 'b', finishedAt: 1_000 });

    expect(compareScores(first, second)).toBeLessThan(0);
    expect(compareScores(second, first)).toBeGreaterThan(0);
  });

  it('完成时刻和 id 都相同时返回 0', () => {
    const score = createScore();
    expect(compareScores(score, score)).toBe(0);
  });
});

describe('sortScores', () => {
  it('按完成时刻排序，相同时按 id 排序', () => {
    const scores = [
      createScore({ id: 'c', finishedAt: 3_000 }),
      createScore({ id: 'b', finishedAt: 1_000 }),
      createScore({ id: 'a', finishedAt: 1_000 }),
    ];

    expect(sortScores(scores).map((score) => score.id)).toEqual(['a', 'b', 'c']);
  });

  it('返回新数组且不修改入参顺序', () => {
    const scores = [
      createScore({ id: 'c', finishedAt: 3_000 }),
      createScore({ id: 'a', finishedAt: 1_000 }),
      createScore({ id: 'b', finishedAt: 2_000 }),
    ];
    const originalOrder = scores.map((score) => score.id);

    const sorted = sortScores(scores);

    expect(sorted).not.toBe(scores);
    expect(scores.map((score) => score.id)).toEqual(originalOrder);
  });
});

describe('getBucketKey', () => {
  it('由阶数、模式和分组组成桶键', () => {
    expect(getBucketKey({ size: 4, gameMode: 'normal', groupId: 1 })).toBe('4:normal:1');
    expect(getBucketKey({ size: 10, gameMode: 'blind', groupId: 5 })).toBe('10:blind:5');
  });
});

describe('filterScoresByBucket', () => {
  it('只保留目标桶的成绩', () => {
    const targetSlide = createScore({ id: 'target-slide', moveMode: 'slide' });
    const targetClick = createScore({ id: 'target-click', moveMode: 'click' });
    const otherSize = createScore({ id: 'other-size', size: 3 });
    const otherMode = createScore({ id: 'other-mode', gameMode: 'blind' });
    const otherGroup = createScore({ id: 'other-group', groupId: 2 });

    const filtered = filterScoresByBucket(
      [targetSlide, otherSize, targetClick, otherMode, otherGroup],
      { size: 4, gameMode: 'normal', groupId: 1 },
    );

    expect(filtered.map((score) => score.id)).toEqual(['target-slide', 'target-click']);
  });

  it('返回新数组且不修改原数组', () => {
    const scores = [createScore({ id: 'a' }), createScore({ id: 'b', groupId: 2 })];

    const filtered = filterScoresByBucket(scores, {
      size: 4,
      gameMode: 'normal',
      groupId: 1,
    });

    expect(filtered).not.toBe(scores);
    expect(scores).toHaveLength(2);
  });

  it('没有匹配成绩时返回空数组', () => {
    expect(
      filterScoresByBucket([createScore({ size: 3 })], {
        size: 4,
        gameMode: 'normal',
        groupId: 1,
      }),
    ).toEqual([]);
  });
});

describe('getScoreStartedAt', () => {
  it('由完成时刻减去有效用时派生开局时刻', () => {
    const score = createScore({ finishedAt: 1_000_000, durationMs: 12_345 });
    expect(getScoreStartedAt(score)).toBe(1_000_000 - 12_345);
  });
});

describe('assignNumbers', () => {
  it('先排序再编号，编号从 1 开始', () => {
    const scores = [
      createScore({ id: 'c', finishedAt: 3_000 }),
      createScore({ id: 'a', finishedAt: 1_000 }),
      createScore({ id: 'b', finishedAt: 2_000 }),
    ];

    expect(assignNumbers(scores)).toEqual([
      { score: scores[1], number: 1 },
      { score: scores[2], number: 2 },
      { score: scores[0], number: 3 },
    ]);
  });

  it('删除一条成绩后编号仍然连续', () => {
    const scores = [
      createScore({ id: 'a', finishedAt: 1_000 }),
      createScore({ id: 'b', finishedAt: 2_000 }),
      createScore({ id: 'c', finishedAt: 3_000 }),
    ];

    const remaining = scores.filter((score) => score.id !== 'b');

    expect(assignNumbers(remaining).map(({ number }) => number)).toEqual([1, 2]);
    expect(assignNumbers(remaining).map(({ score }) => score.id)).toEqual(['a', 'c']);
  });

  it('不修改入参顺序', () => {
    const scores = [
      createScore({ id: 'b', finishedAt: 2_000 }),
      createScore({ id: 'a', finishedAt: 1_000 }),
    ];

    assignNumbers(scores);

    expect(scores.map((score) => score.id)).toEqual(['b', 'a']);
  });
});
