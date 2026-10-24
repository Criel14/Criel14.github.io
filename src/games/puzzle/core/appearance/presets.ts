import type { BoardMetrics, Theme, ThemeInnerBorder } from '../../types';
import { PUZZLE_SIZES } from '../board';

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

/** 回退主题的中性间距：比彩虹主题更疏、无圆角，异常时不继承某个预设的视觉。 */
const FALLBACK_METRICS: BoardMetrics = Object.freeze({
  fontSizeRatio: 0.5,
  gapRatio: 0.06,
  radiusRatio: 0,
});

/** 默认主题 ID；内置主题列表的第一项。 */
export const DEFAULT_THEME_ID = 'rainbow';

/** 系统回退主题 ID；保留 ID，不进入主题列表、不可选择、不持久化。 */
export const FALLBACK_THEME_ID = 'fallback';

/** 新建自定义主题和损坏盲玩色的回退值；P8-4c-2 起使用站点主题蓝。 */
export const DEFAULT_BLIND_TILE_COLOR = '#3498db';

/** 方块内边框默认值；透明但宽度 0，不改变旧主题视觉和字号。 */
export const DEFAULT_INNER_BORDER: ThemeInnerBorder = Object.freeze({
  color: 'transparent',
  widthRatio: 0,
});

/** 新建自定义主题和损坏 metrics 的回退值，取自旧预设1。 */
export const DEFAULT_METRICS: BoardMetrics = RAINBOW_METRICS;

/** 生成指定长度的同色字体色板；每次调用返回新数组，避免主题间共享可变引用。 */
function createFontPalette(length: number, color: string): string[] {
  return Array.from({ length }, () => color);
}

/** 冻结主题内部数组和对象，避免调用方共享可变引用。 */
function freezeTheme(theme: Theme): Theme {
  Object.freeze(theme.supportedSizes);
  Object.freeze(theme.color.palette);
  Object.freeze(theme.color.fontPalette);
  Object.freeze(theme.color);
  Object.freeze(theme.innerBorder);
  Object.freeze(theme.metrics);
  return Object.freeze(theme);
}

/**
 * 创建降阶内置主题。
 * 内置主题始终支持全部 2–10 阶；字体色沿用旧版白色，内边框默认不占位。
 */
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
    supportedSizes: PUZZLE_SIZES,
    color: {
      mode: 'layer',
      palette,
      fontPalette: createFontPalette(palette.length, '#ffffff'),
      blankColor: 'transparent',
    },
    innerBorder: { ...DEFAULT_INNER_BORDER },
    blindTileColor: DEFAULT_BLIND_TILE_COLOR,
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

/**
 * 系统回退主题。
 *
 * 用于主题缺失、损坏、版本不兼容和 localStorage 不可用等异常，也作为新建主题的
 * 初始 draft。它不在 BUILTIN_THEMES 里，因此不会出现在主题列表或存储中。
 */
export const FALLBACK_THEME: Theme = freezeTheme({
  id: FALLBACK_THEME_ID,
  name: '回退主题',
  builtin: true,
  supportedSizes: PUZZLE_SIZES,
  color: {
    mode: 'layer',
    palette: createFontPalette(18, DEFAULT_BLIND_TILE_COLOR),
    fontPalette: createFontPalette(18, 'auto'),
    blankColor: 'transparent',
  },
  innerBorder: { ...DEFAULT_INNER_BORDER },
  blindTileColor: DEFAULT_BLIND_TILE_COLOR,
  metrics: FALLBACK_METRICS,
});
