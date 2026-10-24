import { describe, expect, it } from 'vitest';
import type { Theme } from '../../types';
import { BUILTIN_THEMES } from './presets';
import {
  cloneAppearance,
  createDefaultAppearance,
  CUSTOM_THEME_SLOT_COUNT,
  getActiveTheme,
  isAppearanceEqual,
  removeCustomTheme,
  setActiveTheme,
  upsertCustomTheme,
} from './appearance';

const rowPalette = Array.from(
  { length: 10 },
  (_, index) => `#1000${index.toString(16).padStart(2, '0')}`,
);

function createCustomTheme(overrides: Partial<Theme> = {}): Theme {
  return {
    id: 'custom-1',
    name: '我的按行主题',
    builtin: false,
    color: {
      mode: 'row',
      palette: rowPalette,
      blankColor: 'transparent',
      fontColor: 'auto',
    },
    blindTileColor: '#66ccff',
    metrics: {
      fontSizeRatio: 0.6,
      gapRatio: 0.02,
      radiusRatio: 0.05,
    },
    ...overrides,
  };
}

describe('createDefaultAppearance', () => {
  it('只包含两套内置主题并默认激活彩虹', () => {
    const appearance = createDefaultAppearance();

    expect(appearance.activeThemeId).toBe('rainbow');
    expect(appearance.themes).toHaveLength(2);
    expect(appearance.themes.map((theme) => theme.id)).toEqual(['rainbow', 'rainbow-soft']);
    expect(getActiveTheme(appearance).id).toBe('rainbow');
  });

  it('复制内置主题，不共享内置常量引用', () => {
    const appearance = createDefaultAppearance();
    expect(appearance.themes[0]).not.toBe(BUILTIN_THEMES[0]);
    expect(appearance.themes[0].color.palette).not.toBe(BUILTIN_THEMES[0].color.palette);
  });

  it('不生成空 Theme 占位', () => {
    const appearance = createDefaultAppearance();
    expect(appearance.themes.every((theme) => theme.name.length > 0)).toBe(true);
    expect(CUSTOM_THEME_SLOT_COUNT).toBe(20);
    expect(appearance.themes).toHaveLength(2);
  });
});

describe('getActiveTheme', () => {
  it('activeThemeId 失效时回退第一个内置主题', () => {
    const appearance = {
      ...createDefaultAppearance(),
      activeThemeId: 'missing',
    };
    expect(getActiveTheme(appearance).id).toBe('rainbow');
  });

  it('返回当前自定义主题', () => {
    const custom = createCustomTheme();
    const appearance = setActiveTheme(
      upsertCustomTheme(createDefaultAppearance(), custom),
      custom.id,
    );
    expect(getActiveTheme(appearance)).toEqual(custom);
  });
});

describe('cloneAppearance', () => {
  it('深拷贝主题数组、palette 和 metrics', () => {
    const appearance = upsertCustomTheme(createDefaultAppearance(), createCustomTheme());
    const clone = cloneAppearance(appearance);

    expect(clone).not.toBe(appearance);
    expect(clone.themes).not.toBe(appearance.themes);
    expect(clone.themes[2]).not.toBe(appearance.themes[2]);
    expect(clone.themes[2].color.palette).not.toBe(appearance.themes[2].color.palette);
    expect(clone.themes[2].metrics).not.toBe(appearance.themes[2].metrics);
  });
});

describe('setActiveTheme', () => {
  it('切换到已有自定义主题', () => {
    const custom = createCustomTheme();
    const withCustom = upsertCustomTheme(createDefaultAppearance(), custom);
    const next = setActiveTheme(withCustom, custom.id);

    expect(next.activeThemeId).toBe(custom.id);
    expect(next.themes).toBe(withCustom.themes);
  });

  it('目标不存在或已经是当前主题时返回原状态', () => {
    const appearance = createDefaultAppearance();
    expect(setActiveTheme(appearance, 'missing')).toBe(appearance);
    expect(setActiveTheme(appearance, 'rainbow')).toBe(appearance);
  });
});

describe('upsertCustomTheme', () => {
  it('新增自定义主题时追加到列表，不改变当前主题', () => {
    const custom = createCustomTheme();
    const next = upsertCustomTheme(createDefaultAppearance(), custom);

    expect(next.themes).toHaveLength(3);
    expect(next.themes[2]).toEqual(custom);
    expect(next.themes[2]).not.toBe(custom);
    expect(next.activeThemeId).toBe('rainbow');
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

  it('拒绝覆盖内置主题 ID', () => {
    const appearance = createDefaultAppearance();
    const fakeBuiltin = createCustomTheme({ id: 'rainbow' });
    expect(upsertCustomTheme(appearance, fakeBuiltin)).toBe(appearance);
  });

  it('拒绝 builtin 标记的主题', () => {
    const appearance = createDefaultAppearance();
    const fakeBuiltin = createCustomTheme({ id: 'custom-2', builtin: true });
    expect(upsertCustomTheme(appearance, fakeBuiltin)).toBe(appearance);
  });
});

describe('removeCustomTheme', () => {
  it('删除非当前自定义主题', () => {
    const custom = createCustomTheme();
    const withCustom = upsertCustomTheme(createDefaultAppearance(), custom);
    const next = removeCustomTheme(withCustom, custom.id);

    expect(next.themes).toHaveLength(2);
    expect(next.activeThemeId).toBe('rainbow');
  });

  it('删除当前自定义主题后回退到默认内置主题', () => {
    const custom = createCustomTheme();
    const withCustom = upsertCustomTheme(createDefaultAppearance(), custom);
    const active = setActiveTheme(withCustom, custom.id);
    const next = removeCustomTheme(active, custom.id);

    expect(next.activeThemeId).toBe('rainbow');
    expect(next.themes.map((theme) => theme.id)).toEqual(['rainbow', 'rainbow-soft']);
  });

  it('内置主题和不存在主题不可删除', () => {
    const appearance = createDefaultAppearance();
    expect(removeCustomTheme(appearance, 'rainbow')).toBe(appearance);
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

  it('activeThemeId 或主题数量不同返回 false', () => {
    const appearance = createDefaultAppearance();
    expect(isAppearanceEqual(appearance, { ...appearance, activeThemeId: 'missing' })).toBe(false);
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

  it('着色模式、palette 或字体色不同返回 false', () => {
    const custom = createCustomTheme();
    const appearance = upsertCustomTheme(createDefaultAppearance(), custom);
    const [builtin, soft, extra] = appearance.themes;
    const changedPalette = createCustomTheme({
      color: {
        mode: 'row',
        palette: custom.color.palette.map((color, index) => (index === 0 ? '#000000' : color)),
        blankColor: custom.color.blankColor,
        fontColor: custom.color.fontColor,
      },
    });
    const changedFont = createCustomTheme({
      color: { ...custom.color, fontColor: '#000000' },
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
  });

  it('metrics 任一字段不同返回 false', () => {
    const custom = createCustomTheme();
    const appearance = upsertCustomTheme(createDefaultAppearance(), custom);
    const [builtin, soft] = appearance.themes;
    const changedMetrics = createCustomTheme({
      metrics: { ...custom.metrics, gapRatio: 0.08 },
    });

    expect(
      isAppearanceEqual(appearance, {
        ...appearance,
        themes: [builtin!, soft!, changedMetrics],
      }),
    ).toBe(false);
  });
});
