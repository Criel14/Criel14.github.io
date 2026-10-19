import { describe, expect, it } from 'vitest';
import type { AppearanceState, Theme } from '../types';
import { createDefaultAppearance } from '../core/appearance/appearance';
import { DataStoreError } from './errors';
import { createMemoryStorage, readJson, writeJson } from './local-storage';
import { loadAppearance, normalizeAppearance, saveAppearance } from './appearance-store';
import { SCHEMA_VERSION, STORAGE_KEYS } from './schema';

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

describe('saveAppearance / loadAppearance', () => {
  it('保存并读取自定义主题与当前主题', () => {
    const storage = createMemoryStorage();
    const custom = createCustomTheme();
    const appearance: AppearanceState = {
      activeThemeId: custom.id,
      themes: [...createDefaultAppearance().themes, custom],
    };

    saveAppearance(appearance, storage);

    const loaded = loadAppearance(storage);
    expect(loaded.activeThemeId).toBe(custom.id);
    expect(loaded.themes.map((theme) => theme.id)).toEqual(['rainbow', 'rainbow-soft', custom.id]);
    expect(loaded.themes[2]).toEqual(custom);
    expect(readJson(storage, STORAGE_KEYS.appearance)).toEqual({
      version: SCHEMA_VERSION,
      data: loaded,
    });
  });

  it('内置主题始终使用当前代码的 canonical 版本', () => {
    const storage = createMemoryStorage();
    const tamperedBuiltin: Theme = {
      ...createDefaultAppearance().themes[0],
      name: '被篡改的内置主题',
    };
    writeJson(storage, STORAGE_KEYS.appearance, {
      version: SCHEMA_VERSION,
      data: {
        activeThemeId: 'rainbow',
        themes: [tamperedBuiltin],
      },
    });

    expect(loadAppearance(storage)).toEqual(createDefaultAppearance());
  });

  it('缺失、损坏或版本不匹配时回退默认外观', () => {
    const storage = createMemoryStorage();
    expect(loadAppearance(storage)).toEqual(createDefaultAppearance());

    storage.set(STORAGE_KEYS.appearance, 'not-json');
    expect(loadAppearance(storage)).toEqual(createDefaultAppearance());

    writeJson(storage, STORAGE_KEYS.appearance, {
      version: SCHEMA_VERSION + 1,
      data: { activeThemeId: 'missing', themes: [] },
    });
    expect(loadAppearance(storage)).toEqual(createDefaultAppearance());
  });

  it('localStorage 读取不可用时回退默认外观', () => {
    const storage = {
      get: () => {
        throw new DataStoreError('unavailable', '不可用');
      },
      set: () => undefined,
      remove: () => undefined,
      keys: () => [],
    };

    expect(loadAppearance(storage)).toEqual(createDefaultAppearance());
  });
});

describe('normalizeAppearance', () => {
  it('修复可恢复的 metrics、空白色和字体色', () => {
    const custom = createCustomTheme();
    const appearance = normalizeAppearance({
      activeThemeId: custom.id,
      themes: [
        {
          ...custom,
          color: {
            ...custom.color,
            blankColor: 'not-a-color',
            fontColor: 'not-a-font-color',
          },
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
        blankColor: 'transparent',
        fontColor: 'auto',
      },
      metrics: {
        fontSizeRatio: 1,
        gapRatio: 0,
        radiusRatio: 0.5,
      },
    });
  });

  it('丢弃非法 palette、内置 ID、重复 ID 和非法主题', () => {
    const custom = createCustomTheme();
    const invalidPalette = {
      ...custom,
      id: 'custom-bad',
      color: {
        ...custom.color,
        palette: custom.color.palette.slice(0, 17),
      },
    };
    const appearance = normalizeAppearance({
      activeThemeId: custom.id,
      themes: [
        invalidPalette,
        custom,
        custom,
        { ...custom, id: 'rainbow' },
        { ...custom, id: 'custom-builtin', builtin: true },
      ],
    });

    expect(appearance.themes.map((theme) => theme.id)).toEqual([
      'rainbow',
      'rainbow-soft',
      custom.id,
    ]);
  });

  it('最多保留 3 个自定义主题，并回退失效 activeThemeId', () => {
    const themes = [1, 2, 3, 4].map((index) =>
      createCustomTheme(`custom-${index}`, `自定义 ${index}`),
    );
    const appearance = normalizeAppearance({
      activeThemeId: 'missing',
      themes,
    });

    expect(appearance.themes.map((theme) => theme.id)).toEqual([
      'rainbow',
      'rainbow-soft',
      'custom-1',
      'custom-2',
      'custom-3',
    ]);
    expect(appearance.activeThemeId).toBe('rainbow');
  });
});
