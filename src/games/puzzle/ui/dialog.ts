/**
 * 基于原生 <dialog> 的对话框封装。
 *
 * 只负责弹层结构、关闭语义和焦点回收，不处理业务表单与存储。
 * `createDialog` 供设置框等复杂内容复用；`confirmDialog` 是确认框快捷入口。
 */

export type DialogCloseReason = 'confirm' | 'cancel' | 'escape' | 'dispose';

export interface DialogAction {
  readonly label: string;
  readonly variant?: 'primary' | 'danger' | 'secondary';
  /**
   * 返回 false 阻止关闭。
   * 需要异步保存时由页面调用 setBusy(true)，完成后再 close()。
   */
  readonly onClick?: () => boolean | void;
}

export interface DialogOptions {
  readonly title: string;
  /** 字符串按纯文本渲染；Node 用于设置表单等复杂内容。 */
  readonly content?: string | Node;
  readonly actions?: readonly DialogAction[];
  /** 为 false 时不显示关闭按钮，并忽略 Esc。 */
  readonly dismissible?: boolean;
  /** 打开后的焦点目标；缺省聚焦 [autofocus] 或第一个可聚焦元素。 */
  readonly initialFocus?: HTMLElement | (() => HTMLElement | null);
  readonly onClose?: (reason: DialogCloseReason) => void;
  /** 页面生命周期 signal；中止时自动关闭并移除。 */
  readonly signal?: AbortSignal;
}

export interface DialogHandle {
  readonly element: HTMLDialogElement;
  /** 供页面填充复杂内容。 */
  readonly body: HTMLElement;
  show(): void;
  close(reason?: 'confirm' | 'cancel'): void;
  /** 保存等异步操作期间禁用按钮并阻止 Esc。 */
  setBusy(busy: boolean): void;
  destroy(): void;
}

export interface ConfirmDialogOptions {
  readonly title?: string;
  readonly message: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  /** 危险操作使用红色确认按钮，并默认聚焦取消。 */
  readonly danger?: boolean;
  readonly signal?: AbortSignal;
}

let nextDialogId = 0;

export function createDialog(options: DialogOptions): DialogHandle {
  const dismissible = options.dismissible ?? true;
  const dialogId = ++nextDialogId;
  const titleId = `puzzle-dialog-title-${dialogId}`;
  const bodyId = `puzzle-dialog-body-${dialogId}`;
  const controller = new AbortController();
  const { signal } = controller;

  let destroyed = false;
  /** true 表示当前没有打开的会话；show() 时置为 false。 */
  let settled = true;
  let busy = false;
  let previouslyFocused: HTMLElement | null = null;

  const dialog = document.createElement('dialog');
  dialog.className = 'puzzle-dialog';
  dialog.setAttribute('aria-labelledby', titleId);
  if (typeof options.content === 'string') {
    dialog.setAttribute('aria-describedby', bodyId);
  }

  const header = document.createElement('div');
  header.className = 'puzzle-dialog__header';

  const titleElement = document.createElement('h2');
  titleElement.className = 'puzzle-dialog__title';
  titleElement.id = titleId;
  titleElement.textContent = options.title;
  header.append(titleElement);

  let closeButton: HTMLButtonElement | null = null;
  if (dismissible) {
    closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'puzzle-dialog__close';
    closeButton.setAttribute('aria-label', '关闭对话框');
    closeButton.textContent = '×';
    closeButton.addEventListener('click', () => finish('cancel'), { signal });
    header.append(closeButton);
  }

  const body = document.createElement('div');
  body.className = 'puzzle-dialog__body';
  body.id = bodyId;
  if (typeof options.content === 'string') {
    body.textContent = options.content;
  } else if (options.content !== undefined) {
    body.append(options.content);
  }

  const actions = options.actions ?? [];
  const actionButtons: HTMLButtonElement[] = [];
  let footer: HTMLElement | null = null;
  if (actions.length > 0) {
    footer = document.createElement('div');
    footer.className = 'puzzle-dialog__footer';

    for (const action of actions) {
      const variant = action.variant ?? 'secondary';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `puzzle-button puzzle-button--${variant}`;
      button.dataset.dialogAction = variant;
      button.textContent = action.label;
      button.addEventListener(
        'click',
        () => {
          if (settled || busy) {
            return;
          }
          const result = action.onClick?.();
          if (result === false) {
            return;
          }
          finish(variant === 'secondary' ? 'cancel' : 'confirm');
        },
        { signal },
      );
      actionButtons.push(button);
      footer.append(button);
    }
  }

  dialog.append(header, body);
  if (footer !== null) {
    dialog.append(footer);
  }
  document.body.append(dialog);

  dialog.addEventListener(
    'cancel',
    (event) => {
      // 统一由 finish 处理，避免 Esc 与按钮产生两套关闭路径。
      event.preventDefault();
      if (settled || busy || !dismissible) {
        return;
      }
      finish('escape');
    },
    { signal },
  );

  dialog.addEventListener(
    'close',
    () => {
      // 外部直接调用 dialog.close() 时也按取消处理。
      // onClose 中同步重新 show() 时，旧的 close 事件可能晚于新会话，
      // 此时 dialog.open 为 true，不能把新会话关掉。
      if (settled || dialog.open) {
        return;
      }
      finish('cancel');
    },
    { signal },
  );

  function applyBusy(value: boolean): void {
    busy = value;
    if (value) {
      dialog.setAttribute('aria-busy', 'true');
    } else {
      dialog.removeAttribute('aria-busy');
    }
    for (const button of actionButtons) {
      button.disabled = value;
    }
    if (closeButton !== null) {
      closeButton.disabled = value;
    }
  }

  function resolveInitialFocus(): HTMLElement | null {
    const configured = options.initialFocus;
    if (typeof configured === 'function') {
      const element = configured();
      if (element !== null && element.isConnected) {
        return element;
      }
    } else if (configured !== undefined && configured.isConnected) {
      return configured;
    }

    const autofocus = dialog.querySelector<HTMLElement>('[autofocus]');
    if (autofocus !== null) {
      return autofocus;
    }
    return dialog.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
  }

  function finish(reason: DialogCloseReason): void {
    if (destroyed || settled) {
      return;
    }
    settled = true;
    applyBusy(false);

    if (dialog.open) {
      dialog.close(reason === 'confirm' ? 'confirm' : reason);
    }

    // 原生 dialog 会尝试恢复焦点；这里显式处理，保证触发元素被重新渲染时行为一致。
    const focusTarget = previouslyFocused;
    previouslyFocused = null;
    if (focusTarget !== null && focusTarget.isConnected && focusTarget !== document.body) {
      focusTarget.focus();
    }

    try {
      options.onClose?.(reason);
    } catch (error) {
      console.error('对话框关闭回调执行失败', error);
    }
  }

  function show(): void {
    if (destroyed || dialog.open) {
      return;
    }

    settled = false;
    applyBusy(false);
    previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();

    const focusTarget = resolveInitialFocus();
    focusTarget?.focus();
  }

  function close(reason: 'confirm' | 'cancel' = 'cancel'): void {
    if (destroyed) {
      return;
    }
    finish(reason);
  }

  function destroy(): void {
    if (destroyed) {
      return;
    }
    if (!settled) {
      finish('dispose');
    }
    destroyed = true;
    controller.abort();
    dialog.remove();
  }

  if (options.signal !== undefined) {
    if (options.signal.aborted) {
      destroy();
    } else {
      options.signal.addEventListener('abort', destroy, { signal, once: true });
    }
  }

  return {
    element: dialog,
    body,
    show,
    close,
    setBusy: applyBusy,
    destroy,
  };
}

/**
 * 确认框快捷入口：确认返回 true，取消、Esc、dispose 或 signal 中止返回 false。
 * 关闭后自动销毁 DOM 和监听器。
 */
export function confirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  if (options.signal?.aborted === true) {
    return Promise.resolve(false);
  }

  return new Promise<boolean>((resolve) => {
    let handle: DialogHandle | null = null;
    let settled = false;

    function settle(confirmed: boolean): void {
      if (settled) {
        return;
      }
      settled = true;
      resolve(confirmed);
    }

    handle = createDialog({
      title: options.title ?? '请确认',
      content: options.message,
      dismissible: true,
      actions: [
        {
          label: options.cancelLabel ?? '取消',
          variant: 'secondary',
        },
        {
          label: options.confirmLabel ?? '确定',
          variant: options.danger === true ? 'danger' : 'primary',
        },
      ],
      initialFocus: () => {
        if (handle === null) {
          return null;
        }
        const selector =
          options.danger === true
            ? '[data-dialog-action="secondary"]'
            : '[data-dialog-action="primary"], [data-dialog-action="danger"]';
        return handle.element.querySelector<HTMLElement>(selector);
      },
      onClose: (reason) => {
        settle(reason === 'confirm');
        handle?.destroy();
      },
      signal: options.signal,
    });

    handle.show();
  });
}
