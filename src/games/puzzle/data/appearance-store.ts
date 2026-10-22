import type { AppearanceState, ColorMode, Theme } from '../types';
import { cloneTheme, isValidBlankColor, isValidHexColor } from '../core/appearance/theme';
import { createDefaultAppearance, CUSTOM_THEME_SLOT_COUNT } from '../core/appearance/appearance';
import { normalizeMetrics } from '../core/appearance/metrics';
import {
  createLocalStorage,
  readJsonResult,
  writeJson,
  type StorageAdapter,
  type StorageReadStatus,
} from './local-storage';
import {
  isAppearanceState,
  isStorageEnvelope,
  isTheme,
  SCHEMA_VERSION,
  STORAGE_KEYS,
} from './schema';

const PALETTE_LENGTHS: Record<ColorMode['mode'], number> = {
  layer: 18,
  row: 10,
  fixed: 99,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * 修复主题颜色。
 * 结构和 palette 不可恢复时返回 null；空白色/字体色可回退到安全默认值。
 */
function normalizeColorMode(value: unknown): ColorMode | null {
  if (!isRecord(value)) {
    return null;
  }

  const mode = value.mode;
  if (mode !== 'layer' && mode !== 'row' && mode !== 'fixed') {
    return null;
  }

  const palette = value.palette;
  if (!Array.isArray(palette) || palette.length !== PALETTE_LENGTHS[mode]) {
    return null;
  }
  if (
    !palette.every((color): color is string => typeof color === 'string' && isValidHexColor(color))
  ) {
    return null;
  }

  const blankColor =
    typeof value.blankColor === 'string' && isValidBlankColor(value.blankColor)
      ? value.blankColor
      : 'transparent';
  const fontColor =
    typeof value.fontColor === 'string' &&
    (value.fontColor === 'auto' || isValidHexColor(value.fontColor))
      ? value.fontColor
      : 'auto';

  return {
    mode,
    palette: [...palette],
    blankColor,
    fontColor,
  };
}

function normalizeCustomTheme(value: unknown): Theme | null {
  if (!isRecord(value) || value.builtin !== false) {
    return null;
  }
  if (typeof value.id !== 'string' || value.id.length === 0) {
    return null;
  }
  if (typeof value.name !== 'string' || value.name.trim().length === 0) {
    return null;
  }

  const color = normalizeColorMode(value.color);
  if (color === null) {
    return null;
  }

  if (typeof value.blindTileColor !== 'string' || !isValidHexColor(value.blindTileColor)) {
    return null;
  }

  const candidate = {
    id: value.id,
    name: value.name.trim(),
    builtin: false,
    color,
    blindTileColor: value.blindTileColor,
    metrics: normalizeMetrics(value.metrics),
  };

  return isTheme(candidate) ? cloneTheme(candidate) : null;
}

/**
 * 修复外观数据。
 *
 * 内置主题始终使用当前代码里的 canonical 版本；自定义主题只保留结构可恢复的前
 * CUSTOM_THEME_SLOT_COUNT 个，重复 ID、内置 ID 和非法颜色直接丢弃。
 */
export function normalizeAppearance(raw: unknown): AppearanceState {
  const defaults = createDefaultAppearance();
  const record = isRecord(raw) ? raw : {};
  const rawThemes = Array.isArray(record.themes) ? record.themes : [];
  const themes: Theme[] = [...defaults.themes];
  const seenThemeIds = new Set(themes.map((theme) => theme.id));
  let customCount = 0;

  for (const rawTheme of rawThemes) {
    if (customCount >= CUSTOM_THEME_SLOT_COUNT) {
      break;
    }

    const theme = normalizeCustomTheme(rawTheme);
    if (theme === null || seenThemeIds.has(theme.id)) {
      continue;
    }

    themes.push(theme);
    seenThemeIds.add(theme.id);
    customCount += 1;
  }

  const activeThemeId =
    typeof record.activeThemeId === 'string' &&
    themes.some((theme) => theme.id === record.activeThemeId)
      ? record.activeThemeId
      : defaults.activeThemeId;

  return { activeThemeId, themes };
}

/** 外观读取结果；无论状态如何都返回一份可用的外观。 */
export interface AppearanceLoadResult {
  readonly status: StorageReadStatus;
  readonly appearance: AppearanceState;
}

/**
 * 读取外观并保留读取状态。
 *
 * - missing：首次使用，静默回退默认外观；
 * - corrupt：信封或主题损坏，保留可恢复的自定义主题，其余回退默认值；
 * - unavailable：localStorage 不可用，使用默认外观，页面应提示用户。
 */
export function loadAppearanceResult(
  storage: StorageAdapter = createLocalStorage(),
): AppearanceLoadResult {
  const result = readJsonResult(storage, STORAGE_KEYS.appearance);
  if (result.status !== 'ok') {
    return { status: result.status, appearance: createDefaultAppearance() };
  }

  if (!isStorageEnvelope(result.value) || result.value.version !== SCHEMA_VERSION) {
    return { status: 'corrupt', appearance: createDefaultAppearance() };
  }

  return {
    status: isAppearanceState(result.value.data) ? 'ok' : 'corrupt',
    appearance: normalizeAppearance(result.value.data),
  };
}

/** 保存外观；内置主题和自定义主题都会在写入前归一化。 */
export function saveAppearance(
  appearance: AppearanceState,
  storage: StorageAdapter = createLocalStorage(),
): void {
  writeJson(storage, STORAGE_KEYS.appearance, {
    version: SCHEMA_VERSION,
    data: normalizeAppearance(appearance),
  });
}
