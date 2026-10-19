import { describe, expect, it } from 'vitest';
import type { Board } from '../types';
import { applyMove, applyMoves, canMove, isDirection, planLineMove } from './moves';

const solved3: Board = [1, 2, 3, 4, 5, 6, 7, 8, 0];
const solved4: Board = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];

describe('isDirection', () => {
  it('识别四个合法方向', () => {
    for (const direction of ['U', 'D', 'L', 'R']) {
      expect(isDirection(direction)).toBe(true);
    }
  });

  it('拒绝其他字符串', () => {
    expect(isDirection('')).toBe(false);
    expect(isDirection('X')).toBe(false);
    expect(isDirection('UU')).toBe(false);
  });
});

describe('canMove', () => {
  it('根据空白块边界判断方向', () => {
    expect(canMove(solved3, 'D', 3)).toBe(true);
    expect(canMove(solved3, 'R', 3)).toBe(true);
    expect(canMove(solved3, 'U', 3)).toBe(false);
    expect(canMove(solved3, 'L', 3)).toBe(false);
  });

  it('无效棋盘不能移动', () => {
    expect(canMove([1, 2, 3, 4], 'U', 3)).toBe(false);
  });
});

describe('applyMove', () => {
  it('方向表示方块移动的方向', () => {
    expect(applyMove(solved3, 'D', 3)).toEqual([1, 2, 3, 4, 5, 0, 7, 8, 6]);
    expect(applyMove(solved3, 'R', 3)).toEqual([1, 2, 3, 4, 5, 6, 7, 0, 8]);
  });

  it('越界方向返回 null', () => {
    expect(applyMove(solved3, 'U', 3)).toBeNull();
    expect(applyMove(solved3, 'L', 3)).toBeNull();
  });

  it('不修改原棋盘', () => {
    applyMove(solved3, 'D', 3);
    expect(solved3).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 0]);
  });

  it('移动一次再反向移动可以复原', () => {
    expect(applyMoves(solved3, ['D', 'U'], 3)).toEqual(solved3);
    expect(applyMoves(solved3, ['R', 'L'], 3)).toEqual(solved3);
  });

  it('任意一步非法时整体返回 null', () => {
    expect(applyMoves(solved3, ['D', 'D', 'D'], 3)).toBeNull();
  });
});

describe('planLineMove', () => {
  it('空白块正上方的方块向下移动一格', () => {
    const plan = planLineMove(solved3, 5, 3);
    expect(plan.moves).toEqual(['D']);
    expect(plan.board).toEqual([1, 2, 3, 4, 5, 0, 7, 8, 6]);
  });

  it('点击空白块左侧的方块会推动整行', () => {
    const plan = planLineMove(solved4, 12, 4);
    expect(plan.moves).toEqual(['R', 'R', 'R']);
    expect(plan.board).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0, 13, 14, 15]);
    expect(plan.board[12]).toBe(0);
  });

  it('点击空白块上方的方块会推动整列', () => {
    const plan = planLineMove(solved4, 3, 4);
    expect(plan.moves).toEqual(['D', 'D', 'D']);
    expect(plan.board).toEqual([1, 2, 3, 0, 5, 6, 7, 4, 9, 10, 11, 8, 13, 14, 15, 12]);
    expect(plan.board[3]).toBe(0);
  });

  it('不在同一行或同一列时不移动', () => {
    expect(planLineMove(solved4, 0, 4)).toEqual({ board: solved4, moves: [] });
  });

  it('点击空白块自己不移动', () => {
    expect(planLineMove(solved3, 8, 3)).toEqual({ board: solved3, moves: [] });
  });

  it('非法索引不移动', () => {
    expect(planLineMove(solved3, -1, 3).moves).toEqual([]);
    expect(planLineMove(solved3, 9, 3).moves).toEqual([]);
  });

  it('计划中的方向序列与最终棋盘一致', () => {
    const plan = planLineMove(solved4, 12, 4);
    expect(plan.moves).toEqual(['R', 'R', 'R']);
    expect(applyMoves(solved4, plan.moves, 4)).toEqual(plan.board);
  });

  it('不修改原棋盘', () => {
    planLineMove(solved4, 12, 4);
    expect(solved4).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0]);
  });
});
