import { describe, expect, it } from 'vitest';
import type { Board, PuzzleSize } from '../types';
import { createSolvedBoard, isValidBoard } from './board';
import { applyMove } from './moves';
import {
  countInversions,
  generateScramble,
  isSolvable,
  manhattanDistance,
  shuffleBoard,
} from './scramble';

function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/** 独立的对照实现：标准判定使用“不含空白块”的逆序数。 */
function isSolvableStandard(board: Board, size: PuzzleSize): boolean {
  if (!isValidBoard(board, size)) {
    return false;
  }

  let inversions = 0;
  for (let left = 0; left < board.length; left++) {
    if (board[left] === 0) {
      continue;
    }
    for (let right = left + 1; right < board.length; right++) {
      if (board[right] !== 0 && board[left] > board[right]) {
        inversions++;
      }
    }
  }

  if (size % 2 === 1) {
    return inversions % 2 === 0;
  }

  const blankRow = Math.floor(board.indexOf(0) / size);
  return (inversions + blankRow) % 2 === 1;
}

const solved3 = createSolvedBoard(3);
const solved4 = createSolvedBoard(4);

describe('countInversions', () => {
  it('统计包含空白块的总逆序数', () => {
    expect(countInversions([1, 2, 3, 0])).toBe(3);
    expect(countInversions([2, 1, 3, 0])).toBe(4);
    expect(countInversions([2, 1, 4, 3, 0])).toBe(6);
    expect(countInversions([2, 8, 5, 1, 7, 6, 3, 0, 4])).toBe(22);
  });
});

describe('manhattanDistance', () => {
  it('已复原棋盘距离为 0', () => {
    expect(manhattanDistance(solved3, 3)).toBe(0);
    expect(manhattanDistance(solved4, 4)).toBe(0);
  });

  it('单个方块偏离一格时距离为 1', () => {
    expect(manhattanDistance([1, 2, 3, 4, 5, 6, 7, 0, 8], 3)).toBe(1);
  });

  it('空白块不参与计算', () => {
    const board: Board = [0, 1, 2, 3];
    expect(manhattanDistance(board, 2)).toBe(4);
  });
});

describe('isSolvable', () => {
  it('已复原棋盘有解', () => {
    expect(isSolvable(solved3, 3)).toBe(true);
    expect(isSolvable(solved4, 4)).toBe(true);
  });

  it('奇数阶只由逆序数决定', () => {
    expect(isSolvable([2, 1, 3, 4, 5, 6, 7, 8, 0], 3)).toBe(false);
    expect(isSolvable([2, 8, 5, 1, 7, 6, 3, 0, 4], 3)).toBe(false);
    expect(isSolvable([8, 5, 2, 7, 6, 0, 3, 1, 4], 3)).toBe(true);
  });

  it('偶数阶同时考虑空白块行号', () => {
    const swapped: Board = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 14, 0];
    expect(isSolvable(swapped, 4)).toBe(false);

    const moved = applyMove(solved4, 'R', 4);
    expect(moved).not.toBeNull();
    expect(isSolvable(moved as Board, 4)).toBe(true);
  });

  it('无效棋盘不可解', () => {
    expect(isSolvable([1, 2, 3, 4], 3)).toBe(false);
  });

  it('旧公式与标准判定等价', () => {
    const cases: Array<{ board: Board; size: PuzzleSize }> = [
      { board: solved3, size: 3 },
      { board: solved4, size: 4 },
      { board: [2, 1, 3, 4, 5, 6, 7, 8, 0], size: 3 },
      { board: [8, 5, 2, 7, 6, 0, 3, 1, 4], size: 3 },
      { board: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 14, 0], size: 4 },
    ];

    for (const { board, size } of cases) {
      expect(isSolvable(board, size)).toBe(isSolvableStandard(board, size));
    }
  });
});

describe('shuffleBoard', () => {
  it('返回完整排列且不修改原棋盘', () => {
    const rng = createSeededRng(42);
    const shuffled = shuffleBoard(solved4, rng);

    expect(solved4).toEqual(createSolvedBoard(4));
    expect([...shuffled].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 16 }, (_, index) => index),
    );
  });

  it('相同随机源得到相同结果', () => {
    expect(shuffleBoard(solved4, createSeededRng(7))).toEqual(
      shuffleBoard(solved4, createSeededRng(7)),
    );
  });
});

describe('generateScramble', () => {
  const sizes: PuzzleSize[] = [2, 3, 4, 5, 6, 7, 8, 9, 10];

  it.each(sizes)('%i 阶打乱始终有效、可解且不过于简单', (size) => {
    const rng = createSeededRng(size * 1009 + 17);

    for (let index = 0; index < 40; index++) {
      const board = generateScramble(size, rng);
      expect(isValidBoard(board, size)).toBe(true);
      expect(isSolvable(board, size)).toBe(true);
      expect(isSolvableStandard(board, size)).toBe(true);
      expect(manhattanDistance(board, size)).toBeGreaterThanOrEqual(size * size);
    }
  });

  it('相同随机源生成相同打乱', () => {
    expect(generateScramble(4, createSeededRng(123))).toEqual(
      generateScramble(4, createSeededRng(123)),
    );
  });

  it('生成的不是已复原棋盘', () => {
    const board = generateScramble(4, createSeededRng(1));
    expect(board).not.toEqual(createSolvedBoard(4));
  });
});
