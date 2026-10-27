import { normalizePreferences } from './store';
import type { SitePreferences } from './types';

/**
 * 把偏好应用到 document。
 *
 * 写入 dataset 供 CSS、深色主题和 i18n 接管；不修改 `<html lang>`，
 * 因为界面文案仍是中文，提前改成 en 会让屏幕阅读器读错语言。
 * timerFont 由 `base.css` 的 `[data-timer-font]` 规则切换字体栈与
 * 字重/字距/缩放，游戏页和设置页预览共用同一组 token。
 * largeCursor 由 `game.css` 的 `[data-game-cursor='large']` 规则切换
 * 游戏页大光标；其他页面没有对应规则，因此不会受影响。
 */
export function applyPreferences(
  preferences: SitePreferences,
  root: HTMLElement = document.documentElement,
): void {
  const normalized = normalizePreferences(preferences);

  // 深色 CSS 尚未实现；system 先按 light 处理，避免写出无效的 data-theme。
  root.dataset.theme = normalized.themeMode === 'dark' ? 'dark' : 'light';
  root.dataset.language = normalized.language;
  root.dataset.timerFont = normalized.timerFont;
  root.dataset.gameCursor = normalized.largeCursor ? 'large' : 'default';
}
