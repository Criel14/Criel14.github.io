import type { AppearanceState, ColorMode, PuzzleSize, Theme } from '../types';
import {
  createDefaultAppearance,
  createFallbackAppearance,
  CUSTOM_THEME_SLOT_COUNT,
} from '../core/appearance/appearance';
import { normalizeInnerBorder, normalizeMetrics } from '../core/appearance/metrics';
import { DEFAULT_BLIND_TILE_COLOR, FALLBACK_THEME_ID } from '../core/appearance/presets';
import { cloneTheme, isValidBlankColor, isValidHexColor } from '../core/appearance/theme';
import { isPuzzleSize, PUZZLE_SIZES } from '../core/board';
import {
  createLocalStorage,
  readJsonResult,
  writeJson,
  type StorageAdapter,
  type StorageReadStatus,
} from './local-storage';
import {
  APPEARANCE_SCHEMA_VERSION,
  isAppearanceState,
  isStorageEnvelope,
  isTheme,
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
 * 修复逐块字体色。
 * 缺失或长度不对时全部补白色；长度正确时单项非法也回退白色。
 * 合法项保留 #rrggbb / #rrggbbaa，包括其 alpha。
 */
function normalizeFontPalette(value: unknown, length: number): string[] {
  if (!Array.isArray(value) || value.length !== length) {
    return Array.from({ length }, () => '#ffffff');
  }

  return value.map((color) =>
    typeof color === 'string' && isValidHexColor(color) ? color : '#ffffff',
  );
}

/**
 * 修复主题支持阶数。
 * 只接受非空、升序、去重的 2–10 整数；其余情况返回 null，由调用方丢弃主题。
 */
function normalizeSupportedSizes(value: unknown): readonly PuzzleSize[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const sizes: PuzzleSize[] = [];
  let previous = 0;
  for (const size of value) {
    if (typeof size !== 'number' || !isPuzzleSize(size) || size <= previous) {
      return null;
    }
    sizes.push(size);
    previous = size;
  }
  return sizes;
}

/**
 * 修复主题颜色。
 * 结构和 palette 不可恢复时返回 null；空白色和 fontPalette 可回退到安全默认值。
 * palette / fontPalette / blankColor 均接受 #rrggbb / #rrggbbaa。
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

  return {
    mode,
    palette: [...palette],
    fontPalette: normalizeFontPalette(value.fontPalette, palette.length),
    blankColor,
  };
}

/**
 * 修复单个自定义主题。
 *
 * supportedSizes、palette 和基本身份不可恢复时返回 null；字体色、空白色、内边框、
 * 盲玩色和 metrics 按文档规则修复。
 */
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

  const supportedSizes = normalizeSupportedSizes(value.supportedSizes);
  if (supportedSizes === null) {
    return null;
  }

  const color = normalizeColorMode(value.color);
  if (color === null) {
    return null;
  }

  const blindTileColor =
    typeof value.blindTileColor === 'string' && isValidHexColor(value.blindTileColor)
      ? value.blindTileColor
      : DEFAULT_BLIND_TILE_COLOR;

  const candidate: Theme = {
    id: value.id,
    name: value.name.trim(),
    builtin: false,
    supportedSizes,
    color,
    innerBorder: normalizeInnerBorder(value.innerBorder),
    blindTileColor,
    metrics: normalizeMetrics(value.metrics),
  };

  return isTheme(candidate) ? cloneTheme(candidate) : null;
}

/**
 * 修复外观数据。
 *
 * 内置主题始终使用当前代码里的 canonical 版本；自定义主题只保留结构可恢复的前
 * CUSTOM_THEME_SLOT_COUNT 个，重复 ID、内置/回退 ID 和非法颜色直接丢弃。
 * themeIdBySize 指向缺失主题、不支持该阶数或非法值时，该阶数落到回退主题。
 */
export function normalizeAppearance(raw: unknown): AppearanceState {
  const defaults = createDefaultAppearance();
  const record = isRecord(raw) ? raw : {};
  const rawThemes = Array.isArray(record.themes) ? record.themes : [];
  const themes: Theme[] = [...defaults.themes];
  const seenThemeIds = new Set<string>([...themes.map((theme) => theme.id), FALLBACK_THEME_ID]);
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

  const rawThemeIdBySize = isRecord(record.themeIdBySize) ? record.themeIdBySize : {};
  const themeIdBySize = {} as Record<PuzzleSize, string>;

  for (const size of PUZZLE_SIZES) {
    const rawId = rawThemeIdBySize[String(size)];
    if (typeof rawId === 'string' && rawId.length > 0 && rawId !== FALLBACK_THEME_ID) {
      const theme = themes.find((item) => item.id === rawId);
      if (theme !== undefined && theme.supportedSizes.includes(size)) {
        themeIdBySize[size] = rawId;
        continue;
      }
    }
    themeIdBySize[size] = FALLBACK_THEME_ID;
  }

  return { themeIdBySize, themes };
}

/**
 * 外观读取问题的细分原因。
 *
 * `status` 仍保持四态，供页面统一判断是否需要提示；`issue` 只用于区分提示文案。
 * 版本不兼容和字段损坏都会返回回退/可恢复外观，但用户需要采取的操作不同。
 */
export type AppearanceReadIssue =
  'invalid-json' | 'invalid-envelope' | 'legacy-version' | 'unknown-version' | 'invalid-data';

/** 外观读取结果；无论状态如何都返回一份可用的外观。 */
export interface AppearanceLoadResult {
  readonly status: StorageReadStatus;
  readonly appearance: AppearanceState;
  /** 仅在 status 为 corrupt 时提供，说明具体是版本不兼容还是数据损坏。 */
  readonly issue?: AppearanceReadIssue;
}

/**
 * 读取外观并保留读取状态。
 *
 * - missing：首次使用，静默回退默认彩虹外观；
 * - corrupt：JSON/字段损坏，尽量保留可恢复的自定义主题，非法阶数使用回退主题；
 * - unavailable：localStorage 不可用，使用回退外观，页面应提示用户；
 * - v3/未知版本：不迁移，使用回退外观并提示清理 key。
 */
export function loadAppearanceResult(
  storage: StorageAdapter = createLocalStorage(),
): AppearanceLoadResult {
  const result = readJsonResult(storage, STORAGE_KEYS.appearance);

  if (result.status !== 'ok') {
    switch (result.status) {
      case 'missing':
        return { status: 'missing', appearance: createDefaultAppearance() };
      case 'unavailable':
        return { status: 'unavailable', appearance: createFallbackAppearance() };
      case 'corrupt':
        return {
          status: 'corrupt',
          appearance: createFallbackAppearance(),
          issue: 'invalid-json',
        };
    }
  }

  if (!isStorageEnvelope(result.value)) {
    return {
      status: 'corrupt',
      appearance: createFallbackAppearance(),
      issue: 'invalid-envelope',
    };
  }

  if (result.value.version !== APPEARANCE_SCHEMA_VERSION) {
    return {
      status: 'corrupt',
      appearance: createFallbackAppearance(),
      issue: result.value.version === 3 ? 'legacy-version' : 'unknown-version',
    };
  }

  if (!isAppearanceState(result.value.data)) {
    return {
      status: 'corrupt',
      appearance: normalizeAppearance(result.value.data),
      issue: 'invalid-data',
    };
  }

  return {
    status: 'ok',
    appearance: normalizeAppearance(result.value.data),
  };
}

/** 保存外观；内置主题和自定义主题都会在写入前归一化。 */
export function saveAppearance(
  appearance: AppearanceState,
  storage: StorageAdapter = createLocalStorage(),
): void {
  writeJson(storage, STORAGE_KEYS.appearance, {
    version: APPEARANCE_SCHEMA_VERSION,
    data: normalizeAppearance(appearance),
  });
}
