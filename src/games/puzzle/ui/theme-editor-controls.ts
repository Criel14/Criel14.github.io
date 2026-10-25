import type { BoardMetrics, ColorMode, PuzzleSize, Theme } from '../types';
import { PUZZLE_SIZES } from '../core/board';
import type { ThemeBrush } from '../core/appearance/editor';
import {
  getThemeNameError,
  getThemeNameWidth,
  THEME_NAME_MAX_WIDTH,
} from '../core/appearance/name';
import { DEFAULT_BLIND_TILE_COLOR } from '../core/appearance/presets';
import { formatHexColorWithAlpha, normalizeHexColor } from '../core/appearance/theme';
import { createColorPickerField, type ColorPickerField } from './color-picker-field';

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
  return normalizeHexColor(value) ?? fallback;
}

/**
 * 编辑器里统一显示 `#` + 8 位 hex，alpha 为 1 时补齐 `FF`。
 * 固定 9 个字符配合等宽字体，保证不同透明度下色块和文本始终对齐。
 */
function formatHexForDisplay(color: string): string {
  return formatHexColorWithAlpha(color) ?? color;
}

/**
 * 把滑杆当前值换算成百分比写入 `--range-progress`，供轨道渐变绘制已填充部分。
 * 值超出 min/max 时夹紧；min 与 max 相等时按 0% 处理，避免除零。
 */
function syncRangeFill(input: HTMLInputElement): void {
  const min = Number(input.min);
  const max = Number(input.max);
  const value = Number(input.value);
  const span = max - min;
  const ratio = span > 0 ? (value - min) / span : 0;
  const percent = Math.min(100, Math.max(0, ratio * 100));
  input.style.setProperty('--range-progress', `${percent}%`);
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
  const brushBackgroundMount = requireElement<HTMLElement>(root, '[data-brush="background"]');
  const brushFontMount = requireElement<HTMLElement>(root, '[data-brush="fontColor"]');
  const brushBackgroundHex = requireElement<HTMLElement>(root, '[data-brush-background-hex]');
  const brushFontHex = requireElement<HTMLElement>(root, '[data-brush-font-hex]');
  const brushPreview = requireElement<HTMLElement>(root, '[data-brush-preview]');
  const styleError = requireElement<HTMLElement>(root, '[data-style-error]');

  const blindColorMount = requireElement<HTMLElement>(root, '[data-color="blindTileColor"]');
  const blindHex = requireElement<HTMLElement>(root, '[data-hex="blindTileColor"]');
  const borderColorMount = requireElement<HTMLElement>(root, '[data-color="innerBorderColor"]');
  const borderHex = requireElement<HTMLElement>(root, '[data-hex="innerBorderColor"]');
  const borderWidth = requireElement<HTMLInputElement>(root, '[data-range="innerBorderWidth"]');
  const fontSize = requireElement<HTMLInputElement>(root, '[data-range="fontSizeRatio"]');
  const gap = requireElement<HTMLInputElement>(root, '[data-range="gapRatio"]');
  const radius = requireElement<HTMLInputElement>(root, '[data-range="radiusRatio"]');

  const modeButtons = [...modeGroup.querySelectorAll<HTMLButtonElement>('[data-mode]')];
  const toolButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-tool]')];

  let theme: Theme | null = null;
  let brush: ThemeBrush = { background: '#3498db', fontColor: '#ffffff' };
  let tool: ThemeEditorTool = 'bucket';

  const brushBackgroundPicker: ColorPickerField = createColorPickerField({
    mount: brushBackgroundMount,
    label: '样式刷背景色',
    initialColor: brush.background,
    onChange(color) {
      setBrush({ background: color, fontColor: brush.fontColor });
    },
  });
  const brushFontPicker: ColorPickerField = createColorPickerField({
    mount: brushFontMount,
    label: '样式刷文字色',
    initialColor: brush.fontColor,
    onChange(color) {
      setBrush({ background: brush.background, fontColor: color });
    },
  });

  const blindColorPicker: ColorPickerField = createColorPickerField({
    mount: blindColorMount,
    label: '盲玩色',
    initialColor: DEFAULT_BLIND_TILE_COLOR,
    onChange(color) {
      const current = getTheme();
      emitTheme(
        { ...current, blindTileColor: color },
        {
          mergeKey: 'blindTileColor',
          final: false,
        },
      );
      blindHex.textContent = formatHexForDisplay(color);
    },
    onSettle() {
      emitTheme(getTheme(), { mergeKey: 'blindTileColor', final: true });
    },
  });

  const borderColorPicker: ColorPickerField = createColorPickerField({
    mount: borderColorMount,
    label: '内边框颜色',
    // 内边框完全不透明时用 alpha 0 表示，旧数据里的 transparent 也按这个值展示。
    initialColor: '#00000000',
    onChange(color) {
      const current = getTheme();
      emitTheme(
        {
          ...current,
          innerBorder: { ...current.innerBorder, color },
        },
        { mergeKey: 'innerBorderColor', final: false },
      );
      updateBorderControls();
    },
    onSettle() {
      emitTheme(getTheme(), { mergeKey: 'innerBorderColor', final: true });
    },
  });

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
    // 按钮只显示阶数数字；完整“N×N”和是否使用中留给 aria-label。
    text.textContent = String(size);
    surface.append(text);
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

    return { size, input, label };
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

  /** 旧数据的 `transparent` 在编辑器里按 `#00000000` 展示和编辑。 */
  function currentBorderColor(): string {
    return normalizeHex(getTheme().innerBorder.color, '#00000000');
  }

  function updateBorderControls(): void {
    const current = getTheme();
    const color = currentBorderColor();
    borderColorPicker.setColor(color);
    borderHex.textContent = formatHexForDisplay(color);
    borderWidth.value = String(current.innerBorder.widthRatio);
    syncRangeFill(borderWidth);
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
      syncRangeFill(input);
      const output = root.querySelector<HTMLElement>(`[data-range-value="${key}"]`);
      if (output !== null) {
        output.textContent = formatPercent(value, digits);
      }
    }
  }

  function renderBrush(nextBrush: ThemeBrush): void {
    const background = normalizeHex(nextBrush.background, '#3498db');
    const fontColor = normalizeHex(nextBrush.fontColor, '#ffffff');

    brushBackgroundPicker.setColor(background);
    brushBackgroundHex.textContent = formatHexForDisplay(background);
    brushFontPicker.setColor(fontColor);
    brushFontHex.textContent = formatHexForDisplay(fontColor);
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

  function bindRange(
    input: HTMLInputElement,
    mergeKey: string,
    apply: (current: Theme, value: number) => Theme,
  ): void {
    input.addEventListener(
      'input',
      () => {
        const value = Number(input.value);
        syncRangeFill(input);
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
        syncRangeFill(input);
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
        const checked = supported.has(size);
        const inUse = used.has(size);
        option.input.checked = checked;
        // 使用中却被取消勾选的阶数保留红色标记；保存条会说明原因并禁用保存。
        option.label.classList.toggle('is-blocked', inUse && !checked);
        option.input.setAttribute('aria-label', `${size}×${size}${inUse ? '，使用中' : ''}`);
      }

      for (const button of modeButtons) {
        button.setAttribute('aria-pressed', String(button.dataset.mode === nextTheme.color.mode));
        button.classList.toggle('is-active', button.dataset.mode === nextTheme.color.mode);
      }
      renderBrush(brush);
      renderTools(tool);
      updateBorderControls();
      updateMetricControls();
      const blindColor = normalizeHex(nextTheme.blindTileColor, '#3498db');
      blindColorPicker.setColor(blindColor);
      blindHex.textContent = formatHexForDisplay(blindColor);
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
      brushBackgroundPicker.destroy();
      brushFontPicker.destroy();
      blindColorPicker.destroy();
      borderColorPicker.destroy();
      controller.abort();
    },
  };
}
