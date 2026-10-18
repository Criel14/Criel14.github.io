import type { ScoreFilter, ScoreRecord } from '../types';

/**
 * 计算每秒步数（TPS）。
 *
 * durationMs 使用成绩的有效用时：normal 不含观察时间，blind 含观察时间。
 * durationMs <= 0 时返回 0，避免除零或负数时间产生无意义结果。
 */
export function calculateTps(moveCount: number, durationMs: number): number {
  if (durationMs <= 0) {
    return 0;
  }
  return moveCount / (durationMs / 1000);
}

/**
 * 成绩排序规则：finishedAt 升序；完成时刻相同时按 id 升序。
 *
 * id 使用逐字符字典序比较而不是 localeCompare，
 * 避免不同浏览器/语言环境产生不同的排序结果。
 */
export function compareScores(a: ScoreRecord, b: ScoreRecord): number {
  if (a.finishedAt !== b.finishedAt) {
    return a.finishedAt < b.finishedAt ? -1 : 1;
  }
  if (a.id === b.id) {
    return 0;
  }
  return a.id < b.id ? -1 : 1;
}

/** 返回按 compareScores 排序的新数组；不修改入参。 */
export function sortScores(scores: readonly ScoreRecord[]): ScoreRecord[] {
  return [...scores].sort(compareScores);
}

/**
 * 生成成绩桶键：`size:gameMode:groupId`。
 * moveMode 不参与分桶，因为同一阶数/模式/分组下的操作方式可以混合统计。
 */
export function getBucketKey(filter: ScoreFilter): string {
  return `${filter.size}:${filter.gameMode}:${filter.groupId}`;
}

/** 只保留目标桶的成绩，返回新数组；不排序、不编号。 */
export function filterScoresByBucket(
  scores: readonly ScoreRecord[],
  filter: ScoreFilter,
): ScoreRecord[] {
  const bucketKey = getBucketKey(filter);
  return scores.filter((score) => getBucketKey(score) === bucketKey);
}

/** 开局时刻不落库，由完成时刻减去有效用时派生。返回 epoch ms。 */
export function getScoreStartedAt(score: ScoreRecord): number {
  return score.finishedAt - score.durationMs;
}

/**
 * 先排序再编号；number 从 1 开始，等于排序后的下标 + 1。
 * 编号只用于展示，不落库；删除成绩后重新调用即可得到连续编号。
 */
export function assignNumbers(
  scores: readonly ScoreRecord[],
): Array<{ score: ScoreRecord; number: number }> {
  return sortScores(scores).map((score, index) => ({ score, number: index + 1 }));
}
