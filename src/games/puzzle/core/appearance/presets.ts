import type { BoardMetrics, Theme } from '../../types';

const PRESET_1_COLORS: readonly string[] = [
  '#e74c3c',
  '#e67e22',
  '#f1c40f',
  '#2ecc71',
  '#1abc9c',
  '#3498db',
  '#6810fa',
  '#8a5201',
  '#767676',
  '#5b2789',
  '#ff8685',
  '#ffc586',
  '#fcf080',
  '#c5ff98',
  '#90fdde',
  '#93d3ff',
  '#c4925f',
  '#dc98ff',
];

const PRESET_2_COLORS: readonly string[] = [
  '#fde5ff',
  '#ffceee',
  '#ffe1c9',
  '#fdcda9',
  '#98ffe1',
  '#81ffd0',
  '#a5e2ff',
  '#81cdfe',
  '#cfd0fe',
  '#bdbcfe',
  '#ff9798',
  '#ff494d',
  '#b0ffb0',
  '#81fd81',
  '#95a403',
  '#6d7600',
  '#ffd2cf',
  '#fdb7b6',
];

const RAINBOW_METRICS: BoardMetrics = Object.freeze({
  fontSizeRatio: 0.5,
  gapRatio: 0.03,
  radiusRatio: 0.04,
});

const RAINBOW_SOFT_METRICS: BoardMetrics = Object.freeze({
  fontSizeRatio: 0.5,
  gapRatio: 0,
  radiusRatio: 0.01,
});

/** 默认主题 ID；内置主题列表的第一项。 */
export const DEFAULT_THEME_ID = 'rainbow';

/** 新建自定义主题和损坏 metrics 的回退值，取自旧预设1。 */
export const DEFAULT_METRICS: BoardMetrics = RAINBOW_METRICS;

/** 冻结主题内部数组和对象，避免调用方共享可变引用。 */
function freezeTheme(theme: Theme): Theme {
  Object.freeze(theme.color.palette);
  Object.freeze(theme.color);
  Object.freeze(theme.metrics);
  return Object.freeze(theme);
}

function createLayerTheme(
  id: string,
  name: string,
  palette: readonly string[],
  metrics: BoardMetrics,
): Theme {
  return freezeTheme({
    id,
    name,
    builtin: true,
    color: {
      mode: 'layer',
      palette,
      blankColor: 'transparent',
      fontColor: '#ffffff',
    },
    metrics,
  });
}

/**
 * 内置主题只保留旧代码的两套降阶预设。
 * 按行、固定色当前作为自定义主题的可选模式，不提供内置预设。
 */
export const BUILTIN_THEMES: readonly Theme[] = Object.freeze([
  createLayerTheme('rainbow', '彩虹', PRESET_1_COLORS, RAINBOW_METRICS),
  createLayerTheme('rainbow-soft', '彩虹微调', PRESET_2_COLORS, RAINBOW_SOFT_METRICS),
]);
