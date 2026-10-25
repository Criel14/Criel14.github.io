import type { Board, PuzzleSize, Theme } from '../types';
import { isPuzzleSize, isValidBoard } from '../core/board';
import { toCssVariables } from '../core/appearance/metrics';
import { getTileVisual } from '../core/appearance/theme';

/** 创建棋盘视图的选项；root 只需要是一个专用容器。 */
export interface BoardViewOptions {
  readonly root: HTMLElement;
  readonly size: PuzzleSize;
  readonly theme: Theme;
  /** 数字是否可见；盲玩隐藏数字时传 false。默认 true。 */
  readonly numbersVisible?: boolean;
}

/**
 * 只读棋盘视图。
 *
 * 只负责渲染，不处理输入、不读写存储、不关心 session；
 * 点击/滑动等手势由 `board-input.ts` 采集，页面再交给 core 处理。
 * 阶数在创建时固定，改阶数时销毁并重新创建。
 */
export interface BoardView {
  /** 棋盘外层元素；输入模块和页面布局挂在这里。 */
  readonly element: HTMLElement;
  /** 用新盘面更新视图；只重绘发生变化的格子。 */
  update(board: Board): void;
  /** 换主题；更新 CSS 变量和全部格子颜色，不重建 DOM。 */
  setTheme(theme: Theme): void;
  /** 切换数字可见性；只改 class 和无障碍标签，不重建 DOM。 */
  setNumbersVisible(visible: boolean): void;
  /** 从 DOM 移除棋盘；之后调用其他方法均为 no-op。 */
  destroy(): void;
}

const BLANK_TILE_LABEL = '空白';
const HIDDEN_TILE_LABEL = '隐藏数字的方块';
const NUMBERS_HIDDEN_CLASS = 'puzzle-board--numbers-hidden';

interface TileNode {
  readonly element: HTMLElement;
  readonly valueElement: HTMLElement;
}

/** 数字隐藏时不能把数字写进 aria-label，否则屏幕阅读器仍能读到。 */
function getTileLabel(tile: number, numbersVisible: boolean): string {
  if (tile === 0) {
    return BLANK_TILE_LABEL;
  }
  return numbersVisible ? `数字 ${tile}` : HIDDEN_TILE_LABEL;
}

export function createBoardView(options: BoardViewOptions): BoardView {
  const { root, size } = options;
  if (!isPuzzleSize(size)) {
    throw new RangeError('size 必须是 2 到 10 的整数');
  }

  let theme = options.theme;
  let numbersVisible = options.numbersVisible ?? true;
  let previousBoard: Board | null = null;
  let destroyed = false;

  // 外层负责容器查询和正方形比例；内层才是真正的 CSS Grid。
  // 容器查询单位不能用于容器自身，因此必须保留这两层。
  const element = document.createElement('div');
  element.className = 'puzzle-board';
  element.style.setProperty('--board-size', String(size));
  element.dataset.size = String(size);
  element.setAttribute('role', 'group');
  element.setAttribute('aria-label', '数字华容道棋盘');

  const grid = document.createElement('div');
  grid.className = 'puzzle-board__grid';

  const tiles: TileNode[] = [];
  const cellCount = size * size;
  for (let index = 0; index < cellCount; index += 1) {
    const tileElement = document.createElement('div');
    tileElement.className = 'puzzle-board__tile';
    tileElement.dataset.index = String(index);
    // P8-5 再做完整键盘/焦点方案；当前用 img 语义暴露数字，不伪装成可聚焦按钮。
    tileElement.setAttribute('role', 'img');

    const valueElement = document.createElement('span');
    valueElement.className = 'puzzle-board__value';
    tileElement.append(valueElement);

    grid.append(tileElement);
    tiles.push({ element: tileElement, valueElement });
  }

  element.append(grid);
  root.append(element);

  function updateTileLabel(node: TileNode, tile: number): void {
    node.element.setAttribute('aria-label', getTileLabel(tile, numbersVisible));
  }

  function updateTile(index: number, tile: number): void {
    const node = tiles[index];
    if (node === undefined) {
      return;
    }

    const isBlank = tile === 0;
    node.element.classList.toggle('puzzle-board__tile--blank', isBlank);
    // 稳定的数字钩子：编辑器和后续测试不需要依赖棋子位置或 textContent。
    node.element.dataset.tile = String(tile);
    node.valueElement.textContent = isBlank ? '' : String(tile);
    updateTileLabel(node, tile);

    const visual = getTileVisual(tile, size, theme);
    node.element.style.setProperty('--tile-bg', visual.background);
    node.element.style.setProperty('--tile-fg', visual.color);
  }

  function renderAll(board: Board): void {
    for (let index = 0; index < board.length; index += 1) {
      updateTile(index, board[index] ?? 0);
    }
  }

  function applyThemeVariables(): void {
    for (const [name, value] of Object.entries(toCssVariables(theme))) {
      element.style.setProperty(name, value);
    }
  }

  function applyNumbersVisibility(): void {
    element.classList.toggle(NUMBERS_HIDDEN_CLASS, !numbersVisible);
  }

  applyThemeVariables();
  applyNumbersVisibility();
  // 初始状态先画成空白盘；页面拿到打乱后再调用 update。
  for (let index = 0; index < cellCount; index += 1) {
    updateTile(index, 0);
  }

  return {
    element,

    update(board: Board): void {
      if (destroyed) {
        return;
      }
      if (!isValidBoard(board, size)) {
        throw new RangeError('board 必须是当前阶数的完整排列');
      }

      if (previousBoard === null) {
        renderAll(board);
      } else {
        for (let index = 0; index < board.length; index += 1) {
          if (previousBoard[index] !== board[index]) {
            updateTile(index, board[index] ?? 0);
          }
        }
      }
      previousBoard = [...board];
    },

    setTheme(nextTheme: Theme): void {
      if (destroyed) {
        return;
      }
      theme = nextTheme;
      applyThemeVariables();
      if (previousBoard !== null) {
        renderAll(previousBoard);
      }
    },

    setNumbersVisible(visible: boolean): void {
      if (destroyed || numbersVisible === visible) {
        return;
      }
      numbersVisible = visible;
      applyNumbersVisibility();
      if (previousBoard !== null) {
        for (let index = 0; index < previousBoard.length; index += 1) {
          const node = tiles[index];
          if (node !== undefined) {
            updateTileLabel(node, previousBoard[index] ?? 0);
          }
        }
      }
    },

    destroy(): void {
      if (destroyed) {
        return;
      }
      destroyed = true;
      previousBoard = null;
      element.remove();
    },
  };
}
