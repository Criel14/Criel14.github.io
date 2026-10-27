import { describe, expect, it } from 'vitest';
import { applyPreferences } from './apply';
import type { SitePreferences } from './types';

interface FakeRoot {
  dataset: Record<string, string>;
}

function createRoot(): FakeRoot {
  return { dataset: {} };
}

function apply(preferences: SitePreferences, root: FakeRoot): void {
  applyPreferences(preferences, root as unknown as HTMLElement);
}

describe('applyPreferences', () => {
  it('把 light、en、计时器字体、大光标和极简计时写入 dataset', () => {
    const root = createRoot();

    apply(
      {
        themeMode: 'light',
        language: 'en',
        timerFont: 'audiowide',
        largeCursor: true,
        timerOnlyOnMove: true,
      },
      root,
    );

    expect(root.dataset).toEqual({
      theme: 'light',
      language: 'en',
      timerFont: 'audiowide',
      gameCursor: 'large',
      timerOnlyOnMove: 'true',
    });
  });

  it('system 暂按 light 处理，dark 写入 dark', () => {
    const root = createRoot();

    apply(
      {
        themeMode: 'system',
        language: 'zh-CN',
        timerFont: 'jetbrains-mono',
        largeCursor: true,
        timerOnlyOnMove: false,
      },
      root,
    );
    expect(root.dataset).toEqual({
      theme: 'light',
      language: 'zh-CN',
      timerFont: 'jetbrains-mono',
      gameCursor: 'large',
      timerOnlyOnMove: 'false',
    });

    apply(
      {
        themeMode: 'dark',
        language: 'zh-CN',
        timerFont: 'jetbrains-mono',
        largeCursor: true,
        timerOnlyOnMove: false,
      },
      root,
    );
    expect(root.dataset).toEqual({
      theme: 'dark',
      language: 'zh-CN',
      timerFont: 'jetbrains-mono',
      gameCursor: 'large',
      timerOnlyOnMove: 'false',
    });
  });

  it('关闭大光标和极简计时时写入 default / false', () => {
    const root = createRoot();

    apply(
      {
        themeMode: 'light',
        language: 'zh-CN',
        timerFont: 'jetbrains-mono',
        largeCursor: false,
        timerOnlyOnMove: false,
      },
      root,
    );

    expect(root.dataset.gameCursor).toBe('default');
    expect(root.dataset.timerOnlyOnMove).toBe('false');
  });

  it('应用前归一化非法字段', () => {
    const root = createRoot();

    apply(
      {
        themeMode: 'sepia',
        language: 'fr',
        timerFont: 'comic-sans',
        largeCursor: 'yes',
        timerOnlyOnMove: 'yes',
      } as unknown as SitePreferences,
      root,
    );

    expect(root.dataset).toEqual({
      theme: 'light',
      language: 'zh-CN',
      timerFont: 'jetbrains-mono',
      gameCursor: 'large',
      timerOnlyOnMove: 'false',
    });
  });
});
