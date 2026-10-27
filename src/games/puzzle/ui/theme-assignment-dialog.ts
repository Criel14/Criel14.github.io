import type { AppearanceState, PuzzleSize, Theme } from '../types';
import { getThemeForSize } from '../core/appearance/appearance';
import { createDialog, type DialogHandle } from './dialog';
import { formatSizeLabel } from './theme-coverage';

export interface ThemeAssignmentDialogOptions {
  readonly theme: Theme;
  /** 当前设置页 draft；用于判断哪些阶数已经属于该主题。 */
  readonly appearance: AppearanceState;
}

/** 等 CSS 退场动画结束再移除对话框；比 160ms 的过渡略长。 */
const DIALOG_EXIT_MS = 180;

interface AssignmentOption {
  readonly size: PuzzleSize;
  readonly label: HTMLLabelElement;
  readonly input: HTMLInputElement;
  readonly locked: boolean;
}

function createOption(size: PuzzleSize, locked: boolean): AssignmentOption {
  const label = document.createElement('label');
  label.className = 'theme-assignment-option';

  const input = document.createElement('input');
  input.className = 'theme-assignment-option__input';
  input.type = 'checkbox';
  input.value = String(size);
  input.checked = locked;
  input.disabled = locked;
  input.setAttribute(
    'aria-label',
    locked ? `${formatSizeLabel(size)}，当前已应用` : formatSizeLabel(size),
  );

  const text = document.createElement('span');
  text.textContent = formatSizeLabel(size);
  label.append(input, text);

  if (locked) {
    label.classList.add('theme-assignment-option--locked');
  }

  return { size, label, input, locked };
}

/**
 * 打开“应用到”对话框。
 *
 * 只列出主题支持的阶数；已经属于该主题的阶数选中并锁定，其他阶数可自由勾选。
 * 返回 `null` 表示取消/关闭，返回阶数数组表示用户确认。调用方负责立即保存本次
 * 分配并重新渲染，这样对话框关闭后可以把焦点放回新生成的卡片按钮。
 */
export function openThemeAssignmentDialog(
  options: ThemeAssignmentDialogOptions,
): Promise<readonly PuzzleSize[] | null> {
  const supportedSizes = [...options.theme.supportedSizes].sort((a, b) => a - b);
  if (supportedSizes.length === 0) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    let handle: DialogHandle | null = null;
    let confirmedSizes: readonly PuzzleSize[] | null = null;
    const applied = new Set(
      supportedSizes.filter(
        (size) => getThemeForSize(options.appearance, size).id === options.theme.id,
      ),
    );
    const selected = new Set<PuzzleSize>(applied);
    const optionElements: AssignmentOption[] = [];

    const grid = document.createElement('div');
    grid.className = 'theme-assignment-grid';
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', '选择要应用主题的阶数');

    for (const size of supportedSizes) {
      const option = createOption(size, applied.has(size));
      option.input.addEventListener('change', () => {
        if (option.input.checked) {
          selected.add(size);
        } else {
          selected.delete(size);
        }
        updateControls();
      });
      optionElements.push(option);
      grid.append(option.label);
    }

    const selectAllButton = document.createElement('button');
    selectAllButton.type = 'button';
    selectAllButton.className = 'theme-assignment-select-all';
    selectAllButton.textContent = '全选';
    if (supportedSizes.length <= 1) {
      selectAllButton.hidden = true;
    }
    selectAllButton.addEventListener('click', () => {
      if (optionElements.every((option) => option.input.checked)) {
        return;
      }
      for (const option of optionElements) {
        option.input.checked = true;
        selected.add(option.size);
      }
      updateControls();
    });
    grid.append(selectAllButton);

    handle = createDialog({
      title: '请选择应用的阶数',
      content: grid,
      actions: [
        { label: '取消', variant: 'secondary' },
        {
          label: '应用',
          variant: 'primary',
          onClick() {
            confirmedSizes = supportedSizes.filter((size) => selected.has(size));
          },
        },
      ],
      initialFocus: () => {
        const firstEnabled = optionElements.find((option) => !option.locked);
        if (firstEnabled !== undefined) {
          return firstEnabled.input;
        }
        return handle?.element.querySelector<HTMLElement>('[data-dialog-action="primary"]') ?? null;
      },
      onClose(reason) {
        resolve(reason === 'confirm' ? confirmedSizes : null);
        window.setTimeout(() => {
          handle?.destroy();
        }, DIALOG_EXIT_MS);
      },
    });

    handle.element.classList.add('theme-assignment-dialog');
    const confirmButton = handle.element.querySelector<HTMLButtonElement>(
      '[data-dialog-action="primary"]',
    );

    function updateControls(): void {
      const allSelected = optionElements.every((option) => option.input.checked);
      if (confirmButton !== null) {
        confirmButton.disabled = selected.size === 0;
      }
      selectAllButton.setAttribute('aria-disabled', String(allSelected));
    }

    updateControls();
    handle.show();
  });
}
