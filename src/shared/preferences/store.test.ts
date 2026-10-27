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

  it('只保留已知字段，忽略未知字段', () => {
    expect(
      normalizePreferences({
        themeMode: 'dark',
        language: 'en',
        timerFont: 'audiowide',
        extra: 'ignored',
      }),
    ).toEqual({ themeMode: 'dark', language: 'en', timerFont: 'audiowide', largeCursor: true });
  });

  it('largeCursor 只接受布尔值，非法值回退默认开启', () => {
    expect(normalizePreferences({ largeCursor: false })).toEqual({
      ...DEFAULT_SITE_PREFERENCES,
      largeCursor: false,
    });
    expect(normalizePreferences({ largeCursor: 'yes' })).toEqual(DEFAULT_SITE_PREFERENCES);
  });

  it('非法枚举逐字段回退默认值', () => {
    expect(normalizePreferences({ themeMode: 'sepia', language: 'en' })).toEqual({
      themeMode: 'light',
      language: 'en',
      timerFont: 'jetbrains-mono',
      largeCursor: true,
    });
    expect(normalizePreferences({ themeMode: 'dark', language: 'fr' })).toEqual({
      themeMode: 'dark',
      language: 'zh-CN',
      timerFont: 'jetbrains-mono',
      largeCursor: true,
    });
    expect(normalizePreferences({ timerFont: 'comic-sans' })).toEqual(DEFAULT_SITE_PREFERENCES);
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

  it('合法信封和全部字段返回 ok', () => {
    const storage = createMemoryStorage();
    writeRaw(storage, {
      version: SITE_PREFERENCES_VERSION,
      data: { themeMode: 'dark', language: 'en', timerFont: 'dseg7-classic', largeCursor: false },
    });

    expect(loadPreferences(storage)).toEqual({
      status: 'ok',
      preferences: {
        themeMode: 'dark',
        language: 'en',
        timerFont: 'dseg7-classic',
        largeCursor: false,
      },
    });
  });

  it('接受阿里巴巴普惠体和 Arial 字体 ID', () => {
    for (const timerFont of ['alibaba-puhuiti', 'arial'] as const) {
      const storage = createMemoryStorage();
      writeRaw(storage, {
        version: SITE_PREFERENCES_VERSION,
        data: { themeMode: 'light', language: 'zh-CN', timerFont },
      });

      expect(loadPreferences(storage)).toEqual({
        status: 'ok',
        preferences: { themeMode: 'light', language: 'zh-CN', timerFont, largeCursor: true },
      });
    }
  });

  it('旧 version 1 数据缺少 timerFont / largeCursor 时仍为 ok，并使用默认值', () => {
    const storage = createMemoryStorage();
    writeRaw(storage, {
      version: SITE_PREFERENCES_VERSION,
      data: { themeMode: 'dark', language: 'en' },
    });

    expect(loadPreferences(storage)).toEqual({
      status: 'ok',
      preferences: {
        themeMode: 'dark',
        language: 'en',
        timerFont: 'jetbrains-mono',
        largeCursor: true,
      },
    });
  });

  it('已移除的 vt323 / verdana / trebuchet-ms 回退默认字体，不标记损坏', () => {
    for (const timerFont of ['vt323', 'verdana', 'trebuchet-ms'] as const) {
      const storage = createMemoryStorage();
      writeRaw(storage, {
        version: SITE_PREFERENCES_VERSION,
        data: { themeMode: 'dark', language: 'en', timerFont },
      });

      expect(loadPreferences(storage)).toEqual({
        status: 'ok',
        preferences: {
          themeMode: 'dark',
          language: 'en',
          timerFont: 'jetbrains-mono',
          largeCursor: true,
        },
      });
    }
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
      preferences: {
        themeMode: 'light',
        language: 'en',
        timerFont: 'jetbrains-mono',
        largeCursor: true,
      },
    });
  });

  it('timerFont 非法时返回 corrupt，并保留其他合法字段', () => {
    const storage = createMemoryStorage();
    writeRaw(storage, {
      version: SITE_PREFERENCES_VERSION,
      data: { themeMode: 'dark', language: 'en', timerFont: 'comic-sans', largeCursor: false },
    });

    expect(loadPreferences(storage)).toEqual({
      status: 'corrupt',
      preferences: {
        themeMode: 'dark',
        language: 'en',
        timerFont: 'jetbrains-mono',
        largeCursor: false,
      },
    });
  });

  it('largeCursor 非法时返回 corrupt，并回退默认开启', () => {
    const storage = createMemoryStorage();
    writeRaw(storage, {
      version: SITE_PREFERENCES_VERSION,
      data: { themeMode: 'dark', language: 'en', largeCursor: 'yes' },
    });

    expect(loadPreferences(storage)).toEqual({
      status: 'corrupt',
      preferences: {
        themeMode: 'dark',
        language: 'en',
        timerFont: 'jetbrains-mono',
        largeCursor: true,
      },
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
    const preferences = {
      themeMode: 'dark',
      language: 'en',
      timerFont: 'press-start-2p',
      largeCursor: false,
    } as const;

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
