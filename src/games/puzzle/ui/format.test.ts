import { describe, expect, it } from 'vitest';
import { formatDateTime, formatDuration, formatTps } from './format';

describe('formatDuration', () => {
  it('一分钟以内显示秒和两位小数，不补前导零', () => {
    expect(formatDuration(0)).toBe('0.00');
    expect(formatDuration(5_000)).toBe('5.00');
    expect(formatDuration(10_000)).toBe('10.00');
    expect(formatDuration(12_340)).toBe('12.34');
    expect(formatDuration(59_990)).toBe('59.99');
  });

  it('按厘秒四舍五入', () => {
    expect(formatDuration(1)).toBe('0.00');
    expect(formatDuration(9)).toBe('0.01');
    expect(formatDuration(12_345)).toBe('12.35');
    expect(formatDuration(59_994)).toBe('59.99');
  });

  it('接近一分钟时正确进位为一分钟', () => {
    expect(formatDuration(59_995)).toBe('1:00.00');
    expect(formatDuration(59_999)).toBe('1:00.00');
  });

  it('一分钟及以上显示分和秒', () => {
    expect(formatDuration(60_000)).toBe('1:00.00');
    expect(formatDuration(62_340)).toBe('1:02.34');
    expect(formatDuration(599_990)).toBe('9:59.99');
    expect(formatDuration(3_599_990)).toBe('59:59.99');
  });

  it('一小时及以上显示时、分、秒', () => {
    expect(formatDuration(3_600_000)).toBe('1:00:00.00');
    expect(formatDuration(3_723_450)).toBe('1:02:03.45');
    expect(formatDuration(360_000_000)).toBe('100:00:00.00');
  });

  it('非法时间返回 0.00', () => {
    expect(formatDuration(-1)).toBe('0.00');
    expect(formatDuration(Number.NaN)).toBe('0.00');
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('0.00');
    expect(formatDuration(Number.NEGATIVE_INFINITY)).toBe('0.00');
  });
});

describe('formatTps', () => {
  it('保留两位小数', () => {
    expect(formatTps(0)).toBe('0.00');
    expect(formatTps(1)).toBe('1.00');
    expect(formatTps(2.3456)).toBe('2.35');
    expect(formatTps(99.999)).toBe('100.00');
  });

  it('非法或负数返回 0.00', () => {
    expect(formatTps(-0.1)).toBe('0.00');
    expect(formatTps(Number.NaN)).toBe('0.00');
    expect(formatTps(Number.POSITIVE_INFINITY)).toBe('0.00');
    expect(formatTps(Number.NEGATIVE_INFINITY)).toBe('0.00');
  });
});

describe('formatDateTime', () => {
  it('按本地时间输出 YYYY-MM-DD HH:mm:ss', () => {
    const epochMs = new Date(2026, 9, 20, 9, 5, 7).getTime();
    expect(formatDateTime(epochMs)).toBe('2026-10-20 09:05:07');
  });

  it('月、日、时、分、秒不足两位时补零', () => {
    const epochMs = new Date(2026, 0, 1, 0, 0, 0).getTime();
    expect(formatDateTime(epochMs)).toBe('2026-01-01 00:00:00');
  });

  it('非法或超出 Date 范围的时间返回占位符', () => {
    expect(formatDateTime(Number.NaN)).toBe('—');
    expect(formatDateTime(Number.POSITIVE_INFINITY)).toBe('—');
    expect(formatDateTime(8.64e15 + 1)).toBe('—');
  });
});
