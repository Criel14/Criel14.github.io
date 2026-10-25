/**
 * 主题编辑器页面入口（P8-4c-2d）。
 *
 * 只负责启动和错误兜底；参数解析、草稿、保存和撤销逻辑在
 * ui/theme-editor.ts。页面初始化失败时不自动覆盖存储，只显示可读错误。
 */

import { mountThemeEditor } from '../ui/theme-editor';

function showInitError(error: unknown): void {
  const editor = document.querySelector<HTMLElement>('[data-editor]');
  const fatal = document.querySelector<HTMLElement>('[data-fatal]');
  const message = document.querySelector<HTMLElement>('[data-fatal-message]');
  const detail = error instanceof Error && error.message.length > 0 ? `（${error.message}）` : '';

  if (editor !== null) {
    editor.hidden = true;
  }
  if (fatal !== null) {
    fatal.hidden = false;
  }
  if (message !== null) {
    message.textContent = `页面初始化失败，请刷新后重试。${detail}`;
  }
}

try {
  mountThemeEditor();
} catch (error) {
  console.error('主题编辑器初始化失败', error);
  showInitError(error);
}
