import type {
  AppearanceState,
  BoardMetrics,
  ColorMode,
  GameMode,
  GameSettings,
  MoveMode,
  MoveRecord,
  ReplayRecord,
  ScoreRecord,
  Theme,
} from '../types';
import { isValidBlankColor, isValidHexColor } from '../core/appearance/theme';
import { isPuzzleSize, isValidBoard } from '../core/board';
import { isGroupId } from '../core/groups';
import { isDirection } from '../core/moves';
import { MAX_REPLAY_MOVES } from './replay-codec';

export const SCHEMA_VERSION = 2;

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
    isRatio(value.gapRatio, 0, 0.1) &&
    isRatio(value.radiusRatio, 0, 0.5)
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
  if (
    !palette.every((color): color is string => typeof color === 'string' && isValidHexColor(color))
  ) {
    return false;
  }

  return (
    typeof value.blankColor === 'string' &&
    isValidBlankColor(value.blankColor) &&
    typeof value.fontColor === 'string' &&
    (value.fontColor === 'auto' || isValidHexColor(value.fontColor))
  );
}

/** 主题结构、色板和 metrics 范围的严格校验；store 层可以在加载时做修复。 */
export function isTheme(value: unknown): value is Theme {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.name === 'string' &&
    value.name.length > 0 &&
    typeof value.builtin === 'boolean' &&
    isColorMode(value.color) &&
    typeof value.blindTileColor === 'string' &&
    isValidHexColor(value.blindTileColor) &&
    isBoardMetrics(value.metrics)
  );
}

/** 校验外观状态：至少有一个主题，且 activeThemeId 能解析到已有主题。 */
export function isAppearanceState(value: unknown): value is AppearanceState {
  if (!isRecord(value) || typeof value.activeThemeId !== 'string') {
    return false;
  }
  if (!Array.isArray(value.themes) || !value.themes.every(isTheme)) {
    return false;
  }

  return value.themes.some((theme) => theme.id === value.activeThemeId);
}

/** 校验设置；固定 10 组、名称 trim 后非空且不超过 30 字符。 */
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
  if (!Array.isArray(value.groups) || value.groups.length !== 10) {
    return false;
  }

  for (let index = 0; index < value.groups.length; index += 1) {
    const group = value.groups[index];
    if (!isRecord(group) || typeof group.id !== 'number' || !isGroupId(group.id)) {
      return false;
    }
    if (group.id !== index + 1 || typeof group.name !== 'string') {
      return false;
    }
    const name = group.name.trim();
    if (name.length === 0 || name.length > 30) {
      return false;
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
