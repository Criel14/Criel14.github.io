import type { AppearanceState, PuzzleSize, Theme } from '../types';
import {
  CUSTOM_THEME_SLOT_COUNT,
  getFallbackSizes,
  getPreviewSize,
  getThemeCoverage,
} from '../core/appearance/appearance';
import { PUZZLE_SIZES } from '../core/board';
import { createIcon } from '../../../shared/icons/create-icon';
import { openThemeAssignmentDialog } from './theme-assignment-dialog';
import { formatCoverageDetail, formatCoverageSummary } from './theme-coverage';
import { createThemePreview, type ThemePreview } from './theme-preview';

/** 主题编辑器入口；新建省略 `theme` 参数，编辑时追加主题 ID。 */
export const GAME_THEME_EDITOR_URL = '/puzzle-game/theme-editor.html';

export interface GameThemePickerOptions {
  readonly root: HTMLElement;
  /** “应用到”对话框确认后回调；设置页通常立即保存本次分配，异常读取状态除外。 */
  readonly onAssign: (themeId: string, sizes: readonly PuzzleSize[]) => void;
  /**
   * 删除自定义主题；只更新页面 draft，不直接写存储。
   * 调用方需要同步重渲染 picker，删除后的焦点会落到新建主题加号卡。
   */
  readonly onRemove: (themeId: string) => void;
}

/**
 * 设置页主题列表。
 *
 * 负责渲染按阶数覆盖的主题卡、加号卡和回退警告；不读写存储、不判断脏状态。
 * 分配由设置页 controller 立即保存（异常读取状态除外），删除仍进入 draft 等待保存条。
 */
export interface GameThemePicker {
  render(appearance: AppearanceState): void;
  destroy(): void;
}

function createAddCard(customThemeCount: number): HTMLAnchorElement {
  const atLimit = customThemeCount >= CUSTOM_THEME_SLOT_COUNT;

  const addCard = document.createElement('a');
  addCard.className = 'theme-add-card';
  addCard.href = GAME_THEME_EDITOR_URL;
  addCard.setAttribute('aria-label', '新建主题');
  addCard.title = atLimit ? `最多创建 ${CUSTOM_THEME_SLOT_COUNT} 个自定义主题` : '新建主题';
  addCard.append(createIcon('plus'));

  if (atLimit) {
    addCard.classList.add('is-disabled');
    addCard.setAttribute('aria-disabled', 'true');
    addCard.addEventListener('click', (event) => {
      event.preventDefault();
    });
  }

  return addCard;
}

function createFallbackWarning(sizes: readonly PuzzleSize[]): HTMLParagraphElement | null {
  if (sizes.length === 0) {
    return null;
  }

  const warning = document.createElement('p');
  warning.className = 'theme-fallback-warning';
  warning.textContent = `${formatCoverageDetail(sizes)} 未选择主题，请点击下方主题卡为这些阶数选择主题。`;
  return warning;
}

function createThemeCard(
  theme: Theme,
  appearance: AppearanceState,
  previews: ThemePreview[],
  onOpen: () => void,
  onRemove: () => void,
): HTMLElement {
  const coverage = getThemeCoverage(appearance, theme.id);
  const coverageSummary = formatCoverageSummary(coverage);
  const coverageDetail = formatCoverageDetail(coverage);
  const inUse = coverage.length > 0;

  const card = document.createElement('div');
  card.className = 'theme-card theme-card--game';
  card.classList.add(theme.builtin ? 'theme-card--builtin' : 'theme-card--custom');
  if (inUse) {
    card.classList.add('theme-card--in-use');
  }
  card.dataset.themeId = theme.id;

  const surface = document.createElement('div');
  surface.className = 'theme-card__surface';

  const previewPanel = document.createElement('div');
  previewPanel.className = 'theme-card__preview';
  previewPanel.setAttribute('aria-hidden', 'true');
  const preview = createThemePreview({ theme, size: getPreviewSize(theme) });
  previews.push(preview);
  previewPanel.append(preview.element);
  surface.append(previewPanel);

  if (coverageSummary.length > 0) {
    const badge = document.createElement('span');
    badge.className = 'theme-card__coverage';
    badge.setAttribute('aria-hidden', 'true');
    badge.textContent = coverageSummary;
    badge.title = `已应用到 ${coverageDetail}`;
    surface.append(badge);
  }

  const footer = document.createElement('div');
  footer.className = 'theme-card__footer';

  const title = document.createElement('span');
  title.className = 'theme-card__title';
  title.textContent = theme.name;
  title.title = theme.name;
  footer.append(title);

  if (theme.builtin) {
    const badge = document.createElement('span');
    badge.className = 'settings-badge';
    badge.textContent = '内置';
    footer.append(badge);
  }

  surface.append(footer);

  const hitarea = document.createElement('button');
  hitarea.type = 'button';
  hitarea.className = 'theme-card__hitarea';
  hitarea.dataset.themeId = theme.id;
  hitarea.setAttribute('aria-haspopup', 'dialog');
  const coverageLabel =
    coverage.length === 0
      ? '未应用到任何阶数'
      : coverage.length === PUZZLE_SIZES.length
        ? '已应用到所有阶数'
        : `已应用到 ${coverageDetail}`;
  hitarea.setAttribute(
    'aria-label',
    `${theme.name}，${theme.builtin ? '内置主题' : '自定义主题'}，${coverageLabel}；打开应用到对话框`,
  );
  hitarea.addEventListener('click', onOpen);
  surface.append(hitarea);

  card.append(surface);

  if (!theme.builtin) {
    const actions = document.createElement('div');
    actions.className = 'theme-card__actions';

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'theme-card__delete';
    remove.setAttribute('aria-label', `删除主题：${theme.name}`);
    remove.title = '删除主题';
    remove.append(createIcon('trash-2'));
    remove.addEventListener('click', onRemove);

    const edit = document.createElement('a');
    edit.className = 'theme-card__edit';
    edit.href = `${GAME_THEME_EDITOR_URL}?theme=${encodeURIComponent(theme.id)}`;
    edit.setAttribute('aria-label', `编辑主题：${theme.name}`);
    edit.title = '编辑主题';
    edit.append(createIcon('pencil'));

    actions.append(remove, edit);
    card.append(actions);
  }

  return card;
}

export function createGameThemePicker(options: GameThemePickerOptions): GameThemePicker {
  const { root, onAssign, onRemove } = options;
  let previews: ThemePreview[] = [];
  let currentAppearance: AppearanceState | null = null;

  function destroyCurrent(): void {
    for (const preview of previews) {
      preview.destroy();
    }
    previews = [];
    currentAppearance = null;
    root.replaceChildren();
  }

  /** 对话框重渲染后，把焦点放回同一张主题卡的新按钮。 */
  function focusThemeCard(themeId: string): void {
    const buttons = root.querySelectorAll<HTMLButtonElement>('.theme-card__hitarea');
    for (const button of buttons) {
      if (button.dataset.themeId === themeId) {
        button.focus();
        return;
      }
    }
  }

  function openAssignment(theme: Theme): void {
    const appearance = currentAppearance;
    if (appearance === null) {
      return;
    }

    void openThemeAssignmentDialog({ theme, appearance }).then((sizes) => {
      if (sizes === null) {
        return;
      }
      onAssign(theme.id, sizes);
      focusThemeCard(theme.id);
    });
  }

  /**
   * 删除后整张卡消失，原触发按钮也会被销毁；焦点改放到加号卡，
   * 避免重新渲染后掉到 body。
   */
  function removeTheme(theme: Theme): void {
    onRemove(theme.id);
    root.querySelector<HTMLElement>('.theme-add-card')?.focus();
  }

  function render(appearance: AppearanceState): void {
    destroyCurrent();
    currentAppearance = appearance;

    const fallbackWarning = createFallbackWarning(getFallbackSizes(appearance));

    const grid = document.createElement('div');
    grid.className = 'theme-options theme-options--game';

    for (const theme of appearance.themes) {
      grid.append(
        createThemeCard(
          theme,
          appearance,
          previews,
          () => {
            openAssignment(theme);
          },
          () => {
            removeTheme(theme);
          },
        ),
      );
    }

    const customThemeCount = appearance.themes.filter((theme) => !theme.builtin).length;
    grid.append(createAddCard(customThemeCount));

    const note = document.createElement('p');
    note.className = 'settings-note theme-add-note';
    note.hidden = customThemeCount < CUSTOM_THEME_SLOT_COUNT;
    note.textContent = `最多创建 ${CUSTOM_THEME_SLOT_COUNT} 个自定义主题。`;

    root.replaceChildren(...(fallbackWarning === null ? [] : [fallbackWarning]), grid, note);
  }

  return {
    render,
    destroy(): void {
      destroyCurrent();
    },
  };
}
