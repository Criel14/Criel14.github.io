import { createLocalStorage, type StorageAdapter } from './local-storage';

/** 旧版拼图的 localStorage 键；新实现只清理，不读取。 */
export const LEGACY_KEYS = ['config', 'scores', 'currentScore', 'currentScoreList'] as const;

/** 是否存在旧版拼图数据。 */
export function hasLegacyData(storage: StorageAdapter = createLocalStorage()): boolean {
  const keys = new Set(storage.keys());
  return LEGACY_KEYS.some((key) => keys.has(key));
}

/**
 * 清理旧版拼图数据。
 *
 * 不自动调用；由设置页“维护”入口或开发时手动触发。
 * 只删除旧键，不影响 puzzle.v2.settings / puzzle.v2.appearance 和 IndexedDB。
 */
export function clearLegacyData(storage: StorageAdapter = createLocalStorage()): void {
  for (const key of LEGACY_KEYS) {
    storage.remove(key);
  }
}
