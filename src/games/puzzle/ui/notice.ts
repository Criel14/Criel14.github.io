/**
 * 非阻塞提示（toast）。
 *
 * 用于加载状态、存储错误、录像损坏等不需要用户立即响应的场景。
 * 提示不抢焦点、不创建模态层；错误提示使用 role="alert"，其余使用 role="status"。
 */

export type NoticeType = 'info' | 'success' | 'warning' | 'error' | 'loading';

export interface NoticeOptions {
  readonly type?: NoticeType;
  readonly title?: string;
  readonly message: string;
  /** 毫秒；null 表示常驻。缺省按类型取默认时长。 */
  readonly duration?: number | null;
  /** 稳定 id：相同 id 重复 show 会更新同一条提示。 */
  readonly id?: string;
  /** 是否显示关闭按钮；默认 true。 */
  readonly dismissible?: boolean;
}

export interface NoticeUpdate {
  readonly type?: NoticeType;
  /** null 表示清除标题；不传则保留原标题。 */
  readonly title?: string | null;
  readonly message?: string;
  /**
   * 不传时按当前类型取默认时长。
   * 需要保留自定义时长时，更新时请一并传入。
   */
  readonly duration?: number | null;
  readonly dismissible?: boolean;
}

export interface NoticeHandle {
  readonly id: string;
  readonly element: HTMLElement;
  update(patch: NoticeUpdate): void;
  dismiss(): void;
}

export interface NotifierOptions {
  readonly parent?: HTMLElement;
  /** 页面生命周期 signal；中止时移除容器和全部提示。 */
  readonly signal?: AbortSignal;
}

export interface Notifier {
  show(options: NoticeOptions): NoticeHandle;
  dismiss(id: string): void;
  dismissAll(): void;
  destroy(): void;
}

/** 与 data/errors.ts 的 DataStoreErrorCode 保持一致；UI 不直接依赖 data 层。 */
export type StorageNoticeCode =
  'unavailable' | 'blocked' | 'quota' | 'validation' | 'corrupt' | 'unknown';

export interface StorageNoticeContent {
  readonly type: NoticeType;
  readonly title: string;
  readonly message: string;
  readonly duration: number | null;
}

export const NOTICE_DEFAULT_DURATIONS: Readonly<Record<NoticeType, number | null>> = {
  info: 4_000,
  success: 4_000,
  warning: 6_000,
  error: 8_000,
  loading: null,
};

const STORAGE_NOTICES: Readonly<Record<StorageNoticeCode, StorageNoticeContent>> = {
  unavailable: {
    type: 'error',
    title: '存储不可用',
    message: '当前浏览器环境无法访问存储，本次更改无法保存。',
    duration: null,
  },
  blocked: {
    type: 'error',
    title: '存储被占用',
    message: '另一个标签页正在升级数据库，请关闭其他页面后重试。',
    duration: null,
  },
  quota: {
    type: 'error',
    title: '存储空间不足',
    message: '浏览器存储配额已满，请清理旧成绩或录像后重试。',
    duration: null,
  },
  validation: {
    type: 'error',
    title: '数据校验失败',
    message: '待保存的数据不合法，操作已取消。',
    duration: 8_000,
  },
  corrupt: {
    type: 'warning',
    title: '数据已损坏',
    message: '读取到的数据不完整，已跳过损坏部分。',
    duration: 8_000,
  },
  unknown: {
    type: 'error',
    title: '存储操作失败',
    message: '发生未知错误，请稍后重试。',
    duration: 8_000,
  },
};

/** 存储错误码到提示文案的纯映射；页面可以把 DataStoreError.code 直接传进来。 */
export function getStorageNotice(code: StorageNoticeCode): StorageNoticeContent {
  return STORAGE_NOTICES[code] ?? STORAGE_NOTICES.unknown;
}

function resolveDuration(type: NoticeType, duration: number | null | undefined): number | null {
  if (duration === undefined) {
    return NOTICE_DEFAULT_DURATIONS[type];
  }
  return duration;
}

function createInertHandle(id: string): NoticeHandle {
  return {
    id,
    element: document.createElement('div'),
    update(): void {},
    dismiss(): void {},
  };
}

export function createNotifier(options: NotifierOptions = {}): Notifier {
  const parent = options.parent ?? document.body;
  const controller = new AbortController();
  const { signal } = controller;
  const handles = new Map<string, NoticeHandle>();
  let container: HTMLElement | null = null;
  let destroyed = false;
  let nextId = 0;

  function ensureContainer(): HTMLElement {
    if (container === null) {
      container = document.createElement('div');
      container.className = 'puzzle-notices';
      parent.append(container);
    }
    return container;
  }

  function removeEmptyContainer(): void {
    if (container !== null && container.childElementCount === 0) {
      container.remove();
      container = null;
    }
  }

  function show(noticeOptions: NoticeOptions): NoticeHandle {
    const id = noticeOptions.id ?? `notice-${++nextId}`;
    if (destroyed) {
      return createInertHandle(id);
    }

    const existing = handles.get(id);
    if (existing !== undefined) {
      existing.update(noticeOptions);
      return existing;
    }

    const element = document.createElement('div');
    element.dataset.noticeId = id;
    const noticeController = new AbortController();
    const noticeSignal = noticeController.signal;
    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    const content = document.createElement('div');
    content.className = 'puzzle-notice__content';
    const titleElement = document.createElement('p');
    titleElement.className = 'puzzle-notice__title';
    const messageElement = document.createElement('p');
    messageElement.className = 'puzzle-notice__message';
    content.append(titleElement, messageElement);
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'puzzle-notice__close';
    closeButton.setAttribute('aria-label', '关闭提示');
    closeButton.textContent = '×';
    element.append(icon, content, closeButton);

    let type = noticeOptions.type ?? 'info';
    let title = noticeOptions.title ?? null;
    let message = noticeOptions.message;
    let duration = resolveDuration(type, noticeOptions.duration);
    let dismissible = noticeOptions.dismissible ?? true;
    let timerId: ReturnType<typeof globalThis.setTimeout> | null = null;
    let dismissed = false;

    function clearTimer(): void {
      if (timerId !== null) {
        globalThis.clearTimeout(timerId);
        timerId = null;
      }
    }

    function schedule(): void {
      clearTimer();
      if (duration === null || !Number.isFinite(duration) || duration <= 0) {
        return;
      }
      timerId = globalThis.setTimeout(() => {
        timerId = null;
        dismiss();
      }, duration);
    }

    function render(): void {
      element.className = `puzzle-notice puzzle-notice--${type}`;
      element.setAttribute('role', type === 'warning' || type === 'error' ? 'alert' : 'status');
      element.setAttribute('aria-atomic', 'true');
      if (type === 'loading') {
        element.setAttribute('aria-busy', 'true');
      } else {
        element.removeAttribute('aria-busy');
      }

      icon.className = type === 'loading' ? 'puzzle-notice__spinner' : 'puzzle-notice__icon';
      titleElement.hidden = title === null || title === '';
      titleElement.textContent = title ?? '';
      messageElement.textContent = message;
      closeButton.hidden = !dismissible;
    }

    function dismiss(): void {
      if (dismissed) {
        return;
      }
      dismissed = true;
      clearTimer();
      noticeController.abort();
      element.remove();
      handles.delete(id);
      removeEmptyContainer();
    }

    function update(patch: NoticeUpdate): void {
      if (dismissed) {
        return;
      }
      if (patch.type !== undefined) {
        type = patch.type;
      }
      if (patch.title !== undefined) {
        title = patch.title;
      }
      if (patch.message !== undefined) {
        message = patch.message;
      }
      duration = resolveDuration(type, patch.duration);
      if (patch.dismissible !== undefined) {
        dismissible = patch.dismissible;
      }
      render();
      schedule();
    }

    // 用事件委托绑定一次，避免 update 重建关闭按钮时累积监听器。
    element.addEventListener(
      'click',
      (event) => {
        if (!(event.target instanceof Element)) {
          return;
        }
        if (event.target.closest('.puzzle-notice__close') !== null) {
          dismiss();
        }
      },
      { signal: noticeSignal },
    );

    const handle: NoticeHandle = {
      id,
      element,
      update,
      dismiss,
    };

    render();
    ensureContainer().append(element);
    handles.set(id, handle);
    schedule();
    return handle;
  }

  function dismiss(id: string): void {
    handles.get(id)?.dismiss();
  }

  function dismissAll(): void {
    for (const id of [...handles.keys()]) {
      handles.get(id)?.dismiss();
    }
  }

  function destroy(): void {
    if (destroyed) {
      return;
    }
    dismissAll();
    destroyed = true;
    controller.abort();
    if (container !== null) {
      container.remove();
      container = null;
    }
  }

  if (options.signal !== undefined) {
    if (options.signal.aborted) {
      destroy();
    } else {
      options.signal.addEventListener('abort', destroy, { signal, once: true });
    }
  }

  return {
    show,
    dismiss,
    dismissAll,
    destroy,
  };
}

/** 存储错误提示；相同错误码会更新同一条，避免重复刷屏。 */
export function showStorageErrorNotice(notifier: Notifier, code: StorageNoticeCode): NoticeHandle {
  const content = getStorageNotice(code);
  return notifier.show({
    ...content,
    id: `storage-${code}`,
  });
}

/** 回放数据损坏但不阻断页面时的提示。 */
export function showReplayIssueNotice(notifier: Notifier, issueCount?: number): NoticeHandle {
  const detail = issueCount !== undefined && issueCount > 0 ? `（${issueCount} 处问题）` : '';
  return notifier.show({
    id: 'replay-issues',
    type: 'warning',
    title: '录像数据不完整',
    message: `已尽量恢复可播放部分${detail}，部分移动可能缺失。`,
    duration: 8_000,
  });
}
