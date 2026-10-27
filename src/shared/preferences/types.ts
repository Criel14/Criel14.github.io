/**
 * 全站偏好：颜色主题、界面语言、计时器字体、游戏页鼠标指针与极简计时。
 *
 * 这些偏好不属于拼图，后续全站设置页和其他游戏也可以复用；因此使用
 * `site.v1.` 前缀，而不是 `puzzle.v2.`。当前设置页挂在拼图路径下，
 * 只是入口位置的选择，不改变数据的归属。
 */

export type ThemeMode = 'system' | 'light' | 'dark';

export type SiteLanguage = 'zh-CN' | 'en';

/**
 * 计时器可选字体 ID。
 *
 * 顺序与设置页字体卡片一致；字体栈和字重/字距/缩放参数在 `base.css`
 * 中按同名 `data-timer-font` 值维护，新增字体时需要同时补对应 CSS。
 */
export const TIMER_FONT_IDS = [
  'jetbrains-mono',
  'alibaba-puhuiti',
  'arial',
  'dseg7-classic',
  'audiowide',
  'press-start-2p',
] as const;

export type TimerFontId = (typeof TIMER_FONT_IDS)[number];

export interface SitePreferences {
  readonly themeMode: ThemeMode;
  readonly language: SiteLanguage;
  readonly timerFont: TimerFontId;
  /**
   * 游戏页是否使用 128×128 的大鼠标指针。
   * 默认开启：高速移动鼠标时更容易看清指针位置；只影响游戏页。
   */
  readonly largeCursor: boolean;
  /**
   * 是否在每局第一次有效移动后进入极简计时视图。
   * 默认关闭：只隐藏菜单、统计明细和入口，不改变计时、计步或成绩。
   */
  readonly timerOnlyOnMove: boolean;
}

export const SITE_PREFERENCES_STORAGE_KEY = 'site.v1.preferences';

export const SITE_PREFERENCES_VERSION = 1;

/**
 * 本轮没有深色 CSS，因此默认用 light 而不是 system：
 * 跟随系统在当前版本也不会产生可见效果。
 * 计时器默认使用 JetBrains Mono，和引入字体时的游戏页行为保持一致。
 * 大鼠标指针默认开启，因为它是为高速游玩准备的可读性增强。
 * 极简计时默认关闭，避免用户第一次移动时界面突然变化。
 */
export const DEFAULT_SITE_PREFERENCES: SitePreferences = Object.freeze({
  themeMode: 'light',
  language: 'zh-CN',
  timerFont: 'jetbrains-mono',
  largeCursor: true,
  timerOnlyOnMove: false,
});

const THEME_MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];

const SITE_LANGUAGES: readonly SiteLanguage[] = ['zh-CN', 'en'];

const TIMER_FONT_ID_SET: ReadonlySet<string> = new Set(TIMER_FONT_IDS);

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && THEME_MODES.includes(value as ThemeMode);
}

export function isSiteLanguage(value: unknown): value is SiteLanguage {
  return typeof value === 'string' && SITE_LANGUAGES.includes(value as SiteLanguage);
}

export function isTimerFontId(value: unknown): value is TimerFontId {
  return typeof value === 'string' && TIMER_FONT_ID_SET.has(value);
}
