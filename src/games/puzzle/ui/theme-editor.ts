import type { AppearanceState, PuzzleSize, Theme } from '../types';
import { PUZZLE_SIZES } from '../core/board';
import {
  cloneAppearance,
  createCustomThemeDraft,
  CUSTOM_THEME_SLOT_COUNT,
  getPreviewSize,
  isThemeEqual,
  upsertCustomTheme,
} from '../core/appearance/appearance';
import {
  applyBrushToTheme,
  changeThemeColorMode,
  formatSizeList,
  isThemeDirty,
  prepareThemeForEditor,
  readBrushFromTheme,
  validateTheme,
  type ThemeBrush,
  type ThemeValidationIssue,
} from '../core/appearance/editor';
import { DEFAULT_THEME_NAME, normalizeThemeName } from '../core/appearance/name';
import {
  BUILTIN_THEMES,
  DEFAULT_BLIND_TILE_COLOR,
  FALLBACK_THEME_ID,
} from '../core/appearance/presets';
import { cloneTheme } from '../core/appearance/theme';
import {
  loadAppearanceResult,
  normalizeAppearance,
  saveAppearance,
  type AppearanceLoadResult,
} from '../data/appearance-store';
import { createThemeEditorBoard, type ThemeEditorBoard } from './theme-editor-board';
import {
  createThemeEditorControls,
  type ThemeEditorControls,
  type ThemeEditorTool,
} from './theme-editor-controls';
import { createThemeHistory, type ThemeHistory } from './theme-history';

type ThemeEditorKind = 'new' | 'edit';

interface ThemeEditorElements {
  readonly editor: HTMLElement;
  readonly fatal: HTMLElement;
  readonly fatalMessage: HTMLElement;
  readonly loadBanner: HTMLElement;
  readonly controlsRoot: HTMLElement;
  readonly previewBoard: HTMLElement;
  readonly undoButton: HTMLButtonElement;
  readonly redoButton: HTMLButtonElement;
  readonly savebar: HTMLElement;
  readonly saveHint: HTMLElement;
  readonly saveError: HTMLElement;
  readonly resetButton: HTMLButtonElement;
  readonly saveButton: HTMLButtonElement;
  readonly saveLabel: HTMLElement;
  readonly liveRegion: HTMLElement;
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`主题编辑器缺少元素：${selector}`);
  }
  return element;
}

function getElements(): ThemeEditorElements {
  return {
    editor: requireElement<HTMLElement>('[data-editor]'),
    fatal: requireElement<HTMLElement>('[data-fatal]'),
    fatalMessage: requireElement<HTMLElement>('[data-fatal-message]'),
    loadBanner: requireElement<HTMLElement>('[data-load-banner]'),
    controlsRoot: requireElement<HTMLElement>('[data-theme-editor-controls]'),
    previewBoard: requireElement<HTMLElement>('[data-preview-board]'),
    undoButton: requireElement<HTMLButtonElement>('[data-editor-action="undo"]'),
    redoButton: requireElement<HTMLButtonElement>('[data-editor-action="redo"]'),
    savebar: requireElement<HTMLElement>('[data-savebar]'),
    saveHint: requireElement<HTMLElement>('[data-save-hint]'),
    saveError: requireElement<HTMLElement>('[data-save-error]'),
    resetButton: requireElement<HTMLButtonElement>('[data-action="reset"]'),
    saveButton: requireElement<HTMLButtonElement>('[data-action="save"]'),
    saveLabel: requireElement<HTMLElement>('[data-save-label]'),
    liveRegion: requireElement<HTMLElement>('[data-live-region]'),
  };
}

function renderLoadStatus(banner: HTMLElement, result: AppearanceLoadResult): void {
  const messages: string[] = [];

  switch (result.issue) {
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

  if (result.status === 'unavailable') {
    messages.push('浏览器存储不可用，修改可能无法保存。');
  }

  banner.hidden = messages.length === 0;
  banner.textContent = messages.join('\n');
}

function showFatal(elements: ThemeEditorElements, message: string): void {
  elements.editor.hidden = true;
  elements.fatal.hidden = false;
  elements.fatalMessage.textContent = message;
  elements.savebar.hidden = true;
  elements.undoButton.disabled = true;
  elements.redoButton.disabled = true;
}

function createThemeId(appearance: AppearanceState): string {
  const existing = new Set(appearance.themes.map((theme) => theme.id));
  let id: string;
  do {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      id = `custom-${globalThis.crypto.randomUUID()}`;
    } else {
      id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }
  } while (existing.has(id));
  return id;
}

function getInitialBrush(theme: Theme): ThemeBrush {
  return (
    readBrushFromTheme(theme, 1, getPreviewSize(theme)) ?? {
      background: DEFAULT_BLIND_TILE_COLOR,
      fontColor: '#ffffff',
    }
  );
}

function replaceThemeParam(themeId: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set('theme', themeId);
  try {
    window.history.replaceState(window.history.state, '', url);
  } catch {
    // file:// 或沙箱 iframe 可能禁止修改地址；保存本身已成功，不阻断页面。
  }
}

/** 解析 `?theme=`：null 表示新建，空字符串表示非法参数。 */
function readThemeParam(): string | null {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('theme')) {
    return null;
  }
  return (params.get('theme') ?? '').trim();
}

/** 编辑器页面入口：加载存储、组装控件/棋盘、维护草稿和历史。 */
export function mountThemeEditor(): void {
  const elements = getElements();
  const loadResult = loadAppearanceResult();
  renderLoadStatus(elements.loadBanner, loadResult);

  let appearance = cloneAppearance(loadResult.appearance);
  const rawThemeId = readThemeParam();

  if (rawThemeId === '') {
    showFatal(elements, '主题参数不合法，请返回游戏主题设置重新选择。');
    return;
  }

  if (rawThemeId !== null) {
    if (
      rawThemeId === FALLBACK_THEME_ID ||
      BUILTIN_THEMES.some((theme) => theme.id === rawThemeId)
    ) {
      showFatal(elements, '内置主题不可编辑，请返回游戏主题设置选择或新建自定义主题。');
      return;
    }
    if (!appearance.themes.some((theme) => theme.id === rawThemeId && !theme.builtin)) {
      showFatal(elements, '找不到要编辑的主题，可能已被删除或外观数据已损坏。');
      return;
    }
  } else if (
    appearance.themes.filter((theme) => !theme.builtin).length >= CUSTOM_THEME_SLOT_COUNT
  ) {
    showFatal(
      elements,
      `最多创建 ${CUSTOM_THEME_SLOT_COUNT} 个自定义主题。请返回游戏主题设置选择已有主题。`,
    );
    return;
  }

  let kind: ThemeEditorKind = rawThemeId === null ? 'new' : 'edit';
  const themeId = rawThemeId ?? createThemeId(appearance);

  let draft: Theme;
  if (kind === 'new') {
    draft = prepareThemeForEditor(createCustomThemeDraft(themeId, DEFAULT_THEME_NAME));
  } else {
    const targetTheme = appearance.themes.find((theme) => theme.id === themeId);
    if (targetTheme === undefined) {
      // 理论上前面已经拦截；保留兜底，避免损坏数据导致未捕获异常。
      showFatal(elements, '找不到要编辑的主题，可能已被删除或外观数据已损坏。');
      return;
    }
    draft = prepareThemeForEditor(targetTheme);
  }
  let baseline = cloneTheme(draft);

  const history: ThemeHistory = createThemeHistory(draft);
  let brush = getInitialBrush(draft);
  let tool: ThemeEditorTool = 'bucket';
  let saving = false;

  const board: ThemeEditorBoard = createThemeEditorBoard({
    root: elements.previewBoard,
    theme: draft,
    size: getPreviewSize(draft),
    onPick(tile) {
      pickTile(tile);
    },
  });

  const controls: ThemeEditorControls = createThemeEditorControls({
    root: elements.controlsRoot,
    onNameInput(name) {
      const next = { ...draft, name };
      if (isThemeEqual(draft, next)) {
        return;
      }
      draft = next;
      history.commit(draft, { mergeKey: 'name' });
      clearSaveError();
      refreshSavebar();
      refreshHistoryButtons();
    },
    onNameBlur() {
      history.breakMerge();
    },
    onSizesChange(sizes) {
      const next: Theme = {
        ...draft,
        supportedSizes: [...sizes].sort((a, b) => a - b),
      };
      if (isThemeEqual(draft, next)) {
        updateSizeValidation();
        return;
      }
      draft = next;
      history.commit(draft);
      renderAll();
    },
    onModeChange(mode) {
      const next = changeThemeColorMode(draft, mode);
      if (next === draft) {
        return;
      }
      draft = next;
      history.commit(draft);
      renderAll();
      // 切换会重置整块色板，明确提示可以撤销，避免用户误触后以为颜色丢失。
      announce('已切换着色模式，颜色已重置；可按 Ctrl/Cmd+Z 撤销。');
    },
    onBrushChange(nextBrush) {
      brush = nextBrush;
    },
    onToolChange(nextTool) {
      tool = nextTool;
    },
    onStyleChange(nextTheme, styleOptions) {
      const changed = !isThemeEqual(draft, nextTheme);
      draft = nextTheme;
      if (changed) {
        history.commit(
          draft,
          styleOptions.mergeKey === undefined ? undefined : { mergeKey: styleOptions.mergeKey },
        );
        board.setTheme(draft);
        controls.setStyleError(null);
        clearSaveError();
        refreshSavebar();
        refreshHistoryButtons();
      }
      if (styleOptions.final) {
        history.breakMerge();
      }
    },
  });

  function getUsedSizes(): readonly PuzzleSize[] {
    return PUZZLE_SIZES.filter((size) => appearance.themeIdBySize[size] === draft.id);
  }

  function announce(message: string): void {
    elements.liveRegion.textContent = message;
  }

  function clearSaveError(): void {
    elements.saveError.hidden = true;
    elements.saveError.textContent = '';
  }

  function showSaveError(message: string): void {
    elements.saveError.textContent = message;
    elements.saveError.hidden = false;
  }

  function refreshHistoryButtons(): void {
    elements.undoButton.disabled = saving || !history.canUndo();
    elements.redoButton.disabled = saving || !history.canRedo();
  }

  /** 使用中但已被取消勾选的阶数；这些阶数会阻止保存。 */
  function getBlockedSizes(): readonly PuzzleSize[] {
    return getUsedSizes().filter((size) => !draft.supportedSizes.includes(size));
  }

  function refreshSavebar(): void {
    const dirty = isThemeDirty(baseline, draft);
    const blockedSizes = getBlockedSizes();
    const blocked = blockedSizes.length > 0;
    elements.savebar.hidden = !dirty;
    if (!dirty) {
      clearSaveError();
    }
    elements.saveHint.textContent = blocked
      ? `该主题正在用于 ${formatSizeList(blockedSizes)}，当前无法保存；请先在设置页为这些阶数选择其他主题。`
      : '你有未保存的修改。';
    elements.resetButton.disabled = saving;
    elements.saveButton.disabled = saving || blocked;
    refreshHistoryButtons();
  }

  function updateSizeValidation(): void {
    const issues = validateTheme(draft, {
      existingThemes: appearance.themes,
      themeIdBySize: appearance.themeIdBySize,
      isNew: kind === 'new',
    });
    // “使用中”不再显示内联错误，改由保存条说明原因并禁用保存按钮。
    const issue = issues.find((item) => item.field === 'supportedSizes');
    controls.setSizesError(issue?.message ?? null);
  }

  function syncBoardAndPreview(): void {
    board.setSize(getPreviewSize(draft));
    board.setTheme(draft);
  }

  function renderAll(): void {
    clearSaveError();
    controls.render(draft, {
      brush,
      tool,
      usedSizes: getUsedSizes(),
    });
    syncBoardAndPreview();
    updateSizeValidation();
    refreshSavebar();
  }

  function undo(): void {
    if (saving) {
      return;
    }
    const next = history.undo();
    if (next === null) {
      return;
    }
    history.breakMerge();
    draft = next;
    renderAll();
    announce('已撤销。');
  }

  function redo(): void {
    if (saving) {
      return;
    }
    const next = history.redo();
    if (next === null) {
      return;
    }
    history.breakMerge();
    draft = next;
    renderAll();
    announce('已重做。');
  }

  function reset(): void {
    if (saving) {
      return;
    }
    const next = cloneTheme(baseline);
    if (!isThemeEqual(draft, next)) {
      draft = next;
      history.commit(draft);
    }
    renderAll();
    announce('已恢复上次保存的主题。');
  }

  function pickTile(tile: number): void {
    if (saving) {
      return;
    }
    const previewSize = getPreviewSize(draft);

    if (tool === 'eyedropper') {
      const nextBrush = readBrushFromTheme(draft, tile, previewSize);
      if (nextBrush === null) {
        return;
      }
      brush = nextBrush;
      // 取色完成后自动切回油漆桶，方便紧接着把颜色涂到目标方块。
      tool = 'bucket';
      controls.renderBrush(brush);
      controls.renderTool(tool);
      announce('已取色，已切换到油漆桶。');
      return;
    }

    const next = applyBrushToTheme(draft, tile, previewSize, brush);
    if (next === draft) {
      return;
    }
    draft = next;
    history.commit(draft);
    board.setTheme(draft);
    controls.setStyleError(null);
    clearSaveError();
    refreshSavebar();
    refreshHistoryButtons();
  }

  function setSaving(value: boolean): void {
    saving = value;
    elements.savebar.toggleAttribute('aria-busy', value);
    elements.saveLabel.textContent = value ? '保存中…' : '保存';
    elements.resetButton.disabled = value;
    elements.saveButton.disabled = value;
    refreshHistoryButtons();
  }

  function focusFirstIssue(issues: readonly ThemeValidationIssue[]): void {
    const nameIssue = issues.find((issue) => issue.field === 'name');
    const sizeIssue = issues.find((issue) => issue.field === 'supportedSizes');
    const otherIssue = issues.find(
      (issue) =>
        issue.field !== 'name' && issue.field !== 'supportedSizes' && issue.field !== 'usage',
    );

    controls.setNameError(nameIssue?.message ?? null);
    controls.setSizesError(sizeIssue?.message ?? null);
    controls.setStyleError(otherIssue?.message ?? null);

    if (nameIssue !== undefined) {
      controls.focusName();
    } else if (sizeIssue !== undefined) {
      controls.focusSizes();
    } else if (otherIssue !== undefined) {
      showSaveError(otherIssue.message);
    }
  }

  async function save(): Promise<void> {
    if (saving) {
      return;
    }

    clearSaveError();
    const candidate: Theme = { ...draft, name: normalizeThemeName(draft.name) };
    const issues = validateTheme(candidate, {
      existingThemes: appearance.themes,
      themeIdBySize: appearance.themeIdBySize,
      isNew: kind === 'new',
    });
    if (issues.length > 0) {
      focusFirstIssue(issues);
      // 使用中阶数只通过保存条说明，没有对应的内联错误元素。
      const usageIssue = issues.find((issue) => issue.field === 'usage');
      announce(usageIssue?.message ?? '请先修正标记的问题。');
      refreshSavebar();
      return;
    }

    setSaving(true);
    clearSaveError();

    try {
      const nextAppearance = upsertCustomTheme(appearance, candidate);
      if (kind === 'new' && nextAppearance === appearance) {
        throw new Error('主题未能写入外观数据。');
      }
      saveAppearance(nextAppearance);

      const normalized = normalizeAppearance(nextAppearance);
      const savedTheme = normalized.themes.find((theme) => theme.id === candidate.id);
      if (savedTheme === undefined) {
        throw new Error('主题保存后未能读取。');
      }

      appearance = normalized;
      baseline = cloneTheme(savedTheme);
      draft = cloneTheme(savedTheme);
      history.replaceCurrent(draft);

      const wasNew = kind === 'new';
      kind = 'edit';
      if (wasNew) {
        replaceThemeParam(candidate.id);
      }

      elements.loadBanner.hidden = true;
      elements.loadBanner.textContent = '';
      renderAll();
      announce('主题已保存。');
    } catch (error) {
      console.error('保存主题失败', error);
      showSaveError('保存失败，请检查浏览器存储权限后重试。');
    } finally {
      setSaving(false);
      refreshSavebar();
    }
  }

  elements.undoButton.addEventListener('click', undo);
  elements.redoButton.addEventListener('click', redo);
  elements.resetButton.addEventListener('click', reset);
  elements.saveButton.addEventListener('click', () => {
    void save();
  });
  /*
   * 浏览器 bfcache 会把未保存的草稿和旧控件状态原样恢复；按“离开即丢弃”
   * 的约定重新加载页面，避免用户通过前进/后退绕过显式保存流程。
   */
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      window.location.reload();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (saving || event.isComposing || !(event.ctrlKey || event.metaKey) || event.altKey) {
      return;
    }
    const key = event.key.toLowerCase();
    if (key !== 'z' && key !== 'y') {
      return;
    }

    const isRedo = key === 'y' || event.shiftKey;
    const canRun = isRedo ? history.canRedo() : history.canUndo();
    if (!canRun) {
      return;
    }

    event.preventDefault();
    if (isRedo) {
      redo();
    } else {
      undo();
    }
  });

  // 支持阶数的“使用中”提示来自已保存的分配；编辑器中调整支持范围不会实时改分配。
  elements.editor.hidden = false;
  renderAll();
}
