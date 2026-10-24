const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/**
 * 动态创建引用本地 sprite 的图标。
 *
 * 只负责 `<svg class="icon"><use href="#icon-...">`，尺寸、颜色和线宽由
 * 页面 CSS 控制；图标本身对屏幕阅读器隐藏，交互元素需要自己提供 aria-label。
 */
export function createIcon(name: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const use = document.createElementNS(SVG_NAMESPACE, 'use');
  use.setAttribute('href', `#icon-${name}`);
  svg.append(use);

  return svg;
}
