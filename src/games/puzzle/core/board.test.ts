import { describe, expect, it } from 'vitest';
import {
  createSolvedBoard,
  getBlankIndex,
  getIndex,
  getRowCol,
  isPuzzleSize,
  isSolved,
  isValidBoard,
  MAX_SIZE,
  MIN_SIZE,
} from './board';
import type { PuzzleSize } from '../types';

describe('createSolvedBoard', () => {
  it('生成 2×2 已复原棋盘', () => {
    expect(createSolvedBoard(2)).toEqual([1, 2, 3, 0]);
  });

  it('生成 4×4 已复原棋盘', () => {
    const board = createSolvedBoard(4);
    expect(board).toHaveLength(16);
    expect(board[14]).toBe(15);
    expect(board[15]).toBe(0);
  });
});

describe('isPuzzleSize', () => {
  it.each([2, 3, 4, 5, 6, 7, 8, 9, 10])('接受阶数 %i', (size) => {
    expect(isPuzzleSize(size)).toBe(true);
  });

  it.each([0, 1, 11, 3.5, Number.NaN])('拒绝阶数 %s', (size) => {
    expect(isPuzzleSize(size)).toBe(false);
  });

  it('边界常量正确', () => {
    expect(MIN_SIZE).toBe(2);
    expect(MAX_SIZE).toBe(10);
  });
});

describe('isValidBoard', () => {
  it('接受完整排列', () => {
    expect(isValidBoard([1, 2, 3, 4, 5, 6, 7, 8, 0], 3)).toBe(true);
    expect(isValidBoard([0, 1, 2, 3], 2)).toBe(true);
  });

  it('拒绝长度错误', () => {
    expect(isValidBoard([1, 2, 3, 0], 3)).toBe(false);
    expect(isValidBoard([1, 2, 3, 4, 5, 6, 7, 8, 0, 9], 3)).toBe(false);
  });

  it('拒绝重复、越界和非整数', () => {
    expect(isValidBoard([1, 1, 2, 3, 4, 5, 6, 7, 0], 3)).toBe(false);
    expect(isValidBoard([1, 2, 3, 4, 5, 6, 7, 8, 9], 3)).toBe(false);
    expect(isValidBoard([1, 2, 3, 4, 5, 6, 7, 8, 0.5], 3)).toBe(false);
  });
});

describe('isSolved', () => {
  it('识别已复原棋盘', () => {
    expect(isSolved(createSolvedBoard(3), 3)).toBe(true);
    expect(isSolved(createSolvedBoard(10), 10)).toBe(true);
  });

  it('拒绝未复原棋盘', () => {
    expect(isSolved([2, 1, 3, 4, 5, 6, 7, 8, 0], 3)).toBe(false);
  });

  it('最后一块不是空白时不算复原', () => {
    expect(isSolved([1, 2, 3, 4, 5, 6, 7, 8, 9], 3)).toBe(false);
  });

  it('长度错误时不算复原', () => {
    expect(isSolved([1, 2, 3, 0], 3)).toBe(false);
  });
});

describe('坐标与空白块', () => {
  it('找到空白块索引', () => {
    expect(getBlankIndex([1, 2, 0, 3])).toBe(2);
    expect(getBlankIndex([1, 2, 3, 4])).toBe(-1);
  });

  it('行列坐标与一维索引可以互相转换', () => {
    const size: PuzzleSize = 4;
    for (let index = 0; index < size * size; index++) {
      const { row, col } = getRowCol(index, size);
      expect(getIndex(row, col, size)).toBe(index);
    }
  });
});
