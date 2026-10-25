import type { PuzzleSize, Theme } from '../types';
import { createSolvedBoard } from '../core/board';
import { getTilePaletteIndex } from '../core/appearance/theme';
import { createBoardView, type BoardView } from './board-view';

export interface ThemeEditorBoardOptions {
  readonly root: HTMLElement;
  readonly theme: Theme;
  readonly size: PuzzleSize;
  /** 点击非空白方块时回调；空白块不会触发。 */
  readonly onPick: (tile: number) => void;
}

export interface ThemeEditorBoard {
  readonly element: HTMLElement;
  setTheme(theme: Theme): void;
  setSize(size: PuzzleSize): void;
  destroy(): void;
}

const AFFECTED_CLASS = 'theme-editor-board__tile--affected';
const INTERACTIVE_CLASS = 'theme-editor-board--interactive';

function findTile(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) {
    return null;
  }
  const tile = target.closest<HTMLElement>('.puzzle-board__tile');
  return tile ?? null;
}

/**
 * 编辑器棋盘。
 *
 * 复用 BoardView 负责实际渲染；本模块只包装编辑器需要的悬停同组高亮和点击。
 * 所有颜色推导仍走 core，避免和设置页/游戏页产生第二套规则。
 */
export function createThemeEditorBoard(options: ThemeEditorBoardOptions): ThemeEditorBoard {
  const { root, onPick } = options;
  const controller = new AbortController();
  const { signal } = controller;

  let theme = options.theme;
  let size = options.size;
  let boardView: BoardView | null = null;
  let hoveredTile: number | null = null;
  let destroyed = false;

  const element = document.createElement('div');
  element.className = 'theme-editor-board';
  element.classList.add(INTERACTIVE_CLASS);
  root.append(element);

  function clearHighlight(): void {
    for (const tile of element.querySelectorAll<HTMLElement>(`.${AFFECTED_CLASS}`)) {
      tile.classList.remove(AFFECTED_CLASS);
    }
  }

  function highlight(tile: number): void {
    clearHighlight();
    const index = getTilePaletteIndex(tile, size, theme.color);
    if (index === null) {
      return;
    }

    for (const node of element.querySelectorAll<HTMLElement>('.puzzle-board__tile')) {
      const value = Number(node.dataset.tile);
      if (value !== 0 && getTilePaletteIndex(value, size, theme.color) === index) {
        node.classList.add(AFFECTED_CLASS);
      }
    }
  }

  function setHoveredTile(tile: number | null): void {
    hoveredTile = tile;
    if (tile === null) {
      clearHighlight();
      return;
    }
    highlight(tile);
  }

  function handlePointerMove(event: PointerEvent): void {
    const tileElement = findTile(event.target);
    if (tileElement === null) {
      // 指针落在 grid 的间隙里也清除高亮，避免悬停状态停留在上一个方块。
      if (hoveredTile !== null) {
        setHoveredTile(null);
      }
      return;
    }
    const tile = Number(tileElement.dataset.tile);
    if (!Number.isInteger(tile)) {
      return;
    }
    if (tile === 0) {
      if (hoveredTile !== null) {
        setHoveredTile(null);
      }
      return;
    }
    if (tile === hoveredTile) {
      return;
    }
    setHoveredTile(tile);
  }

  function handlePointerLeave(): void {
    setHoveredTile(null);
  }

  function handleClick(event: MouseEvent): void {
    const tileElement = findTile(event.target);
    if (tileElement === null) {
      return;
    }
    const tile = Number(tileElement.dataset.tile);
    if (!Number.isInteger(tile) || tile <= 0) {
      return;
    }
    onPick(tile);
  }

  function createBoard(): void {
    const next = createBoardView({
      root: element,
      size,
      theme,
    });
    next.element.setAttribute('aria-label', `主题预览棋盘，${size}×${size}`);
    next.update(createSolvedBoard(size));
    boardView = next;
  }

  function destroyBoard(): void {
    boardView?.destroy();
    boardView = null;
  }

  element.addEventListener('pointermove', handlePointerMove, { signal });
  element.addEventListener('pointerleave', handlePointerLeave, { signal });
  element.addEventListener('click', handleClick, { signal });

  createBoard();

  return {
    element,

    setTheme(nextTheme: Theme): void {
      if (destroyed) {
        return;
      }
      theme = nextTheme;
      boardView?.setTheme(theme);
      if (hoveredTile !== null) {
        highlight(hoveredTile);
      }
    },

    setSize(nextSize: PuzzleSize): void {
      if (destroyed || size === nextSize) {
        return;
      }
      size = nextSize;
      hoveredTile = null;
      destroyBoard();
      element.replaceChildren();
      createBoard();
    },

    destroy(): void {
      if (destroyed) {
        return;
      }
      destroyed = true;
      controller.abort();
      destroyBoard();
      element.remove();
    },
  };
}
