import { describe, expect, it } from 'vitest';
import type { Theme } from '../types';
import { FALLBACK_THEME } from '../core/appearance/presets';
import { cloneTheme } from '../core/appearance/theme';
import {
  createThemeHistory,
  THEME_HISTORY_LIMIT,
  THEME_HISTORY_MERGE_WINDOW_MS,
} from './theme-history';

function createTheme(name: string): Theme {
  return {
    ...cloneTheme(FALLBACK_THEME),
    id: 'custom-1',
    name,
    builtin: false,
  };
}

describe('createThemeHistory', () => {
  it('初始状态不能撤销或重做', () => {
    const initial = createTheme('初始');
    const history = createThemeHistory(initial);

    expect(history.current()).toEqual(initial);
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
    expect(history.size()).toBe(1);
  });

  it('提交、撤销和重做在快照之间移动', () => {
    const initial = createTheme('初始');
    const next = createTheme('修改后');
    const history = createThemeHistory(initial);

    expect(history.commit(next)).toBe(true);
    expect(history.current().name).toBe('修改后');
    expect(history.canUndo()).toBe(true);

    const undone = history.undo();
    expect(undone?.name).toBe('初始');
    expect(history.current().name).toBe('初始');
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(true);

    const redone = history.redo();
    expect(redone?.name).toBe('修改后');
    expect(history.canRedo()).toBe(false);
  });

  it('撤销后提交新修改会清空重做链', () => {
    const history = createThemeHistory(createTheme('初始'));
    history.commit(createTheme('第一次'));
    history.undo();

    expect(history.canRedo()).toBe(true);
    history.commit(createTheme('分支'));
    expect(history.canRedo()).toBe(false);
    expect(history.current().name).toBe('分支');
    expect(history.undo()?.name).toBe('初始');
  });

  it('相同状态不会产生重复快照', () => {
    const theme = createTheme('初始');
    const history = createThemeHistory(theme);
    expect(history.commit(theme)).toBe(false);
    expect(history.size()).toBe(1);
  });

  it('总快照数受上限限制，并保留最近的历史', () => {
    const history = createThemeHistory(createTheme('0'), 5);
    for (let index = 1; index <= 20; index += 1) {
      history.commit(createTheme(String(index)));
    }

    expect(history.size()).toBe(5);
    expect(history.current().name).toBe('20');

    let undone = 0;
    while (history.canUndo()) {
      history.undo();
      undone += 1;
    }
    expect(undone).toBe(4);
    expect(history.current().name).toBe('16');
  });

  it('默认上限为 50', () => {
    expect(THEME_HISTORY_LIMIT).toBe(50);
    const history = createThemeHistory(createTheme('0'));
    for (let index = 1; index <= 100; index += 1) {
      history.commit(createTheme(String(index)));
    }
    expect(history.size()).toBe(THEME_HISTORY_LIMIT);
  });

  it('相同 mergeKey 在窗口内合并为一步', () => {
    const history = createThemeHistory(createTheme(''));
    expect(history.commit(createTheme('a'), { mergeKey: 'name', now: 1000 })).toBe(true);
    expect(history.commit(createTheme('ab'), { mergeKey: 'name', now: 1200 })).toBe(true);
    expect(history.commit(createTheme('abc'), { mergeKey: 'name', now: 1400 })).toBe(true);

    expect(history.size()).toBe(2);
    expect(history.current().name).toBe('abc');
    expect(history.undo()?.name).toBe('');
  });

  it('超过合并窗口或 breakMerge 后产生新步骤', () => {
    const history = createThemeHistory(createTheme(''));
    history.commit(createTheme('a'), { mergeKey: 'name', now: 1000 });
    history.commit(createTheme('ab'), {
      mergeKey: 'name',
      now: 1000 + THEME_HISTORY_MERGE_WINDOW_MS + 1,
    });
    expect(history.size()).toBe(3);

    history.breakMerge();
    history.commit(createTheme('abc'), { mergeKey: 'name', now: 2000 });
    expect(history.size()).toBe(4);
    expect(history.undo()?.name).toBe('ab');
  });

  it('连续输入回到上一步时会移除中间快照', () => {
    const history = createThemeHistory(createTheme('初始'));
    history.commit(createTheme('a'), { mergeKey: 'name', now: 1000 });
    history.commit(createTheme('ab'), { mergeKey: 'name', now: 1100 });
    history.commit(createTheme('初始'), { mergeKey: 'name', now: 1200 });

    expect(history.size()).toBe(1);
    expect(history.canUndo()).toBe(false);
  });

  it('replaceCurrent 不改变快照数量和撤销位置', () => {
    const history = createThemeHistory(createTheme('初始'));
    history.commit(createTheme('未保存'));
    history.replaceCurrent(createTheme('已保存'));

    expect(history.size()).toBe(2);
    expect(history.current().name).toBe('已保存');
    expect(history.undo()?.name).toBe('初始');
  });

  it('current 返回深拷贝，不共享历史内部结构', () => {
    const history = createThemeHistory(createTheme('初始'));
    const current = history.current();
    (current.color.palette as string[])[0] = '#000000';

    expect(history.current().color.palette[0]).toBe(FALLBACK_THEME.color.palette[0]);
  });
});
