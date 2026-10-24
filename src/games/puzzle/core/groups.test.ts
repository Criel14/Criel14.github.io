import { describe, expect, it } from 'vitest';
import {
  createDefaultGroups,
  getDefaultGroupName,
  getGroup,
  getGroupKey,
  getGroupName,
  GROUP_COUNT,
  GROUPS_PER_EVENT,
  isGroupId,
  MAX_GROUP_ID,
  MIN_GROUP_ID,
} from './groups';

describe('isGroupId', () => {
  it('接受 1–5 的整数', () => {
    for (let value = MIN_GROUP_ID; value <= MAX_GROUP_ID; value += 1) {
      expect(isGroupId(value)).toBe(true);
    }
  });

  it('拒绝越界和非整数', () => {
    expect(isGroupId(0)).toBe(false);
    expect(isGroupId(6)).toBe(false);
    expect(isGroupId(11)).toBe(false);
    expect(isGroupId(1.5)).toBe(false);
    expect(isGroupId(Number.NaN)).toBe(false);
  });

  it('边界常量正确', () => {
    expect(MIN_GROUP_ID).toBe(1);
    expect(MAX_GROUP_ID).toBe(5);
    expect(GROUPS_PER_EVENT).toBe(5);
    expect(GROUP_COUNT).toBe(90);
  });
});

describe('getDefaultGroupName', () => {
  it('返回分组1–分组5', () => {
    expect(getDefaultGroupName(1)).toBe('分组1');
    expect(getDefaultGroupName(5)).toBe('分组5');
  });
});

describe('createDefaultGroups', () => {
  it('生成 18 个事件 × 5 个槽位，共 90 组', () => {
    const groups = createDefaultGroups();

    expect(groups).toHaveLength(GROUP_COUNT);
    expect(
      new Set(groups.map((group) => getGroupKey(group.size, group.gameMode, group.id))).size,
    ).toBe(GROUP_COUNT);
  });

  it('按阶数升序、普通在前、槽位 1–5 排列', () => {
    const groups = createDefaultGroups();

    expect(groups[0]).toEqual({ size: 2, gameMode: 'normal', id: 1, name: '分组1' });
    expect(groups[4]).toEqual({ size: 2, gameMode: 'normal', id: 5, name: '分组5' });
    expect(groups[5]).toEqual({ size: 2, gameMode: 'blind', id: 1, name: '分组1' });
    expect(groups[10]).toEqual({ size: 3, gameMode: 'normal', id: 1, name: '分组1' });
    expect(groups.at(-1)).toEqual({ size: 10, gameMode: 'blind', id: 5, name: '分组5' });
  });

  it('每次返回新数组和新对象', () => {
    const first = createDefaultGroups();
    const second = createDefaultGroups();

    expect(first).not.toBe(second);
    expect(first[0]).not.toBe(second[0]);
  });
});

describe('getGroup / getGroupName', () => {
  it('按事件和槽位查找，不串到同槽位的其他事件', () => {
    const groups = createDefaultGroups().map((group) =>
      group.size === 3 && group.gameMode === 'normal' && group.id === 2
        ? { ...group, name: '速拧' }
        : group,
    );

    expect(getGroup(groups, 3, 'normal', 2)?.name).toBe('速拧');
    expect(getGroupName(groups, 3, 'normal', 2)).toBe('速拧');
    expect(getGroupName(groups, 3, 'blind', 2)).toBe('分组2');
    expect(getGroupName(groups, 4, 'normal', 2)).toBe('分组2');
  });

  it('缺失分组回退默认短名', () => {
    expect(getGroup([], 3, 'normal', 1)).toBeUndefined();
    expect(getGroupName([], 3, 'normal', 1)).toBe('分组1');
  });
});
