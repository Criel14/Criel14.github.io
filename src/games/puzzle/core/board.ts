import type { Board, PuzzleSize } from '../types';

export const MIN_SIZE = 2;
export const MAX_SIZE = 10;

/** 全部阶数，按升序排列；主题支持范围、按阶数分配和设置页共用同一顺序。 */
export const PUZZLE_SIZES: readonly PuzzleSize[] = Object.freeze([2, 3, 4, 5, 6, 7, 8, 9, 10]);

/** 判断一个数字是否是合法阶数。 */
export function isPuzzleSize(value: number): value is PuzzleSize {
  return Number.isInteger(value) && value >= MIN_SIZE && value <= MAX_SIZE;
}

/** 生成已复原棋盘：[1, 2, ..., size² - 1, 0]。 */
export function createSolvedBoard(size: PuzzleSize): Board {
  return Array.from({ length: size * size }, (_, index) => (index + 1) % (size * size));
}

/** 判断棋盘是否包含 0..size²-1 的完整排列。 */
export function isValidBoard(board: Board, size: PuzzleSize): boolean {
  if (board.length !== size * size) {
    return false;
  }

  const seen = new Set<number>();
  for (const tile of board) {
    if (!Number.isInteger(tile) || tile < 0 || tile >= size * size || seen.has(tile)) {
      return false;
    }
    seen.add(tile);
  }
  return true;
}

/** 判断棋盘是否已复原。 */
export function isSolved(board: Board, size: PuzzleSize): boolean {
  if (board.length !== size * size) {
    return false;
  }

  const lastIndex = size * size - 1;
  for (let index = 0; index < lastIndex; index++) {
    if (board[index] !== index + 1) {
      return false;
    }
  }
  return board[lastIndex] === 0;
}

/** 返回空白块索引；无效棋盘返回 -1。 */
export function getBlankIndex(board: Board): number {
  return board.indexOf(0);
}

/** 把一维索引转换为行列坐标。 */
export function getRowCol(index: number, size: number): { row: number; col: number } {
  return {
    row: Math.floor(index / size),
    col: index % size,
  };
}

/** 把行列坐标转换为一维索引。 */
export function getIndex(row: number, col: number, size: number): number {
  return row * size + col;
}
