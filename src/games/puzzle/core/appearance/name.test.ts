import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THEME_NAME,
  getThemeNameError,
  getThemeNameWidth,
  normalizeThemeName,
  THEME_NAME_MAX_WIDTH,
} from './name';

describe('getThemeNameWidth', () => {
  it('汉字和全角标点按 2 计', () => {
    expect(getThemeNameWidth('新主题')).toBe(6);
    expect(getThemeNameWidth('新的主题')).toBe(8);
    expect(getThemeNameWidth('，。！？')).toBe(8);
  });

  it('英文、数字和半角空格按 1 计', () => {
    expect(getThemeNameWidth('Theme 01')).toBe(8);
    expect(getThemeNameWidth('abcdefghijklmnopqrst')).toBe(20);
  });

  it('中英文混排按实际显示宽度计算', () => {
    expect(getThemeNameWidth('中文ab')).toBe(6);
    expect(getThemeNameWidth('a中b')).toBe(4);
  });

  it('emoji 和 ZWJ 序列整体按 2 计', () => {
    expect(getThemeNameWidth('😀')).toBe(2);
    expect(getThemeNameWidth('👨‍👩‍👧‍👦')).toBe(2);
    expect(getThemeNameWidth('🇨🇳')).toBe(2);
    expect(getThemeNameWidth('©️')).toBe(2);
    expect(getThemeNameWidth('1️⃣')).toBe(2);
  });

  it('组合附加符不额外占宽', () => {
    expect(getThemeNameWidth('e\u0301')).toBe(1);
    expect(getThemeNameWidth('a\u0301b')).toBe(2);
  });

  it('空字符串宽度为 0', () => {
    expect(getThemeNameWidth('')).toBe(0);
  });
});

describe('getThemeNameError', () => {
  it('空名称返回错误', () => {
    expect(getThemeNameError('')).not.toBeNull();
    expect(getThemeNameError('   ')).not.toBeNull();
  });

  it('边界宽度可以通过', () => {
    expect(getThemeNameError('十个汉字正好二十宽度')).toBeNull();
    expect(getThemeNameError('a'.repeat(THEME_NAME_MAX_WIDTH))).toBeNull();
  });

  it('超过 20 显示宽度返回错误', () => {
    expect(getThemeNameError('十个汉字正好二十宽度啊')).not.toBeNull();
    expect(getThemeNameError('a'.repeat(THEME_NAME_MAX_WIDTH + 1))).not.toBeNull();
  });

  it('首尾空格不计入宽度', () => {
    expect(getThemeNameError(`  ${'a'.repeat(THEME_NAME_MAX_WIDTH)}  `)).toBeNull();
  });
});

describe('normalizeThemeName', () => {
  it('只去掉首尾空格', () => {
    expect(normalizeThemeName('  我的 主题  ')).toBe('我的 主题');
  });

  it('默认名称固定为“新的主题”', () => {
    expect(DEFAULT_THEME_NAME).toBe('新的主题');
    expect(getThemeNameError(DEFAULT_THEME_NAME)).toBeNull();
  });
});
