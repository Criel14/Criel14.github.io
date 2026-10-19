import type { ChartSeries, ScoreHighlight, ScoreRecord, ScoreStats } from '../types';
import { assignNumbers, calculateTps, getScoreStartedAt, sortScores } from './score';

/** 相邻两局间隔超过 5 分钟视为不同 session，ao 窗口失效。 */
export const SESSION_GAP_MS = 5 * 60 * 1000;

/** ao 至少需要 3 条成绩才能去掉一个最大值和一个最小值。 */
const MIN_AO_WINDOW = 3;

/** 过滤非有限值后求算术平均；全部无效时返回 null，不用 0 冒充缺失值。 */
function average(values: readonly number[]): number | null {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  if (finiteValues.length === 0) {
    return null;
  }
  return finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length;
}

/** 过滤非有限值后取最小值；全部无效时返回 null。 */
function minValue(values: readonly number[]): number | null {
  let result: number | null = null;
  for (const value of values) {
    if (Number.isFinite(value) && (result === null || value < result)) {
      result = value;
    }
  }
  return result;
}

/** 过滤非有限值后取最大值；全部无效时返回 null。 */
function maxValue(values: readonly number[]): number | null {
  let result: number | null = null;
  for (const value of values) {
    if (Number.isFinite(value) && (result === null || value > result)) {
      result = value;
    }
  }
  return result;
}

/**
 * 逐条计算 TPS，只保留有限且大于 0 的值。
 *
 * 0 通常来自 durationMs <= 0 的损坏成绩，计入平均会无意义地拉低统计；
 * NaN / Infinity 同样跳过。合法成绩的 TPS 一定大于 0。
 */
function getValidTpsValues(scores: readonly ScoreRecord[]): number[] {
  return scores
    .map((score) => calculateTps(score.moveCount, score.durationMs))
    .filter((tps) => Number.isFinite(tps) && tps > 0);
}

/**
 * 计算排序后第 index 条成绩的 aoN。
 *
 * scores 必须已按 sortScores 排序；调用方负责排序，本函数不做隐式排序。
 * 窗口取 [index - N + 1, index]，去掉一个最小 durationMs 和一个最大 durationMs，
 * 对中间 N-2 条求算术平均。
 *
 * 窗口内任意相邻两局满足 `abs(nextStartedAt - previousFinishedAt) > SESSION_GAP_MS`
 * 时整个窗口无效。使用绝对值与架构 6.5、旧实现保持一致，允许 5 分钟内的
 * 负间隔（时钟抖动），超过阈值才视为不同 session。
 */
export function computeAoAt(
  scores: readonly ScoreRecord[],
  index: number,
  windowSize: number,
): number | null {
  if (!Number.isInteger(windowSize) || windowSize < MIN_AO_WINDOW) {
    return null;
  }
  if (!Number.isInteger(index) || index < 0 || index >= scores.length) {
    return null;
  }
  if (index < windowSize - 1) {
    return null;
  }

  const windowScores = scores.slice(index - windowSize + 1, index + 1);

  for (let offset = 1; offset < windowScores.length; offset++) {
    const previous = windowScores[offset - 1];
    const next = windowScores[offset];
    const gap = getScoreStartedAt(next) - previous.finishedAt;
    if (!Number.isFinite(gap) || Math.abs(gap) > SESSION_GAP_MS) {
      return null;
    }
  }

  const durations = windowScores.map((score) => score.durationMs);
  if (durations.some((duration) => !Number.isFinite(duration) || duration <= 0)) {
    return null;
  }

  const sortedDurations = [...durations].sort((left, right) => left - right);
  const middle = sortedDurations.slice(1, -1);
  return middle.reduce((sum, duration) => sum + duration, 0) / middle.length;
}

/**
 * 在所有有效 aoN 窗口中取最小值；没有有效窗口返回 null。
 * scores 必须已排序。
 */
export function computeBestAo(scores: readonly ScoreRecord[], windowSize: number): number | null {
  if (!Number.isInteger(windowSize) || windowSize < MIN_AO_WINDOW) {
    return null;
  }

  let best: number | null = null;
  for (let index = windowSize - 1; index < scores.length; index++) {
    const ao = computeAoAt(scores, index, windowSize);
    if (ao !== null && (best === null || ao < best)) {
      best = ao;
    }
  }
  return best;
}

/**
 * 聚合一个成绩桶的统计。
 *
 * - 平均全部使用算术平均，不用去尾平均；ao 才去尾。
 * - 空桶返回 count = 0、其余 null。
 * - TPS 按每条成绩的 moveCount / durationMs 计算后再平均，并跳过 0 / 非法值。
 * - bestAo5 / bestAo12 需要先按完成时间排序，函数内部排序，不修改入参。
 */
export function computeScoreStats(scores: readonly ScoreRecord[]): ScoreStats {
  const durations = scores.map((score) => score.durationMs);
  const steps = scores.map((score) => score.moveCount);
  const observes = scores.map((score) => score.observeMs);
  const tpsValues = getValidTpsValues(scores);
  const sortedScores = sortScores(scores);

  return {
    count: scores.length,
    bestTimeMs: minValue(durations),
    averageTimeMs: average(durations),
    bestStep: minValue(steps),
    averageStep: average(steps),
    bestTps: maxValue(tpsValues),
    averageTps: average(tpsValues),
    bestAo5Ms: computeBestAo(sortedScores, 5),
    bestAo12Ms: computeBestAo(sortedScores, 12),
    averageObserveMs: average(observes),
  };
}

/**
 * 计算每条成绩的极值高亮。
 *
 * 时间、步数、ao 越小越好，TPS 越大越好；并列时全部标记。
 * null / 无效值不参与比较，也不高亮（例如不足 5 条时的 ao5、TPS <= 0 的成绩）。
 * 返回顺序与入参 scores 一致；内部按 sortScores 排序只用于计算 ao。
 */
export function computeScoreHighlights(scores: readonly ScoreRecord[]): ScoreHighlight[] {
  if (scores.length === 0) {
    return [];
  }

  const sortedScores = sortScores(scores);
  const aoByScoreId = new Map<string, { ao5: number | null; ao12: number | null }>();
  sortedScores.forEach((score, index) => {
    aoByScoreId.set(score.id, {
      ao5: computeAoAt(sortedScores, index, 5),
      ao12: computeAoAt(sortedScores, index, 12),
    });
  });

  const durations = scores.map((score) => score.durationMs);
  const steps = scores.map((score) => score.moveCount);
  const tpsValues = getValidTpsValues(scores);
  const ao5Values = [...aoByScoreId.values()]
    .map((entry) => entry.ao5)
    .filter((value): value is number => value !== null);
  const ao12Values = [...aoByScoreId.values()]
    .map((entry) => entry.ao12)
    .filter((value): value is number => value !== null);

  const bestTime = minValue(durations);
  const worstTime = maxValue(durations);
  const bestStep = minValue(steps);
  const worstStep = maxValue(steps);
  const bestTps = maxValue(tpsValues);
  const worstTps = minValue(tpsValues);
  const bestAo5 = minValue(ao5Values);
  const worstAo5 = maxValue(ao5Values);
  const bestAo12 = minValue(ao12Values);
  const worstAo12 = maxValue(ao12Values);

  return scores.map((score) => {
    const tps = calculateTps(score.moveCount, score.durationMs);
    const hasValidTps = Number.isFinite(tps) && tps > 0;
    const ao = aoByScoreId.get(score.id);
    const ao5 = ao?.ao5 ?? null;
    const ao12 = ao?.ao12 ?? null;

    return {
      scoreId: score.id,
      bestTime: bestTime !== null && score.durationMs === bestTime,
      worstTime: worstTime !== null && score.durationMs === worstTime,
      bestStep: bestStep !== null && score.moveCount === bestStep,
      worstStep: worstStep !== null && score.moveCount === worstStep,
      bestTps: hasValidTps && bestTps !== null && tps === bestTps,
      worstTps: hasValidTps && worstTps !== null && tps === worstTps,
      bestAo5: ao5 !== null && bestAo5 !== null && ao5 === bestAo5,
      worstAo5: ao5 !== null && worstAo5 !== null && ao5 === worstAo5,
      bestAo12: ao12 !== null && bestAo12 !== null && ao12 === bestAo12,
      worstAo12: ao12 !== null && worstAo12 !== null && ao12 === worstAo12,
    };
  });
}

/**
 * 生成折线图数据。
 * labels 使用 sortScores + assignNumbers 派生，图表不依赖存储中的 number。
 */
export function buildChartSeries(scores: readonly ScoreRecord[]): ChartSeries {
  const numbered = assignNumbers(scores);
  return {
    labels: numbered.map((entry) => entry.number),
    timeSeconds: numbered.map((entry) => entry.score.durationMs / 1000),
    steps: numbered.map((entry) => entry.score.moveCount),
  };
}
