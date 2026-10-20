import { describe, expect, it } from 'vitest';
import {
  BUILTIN_THEMES,
  DEFAULT_BLIND_TILE_COLOR,
  DEFAULT_METRICS,
  DEFAULT_THEME_ID,
} from './presets';

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

const expectedRainbowColors = [
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

const expectedSoftColors = [
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

describe('BUILTIN_THEMES', () => {
  it('只包含两套降阶内置主题', () => {
    expect(BUILTIN_THEMES).toHaveLength(2);
    expect(BUILTIN_THEMES.map((theme) => theme.id)).toEqual(['rainbow', 'rainbow-soft']);
    expect(BUILTIN_THEMES.map((theme) => theme.name)).toEqual(['彩虹', '彩虹微调']);
    expect(BUILTIN_THEMES.every((theme) => theme.builtin)).toBe(true);
    expect(BUILTIN_THEMES.every((theme) => theme.color.mode === 'layer')).toBe(true);
  });

  it('完整保留旧预设1 的 18 层颜色', () => {
    const theme = BUILTIN_THEMES[0];
    expect(theme.color.palette).toEqual(expectedRainbowColors);
    expect(theme.color.palette).toHaveLength(18);
  });

  it('完整保留旧预设2 的 18 层颜色', () => {
    const theme = BUILTIN_THEMES[1];
    expect(theme.color.palette).toEqual(expectedSoftColors);
    expect(theme.color.palette).toHaveLength(18);
  });

  it('所有颜色都是合法 #rrggbb，空白和字体色符合约定', () => {
    for (const theme of BUILTIN_THEMES) {
      for (const color of theme.color.palette) {
        expect(color).toMatch(HEX_COLOR_PATTERN);
      }
      expect(theme.color.blankColor).toBe('transparent');
      expect(theme.color.fontColor).toBe('#ffffff');
    }
  });

  it('两套内置主题的盲玩色都沿用旧版蓝色', () => {
    for (const theme of BUILTIN_THEMES) {
      expect(theme.blindTileColor).toBe('#66ccff');
    }
    expect(DEFAULT_BLIND_TILE_COLOR).toBe('#66ccff');
  });

  it('保留旧预设的尺寸比例', () => {
    expect(BUILTIN_THEMES[0].metrics).toEqual({
      fontSizeRatio: 0.5,
      gapRatio: 0.03,
      radiusRatio: 0.04,
    });
    expect(BUILTIN_THEMES[1].metrics).toEqual({
      fontSizeRatio: 0.5,
      gapRatio: 0,
      radiusRatio: 0.01,
    });
  });

  it('默认主题和默认比例指向旧预设1', () => {
    expect(DEFAULT_THEME_ID).toBe('rainbow');
    expect(DEFAULT_METRICS).toBe(BUILTIN_THEMES[0].metrics);
  });

  it('常量和内部数组都被冻结', () => {
    expect(Object.isFrozen(BUILTIN_THEMES)).toBe(true);
    expect(Object.isFrozen(DEFAULT_METRICS)).toBe(true);

    for (const theme of BUILTIN_THEMES) {
      expect(Object.isFrozen(theme)).toBe(true);
      expect(Object.isFrozen(theme.color)).toBe(true);
      expect(Object.isFrozen(theme.color.palette)).toBe(true);
      expect(Object.isFrozen(theme.metrics)).toBe(true);
    }
  });
});
