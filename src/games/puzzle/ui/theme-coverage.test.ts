import { describe, expect, it } from 'vitest';
import type { PuzzleSize } from '../types';
import { formatCoverageDetail, formatCoverageSummary, formatSizeLabel } from './theme-coverage';

function sizes(...values: PuzzleSize[]): readonly PuzzleSize[] {
  return values;
}

describe('formatCoverageSummary', () => {
  it('没有覆盖时返回空字符串', () => {
    expect(formatCoverageSummary([])).toBe('');
  });

  it('只覆盖全部 9 个阶数时显示“所有阶数”', () => {
    expect(formatCoverageSummary(sizes(2, 3, 4, 5, 6, 7, 8, 9, 10))).toBe('所有阶数');
  });

  it('单个阶数显示“N 阶”', () => {
    expect(formatCoverageSummary(sizes(4))).toBe('4 阶');
  });

  it('单段区间显示起止范围', () => {
    expect(formatCoverageSummary(sizes(2, 3, 4, 5, 6, 7, 8, 9))).toBe('2–9 阶');
    expect(formatCoverageSummary(sizes(8, 9, 10))).toBe('8–10 阶');
  });

  it('两段区间用顿号连接，并兼容单点区间', () => {
    expect(formatCoverageSummary(sizes(2, 3, 4, 8, 9, 10))).toBe('2–4、8–10 阶');
    expect(formatCoverageSummary(sizes(2, 8, 9, 10))).toBe('2、8–10 阶');
  });

  it('三段及以上只显示阶数数量', () => {
    expect(formatCoverageSummary(sizes(2, 4, 6))).toBe('3 个阶数');
    expect(formatCoverageSummary(sizes(2, 3, 5, 7, 9))).toBe('5 个阶数');
  });

  it('先排序去重，不依赖调用方传入顺序', () => {
    expect(formatCoverageSummary(sizes(4, 2, 3, 3, 2))).toBe('2–4 阶');
  });
});

describe('formatCoverageDetail', () => {
  it('输出完整的升序尺寸列表', () => {
    expect(formatCoverageDetail(sizes(4, 2, 10))).toBe('2×2、4×4、10×10');
  });

  it('没有覆盖时返回空字符串', () => {
    expect(formatCoverageDetail([])).toBe('');
  });
});

describe('formatSizeLabel', () => {
  it('使用乘号而不是字母 x', () => {
    expect(formatSizeLabel(4)).toBe('4×4');
  });
});
