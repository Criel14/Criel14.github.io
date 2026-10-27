import type { PuzzleSize, Theme } from '../types';
import { createSolvedBoard } from '../core/board';
import { createBoardView } from './board-view';

export interface ThemePreviewOptions {
  readonly theme: Theme;
  /** 预览阶数；默认 10，正好展示降阶模式的 18 层和固定色模式的 99 色。 */
  readonly size?: PuzzleSize;
  /** 是否显示数字；默认 true。false 时按盲玩隐藏数字的颜色渲染。 */
  readonly numbersVisible?: boolean;
}

/**
 * 装饰性主题预览。
 *
 * 复用游戏页的 board-view，保证颜色、空白块和 metrics 与游戏一致；外层
 * aria-hidden，且不处理输入，设置卡片和编辑器可以直接把它当缩略图使用。
 */
export interface ThemePreview {
  readonly element: HTMLElement;
  setTheme(theme: Theme): void;
  setNumbersVisible(visible: boolean): void;
  destroy(): void;
}

export function createThemePreview(options: ThemePreviewOptions): ThemePreview {
  const size = options.size ?? 10;

  const element = document.createElement('div');
  element.className = 'theme-preview-board';
  element.setAttribute('aria-hidden', 'true');

  const boardView = createBoardView({
    root: element,
    size,
    theme: options.theme,
    numbersVisible: options.numbersVisible ?? true,
  });
  boardView.update(createSolvedBoard(size));

  return {
    element,
    setTheme(theme: Theme): void {
      boardView.setTheme(theme);
    },
    setNumbersVisible(visible: boolean): void {
      boardView.setNumbersVisible(visible);
    },
    destroy(): void {
      boardView.destroy();
      element.remove();
    },
  };
}
