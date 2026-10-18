import type { Board, PuzzleSize } from '../types';
import { createSolvedBoard, getBlankIndex, getRowCol, isValidBoard } from './board';

export type RandomSource = () => number;

/** 计算总逆序数；包含空白块 0。 */
export function countInversions(board: Board): number {
  let count = 0;

  for (let left = 0; left < board.length; left++) {
    const leftTile = board[left];
    for (let right = left + 1; right < board.length; right++) {
      if (leftTile > board[right]) {
        count++;
      }
    }
  }

  return count;
}

/** 计算曼哈顿距离；空白块不参与。 */
export function manhattanDistance(board: Board, size: PuzzleSize): number {
  let total = 0;

  for (let index = 0; index < board.length; index++) {
    const tile = board[index];
    if (tile === 0) {
      continue;
    }

    const goalIndex = tile - 1;
    const current = getRowCol(index, size);
    const goal = getRowCol(goalIndex, size);
    total += Math.abs(current.row - goal.row) + Math.abs(current.col - goal.col);
  }

  return total;
}

/**
 * 判断棋盘是否有解。
 *
 * 旧版公式（行号、列号从 0 开始）：
 * （总逆序数 + 空白块行号 + 空白块列号）与 N 不同奇偶。
 *
 * 注意：这里的“总逆序数”包含空白块 0。0 位于右侧时，
 * 它前面的每个非零块都会与它形成逆序对。
 */
export function isSolvable(board: Board, size: PuzzleSize): boolean {
  if (!isValidBoard(board, size)) {
    return false;
  }

  const inversions = countInversions(board);
  const blankIndex = getBlankIndex(board);
  const { row, col } = getRowCol(blankIndex, size);
  return (inversions + row + col + size) % 2 === 1;
}

/** 使用 Fisher-Yates 打乱棋盘，不修改原数组。 */
export function shuffleBoard(board: Board, rng: RandomSource = Math.random): Board {
  const result = board.slice();

  for (let index = result.length - 1; index > 0; index--) {
    const randomIndex = Math.min(index, Math.floor(rng() * (index + 1)));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }

  return result;
}

/**
 * 生成一个可解且不至于太简单的打乱。
 *
 * 保留旧版难度阈值：曼哈顿距离小于 size² 时重新打乱。
 */
export function generateScramble(size: PuzzleSize, rng: RandomSource = Math.random): Board {
  const solved = createSolvedBoard(size);
  const minimumDistance = size * size;

  for (let attempt = 0; attempt < 1000; attempt++) {
    const board = shuffleBoard(solved, rng);
    if (manhattanDistance(board, size) < minimumDistance) {
      continue;
    }
    if (!isSolvable(board, size)) {
      continue;
    }
    return board;
  }

  throw new Error('无法生成可解的打乱，请检查随机源。');
}
