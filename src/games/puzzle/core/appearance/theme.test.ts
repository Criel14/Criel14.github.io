import { describe, expect, it } from 'vitest';
import type { ColorMode, Theme } from '../../types';
import {
  cloneTheme,
  getReadableFontColor,
  getTileColor,
  getTileFontColor,
  getTileVisual,
  isValidBlankColor,
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

function createTheme(color: ColorMode): Theme {
  return {
    id: 'test-theme',
    name: '测试主题',
    builtin: false,
    color,
    metrics,
  };
}

const layerTheme = createTheme({
  mode: 'layer',
  palette: layerPalette,
  blankColor: 'transparent',
  fontColor: '#ffffff',
});

const rowTheme = createTheme({
  mode: 'row',
  palette: rowPalette,
  blankColor: 'transparent',
  fontColor: '#ffffff',
});

const fixedTheme = createTheme({
  mode: 'fixed',
  palette: fixedPalette,
  blankColor: 'transparent',
  fontColor: '#ffffff',
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

  it('色板缺项时回退白色背景', () => {
    const shortTheme = createTheme({
      mode: 'layer',
      palette: ['#000000'],
      blankColor: 'transparent',
      fontColor: 'auto',
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
      blankColor: 'transparent',
      fontColor: '#123456',
    });
    expect(getTileFontColor(1, 4, theme)).toBe('#123456');
  });

  it('auto 根据背景亮度选择黑或白', () => {
    const theme = createTheme({
      mode: 'fixed',
      palette: ['#000000', '#ffffff'],
      blankColor: 'transparent',
      fontColor: 'auto',
    });
    expect(getTileFontColor(1, 4, theme)).toBe('#ffffff');
    expect(getTileFontColor(2, 4, theme)).toBe('#000000');
  });

  it('非法固定字体色回退自动对比色', () => {
    const theme = createTheme({
      mode: 'fixed',
      palette: ['#000000'],
      blankColor: 'transparent',
      fontColor: '#fff',
    });
    expect(getTileFontColor(1, 4, theme)).toBe('#ffffff');
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

  it('空白色允许 transparent 或 #rrggbb', () => {
    expect(isValidBlankColor('transparent')).toBe(true);
    expect(isValidBlankColor('#000000')).toBe(true);
    expect(isValidBlankColor('none')).toBe(false);
    expect(isValidBlankColor('#fff')).toBe(false);
  });
});

describe('cloneTheme', () => {
  it('深拷贝 palette 和 metrics', () => {
    const clone = cloneTheme(layerTheme);

    expect(clone).not.toBe(layerTheme);
    expect(clone.color).not.toBe(layerTheme.color);
    expect(clone.color.palette).not.toBe(layerTheme.color.palette);
    expect(clone.metrics).not.toBe(layerTheme.metrics);
    expect(clone).toEqual(layerTheme);
  });

  it('修改克隆不会污染原主题', () => {
    const clone = cloneTheme(layerTheme);
    (clone.color.palette as string[])[0] = '#abcdef';
    const mutableMetrics = clone.metrics as {
      fontSizeRatio: number;
      gapRatio: number;
      radiusRatio: number;
    };
    mutableMetrics.fontSizeRatio = 0.9;

    expect(layerTheme.color.palette[0]).toBe(layerPalette[0]);
    expect(layerTheme.metrics.fontSizeRatio).toBe(0.5);
  });

  it('保留主题模式和内置标记', () => {
    const clone = cloneTheme(fixedTheme);
    expect(clone.color.mode).toBe('fixed');
    expect(clone.builtin).toBe(false);
  });
});
