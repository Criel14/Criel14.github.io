import { describe, expect, it } from 'vitest';
import type { ColorMode, Theme } from '../../types';
import { PUZZLE_SIZES } from '../board';
import {
  cloneTheme,
  getReadableFontColor,
  getTileColor,
  getTileFontColor,
  getTileVisual,
  isValidBlankColor,
  isValidFontColor,
  isValidHexColor,
} from './theme';

const metrics = {
  fontSizeRatio: 0.5,
  gapRatio: 0.03,
  radiusRatio: 0.04,
};

const layerPalette = Array.from(
  { length: 18 },
  (_, index) => `#0000${index.toString(16).padStart(2, '0')}`,
);
const rowPalette = Array.from(
  { length: 10 },
  (_, index) => `#1000${index.toString(16).padStart(2, '0')}`,
);
const fixedPalette = Array.from(
  { length: 99 },
  (_, index) => `#2000${index.toString(16).padStart(2, '0')}`,
);

function createFontPalette(length: number, color = 'auto'): string[] {
  return Array.from({ length }, () => color);
}

function createTheme(color: ColorMode): Theme {
  return {
    id: 'test-theme',
    name: '测试主题',
    builtin: false,
    supportedSizes: PUZZLE_SIZES,
    color,
    innerBorder: { color: 'transparent', widthRatio: 0 },
    blindTileColor: '#3498db',
    metrics,
  };
}

const layerTheme = createTheme({
  mode: 'layer',
  palette: layerPalette,
  fontPalette: createFontPalette(18, '#ffffff'),
  blankColor: 'transparent',
});

const rowTheme = createTheme({
  mode: 'row',
  palette: rowPalette,
  fontPalette: createFontPalette(10, '#ffffff'),
  blankColor: 'transparent',
});

const fixedTheme = createTheme({
  mode: 'fixed',
  palette: fixedPalette,
  fontPalette: createFontPalette(99, '#ffffff'),
  blankColor: 'transparent',
});

describe('getTileVisual', () => {
  it('降阶模式按层取色', () => {
    expect(getTileVisual(1, 4, layerTheme).background).toBe(layerPalette[0]);
    expect(getTileVisual(5, 4, layerTheme).background).toBe(layerPalette[1]);
    expect(getTileVisual(15, 4, layerTheme).background).toBe(layerPalette[5]);
  });

  it('按行模式按数字块原本所属行取色', () => {
    expect(getTileVisual(1, 4, rowTheme).background).toBe(rowPalette[0]);
    expect(getTileVisual(5, 4, rowTheme).background).toBe(rowPalette[1]);
    expect(getTileVisual(15, 4, rowTheme).background).toBe(rowPalette[3]);
  });

  it('固定色模式按数字取色，与阶数无关', () => {
    expect(getTileVisual(15, 4, fixedTheme).background).toBe(fixedPalette[14]);
    expect(getTileVisual(15, 10, fixedTheme).background).toBe(fixedPalette[14]);
    expect(getTileVisual(3, 2, fixedTheme).background).toBe(fixedPalette[2]);
  });

  it('空白块和非法方块使用空白色与透明字体', () => {
    expect(getTileVisual(0, 4, layerTheme)).toEqual({
      background: 'transparent',
      color: 'transparent',
    });
    expect(getTileVisual(-1, 4, layerTheme)).toEqual({
      background: 'transparent',
      color: 'transparent',
    });
    expect(getTileVisual(16, 4, layerTheme)).toEqual({
      background: 'transparent',
      color: 'transparent',
    });
  });

  it('色板缺项时回退白色背景，字体色按背景自动计算', () => {
    const shortTheme = createTheme({
      mode: 'layer',
      palette: ['#000000'],
      fontPalette: ['auto'],
      blankColor: 'transparent',
    });
    expect(getTileVisual(5, 4, shortTheme)).toEqual({
      background: '#ffffff',
      color: '#000000',
    });
  });
});

describe('getTileColor', () => {
  it('正常方块返回调色板颜色，空白块返回空白色', () => {
    expect(getTileColor(5, 4, layerTheme)).toBe(layerPalette[1]);
    expect(getTileColor(0, 4, layerTheme)).toBe('transparent');
  });
});

describe('字体色', () => {
  it('固定字体色直接使用配置值', () => {
    const theme = createTheme({
      mode: 'fixed',
      palette: ['#000000'],
      fontPalette: ['#123456'],
      blankColor: 'transparent',
    });
    expect(getTileFontColor(1, 4, theme)).toBe('#123456');
  });

  it('auto 根据背景亮度选择黑或白', () => {
    const theme = createTheme({
      mode: 'fixed',
      palette: ['#000000', '#ffffff'],
      fontPalette: ['auto', 'auto'],
      blankColor: 'transparent',
    });
    expect(getTileFontColor(1, 4, theme)).toBe('#ffffff');
    expect(getTileFontColor(2, 4, theme)).toBe('#000000');
  });

  it('逐块字体色按层索引分别生效', () => {
    const fontPalette = createFontPalette(18);
    fontPalette[1] = '#123456';
    const theme = createTheme({
      mode: 'layer',
      palette: layerPalette,
      fontPalette,
      blankColor: 'transparent',
    });

    expect(getTileFontColor(5, 4, theme)).toBe('#123456');
    expect(getTileFontColor(1, 4, theme)).toBe(getReadableFontColor(layerPalette[0]!));
  });

  it('非法固定字体色回退自动对比色', () => {
    const theme = createTheme({
      mode: 'fixed',
      palette: ['#000000'],
      fontPalette: ['#fff'],
      blankColor: 'transparent',
    });
    expect(getTileFontColor(1, 4, theme)).toBe('#ffffff');
  });

  it('字体色缺失时回退 auto', () => {
    const theme = createTheme({
      mode: 'layer',
      palette: layerPalette,
      fontPalette: [],
      blankColor: 'transparent',
    });
    expect(getTileFontColor(5, 4, theme)).toBe(getReadableFontColor(layerPalette[1]!));
  });

  it('空白块字体为透明', () => {
    expect(getTileFontColor(0, 4, layerTheme)).toBe('transparent');
  });
});

describe('getReadableFontColor', () => {
  it('深色背景使用白色字体，浅色背景使用黑色字体', () => {
    expect(getReadableFontColor('#000000')).toBe('#ffffff');
    expect(getReadableFontColor('#ffffff')).toBe('#000000');
    expect(getReadableFontColor('#6810fa')).toBe('#ffffff');
    expect(getReadableFontColor('#f1c40f')).toBe('#000000');
  });

  it('非法背景回退白色字体', () => {
    expect(getReadableFontColor('transparent')).toBe('#ffffff');
    expect(getReadableFontColor('#fff')).toBe('#ffffff');
  });
});

describe('颜色校验', () => {
  it('只接受严格的 #rrggbb', () => {
    expect(isValidHexColor('#ffffff')).toBe(true);
    expect(isValidHexColor('#ABCDEF')).toBe(true);
    expect(isValidHexColor('#fff')).toBe(false);
    expect(isValidHexColor('ffffff')).toBe(false);
    expect(isValidHexColor('#gggggg')).toBe(false);
    expect(isValidHexColor('transparent')).toBe(false);
  });

  it('空白色和内边框颜色允许 transparent 或 #rrggbb', () => {
    expect(isValidBlankColor('transparent')).toBe(true);
    expect(isValidBlankColor('#000000')).toBe(true);
    expect(isValidBlankColor('none')).toBe(false);
    expect(isValidBlankColor('#fff')).toBe(false);
  });

  it('字体色允许 auto 或 #rrggbb', () => {
    expect(isValidFontColor('auto')).toBe(true);
    expect(isValidFontColor('#abcdef')).toBe(true);
    expect(isValidFontColor('transparent')).toBe(false);
    expect(isValidFontColor('#fff')).toBe(false);
  });
});

describe('cloneTheme', () => {
  it('深拷贝 supportedSizes、palette、fontPalette、内边框和 metrics', () => {
    const clone = cloneTheme(layerTheme);

    expect(clone).not.toBe(layerTheme);
    expect(clone.supportedSizes).not.toBe(layerTheme.supportedSizes);
    expect(clone.color).not.toBe(layerTheme.color);
    expect(clone.color.palette).not.toBe(layerTheme.color.palette);
    expect(clone.color.fontPalette).not.toBe(layerTheme.color.fontPalette);
    expect(clone.innerBorder).not.toBe(layerTheme.innerBorder);
    expect(clone.metrics).not.toBe(layerTheme.metrics);
    expect(clone.blindTileColor).toBe(layerTheme.blindTileColor);
    expect(clone).toEqual(layerTheme);
  });

  it('修改克隆不会污染原主题', () => {
    const clone = cloneTheme(layerTheme);
    (clone.supportedSizes as number[])[0] = 10;
    (clone.color.palette as string[])[0] = '#abcdef';
    (clone.color.fontPalette as string[])[0] = '#000000';
    (clone.innerBorder as { color: string; widthRatio: number }).widthRatio = 0.1;
    const mutableMetrics = clone.metrics as {
      fontSizeRatio: number;
      gapRatio: number;
      radiusRatio: number;
    };
    mutableMetrics.fontSizeRatio = 0.9;

    expect(layerTheme.supportedSizes[0]).toBe(2);
    expect(layerTheme.color.palette[0]).toBe(layerPalette[0]);
    expect(layerTheme.color.fontPalette[0]).toBe('#ffffff');
    expect(layerTheme.innerBorder.widthRatio).toBe(0);
    expect(layerTheme.metrics.fontSizeRatio).toBe(0.5);
  });

  it('保留主题模式和内置标记', () => {
    const clone = cloneTheme(fixedTheme);
    expect(clone.color.mode).toBe('fixed');
    expect(clone.builtin).toBe(false);
  });
});
