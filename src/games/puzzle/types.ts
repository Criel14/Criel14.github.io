/** 拼图阶数：2×2 到 10×10。 */
export type PuzzleSize = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** 游戏模式：普通模式或盲玩模式。 */
export type GameMode = 'normal' | 'blind';

/** 操作模式：点击、滑动或键盘。 */
export type MoveMode = 'click' | 'slide' | 'keyboard';

/** 方块移动方向；不是空白块移动方向。 */
export type Direction = 'U' | 'D' | 'L' | 'R';

/** 棋盘按行优先展开，0 表示空白块。 */
export type Board = readonly number[];

/** 一次单块移动记录；timeMs 为从开局开始的累计毫秒数。 */
export interface MoveRecord {
  direction: Direction;
  timeMs: number | null;
}
