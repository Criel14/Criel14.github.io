import type { GameMode, GameSettings, Group, GroupId, MoveMode } from '../types';
import { isPuzzleSize } from '../core/board';
import { isGroupId } from '../core/groups';
import { isDataStoreError } from './errors';
import { createLocalStorage, readJson, writeJson, type StorageAdapter } from './local-storage';
import { isStorageEnvelope, SCHEMA_VERSION, STORAGE_KEYS } from './schema';

const DEFAULT_SIZE = 4;
const DEFAULT_GAME_MODE: GameMode = 'normal';
const DEFAULT_MOVE_MODE: MoveMode = 'slide';
const DEFAULT_GROUP_ID: GroupId = 1;
const DEFAULT_GROUP_COUNT = 10;
const MAX_GROUP_NAME_LENGTH = 30;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeGroupName(value: unknown, id: GroupId): string {
  if (typeof value !== 'string') {
    return `G${id}`;
  }

  const name = value.trim().slice(0, MAX_GROUP_NAME_LENGTH);
  return name.length > 0 ? name : `G${id}`;
}

/** 创建默认设置；每次返回新对象，避免调用方共享分组数组。 */
export function createDefaultSettings(): GameSettings {
  const groups: Group[] = Array.from({ length: DEFAULT_GROUP_COUNT }, (_, index) => {
    const id = (index + 1) as GroupId;
    return { id, name: `G${id}` };
  });

  return {
    size: DEFAULT_SIZE,
    gameMode: DEFAULT_GAME_MODE,
    moveMode: DEFAULT_MOVE_MODE,
    groupId: DEFAULT_GROUP_ID,
    groups,
    customCursor: false,
    minimalUi: false,
  };
}

/**
 * 修复设置数据。
 *
 * 设置是用户偏好，单字段损坏不应丢掉整份数据：
 * 非法枚举回退默认值，缺失分组按固定 ID 补齐默认名称。
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
  const groups: Group[] = Array.from({ length: DEFAULT_GROUP_COUNT }, (_, index) => {
    const id = (index + 1) as GroupId;
    const candidate = rawGroups.find(
      (group): group is Record<string, unknown> => isRecord(group) && group.id === id,
    );
    return { id, name: normalizeGroupName(candidate?.name, id) };
  });

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

/**
 * 读取设置；缺失、损坏或 localStorage 不可用时回退默认设置。
 * 写入失败仍抛 DataStoreError，由页面提示用户。
 */
export function loadSettings(storage: StorageAdapter = createLocalStorage()): GameSettings {
  let raw: unknown;
  try {
    raw = readJson(storage, STORAGE_KEYS.settings);
  } catch (error) {
    if (isDataStoreError(error)) {
      return createDefaultSettings();
    }
    throw error;
  }

  if (!isStorageEnvelope(raw) || raw.version !== SCHEMA_VERSION) {
    return createDefaultSettings();
  }
  return normalizeSettings(raw.data);
}

/** 保存设置；写入前再次归一化，避免把非法字段落库。 */
export function saveSettings(
  settings: GameSettings,
  storage: StorageAdapter = createLocalStorage(),
): void {
  writeJson(storage, STORAGE_KEYS.settings, {
    version: SCHEMA_VERSION,
    data: normalizeSettings(settings),
  });
}
