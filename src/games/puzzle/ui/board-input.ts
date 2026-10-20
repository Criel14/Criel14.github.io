/**
 * 棋盘输入采集。
 *
 * 只把鼠标/触摸手势转换成“第几个格子”，不判断 moveMode，也不修改游戏状态。
 * 页面根据回调决定调用 moveByTile / moveByDirection：
 * - click 模式订阅 onActivate；
 * - slide 模式订阅 onHover，并传 captureTouchMove: true；
 * - 键盘由页面自己监听，不经过这里。
 */

/** 输入层回调；event 保留给页面检查 ctrlKey 等修饰键。 */
export interface BoardInputCallbacks {
  /** 点击/轻触某个格子。 */
  readonly onActivate?: (index: number, event: MouseEvent) => void;
  /** 鼠标经过或触摸移动到某个格子。 */
  readonly onHover?: (index: number, event: MouseEvent) => void;
}

export interface BoardInputOptions {
  /**
   * slide 模式设为 true：触摸移动时持续上报经过的格子，并阻止页面滚动。
   * click 模式保持 false，避免用户无法滚动页面。
   */
  readonly captureTouchMove?: boolean;
}

const TILE_SELECTOR = '[data-index]';
const INTERACTIVE_CLASS = 'puzzle-board--interactive';

export function attachBoardInput(
  element: HTMLElement,
  callbacks: BoardInputCallbacks,
  options: BoardInputOptions = {},
): () => void {
  const controller = new AbortController();
  const { signal } = controller;
  const captureTouchMove = options.captureTouchMove ?? false;
  const previousTouchAction = element.style.touchAction;
  // 同一个格子的子元素之间移动也会触发 pointerover，必须去重，
  // 否则滑动模式下可能在一次移动后对同一位置重复执行。
  let lastHoverIndex: number | null = null;

  element.classList.add(INTERACTIVE_CLASS);
  element.style.touchAction = captureTouchMove ? 'none' : 'manipulation';

  /** 从事件目标或 elementFromPoint 结果里解析格子下标。 */
  function readTileIndex(target: EventTarget | null): number | null {
    if (!(target instanceof Element)) {
      return null;
    }
    const tile = target.closest<HTMLElement>(TILE_SELECTOR);
    if (tile === null || !element.contains(tile)) {
      return null;
    }
    const index = Number(tile.dataset.index);
    return Number.isInteger(index) && index >= 0 ? index : null;
  }

  element.addEventListener(
    'click',
    (event) => {
      const index = readTileIndex(event.target);
      if (index !== null) {
        callbacks.onActivate?.(index, event);
      }
    },
    { signal },
  );

  // 鼠标滑动沿用旧版“经过即移动”的手感，不要求按住。
  element.addEventListener(
    'pointerover',
    (event) => {
      if (event.pointerType === 'touch') {
        return;
      }
      const index = readTileIndex(event.target);
      if (index === null) {
        lastHoverIndex = null;
        return;
      }
      if (index === lastHoverIndex) {
        return;
      }
      lastHoverIndex = index;
      callbacks.onHover?.(index, event);
    },
    { signal },
  );

  element.addEventListener(
    'pointerleave',
    () => {
      lastHoverIndex = null;
    },
    { signal },
  );

  if (captureTouchMove) {
    // 触摸的 pointer 会被初始目标捕获，不能用 pointerover 判断经过的格子，
    // 必须用 elementFromPoint 取当前位置。
    element.addEventListener(
      'pointermove',
      (event) => {
        if (event.pointerType !== 'touch') {
          return;
        }
        const target = document.elementFromPoint(event.clientX, event.clientY);
        const index = readTileIndex(target);
        if (index === null) {
          lastHoverIndex = null;
          return;
        }
        if (index === lastHoverIndex) {
          return;
        }
        lastHoverIndex = index;
        event.preventDefault();
        callbacks.onHover?.(index, event);
      },
      { signal, passive: false },
    );
  }

  return () => {
    controller.abort();
    element.classList.remove(INTERACTIVE_CLASS);
    element.style.touchAction = previousTouchAction;
  };
}
