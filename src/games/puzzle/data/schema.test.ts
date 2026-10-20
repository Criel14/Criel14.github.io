import { describe, expect, it } from 'vitest';
import type { AppearanceState, GameSettings, GroupId, ReplayRecord, ScoreRecord } from '../types';
import { createDefaultAppearance } from '../core/appearance/appearance';
import { createSolvedBoard } from '../core/board';
import {
  isAppearanceState,
  isGameSettings,
  isMoveRecord,
  isReplayRecord,
  isScoreRecord,
  isStorageEnvelope,
  isTheme,
  SCHEMA_VERSION,
  STORAGE_KEYS,
} from './schema';

const EPOCH = 1_700_000_000_000;

function createSettings(overrides: Partial<GameSettings> = {}): GameSettings {
  const groups = Array.from({ length: 10 }, (_, index) => ({
    id: (index + 1) as GroupId,
    name: `G${index + 1}`,
  }));

  return {
    size: 4,
    gameMode: 'normal',
    moveMode: 'slide',
    groupId: 1,
    groups,
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
  it('接受默认的 10 组设置', () => {
    expect(isGameSettings(createSettings())).toBe(true);
  });

  it('拒绝分组数量、顺序或名称非法', () => {
    const settings = createSettings();
    expect(isGameSettings({ ...settings, groups: settings.groups.slice(0, 9) })).toBe(false);
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
    expect(isGameSettings({ ...createSettings(), groupId: 11 })).toBe(false);
  });
});

describe('isTheme / isAppearanceState', () => {
  const appearance = createDefaultAppearance();
  const theme = appearance.themes[0];

  it('接受默认主题和外观', () => {
    expect(isTheme(theme)).toBe(true);
    expect(isAppearanceState(appearance)).toBe(true);
  });

  it('拒绝色板长度、颜色和 metrics 非法', () => {
    expect(
      isTheme({
        ...theme,
        color: { ...theme.color, palette: theme.color.palette.slice(0, 17) },
      }),
    ).toBe(false);
    expect(
      isTheme({
        ...theme,
        color: { ...theme.color, blankColor: 'red' },
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
        blindTileColor: 'red',
      }),
    ).toBe(false);
  });

  it('拒绝 activeThemeId 失效或主题列表为空', () => {
    const invalidActive: AppearanceState = { ...appearance, activeThemeId: 'missing' };
    const emptyThemes: AppearanceState = { ...appearance, themes: [] };

    expect(isAppearanceState(invalidActive)).toBe(false);
    expect(isAppearanceState(emptyThemes)).toBe(false);
  });
});

describe('isStorageEnvelope / 存储键', () => {
  it('接受带 data 的正整数版本信封', () => {
    expect(isStorageEnvelope({ version: SCHEMA_VERSION, data: {} })).toBe(true);
  });

  it('拒绝非法版本和缺失 data', () => {
    expect(isStorageEnvelope({ version: 0, data: {} })).toBe(false);
    expect(isStorageEnvelope({ version: 1.5, data: {} })).toBe(false);
    expect(isStorageEnvelope({ version: SCHEMA_VERSION })).toBe(false);
    expect(isStorageEnvelope(null)).toBe(false);
  });

  it('存储键使用 puzzle.v2 命名空间', () => {
    expect(STORAGE_KEYS).toEqual({
      settings: 'puzzle.v2.settings',
      appearance: 'puzzle.v2.appearance',
    });
  });
});
