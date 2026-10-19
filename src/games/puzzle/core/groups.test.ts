import { describe, expect, it } from 'vitest';
import { isGroupId, MAX_GROUP_ID, MIN_GROUP_ID } from './groups';

describe('isGroupId', () => {
  it('接受 1–10 的整数', () => {
    for (let value = MIN_GROUP_ID; value <= MAX_GROUP_ID; value += 1) {
      expect(isGroupId(value)).toBe(true);
    }
  });

  it('拒绝越界和非整数', () => {
    expect(isGroupId(0)).toBe(false);
    expect(isGroupId(11)).toBe(false);
    expect(isGroupId(1.5)).toBe(false);
    expect(isGroupId(Number.NaN)).toBe(false);
  });

  it('边界常量正确', () => {
    expect(MIN_GROUP_ID).toBe(1);
    expect(MAX_GROUP_ID).toBe(10);
  });
});
