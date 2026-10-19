/** 持久化时间字段保留的小数位数；毫秒的千分位，即微秒级。 */
export const TIME_DECIMALS = 3;

const TIME_FACTOR = 10 ** TIME_DECIMALS;

/**
 * 把毫秒时间四舍五入到 3 位小数。
 *
 * session 使用 performance.now()，可能带小数；存储层统一到 3 位，
 * 避免紧凑录像的时间增量出现无意义的浮点尾数。非有限值原样返回，
 * 由调用方负责校验。
 */
export function roundTimeMs(value: number): number {
  if (!Number.isFinite(value)) {
    return value;
  }

  const rounded = Math.round(value * TIME_FACTOR) / TIME_FACTOR;
  return Object.is(rounded, -0) ? 0 : rounded;
}
