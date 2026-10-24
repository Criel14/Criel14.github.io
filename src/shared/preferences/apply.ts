import { normalizePreferences } from './store';
import type { SitePreferences } from './types';

/**
 * 把偏好应用到 document。
 *
 * 本轮只写 dataset，供后续深色主题和 i18n 接管；不修改 `<html lang>`，
 * 因为界面文案仍是中文，提前改成 en 会让屏幕阅读器读错语言。
 */
export function applyPreferences(
  preferences: SitePreferences,
  root: HTMLElement = document.documentElement,
): void {
  const normalized = normalizePreferences(preferences);

  // 深色 CSS 尚未实现；system 先按 light 处理，避免写出无效的 data-theme。
  root.dataset.theme = normalized.themeMode === 'dark' ? 'dark' : 'light';
  root.dataset.language = normalized.language;
}
