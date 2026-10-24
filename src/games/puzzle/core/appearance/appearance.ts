import type { AppearanceState, ColorMode, Theme } from '../../types';
import { BUILTIN_THEMES, DEFAULT_THEME_ID } from './presets';
import { cloneTheme } from './theme';

/**
 * 自定义主题上限。
 *
 * 3 是旧版 UI 槽位数量；P8-4c 放宽到 20，同时用于数据归一化和加号卡禁用判断。
 * 空槽位不写入 themes。
 */
export const CUSTOM_THEME_SLOT_COUNT = 20;

const BUILTIN_THEME_IDS = new Set(BUILTIN_THEMES.map((theme) => theme.id));

/** 创建默认外观：两套内置主题 + 默认激活彩虹。 */
export function createDefaultAppearance(): AppearanceState {
  return {
    activeThemeId: DEFAULT_THEME_ID,
    themes: BUILTIN_THEMES.map(cloneTheme),
  };
}

/** 返回当前主题；activeThemeId 失效时回退第一个内置主题。 */
export function getActiveTheme(appearance: AppearanceState): Theme {
  return (
    appearance.themes.find((theme) => theme.id === appearance.activeThemeId) ?? BUILTIN_THEMES[0]
  );
}

/** 深拷贝外观状态，避免主题数组和内部对象共享引用。 */
export function cloneAppearance(appearance: AppearanceState): AppearanceState {
  return {
    activeThemeId: appearance.activeThemeId,
    themes: appearance.themes.map(cloneTheme),
  };
}

/** 切换当前主题；目标不存在时返回原状态。 */
export function setActiveTheme(appearance: AppearanceState, themeId: string): AppearanceState {
  if (!appearance.themes.some((theme) => theme.id === themeId)) {
    return appearance;
  }
  if (appearance.activeThemeId === themeId) {
    return appearance;
  }
  return { ...appearance, activeThemeId: themeId };
}

/**
 * 新增或更新自定义主题。
 * 内置主题 ID 和 builtin 主题不可覆盖；命中时返回原状态。
 */
export function upsertCustomTheme(appearance: AppearanceState, theme: Theme): AppearanceState {
  if (theme.builtin || BUILTIN_THEME_IDS.has(theme.id)) {
    return appearance;
  }

  const nextTheme = cloneTheme(theme);
  const index = appearance.themes.findIndex((item) => item.id === theme.id);
  if (index < 0) {
    return { ...appearance, themes: [...appearance.themes, nextTheme] };
  }

  const themes = appearance.themes.slice();
  themes[index] = nextTheme;
  return { ...appearance, themes };
}

/**
 * 删除自定义主题；内置主题不可删除。
 * 删除当前主题时回退到默认内置主题。
 */
export function removeCustomTheme(appearance: AppearanceState, themeId: string): AppearanceState {
  if (BUILTIN_THEME_IDS.has(themeId)) {
    return appearance;
  }

  const target = appearance.themes.find((theme) => theme.id === themeId);
  if (!target || target.builtin) {
    return appearance;
  }

  return {
    activeThemeId:
      appearance.activeThemeId === themeId ? DEFAULT_THEME_ID : appearance.activeThemeId,
    themes: appearance.themes.filter((theme) => theme.id !== themeId),
  };
}

/** 比较两个着色模式的所有字段，包括 palette 顺序。 */
function isColorModeEqual(a: ColorMode, b: ColorMode): boolean {
  if (a.mode !== b.mode) {
    return false;
  }
  if (a.blankColor !== b.blankColor || a.fontColor !== b.fontColor) {
    return false;
  }
  if (a.palette.length !== b.palette.length) {
    return false;
  }
  return a.palette.every((color, index) => color === b.palette[index]);
}

/** 比较主题的全部可持久化字段；id/name/builtin 也参与比较。 */
function isThemeEqual(a: Theme, b: Theme): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.builtin === b.builtin &&
    a.blindTileColor === b.blindTileColor &&
    a.metrics.fontSizeRatio === b.metrics.fontSizeRatio &&
    a.metrics.gapRatio === b.metrics.gapRatio &&
    a.metrics.radiusRatio === b.metrics.radiusRatio &&
    isColorModeEqual(a.color, b.color)
  );
}

/**
 * 判断两份外观状态是否完全相同。
 *
 * 用于设置页主题选择的脏状态判断；主题顺序也参与比较，因为顺序决定卡片展示。
 * 不修改入参，不做归一化；调用方应比较已归一化的 saved / draft。
 */
export function isAppearanceEqual(a: AppearanceState, b: AppearanceState): boolean {
  if (a.activeThemeId !== b.activeThemeId || a.themes.length !== b.themes.length) {
    return false;
  }

  return a.themes.every((theme, index) => {
    const other = b.themes[index];
    return other !== undefined && isThemeEqual(theme, other);
  });
}
