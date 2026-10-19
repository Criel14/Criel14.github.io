import { describe, expect, it } from 'vitest';
import type { GameSettings } from '../types';
import { DataStoreError } from './errors';
import { createMemoryStorage, readJson, writeJson } from './local-storage';
import { SCHEMA_VERSION, STORAGE_KEYS } from './schema';
import { createDefaultSettings, loadSettings, saveSettings } from './settings-store';

describe('createDefaultSettings', () => {
  it('返回 4×4、normal、slide、G1 和固定 10 组', () => {
    const settings = createDefaultSettings();

    expect(settings).toMatchObject({
      size: 4,
      gameMode: 'normal',
      moveMode: 'slide',
      groupId: 1,
      customCursor: false,
      minimalUi: false,
    });
    expect(settings.groups).toHaveLength(10);
    expect(settings.groups.map((group) => group.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(settings.groups[0].name).toBe('G1');
  });
});

describe('saveSettings / loadSettings', () => {
  it('保存后读取一致，并写入 v2 信封', () => {
    const storage = createMemoryStorage();
    const settings: GameSettings = {
      ...createDefaultSettings(),
      size: 5,
      gameMode: 'blind',
      moveMode: 'keyboard',
      groupId: 3,
      customCursor: true,
      minimalUi: true,
      groups: createDefaultSettings().groups.map((group, index) =>
        index === 2 ? { ...group, name: '我的分组' } : group,
      ),
    };

    saveSettings(settings, storage);

    expect(loadSettings(storage)).toEqual(settings);
    expect(readJson(storage, STORAGE_KEYS.settings)).toEqual({
      version: SCHEMA_VERSION,
      data: settings,
    });
  });

  it('缺失、损坏或版本不匹配时回退默认设置', () => {
    const storage = createMemoryStorage();
    expect(loadSettings(storage)).toEqual(createDefaultSettings());

    storage.set(STORAGE_KEYS.settings, 'not-json');
    expect(loadSettings(storage)).toEqual(createDefaultSettings());

    writeJson(storage, STORAGE_KEYS.settings, {
      version: SCHEMA_VERSION + 1,
      data: { size: 9 },
    });
    expect(loadSettings(storage)).toEqual(createDefaultSettings());
  });

  it('保留合法字段，修复缺失/非法字段和分组名称', () => {
    const storage = createMemoryStorage();
    writeJson(storage, STORAGE_KEYS.settings, {
      version: SCHEMA_VERSION,
      data: {
        size: 99,
        gameMode: 'other',
        moveMode: 'other',
        groupId: 0,
        groups: [
          { id: 1, name: '  Renamed  ' },
          { id: 2, name: 'x'.repeat(40) },
        ],
        customCursor: 'yes',
        minimalUi: 1,
      },
    });

    const settings = loadSettings(storage);

    expect(settings).toMatchObject({
      size: 4,
      gameMode: 'normal',
      moveMode: 'slide',
      groupId: 1,
      customCursor: false,
      minimalUi: false,
    });
    expect(settings.groups[0].name).toBe('Renamed');
    expect(settings.groups[1].name).toBe('x'.repeat(30));
    expect(settings.groups[2].name).toBe('G3');
    expect(settings.groups).toHaveLength(10);
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

    expect(loadSettings(storage)).toEqual(createDefaultSettings());
  });
});
