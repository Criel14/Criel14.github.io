import { describe, expect, it } from 'vitest';
import type { AppearanceState, Theme } from '../../types';
import { PUZZLE_SIZES } from '../board';
import { BUILTIN_THEMES, FALLBACK_THEME, FALLBACK_THEME_ID } from './presets';
import {
  assignThemeToSizes,
  cloneAppearance,
  createCustomThemeDraft,
  createDefaultAppearance,
  createFallbackAppearance,
  CUSTOM_THEME_SLOT_COUNT,
  getFallbackSizes,
  getPreviewSize,
  getThemeCoverage,
  getThemeForSize,
  hasFallbackSizes,
  isAppearanceEqual,
  removeCustomTheme,
  upsertCustomTheme,
} from './appearance';

const ALL_SIZES = PUZZLE_SIZES;

const rowPalette = Array.from(
  { length: 10 },
  (_, index) => `#1000${index.toString(16).padStart(2, '0')}`,
);

const rowFontPalette = Array.from({ length: 10 }, (_, index) =>
  index === 0 ? '#000000' : '#ffffff',
);

function createCustomTheme(overrides: Partial<Theme> = {}): Theme {
  return {
    id: 'custom-1',
    name: '我的按行主题',
    builtin: false,
    supportedSizes: ALL_SIZES,
    color: {
      mode: 'row',
      palette: rowPalette,
      fontPalette: rowFontPalette,
      blankColor: 'transparent',
    },
    innerBorder: { color: 'transparent', widthRatio: 0 },
    blindTileColor: '#3498db',
    metrics: {
      fontSizeRatio: 0.6,
      gapRatio: 0.02,
      radiusRatio: 0.05,
    },
    ...overrides,
  };
}

function mapThemeIds(themeId: string): Record<number, string> {
  return Object.fromEntries(ALL_SIZES.map((size) => [size, themeId]));
}

describe('createDefaultAppearance', () => {
  it('只包含两套内置主题，所有阶数使用彩虹', () => {
    const appearance = createDefaultAppearance();

    expect(appearance.themeIdBySize).toEqual(mapThemeIds('rainbow'));
    expect(appearance.themes).toHaveLength(2);
    expect(appearance.themes.map((theme) => theme.id)).toEqual(['rainbow', 'rainbow-soft']);
    expect(ALL_SIZES.every((size) => getThemeForSize(appearance, size).id === 'rainbow')).toBe(
      true,
    );
  });

  it('复制内置主题，不共享内置常量引用', () => {
    const appearance = createDefaultAppearance();
    expect(appearance.themes[0]).not.toBe(BUILTIN_THEMES[0]);
    expect(appearance.themes[0].color.palette).not.toBe(BUILTIN_THEMES[0].color.palette);
    expect(appearance.themes[0].color.fontPalette).not.toBe(BUILTIN_THEMES[0].color.fontPalette);
    expect(appearance.themes[0].supportedSizes).not.toBe(BUILTIN_THEMES[0].supportedSizes);
  });

  it('不生成空 Theme 占位', () => {
    const appearance = createDefaultAppearance();
    expect(appearance.themes.every((theme) => theme.name.length > 0)).toBe(true);
    expect(CUSTOM_THEME_SLOT_COUNT).toBe(20);
    expect(appearance.themes).toHaveLength(2);
  });
});

describe('createFallbackAppearance', () => {
  it('所有阶数使用系统回退主题，但仍保留内置主题列表', () => {
    const appearance = createFallbackAppearance();

    expect(appearance.themeIdBySize).toEqual(mapThemeIds(FALLBACK_THEME_ID));
    expect(appearance.themes.map((theme) => theme.id)).toEqual(['rainbow', 'rainbow-soft']);
    expect(getThemeForSize(appearance, 4)).toBe(FALLBACK_THEME);
    expect(getFallbackSizes(appearance)).toEqual(ALL_SIZES);
    expect(hasFallbackSizes(appearance)).toBe(true);
  });
});

describe('getThemeForSize', () => {
  it('返回该阶数当前分配的自定义主题', () => {
    const custom = createCustomTheme({ supportedSizes: [10] });
    const withCustom = upsertCustomTheme(createDefaultAppearance(), custom);
    const assigned = assignThemeToSizes(withCustom, custom.id, [10]);

    expect(getThemeForSize(assigned, 10).id).toBe(custom.id);
    expect(getThemeForSize(assigned, 9).id).toBe('rainbow');
  });

  it('未知 ID、不支持该阶数或 fallback ID 都使用回退主题', () => {
    const base = createDefaultAppearance();
    const unknown: AppearanceState = {
      ...base,
      themeIdBySize: { ...base.themeIdBySize, 10: 'missing' },
    };
    expect(getThemeForSize(unknown, 10)).toBe(FALLBACK_THEME);

    const limited = createCustomTheme({ supportedSizes: [9] });
    const withLimited = upsertCustomTheme(base, limited);
    const unsupported: AppearanceState = {
      ...withLimited,
      themeIdBySize: { ...withLimited.themeIdBySize, 10: limited.id },
    };
    expect(getThemeForSize(unsupported, 10)).toBe(FALLBACK_THEME);

    expect(getThemeForSize(createFallbackAppearance(), 4)).toBe(FALLBACK_THEME);
  });

  it('内置主题始终使用 canonical 常量', () => {
    const base = createDefaultAppearance();
    const tampered: AppearanceState = {
      ...base,
      themes: base.themes.map((theme) =>
        theme.id === 'rainbow' ? { ...theme, name: '被篡改的彩虹' } : theme,
      ),
    };

    expect(getThemeForSize(tampered, 4).name).toBe('彩虹');
  });
});

describe('assignThemeToSizes', () => {
  it('只更新选中的阶数，不修改入参', () => {
    const custom = createCustomTheme({ supportedSizes: [10] });
    const appearance = upsertCustomTheme(createDefaultAppearance(), custom);
    const next = assignThemeToSizes(appearance, custom.id, [10]);

    expect(next.themeIdBySize[10]).toBe(custom.id);
    expect(next.themeIdBySize[9]).toBe('rainbow');
    expect(appearance.themeIdBySize[10]).toBe('rainbow');
    expect(next).not.toBe(appearance);
  });

  it('忽略主题不支持的阶数', () => {
    const custom = createCustomTheme({ supportedSizes: [10] });
    const appearance = upsertCustomTheme(createDefaultAppearance(), custom);
    const next = assignThemeToSizes(appearance, custom.id, [9, 10]);

    expect(next.themeIdBySize[9]).toBe('rainbow');
    expect(next.themeIdBySize[10]).toBe(custom.id);
  });

  it('主题不存在、fallback 或没有变化时返回原状态', () => {
    const appearance = createDefaultAppearance();
    expect(assignThemeToSizes(appearance, 'missing', [10])).toBe(appearance);
    expect(assignThemeToSizes(appearance, FALLBACK_THEME_ID, [10])).toBe(appearance);
    expect(assignThemeToSizes(appearance, 'rainbow', [4])).toBe(appearance);
    expect(assignThemeToSizes(appearance, 'rainbow', [])).toBe(appearance);
  });
});

describe('getThemeCoverage / 回退阶数', () => {
  it('覆盖范围从当前分配派生', () => {
    const custom = createCustomTheme({ supportedSizes: [10] });
    const appearance = assignThemeToSizes(
      upsertCustomTheme(createDefaultAppearance(), custom),
      custom.id,
      [10],
    );

    expect(getThemeCoverage(appearance, custom.id)).toEqual([10]);
    expect(getThemeCoverage(appearance, 'rainbow')).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    expect(getThemeCoverage(appearance, 'rainbow-soft')).toEqual([]);
    expect(getFallbackSizes(appearance)).toEqual([]);
    expect(hasFallbackSizes(appearance)).toBe(false);
  });

  it('无效分配算回退主题覆盖，不计入真实主题', () => {
    const base = createDefaultAppearance();
    const appearance: AppearanceState = {
      ...base,
      themeIdBySize: { ...base.themeIdBySize, 10: 'missing' },
    };

    expect(getThemeCoverage(appearance, 'missing')).toEqual([]);
    expect(getThemeCoverage(appearance, 'rainbow')).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    expect(getThemeCoverage(appearance, FALLBACK_THEME_ID)).toEqual([10]);
    expect(getFallbackSizes(appearance)).toEqual([10]);
  });
});

describe('getPreviewSize', () => {
  it('返回支持的最大阶数，空数组回退 10', () => {
    expect(getPreviewSize(createCustomTheme({ supportedSizes: [2, 5, 8] }))).toBe(8);
    expect(getPreviewSize(createCustomTheme({ supportedSizes: [10] }))).toBe(10);
    expect(getPreviewSize(createCustomTheme({ supportedSizes: [] }))).toBe(10);
  });
});

describe('createCustomThemeDraft', () => {
  it('复制回退主题，并生成新的 ID 和 builtin 标记', () => {
    const draft = createCustomThemeDraft('custom-new');

    expect(draft.id).toBe('custom-new');
    expect(draft.name).toBe('新的主题');
    expect(draft.builtin).toBe(false);
    expect(draft.supportedSizes).toEqual(ALL_SIZES);
    expect(draft.color).toEqual(FALLBACK_THEME.color);
    expect(draft.innerBorder).toEqual(FALLBACK_THEME.innerBorder);
    expect(draft.blindTileColor).toBe(FALLBACK_THEME.blindTileColor);
    expect(draft.metrics).toEqual(FALLBACK_THEME.metrics);
  });

  it('深拷贝所有可变结构', () => {
    const draft = createCustomThemeDraft('custom-new');
    expect(draft.color.palette).not.toBe(FALLBACK_THEME.color.palette);
    expect(draft.color.fontPalette).not.toBe(FALLBACK_THEME.color.fontPalette);
    expect(draft.supportedSizes).not.toBe(FALLBACK_THEME.supportedSizes);
    expect(draft.innerBorder).not.toBe(FALLBACK_THEME.innerBorder);
    expect(draft.metrics).not.toBe(FALLBACK_THEME.metrics);

    (draft.color.palette as string[])[0] = '#000000';
    expect(FALLBACK_THEME.color.palette[0]).toBe('#3498db');
  });
});

describe('cloneAppearance', () => {
  it('深拷贝分配表、主题数组和内部结构', () => {
    const appearance = upsertCustomTheme(createDefaultAppearance(), createCustomTheme());
    const clone = cloneAppearance(appearance);

    expect(clone).not.toBe(appearance);
    expect(clone.themeIdBySize).not.toBe(appearance.themeIdBySize);
    expect(clone.themes).not.toBe(appearance.themes);
    expect(clone.themes[2]).not.toBe(appearance.themes[2]);
    expect(clone.themes[2].color.palette).not.toBe(appearance.themes[2].color.palette);
    expect(clone.themes[2].color.fontPalette).not.toBe(appearance.themes[2].color.fontPalette);
    expect(clone.themes[2].innerBorder).not.toBe(appearance.themes[2].innerBorder);
    expect(clone.themes[2].metrics).not.toBe(appearance.themes[2].metrics);

    (clone.themeIdBySize as Record<number, string>)[4] = 'changed';
    expect(appearance.themeIdBySize[4]).toBe('rainbow');
  });
});

describe('upsertCustomTheme', () => {
  it('新增自定义主题时追加到列表，不改变当前分配', () => {
    const custom = createCustomTheme();
    const appearance = createDefaultAppearance();
    const next = upsertCustomTheme(appearance, custom);

    expect(next.themes).toHaveLength(3);
    expect(next.themes[2]).toEqual(custom);
    expect(next.themes[2]).not.toBe(custom);
    expect(next.themeIdBySize).toEqual(appearance.themeIdBySize);
  });

  it('同 ID 自定义主题原地更新', () => {
    const custom = createCustomTheme();
    const withCustom = upsertCustomTheme(createDefaultAppearance(), custom);
    const updated = createCustomTheme({ name: '改名后的主题' });
    const next = upsertCustomTheme(withCustom, updated);

    expect(next.themes).toHaveLength(3);
    expect(next.themes[2].name).toBe('改名后的主题');
    expect(next.themes[2].id).toBe(custom.id);
  });

  it('支持范围缩小时，受影响阶数落到回退主题', () => {
    const custom = createCustomTheme();
    const withCustom = upsertCustomTheme(createDefaultAppearance(), custom);
    const assigned = assignThemeToSizes(withCustom, custom.id, [9, 10]);
    const shrunk = upsertCustomTheme(
      assigned,
      createCustomTheme({ supportedSizes: [2, 3, 4, 5, 6, 7, 8, 9] }),
    );

    expect(shrunk.themeIdBySize[10]).toBe(FALLBACK_THEME_ID);
    expect(shrunk.themeIdBySize[9]).toBe(custom.id);
  });

  it('拒绝覆盖内置主题 ID、回退 ID 和 builtin 主题', () => {
    const appearance = createDefaultAppearance();
    expect(upsertCustomTheme(appearance, createCustomTheme({ id: 'rainbow' }))).toBe(appearance);
    expect(upsertCustomTheme(appearance, createCustomTheme({ id: FALLBACK_THEME_ID }))).toBe(
      appearance,
    );
    expect(upsertCustomTheme(appearance, createCustomTheme({ builtin: true }))).toBe(appearance);
  });

  it('新增主题遵守 20 个上限', () => {
    const base = createDefaultAppearance();
    const appearance: AppearanceState = {
      ...base,
      themes: [
        ...base.themes,
        ...Array.from({ length: CUSTOM_THEME_SLOT_COUNT }, (_, index) =>
          createCustomTheme({ id: `custom-${index + 1}`, name: `自定义 ${index + 1}` }),
        ),
      ],
    };

    expect(upsertCustomTheme(appearance, createCustomTheme({ id: 'custom-21' }))).toBe(appearance);
    expect(
      upsertCustomTheme(appearance, createCustomTheme({ id: 'custom-1', name: '更新后的名称' })),
    ).not.toBe(appearance);
  });
});

describe('removeCustomTheme', () => {
  it('删除未使用的自定义主题', () => {
    const custom = createCustomTheme();
    const withCustom = upsertCustomTheme(createDefaultAppearance(), custom);
    const next = removeCustomTheme(withCustom, custom.id);

    expect(next.themes).toHaveLength(2);
    expect(next.themeIdBySize).toEqual(withCustom.themeIdBySize);
  });

  it('删除仍被使用的自定义主题后，受影响阶数落到回退主题', () => {
    const custom = createCustomTheme();
    const withCustom = upsertCustomTheme(createDefaultAppearance(), custom);
    const assigned = assignThemeToSizes(withCustom, custom.id, [9, 10]);
    const next = removeCustomTheme(assigned, custom.id);

    expect(next.themes.map((theme) => theme.id)).toEqual(['rainbow', 'rainbow-soft']);
    expect(next.themeIdBySize[9]).toBe(FALLBACK_THEME_ID);
    expect(next.themeIdBySize[10]).toBe(FALLBACK_THEME_ID);
    expect(next.themeIdBySize[4]).toBe('rainbow');
  });

  it('内置主题、回退主题和不存在主题不可删除', () => {
    const appearance = createDefaultAppearance();
    expect(removeCustomTheme(appearance, 'rainbow')).toBe(appearance);
    expect(removeCustomTheme(appearance, FALLBACK_THEME_ID)).toBe(appearance);
    expect(removeCustomTheme(appearance, 'missing')).toBe(appearance);
  });
});

describe('isAppearanceEqual', () => {
  it('相同内容返回 true，即使对象引用不同', () => {
    const left = createDefaultAppearance();
    const right = createDefaultAppearance();

    expect(left).not.toBe(right);
    expect(isAppearanceEqual(left, right)).toBe(true);
  });

  it('themeIdBySize 或主题数量不同返回 false', () => {
    const appearance = createDefaultAppearance();
    expect(
      isAppearanceEqual(appearance, {
        ...appearance,
        themeIdBySize: { ...appearance.themeIdBySize, 4: 'missing' },
      }),
    ).toBe(false);
    expect(isAppearanceEqual(appearance, { ...appearance, themes: [] })).toBe(false);
  });

  it('主题顺序、名称、内置标记或盲玩色不同返回 false', () => {
    const custom = createCustomTheme();
    const appearance = upsertCustomTheme(createDefaultAppearance(), custom);
    const [builtin, soft, extra] = appearance.themes;

    expect(
      isAppearanceEqual(appearance, {
        ...appearance,
        themes: [soft!, builtin!, extra!],
      }),
    ).toBe(false);
    expect(
      isAppearanceEqual(appearance, {
        ...appearance,
        themes: [builtin!, soft!, { ...extra!, name: '改名' }],
      }),
    ).toBe(false);
    expect(
      isAppearanceEqual(appearance, {
        ...appearance,
        themes: [builtin!, soft!, { ...extra!, builtin: true }],
      }),
    ).toBe(false);
    expect(
      isAppearanceEqual(appearance, {
        ...appearance,
        themes: [builtin!, soft!, { ...extra!, blindTileColor: '#000000' }],
      }),
    ).toBe(false);
  });

  it('支持阶数、着色模式、palette 或字体色不同返回 false', () => {
    const custom = createCustomTheme();
    const appearance = upsertCustomTheme(createDefaultAppearance(), custom);
    const [builtin, soft, extra] = appearance.themes;
    const changedPalette = createCustomTheme({
      color: {
        mode: 'row',
        palette: custom.color.palette.map((color, index) => (index === 0 ? '#000000' : color)),
        fontPalette: custom.color.fontPalette,
        blankColor: custom.color.blankColor,
      },
    });
    const changedFont = createCustomTheme({
      color: { ...custom.color, fontPalette: custom.color.fontPalette.map(() => '#000000') },
    });

    expect(
      isAppearanceEqual(appearance, {
        ...appearance,
        themes: [builtin!, soft!, changedPalette],
      }),
    ).toBe(false);
    expect(
      isAppearanceEqual(appearance, {
        ...appearance,
        themes: [builtin!, soft!, changedFont],
      }),
    ).toBe(false);
    expect(
      isAppearanceEqual(appearance, {
        ...appearance,
        themes: [
          { ...builtin!, color: { ...builtin!.color, blankColor: '#ffffff' } },
          soft!,
          extra!,
        ],
      }),
    ).toBe(false);
    expect(
      isAppearanceEqual(appearance, {
        ...appearance,
        themes: [builtin!, soft!, { ...extra!, supportedSizes: [2, 3, 4] }],
      }),
    ).toBe(false);
  });

  it('同一颜色的 alpha 不同返回 false', () => {
    const custom = createCustomTheme();
    const appearance = upsertCustomTheme(createDefaultAppearance(), custom);
    const alphaCustom = createCustomTheme({
      color: {
        ...custom.color,
        palette: custom.color.palette.map((color, index) => (index === 0 ? `${color}80` : color)),
      },
    });

    expect(
      isAppearanceEqual(appearance, {
        ...appearance,
        themes: [...appearance.themes.slice(0, 2), alphaCustom],
      }),
    ).toBe(false);
  });

  it('内边框或 metrics 任一字段不同返回 false', () => {
    const custom = createCustomTheme();
    const appearance = upsertCustomTheme(createDefaultAppearance(), custom);
    const [builtin, soft] = appearance.themes;

    expect(
      isAppearanceEqual(appearance, {
        ...appearance,
        themes: [
          builtin!,
          soft!,
          createCustomTheme({ innerBorder: { color: '#ffffff', widthRatio: 0.02 } }),
        ],
      }),
    ).toBe(false);
    expect(
      isAppearanceEqual(appearance, {
        ...appearance,
        themes: [
          builtin!,
          soft!,
          createCustomTheme({ metrics: { ...custom.metrics, gapRatio: 0.08 } }),
        ],
      }),
    ).toBe(false);
  });
});
