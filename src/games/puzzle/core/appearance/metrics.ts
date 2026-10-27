import type { BoardMetrics, Theme, ThemeInnerBorder } from '../../types';
import { DEFAULT_BLIND_TILE_COLOR, DEFAULT_INNER_BORDER, DEFAULT_METRICS } from './presets';
import { isValidColorOrTransparent, isValidHexColor } from './theme';

/** 把数值夹取到 [min, max]；非有限值由 normalizeMetrics 负责回退。 */
export function clampRatio(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readRatio(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? clampRatio(value, min, max)
    : fallback;
}

/**
 * 归一化主题的尺寸比例。
 * 非对象、非数字、NaN、Infinity 回退默认值；有限但越界的数字夹取到范围内。
 */
export function normalizeMetrics(raw: unknown): BoardMetrics {
  const record = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};

  return {
    fontSizeRatio: readRatio(record.fontSizeRatio, 0, 1, DEFAULT_METRICS.fontSizeRatio),
    gapRatio: readRatio(record.gapRatio, 0, 0.2, DEFAULT_METRICS.gapRatio),
    radiusRatio: readRatio(record.radiusRatio, 0, 0.5, DEFAULT_METRICS.radiusRatio),
  };
}

/**
 * 归一化方块内边框。
 *
 * 颜色允许 transparent / #rrggbb / #rrggbbaa，非法时回退透明；
 * 宽度非有限数时回退 0，有限但越界时夹取到 0–0.2。
 * 宽度是“格子边长的比例”，不是像素值。
 */
export function normalizeInnerBorder(raw: unknown): ThemeInnerBorder {
  const record = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const color =
    typeof record.color === 'string' && isValidColorOrTransparent(record.color)
      ? record.color
      : DEFAULT_INNER_BORDER.color;
  const widthRatio = readRatio(record.widthRatio, 0, 0.2, DEFAULT_INNER_BORDER.widthRatio);

  return { color, widthRatio };
}

/**
 * 生成棋盘全局 CSS 变量。
 * palette 颜色和逐块字体色由 getTileVisual 逐个 tile 应用，这里只负责盲玩色、
 * 内边框和固定的比例。
 */
export function toCssVariables(theme: Theme): Readonly<Record<string, string>> {
  const metrics = normalizeMetrics(theme.metrics);
  const innerBorder = normalizeInnerBorder(theme.innerBorder);
  const blindTileColor = isValidHexColor(theme.blindTileColor)
    ? theme.blindTileColor
    : DEFAULT_BLIND_TILE_COLOR;

  return Object.freeze({
    '--blind-tile-bg': blindTileColor,
    '--tile-inner-border-color': innerBorder.color,
    '--tile-inner-border-width-ratio': String(innerBorder.widthRatio),
    '--tile-font-ratio': String(metrics.fontSizeRatio),
    '--tile-gap-ratio': String(metrics.gapRatio),
    '--tile-radius-ratio': String(metrics.radiusRatio),
  });
}
