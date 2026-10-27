import type { AppearanceState, ColorMode, PuzzleSize, Theme } from '../../types';
import { PUZZLE_SIZES } from '../board';
import { BUILTIN_THEMES, DEFAULT_THEME_ID, FALLBACK_THEME, FALLBACK_THEME_ID } from './presets';
import { cloneTheme } from './theme';

/**
 * 自定义主题上限。
 *
 * 20 同时用于数据校验和 UI 的加号卡禁用判断；空槽位不写入 themes。
 */
export const CUSTOM_THEME_SLOT_COUNT = 20;

const BUILTIN_THEME_IDS = new Set(BUILTIN_THEMES.map((theme) => theme.id));
const RESERVED_THEME_IDS = new Set([...BUILTIN_THEME_IDS, FALLBACK_THEME_ID]);

/** 创建 9 个阶数都指向同一主题的分配表。 */
function createThemeIdMap(themeId: string): Readonly<Record<PuzzleSize, string>> {
  const map = {} as Record<PuzzleSize, string>;
  for (const size of PUZZLE_SIZES) {
    map[size] = themeId;
  }
  return Object.freeze(map);
}

/** 创建默认外观：两套内置主题 + 所有阶数使用彩虹。 */
export function createDefaultAppearance(): AppearanceState {
  return {
    themeIdBySize: createThemeIdMap(DEFAULT_THEME_ID),
    themes: BUILTIN_THEMES.map(cloneTheme),
  };
}

/** 创建回退外观：两套内置主题 + 所有阶数使用系统回退主题。 */
export function createFallbackAppearance(): AppearanceState {
  return {
    themeIdBySize: createThemeIdMap(FALLBACK_THEME_ID),
    themes: BUILTIN_THEMES.map(cloneTheme),
  };
}

/** 按 ID 找主题；内置主题始终使用 canonical 常量，忽略存储中的临时版本。 */
function findThemeById(appearance: AppearanceState, themeId: string): Theme | null {
  const builtin = BUILTIN_THEMES.find((theme) => theme.id === themeId);
  if (builtin !== undefined) {
    return builtin;
  }
  return appearance.themes.find((theme) => theme.id === themeId && !theme.builtin) ?? null;
}

/**
 * 解析某个阶数实际使用的主题。
 *
 * 以下情况都使用 FALLBACK_THEME：ID 为 fallback、主题不存在、主题不支持该阶数。
 * 调用方不需要自己判断这些异常，渲染层只消费返回的 Theme。
 */
export function getThemeForSize(appearance: AppearanceState, size: PuzzleSize): Theme {
  const themeId = appearance.themeIdBySize[size];
  if (typeof themeId !== 'string' || themeId.length === 0 || themeId === FALLBACK_THEME_ID) {
    return FALLBACK_THEME;
  }

  const theme = findThemeById(appearance, themeId);
  if (theme === null || !theme.supportedSizes.includes(size)) {
    return FALLBACK_THEME;
  }
  return theme;
}

/** 深拷贝外观状态，避免主题数组、分配表和内部对象共享引用。 */
export function cloneAppearance(appearance: AppearanceState): AppearanceState {
  return {
    themeIdBySize: { ...appearance.themeIdBySize },
    themes: appearance.themes.map(cloneTheme),
  };
}

/**
 * 把主题应用到指定阶数。
 *
 * - 只修改选中的阶数，未选中的阶数保持不变；
 * - 主题不支持的阶数会被忽略；
 * - 主题不存在或 ID 为 fallback 时返回原状态；
 * - 没有任何变化时返回同一对象，不修改入参。
 */
export function assignThemeToSizes(
  appearance: AppearanceState,
  themeId: string,
  sizes: readonly PuzzleSize[],
): AppearanceState {
  if (themeId === FALLBACK_THEME_ID) {
    return appearance;
  }

  const target = appearance.themes.find((theme) => theme.id === themeId);
  if (target === undefined) {
    return appearance;
  }

  const selected = new Set(sizes);
  const next: Record<PuzzleSize, string> = { ...appearance.themeIdBySize };
  let changed = false;

  for (const size of PUZZLE_SIZES) {
    if (!selected.has(size) || !target.supportedSizes.includes(size)) {
      continue;
    }
    if (next[size] === themeId) {
      continue;
    }
    next[size] = themeId;
    changed = true;
  }

  return changed ? { ...appearance, themeIdBySize: next } : appearance;
}

/**
 * 派生某个主题当前覆盖的阶数。
 *
 * 按“解析后”的主题计算：指向缺失主题、主题不支持该阶数或值为 fallback 的阶数
 * 都算回退主题覆盖，不会计入真实主题。
 */
export function getThemeCoverage(
  appearance: AppearanceState,
  themeId: string,
): readonly PuzzleSize[] {
  if (typeof themeId !== 'string' || themeId.length === 0) {
    return [];
  }
  return PUZZLE_SIZES.filter((size) => getThemeForSize(appearance, size).id === themeId);
}

/** 列出当前使用系统回退主题的阶数。 */
export function getFallbackSizes(appearance: AppearanceState): readonly PuzzleSize[] {
  return PUZZLE_SIZES.filter((size) => getThemeForSize(appearance, size).id === FALLBACK_THEME_ID);
}

/** 是否存在使用系统回退主题的阶数；设置页和游戏页据此显示提示。 */
export function hasFallbackSizes(appearance: AppearanceState): boolean {
  return getFallbackSizes(appearance).length > 0;
}

/** 主题卡和编辑器预览使用的阶数：支持的最大阶数，空数组回退 10。 */
export function getPreviewSize(theme: Theme): PuzzleSize {
  if (theme.supportedSizes.length === 0) {
    return 10;
  }
  return Math.max(...theme.supportedSizes) as PuzzleSize;
}

/**
 * 新建自定义主题的初始草稿：复制回退主题，换 ID、名称和 builtin 标记。
 * 返回值是深拷贝；编辑器可以自由修改，不会污染 FALLBACK_THEME。
 */
export function createCustomThemeDraft(id: string, name = '新的主题'): Theme {
  return {
    ...cloneTheme(FALLBACK_THEME),
    id,
    name,
    builtin: false,
  };
}

/** 主题支持范围缩小后，把不再支持的已分配阶数改为回退主题。 */
function repairAssignments(
  themeIdBySize: Readonly<Record<PuzzleSize, string>>,
  theme: Theme,
): Readonly<Record<PuzzleSize, string>> {
  const next: Record<PuzzleSize, string> = { ...themeIdBySize };
  let changed = false;

  for (const size of PUZZLE_SIZES) {
    if (next[size] === theme.id && !theme.supportedSizes.includes(size)) {
      next[size] = FALLBACK_THEME_ID;
      changed = true;
    }
  }

  return changed ? next : themeIdBySize;
}

/**
 * 新增或更新自定义主题。
 * 内置主题 ID、回退 ID 和 builtin 主题不可覆盖；新增时遵守 20 个上限。
 * 主题内容变更导致支持范围缩小时，已分配但不再支持的阶数落到回退主题。
 */
export function upsertCustomTheme(appearance: AppearanceState, theme: Theme): AppearanceState {
  if (theme.builtin || RESERVED_THEME_IDS.has(theme.id)) {
    return appearance;
  }

  const nextTheme = cloneTheme(theme);
  const index = appearance.themes.findIndex((item) => item.id === theme.id);
  if (index < 0) {
    const customCount = appearance.themes.filter((item) => !item.builtin).length;
    if (customCount >= CUSTOM_THEME_SLOT_COUNT) {
      return appearance;
    }
    return { ...appearance, themes: [...appearance.themes, nextTheme] };
  }

  const themes = appearance.themes.slice();
  themes[index] = nextTheme;
  return {
    ...appearance,
    themes,
    themeIdBySize: repairAssignments(appearance.themeIdBySize, nextTheme),
  };
}

/**
 * 删除自定义主题；内置主题和回退主题不可删除。
 * 删除后仍指向该主题的阶数显式改为回退主题。
 */
export function removeCustomTheme(appearance: AppearanceState, themeId: string): AppearanceState {
  if (RESERVED_THEME_IDS.has(themeId)) {
    return appearance;
  }

  const target = appearance.themes.find((theme) => theme.id === themeId);
  if (target === undefined || target.builtin) {
    return appearance;
  }

  const nextThemeIdBySize: Record<PuzzleSize, string> = { ...appearance.themeIdBySize };
  for (const size of PUZZLE_SIZES) {
    if (nextThemeIdBySize[size] === themeId) {
      nextThemeIdBySize[size] = FALLBACK_THEME_ID;
    }
  }

  return {
    themeIdBySize: nextThemeIdBySize,
    themes: appearance.themes.filter((theme) => theme.id !== themeId),
  };
}

/** 比较两个数组是否逐项相等（不关心引用）。 */
function isSameArray<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** 比较两个着色模式的所有字段，包括 palette / fontPalette 顺序。 */
function isColorModeEqual(a: ColorMode, b: ColorMode): boolean {
  if (a.mode !== b.mode) {
    return false;
  }
  return isSameArray(a.palette, b.palette) && isSameArray(a.fontPalette, b.fontPalette);
}

/**
 * 比较主题的全部可持久化字段；id/name/builtin 也参与比较。
 *
 * 这是编辑器判断“是否有未保存修改”的底层比较函数。名称首尾空格由调用方
 * 先 trim；这里保持严格逐字段比较，避免隐藏的归一化规则。
 */
export function isThemeEqual(a: Theme, b: Theme): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.builtin === b.builtin &&
    isSameArray(a.supportedSizes, b.supportedSizes) &&
    a.blindTileColor === b.blindTileColor &&
    a.innerBorder.color === b.innerBorder.color &&
    a.innerBorder.widthRatio === b.innerBorder.widthRatio &&
    a.metrics.fontSizeRatio === b.metrics.fontSizeRatio &&
    a.metrics.gapRatio === b.metrics.gapRatio &&
    a.metrics.radiusRatio === b.metrics.radiusRatio &&
    isColorModeEqual(a.color, b.color)
  );
}

/**
 * 判断两份外观状态是否完全相同。
 *
 * 用于设置页的脏状态判断；themeIdBySize 的每个阶数和主题顺序都参与比较。
 * 不修改入参，不做归一化；调用方应比较已归一化的 saved / draft。
 */
export function isAppearanceEqual(a: AppearanceState, b: AppearanceState): boolean {
  if (a.themes.length !== b.themes.length) {
    return false;
  }

  for (const size of PUZZLE_SIZES) {
    if (a.themeIdBySize[size] !== b.themeIdBySize[size]) {
      return false;
    }
  }

  return a.themes.every((theme, index) => {
    const other = b.themes[index];
    return other !== undefined && isThemeEqual(theme, other);
  });
}
