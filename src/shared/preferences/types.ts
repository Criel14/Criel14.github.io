/**
 * 全站偏好：外观模式与界面语言。
 *
 * 这些偏好不属于拼图，后续全站设置页和其他游戏也可以复用；因此使用
 * `site.v1.` 前缀，而不是 `puzzle.v2.`。当前设置页挂在拼图路径下，
 * 只是入口位置的选择，不改变数据的归属。
 */

export type ThemeMode = 'system' | 'light' | 'dark';

export type SiteLanguage = 'zh-CN' | 'en';

export interface SitePreferences {
  readonly themeMode: ThemeMode;
  readonly language: SiteLanguage;
}

export const SITE_PREFERENCES_STORAGE_KEY = 'site.v1.preferences';

export const SITE_PREFERENCES_VERSION = 1;

/**
 * 本轮没有深色 CSS，因此默认用 light 而不是 system：
 * 跟随系统在当前版本也不会产生可见效果。
 */
export const DEFAULT_SITE_PREFERENCES: SitePreferences = Object.freeze({
  themeMode: 'light',
  language: 'zh-CN',
});

const THEME_MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];

const SITE_LANGUAGES: readonly SiteLanguage[] = ['zh-CN', 'en'];

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && THEME_MODES.includes(value as ThemeMode);
}

export function isSiteLanguage(value: unknown): value is SiteLanguage {
  return typeof value === 'string' && SITE_LANGUAGES.includes(value as SiteLanguage);
}
