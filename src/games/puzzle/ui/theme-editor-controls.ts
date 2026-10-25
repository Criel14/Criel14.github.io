import type { BoardMetrics, ColorMode, PuzzleSize, Theme } from '../types';
import { PUZZLE_SIZES } from '../core/board';
import type { ThemeBrush } from '../core/appearance/editor';
import {
  getThemeNameError,
  getThemeNameWidth,
  THEME_NAME_MAX_WIDTH,
} from '../core/appearance/name';
import { getReadableFontColor } from '../core/appearance/theme';

export type ThemeEditorTool = 'bucket' | 'eyedropper';

export interface ThemeEditorControlsState {
  readonly brush: ThemeBrush;
  readonly tool: ThemeEditorTool;
  readonly usedSizes: readonly PuzzleSize[];
}

export interface ThemeEditorControlsOptions {
  /** 左侧控制面板根元素。 */
  readonly root: HTMLElement;
  readonly onNameInput: (name: string) => void;
  readonly onNameBlur: () => void;
  readonly onSizesChange: (sizes: readonly PuzzleSize[]) => void;
  readonly onModeChange: (mode: ColorMode['mode']) => void;
  readonly onBrushChange: (brush: ThemeBrush) => void;
  readonly onToolChange: (tool: ThemeEditorTool) => void;
  /**
   * 整盘样式控件产生的主题变化。
   * final 为 true 表示一次拖动/选择结束，可以结束连续历史合并。
   */
  readonly onStyleChange: (
    theme: Theme,
    options: { readonly mergeKey?: string; readonly final: boolean },
  ) => void;
}

export interface ThemeEditorControls {
  render(theme: Theme, state: ThemeEditorControlsState): void;
  /** 只更新样式刷，不重建其他控件；吸管读取后使用。 */
  renderBrush(brush: ThemeBrush): void;
  renderTool(tool: ThemeEditorTool): void;
  setNameError(message: string | null): void;
  setSizesError(message: string | null): void;
  setStyleError(message: string | null): void;
  focusName(): void;
  focusSizes(): void;
  destroy(): void;
}

type MetricKey = keyof BoardMetrics;

interface SizeOption {
  readonly size: PuzzleSize;
  readonly input: HTMLInputElement;
  readonly label: HTMLLabelElement;
  readonly badge: HTMLElement;
}

const TOOL_LABELS: Readonly<Record<ThemeEditorTool, string>> = {
  bucket: '油漆桶',
  eyedropper: '吸管',
};

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`主题编辑器缺少元素：${selector}`);
  }
  return element;
}

function formatPercent(value: number, fractionDigits = 0): string {
  return `${(value * 100).toFixed(fractionDigits)}%`;
}

function normalizeHex(value: string, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : fallback;
}

function withMetric(theme: Theme, key: MetricKey, value: number): Theme {
  return {
    ...theme,
    metrics: {
      ...theme.metrics,
      [key]: value,
    },
  };
}

/**
 * 主题编辑器左侧控件。
 *
 * 只负责 DOM、事件和展示；所有主题状态由 controller 持有。样式刷和工具切换
 * 不属于 Theme，不会通过 onStyleChange 写进历史。
 */
export function createThemeEditorControls(
  options: ThemeEditorControlsOptions,
): ThemeEditorControls {
  const { root } = options;
  const controller = new AbortController();
  const { signal } = controller;

  const nameInput = requireElement<HTMLInputElement>(root, '[data-field="name"]');
  const nameCounter = requireElement<HTMLElement>(root, '[data-name-counter]');
  const nameError = requireElement<HTMLElement>(root, '[data-name-error]');
  const sizesRoot = requireElement<HTMLElement>(root, '[data-supported-sizes]');
  const sizesError = requireElement<HTMLElement>(root, '[data-sizes-error]');
  const modeGroup = requireElement<HTMLElement>(root, '[data-mode-group]');
  const brushBackground = requireElement<HTMLInputElement>(root, '[data-brush="background"]');
  const brushFont = requireElement<HTMLInputElement>(root, '[data-brush="fontColor"]');
  const brushBackgroundHex = requireElement<HTMLElement>(root, '[data-brush-background-hex]');
  const brushFontHex = requireElement<HTMLElement>(root, '[data-brush-font-hex]');
  const brushPreview = requireElement<HTMLElement>(root, '[data-brush-preview]');
  const styleError = requireElement<HTMLElement>(root, '[data-style-error]');

  const blindColorInput = requireElement<HTMLInputElement>(root, '[data-color="blindTileColor"]');
  const blindHex = requireElement<HTMLElement>(root, '[data-hex="blindTileColor"]');
  const borderColorInput = requireElement<HTMLInputElement>(
    root,
    '[data-color="innerBorderColor"]',
  );
  const borderHex = requireElement<HTMLElement>(root, '[data-hex="innerBorderColor"]');
  const borderTransparent = requireElement<HTMLInputElement>(
    root,
    '[data-inner-border-transparent]',
  );
  const borderWidth = requireElement<HTMLInputElement>(root, '[data-range="innerBorderWidth"]');
  const fontSize = requireElement<HTMLInputElement>(root, '[data-range="fontSizeRatio"]');
  const gap = requireElement<HTMLInputElement>(root, '[data-range="gapRatio"]');
  const radius = requireElement<HTMLInputElement>(root, '[data-range="radiusRatio"]');

  const modeButtons = [...modeGroup.querySelectorAll<HTMLButtonElement>('[data-mode]')];
  const toolButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-tool]')];

  let theme: Theme | null = null;
  let brush: ThemeBrush = { background: '#3498db', fontColor: '#ffffff' };
  let tool: ThemeEditorTool = 'bucket';
  let borderFallbackColor = '#ffffff';

  const sizeOptions = new Map<PuzzleSize, SizeOption>();

  function createSizeOption(size: PuzzleSize): SizeOption {
    const label = document.createElement('label');
    label.className = 'theme-editor-size';
    label.dataset.size = String(size);

    const input = document.createElement('input');
    input.className = 'theme-editor-size__input';
    input.type = 'checkbox';
    input.value = String(size);
    input.dataset.sizeInput = String(size);

    const surface = document.createElement('span');
    surface.className = 'theme-editor-size__surface';
    const text = document.createElement('span');
    text.textContent = `${size}×${size}`;
    const badge = document.createElement('span');
    badge.className = 'theme-editor-size__badge';
    badge.textContent = '使用中';
    badge.hidden = true;
    surface.append(text, badge);
    label.append(input, surface);

    input.addEventListener(
      'change',
      () => {
        const selected = PUZZLE_SIZES.filter(
          (item) => sizeOptions.get(item)?.input.checked === true,
        );
        if (selected.length === 0) {
          input.checked = true;
          setSizesError('至少选择一个支持的阶数。');
          return;
        }
        options.onSizesChange(selected);
      },
      { signal },
    );

    return { size, input, label, badge };
  }

  for (const size of PUZZLE_SIZES) {
    const option = createSizeOption(size);
    sizeOptions.set(size, option);
    sizesRoot.append(option.label);
  }

  function updateNameDisplay(value: string): void {
    const normalized = value.trim();
    const width = getThemeNameWidth(normalized);
    nameCounter.textContent = `${width} / ${THEME_NAME_MAX_WIDTH}`;
    nameCounter.classList.toggle('is-over-limit', width > THEME_NAME_MAX_WIDTH);
  }

  function setBrush(nextBrush: ThemeBrush): void {
    brush = nextBrush;
    renderBrush(brush);
    options.onBrushChange(brush);
  }

  function emitTheme(
    nextTheme: Theme,
    styleOptions: { readonly mergeKey?: string; readonly final: boolean },
  ): void {
    theme = nextTheme;
    options.onStyleChange(nextTheme, styleOptions);
  }

  function getTheme(): Theme {
    if (theme === null) {
      throw new Error('主题控件尚未初始化');
    }
    return theme;
  }

  function setNameError(message: string | null): void {
    nameError.textContent = message ?? '';
    nameError.hidden = message === null;
    nameInput.setAttribute('aria-invalid', String(message !== null));
  }

  function setSizesError(message: string | null): void {
    sizesError.textContent = message ?? '';
    sizesError.hidden = message === null;
    sizesRoot.classList.toggle('has-error', message !== null);
  }

  function setStyleError(message: string | null): void {
    styleError.textContent = message ?? '';
    styleError.hidden = message === null;
  }

  function currentBorderColor(): string {
    const current = getTheme();
    return current.innerBorder.color === 'transparent'
      ? borderFallbackColor
      : normalizeHex(current.innerBorder.color, borderFallbackColor);
  }

  function updateBorderControls(): void {
    const current = getTheme();
    const transparent = current.innerBorder.color === 'transparent';
    borderTransparent.checked = transparent;
    const color = currentBorderColor();
    if (!transparent) {
      borderFallbackColor = color;
    }
    borderColorInput.value = color;
    borderColorInput.disabled = transparent;
    borderHex.textContent = transparent ? '透明' : color.toUpperCase();
    borderWidth.value = String(current.innerBorder.widthRatio);
    const output = root.querySelector<HTMLElement>('[data-range-value="innerBorderWidth"]');
    if (output !== null) {
      output.textContent = formatPercent(current.innerBorder.widthRatio, 1);
    }
  }

  function updateMetricControls(): void {
    const current = getTheme();
    const entries: readonly [MetricKey, HTMLInputElement, number][] = [
      ['fontSizeRatio', fontSize, 0],
      ['gapRatio', gap, 0],
      ['radiusRatio', radius, 0],
    ];
    for (const [key, input, digits] of entries) {
      const value = current.metrics[key];
      input.value = String(value);
      const output = root.querySelector<HTMLElement>(`[data-range-value="${key}"]`);
      if (output !== null) {
        output.textContent = formatPercent(value, digits);
      }
    }
  }

  function renderBrush(nextBrush: ThemeBrush): void {
    const background = normalizeHex(nextBrush.background, '#3498db');
    const fontColor = normalizeHex(nextBrush.fontColor, getReadableFontColor(background));

    brushBackground.value = background;
    brushBackgroundHex.textContent = background.toUpperCase();
    brushFont.value = fontColor;
    brushFontHex.textContent = fontColor.toUpperCase();
    brushPreview.style.backgroundColor = background;
    brushPreview.style.color = fontColor;
  }

  function renderTools(nextTool: ThemeEditorTool): void {
    tool = nextTool;
    for (const button of toolButtons) {
      const active = button.dataset.tool === nextTool;
      button.setAttribute('aria-pressed', String(active));
      button.classList.toggle('is-active', active);
      const label = button.dataset.tool;
      if (label === 'bucket' || label === 'eyedropper') {
        button.title = TOOL_LABELS[label];
      }
    }
  }

  nameInput.addEventListener(
    'input',
    () => {
      updateNameDisplay(nameInput.value);
      const error = getThemeNameError(nameInput.value);
      setNameError(error);
      options.onNameInput(nameInput.value);
    },
    { signal },
  );
  nameInput.addEventListener('blur', () => options.onNameBlur(), { signal });

  for (const button of modeButtons) {
    button.addEventListener(
      'click',
      () => {
        const mode = button.dataset.mode;
        if (mode === 'layer' || mode === 'row' || mode === 'fixed') {
          options.onModeChange(mode);
        }
      },
      { signal },
    );
  }

  brushBackground.addEventListener(
    'input',
    () => {
      setBrush({ background: brushBackground.value, fontColor: brush.fontColor });
    },
    { signal },
  );
  brushFont.addEventListener(
    'input',
    () => {
      setBrush({ background: brush.background, fontColor: brushFont.value });
    },
    { signal },
  );

  for (const button of toolButtons) {
    button.addEventListener(
      'click',
      () => {
        const value = button.dataset.tool;
        if (value === 'bucket' || value === 'eyedropper') {
          renderTools(value);
          options.onToolChange(value);
        }
      },
      { signal },
    );
  }

  blindColorInput.addEventListener(
    'input',
    () => {
      const current = getTheme();
      emitTheme(
        { ...current, blindTileColor: blindColorInput.value },
        {
          mergeKey: 'blindTileColor',
          final: false,
        },
      );
      blindHex.textContent = blindColorInput.value.toUpperCase();
    },
    { signal },
  );
  blindColorInput.addEventListener(
    'change',
    () => {
      const current = getTheme();
      emitTheme(
        { ...current, blindTileColor: blindColorInput.value },
        {
          mergeKey: 'blindTileColor',
          final: true,
        },
      );
      blindHex.textContent = blindColorInput.value.toUpperCase();
    },
    { signal },
  );

  borderTransparent.addEventListener(
    'change',
    () => {
      const current = getTheme();
      emitTheme(
        {
          ...current,
          innerBorder: {
            ...current.innerBorder,
            color: borderTransparent.checked ? 'transparent' : currentBorderColor(),
          },
        },
        { final: true },
      );
      updateBorderControls();
    },
    { signal },
  );

  borderColorInput.addEventListener(
    'input',
    () => {
      const current = getTheme();
      borderFallbackColor = borderColorInput.value;
      emitTheme(
        {
          ...current,
          innerBorder: { ...current.innerBorder, color: borderColorInput.value },
        },
        { mergeKey: 'innerBorderColor', final: false },
      );
      updateBorderControls();
    },
    { signal },
  );
  borderColorInput.addEventListener(
    'change',
    () => {
      const current = getTheme();
      borderFallbackColor = borderColorInput.value;
      emitTheme(
        {
          ...current,
          innerBorder: { ...current.innerBorder, color: borderColorInput.value },
        },
        { mergeKey: 'innerBorderColor', final: true },
      );
      updateBorderControls();
    },
    { signal },
  );

  function bindRange(
    input: HTMLInputElement,
    mergeKey: string,
    apply: (current: Theme, value: number) => Theme,
  ): void {
    input.addEventListener(
      'input',
      () => {
        const value = Number(input.value);
        emitTheme(apply(getTheme(), value), { mergeKey, final: false });
        const output = root.querySelector<HTMLElement>(`[data-range-value="${mergeKey}"]`);
        if (output !== null) {
          output.textContent = formatPercent(value, mergeKey === 'innerBorderWidth' ? 1 : 0);
        }
      },
      { signal },
    );
    input.addEventListener(
      'change',
      () => {
        const value = Number(input.value);
        emitTheme(apply(getTheme(), value), { mergeKey, final: true });
        const output = root.querySelector<HTMLElement>(`[data-range-value="${mergeKey}"]`);
        if (output !== null) {
          output.textContent = formatPercent(value, mergeKey === 'innerBorderWidth' ? 1 : 0);
        }
      },
      { signal },
    );
  }

  bindRange(borderWidth, 'innerBorderWidth', (current, value) => ({
    ...current,
    innerBorder: { ...current.innerBorder, widthRatio: value },
  }));
  bindRange(fontSize, 'fontSizeRatio', (current, value) =>
    withMetric(current, 'fontSizeRatio', value),
  );
  bindRange(gap, 'gapRatio', (current, value) => withMetric(current, 'gapRatio', value));
  bindRange(radius, 'radiusRatio', (current, value) => withMetric(current, 'radiusRatio', value));

  return {
    render(nextTheme, state): void {
      theme = nextTheme;
      brush = state.brush;
      tool = state.tool;

      if (nameInput.value !== nextTheme.name) {
        nameInput.value = nextTheme.name;
      }
      updateNameDisplay(nextTheme.name);
      setNameError(getThemeNameError(nextTheme.name));

      const supported = new Set(nextTheme.supportedSizes);
      const used = new Set(state.usedSizes);
      for (const size of PUZZLE_SIZES) {
        const option = sizeOptions.get(size);
        if (option === undefined) {
          continue;
        }
        option.input.checked = supported.has(size);
        option.badge.hidden = !used.has(size);
        option.label.classList.toggle('is-used', used.has(size));
        option.input.setAttribute(
          'aria-label',
          `${size}×${size}${used.has(size) ? '，使用中' : ''}`,
        );
      }

      for (const button of modeButtons) {
        button.setAttribute('aria-pressed', String(button.dataset.mode === nextTheme.color.mode));
        button.classList.toggle('is-active', button.dataset.mode === nextTheme.color.mode);
      }
      renderBrush(brush);
      renderTools(tool);
      updateBorderControls();
      updateMetricControls();
      blindColorInput.value = normalizeHex(nextTheme.blindTileColor, '#3498db');
      blindHex.textContent = blindColorInput.value.toUpperCase();
      styleError.textContent = '';
      styleError.hidden = true;
      sizesRoot.classList.remove('has-error');
      sizesError.hidden = true;
      sizesError.textContent = '';
    },

    renderBrush,

    renderTool: renderTools,

    setNameError,

    setSizesError,

    setStyleError,

    focusName(): void {
      nameInput.focus();
      nameInput.scrollIntoView({ block: 'center', behavior: 'smooth' });
    },

    focusSizes(): void {
      const first = sizesRoot.querySelector<HTMLInputElement>('input');
      first?.focus();
      sizesRoot.scrollIntoView({ block: 'center', behavior: 'smooth' });
    },

    destroy(): void {
      controller.abort();
    },
  };
}
