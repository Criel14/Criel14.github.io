import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLifecycle, dispose } from './lifecycle';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('createLifecycle', () => {
  it('dispose 会中止 signal 且保持幂等', () => {
    const lifecycle = createLifecycle();
    const listener = vi.fn();
    lifecycle.signal.addEventListener('abort', listener);

    expect(lifecycle.signal.aborted).toBe(false);
    lifecycle.dispose();
    expect(lifecycle.signal.aborted).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    lifecycle.dispose();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('onDispose 按后进先出执行，并支持取消注册', () => {
    const lifecycle = createLifecycle();
    const order: string[] = [];
    const removeFirst = lifecycle.onDispose(() => order.push('first'));
    lifecycle.onDispose(() => order.push('second'));

    removeFirst();
    lifecycle.dispose();

    expect(order).toEqual(['second']);
  });

  it('dispose 之后注册的回调会立即执行', () => {
    const lifecycle = createLifecycle();
    lifecycle.dispose();

    const callback = vi.fn();
    lifecycle.onDispose(callback);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('listen 注册的监听器在 dispose 后不再触发', () => {
    const lifecycle = createLifecycle();
    const target = new EventTarget();
    const listener = vi.fn();

    lifecycle.listen(target, 'ping', listener);
    target.dispatchEvent(new Event('ping'));
    lifecycle.dispose();
    target.dispatchEvent(new Event('ping'));

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('dispose 会清理 setTimeout 和 setInterval', () => {
    vi.useFakeTimers();
    const lifecycle = createLifecycle();
    const timeout = vi.fn();
    const interval = vi.fn();

    lifecycle.setTimeout(timeout, 100);
    lifecycle.setInterval(interval, 100);
    vi.advanceTimersByTime(50);
    lifecycle.dispose();
    vi.advanceTimersByTime(200);

    expect(timeout).not.toHaveBeenCalled();
    expect(interval).not.toHaveBeenCalled();
  });

  it('dispose 会取消尚未执行的 rAF', () => {
    let frameCallback: FrameRequestCallback | null = null;
    const cancelFrame = vi.fn();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frameCallback = callback;
      return 7;
    });
    vi.stubGlobal('cancelAnimationFrame', cancelFrame);

    const lifecycle = createLifecycle();
    lifecycle.requestFrame(() => {});
    expect(frameCallback).not.toBeNull();
    lifecycle.dispose();

    expect(cancelFrame).toHaveBeenCalledWith(7);
  });
});

describe('dispose', () => {
  it('支持 dispose / destroy / 函数 / 数组 / 空值', () => {
    const calls: string[] = [];
    const disposable = { dispose: () => calls.push('dispose') };
    const destroyable = { destroy: () => calls.push('destroy') };
    const cleanup = (): void => {
      calls.push('function');
    };

    dispose(disposable, destroyable, cleanup, [disposable, null, undefined]);

    expect(calls).toEqual(['dispose', 'destroy', 'function', 'dispose']);
  });

  it('单个清理失败不会阻断后续清理', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const calls: string[] = [];

    dispose(
      {
        dispose: () => {
          throw new Error('boom');
        },
      },
      () => calls.push('next'),
    );

    expect(calls).toEqual(['next']);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
