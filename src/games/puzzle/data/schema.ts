import type {
  AppearanceState,
  BoardMetrics,
  ColorMode,
  GameMode,
  GameSettings,
  MoveMode,
  MoveRecord,
  PuzzleSize,
  ReplayRecord,
  ScoreRecord,
  Theme,
  ThemeInnerBorder,
} from '../types';
import { CUSTOM_THEME_SLOT_COUNT } from '../core/appearance/appearance';
import { BUILTIN_THEMES, FALLBACK_THEME_ID } from '../core/appearance/presets';
import { isValidColorOrTransparent, isValidHexColor } from '../core/appearance/theme';
import { isPuzzleSize, isValidBoard, PUZZLE_SIZES } from '../core/board';
import { EVENT_GAME_MODES, EVENT_SIZES, GROUP_COUNT, GROUP_IDS, isGroupId } from '../core/groups';
import { isDirection } from '../core/moves';
import { MAX_REPLAY_MOVES } from './replay-codec';

/** 设置 envelope 版本；外观使用独立的 APPEARANCE_SCHEMA_VERSION。 */
export const SETTINGS_SCHEMA_VERSION = 3;

/** 外观 envelope 版本；v3 数据不做迁移。 */
export const APPEARANCE_SCHEMA_VERSION = 4;

const BUILTIN_THEME_IDS = new Set(BUILTIN_THEMES.map((theme) => theme.id));

export const STORAGE_KEYS = {
  settings: 'puzzle.v2.settings',
  appearance: 'puzzle.v2.appearance',
} as const;

export interface StorageEnvelope {
  readonly version: number;
  readonly data: unknown;
}

const PALETTE_LENGTHS: Record<ColorMode['mode'], number> = {
  layer: 18,
  row: 10,
  fixed: 99,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isFiniteNonNegative(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isGameMode(value: unknown): value is GameMode {
  return value === 'normal' || value === 'blind';
}

function isMoveMode(value: unknown): value is MoveMode {
  return value === 'click' || value === 'slide' || value === 'keyboard';
}

function isRatio(value: unknown, min: number, max: number): value is number {
  return isFiniteNumber(value) && value >= min && value <= max;
}

function isBoardMetrics(value: unknown): value is BoardMetrics {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isRatio(value.fontSizeRatio, 0, 1) &&
    isRatio(value.gapRatio, 0, 0.2) &&
    isRatio(value.radiusRatio, 0, 0.5)
  );
}

function isSupportedSizes(value: unknown): value is readonly PuzzleSize[] {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }

  let previous = 0;
  for (const size of value) {
    if (typeof size !== 'number' || !isPuzzleSize(size) || size <= previous) {
      return false;
    }
    previous = size;
  }
  return true;
}

/** 字体色板：每项为 #rrggbb 或 #rrggbbaa。 */
function isFontPalette(value: unknown, length: number): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every((color): color is string => typeof color === 'string' && isValidHexColor(color))
  );
}

/** 内边框颜色：transparent、#rrggbb 或 #rrggbbaa。 */
function isThemeInnerBorder(value: unknown): value is ThemeInnerBorder {
  return (
    isRecord(value) &&
    typeof value.color === 'string' &&
    isValidColorOrTransparent(value.color) &&
    isRatio(value.widthRatio, 0, 0.2)
  );
}

function isColorMode(value: unknown): value is ColorMode {
  if (!isRecord(value)) {
    return false;
  }

  const mode = value.mode;
  if (mode !== 'layer' && mode !== 'row' && mode !== 'fixed') {
    return false;
  }

  const palette = value.palette;
  if (!Array.isArray(palette) || palette.length !== PALETTE_LENGTHS[mode]) {
    return false;
  }
  // 背景色板支持 6 位不透明色和 8 位带 alpha 色。
  if (
    !palette.every((color): color is string => typeof color === 'string' && isValidHexColor(color))
  ) {
    return false;
  }

  return isFontPalette(value.fontPalette, palette.length);
}

/**
 * 主题结构、色板、逐块字体色、内边框和 metrics 范围的严格校验。
 * 颜色接受 #rrggbb / #rrggbbaa；store 层可以在加载时修复其他字段。
 */
export function isTheme(value: unknown): value is Theme {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    typeof value.builtin === 'boolean' &&
    isSupportedSizes(value.supportedSizes) &&
    isColorMode(value.color) &&
    isThemeInnerBorder(value.innerBorder) &&
    typeof value.blindTileColor === 'string' &&
    isValidHexColor(value.blindTileColor) &&
    isBoardMetrics(value.metrics)
  );
}

/**
 * 校验外观状态：
 * - 9 个阶数键齐全；
 * - 每个值要么指向支持该阶数的主题，要么是 fallback；
 * - 两套内置主题存在，自定义主题不超过 20 个；
 * - fallback 主题不进入 themes。
 */
export function isAppearanceState(value: unknown): value is AppearanceState {
  if (!isRecord(value) || !isRecord(value.themeIdBySize)) {
    return false;
  }
  if (!Array.isArray(value.themes)) {
    return false;
  }

  const ids = new Set<string>();
  let customCount = 0;

  for (const theme of value.themes) {
    if (!isTheme(theme) || ids.has(theme.id) || theme.id === FALLBACK_THEME_ID) {
      return false;
    }
    ids.add(theme.id);

    if (BUILTIN_THEME_IDS.has(theme.id)) {
      if (!theme.builtin) {
        return false;
      }
      continue;
    }

    if (theme.builtin) {
      return false;
    }
    customCount += 1;
  }

  if (customCount > CUSTOM_THEME_SLOT_COUNT) {
    return false;
  }
  if (!BUILTIN_THEMES.every((builtin) => ids.has(builtin.id))) {
    return false;
  }

  const keys = Object.keys(value.themeIdBySize);
  if (keys.length !== PUZZLE_SIZES.length) {
    return false;
  }

  for (const size of PUZZLE_SIZES) {
    if (!Object.prototype.hasOwnProperty.call(value.themeIdBySize, size)) {
      return false;
    }

    const themeId = value.themeIdBySize[String(size)];
    if (typeof themeId !== 'string' || themeId.length === 0) {
      return false;
    }
    if (themeId === FALLBACK_THEME_ID) {
      continue;
    }

    const theme = value.themes.find((item) => item.id === themeId);
    if (theme === undefined || !theme.supportedSizes.includes(size)) {
      return false;
    }
  }

  return true;
}

/** 校验设置；固定 90 组，按阶数升序、普通在前、槽位 1–5 排列。 */
export function isGameSettings(value: unknown): value is GameSettings {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.size !== 'number' || !isPuzzleSize(value.size)) {
    return false;
  }
  if (!isGameMode(value.gameMode) || !isMoveMode(value.moveMode)) {
    return false;
  }
  if (typeof value.groupId !== 'number' || !isGroupId(value.groupId)) {
    return false;
  }
  if (!Array.isArray(value.groups) || value.groups.length !== GROUP_COUNT) {
    return false;
  }

  let index = 0;
  for (const size of EVENT_SIZES) {
    for (const gameMode of EVENT_GAME_MODES) {
      for (const id of GROUP_IDS) {
        const group = value.groups[index];
        index += 1;
        if (
          !isRecord(group) ||
          group.size !== size ||
          group.gameMode !== gameMode ||
          group.id !== id ||
          typeof group.name !== 'string'
        ) {
          return false;
        }
        const name = group.name.trim();
        if (name.length === 0 || name.length > 30) {
          return false;
        }
      }
    }
  }

  return typeof value.customCursor === 'boolean' && typeof value.minimalUi === 'boolean';
}

/** 校验一条成绩摘要；时间字段允许小数，durationMs 允许为 0（同一毫秒完成）。 */
export function isScoreRecord(value: unknown): value is ScoreRecord {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.id !== 'string' || value.id.length === 0) {
    return false;
  }
  if (typeof value.size !== 'number' || !isPuzzleSize(value.size)) {
    return false;
  }
  if (!isGameMode(value.gameMode) || !isMoveMode(value.moveMode)) {
    return false;
  }
  if (typeof value.groupId !== 'number' || !isGroupId(value.groupId)) {
    return false;
  }
  if (!isFiniteNonNegative(value.durationMs) || !isFiniteNonNegative(value.observeMs)) {
    return false;
  }
  if (
    typeof value.moveCount !== 'number' ||
    !Number.isInteger(value.moveCount) ||
    value.moveCount < 0 ||
    value.moveCount > MAX_REPLAY_MOVES
  ) {
    return false;
  }
  if (!Array.isArray(value.scramble) || !isValidBoard(value.scramble, value.size)) {
    return false;
  }
  if (!isFiniteNumber(value.finishedAt)) {
    return false;
  }

  return true;
}

export function isMoveRecord(value: unknown): value is MoveRecord {
  return (
    isRecord(value) &&
    typeof value.direction === 'string' &&
    isDirection(value.direction) &&
    isFiniteNonNegative(value.timeMs)
  );
}

/** 校验运行时录像；时间允许小数，但必须非负且单调不减。 */
export function isReplayRecord(value: unknown): value is ReplayRecord {
  if (!isRecord(value) || typeof value.scoreId !== 'string' || value.scoreId.length === 0) {
    return false;
  }
  if (!Array.isArray(value.moves) || value.moves.length > MAX_REPLAY_MOVES) {
    return false;
  }

  let previousTimeMs = 0;
  for (const move of value.moves) {
    if (!isMoveRecord(move) || move.timeMs < previousTimeMs) {
      return false;
    }
    previousTimeMs = move.timeMs;
  }

  return true;
}

export function isStorageEnvelope(value: unknown): value is StorageEnvelope {
  return (
    isRecord(value) &&
    typeof value.version === 'number' &&
    Number.isInteger(value.version) &&
    value.version > 0 &&
    'data' in value
  );
}
