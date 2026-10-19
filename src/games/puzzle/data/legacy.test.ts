import { describe, expect, it } from 'vitest';
import { createMemoryStorage } from './local-storage';
import { clearLegacyData, hasLegacyData, LEGACY_KEYS } from './legacy';

describe('hasLegacyData / clearLegacyData', () => {
  it('检测任意旧键', () => {
    for (const key of LEGACY_KEYS) {
      const storage = createMemoryStorage({ [key]: 'legacy' });
      expect(hasLegacyData(storage)).toBe(true);
    }

    expect(hasLegacyData(createMemoryStorage())).toBe(false);
  });

  it('只清理旧键，不影响新设置、新外观和其他键', () => {
    const storage = createMemoryStorage({
      config: '{}',
      scores: '[]',
      currentScore: 'id',
      currentScoreList: '[]',
      'puzzle.v2.settings': '{"version":2}',
      'puzzle.v2.appearance': '{"version":2}',
      unrelated: 'keep',
    });

    clearLegacyData(storage);

    for (const key of LEGACY_KEYS) {
      expect(storage.get(key)).toBeNull();
    }
    expect(storage.get('puzzle.v2.settings')).toBe('{"version":2}');
    expect(storage.get('puzzle.v2.appearance')).toBe('{"version":2}');
    expect(storage.get('unrelated')).toBe('keep');
    expect(hasLegacyData(storage)).toBe(false);
  });

  it('重复清理保持幂等', () => {
    const storage = createMemoryStorage({ config: '{}' });

    clearLegacyData(storage);
    clearLegacyData(storage);

    expect(storage.keys()).toEqual([]);
  });
});
