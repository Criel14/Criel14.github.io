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
  it('把 light 和 en 写入 dataset', () => {
    const root = createRoot();

    apply({ themeMode: 'light', language: 'en' }, root);

    expect(root.dataset).toEqual({ theme: 'light', language: 'en' });
  });

  it('system 暂按 light 处理，dark 写入 dark', () => {
    const root = createRoot();

    apply({ themeMode: 'system', language: 'zh-CN' }, root);
    expect(root.dataset).toEqual({ theme: 'light', language: 'zh-CN' });

    apply({ themeMode: 'dark', language: 'zh-CN' }, root);
    expect(root.dataset).toEqual({ theme: 'dark', language: 'zh-CN' });
  });

  it('应用前归一化非法字段', () => {
    const root = createRoot();

    apply({ themeMode: 'sepia', language: 'fr' } as unknown as SitePreferences, root);

    expect(root.dataset).toEqual({ theme: 'light', language: 'zh-CN' });
  });
});
