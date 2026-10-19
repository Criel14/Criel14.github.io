import type { GroupId } from '../types';

/** 固定分组编号范围；分组数量固定，不新增、不删除。 */
export const MIN_GROUP_ID = 1;
export const MAX_GROUP_ID = 10;

/**
 * 运行时校验固定分组编号。
 * schema 层、session 和页面参数解析都需要同一套边界，避免各自实现产生偏差。
 */
export function isGroupId(value: number): value is GroupId {
  return Number.isInteger(value) && value >= MIN_GROUP_ID && value <= MAX_GROUP_ID;
}
