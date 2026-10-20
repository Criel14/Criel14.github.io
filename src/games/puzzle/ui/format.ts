/**
 * 拼图 UI 的展示格式化函数。
 *
 * 这里只做“事实 → 展示文本”的转换，不读取 DOM、不依赖页面状态，
 * 供游戏页、成绩页和回放页共用，避免各页面各写一套格式。
 */

/** 补足两位数字，用于秒、分和厘秒。 */
function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

/**
 * 把毫秒格式化为计时文本。
 *
 * 规则：
 * - 小于 60 秒：`12.34`（不补前导零，和旧版显示保持一致）；
 * - 小于 1 小时：`1:02.34`；
 * - 1 小时及以上：`1:02:03.45`。
 *
 * 显示保留两位小数。实现上先四舍五入到厘秒，再拆分时/分/秒，
 * 这样 59_999ms 会正确进位为 `1:00.00`，不会出现 `60.00` 这种越界文本。
 * 负数、NaN、Infinity 属于非法输入，防御性返回 `0.00`，避免页面出现 NaN。
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) {
    return '0.00';
  }

  const totalCentiseconds = Math.round(ms / 10);
  const centiseconds = totalCentiseconds % 100;
  const totalSeconds = Math.floor(totalCentiseconds / 100);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  if (hours > 0) {
    return `${hours}:${pad2(minutes)}:${pad2(seconds)}.${pad2(centiseconds)}`;
  }
  if (minutes > 0) {
    return `${minutes}:${pad2(seconds)}.${pad2(centiseconds)}`;
  }
  return `${seconds}.${pad2(centiseconds)}`;
}

/**
 * 把 TPS 格式化为两位小数。
 *
 * TPS 是派生值，不落库；非法或负数输入返回 `0.00`，避免表格出现 NaN。
 */
export function formatTps(tps: number): string {
  if (!Number.isFinite(tps) || tps < 0) {
    return '0.00';
  }
  return (Math.round(tps * 100) / 100).toFixed(2);
}

/**
 * 把 epoch 毫秒格式化为本地时间 `YYYY-MM-DD HH:mm:ss`。
 *
 * 不使用 `toLocaleString()`：不同浏览器和语言环境的输出不一致，
 * 而成绩表需要可预测、可排序的文本。非法或超出 Date 范围的时间返回 `—`。
 */
export function formatDateTime(epochMs: number): string {
  if (!Number.isFinite(epochMs)) {
    return '—';
  }

  const date = new Date(epochMs);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  const year = date.getFullYear().toString().padStart(4, '0');
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());
  const seconds = pad2(date.getSeconds());

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
