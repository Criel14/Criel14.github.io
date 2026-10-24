import { createIcon } from '../../../shared/icons/create-icon';
import { applyPreferences } from '../../../shared/preferences/apply';
import { isPreferencesDirty, resetPreferencesDraft } from '../../../shared/preferences/draft';
import {
  loadPreferences,
  normalizePreferences,
  savePreferences,
  type PreferencesReadStatus,
} from '../../../shared/preferences/store';
import type { SitePreferences } from '../../../shared/preferences/types';
import type { AppearanceState } from '../types';
import {
  assignThemeToSizes,
  cloneAppearance,
  isAppearanceEqual,
} from '../core/appearance/appearance';
import {
  loadAppearanceResult,
  normalizeAppearance,
  saveAppearance,
  type AppearanceLoadResult,
} from '../data/appearance-store';
import { createGameThemePicker } from './game-theme-picker';
import {
  SETTINGS_GROUP_LABELS,
  SETTINGS_SECTIONS,
  resolveSettingsSection,
  type SettingsController,
  type SettingsSectionGroup,
  type SettingsSectionId,
} from './settings-sections';

interface SettingsElements {
  readonly nav: HTMLElement;
  readonly sections: readonly HTMLElement[];
  readonly loadBanner: HTMLElement;
  readonly savebar: HTMLElement;
  readonly saveError: HTMLElement;
  readonly resetButton: HTMLButtonElement;
  readonly saveButton: HTMLButtonElement;
  readonly saveLabel: HTMLElement;
  readonly liveRegion: HTMLElement;
  readonly themeInputs: readonly HTMLInputElement[];
  readonly languageInputs: readonly HTMLInputElement[];
  readonly themeNote: HTMLElement;
  readonly gameThemeRoot: HTMLElement;
}

const SETTINGS_GROUPS: readonly SettingsSectionGroup[] = ['display', 'game', 'more'];

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`设置页缺少元素：${selector}`);
  }
  return element;
}

function getElements(): SettingsElements {
  return {
    nav: requireElement<HTMLElement>('[data-settings-nav]'),
    sections: [...document.querySelectorAll<HTMLElement>('[data-settings-section]')],
    loadBanner: requireElement<HTMLElement>('[data-load-banner]'),
    savebar: requireElement<HTMLElement>('[data-savebar]'),
    saveError: requireElement<HTMLElement>('[data-save-error]'),
    resetButton: requireElement<HTMLButtonElement>('[data-action="reset"]'),
    saveButton: requireElement<HTMLButtonElement>('[data-action="save"]'),
    saveLabel: requireElement<HTMLElement>('[data-save-label]'),
    liveRegion: requireElement<HTMLElement>('[data-live-region]'),
    themeInputs: [...document.querySelectorAll<HTMLInputElement>('[data-setting="themeMode"]')],
    languageInputs: [...document.querySelectorAll<HTMLInputElement>('[data-setting="language"]')],
    themeNote: requireElement<HTMLElement>('[data-theme-note]'),
    gameThemeRoot: requireElement<HTMLElement>('[data-game-theme-picker]'),
  };
}

/** 从注册表生成导航，新增分类只改 settings-sections.ts 和对应 section。 */
function renderNavigation(nav: HTMLElement): void {
  const fragment = document.createDocumentFragment();

  for (const group of SETTINGS_GROUPS) {
    const sections = SETTINGS_SECTIONS.filter((section) => section.group === group);
    if (sections.length === 0) {
      continue;
    }

    const groupElement = document.createElement('div');
    groupElement.className = 'settings-nav__group';

    const heading = document.createElement('p');
    heading.className = 'settings-nav__heading';
    heading.textContent = SETTINGS_GROUP_LABELS[group];
    groupElement.append(heading);

    const items = document.createElement('div');
    items.className = 'settings-nav__items';

    for (const section of sections) {
      const link = document.createElement('a');
      link.className = 'settings-nav__link';
      link.href = `#${section.hash}`;
      link.dataset.sectionLink = section.id;
      link.append(createIcon(section.icon));

      const label = document.createElement('span');
      label.textContent = section.label;
      link.append(label);

      items.append(link);
    }

    groupElement.append(items);
    fragment.append(groupElement);
  }

  nav.replaceChildren(fragment);
}

/**
 * 管理分类切换和 hash。
 *
 * 点击分类使用 replaceState，所以浏览器后退会离开设置页；
 * 直接改地址栏 hash 时通过 hashchange 同步内容。
 */
function setupSections(elements: SettingsElements): void {
  const sectionMap = new Map<SettingsSectionId, HTMLElement>();
  for (const section of elements.sections) {
    const id = section.dataset.settingsSection;
    if (id !== undefined) {
      sectionMap.set(id as SettingsSectionId, section);
    }
  }

  for (const definition of SETTINGS_SECTIONS) {
    if (!sectionMap.has(definition.id)) {
      throw new Error(`设置页缺少分类 section：${definition.id}`);
    }
  }

  const links = [...elements.nav.querySelectorAll<HTMLAnchorElement>('[data-section-link]')];

  function activate(id: SettingsSectionId, focus: boolean): void {
    const definition =
      SETTINGS_SECTIONS.find((section) => section.id === id) ?? SETTINGS_SECTIONS[0];

    for (const section of elements.sections) {
      section.hidden = section.dataset.settingsSection !== definition.id;
    }

    for (const link of links) {
      if (link.dataset.sectionLink === definition.id) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    }

    const hash = `#${definition.hash}`;
    if (window.location.hash !== hash) {
      try {
        window.history.replaceState(window.history.state, '', hash);
      } catch {
        // 沙箱 iframe 或 file:// 等环境可能禁止改历史；分类切换本身仍然有效。
      }
    }

    if (focus) {
      const target = sectionMap.get(definition.id);
      target?.querySelector<HTMLElement>('h2')?.focus();
    }
  }

  for (const link of links) {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const id = link.dataset.sectionLink;
      if (id !== undefined) {
        activate(id as SettingsSectionId, true);
      }
    });
  }

  window.addEventListener('hashchange', () => {
    activate(resolveSettingsSection(window.location.hash).id, false);
  });

  activate(resolveSettingsSection(window.location.hash).id, false);
}

function renderLoadStatus(
  banner: HTMLElement,
  preferenceStatus: PreferencesReadStatus,
  appearanceResult: AppearanceLoadResult,
): void {
  const messages: string[] = [];

  if (preferenceStatus === 'corrupt') {
    messages.push('检测到网站偏好数据损坏，已使用可恢复的值；保存后会覆盖原数据。');
  }

  switch (appearanceResult.issue) {
    case 'legacy-version':
    case 'unknown-version':
      messages.push(
        '外观数据版本不兼容，已使用系统回退主题。请清理 puzzle.v2.appearance 后重新选择主题。',
      );
      break;
    case 'invalid-json':
    case 'invalid-envelope':
    case 'invalid-data':
      messages.push(
        '检测到外观数据损坏，已尽量恢复；无法恢复的阶数使用系统回退主题。保存后会覆盖原数据。',
      );
      break;
    case undefined:
      break;
  }

  if (preferenceStatus === 'unavailable' || appearanceResult.status === 'unavailable') {
    messages.push('浏览器存储不可用，修改可能无法保存。');
  }

  banner.hidden = messages.length === 0;
  banner.textContent = messages.join('\n');
}

/**
 * 外观 + 语言共用一个 controller。
 *
 * 两项都属于 `site.v1.preferences`，拆成两个 controller 会导致保存时
 * 写两次存储，无法保证一次保存的一致性。
 */
function createPreferencesController(
  initial: SitePreferences,
  elements: SettingsElements,
  onChange: () => void,
): SettingsController {
  let saved = normalizePreferences(initial);
  let draft = normalizePreferences(initial);

  function syncForm(): void {
    for (const input of elements.themeInputs) {
      input.checked = input.value === draft.themeMode;
    }
    for (const input of elements.languageInputs) {
      input.checked = input.value === draft.language;
    }
    elements.themeNote.hidden = draft.themeMode === 'light';
  }

  function handleChange(): void {
    const themeMode = elements.themeInputs.find((input) => input.checked)?.value;
    const language = elements.languageInputs.find((input) => input.checked)?.value;

    draft = normalizePreferences({
      themeMode: themeMode ?? draft.themeMode,
      language: language ?? draft.language,
    });
    syncForm();
    onChange();
  }

  for (const input of [...elements.themeInputs, ...elements.languageInputs]) {
    input.addEventListener('change', handleChange);
  }

  syncForm();

  return {
    id: 'site-preferences',
    isDirty: () => isPreferencesDirty(saved, draft),
    reset() {
      draft = resetPreferencesDraft(saved);
      syncForm();
    },
    save() {
      savePreferences(draft);
      saved = normalizePreferences(draft);
      draft = resetPreferencesDraft(saved);
      syncForm();
      applyPreferences(saved);
    },
  };
}

/**
 * 主题分配 controller。
 *
 * 维护完整 AppearanceState 的 saved / draft；“应用到”对话框只修改其中的
 * themeIdBySize，保存时再一次性写入完整外观数据。
 */
function createAppearanceController(
  initial: AppearanceState,
  elements: SettingsElements,
  onChange: () => void,
): SettingsController {
  let saved = cloneAppearance(initial);
  let draft = cloneAppearance(initial);

  const picker = createGameThemePicker({
    root: elements.gameThemeRoot,
    onAssign(themeId, sizes) {
      const next = assignThemeToSizes(draft, themeId, sizes);
      if (next === draft) {
        return;
      }
      draft = next;
      picker.render(draft);
      onChange();
    },
  });
  picker.render(saved);

  return {
    id: 'puzzle-theme',
    isDirty: () => !isAppearanceEqual(saved, draft),
    reset() {
      draft = cloneAppearance(saved);
      picker.render(draft);
    },
    save() {
      const normalized = normalizeAppearance(draft);
      saveAppearance(normalized);
      saved = cloneAppearance(normalized);
      draft = cloneAppearance(normalized);
      picker.render(saved);
    },
  };
}

/** 设置页入口：组装导航、偏好/主题 controller 和保存条。 */
export function mountSettingsPage(): void {
  const elements = getElements();
  renderNavigation(elements.nav);

  const loadResult = loadPreferences();
  const appearanceResult = loadAppearanceResult();
  renderLoadStatus(elements.loadBanner, loadResult.status, appearanceResult);
  applyPreferences(loadResult.preferences);

  const controllers: SettingsController[] = [];
  let saving = false;

  function clearError(): void {
    elements.saveError.hidden = true;
    elements.saveError.textContent = '';
  }

  function showError(message: string): void {
    elements.saveError.textContent = message;
    elements.saveError.hidden = false;
  }

  function announce(message: string): void {
    elements.liveRegion.textContent = message;
  }

  function focusActiveSection(): void {
    document.querySelector<HTMLElement>('.settings-section:not([hidden]) h2')?.focus();
  }

  function refreshSavebar(): void {
    const dirty = controllers.some((controller) => controller.isDirty());
    elements.savebar.hidden = !dirty;
    if (!dirty) {
      clearError();
    }
  }

  function setSaving(value: boolean): void {
    saving = value;
    elements.savebar.toggleAttribute('aria-busy', value);
    elements.resetButton.disabled = value;
    elements.saveButton.disabled = value;
    elements.saveLabel.textContent = value ? '保存中…' : '保存';
  }

  async function saveAll(): Promise<void> {
    if (saving) {
      return;
    }

    setSaving(true);
    clearError();

    try {
      for (const controller of controllers) {
        await controller.save();
      }
      elements.loadBanner.hidden = true;
      elements.loadBanner.textContent = '';
      announce('设置已保存。');
      focusActiveSection();
    } catch (error) {
      console.error('保存设置失败', error);
      showError('保存失败，请检查浏览器存储权限后重试。');
    } finally {
      setSaving(false);
      refreshSavebar();
    }
  }

  const handleFormChange = (): void => {
    clearError();
    refreshSavebar();
  };

  const preferencesController = createPreferencesController(
    loadResult.preferences,
    elements,
    handleFormChange,
  );
  controllers.push(preferencesController);

  const appearanceController = createAppearanceController(
    appearanceResult.appearance,
    elements,
    handleFormChange,
  );
  controllers.push(appearanceController);

  elements.resetButton.addEventListener('click', () => {
    if (saving) {
      return;
    }
    for (const controller of controllers) {
      controller.reset();
    }
    clearError();
    refreshSavebar();
    announce('已撤销未保存的修改。');
    focusActiveSection();
  });

  elements.saveButton.addEventListener('click', () => {
    if (saving || !controllers.some((controller) => controller.isDirty())) {
      return;
    }
    void saveAll();
  });

  setupSections(elements);
  refreshSavebar();
}
