import { describe, expect, it } from 'vitest';
import type { PuzzleSize } from '../../types';
import { getLayerCount, getLayerPaletteIndex, getTileLayer, isTileInLayerRange } from './layers';

const sizes: PuzzleSize[] = [2, 3, 4, 5, 6, 7, 8, 9, 10];

describe('getTileLayer', () => {
  it.each(sizes)('%i 阶所有非空白方块的层号都在有效范围内', (size) => {
    const maxLayer = getLayerCount(size);

    for (let tile = 1; tile < size * size; tile++) {
      const layer = getTileLayer(tile, size);
      expect(layer).toBeGreaterThanOrEqual(1);
      expect(layer).toBeLessThanOrEqual(maxLayer);
    }
  });

  it('4×4 的层分布与旧实现一致', () => {
    const layers = Array.from({ length: 15 }, (_, index) => getTileLayer(index + 1, 4));
    expect(layers).toEqual([1, 1, 1, 1, 2, 3, 3, 3, 2, 4, 5, 5, 2, 4, 6]);
  });

  it('空白块和越界数字返回 0', () => {
    expect(getTileLayer(0, 4)).toBe(0);
    expect(getTileLayer(-1, 4)).toBe(0);
    expect(getTileLayer(16, 4)).toBe(0);
    expect(getTileLayer(100, 10)).toBe(0);
  });

  it('非整数和非法阶数返回 0', () => {
    expect(getTileLayer(1.5, 4)).toBe(0);
    expect(getTileLayer(1, 1)).toBe(0);
    expect(getTileLayer(1, 11)).toBe(0);
    expect(getTileLayer(1, 3.5)).toBe(0);
    expect(getTileLayer(1, Number.NaN)).toBe(0);
  });
});

describe('getLayerCount', () => {
  it.each(sizes)('%i 阶的最大层号为 2 * size - 2', (size) => {
    expect(getLayerCount(size)).toBe(2 * size - 2);
  });

  it('非法阶数返回 0', () => {
    expect(getLayerCount(1)).toBe(0);
    expect(getLayerCount(11)).toBe(0);
    expect(getLayerCount(4.5)).toBe(0);
    expect(getLayerCount(Number.NaN)).toBe(0);
  });
});

describe('层范围工具', () => {
  it('判断层号是否有效', () => {
    expect(isTileInLayerRange(1, 4)).toBe(true);
    expect(isTileInLayerRange(6, 4)).toBe(true);
    expect(isTileInLayerRange(0, 4)).toBe(false);
    expect(isTileInLayerRange(7, 4)).toBe(false);
    expect(isTileInLayerRange(1.5, 4)).toBe(false);
  });

  it('把层号转换为 0-based 调色板索引', () => {
    expect(getLayerPaletteIndex(1, 4)).toBe(0);
    expect(getLayerPaletteIndex(6, 4)).toBe(5);
    expect(getLayerPaletteIndex(0, 4)).toBe(-1);
    expect(getLayerPaletteIndex(7, 4)).toBe(-1);
  });
});
