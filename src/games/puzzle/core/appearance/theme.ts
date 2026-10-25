import type { ColorMode, Theme } from '../../types';
import { isPuzzleSize } from '../board';
import { getTileLayer } from './layers';

/** 一个方块最终需要的背景色和字体色。 */
export interface TileVisual {
  readonly background: string;
  readonly color: string;
}

const FALLBACK_COLOR = '#ffffff';
const TRANSPARENT = 'transparent';
const AUTO_FONT_COLOR = 'auto';

/** 判断 tile 是否是当前阶数下的有效非空白方块。 */
function isRenderableTile(tile: number, size: number): boolean {
  return isPuzzleSize(size) && Number.isInteger(tile) && tile > 0 && tile < size * size;
}

/**
 * 按主题模式把方块映射到 palette / fontPalette 的 0-based 索引；空白/非法返回 null。
 *
 * 编辑器的油漆桶、吸管和悬停高亮都复用这个映射，避免在 UI 里重新实现
 * 按层/按行/固定色的规则。
 */
export function getTilePaletteIndex(tile: number, size: number, color: ColorMode): number | null {
  if (!isRenderableTile(tile, size)) {
    return null;
  }

  switch (color.mode) {
    case 'layer': {
      const layer = getTileLayer(tile, size);
      return layer > 0 ? layer - 1 : null;
    }
    case 'row':
      return Math.floor((tile - 1) / size);
    case 'fixed':
      return tile - 1;
  }
}

/** 取方块对应的色板颜色；索引越界时回退白色。 */
function getPaletteColor(tile: number, size: number, color: ColorMode): string | null {
  const index = getTilePaletteIndex(tile, size, color);
  if (index === null) {
    return null;
  }
  return color.palette[index] ?? FALLBACK_COLOR;
}

/** 取方块对应的字体色配置；索引越界时回退 auto。 */
function getFontPaletteColor(tile: number, size: number, color: ColorMode): string {
  const index = getTilePaletteIndex(tile, size, color);
  if (index === null) {
    return AUTO_FONT_COLOR;
  }
  return color.fontPalette[index] ?? AUTO_FONT_COLOR;
}

/** 主题里的空白色非法时退回透明，避免把棋盘染成白色。 */
function getSafeBlankColor(color: ColorMode): string {
  return isValidBlankColor(color.blankColor) ? color.blankColor : TRANSPARENT;
}

/** 判断是否为严格的 #rrggbb 颜色。 */
export function isValidHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

/** 空白色和内边框颜色都允许透明或 #rrggbb。 */
export function isValidBlankColor(value: string): boolean {
  return value === TRANSPARENT || isValidHexColor(value);
}

/** 字体色允许 auto 或 #rrggbb。 */
export function isValidFontColor(value: string): boolean {
  return value === AUTO_FONT_COLOR || isValidHexColor(value);
}

function parseHexColor(value: string): [number, number, number] | null {
  if (!isValidHexColor(value)) {
    return null;
  }
  return [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
  ];
}

function linearizeChannel(value: number): number {
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/**
 * 根据背景亮度选择黑色或白色字体。
 * 阈值使用 WCAG 常用的 0.179 相对亮度分界，非法背景回退白色字体。
 */
export function getReadableFontColor(background: string): string {
  const rgb = parseHexColor(background);
  if (rgb === null) {
    return FALLBACK_COLOR;
  }

  const [red, green, blue] = rgb;
  const luminance =
    0.2126 * linearizeChannel(red / 255) +
    0.7152 * linearizeChannel(green / 255) +
    0.0722 * linearizeChannel(blue / 255);
  return luminance > 0.179 ? '#000000' : FALLBACK_COLOR;
}

/** 解析单个字体色；auto 或非法值都按背景亮度计算。 */
function resolveFontColor(background: string, fontColor: string): string {
  if (fontColor !== AUTO_FONT_COLOR && isValidHexColor(fontColor)) {
    return fontColor;
  }
  return getReadableFontColor(background);
}

/** 返回方块背景色；空白/非法方块使用主题空白色。 */
export function getTileColor(tile: number, size: number, theme: Theme): string {
  if (!isRenderableTile(tile, size)) {
    return getSafeBlankColor(theme.color);
  }
  return getPaletteColor(tile, size, theme.color) ?? FALLBACK_COLOR;
}

/** 返回方块字体色；空白/非法方块使用透明字体。 */
export function getTileFontColor(tile: number, size: number, theme: Theme): string {
  if (!isRenderableTile(tile, size)) {
    return TRANSPARENT;
  }
  const background = getPaletteColor(tile, size, theme.color) ?? FALLBACK_COLOR;
  return resolveFontColor(background, getFontPaletteColor(tile, size, theme.color));
}

/** 统一返回方块视觉；board-view 只需消费这一个函数。 */
export function getTileVisual(tile: number, size: number, theme: Theme): TileVisual {
  if (!isRenderableTile(tile, size)) {
    return { background: getSafeBlankColor(theme.color), color: TRANSPARENT };
  }

  const background = getPaletteColor(tile, size, theme.color) ?? FALLBACK_COLOR;
  return {
    background,
    color: resolveFontColor(background, getFontPaletteColor(tile, size, theme.color)),
  };
}

function cloneColorMode(color: ColorMode): ColorMode {
  switch (color.mode) {
    case 'layer':
      return {
        mode: 'layer',
        palette: [...color.palette],
        fontPalette: [...color.fontPalette],
        blankColor: color.blankColor,
      };
    case 'row':
      return {
        mode: 'row',
        palette: [...color.palette],
        fontPalette: [...color.fontPalette],
        blankColor: color.blankColor,
      };
    case 'fixed':
      return {
        mode: 'fixed',
        palette: [...color.palette],
        fontPalette: [...color.fontPalette],
        blankColor: color.blankColor,
      };
  }
}

/** 深拷贝主题，避免调用方共享 palette、fontPalette、supportedSizes 或 metrics 引用。 */
export function cloneTheme(theme: Theme): Theme {
  return {
    ...theme,
    supportedSizes: [...theme.supportedSizes],
    color: cloneColorMode(theme.color),
    innerBorder: { ...theme.innerBorder },
    metrics: { ...theme.metrics },
  };
}
