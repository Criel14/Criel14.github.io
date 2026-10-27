import { normalizePreferences } from './store';
import type { SitePreferences } from './types';

/**
 * 比较两份偏好。
 *
 * 先归一化，非法值和未知字段不会造成“看起来改过”的假脏状态；
 * 只比较当前真正会保存到存储的字段。
 */
export function isPreferencesDirty(saved: SitePreferences, draft: SitePreferences): boolean {
  const normalizedSaved = normalizePreferences(saved);
  const normalizedDraft = normalizePreferences(draft);

  return (
    normalizedSaved.themeMode !== normalizedDraft.themeMode ||
    normalizedSaved.language !== normalizedDraft.language ||
    normalizedSaved.timerFont !== normalizedDraft.timerFont ||
    normalizedSaved.largeCursor !== normalizedDraft.largeCursor ||
    normalizedSaved.timerOnlyOnMove !== normalizedDraft.timerOnlyOnMove
  );
}

/** 把草稿恢复到上次保存值；返回新对象，避免页面共享同一份引用。 */
export function resetPreferencesDraft(saved: SitePreferences): SitePreferences {
  return normalizePreferences(saved);
}
