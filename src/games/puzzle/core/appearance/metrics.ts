import type { BoardMetrics, Theme } from '../../types';
import { DEFAULT_BLIND_TILE_COLOR, DEFAULT_METRICS } from './presets';
import { isValidBlankColor, isValidHexColor } from './theme';

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
    gapRatio: readRatio(record.gapRatio, 0, 0.1, DEFAULT_METRICS.gapRatio),
    radiusRatio: readRatio(record.radiusRatio, 0, 0.5, DEFAULT_METRICS.radiusRatio),
  };
}

/**
 * 生成棋盘全局 CSS 变量。
 * palette 颜色由 getTileVisual 逐个 tile 应用，这里只负责空白色、盲玩色和固定的比例。
 */
export function toCssVariables(theme: Theme): Readonly<Record<string, string>> {
  const metrics = normalizeMetrics(theme.metrics);
  const blankColor = isValidBlankColor(theme.color.blankColor)
    ? theme.color.blankColor
    : 'transparent';
  const blindTileColor = isValidHexColor(theme.blindTileColor)
    ? theme.blindTileColor
    : DEFAULT_BLIND_TILE_COLOR;

  return Object.freeze({
    '--blank-color': blankColor,
    '--blind-tile-bg': blindTileColor,
    '--tile-font-ratio': String(metrics.fontSizeRatio),
    '--tile-gap-ratio': String(metrics.gapRatio),
    '--tile-radius-ratio': String(metrics.radiusRatio),
  });
}
