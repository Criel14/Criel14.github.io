import {
  DEFAULT_SITE_PREFERENCES,
  SITE_PREFERENCES_STORAGE_KEY,
  SITE_PREFERENCES_VERSION,
  isSiteLanguage,
  isThemeMode,
  isTimerFontId,
  type SitePreferences,
} from './types';

/** 读取偏好时保留状态，页面据此决定是否显示存储警告。 */
export type PreferencesReadStatus = 'ok' | 'missing' | 'corrupt' | 'unavailable';

export interface PreferencesLoadResult {
  readonly status: PreferencesReadStatus;
  readonly preferences: SitePreferences;
}

/** 偏好的最小存储接口；测试注入内存实现，不依赖真实 localStorage。 */
export interface PreferencesStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type PreferencesErrorCode = 'unavailable' | 'quota' | 'unknown';

/** 偏好写入失败；页面只负责展示，不直接处理浏览器存储异常。 */
export class PreferencesStoreError extends Error {
  readonly code: PreferencesErrorCode;

  constructor(code: PreferencesErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'PreferencesStoreError';
    this.code = code;
  }
}

interface StoredPreferencesEnvelope {
  readonly version: number;
  readonly data: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isEnvelope(value: unknown): value is StoredPreferencesEnvelope {
  return isRecord(value) && typeof value.version === 'number' && 'data' in value;
}

function createDefaultPreferences(): SitePreferences {
  return { ...DEFAULT_SITE_PREFERENCES };
}

function toPreferencesStoreError(error: unknown): PreferencesStoreError {
  if (error instanceof PreferencesStoreError) {
    return error;
  }

  const name =
    typeof error === 'object' && error !== null && 'name' in error && typeof error.name === 'string'
      ? error.name
      : '';
  // 不同浏览器的配额错误名称不完全一致；其余异常统一按存储不可用处理。
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') {
    return new PreferencesStoreError('quota', '浏览器存储空间不足，无法保存设置', {
      cause: error,
    });
  }

  return new PreferencesStoreError('unavailable', '浏览器存储不可用，无法保存设置', {
    cause: error,
  });
}

/**
 * 归一化偏好。
 *
 * - 只接受约定的枚举值，非法或缺失字段回退默认值；
 * - timerFont 缺失时回退默认字体，兼容新增字段前的 version 1 数据；
 * - 未知字段直接忽略，避免旧版本或未来字段污染当前数据；
 * - 返回新对象，调用方不能通过共享引用改动默认值。
 */
export function normalizePreferences(raw: unknown): SitePreferences {
  const record = isRecord(raw) ? raw : {};

  return {
    themeMode: isThemeMode(record.themeMode)
      ? record.themeMode
      : DEFAULT_SITE_PREFERENCES.themeMode,
    language: isSiteLanguage(record.language) ? record.language : DEFAULT_SITE_PREFERENCES.language,
    timerFont: isTimerFontId(record.timerFont)
      ? record.timerFont
      : DEFAULT_SITE_PREFERENCES.timerFont,
  };
}

/** 包装真实 localStorage；访问异常由 load / save 统一转换。 */
export function createBrowserPreferencesStorage(): PreferencesStorage {
  return {
    getItem(key) {
      return globalThis.localStorage.getItem(key);
    },
    setItem(key, value) {
      globalThis.localStorage.setItem(key, value);
    },
  };
}

/**
 * 读取全站偏好。
 *
 * 状态规则：
 * - missing：没有写过偏好，静默使用默认值；
 * - corrupt：JSON、信封或字段损坏，使用归一化结果并让页面提示；
 * - unavailable：浏览器存储不可用，使用默认值并提示；
 * - ok：信封和三个字段都合法；旧数据缺少 timerFont 也视为合法。
 *
 * 字段级损坏时仍保留合法字段，避免一个错误值丢掉另一项可恢复的偏好。
 */
export function loadPreferences(
  storage: PreferencesStorage = createBrowserPreferencesStorage(),
): PreferencesLoadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(SITE_PREFERENCES_STORAGE_KEY);
  } catch {
    return { status: 'unavailable', preferences: createDefaultPreferences() };
  }

  if (raw === null) {
    return { status: 'missing', preferences: createDefaultPreferences() };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { status: 'corrupt', preferences: createDefaultPreferences() };
  }

  if (!isEnvelope(parsed) || parsed.version !== SITE_PREFERENCES_VERSION) {
    return { status: 'corrupt', preferences: createDefaultPreferences() };
  }

  if (!isRecord(parsed.data)) {
    return { status: 'corrupt', preferences: createDefaultPreferences() };
  }

  const data = parsed.data;
  const preferences = normalizePreferences(data);
  /*
   * timerFont 是 version 1 内新增的向后兼容字段：旧数据没有这个键时
   * 按默认字体处理，不应把整份偏好标记为损坏；字段存在但非法时才报
   * corrupt，并保留同一条数据里合法的 themeMode / language。
   * VT323 已从可选字体中移除，历史值 'vt323' 同样按默认字体静默回退。
   */
  const timerFontValid =
    data.timerFont === undefined || data.timerFont === 'vt323' || isTimerFontId(data.timerFont);
  const valid = isThemeMode(data.themeMode) && isSiteLanguage(data.language) && timerFontValid;

  return {
    status: valid ? 'ok' : 'corrupt',
    preferences,
  };
}

/** 保存偏好；写入前再次归一化，避免把非法字段落库。 */
export function savePreferences(
  preferences: SitePreferences,
  storage: PreferencesStorage = createBrowserPreferencesStorage(),
): void {
  const normalized = normalizePreferences(preferences);

  try {
    storage.setItem(
      SITE_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        version: SITE_PREFERENCES_VERSION,
        data: normalized,
      }),
    );
  } catch (error) {
    throw toPreferencesStoreError(error);
  }
}
