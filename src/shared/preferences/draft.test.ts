import { describe, expect, it } from 'vitest';
import { isPreferencesDirty, resetPreferencesDraft } from './draft';
import { DEFAULT_SITE_PREFERENCES, type SitePreferences } from './types';

describe('isPreferencesDirty', () => {
  it('相同偏好返回 false', () => {
    expect(isPreferencesDirty(DEFAULT_SITE_PREFERENCES, DEFAULT_SITE_PREFERENCES)).toBe(false);
  });

  it('themeMode 不同返回 true', () => {
    expect(
      isPreferencesDirty(DEFAULT_SITE_PREFERENCES, {
        ...DEFAULT_SITE_PREFERENCES,
        themeMode: 'dark',
      }),
    ).toBe(true);
  });

  it('language 不同返回 true', () => {
    expect(
      isPreferencesDirty(DEFAULT_SITE_PREFERENCES, {
        ...DEFAULT_SITE_PREFERENCES,
        language: 'en',
      }),
    ).toBe(true);
  });

  it('timerFont 不同返回 true', () => {
    expect(
      isPreferencesDirty(DEFAULT_SITE_PREFERENCES, {
        ...DEFAULT_SITE_PREFERENCES,
        timerFont: 'audiowide',
      }),
    ).toBe(true);
  });

  it('largeCursor 不同返回 true', () => {
    expect(
      isPreferencesDirty(DEFAULT_SITE_PREFERENCES, {
        ...DEFAULT_SITE_PREFERENCES,
        largeCursor: false,
      }),
    ).toBe(true);
  });

  it('timerOnlyOnMove 不同返回 true', () => {
    expect(
      isPreferencesDirty(DEFAULT_SITE_PREFERENCES, {
        ...DEFAULT_SITE_PREFERENCES,
        timerOnlyOnMove: true,
      }),
    ).toBe(true);
  });

  it('归一化后比较，未知字段不会造成假脏状态', () => {
    const saved = { ...DEFAULT_SITE_PREFERENCES } as SitePreferences;
    const draft = {
      ...DEFAULT_SITE_PREFERENCES,
      extra: 'ignored',
    } as unknown as SitePreferences;

    expect(isPreferencesDirty(saved, draft)).toBe(false);
  });
});

describe('resetPreferencesDraft', () => {
  it('恢复上次保存值，并返回新对象', () => {
    const saved: SitePreferences = {
      themeMode: 'dark',
      language: 'en',
      timerFont: 'audiowide',
      largeCursor: false,
      timerOnlyOnMove: true,
    };

    const draft = resetPreferencesDraft(saved);

    expect(draft).toEqual(saved);
    expect(draft).not.toBe(saved);
    expect(isPreferencesDirty(saved, draft)).toBe(false);
  });
});
