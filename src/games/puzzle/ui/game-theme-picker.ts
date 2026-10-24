import type { AppearanceState, Theme } from '../types';
import { CUSTOM_THEME_SLOT_COUNT } from '../core/appearance/appearance';
import { createIcon } from '../../../shared/icons/create-icon';
import { createThemePreview, type ThemePreview } from './theme-preview';

/** 主题编辑器入口；新建省略 `theme` 参数，编辑时追加主题 ID。 */
export const GAME_THEME_EDITOR_URL = '/puzzle-game/theme-editor.html';

export interface GameThemePickerOptions {
  readonly root: HTMLElement;
  /** 用户选中某张主题卡时回调；只更新页面 draft，不直接写存储。 */
  readonly onSelect: (themeId: string) => void;
}

/**
 * 设置页主题列表。
 *
 * 负责把 `AppearanceState` 渲染成可选择的卡片、加号卡和上限提示；
 * 不读写存储、不判断脏状态，选择结果交给设置页 controller。
 */
export interface GameThemePicker {
  render(appearance: AppearanceState): void;
  destroy(): void;
}

function createCheck(): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = 'settings-check';
  span.setAttribute('aria-hidden', 'true');
  span.append(createIcon('check'));
  return span;
}

function createThemeCard(
  theme: Theme,
  index: number,
  activeThemeId: string,
  previews: ThemePreview[],
): HTMLElement {
  const card = document.createElement('div');
  card.className = 'theme-card theme-card--game';
  card.classList.add(theme.builtin ? 'theme-card--builtin' : 'theme-card--custom');
  card.dataset.themeId = theme.id;

  const inputId = `game-theme-option-${index}`;
  const input = document.createElement('input');
  input.className = 'theme-card__input';
  input.type = 'radio';
  input.name = 'activeThemeId';
  input.value = theme.id;
  input.id = inputId;
  input.checked = theme.id === activeThemeId;
  input.setAttribute('aria-label', theme.builtin ? `${theme.name}（内置主题）` : theme.name);

  const surface = document.createElement('div');
  surface.className = 'theme-card__surface';

  const previewPanel = document.createElement('div');
  previewPanel.className = 'theme-card__preview';
  previewPanel.setAttribute('aria-hidden', 'true');
  const preview = createThemePreview({ theme, size: 10 });
  previews.push(preview);
  previewPanel.append(preview.element);

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

  surface.append(previewPanel, footer, createCheck());

  const hitarea = document.createElement('label');
  hitarea.className = 'theme-card__hitarea';
  hitarea.htmlFor = inputId;
  hitarea.setAttribute('aria-hidden', 'true');
  surface.append(hitarea);

  card.append(input, surface);

  if (!theme.builtin) {
    const edit = document.createElement('a');
    edit.className = 'theme-card__edit';
    edit.href = `${GAME_THEME_EDITOR_URL}?theme=${encodeURIComponent(theme.id)}`;
    edit.setAttribute('aria-label', `编辑主题：${theme.name}`);
    edit.title = '编辑主题';
    edit.append(createIcon('pencil'));
    card.append(edit);
  }

  return card;
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

export function createGameThemePicker(options: GameThemePickerOptions): GameThemePicker {
  const { root, onSelect } = options;
  let previews: ThemePreview[] = [];
  let currentGrid: HTMLElement | null = null;
  let currentChangeHandler: ((event: Event) => void) | null = null;

  function destroyCurrent(): void {
    for (const preview of previews) {
      preview.destroy();
    }
    previews = [];

    if (currentGrid !== null && currentChangeHandler !== null) {
      currentGrid.removeEventListener('change', currentChangeHandler);
    }
    currentGrid = null;
    currentChangeHandler = null;
    root.replaceChildren();
  }

  function render(appearance: AppearanceState): void {
    destroyCurrent();

    const grid = document.createElement('div');
    grid.className = 'theme-options theme-options--game';

    for (const [index, theme] of appearance.themes.entries()) {
      grid.append(createThemeCard(theme, index, appearance.activeThemeId, previews));
    }

    const customThemeCount = appearance.themes.filter((theme) => !theme.builtin).length;
    grid.append(createAddCard(customThemeCount));

    const handleChange = (event: Event): void => {
      if (!(event.target instanceof HTMLInputElement)) {
        return;
      }
      if (event.target.name !== 'activeThemeId') {
        return;
      }
      onSelect(event.target.value);
    };

    grid.addEventListener('change', handleChange);
    currentGrid = grid;
    currentChangeHandler = handleChange;

    const note = document.createElement('p');
    note.className = 'settings-note theme-add-note';
    note.hidden = customThemeCount < CUSTOM_THEME_SLOT_COUNT;
    note.textContent = `最多创建 ${CUSTOM_THEME_SLOT_COUNT} 个自定义主题。`;

    root.replaceChildren(grid, note);
  }

  return {
    render,
    destroy(): void {
      destroyCurrent();
    },
  };
}
