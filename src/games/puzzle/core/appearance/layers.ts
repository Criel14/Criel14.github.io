import type { PuzzleSize } from '../../types';
import { isPuzzleSize } from '../board';

/**
 * 计算方块所在的 L 形层号，保留旧版“按层降阶”的视觉分布。
 *
 * 输入 tile 是方块数字，不是棋盘索引；坐标从 0 开始。
 * 空白块 0、越界数字、非整数 tile、非法阶数统一返回 0，调用方据此使用空白色。
 */
export function getTileLayer(tile: number, size: number): number {
  if (!isPuzzleSize(size) || !Number.isInteger(tile) || tile <= 0 || tile >= size * size) {
    return 0;
  }

  const index = tile - 1;
  const row = Math.floor(index / size);
  const col = index % size;
  return col >= row ? 2 * row + 1 : 2 * (col + 1);
}

/** 返回指定阶数的最大层号：2×2 为 2 层，10×10 为 18 层；非法阶数返回 0。 */
export function getLayerCount(size: number): number {
  if (!isPuzzleSize(size)) {
    return 0;
  }
  return 2 * size - 2;
}

/** 判断层号是否落在指定阶数的有效层范围内。 */
export function isTileInLayerRange(layer: number, size: number): boolean {
  const count = getLayerCount(size);
  return Number.isInteger(layer) && layer >= 1 && layer <= count;
}

/** 把 1-based 层号转换为 0-based 调色板索引；非法层号返回 -1。 */
export function getLayerPaletteIndex(layer: number, size: PuzzleSize): number {
  return isTileInLayerRange(layer, size) ? layer - 1 : -1;
}
