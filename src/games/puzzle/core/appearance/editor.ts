import type { ColorMode, PuzzleSize, Theme } from '../../types';
import { isPuzzleSize, PUZZLE_SIZES } from '../board';
import { CUSTOM_THEME_SLOT_COUNT, isThemeEqual } from './appearance';
import { getThemeNameError } from './name';
import { BUILTIN_THEMES, DEFAULT_BLIND_TILE_COLOR, FALLBACK_THEME_ID } from './presets';
import {
  cloneTheme,
  getReadableFontColor,
  getTilePaletteIndex,
  isValidBlankColor,
  isValidFontColor,
  isValidHexColor,
} from './theme';

/** 各着色模式的 palette / fontPalette 固定长度；切换模式时按这个长度截断补齐。 */
export const COLOR_MODE_PALETTE_LENGTHS: Readonly<Record<ColorMode['mode'], number>> =
  Object.freeze({
    layer: 18,
    row: 10,
    fixed: 99,
  });

/** 编辑器样式刷：背景色和文字色都是明确的 #rrggbb，不使用 auto。 */
export interface ThemeBrush {
  readonly background: string;
  readonly fontColor: string;
}

/** 颜色模式切换后的调色板长度；非法模式返回 0。 */
export function getColorModePaletteLength(mode: ColorMode['mode']): number {
  return COLOR_MODE_PALETTE_LENGTHS[mode] ?? 0;
}

function createColorMode(
  mode: ColorMode['mode'],
  palette: readonly string[],
  fontPalette: readonly string[],
  blankColor: string,
): ColorMode {
  switch (mode) {
    case 'layer':
      return { mode, palette: [...palette], fontPalette: [...fontPalette], blankColor };
    case 'row':
      return { mode, palette: [...palette], fontPalette: [...fontPalette], blankColor };
    case 'fixed':
      return { mode, palette: [...palette], fontPalette: [...fontPalette], blankColor };
  }
}

/**
 * 切换主题的着色模式。
 *
 * 按索引保留重叠部分，新模式多出来的背景色补站点主题蓝、字体色补 auto；
 * 缩小时直接截断。空白色保持不变。返回深拷贝，不修改入参；模式相同时返回原对象。
 */
export function changeThemeColorMode(theme: Theme, mode: ColorMode['mode']): Theme {
  if (theme.color.mode === mode) {
    return theme;
  }

  const length = getColorModePaletteLength(mode);
  const palette = Array.from(
    { length },
    (_, index) => theme.color.palette[index] ?? DEFAULT_BLIND_TILE_COLOR,
  );
  // 编辑器不再生成 auto；新模式多出来的项使用默认蓝对应的白色字体。
  const fallbackFontColor = getReadableFontColor(DEFAULT_BLIND_TILE_COLOR);
  const fontPalette = Array.from(
    { length },
    (_, index) => theme.color.fontPalette[index] ?? fallbackFontColor,
  );

  return {
    ...cloneTheme(theme),
    color: createColorMode(mode, palette, fontPalette, theme.color.blankColor),
  };
}

/**
 * 把已保存主题转换成编辑器可直接编辑的形式。
 *
 * - 旧数据里的字体色 `auto` 转成当前背景对应的黑/白；编辑器不再提供自动模式。
 * - 空白色统一固定为 `transparent`；空白块不再允许自定义。
 * - 其余字段和模式保持不变，返回深拷贝，不修改入参。
 *
 * 视觉上与原来的 auto 结果一致，因此这个转换本身不产生未保存状态。
 */
export function prepareThemeForEditor(theme: Theme): Theme {
  const clone = cloneTheme(theme);
  const palette = clone.color.palette;
  const fontPalette = Array.from({ length: palette.length }, (_, index) => {
    const configured = clone.color.fontPalette[index];
    if (typeof configured === 'string' && configured !== 'auto' && isValidHexColor(configured)) {
      return configured;
    }
    return getReadableFontColor(palette[index] ?? DEFAULT_BLIND_TILE_COLOR);
  });

  return {
    ...clone,
    color: createColorMode(clone.color.mode, palette, fontPalette, 'transparent'),
  };
}

/**
 * 返回某个方块在当前模式下的同组方块数字。
 *
 * 按层返回同一 L 形层的全部数字，按行返回同一行，固定色只返回该数字自己。
 * 空白块、非法阶数返回空数组；顺序从 1 开始，便于悬停提示稳定展示数量。
 */
export function getAffectedTiles(
  tile: number,
  size: PuzzleSize,
  color: ColorMode,
): readonly number[] {
  const targetIndex = getTilePaletteIndex(tile, size, color);
  if (targetIndex === null || !isPuzzleSize(size)) {
    return [];
  }

  const tiles: number[] = [];
  for (let candidate = 1; candidate < size * size; candidate += 1) {
    if (getTilePaletteIndex(candidate, size, color) === targetIndex) {
      tiles.push(candidate);
    }
  }
  return tiles;
}

/**
 * 把样式刷应用到某个方块所在的组。
 *
 * 层/行模式会一次修改该组的同一个 palette / fontPalette 项，固定色只改该数字。
 * 空白块、非法颜色或颜色完全相同时返回原主题，不产生历史步骤。
 */
export function applyBrushToTheme(
  theme: Theme,
  tile: number,
  size: PuzzleSize,
  brush: ThemeBrush,
): Theme {
  const index = getTilePaletteIndex(tile, size, theme.color);
  if (index === null || !isValidHexColor(brush.background) || !isValidHexColor(brush.fontColor)) {
    return theme;
  }
  if (
    theme.color.palette[index] === brush.background &&
    theme.color.fontPalette[index] === brush.fontColor
  ) {
    return theme;
  }

  const palette = [...theme.color.palette];
  const fontPalette = [...theme.color.fontPalette];
  palette[index] = brush.background;
  fontPalette[index] = brush.fontColor;

  return {
    ...theme,
    color: createColorMode(theme.color.mode, palette, fontPalette, theme.color.blankColor),
  };
}

/**
 * 从某个方块所在的组读取样式刷。
 *
 * 吸管只读取当前 palette / fontPalette，不修改主题；空白块或非法方块返回 null。
 */
export function readBrushFromTheme(
  theme: Theme,
  tile: number,
  size: PuzzleSize,
): ThemeBrush | null {
  const index = getTilePaletteIndex(tile, size, theme.color);
  if (index === null) {
    return null;
  }

  const rawBackground = theme.color.palette[index];
  const background =
    typeof rawBackground === 'string' && isValidHexColor(rawBackground)
      ? rawBackground
      : DEFAULT_BLIND_TILE_COLOR;
  const fontColor = theme.color.fontPalette[index];
  return {
    background,
    // auto 或非法值在吸管里也解析成明确的对比色，保证样式刷永远是具体颜色。
    fontColor:
      typeof fontColor === 'string' && isValidHexColor(fontColor)
        ? fontColor
        : getReadableFontColor(background),
  };
}

/** 比较编辑器脏状态时，名称首尾空格不参与比较；保存前也会 trim。 */
export function isThemeDirty(baseline: Theme, draft: Theme): boolean {
  return !isThemeEqual(
    { ...baseline, name: baseline.name.trim() },
    { ...draft, name: draft.name.trim() },
  );
}

export type ThemeValidationField =
  | 'name'
  | 'supportedSizes'
  | 'usage'
  | 'palette'
  | 'fontPalette'
  | 'blankColor'
  | 'blindTileColor'
  | 'innerBorder'
  | 'metrics'
  | 'id'
  | 'limit';

export interface ThemeValidationIssue {
  readonly field: ThemeValidationField;
  /** 可直接展示给用户的中文错误，不在 UI 里重新拼装。 */
  readonly message: string;
}

export interface ThemeValidationContext {
  readonly existingThemes: readonly Theme[];
  /** 当前已保存/待保存的按阶数分配，用来阻止取消正在使用的支持阶数。 */
  readonly themeIdBySize: Readonly<Record<PuzzleSize, string>>;
  readonly isNew: boolean;
}

function isFiniteInRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

function formatSizeList(sizes: readonly PuzzleSize[]): string {
  return sizes.map((size) => `${size}×${size}`).join('、');
}

/**
 * 校验编辑器 draft 是否可保存。
 *
 * 这里覆盖编辑器能修改的全部字段，以及 ID、20 个上限和“正在使用的阶数不能
 * 取消支持”。错误按字段返回，页面负责把名称/阶数错误放到对应区域。
 */
export function validateTheme(
  theme: Theme,
  context: ThemeValidationContext,
): readonly ThemeValidationIssue[] {
  const issues: ThemeValidationIssue[] = [];

  const nameError = getThemeNameError(theme.name);
  if (nameError !== null) {
    issues.push({ field: 'name', message: nameError });
  }

  const supportedSizes = theme.supportedSizes;
  if (supportedSizes.length === 0) {
    issues.push({ field: 'supportedSizes', message: '至少选择一个支持的阶数。' });
  } else if (!supportedSizes.every((size) => isPuzzleSize(size))) {
    issues.push({ field: 'supportedSizes', message: '支持阶数必须是 2×2 到 10×10。' });
  } else {
    const unique = new Set(supportedSizes);
    const sorted = supportedSizes.every(
      (size, index) => index === 0 || size > supportedSizes[index - 1]!,
    );
    if (unique.size !== supportedSizes.length || !sorted) {
      issues.push({ field: 'supportedSizes', message: '支持阶数必须升序且不能重复。' });
    }
  }

  const usedButUnsupported = PUZZLE_SIZES.filter(
    (size) => context.themeIdBySize[size] === theme.id && !supportedSizes.includes(size),
  );
  if (usedButUnsupported.length > 0) {
    issues.push({
      field: 'usage',
      message: `该主题正在用于 ${formatSizeList(usedButUnsupported)}，请先在设置页为这些阶数选择其他主题。`,
    });
  }

  const paletteLength = getColorModePaletteLength(theme.color.mode);
  if (theme.color.palette.length !== paletteLength) {
    issues.push({
      field: 'palette',
      message: `背景色数量必须为 ${paletteLength} 个。`,
    });
  } else if (!theme.color.palette.every((color) => isValidHexColor(color))) {
    issues.push({ field: 'palette', message: '所有背景色都必须是 #rrggbb 格式。' });
  }

  if (theme.color.fontPalette.length !== theme.color.palette.length) {
    issues.push({ field: 'fontPalette', message: '文字色数量必须与背景色一致。' });
  } else if (!theme.color.fontPalette.every((color) => isValidFontColor(color))) {
    issues.push({ field: 'fontPalette', message: '文字色必须是 auto 或 #rrggbb 格式。' });
  }

  if (!isValidBlankColor(theme.color.blankColor)) {
    issues.push({ field: 'blankColor', message: '空白色必须是 transparent 或 #rrggbb。' });
  }
  if (!isValidHexColor(theme.blindTileColor)) {
    issues.push({ field: 'blindTileColor', message: '盲玩色必须是 #rrggbb 格式。' });
  }
  if (
    !isValidBlankColor(theme.innerBorder.color) ||
    !isFiniteInRange(theme.innerBorder.widthRatio, 0, 0.1)
  ) {
    issues.push({ field: 'innerBorder', message: '内边框颜色或宽度不合法。' });
  }

  const metrics = theme.metrics;
  if (
    !isFiniteInRange(metrics.fontSizeRatio, 0, 1) ||
    !isFiniteInRange(metrics.gapRatio, 0, 0.1) ||
    !isFiniteInRange(metrics.radiusRatio, 0, 0.5)
  ) {
    issues.push({ field: 'metrics', message: '字号、间隙或圆角超出允许范围。' });
  }

  if (theme.id.trim().length === 0 || theme.builtin) {
    issues.push({ field: 'id', message: '主题 ID 不合法。' });
  } else if (
    BUILTIN_THEMES.some((item) => item.id === theme.id) ||
    theme.id === FALLBACK_THEME_ID
  ) {
    issues.push({ field: 'id', message: '不能使用内置主题或回退主题的 ID。' });
  }

  if (context.isNew && context.existingThemes.some((item) => item.id === theme.id)) {
    issues.push({ field: 'id', message: '主题 ID 已存在。' });
  }

  if (
    context.isNew &&
    context.existingThemes.filter((item) => !item.builtin).length >= CUSTOM_THEME_SLOT_COUNT
  ) {
    issues.push({
      field: 'limit',
      message: `最多创建 ${CUSTOM_THEME_SLOT_COUNT} 个自定义主题。`,
    });
  }

  return issues;
}
