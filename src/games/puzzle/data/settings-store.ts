import type { GameMode, GameSettings, GroupId, MoveMode } from '../types';
import { isPuzzleSize } from '../core/board';
import { createDefaultGroups, getDefaultGroupName, getGroupKey, isGroupId } from '../core/groups';
import {
  createLocalStorage,
  readJsonResult,
  writeJson,
  type StorageAdapter,
  type StorageReadStatus,
} from './local-storage';
import { isGameSettings, isStorageEnvelope, SETTINGS_SCHEMA_VERSION, STORAGE_KEYS } from './schema';

const DEFAULT_SIZE = 4;
const DEFAULT_GAME_MODE: GameMode = 'normal';
const DEFAULT_MOVE_MODE: MoveMode = 'slide';
const DEFAULT_GROUP_ID: GroupId = 1;
const MAX_GROUP_NAME_LENGTH = 30;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeGroupName(value: unknown, id: GroupId): string {
  if (typeof value !== 'string') {
    return getDefaultGroupName(id);
  }

  const name = value.trim().slice(0, MAX_GROUP_NAME_LENGTH);
  return name.length > 0 ? name : getDefaultGroupName(id);
}

/** 创建默认设置；每次返回新对象，避免调用方共享分组数组。 */
export function createDefaultSettings(): GameSettings {
  return {
    size: DEFAULT_SIZE,
    gameMode: DEFAULT_GAME_MODE,
    moveMode: DEFAULT_MOVE_MODE,
    groupId: DEFAULT_GROUP_ID,
    groups: createDefaultGroups(),
    customCursor: false,
    minimalUi: false,
  };
}

/**
 * 修复设置数据。
 *
 * 设置是用户偏好，单字段损坏不应丢掉整份数据：
 * 非法枚举回退默认值；分组按 `(size, gameMode, id)` 匹配，
 * 缺失/非法槽位补齐默认名称，旧版全局 10 组数据会被忽略。
 */
export function normalizeSettings(raw: unknown): GameSettings {
  const record = isRecord(raw) ? raw : {};
  const size =
    typeof record.size === 'number' && isPuzzleSize(record.size) ? record.size : DEFAULT_SIZE;
  const gameMode: GameMode =
    record.gameMode === 'normal' || record.gameMode === 'blind'
      ? record.gameMode
      : DEFAULT_GAME_MODE;
  const moveMode: MoveMode =
    record.moveMode === 'click' || record.moveMode === 'slide' || record.moveMode === 'keyboard'
      ? record.moveMode
      : DEFAULT_MOVE_MODE;
  const groupId: GroupId =
    typeof record.groupId === 'number' && isGroupId(record.groupId)
      ? record.groupId
      : DEFAULT_GROUP_ID;

  const rawGroups = Array.isArray(record.groups) ? record.groups : [];
  const namesByKey = new Map<string, unknown>();
  for (const group of rawGroups) {
    if (!isRecord(group)) {
      continue;
    }
    if (typeof group.size !== 'number' || !isPuzzleSize(group.size)) {
      continue;
    }
    if (group.gameMode !== 'normal' && group.gameMode !== 'blind') {
      continue;
    }
    if (typeof group.id !== 'number' || !isGroupId(group.id)) {
      continue;
    }
    const key = getGroupKey(group.size, group.gameMode, group.id);
    // 重复记录保留第一条，避免后出现的损坏数据覆盖已恢复名称。
    if (!namesByKey.has(key)) {
      namesByKey.set(key, group.name);
    }
  }

  const groups = createDefaultGroups().map((group) => ({
    ...group,
    name: normalizeGroupName(
      namesByKey.get(getGroupKey(group.size, group.gameMode, group.id)),
      group.id,
    ),
  }));

  return {
    size,
    gameMode,
    moveMode,
    groupId,
    groups,
    customCursor: record.customCursor === true,
    minimalUi: record.minimalUi === true,
  };
}

/** 设置读取结果；无论状态如何都返回一份可用的设置。 */
export interface SettingsLoadResult {
  readonly status: StorageReadStatus;
  readonly settings: GameSettings;
}

/**
 * 读取设置并保留读取状态。
 *
 * - missing：首次使用，静默回退默认值；
 * - corrupt：信封或字段损坏，尽量保留可恢复字段，其余回退默认值；
 * - unavailable：localStorage 不可用，使用默认值，页面应提示用户。
 */
export function loadSettingsResult(
  storage: StorageAdapter = createLocalStorage(),
): SettingsLoadResult {
  const result = readJsonResult(storage, STORAGE_KEYS.settings);
  if (result.status !== 'ok') {
    return { status: result.status, settings: createDefaultSettings() };
  }

  if (!isStorageEnvelope(result.value) || result.value.version !== SETTINGS_SCHEMA_VERSION) {
    return { status: 'corrupt', settings: createDefaultSettings() };
  }

  return {
    status: isGameSettings(result.value.data) ? 'ok' : 'corrupt',
    settings: normalizeSettings(result.value.data),
  };
}

/**
 * 确保设置键存在。
 *
 * 只在完全缺失时写入默认设置（含 90 个分组）；损坏数据保持原样，
 * 由页面提示用户清理缓存，避免静默覆盖可能想恢复的数据。
 * 写入失败会抛 DataStoreError，由页面回退默认设置并提示。
 */
export function ensureSettingsResult(
  storage: StorageAdapter = createLocalStorage(),
): SettingsLoadResult {
  const result = loadSettingsResult(storage);
  if (result.status !== 'missing') {
    return result;
  }

  saveSettings(result.settings, storage);
  return { status: 'ok', settings: result.settings };
}

/** 保存设置；写入前再次归一化，避免把非法字段落库。 */
export function saveSettings(
  settings: GameSettings,
  storage: StorageAdapter = createLocalStorage(),
): void {
  writeJson(storage, STORAGE_KEYS.settings, {
    version: SETTINGS_SCHEMA_VERSION,
    data: normalizeSettings(settings),
  });
}
