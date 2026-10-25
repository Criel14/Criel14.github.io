/**
 * 主题名称的显示宽度与校验。
 *
 * 名称上限按“显示宽度”而不是 UTF-16 长度计算：中文、全角标点和 emoji 占 2，
 * 英文、数字和空格占 1。这样输入框的 20 宽限制在视觉上稳定，不会因为中英文
 * 混排出现一半长度就超限的情况。
 */

/** 主题名称最多 20 个显示宽度单位，即 10 个汉字或 20 个英文字母。 */
export const THEME_NAME_MAX_WIDTH = 20;

/** 新建主题的默认名称；编辑器新建时使用。 */
export const DEFAULT_THEME_NAME = '新的主题';

/**
 * 东亚宽字符（East Asian Wide / Fullwidth）与常见 emoji 范围。
 *
 * 采用范围判断而不是依赖 canvas/DOM 测量，保证 core 可以在 Node 单元测试中直接运行。
 * 范围覆盖汉字、假名、韩文、全角标点、全角字母数字、emoji 和扩展平面表意文字。
 */
const WIDE_CODE_POINT_RANGES: readonly (readonly [number, number])[] = [
  [0x1100, 0x115f],
  [0x2329, 0x232a],
  [0x2e80, 0x303e],
  [0x3041, 0x33ff],
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xa000, 0xa4cf],
  [0xa960, 0xa97f],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe10, 0xfe19],
  [0xfe30, 0xfe6f],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
  [0x1b000, 0x1b2ff],
  [0x1f1e6, 0x1faff],
  [0x20000, 0x3fffd],
];

const EMOJI_PRESENTATION = /\p{Extended_Pictographic}/u;
const MARK = /\p{Mark}/u;

const ZERO_WIDTH_JOINER = 0x200d;
const VARIATION_SELECTOR_15 = 0xfe0e;
const VARIATION_SELECTOR_16 = 0xfe0f;
const COMBINING_KEYCAP = 0x20e3;

interface GraphemeSegmenter {
  segment(input: string): Iterable<{ readonly segment: string }>;
}

type GraphemeSegmenterConstructor = new (
  locales?: string | string[],
  options?: { readonly granularity: 'grapheme' },
) => GraphemeSegmenter;

/**
 * 按用户感知字符（grapheme cluster）拆分。
 *
 * 现代浏览器使用 Intl.Segmenter，组合字符、ZWJ emoji 和国旗不会被拆成多个字符；
 * 没有该 API 时退化为按 code point 拆分，宽度可能略保守，但不会崩溃。
 */
function splitGraphemes(value: string): readonly string[] {
  const Segmenter = (Intl as unknown as { Segmenter?: GraphemeSegmenterConstructor }).Segmenter;
  if (typeof Segmenter === 'function') {
    return Array.from(
      new Segmenter(undefined, { granularity: 'grapheme' }).segment(value),
      (item) => item.segment,
    );
  }
  return Array.from(value);
}

function isWideCodePoint(codePoint: number): boolean {
  return WIDE_CODE_POINT_RANGES.some(([start, end]) => codePoint >= start && codePoint <= end);
}

function isMarkOrModifier(codePoint: number): boolean {
  if (
    codePoint === ZERO_WIDTH_JOINER ||
    codePoint === COMBINING_KEYCAP ||
    codePoint === VARIATION_SELECTOR_15
  ) {
    return true;
  }
  return MARK.test(String.fromCodePoint(codePoint));
}

/** 单个 grapheme 的显示宽度；emoji 序列整体按 2 计，组合附加符不额外占宽。 */
function getGraphemeWidth(grapheme: string): number {
  let width = 0;
  let hasEmojiPresentation = false;

  for (const character of grapheme) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) {
      continue;
    }
    // VS16 先于 Mark 判断处理：它本身是组合记号，但会把前面的符号变成 emoji 呈现。
    if (codePoint === VARIATION_SELECTOR_16) {
      hasEmojiPresentation = true;
      continue;
    }
    if (isMarkOrModifier(codePoint)) {
      continue;
    }
    if (isWideCodePoint(codePoint) || EMOJI_PRESENTATION.test(character)) {
      width = Math.max(width, 2);
    } else {
      width = Math.max(width, 1);
    }
    if (codePoint >= 0x1f000) {
      hasEmojiPresentation = true;
    }
  }

  // 文本符号 + VS16 会按 emoji 呈现，例如 ©️、1️⃣；整体按 2 计。
  if (hasEmojiPresentation && width < 2) {
    return 2;
  }
  return width;
}

/**
 * 计算名称的显示宽度；空字符串返回 0。
 *
 * 调用方通常先 trim 再计算，避免首尾空格让计数器虚高。该函数不修改原字符串。
 */
export function getThemeNameWidth(value: string): number {
  return splitGraphemes(value).reduce((total, grapheme) => total + getGraphemeWidth(grapheme), 0);
}

/** 保存前统一去掉首尾空格；数据层也会再次 trim，这里只负责编辑器的即时展示。 */
export function normalizeThemeName(value: string): string {
  return value.trim();
}

/**
 * 校验名称；返回 null 表示合法，否则返回可直接展示的中文错误。
 *
 * 名称允许重名，身份由 ID 决定，因此这里只检查空值和显示宽度。
 */
export function getThemeNameError(value: string): string | null {
  const normalized = normalizeThemeName(value);
  if (normalized.length === 0) {
    return '主题名称不能为空。';
  }

  const width = getThemeNameWidth(normalized);
  if (width > THEME_NAME_MAX_WIDTH) {
    return `主题名称最多 ${THEME_NAME_MAX_WIDTH} 个显示宽度（约 10 个汉字或 20 个英文字母）。`;
  }
  return null;
}
