import { describe, expect, it } from 'vitest';
import type { Theme } from '../../types';
import { DEFAULT_METRICS } from './presets';
import { clampRatio, normalizeMetrics, toCssVariables } from './metrics';

const theme: Theme = {
  id: 'test',
  name: '测试',
  builtin: false,
  color: {
    mode: 'layer',
    palette: ['#ffffff'],
    blankColor: 'transparent',
    fontColor: '#ffffff',
  },
  blindTileColor: '#66ccff',
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

describe('toCssVariables', () => {
  it('生成空白色、盲玩色和三个比例变量', () => {
    expect(toCssVariables(theme)).toEqual({
      '--blank-color': 'transparent',
      '--blind-tile-bg': '#66ccff',
      '--tile-font-ratio': '0.5',
      '--tile-gap-ratio': '0.03',
      '--tile-radius-ratio': '0.04',
    });
  });

  it('使用主题自己的 metrics，非法值先归一化', () => {
    const invalidTheme: Theme = {
      ...theme,
      metrics: {
        fontSizeRatio: 2,
        gapRatio: -1,
        radiusRatio: Number.NaN,
      },
    };

    expect(toCssVariables(invalidTheme)).toEqual({
      '--blank-color': 'transparent',
      '--blind-tile-bg': '#66ccff',
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

  it('非法盲玩色回退旧版蓝色', () => {
    const invalidBlind: Theme = {
      ...theme,
      blindTileColor: 'red',
    };
    expect(toCssVariables(invalidBlind)['--blind-tile-bg']).toBe('#66ccff');
  });
});
