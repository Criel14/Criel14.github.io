import type { Board, Direction, PuzzleSize } from '../types';
import { getBlankIndex, getRowCol } from './board';

/** 空白块相对移动方向；与“方块移动方向”相反。 */
const BLANK_DELTAS: Record<Direction, { row: number; col: number }> = {
  U: { row: 1, col: 0 },
  D: { row: -1, col: 0 },
  L: { row: 0, col: 1 },
  R: { row: 0, col: -1 },
};

/** TypeScript 类型之外再兜一层，避免运行时收到非法方向字符串。 */
export function isDirection(value: string): value is Direction {
  return value === 'U' || value === 'D' || value === 'L' || value === 'R';
}

/** 判断某个方向是否可以移动。 */
export function canMove(board: Board, direction: Direction, size: PuzzleSize): boolean {
  const blankIndex = getBlankIndex(board);
  if (blankIndex < 0) {
    return false;
  }

  const { row, col } = getRowCol(blankIndex, size);
  const delta = BLANK_DELTAS[direction];
  const targetRow = row + delta.row;
  const targetCol = col + delta.col;

  return targetRow >= 0 && targetRow < size && targetCol >= 0 && targetCol < size;
}

/**
 * 执行一次单块移动。
 * 返回新棋盘；方向非法时返回 null。
 */
export function applyMove(board: Board, direction: Direction, size: PuzzleSize): Board | null {
  if (!canMove(board, direction, size)) {
    return null;
  }

  const blankIndex = getBlankIndex(board);
  const { row, col } = getRowCol(blankIndex, size);
  const delta = BLANK_DELTAS[direction];
  const targetIndex = (row + delta.row) * size + (col + delta.col);

  const next = board.slice();
  [next[blankIndex], next[targetIndex]] = [next[targetIndex], next[blankIndex]];
  return next;
}

/** 连续执行多个方向；任意一步非法则返回 null。 */
export function applyMoves(
  board: Board,
  directions: readonly Direction[],
  size: PuzzleSize,
): Board | null {
  let current: Board = board;

  for (const direction of directions) {
    const next = applyMove(current, direction, size);
    if (next === null) {
      return null;
    }
    current = next;
  }
  return current;
}

export interface LineMovePlan {
  board: Board;
  moves: Direction[];
}

/**
 * 计算点击/滑动某个方块时的整行或整列移动。
 *
 * 旧版行为：方块与空白块在同一行/列时，中间的整段方块依次移动一格。
 * 返回每一步的方向序列和最终棋盘；不在同一行/列或目标就是空白块时返回空计划。
 */
export function planLineMove(board: Board, tileIndex: number, size: PuzzleSize): LineMovePlan {
  const blankIndex = getBlankIndex(board);
  if (
    blankIndex < 0 ||
    tileIndex < 0 ||
    tileIndex >= board.length ||
    tileIndex === blankIndex ||
    board[tileIndex] === 0
  ) {
    return { board, moves: [] };
  }

  const tile = getRowCol(tileIndex, size);
  const blank = getRowCol(blankIndex, size);
  const sameRow = tile.row === blank.row;
  const sameCol = tile.col === blank.col;

  if (!sameRow && !sameCol) {
    return { board, moves: [] };
  }

  const next = board.slice();
  const moves: Direction[] = [];
  let currentBlank = blankIndex;

  while (currentBlank !== tileIndex) {
    let direction: Direction;
    let targetIndex: number;

    if (sameRow) {
      if (tile.col < blank.col) {
        direction = 'R';
        targetIndex = currentBlank - 1;
      } else {
        direction = 'L';
        targetIndex = currentBlank + 1;
      }
    } else if (tile.row < blank.row) {
      direction = 'D';
      targetIndex = currentBlank - size;
    } else {
      direction = 'U';
      targetIndex = currentBlank + size;
    }

    [next[currentBlank], next[targetIndex]] = [next[targetIndex], next[currentBlank]];
    moves.push(direction);
    currentBlank = targetIndex;
  }

  return { board: next, moves };
}
