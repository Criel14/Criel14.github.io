import { describe, expect, it } from 'vitest';
import type { AppearanceState, ColorMode, PuzzleSize, Theme } from '../../types';
import { PUZZLE_SIZES } from '../board';
import {
  applyBrushToTheme,
  changeThemeColorMode,
  getAffectedTiles,
  getColorModePaletteLength,
  isThemeDirty,
  prepareThemeForEditor,
  readBrushFromTheme,
  validateTheme,
} from './editor';
import { cloneTheme } from './theme';
import {
  BUILTIN_THEMES,
  DEFAULT_BLIND_TILE_COLOR,
  FALLBACK_THEME,
  FALLBACK_THEME_ID,
} from './presets';

const LAYER_COLORS = Array.from(
  { length: 18 },
  (_, index) => `#${(index + 16).toString(16).padStart(6, '0')}`,
);
const LAYER_FONTS = Array.from({ length: 18 }, (_, index) =>
  index % 2 === 0 ? '#000000' : '#ffffff',
);

function createTheme(overrides: Partial<Theme> = {}): Theme {
  return {
    ...cloneTheme(FALLBACK_THEME),
    id: 'custom-1',
    name: '我的主题',
    builtin: false,
    color: {
      mode: 'layer',
      palette: [...LAYER_COLORS],
      fontPalette: [...LAYER_FONTS],
      blankColor: 'transparent',
    },
    ...overrides,
  };
}

function createThemeIdBySize(
  overrides: Partial<Record<PuzzleSize, string>> = {},
): Record<PuzzleSize, string> {
  const map = {} as Record<PuzzleSize, string>;
  for (const size of PUZZLE_SIZES) {
    map[size] = overrides[size] ?? 'rainbow';
  }
  return map;
}

function createContext(
  _theme: Theme,
  overrides: Partial<Parameters<typeof validateTheme>[1]> = {},
): Parameters<typeof validateTheme>[1] {
  return {
    existingThemes: BUILTIN_THEMES,
    themeIdBySize: createThemeIdBySize(),
    isNew: false,
    ...overrides,
  };
}

describe('changeThemeColorMode', () => {
  it('模式相同时返回原对象', () => {
    const theme = createTheme();
    expect(changeThemeColorMode(theme, 'layer')).toBe(theme);
  });

  it('降阶切按行时颜色和整盘样式都重置为回退样式', () => {
    const theme = createTheme({
      color: {
        mode: 'layer',
        palette: [...LAYER_COLORS],
        fontPalette: [...LAYER_FONTS],
        blankColor: '#ffffff',
      },
      innerBorder: { color: '#000000', widthRatio: 0.02 },
      blindTileColor: '#ff0000',
      metrics: { fontSizeRatio: 0.8, gapRatio: 0, radiusRatio: 0.3 },
    });
    const next = changeThemeColorMode(theme, 'row');
    const fallbackFont = '#ffffff';

    expect(next.color.mode).toBe('row');
    expect(next.color.palette).toEqual(Array.from({ length: 10 }, () => DEFAULT_BLIND_TILE_COLOR));
    expect(next.color.fontPalette).toEqual(Array.from({ length: 10 }, () => fallbackFont));
    expect(next.color.blankColor).toBe(FALLBACK_THEME.color.blankColor);
    // 盲玩色、内边框和 metrics 也回到回退值，避免旧样式残留。
    expect(next.blindTileColor).toBe(FALLBACK_THEME.blindTileColor);
    expect(next.innerBorder).toEqual(FALLBACK_THEME.innerBorder);
    expect(next.metrics).toEqual(FALLBACK_THEME.metrics);
    // 名称和支持范围不属于样式，保持不变。
    expect(next.name).toBe(theme.name);
    expect(next.supportedSizes).toEqual(theme.supportedSizes);
    // 原主题不被修改。
    expect(theme.color.mode).toBe('layer');
    expect(theme.color.palette).toEqual(LAYER_COLORS);
    expect(theme.metrics.gapRatio).toBe(0);
  });

  it('按行切固定色时重置为 99 项回退样式，不保留旧颜色', () => {
    const theme = createTheme({
      color: {
        mode: 'row',
        palette: LAYER_COLORS.slice(0, 10),
        fontPalette: LAYER_FONTS.slice(0, 10),
        blankColor: '#ffffff',
      },
    });
    const next = changeThemeColorMode(theme, 'fixed');
    const fallbackFont = '#ffffff';

    expect(next.color.mode).toBe('fixed');
    expect(next.color.palette).toHaveLength(99);
    expect(next.color.fontPalette).toHaveLength(99);
    expect(next.color.palette.every((color) => color === DEFAULT_BLIND_TILE_COLOR)).toBe(true);
    expect(next.color.fontPalette.every((color) => color === fallbackFont)).toBe(true);
    expect(next.color.palette[0]).not.toBe(LAYER_COLORS[0]);
    expect(next.color.blankColor).toBe(FALLBACK_THEME.color.blankColor);
  });

  it('固定色切回降阶时重置为 18 项', () => {
    const colors = Array.from(
      { length: 99 },
      (_, index) => `#${(index + 100).toString(16).padStart(6, '0')}`,
    );
    const theme = createTheme({
      color: {
        mode: 'fixed',
        palette: colors,
        fontPalette: Array.from({ length: 99 }, () => '#ffffff'),
        blankColor: 'transparent',
      },
    });
    const next = changeThemeColorMode(theme, 'layer');
    const fallbackFont = '#ffffff';

    expect(next.color.palette).toHaveLength(18);
    expect(next.color.fontPalette).toHaveLength(18);
    expect(next.color.palette.every((color) => color === DEFAULT_BLIND_TILE_COLOR)).toBe(true);
    expect(next.color.fontPalette.every((color) => color === fallbackFont)).toBe(true);
  });

  it('返回深拷贝，不共享 palette / fontPalette', () => {
    const theme = createTheme();
    const next = changeThemeColorMode(theme, 'fixed');

    expect(next).not.toBe(theme);
    expect(next.color).not.toBe(theme.color);
    expect(next.color.palette).not.toBe(theme.color.palette);
    expect(next.color.fontPalette).not.toBe(theme.color.fontPalette);
  });
});

describe('getColorModePaletteLength', () => {
  it('三种模式分别对应 18 / 10 / 99', () => {
    expect(getColorModePaletteLength('layer')).toBe(18);
    expect(getColorModePaletteLength('row')).toBe(10);
    expect(getColorModePaletteLength('fixed')).toBe(99);
  });
});

describe('getAffectedTiles', () => {
  const color: ColorMode = {
    mode: 'layer',
    palette: LAYER_COLORS,
    fontPalette: LAYER_FONTS,
    blankColor: 'transparent',
  };

  it('按层返回同一 L 形层', () => {
    expect(getAffectedTiles(1, 10, color)).toHaveLength(10);
    expect(getAffectedTiles(2, 10, color)).toHaveLength(10);
    expect(getAffectedTiles(12, 10, color)).toHaveLength(9);
  });

  it('按行返回同一行', () => {
    const rowColor: ColorMode = { ...color, mode: 'row', palette: LAYER_COLORS.slice(0, 10) };
    expect(getAffectedTiles(5, 4, rowColor)).toEqual([5, 6, 7, 8]);
    expect(getAffectedTiles(1, 4, rowColor)).toEqual([1, 2, 3, 4]);
  });

  it('固定色只返回该数字', () => {
    const fixedColor: ColorMode = {
      ...color,
      mode: 'fixed',
      palette: Array.from({ length: 99 }, () => DEFAULT_BLIND_TILE_COLOR),
    };
    expect(getAffectedTiles(15, 4, fixedColor)).toEqual([15]);
  });

  it('空白块返回空数组', () => {
    expect(getAffectedTiles(0, 4, color)).toEqual([]);
  });
});

describe('applyBrushToTheme', () => {
  it('按层涂色只改该层的 palette / fontPalette 项', () => {
    const theme = createTheme();
    const next = applyBrushToTheme(theme, 2, 4, {
      background: '#123456',
      fontColor: '#ffffff',
    });

    expect(next).not.toBe(theme);
    expect(next.color.palette[0]).toBe('#123456');
    expect(next.color.fontPalette[0]).toBe('#ffffff');
    expect(next.color.palette[1]).toBe(LAYER_COLORS[1]);
    expect(theme.color.palette[0]).toBe(LAYER_COLORS[0]);
    expect(getAffectedTiles(2, 4, next.color)).toEqual(getAffectedTiles(2, 4, theme.color));
  });

  it('样式刷写入 8 位色并保留 alpha，同时统一小写', () => {
    const theme = createTheme();
    const next = applyBrushToTheme(theme, 1, 4, {
      background: '#12345680',
      fontColor: '#FFFFFF40',
    });

    expect(next.color.palette[0]).toBe('#12345680');
    expect(next.color.fontPalette[0]).toBe('#ffffff40');
    expect(theme.color.palette[0]).toBe(LAYER_COLORS[0]);
  });

  it('大小写不同但颜色相同时仍视为 no-op', () => {
    const theme = createTheme();
    const painted = applyBrushToTheme(theme, 1, 4, {
      background: '#abcdef80',
      fontColor: '#ffffff40',
    });
    const same = applyBrushToTheme(painted, 1, 4, {
      background: '#ABCDEF80',
      fontColor: '#FFFFFF40',
    });

    expect(same).toBe(painted);
  });

  it('按行模式改整行对应的同一个颜色项', () => {
    const theme = createTheme({
      color: {
        mode: 'row',
        palette: LAYER_COLORS.slice(0, 10),
        fontPalette: LAYER_FONTS.slice(0, 10),
        blankColor: 'transparent',
      },
    });
    const next = applyBrushToTheme(theme, 9, 4, {
      background: '#abcdef',
      fontColor: '#ffffff',
    });

    expect(next.color.palette[2]).toBe('#abcdef');
    expect(next.color.fontPalette[2]).toBe('#ffffff');
  });

  it('样式刷与目标组完全相同时返回原对象', () => {
    const theme = createTheme();
    const brush = { background: LAYER_COLORS[0]!, fontColor: '#ffffff' };
    const painted = applyBrushToTheme(theme, 1, 4, brush);
    const same = applyBrushToTheme(painted, 1, 4, brush);
    expect(same).toBe(painted);
  });

  it('空白块和非法颜色不会修改主题', () => {
    const theme = createTheme();
    expect(applyBrushToTheme(theme, 0, 4, { background: '#123456', fontColor: '#ffffff' })).toBe(
      theme,
    );
    expect(applyBrushToTheme(theme, 1, 4, { background: 'red', fontColor: '#ffffff' })).toBe(theme);
    expect(applyBrushToTheme(theme, 1, 4, { background: '#123456', fontColor: 'red' })).toBe(theme);
  });
});

describe('readBrushFromTheme', () => {
  it('读取当前组背景色和字体色', () => {
    const theme = createTheme();
    expect(readBrushFromTheme(theme, 2, 4)).toEqual({
      background: LAYER_COLORS[0],
      fontColor: LAYER_FONTS[0],
    });
  });

  it('读取 8 位背景色和字体色时保留 alpha', () => {
    const theme = createTheme({
      color: {
        mode: 'layer',
        palette: ['#abcdef80', ...LAYER_COLORS.slice(1)],
        fontPalette: ['#ffffff40', ...LAYER_FONTS.slice(1)],
        blankColor: 'transparent',
      },
    });

    expect(readBrushFromTheme(theme, 2, 4)).toEqual({
      background: '#abcdef80',
      fontColor: '#ffffff40',
    });
  });

  it('空白块返回 null', () => {
    expect(readBrushFromTheme(createTheme(), 0, 4)).toBeNull();
  });

  it('非法存储值回退安全默认值', () => {
    const theme = createTheme({
      color: {
        mode: 'layer',
        palette: ['red'],
        fontPalette: ['red'],
        blankColor: 'transparent',
      },
    });
    expect(readBrushFromTheme(theme, 1, 4)).toEqual({
      background: DEFAULT_BLIND_TILE_COLOR,
      fontColor: '#ffffff',
    });
  });
});

describe('prepareThemeForEditor', () => {
  it('把空白色固定为透明，统一小写并回退非法字体色', () => {
    const theme = createTheme({
      color: {
        mode: 'layer',
        palette: [...LAYER_COLORS],
        fontPalette: ['#AABBCC', 'red', ...LAYER_FONTS.slice(2)],
        blankColor: '#ffffff',
      },
    });
    const prepared = prepareThemeForEditor(theme);

    expect(prepared.color.blankColor).toBe('transparent');
    expect(prepared.color.fontPalette[0]).toBe('#aabbcc');
    expect(prepared.color.fontPalette[1]).toBe('#ffffff');
    expect(prepared.color.fontPalette.every((color) => /^#[0-9a-f]{6}$/i.test(color))).toBe(true);
    expect(prepared.color.palette).toEqual(theme.color.palette);
    expect(prepared.color.mode).toBe(theme.color.mode);
  });

  it('保留 8 位色并统一小写，同时继续把空白色固定为透明', () => {
    const theme = createTheme({
      color: {
        mode: 'layer',
        palette: ['#AABBCC80', ...LAYER_COLORS.slice(1)],
        fontPalette: ['#FFFFFF40', ...LAYER_FONTS.slice(1)],
        blankColor: '#12345680',
      },
      innerBorder: { color: '#AABBCC40', widthRatio: 0.02 },
      blindTileColor: '#AABBCC60',
    });
    const prepared = prepareThemeForEditor(theme);

    expect(prepared.color.palette[0]).toBe('#aabbcc80');
    expect(prepared.color.fontPalette[0]).toBe('#ffffff40');
    expect(prepared.color.blankColor).toBe('transparent');
    expect(prepared.innerBorder).toEqual({ color: '#aabbcc40', widthRatio: 0.02 });
    expect(prepared.blindTileColor).toBe('#aabbcc60');
    expect(theme.color.palette[0]).toBe('#AABBCC80');
  });

  it('返回深拷贝，不修改原主题', () => {
    const theme = createTheme({
      color: {
        mode: 'layer',
        palette: [...LAYER_COLORS],
        fontPalette: [...LAYER_FONTS],
        blankColor: '#123456',
      },
    });
    const prepared = prepareThemeForEditor(theme);

    expect(prepared).not.toBe(theme);
    expect(prepared.color).not.toBe(theme.color);
    expect(prepared.color.palette).not.toBe(theme.color.palette);
    expect(theme.color.blankColor).toBe('#123456');
    expect(theme.color.fontPalette[0]).toBe(LAYER_FONTS[0]);
  });
});

describe('isThemeDirty', () => {
  it('名称首尾空格不产生脏状态', () => {
    const theme = createTheme();
    expect(isThemeDirty(theme, { ...theme, name: `  ${theme.name}  ` })).toBe(false);
  });

  it('名称内容、支持阶数或颜色改变会产生脏状态', () => {
    const theme = createTheme();
    expect(isThemeDirty(theme, { ...theme, name: '另一个主题' })).toBe(true);
    expect(isThemeDirty(theme, { ...theme, supportedSizes: [10] })).toBe(true);
    expect(
      isThemeDirty(
        theme,
        applyBrushToTheme(theme, 1, 4, {
          background: '#123456',
          fontColor: '#ffffff',
        }),
      ),
    ).toBe(true);
  });
});

describe('validateTheme', () => {
  it('合法主题没有错误', () => {
    const theme = createTheme();
    expect(validateTheme(theme, createContext(theme))).toEqual([]);
  });

  it('接受带 alpha 的背景色、字体色、空白色、盲玩色和内边框色', () => {
    const theme = createTheme({
      color: {
        mode: 'layer',
        palette: ['#12345680', ...LAYER_COLORS.slice(1)],
        fontPalette: ['#ffffff40', ...LAYER_FONTS.slice(1)],
        blankColor: '#00000000',
      },
      innerBorder: { color: '#FFFFFF40', widthRatio: 0.02 },
      blindTileColor: '#3498db80',
    });

    expect(validateTheme(theme, createContext(theme))).toEqual([]);
  });

  it('空名称和超宽名称返回 name 错误', () => {
    expect(
      validateTheme(createTheme({ name: '   ' }), createContext(createTheme({ name: '   ' }))),
    ).toEqual([{ field: 'name', message: '主题名称不能为空。' }]);
    expect(
      validateTheme(
        createTheme({ name: 'a'.repeat(21) }),
        createContext(createTheme({ name: 'a'.repeat(21) })),
      ).some((issue) => issue.field === 'name'),
    ).toBe(true);
  });

  it('支持阶数不能为空、重复或乱序', () => {
    const empty = createTheme({ supportedSizes: [] });
    expect(validateTheme(empty, createContext(empty))[0]?.field).toBe('supportedSizes');

    const repeated = createTheme({ supportedSizes: [4, 4, 5] });
    expect(
      validateTheme(repeated, createContext(repeated)).some(
        (issue) => issue.field === 'supportedSizes',
      ),
    ).toBe(true);

    const unsorted = createTheme({ supportedSizes: [5, 4] });
    expect(
      validateTheme(unsorted, createContext(unsorted)).some(
        (issue) => issue.field === 'supportedSizes',
      ),
    ).toBe(true);
  });

  it('取消正在使用的阶数会阻止保存', () => {
    const theme = createTheme({ supportedSizes: [10] });
    const issues = validateTheme(
      theme,
      createContext(theme, { themeIdBySize: createThemeIdBySize({ 4: theme.id }) }),
    );
    expect(issues).toContainEqual({
      field: 'usage',
      message: '该主题正在用于 4×4，请先在设置页为这些阶数选择其他主题。',
    });
  });

  it('palette 长度或颜色非法时返回错误', () => {
    const shortPalette = createTheme({
      color: {
        mode: 'layer',
        palette: ['#ffffff'],
        fontPalette: ['#ffffff'],
        blankColor: 'transparent',
      },
    });
    expect(
      validateTheme(shortPalette, createContext(shortPalette)).some(
        (issue) => issue.field === 'palette',
      ),
    ).toBe(true);

    const badColor = createTheme({
      color: {
        mode: 'layer',
        palette: ['red', ...LAYER_COLORS.slice(1)],
        fontPalette: [...LAYER_FONTS],
        blankColor: 'transparent',
      },
    });
    expect(
      validateTheme(badColor, createContext(badColor)).some((issue) => issue.field === 'palette'),
    ).toBe(true);
  });

  it('fontPalette 长度或格式非法时返回错误', () => {
    const theme = createTheme({
      color: {
        mode: 'layer',
        palette: [...LAYER_COLORS],
        fontPalette: ['red'],
        blankColor: 'transparent',
      },
    });
    expect(
      validateTheme(theme, createContext(theme)).some((issue) => issue.field === 'fontPalette'),
    ).toBe(true);
  });

  it('空白色、盲玩色、内边框和 metrics 非法时返回对应错误', () => {
    const blank = createTheme({
      color: {
        mode: 'layer',
        palette: [...LAYER_COLORS],
        fontPalette: [...LAYER_FONTS],
        blankColor: 'white',
      },
    });
    expect(
      validateTheme(blank, createContext(blank)).some((issue) => issue.field === 'blankColor'),
    ).toBe(true);

    const blind = createTheme({ blindTileColor: 'red' });
    expect(
      validateTheme(blind, createContext(blind)).some((issue) => issue.field === 'blindTileColor'),
    ).toBe(true);

    const border = createTheme({ innerBorder: { color: 'transparent', widthRatio: 0.2 } });
    expect(
      validateTheme(border, createContext(border)).some((issue) => issue.field === 'innerBorder'),
    ).toBe(true);

    const metrics = createTheme({
      metrics: { fontSizeRatio: 2, gapRatio: 0.06, radiusRatio: 0 },
    });
    expect(
      validateTheme(metrics, createContext(metrics)).some((issue) => issue.field === 'metrics'),
    ).toBe(true);
  });

  it('保留 ID、内置主题和重复新 ID 会被拒绝', () => {
    const fallback = createTheme({ id: FALLBACK_THEME_ID });
    expect(
      validateTheme(fallback, createContext(fallback)).some((issue) => issue.field === 'id'),
    ).toBe(true);

    const builtin = createTheme({ builtin: true });
    expect(
      validateTheme(builtin, createContext(builtin)).some((issue) => issue.field === 'id'),
    ).toBe(true);

    const duplicate = createTheme();
    expect(
      validateTheme(
        duplicate,
        createContext(duplicate, {
          existingThemes: [...BUILTIN_THEMES, duplicate],
          isNew: true,
        }),
      ).some((issue) => issue.field === 'id'),
    ).toBe(true);
  });

  it('新建时超过 20 个自定义主题返回 limit 错误', () => {
    const custom = createTheme();
    const existingThemes = [
      ...BUILTIN_THEMES,
      ...Array.from({ length: 20 }, (_, index) => ({ ...custom, id: `custom-${index}` })),
    ];
    const issues = validateTheme(custom, createContext(custom, { existingThemes, isNew: true }));
    expect(issues.some((issue) => issue.field === 'limit')).toBe(true);
  });
});

describe('validateTheme context', () => {
  it('只按当前分配判断正在使用的阶数，不依赖主题支持范围', () => {
    const theme = createTheme({ supportedSizes: [2, 3, 4, 5, 6, 7, 8, 9, 10] });
    const appearance: AppearanceState = {
      themeIdBySize: createThemeIdBySize({ 10: theme.id }),
      themes: [...BUILTIN_THEMES, theme],
    };
    const issues = validateTheme(theme, {
      existingThemes: appearance.themes,
      themeIdBySize: appearance.themeIdBySize,
      isNew: false,
    });
    expect(issues).toEqual([]);
  });
});
