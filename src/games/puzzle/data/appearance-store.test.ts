import { describe, expect, it } from 'vitest';
import type { AppearanceState, PuzzleSize, Theme } from '../types';
import { createDefaultAppearance, createFallbackAppearance } from '../core/appearance/appearance';
import { FALLBACK_THEME_ID } from '../core/appearance/presets';
import { PUZZLE_SIZES } from '../core/board';
import { DataStoreError } from './errors';
import { createMemoryStorage, readJsonResult, writeJson } from './local-storage';
import { loadAppearanceResult, normalizeAppearance, saveAppearance } from './appearance-store';
import { APPEARANCE_SCHEMA_VERSION, STORAGE_KEYS } from './schema';

function createCustomTheme(id = 'custom-1', name = '自定义主题'): Theme {
  const base = createDefaultAppearance().themes[0];
  return {
    ...base,
    id,
    name,
    builtin: false,
    metrics: {
      fontSizeRatio: 0.6,
      gapRatio: 0.02,
      radiusRatio: 0.05,
    },
  };
}

function createThemeIdBySize(
  overrides: Partial<Record<PuzzleSize, string>> = {},
): AppearanceState['themeIdBySize'] {
  const map = {} as Record<PuzzleSize, string>;
  for (const size of PUZZLE_SIZES) {
    map[size] = overrides[size] ?? 'rainbow';
  }
  return map;
}

describe('saveAppearance / loadAppearanceResult', () => {
  it('保存并读取自定义主题与按阶数分配', () => {
    const storage = createMemoryStorage();
    const custom = createCustomTheme();
    const appearance: AppearanceState = {
      themeIdBySize: createThemeIdBySize({ 10: custom.id }),
      themes: [...createDefaultAppearance().themes, custom],
    };

    saveAppearance(appearance, storage);

    const result = loadAppearanceResult(storage);
    const loaded = result.appearance;
    expect(result.status).toBe('ok');
    expect(loaded.themeIdBySize[10]).toBe(custom.id);
    expect(loaded.themeIdBySize[9]).toBe('rainbow');
    expect(loaded.themes.map((theme) => theme.id)).toEqual(['rainbow', 'rainbow-soft', custom.id]);
    expect(loaded.themes[2]).toEqual(custom);
    expect(readJsonResult(storage, STORAGE_KEYS.appearance)).toEqual({
      status: 'ok',
      value: {
        version: APPEARANCE_SCHEMA_VERSION,
        data: loaded,
      },
    });
  });

  it('保存并读取带 alpha 的自定义主题', () => {
    const storage = createMemoryStorage();
    const base = createCustomTheme();
    const custom: Theme = {
      ...base,
      color: {
        ...base.color,
        palette: base.color.palette.map((color, index) => (index === 0 ? '#12345680' : color)),
        fontPalette: base.color.fontPalette.map((color, index) =>
          index === 0 ? '#ffffff40' : color,
        ),
      },
      innerBorder: { color: '#ffffff40', widthRatio: 0.02 },
      blindTileColor: '#3498db80',
    };
    const appearance: AppearanceState = {
      themeIdBySize: createThemeIdBySize({ 10: custom.id }),
      themes: [...createDefaultAppearance().themes, custom],
    };

    saveAppearance(appearance, storage);

    const result = loadAppearanceResult(storage);
    expect(result.status).toBe('ok');
    expect(result.appearance.themes[2]).toEqual(custom);
  });

  it('保存前归一化字体色和内边框', () => {
    const storage = createMemoryStorage();
    const custom = createCustomTheme();
    const appearance: AppearanceState = {
      themeIdBySize: createThemeIdBySize({ 10: custom.id }),
      themes: [
        ...createDefaultAppearance().themes,
        {
          ...custom,
          color: { ...custom.color, fontPalette: ['broken'] },
          innerBorder: { color: 'red', widthRatio: 1 },
        },
      ],
    };

    saveAppearance(appearance, storage);

    const stored = readJsonResult(storage, STORAGE_KEYS.appearance);
    expect(stored.status).toBe('ok');
    if (!('value' in stored)) {
      throw new Error('保存后应能读取外观数据');
    }
    const storedValue = stored.value as { version: number; data: unknown };
    expect(storedValue.version).toBe(APPEARANCE_SCHEMA_VERSION);
    const data = storedValue.data as AppearanceState;
    expect(data.themes[2].color.fontPalette).toEqual(Array(18).fill('#ffffff'));
    expect(data.themes[2].color).not.toHaveProperty('blankColor');
    expect(data.themes[2].innerBorder).toEqual({ color: 'transparent', widthRatio: 0.2 });
  });

  it('内置主题始终使用当前代码的 canonical 版本', () => {
    const storage = createMemoryStorage();
    const defaults = createDefaultAppearance();
    const tamperedBuiltin: Theme = {
      ...defaults.themes[0],
      name: '被篡改的内置主题',
    };
    writeJson(storage, STORAGE_KEYS.appearance, {
      version: APPEARANCE_SCHEMA_VERSION,
      data: {
        themeIdBySize: createThemeIdBySize(),
        themes: [tamperedBuiltin, defaults.themes[1]],
      },
    });

    expect(loadAppearanceResult(storage)).toEqual({
      status: 'ok',
      appearance: createDefaultAppearance(),
    });
  });

  it('缺失使用默认外观，损坏 JSON 或版本不匹配使用回退外观', () => {
    const storage = createMemoryStorage();
    expect(loadAppearanceResult(storage)).toEqual({
      status: 'missing',
      appearance: createDefaultAppearance(),
    });

    storage.set(STORAGE_KEYS.appearance, 'not-json');
    expect(loadAppearanceResult(storage)).toEqual({
      status: 'corrupt',
      appearance: createFallbackAppearance(),
      issue: 'invalid-json',
    });

    writeJson(storage, STORAGE_KEYS.appearance, {
      version: 3,
      data: { activeThemeId: 'rainbow', themes: [] },
    });
    expect(loadAppearanceResult(storage)).toEqual({
      status: 'corrupt',
      appearance: createFallbackAppearance(),
      issue: 'legacy-version',
    });

    writeJson(storage, STORAGE_KEYS.appearance, {
      version: APPEARANCE_SCHEMA_VERSION + 1,
      data: { themeIdBySize: createThemeIdBySize(), themes: [] },
    });
    expect(loadAppearanceResult(storage)).toEqual({
      status: 'corrupt',
      appearance: createFallbackAppearance(),
      issue: 'unknown-version',
    });
  });

  it('区分非法 envelope 与可归一化的 invalid-data', () => {
    const storage = createMemoryStorage();
    writeJson(storage, STORAGE_KEYS.appearance, 'not-an-envelope');
    expect(loadAppearanceResult(storage)).toEqual({
      status: 'corrupt',
      appearance: createFallbackAppearance(),
      issue: 'invalid-envelope',
    });

    writeJson(storage, STORAGE_KEYS.appearance, {
      version: APPEARANCE_SCHEMA_VERSION,
      data: 'not-an-appearance',
    });
    expect(loadAppearanceResult(storage)).toEqual({
      status: 'corrupt',
      appearance: createFallbackAppearance(),
      issue: 'invalid-data',
    });
  });

  it('v4 字段损坏时尽量恢复，非法阶数使用回退主题', () => {
    const storage = createMemoryStorage();
    const custom = createCustomTheme();
    writeJson(storage, STORAGE_KEYS.appearance, {
      version: APPEARANCE_SCHEMA_VERSION,
      data: {
        themeIdBySize: createThemeIdBySize({ 10: custom.id }),
        themes: [
          {
            ...custom,
            color: { ...custom.color, fontPalette: ['broken'] },
          },
        ],
      },
    });

    const result = loadAppearanceResult(storage);
    expect(result.status).toBe('corrupt');
    expect(result.issue).toBe('invalid-data');
    expect(result.appearance.themes.map((theme) => theme.id)).toEqual([
      'rainbow',
      'rainbow-soft',
      custom.id,
    ]);
    expect(result.appearance.themeIdBySize[10]).toBe(custom.id);
    expect(result.appearance.themes[2].color.fontPalette).toEqual(Array(18).fill('#ffffff'));
  });

  it('localStorage 读取不可用时使用回退外观', () => {
    const storage = {
      get: () => {
        throw new DataStoreError('unavailable', '不可用');
      },
      set: () => undefined,
      remove: () => undefined,
      keys: () => [],
    };

    expect(loadAppearanceResult(storage)).toEqual({
      status: 'unavailable',
      appearance: createFallbackAppearance(),
    });
  });
});

describe('normalizeAppearance', () => {
  it('忽略旧数据里的 blankColor 字段', () => {
    const custom = createCustomTheme();
    const appearance = normalizeAppearance({
      themeIdBySize: createThemeIdBySize({ 10: custom.id }),
      themes: [
        {
          ...custom,
          color: { ...custom.color, blankColor: '#ffffff' },
        },
      ],
    });

    expect(appearance.themes[2]?.color).not.toHaveProperty('blankColor');
  });

  it('修复可恢复的字体色、内边框、盲玩色和 metrics', () => {
    const custom = createCustomTheme();
    const appearance = normalizeAppearance({
      themeIdBySize: createThemeIdBySize({ 10: custom.id }),
      themes: [
        {
          ...custom,
          color: {
            ...custom.color,
            fontPalette: ['not-a-font-color'],
          },
          innerBorder: {
            color: 'not-a-color',
            widthRatio: 2,
          },
          blindTileColor: 'not-a-color',
          metrics: {
            fontSizeRatio: 2,
            gapRatio: -1,
            radiusRatio: 9,
          },
        },
      ],
    });

    expect(appearance.themes[2]).toMatchObject({
      id: custom.id,
      color: {
        fontPalette: Array(18).fill('#ffffff'),
      },
      innerBorder: {
        color: 'transparent',
        widthRatio: 0.2,
      },
      blindTileColor: '#3498db',
      metrics: {
        fontSizeRatio: 1,
        gapRatio: 0,
        radiusRatio: 0.5,
      },
    });
  });

  it('丢弃非法 supportedSizes、palette、内置/回退 ID 和重复 ID', () => {
    const custom = createCustomTheme();
    const invalidSizes = {
      ...custom,
      id: 'custom-bad-size',
      supportedSizes: [],
    };
    const missingSizes = {
      ...custom,
      id: 'custom-missing-size',
      supportedSizes: undefined,
    };
    const invalidPalette = {
      ...custom,
      id: 'custom-bad-palette',
      color: {
        ...custom.color,
        palette: custom.color.palette.slice(0, 17),
      },
    };
    const appearance = normalizeAppearance({
      themeIdBySize: createThemeIdBySize({ 10: custom.id }),
      themes: [
        invalidSizes,
        missingSizes,
        invalidPalette,
        custom,
        custom,
        { ...custom, id: 'rainbow' },
        { ...custom, id: FALLBACK_THEME_ID },
      ],
    });

    expect(appearance.themes.map((theme) => theme.id)).toEqual([
      'rainbow',
      'rainbow-soft',
      custom.id,
    ]);
  });

  it('themeIdBySize 未知、缺键或主题不支持时使用回退主题', () => {
    const custom = createCustomTheme('custom-10', '只用于 10×10');
    const limited = { ...custom, supportedSizes: [10] as const };
    const map = createThemeIdBySize({
      9: limited.id,
      10: 'missing',
    }) as Record<number, string>;
    delete map[3];

    const appearance = normalizeAppearance({
      themeIdBySize: map,
      themes: [limited],
    });

    expect(appearance.themeIdBySize[3]).toBe(FALLBACK_THEME_ID);
    expect(appearance.themeIdBySize[9]).toBe(FALLBACK_THEME_ID);
    expect(appearance.themeIdBySize[10]).toBe(FALLBACK_THEME_ID);
    expect(appearance.themeIdBySize[4]).toBe('rainbow');
  });

  it('保留合法分配，并把不支持该阶数的分配落到回退主题', () => {
    const custom = createCustomTheme('custom-10', '只用于 10×10');
    const limited = { ...custom, supportedSizes: [10] as const };
    const appearance = normalizeAppearance({
      themeIdBySize: createThemeIdBySize({ 10: limited.id }),
      themes: [limited],
    });

    expect(appearance.themeIdBySize[10]).toBe(limited.id);
    expect(appearance.themeIdBySize[9]).toBe('rainbow');
  });

  it('最多保留 20 个自定义主题', () => {
    const themes = Array.from({ length: 21 }, (_, index) =>
      createCustomTheme(`custom-${index + 1}`, `自定义 ${index + 1}`),
    );
    const appearance = normalizeAppearance({
      themeIdBySize: createThemeIdBySize({ 10: 'missing' }),
      themes,
    });

    expect(appearance.themes).toHaveLength(22);
    expect(appearance.themes.map((theme) => theme.id)).toEqual([
      'rainbow',
      'rainbow-soft',
      ...Array.from({ length: 20 }, (_, index) => `custom-${index + 1}`),
    ]);
    expect(appearance.themeIdBySize[10]).toBe(FALLBACK_THEME_ID);
  });
});
