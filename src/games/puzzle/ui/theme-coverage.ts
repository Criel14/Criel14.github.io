import type { PuzzleSize } from '../types';
import { PUZZLE_SIZES } from '../core/board';

interface SizeRange {
  readonly start: PuzzleSize;
  readonly end: PuzzleSize;
}

/** 尺寸标签；对话框和读屏文案统一使用 `4×4`。 */
export function formatSizeLabel(size: PuzzleSize): string {
  return `${size}×${size}`;
}

/** 把任意阶数集合整理成 2–10 的升序，过滤重复和非法值。 */
function orderSizes(sizes: readonly PuzzleSize[]): PuzzleSize[] {
  const selected = new Set(sizes);
  return PUZZLE_SIZES.filter((size) => selected.has(size));
}

function toRanges(sizes: readonly PuzzleSize[]): SizeRange[] {
  const ranges: SizeRange[] = [];

  for (const size of sizes) {
    const last = ranges.at(-1);
    if (last !== undefined && size === last.end + 1) {
      ranges[ranges.length - 1] = { start: last.start, end: size };
    } else {
      ranges.push({ start: size, end: size });
    }
  }

  return ranges;
}

function formatRange(range: SizeRange): string {
  return range.start === range.end ? `${range.start}` : `${range.start}–${range.end}`;
}

/**
 * 主题卡右上角的覆盖摘要。
 *
 * 只按“当前实际使用该主题”的阶数计算：
 * - 全部 9 阶显示“所有阶数”；
 * - 单个阶数显示“4 阶”；
 * - 两段以内显示区间，如“2–4、8–10 阶”；
 * - 三段及以上显示“N 个阶数”，避免徽标过长。
 */
export function formatCoverageSummary(sizes: readonly PuzzleSize[]): string {
  const ordered = orderSizes(sizes);
  if (ordered.length === 0) {
    return '';
  }
  if (ordered.length === PUZZLE_SIZES.length) {
    return '所有阶数';
  }
  if (ordered.length === 1) {
    return `${ordered[0]} 阶`;
  }

  const ranges = toRanges(ordered);
  if (ranges.length >= 3) {
    return `${ordered.length} 个阶数`;
  }
  return `${ranges.map(formatRange).join('、')} 阶`;
}

/** 完整阶数列表，用于徽标 `title` 和主题卡 `aria-label`。 */
export function formatCoverageDetail(sizes: readonly PuzzleSize[]): string {
  return orderSizes(sizes)
    .map((size) => formatSizeLabel(size))
    .join('、');
}
