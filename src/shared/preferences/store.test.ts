import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SITE_PREFERENCES,
  SITE_PREFERENCES_STORAGE_KEY,
  SITE_PREFERENCES_VERSION,
  type SitePreferences,
} from './types';
import {
  PreferencesStoreError,
  loadPreferences,
  normalizePreferences,
  savePreferences,
  type PreferencesStorage,
} from './store';

interface MemoryStorage extends PreferencesStorage {
  read(key: string): string | null;
  has(key: string): boolean;
}

function createMemoryStorage(initial: Readonly<Record<string, string>> = {}): MemoryStorage {
  const values = new Map<string, string>(Object.entries(initial));

  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    read(key) {
      return values.get(key) ?? null;
    },
    has(key) {
      return values.has(key);
    },
  };
}

function writeRaw(storage: MemoryStorage, value: unknown): void {
  storage.setItem(SITE_PREFERENCES_STORAGE_KEY, JSON.stringify(value));
}

describe('normalizePreferences', () => {
  it('非对象和缺失字段回退默认值', () => {
    expect(normalizePreferences(null)).toEqual(DEFAULT_SITE_PREFERENCES);
    expect(normalizePreferences({})).toEqual(DEFAULT_SITE_PREFERENCES);
  });

  it('只保留 themeMode 和 language，忽略未知字段', () => {
    expect(
      normalizePreferences({
        themeMode: 'dark',
        language: 'en',
        extra: 'ignored',
      }),
    ).toEqual({ themeMode: 'dark', language: 'en' });
  });

  it('非法枚举逐字段回退默认值', () => {
    expect(normalizePreferences({ themeMode: 'sepia', language: 'en' })).toEqual({
      themeMode: 'light',
      language: 'en',
    });
    expect(normalizePreferences({ themeMode: 'dark', language: 'fr' })).toEqual({
      themeMode: 'dark',
      language: 'zh-CN',
    });
  });
});

describe('loadPreferences', () => {
  it('缺失 key 返回 missing 和默认值，且不自动写入', () => {
    const storage = createMemoryStorage();

    expect(loadPreferences(storage)).toEqual({
      status: 'missing',
      preferences: DEFAULT_SITE_PREFERENCES,
    });
    expect(storage.has(SITE_PREFERENCES_STORAGE_KEY)).toBe(false);
  });

  it('合法信封和字段返回 ok', () => {
    const storage = createMemoryStorage();
    writeRaw(storage, {
      version: SITE_PREFERENCES_VERSION,
      data: { themeMode: 'dark', language: 'en' },
    });

    expect(loadPreferences(storage)).toEqual({
      status: 'ok',
      preferences: { themeMode: 'dark', language: 'en' },
    });
  });

  it('JSON 损坏返回 corrupt 和默认值', () => {
    const storage = createMemoryStorage();
    storage.setItem(SITE_PREFERENCES_STORAGE_KEY, 'not-json');

    expect(loadPreferences(storage)).toEqual({
      status: 'corrupt',
      preferences: DEFAULT_SITE_PREFERENCES,
    });
  });

  it('信封版本不匹配返回 corrupt', () => {
    const storage = createMemoryStorage();
    writeRaw(storage, {
      version: SITE_PREFERENCES_VERSION + 1,
      data: { themeMode: 'light', language: 'zh-CN' },
    });

    expect(loadPreferences(storage)).toEqual({
      status: 'corrupt',
      preferences: DEFAULT_SITE_PREFERENCES,
    });
  });

  it('data 不是对象返回 corrupt', () => {
    const storage = createMemoryStorage();
    writeRaw(storage, { version: SITE_PREFERENCES_VERSION, data: 'invalid' });

    expect(loadPreferences(storage)).toEqual({
      status: 'corrupt',
      preferences: DEFAULT_SITE_PREFERENCES,
    });
  });

  it('字段损坏时保留可恢复字段并返回 corrupt', () => {
    const storage = createMemoryStorage();
    writeRaw(storage, {
      version: SITE_PREFERENCES_VERSION,
      data: { themeMode: 'sepia', language: 'en' },
    });

    expect(loadPreferences(storage)).toEqual({
      status: 'corrupt',
      preferences: { themeMode: 'light', language: 'en' },
    });
  });

  it('未知字段不影响状态', () => {
    const storage = createMemoryStorage();
    writeRaw(storage, {
      version: SITE_PREFERENCES_VERSION,
      data: { themeMode: 'light', language: 'zh-CN', extra: true },
    });

    expect(loadPreferences(storage)).toEqual({
      status: 'ok',
      preferences: DEFAULT_SITE_PREFERENCES,
    });
  });

  it('读取异常返回 unavailable 和默认值', () => {
    const storage: PreferencesStorage = {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        // 本用例不写入。
      },
    };

    expect(loadPreferences(storage)).toEqual({
      status: 'unavailable',
      preferences: DEFAULT_SITE_PREFERENCES,
    });
  });
});

describe('savePreferences', () => {
  it('写入 version 1 信封，并可往返读取', () => {
    const storage = createMemoryStorage();
    const preferences = { themeMode: 'dark', language: 'en' } as const;

    savePreferences(preferences, storage);

    const raw = storage.read(SITE_PREFERENCES_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toEqual({
      version: SITE_PREFERENCES_VERSION,
      data: preferences,
    });
    expect(loadPreferences(storage)).toEqual({
      status: 'ok',
      preferences,
    });
  });

  it('保存前归一化非法字段', () => {
    const storage = createMemoryStorage();

    savePreferences({ themeMode: 'sepia', language: 'fr' } as unknown as SitePreferences, storage);

    expect(loadPreferences(storage)).toEqual({
      status: 'ok',
      preferences: DEFAULT_SITE_PREFERENCES,
    });
  });

  it('写入异常转换为带 code 的 PreferencesStoreError', () => {
    const quotaError = new Error('quota');
    quotaError.name = 'QuotaExceededError';
    const storage: PreferencesStorage = {
      getItem() {
        return null;
      },
      setItem() {
        throw quotaError;
      },
    };

    try {
      savePreferences(DEFAULT_SITE_PREFERENCES, storage);
      expect.fail('应当抛出存储错误');
    } catch (error) {
      expect(error).toBeInstanceOf(PreferencesStoreError);
      expect((error as PreferencesStoreError).code).toBe('quota');
    }
  });

  it('普通写入异常按 unavailable 处理', () => {
    const storage: PreferencesStorage = {
      getItem() {
        return null;
      },
      setItem() {
        throw new Error('blocked');
      },
    };

    try {
      savePreferences(DEFAULT_SITE_PREFERENCES, storage);
      expect.fail('应当抛出存储错误');
    } catch (error) {
      expect(error).toBeInstanceOf(PreferencesStoreError);
      expect((error as PreferencesStoreError).code).toBe('unavailable');
    }
  });
});
