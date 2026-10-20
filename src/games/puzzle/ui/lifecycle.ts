/**
 * 页面级生命周期。
 *
 * 页面可能因为重开一局、切换模式或卸载而需要回收事件监听、定时器和 rAF。
 * 统一用 AbortSignal + dispose 回调管理，避免每个模块各写一套清理逻辑。
 */

/** 只负责释放资源的对象；dialog / notice / board-view 都符合这个形状。 */
export interface Disposable {
  dispose(): void;
}

/** createLifecycle 返回的生命周期作用域；dispose 后所有方法均为 no-op。 */
export interface Lifecycle extends Disposable {
  /** 传给 addEventListener 或 dialog / notice，dispose 时统一中止。 */
  readonly signal: AbortSignal;

  /**
   * 注册销毁回调，返回取消注册函数。
   * 已经销毁时回调会立即执行，避免资源泄漏。
   */
  onDispose(callback: () => void): () => void;

  /** 绑定事件监听；dispose 时自动移除。 */
  listen(
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions,
  ): void;

  /** 注册一次性定时器；dispose 时清除。 */
  setTimeout(callback: () => void, delay?: number): void;

  /** 注册重复定时器；dispose 时清除。 */
  setInterval(callback: () => void, delay?: number): void;

  /** 注册下一帧回调；dispose 时取消尚未执行的帧。 */
  requestFrame(callback: FrameRequestCallback): void;
}

/** dispose 可以接受的资源形状，兼容 BoardView.destroy 和 attachBoardInput 返回的函数。 */
export type DisposeInput =
  Disposable | { destroy(): void } | (() => void) | readonly DisposeInput[] | null | undefined;

type TimerId = ReturnType<typeof globalThis.setTimeout>;

function safelyRun(callback: () => void, message: string): void {
  try {
    callback();
  } catch (error) {
    console.error(message, error);
  }
}

export function createLifecycle(): Lifecycle {
  const controller = new AbortController();
  const { signal } = controller;
  const timeoutIds = new Set<TimerId>();
  const intervalIds = new Set<TimerId>();
  const frameIds = new Set<number>();
  const disposeCallbacks: Array<() => void> = [];
  let disposed = false;

  function clearScheduledWork(): void {
    for (const id of timeoutIds) {
      globalThis.clearTimeout(id);
    }
    timeoutIds.clear();

    for (const id of intervalIds) {
      globalThis.clearInterval(id);
    }
    intervalIds.clear();

    for (const id of frameIds) {
      globalThis.cancelAnimationFrame(id);
    }
    frameIds.clear();
  }

  function dispose(): void {
    if (disposed) {
      return;
    }
    disposed = true;
    // 先中止 signal，移除通过 listen 注册的监听器，再执行模块自己的清理。
    controller.abort();
    clearScheduledWork();

    // 后注册的清理通常依赖先注册的资源，按 LIFO 顺序执行。
    const callbacks = disposeCallbacks.splice(0).reverse();
    for (const callback of callbacks) {
      safelyRun(callback, '生命周期清理回调执行失败');
    }
  }

  return {
    signal,

    onDispose(callback: () => void): () => void {
      if (disposed) {
        safelyRun(callback, '生命周期清理回调执行失败');
        return () => {};
      }
      disposeCallbacks.push(callback);
      return () => {
        const index = disposeCallbacks.indexOf(callback);
        if (index >= 0) {
          disposeCallbacks.splice(index, 1);
        }
      };
    },

    listen(target, type, listener, options = {}): void {
      if (disposed) {
        return;
      }
      target.addEventListener(type, listener, { ...options, signal });
    },

    setTimeout(callback, delay = 0): void {
      if (disposed) {
        return;
      }
      const id = globalThis.setTimeout(() => {
        timeoutIds.delete(id);
        if (!disposed) {
          callback();
        }
      }, delay);
      timeoutIds.add(id);
    },

    setInterval(callback, delay = 0): void {
      if (disposed) {
        return;
      }
      const id = globalThis.setInterval(() => {
        if (!disposed) {
          callback();
        }
      }, delay);
      intervalIds.add(id);
    },

    requestFrame(callback): void {
      if (disposed) {
        return;
      }
      const id = globalThis.requestAnimationFrame((time) => {
        frameIds.delete(id);
        if (!disposed) {
          callback(time);
        }
      });
      frameIds.add(id);
    },

    dispose,
  };
}

/**
 * 统一释放多个资源。
 *
 * 支持 dispose() / destroy() 对象、清理函数以及它们的数组；
 * 单个清理失败不会阻断其余资源释放。
 */
export function dispose(...items: readonly DisposeInput[]): void {
  for (const item of items) {
    disposeOne(item);
  }
}

function disposeOne(item: DisposeInput): void {
  if (item === null || item === undefined) {
    return;
  }
  if (Array.isArray(item)) {
    for (const child of item as readonly DisposeInput[]) {
      disposeOne(child);
    }
    return;
  }
  if (typeof item === 'function') {
    safelyRun(item, '资源清理失败');
    return;
  }
  if ('dispose' in item && typeof item.dispose === 'function') {
    safelyRun(() => item.dispose(), '资源清理失败');
    return;
  }
  if ('destroy' in item && typeof item.destroy === 'function') {
    safelyRun(() => item.destroy(), '资源清理失败');
  }
}
