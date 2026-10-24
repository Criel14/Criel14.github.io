import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS_SECTION,
  SETTINGS_SECTIONS,
  resolveSettingsSection,
} from './settings-sections';

describe('settings section registry', () => {
  it('按显示设置、游戏、更多排列四个分类', () => {
    expect(SETTINGS_SECTIONS.map((section) => section.id)).toEqual([
      'appearance',
      'language',
      'game-theme',
      'about',
    ]);
  });
});

describe('resolveSettingsSection', () => {
  it('合法 hash 返回对应分类', () => {
    expect(resolveSettingsSection('#appearance').id).toBe('appearance');
    expect(resolveSettingsSection('#language').id).toBe('language');
    expect(resolveSettingsSection('#game-theme').id).toBe('game-theme');
    expect(resolveSettingsSection('#about').id).toBe('about');
  });

  it('允许不带 # 并忽略大小写和首尾空白', () => {
    expect(resolveSettingsSection('language').id).toBe('language');
    expect(resolveSettingsSection('#LANGUAGE').id).toBe('language');
    expect(resolveSettingsSection('  #Language  ').id).toBe('language');
  });

  it('空值、单独 # 和未知 hash 回退外观', () => {
    expect(resolveSettingsSection('').id).toBe(DEFAULT_SETTINGS_SECTION);
    expect(resolveSettingsSection('#').id).toBe(DEFAULT_SETTINGS_SECTION);
    expect(resolveSettingsSection('#removed-section').id).toBe(DEFAULT_SETTINGS_SECTION);
  });
});
