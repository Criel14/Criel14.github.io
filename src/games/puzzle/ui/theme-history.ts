import type { Theme } from '../types';
import { isThemeEqual } from '../core/appearance/appearance';
import { cloneTheme } from '../core/appearance/theme';

/** 撤销/重做共用的快照上限；任意时刻总快照数不超过这个值。 */
export const THEME_HISTORY_LIMIT = 50;

/** 连续输入合并窗口；名称输入、滑杆和颜色选择器共用。 */
export const THEME_HISTORY_MERGE_WINDOW_MS = 600;

export interface ThemeHistoryCommitOptions {
  /**
   * 连续操作标识。相同标识在合并窗口内只保留一个快照，例如连续输入名称或
   * 拖动同一个滑杆。不传表示独立步骤。
   */
  readonly mergeKey?: string;
  /** 注入当前时间，便于单元测试；缺省使用 Date.now()。 */
  readonly now?: number;
}

export interface ThemeHistory {
  /** 当前快照的深拷贝；调用方修改它不会污染历史。 */
  current(): Theme;
  canUndo(): boolean;
  canRedo(): boolean;
  /** 提交新状态；与实际当前状态相同则返回 false，不产生历史。 */
  commit(theme: Theme, options?: ThemeHistoryCommitOptions): boolean;
  /** 撤销并返回目标快照；没有可撤销项时返回 null。 */
  undo(): Theme | null;
  /** 重做并返回目标快照；没有可重做项时返回 null。 */
  redo(): Theme | null;
  /** 结束当前连续操作；下一次输入即使还在 600ms 内也会产生新步骤。 */
  breakMerge(): void;
  /** 保存成功等场景下替换当前快照，不增加或删除历史步骤。 */
  replaceCurrent(theme: Theme): void;
  /** 当前历史快照总数，用于测试上限；不暴露内部数组。 */
  size(): number;
}

interface HistoryEntry {
  theme: Theme;
  /** null 表示离散步骤，不参与后续合并。 */
  mergeKey: string | null;
  committedAt: number;
}

/**
 * 创建主题快照历史。
 *
 * 使用线性快照数组而不是两个独立栈：撤销/重做共用同一批快照，任意时刻总量
 * 都不会超过 limit。新修改发生在撤销之后时截断 redo，符合常见编辑器的直觉。
 * 这里不碰 DOM、不读写存储，所有快照都是 Theme 深拷贝。
 */
export function createThemeHistory(
  initial: Theme,
  limit: number = THEME_HISTORY_LIMIT,
): ThemeHistory {
  const requested = Number.isFinite(limit) ? Math.floor(limit) : THEME_HISTORY_LIMIT;
  const capacity = Math.max(2, requested);
  let entries: HistoryEntry[] = [{ theme: cloneTheme(initial), mergeKey: null, committedAt: 0 }];
  let index = 0;

  function truncateRedo(): void {
    if (index < entries.length - 1) {
      entries = entries.slice(0, index + 1);
    }
  }

  function push(theme: Theme, mergeKey: string | null, now: number): void {
    truncateRedo();
    entries.push({ theme: cloneTheme(theme), mergeKey, committedAt: now });

    if (entries.length > capacity) {
      const overflow = entries.length - capacity;
      entries = entries.slice(overflow);
      index = Math.max(0, index - overflow);
    }
    index = entries.length - 1;
  }

  function commit(theme: Theme, options: ThemeHistoryCommitOptions = {}): boolean {
    const { mergeKey, now = Date.now() } = options;
    const currentEntry = entries[index];
    if (currentEntry === undefined || isThemeEqual(currentEntry.theme, theme)) {
      return false;
    }

    // 只有真正发生修改时才清空 redo；纯聚焦、重复设置同值不应破坏重做链。
    truncateRedo();

    if (
      mergeKey !== undefined &&
      currentEntry.mergeKey === mergeKey &&
      now - currentEntry.committedAt <= THEME_HISTORY_MERGE_WINDOW_MS
    ) {
      const previous = entries[index - 1];
      if (previous !== undefined && isThemeEqual(previous.theme, theme)) {
        // 连续输入又回到上一步的值：移除中间快照，避免出现“撤销无变化”的步骤。
        entries.pop();
        index -= 1;
        return true;
      }
      currentEntry.theme = cloneTheme(theme);
      currentEntry.committedAt = now;
      return true;
    }

    push(theme, mergeKey ?? null, now);
    return true;
  }

  function move(offset: -1 | 1): Theme | null {
    const nextIndex = index + offset;
    const target = entries[nextIndex];
    if (target === undefined) {
      return null;
    }
    index = nextIndex;
    return cloneTheme(target.theme);
  }

  return {
    current(): Theme {
      const entry = entries[index];
      return cloneTheme(entry?.theme ?? initial);
    },

    canUndo(): boolean {
      return index > 0;
    },

    canRedo(): boolean {
      return index < entries.length - 1;
    },

    commit,

    undo(): Theme | null {
      return move(-1);
    },

    redo(): Theme | null {
      return move(1);
    },

    breakMerge(): void {
      const currentEntry = entries[index];
      if (currentEntry !== undefined) {
        currentEntry.mergeKey = null;
      }
    },

    replaceCurrent(theme: Theme): void {
      const currentEntry = entries[index];
      if (currentEntry === undefined) {
        return;
      }
      currentEntry.theme = cloneTheme(theme);
      currentEntry.mergeKey = null;
      currentEntry.committedAt = 0;
    },

    size(): number {
      return entries.length;
    },
  };
}
