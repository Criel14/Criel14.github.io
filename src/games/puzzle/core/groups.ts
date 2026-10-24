import type { GameMode, Group, GroupId, PuzzleSize } from '../types';

/** 事件内固定分组槽位范围；分组数量固定，不新增、不删除。 */
export const MIN_GROUP_ID = 1;
export const MAX_GROUP_ID = 5;

/** 固定槽位列表，避免各处用 `(index + 1) as GroupId` 强转。 */
export const GROUP_IDS: readonly GroupId[] = [1, 2, 3, 4, 5];

/** 事件 = 阶数 + 游戏模式；阶数按升序枚举。 */
export const EVENT_SIZES: readonly PuzzleSize[] = [2, 3, 4, 5, 6, 7, 8, 9, 10];

/** 同一阶数下，普通模式排在盲玩模式前。 */
export const EVENT_GAME_MODES: readonly GameMode[] = ['normal', 'blind'];

/** 每个事件固定 5 个分组。 */
export const GROUPS_PER_EVENT = GROUP_IDS.length;

/** 18 个事件 × 5 个槽位 = 90 个分组。 */
export const GROUP_COUNT = EVENT_SIZES.length * EVENT_GAME_MODES.length * GROUPS_PER_EVENT;

/**
 * 运行时校验事件内分组槽位。
 * schema 层、session 和页面参数解析都需要同一套边界，避免各自实现产生偏差。
 */
export function isGroupId(value: number): value is GroupId {
  return Number.isInteger(value) && value >= MIN_GROUP_ID && value <= MAX_GROUP_ID;
}

/**
 * 默认分组短名。
 * TODO(i18n)：接入语言检测后，非中文环境返回 Group1–Group5；已有名称不自动翻译。
 */
export function getDefaultGroupName(id: GroupId): string {
  return `分组${id}`;
}

/** 生成分组身份键，用于归一化和按事件查找。 */
export function getGroupKey(size: PuzzleSize, gameMode: GameMode, id: GroupId): string {
  return `${size}:${gameMode}:${id}`;
}

/**
 * 创建 90 个默认分组。
 * 顺序固定为：阶数升序 → 普通在前 → 槽位 1–5；每次返回新数组和新对象。
 */
export function createDefaultGroups(): Group[] {
  const groups: Group[] = [];
  for (const size of EVENT_SIZES) {
    for (const gameMode of EVENT_GAME_MODES) {
      for (const id of GROUP_IDS) {
        groups.push({ size, gameMode, id, name: getDefaultGroupName(id) });
      }
    }
  }
  return groups;
}

/** 查找某个事件内的分组；不存在返回 undefined。 */
export function getGroup(
  groups: readonly Group[],
  size: PuzzleSize,
  gameMode: GameMode,
  id: GroupId,
): Group | undefined {
  return groups.find(
    (group) => group.size === size && group.gameMode === gameMode && group.id === id,
  );
}

/** 返回分组名称；缺失或数据损坏时回退默认短名。 */
export function getGroupName(
  groups: readonly Group[],
  size: PuzzleSize,
  gameMode: GameMode,
  id: GroupId,
): string {
  return getGroup(groups, size, gameMode, id)?.name ?? getDefaultGroupName(id);
}
