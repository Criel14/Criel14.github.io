import type { GameMode, GameSettings, Group, GroupId, MoveMode } from '../types';
import { isPuzzleSize } from '../core/board';
import { isGroupId } from '../core/groups';
import {
  createLocalStorage,
  readJsonResult,
  writeJson,
  type StorageAdapter,
  type StorageReadStatus,
} from './local-storage';
import { isGameSettings, isStorageEnvelope, SCHEMA_VERSION, STORAGE_KEYS } from './schema';

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

  if (!isStorageEnvelope(result.value) || result.value.version !== SCHEMA_VERSION) {
    return { status: 'corrupt', settings: createDefaultSettings() };
  }

  return {
    status: isGameSettings(result.value.data) ? 'ok' : 'corrupt',
    settings: normalizeSettings(result.value.data),
  };
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
