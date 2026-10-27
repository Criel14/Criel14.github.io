import { describe, expect, it } from 'vitest';
import type { AppearanceState, GameSettings, ReplayRecord, ScoreRecord, Theme } from '../types';
import { createDefaultAppearance, createFallbackAppearance } from '../core/appearance/appearance';
import { FALLBACK_THEME, FALLBACK_THEME_ID } from '../core/appearance/presets';
import { createSolvedBoard } from '../core/board';
import { createDefaultGroups, GROUP_COUNT } from '../core/groups';
import {
  APPEARANCE_SCHEMA_VERSION,
  isAppearanceState,
  isGameSettings,
  isMoveRecord,
  isReplayRecord,
  isScoreRecord,
  isStorageEnvelope,
  isTheme,
  SETTINGS_SCHEMA_VERSION,
  STORAGE_KEYS,
} from './schema';

const EPOCH = 1_700_000_000_000;

function createSettings(overrides: Partial<GameSettings> = {}): GameSettings {
  return {
    size: 4,
    gameMode: 'normal',
    moveMode: 'slide',
    groupId: 1,
    groups: createDefaultGroups(),
    customCursor: false,
    minimalUi: false,
    ...overrides,
  };
}

function createScore(overrides: Partial<ScoreRecord> = {}): ScoreRecord {
  return {
    id: 'score-1',
    size: 3,
    gameMode: 'normal',
    moveMode: 'slide',
    groupId: 1,
    durationMs: 1_000,
    observeMs: 0,
    moveCount: 0,
    scramble: createSolvedBoard(3),
    finishedAt: EPOCH,
    ...overrides,
  };
}

function createReplay(overrides: Partial<ReplayRecord> = {}): ReplayRecord {
  return {
    scoreId: 'score-1',
    moves: [
      { direction: 'L', timeMs: 0.123 },
      { direction: 'U', timeMs: 1.235 },
    ],
    ...overrides,
  };
}

describe('isScoreRecord', () => {
  it('接受 durationMs 为 0 或小数', () => {
    expect(isScoreRecord(createScore({ durationMs: 0 }))).toBe(true);
    expect(isScoreRecord(createScore({ durationMs: 0.001, observeMs: 0.5 }))).toBe(true);
  });

  it('拒绝非法标识、阶数、分组和棋盘', () => {
    expect(isScoreRecord(createScore({ id: '' }))).toBe(false);
    expect(isScoreRecord({ ...createScore(), size: 11 })).toBe(false);
    expect(isScoreRecord({ ...createScore(), groupId: 0 })).toBe(false);
    expect(isScoreRecord({ ...createScore(), groupId: 6 })).toBe(false);
    expect(isScoreRecord(createScore({ scramble: [1, 2, 3] }))).toBe(false);
  });

  it('拒绝负时间和非法 moveCount', () => {
    expect(isScoreRecord(createScore({ durationMs: -1 }))).toBe(false);
    expect(isScoreRecord(createScore({ observeMs: -1 }))).toBe(false);
    expect(isScoreRecord(createScore({ moveCount: -1 }))).toBe(false);
    expect(isScoreRecord(createScore({ moveCount: 1.5 }))).toBe(false);
  });
});

describe('isMoveRecord / isReplayRecord', () => {
  it('接受带小数且单调不减的录像', () => {
    expect(isReplayRecord(createReplay())).toBe(true);
    expect(isMoveRecord({ direction: 'R', timeMs: 0.123 })).toBe(true);
  });

  it('拒绝非法方向和负数时间', () => {
    expect(isMoveRecord({ direction: 'X', timeMs: 0 })).toBe(false);
    expect(isMoveRecord({ direction: 'U', timeMs: -0.001 })).toBe(false);
  });

  it('拒绝时间回退和空 scoreId', () => {
    expect(
      isReplayRecord(
        createReplay({
          moves: [
            { direction: 'L', timeMs: 2 },
            { direction: 'U', timeMs: 1 },
          ],
        }),
      ),
    ).toBe(false);
    expect(isReplayRecord(createReplay({ scoreId: '' }))).toBe(false);
  });
});

describe('isGameSettings', () => {
  it('接受默认的 90 组设置', () => {
    expect(isGameSettings(createSettings())).toBe(true);
  });

  it('拒绝分组数量、顺序、事件或名称非法', () => {
    const settings = createSettings();
    expect(isGameSettings({ ...settings, groups: settings.groups.slice(0, GROUP_COUNT - 1) })).toBe(
      false,
    );
    expect(
      isGameSettings({
        ...settings,
        groups: [settings.groups[1], settings.groups[0], ...settings.groups.slice(2)],
      }),
    ).toBe(false);
    expect(
      isGameSettings({
        ...settings,
        groups: settings.groups.map((group, index) =>
          index === 0 ? { ...group, size: 3 } : group,
        ),
      }),
    ).toBe(false);
    expect(
      isGameSettings({
        ...settings,
        groups: settings.groups.map((group, index) =>
          index === 0 ? { ...group, gameMode: 'blind' } : group,
        ),
      }),
    ).toBe(false);
    expect(
      isGameSettings({
        ...settings,
        groups: settings.groups.map((group, index) => (index === 0 ? { ...group, id: 2 } : group)),
      }),
    ).toBe(false);
    expect(
      isGameSettings({
        ...settings,
        groups: settings.groups.map((group, index) =>
          index === 0 ? { ...group, name: '   ' } : group,
        ),
      }),
    ).toBe(false);
    expect(
      isGameSettings({
        ...settings,
        groups: settings.groups.map((group, index) =>
          index === 0 ? { ...group, name: 'x'.repeat(31) } : group,
        ),
      }),
    ).toBe(false);
  });

  it('拒绝非法枚举和分组编号', () => {
    expect(isGameSettings({ ...createSettings(), size: 11 })).toBe(false);
    expect(isGameSettings({ ...createSettings(), gameMode: 'other' })).toBe(false);
    expect(isGameSettings({ ...createSettings(), moveMode: 'other' })).toBe(false);
    expect(isGameSettings({ ...createSettings(), groupId: 6 })).toBe(false);
  });
});

describe('isTheme / isAppearanceState', () => {
  const appearance = createDefaultAppearance();
  const theme = appearance.themes[0];

  it('接受默认主题、默认外观和回退外观', () => {
    expect(isTheme(theme)).toBe(true);
    expect(isAppearanceState(appearance)).toBe(true);
    expect(isAppearanceState(createFallbackAppearance())).toBe(true);
  });

  it('接受带 alpha 的主题颜色', () => {
    const alphaTheme: Theme = {
      ...theme,
      id: 'custom-alpha',
      name: '带透明主题',
      builtin: false,
      color: {
        ...theme.color,
        palette: theme.color.palette.map((color, index) => (index === 0 ? '#12345680' : color)),
        fontPalette: theme.color.fontPalette.map((color, index) =>
          index === 0 ? '#ffffff40' : color,
        ),
      },
      innerBorder: { color: '#ffffff40', widthRatio: 0.02 },
      blindTileColor: '#3498db80',
    };

    expect(isTheme(alphaTheme)).toBe(true);
    expect(
      isAppearanceState({
        ...appearance,
        themes: [...appearance.themes, alphaTheme],
        themeIdBySize: { ...appearance.themeIdBySize, 10: alphaTheme.id },
      }),
    ).toBe(true);
  });

  it('接受内边框宽度和间隙的 0.2 上限', () => {
    expect(
      isTheme({
        ...theme,
        innerBorder: { color: 'transparent', widthRatio: 0.2 },
      }),
    ).toBe(true);
    expect(
      isTheme({
        ...theme,
        metrics: { ...theme.metrics, gapRatio: 0.2 },
      }),
    ).toBe(true);
  });

  it('拒绝色板、字体色、内边框和 metrics 非法', () => {
    expect(
      isTheme({
        ...theme,
        color: { ...theme.color, palette: theme.color.palette.slice(0, 17) },
      }),
    ).toBe(false);
    expect(
      isTheme({
        ...theme,
        color: { ...theme.color, fontPalette: theme.color.fontPalette.slice(0, 17) },
      }),
    ).toBe(false);
    expect(
      isTheme({
        ...theme,
        color: { ...theme.color, fontPalette: Array(18).fill('#fff') },
      }),
    ).toBe(false);
    expect(
      isTheme({
        ...theme,
        color: {
          ...theme.color,
          palette: ['#1234567', ...theme.color.palette.slice(1)],
        },
      }),
    ).toBe(false);
    expect(
      isTheme({
        ...theme,
        innerBorder: { color: 'red', widthRatio: 0 },
      }),
    ).toBe(false);
    expect(
      isTheme({
        ...theme,
        innerBorder: { color: 'transparent', widthRatio: 0.3 },
      }),
    ).toBe(false);
    expect(
      isTheme({
        ...theme,
        metrics: { ...theme.metrics, fontSizeRatio: 2 },
      }),
    ).toBe(false);
    expect(
      isTheme({
        ...theme,
        metrics: { ...theme.metrics, gapRatio: 0.3 },
      }),
    ).toBe(false);
    expect(
      isTheme({
        ...theme,
        blindTileColor: 'red',
      }),
    ).toBe(false);
  });

  it('拒绝支持的阶数非法', () => {
    expect(isTheme({ ...theme, supportedSizes: [] })).toBe(false);
    expect(isTheme({ ...theme, supportedSizes: [4, 3] })).toBe(false);
    expect(isTheme({ ...theme, supportedSizes: [4, 4] })).toBe(false);
    expect(isTheme({ ...theme, supportedSizes: [11] })).toBe(false);
  });

  it('拒绝 themeIdBySize 缺键、未知 ID 或主题不支持该阶数', () => {
    const missingKey = { ...appearance.themeIdBySize } as Record<number, string>;
    delete missingKey[9];
    const missingState = {
      ...appearance,
      themeIdBySize: missingKey,
    } as unknown as AppearanceState;
    expect(isAppearanceState(missingState)).toBe(false);

    const unknownId: AppearanceState = {
      ...appearance,
      themeIdBySize: { ...appearance.themeIdBySize, 10: 'missing' },
    };
    expect(isAppearanceState(unknownId)).toBe(false);

    const limited: Theme = {
      ...theme,
      id: 'limited',
      name: '限定主题',
      builtin: false,
      supportedSizes: [9],
    };
    const unsupported: AppearanceState = {
      ...appearance,
      themes: [...appearance.themes, limited],
      themeIdBySize: { ...appearance.themeIdBySize, 10: limited.id },
    };
    expect(isAppearanceState(unsupported)).toBe(false);
  });

  it('拒绝主题列表为空、重复 ID、回退主题或 builtin 标记错误', () => {
    expect(isAppearanceState({ ...appearance, themes: [] })).toBe(false);

    const duplicate: AppearanceState = {
      ...appearance,
      themes: [...appearance.themes, appearance.themes[0]],
    };
    expect(isAppearanceState(duplicate)).toBe(false);

    const withFallbackTheme: AppearanceState = {
      ...appearance,
      themes: [...appearance.themes, FALLBACK_THEME],
    };
    expect(isAppearanceState(withFallbackTheme)).toBe(false);

    const customBuiltin: AppearanceState = {
      ...appearance,
      themes: [...appearance.themes, { ...theme, id: 'custom-builtin', builtin: true }],
    };
    expect(isAppearanceState(customBuiltin)).toBe(false);

    const builtinWithoutFlag: AppearanceState = {
      ...appearance,
      themes: appearance.themes.map((item) =>
        item.id === 'rainbow' ? { ...item, builtin: false } : item,
      ),
    };
    expect(isAppearanceState(builtinWithoutFlag)).toBe(false);
  });

  it('拒绝超过 20 个自定义主题', () => {
    const customs = Array.from({ length: 21 }, (_, index) => ({
      ...theme,
      id: `custom-${index + 1}`,
      name: `自定义 ${index + 1}`,
      builtin: false,
    }));
    const tooMany: AppearanceState = {
      ...appearance,
      themes: [...appearance.themes, ...customs],
    };
    expect(isAppearanceState(tooMany)).toBe(false);
  });

  it('接受 themeIdBySize 显式使用 fallback', () => {
    const state: AppearanceState = {
      ...appearance,
      themeIdBySize: { ...appearance.themeIdBySize, 10: FALLBACK_THEME_ID },
    };
    expect(isAppearanceState(state)).toBe(true);
  });
});

describe('isStorageEnvelope / 存储键 / 版本', () => {
  it('接受带 data 的正整数版本信封', () => {
    expect(isStorageEnvelope({ version: SETTINGS_SCHEMA_VERSION, data: {} })).toBe(true);
    expect(isStorageEnvelope({ version: APPEARANCE_SCHEMA_VERSION, data: {} })).toBe(true);
  });

  it('拒绝非法版本和缺失 data', () => {
    expect(isStorageEnvelope({ version: 0, data: {} })).toBe(false);
    expect(isStorageEnvelope({ version: 1.5, data: {} })).toBe(false);
    expect(isStorageEnvelope({ version: SETTINGS_SCHEMA_VERSION })).toBe(false);
    expect(isStorageEnvelope(null)).toBe(false);
  });

  it('设置和外观使用独立的版本号', () => {
    expect(SETTINGS_SCHEMA_VERSION).toBe(3);
    expect(APPEARANCE_SCHEMA_VERSION).toBe(4);
  });

  it('存储键使用 puzzle.v2 命名空间', () => {
    expect(STORAGE_KEYS).toEqual({
      settings: 'puzzle.v2.settings',
      appearance: 'puzzle.v2.appearance',
    });
  });
});
