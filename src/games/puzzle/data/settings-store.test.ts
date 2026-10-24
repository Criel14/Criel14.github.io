import { describe, expect, it } from 'vitest';
import type { GameSettings } from '../types';
import { GROUP_COUNT } from '../core/groups';
import { DataStoreError } from './errors';
import { createMemoryStorage, readJsonResult, writeJson } from './local-storage';
import { SETTINGS_SCHEMA_VERSION, STORAGE_KEYS } from './schema';
import {
  createDefaultSettings,
  ensureSettingsResult,
  loadSettingsResult,
  saveSettings,
} from './settings-store';

function renameGroup(
  settings: GameSettings,
  size: GameSettings['size'],
  gameMode: GameSettings['gameMode'],
  id: GameSettings['groupId'],
  name: string,
): GameSettings {
  return {
    ...settings,
    groups: settings.groups.map((group) =>
      group.size === size && group.gameMode === gameMode && group.id === id
        ? { ...group, name }
        : group,
    ),
  };
}

describe('createDefaultSettings', () => {
  it('返回 4×4、normal、slide、分组1 和 90 个分组', () => {
    const settings = createDefaultSettings();

    expect(settings).toMatchObject({
      size: 4,
      gameMode: 'normal',
      moveMode: 'slide',
      groupId: 1,
      customCursor: false,
      minimalUi: false,
    });
    expect(settings.groups).toHaveLength(GROUP_COUNT);
    expect(settings.groups[0]).toEqual({ size: 2, gameMode: 'normal', id: 1, name: '分组1' });
    expect(settings.groups.at(-1)).toEqual({
      size: 10,
      gameMode: 'blind',
      id: 5,
      name: '分组5',
    });
  });
});

describe('saveSettings / loadSettingsResult', () => {
  it('保存后读取一致，并写入 v3 信封', () => {
    const storage = createMemoryStorage();
    const base = createDefaultSettings();
    const settings: GameSettings = {
      ...renameGroup(base, 3, 'normal', 3, '我的分组'),
      size: 5,
      gameMode: 'blind',
      moveMode: 'keyboard',
      groupId: 3,
      customCursor: true,
      minimalUi: true,
    };

    saveSettings(settings, storage);

    expect(loadSettingsResult(storage)).toEqual({ status: 'ok', settings });
    expect(readJsonResult(storage, STORAGE_KEYS.settings)).toEqual({
      status: 'ok',
      value: {
        version: SETTINGS_SCHEMA_VERSION,
        data: settings,
      },
    });
  });

  it('区分缺失、损坏和版本不匹配，并回退默认设置', () => {
    const storage = createMemoryStorage();
    expect(loadSettingsResult(storage)).toEqual({
      status: 'missing',
      settings: createDefaultSettings(),
    });

    storage.set(STORAGE_KEYS.settings, 'not-json');
    expect(loadSettingsResult(storage)).toEqual({
      status: 'corrupt',
      settings: createDefaultSettings(),
    });

    writeJson(storage, STORAGE_KEYS.settings, {
      version: SETTINGS_SCHEMA_VERSION + 1,
      data: { size: 9 },
    });
    expect(loadSettingsResult(storage)).toEqual({
      status: 'corrupt',
      settings: createDefaultSettings(),
    });
  });

  it('保留合法字段，按事件修复缺失/非法分组', () => {
    const storage = createMemoryStorage();
    writeJson(storage, STORAGE_KEYS.settings, {
      version: SETTINGS_SCHEMA_VERSION,
      data: {
        size: 99,
        gameMode: 'other',
        moveMode: 'other',
        groupId: 0,
        groups: [
          { size: 3, gameMode: 'normal', id: 1, name: '  Renamed  ' },
          { size: 3, gameMode: 'normal', id: 2, name: 'x'.repeat(40) },
          { size: 3, gameMode: 'normal', id: 9, name: '非法槽位' },
          { size: 3, gameMode: 'normal', id: 1, name: '重复记录' },
        ],
        customCursor: 'yes',
        minimalUi: 1,
      },
    });

    const result = loadSettingsResult(storage);
    const settings = result.settings;

    expect(result.status).toBe('corrupt');
    expect(settings).toMatchObject({
      size: 4,
      gameMode: 'normal',
      moveMode: 'slide',
      groupId: 1,
      customCursor: false,
      minimalUi: false,
    });
    expect(settings.groups).toHaveLength(GROUP_COUNT);
    expect(
      settings.groups.find(
        (group) => group.size === 3 && group.gameMode === 'normal' && group.id === 1,
      )?.name,
    ).toBe('Renamed');
    expect(
      settings.groups.find(
        (group) => group.size === 3 && group.gameMode === 'normal' && group.id === 2,
      )?.name,
    ).toBe('x'.repeat(30));
    expect(
      settings.groups.find(
        (group) => group.size === 3 && group.gameMode === 'normal' && group.id === 3,
      )?.name,
    ).toBe('分组3');
  });

  it('不迁移旧版全局 10 组数据', () => {
    const storage = createMemoryStorage();
    writeJson(storage, STORAGE_KEYS.settings, {
      version: SETTINGS_SCHEMA_VERSION,
      data: {
        ...createDefaultSettings(),
        groups: Array.from({ length: 10 }, (_, index) => ({
          id: index + 1,
          name: `G${index + 1}`,
        })),
      },
    });

    const result = loadSettingsResult(storage);

    expect(result.status).toBe('corrupt');
    expect(result.settings.groups).toHaveLength(GROUP_COUNT);
    expect(result.settings.groups[0].name).toBe('分组1');
  });

  it('localStorage 读取不可用时回退默认设置', () => {
    const storage = {
      get: () => {
        throw new DataStoreError('unavailable', '不可用');
      },
      set: () => undefined,
      remove: () => undefined,
      keys: () => [],
    };

    expect(loadSettingsResult(storage)).toEqual({
      status: 'unavailable',
      settings: createDefaultSettings(),
    });
  });
});

describe('ensureSettingsResult', () => {
  it('首次缺失时写入默认设置，第二次读取为 ok', () => {
    const storage = createMemoryStorage();

    expect(ensureSettingsResult(storage)).toEqual({
      status: 'ok',
      settings: createDefaultSettings(),
    });
    expect(readJsonResult(storage, STORAGE_KEYS.settings)).toEqual({
      status: 'ok',
      value: {
        version: SETTINGS_SCHEMA_VERSION,
        data: createDefaultSettings(),
      },
    });
    expect(ensureSettingsResult(storage)).toEqual({
      status: 'ok',
      settings: createDefaultSettings(),
    });
  });

  it('损坏数据不自动覆盖', () => {
    const storage = createMemoryStorage();
    storage.set(STORAGE_KEYS.settings, 'not-json');

    expect(ensureSettingsResult(storage).status).toBe('corrupt');
    expect(storage.get(STORAGE_KEYS.settings)).toBe('not-json');
  });
});
