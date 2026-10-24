import { describe, expect, it } from 'vitest';
import type { Theme } from '../../types';
import { PUZZLE_SIZES } from '../board';
import { DEFAULT_METRICS } from './presets';
import { clampRatio, normalizeInnerBorder, normalizeMetrics, toCssVariables } from './metrics';

const theme: Theme = {
  id: 'test',
  name: '测试',
  builtin: false,
  supportedSizes: PUZZLE_SIZES,
  color: {
    mode: 'layer',
    palette: ['#ffffff'],
    fontPalette: ['auto'],
    blankColor: 'transparent',
  },
  innerBorder: { color: 'transparent', widthRatio: 0 },
  blindTileColor: '#3498db',
  metrics: {
    fontSizeRatio: 0.5,
    gapRatio: 0.03,
    radiusRatio: 0.04,
  },
};

describe('clampRatio', () => {
  it('把数值夹取到范围内', () => {
    expect(clampRatio(-1, 0, 1)).toBe(0);
    expect(clampRatio(0, 0, 1)).toBe(0);
    expect(clampRatio(0.5, 0, 1)).toBe(0.5);
    expect(clampRatio(1, 0, 1)).toBe(1);
    expect(clampRatio(2, 0, 1)).toBe(1);
  });
});

describe('normalizeMetrics', () => {
  it('保留合法值', () => {
    expect(normalizeMetrics(theme.metrics)).toEqual(theme.metrics);
  });

  it('有限但越界的值夹取到边界', () => {
    expect(
      normalizeMetrics({
        fontSizeRatio: 2,
        gapRatio: -1,
        radiusRatio: 1,
      }),
    ).toEqual({
      fontSizeRatio: 1,
      gapRatio: 0,
      radiusRatio: 0.5,
    });
  });

  it('NaN、Infinity、字符串和缺失字段回退默认值', () => {
    expect(
      normalizeMetrics({
        fontSizeRatio: Number.NaN,
        gapRatio: Number.POSITIVE_INFINITY,
        radiusRatio: '0.2',
      }),
    ).toEqual(DEFAULT_METRICS);

    expect(normalizeMetrics(null)).toEqual(DEFAULT_METRICS);
    expect(normalizeMetrics('invalid')).toEqual(DEFAULT_METRICS);
    expect(normalizeMetrics(undefined)).toEqual(DEFAULT_METRICS);
  });
});

describe('normalizeInnerBorder', () => {
  it('保留合法颜色和宽度', () => {
    expect(normalizeInnerBorder({ color: '#ffffff', widthRatio: 0.02 })).toEqual({
      color: '#ffffff',
      widthRatio: 0.02,
    });
    expect(normalizeInnerBorder({ color: 'transparent', widthRatio: 0 })).toEqual({
      color: 'transparent',
      widthRatio: 0,
    });
  });

  it('颜色非法回退透明，宽度非有限数回退 0', () => {
    expect(normalizeInnerBorder({ color: 'red', widthRatio: 0.02 })).toEqual({
      color: 'transparent',
      widthRatio: 0.02,
    });
    expect(normalizeInnerBorder({ color: '#ffffff', widthRatio: Number.NaN })).toEqual({
      color: '#ffffff',
      widthRatio: 0,
    });
    expect(normalizeInnerBorder(undefined)).toEqual({ color: 'transparent', widthRatio: 0 });
    expect(normalizeInnerBorder(null)).toEqual({ color: 'transparent', widthRatio: 0 });
  });

  it('宽度越界夹取到 0–0.1', () => {
    expect(normalizeInnerBorder({ color: '#ffffff', widthRatio: 0.5 })).toEqual({
      color: '#ffffff',
      widthRatio: 0.1,
    });
    expect(normalizeInnerBorder({ color: '#ffffff', widthRatio: -1 })).toEqual({
      color: '#ffffff',
      widthRatio: 0,
    });
  });
});

describe('toCssVariables', () => {
  it('生成空白色、盲玩色、内边框和三个比例变量', () => {
    expect(toCssVariables(theme)).toEqual({
      '--blank-color': 'transparent',
      '--blind-tile-bg': '#3498db',
      '--tile-inner-border-color': 'transparent',
      '--tile-inner-border-width-ratio': '0',
      '--tile-font-ratio': '0.5',
      '--tile-gap-ratio': '0.03',
      '--tile-radius-ratio': '0.04',
    });
  });

  it('使用主题自己的内边框和 metrics，非法值先归一化', () => {
    const invalidTheme: Theme = {
      ...theme,
      innerBorder: { color: 'red', widthRatio: 0.5 },
      metrics: {
        fontSizeRatio: 2,
        gapRatio: -1,
        radiusRatio: Number.NaN,
      },
    };

    expect(toCssVariables(invalidTheme)).toEqual({
      '--blank-color': 'transparent',
      '--blind-tile-bg': '#3498db',
      '--tile-inner-border-color': 'transparent',
      '--tile-inner-border-width-ratio': '0.1',
      '--tile-font-ratio': '1',
      '--tile-gap-ratio': '0',
      '--tile-radius-ratio': String(DEFAULT_METRICS.radiusRatio),
    });
  });

  it('不生成由 board-view 计算的 --cell-size', () => {
    expect(toCssVariables(theme)).not.toHaveProperty('--cell-size');
  });

  it('非法空白色回退 transparent', () => {
    const invalidBlank: Theme = {
      ...theme,
      color: { ...theme.color, blankColor: '#fff' },
    };
    expect(toCssVariables(invalidBlank)['--blank-color']).toBe('transparent');
  });

  it('非法盲玩色回退主题蓝', () => {
    const invalidBlind: Theme = {
      ...theme,
      blindTileColor: 'red',
    };
    expect(toCssVariables(invalidBlind)['--blind-tile-bg']).toBe('#3498db');
  });
});
