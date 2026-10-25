import Pickr from '@simonwep/pickr';
import '@simonwep/pickr/dist/themes/nano.min.css';
import { normalizeHexColor } from '../core/appearance/theme';

/**
 * 主题编辑器里的单个颜色选择器。
 *
 * Pickr 的弹出层会挂到 body 下，外层控件只持有一个挂载节点；
 * 颜色统一转换成 #rrggbb / #rrggbbaa，避免把 picker 的 HSVA 状态泄漏到主题模型。
 */
export interface ColorPickerFieldOptions {
  readonly mount: HTMLElement;
  /** 用于 Pickr 按钮和弹层的可读标签，例如“样式刷背景色”。 */
  readonly label: string;
  readonly initialColor: string;
  /** 颜色变化时实时回调，颜色已经规范化为小写 hex。 */
  readonly onChange: (color: string) => void;
  /** 一次拖动、输入或保存结束；调用方据此结束撤销历史的连续合并。 */
  readonly onSettle?: () => void;
}

export interface ColorPickerField {
  /** 静默同步颜色；不会触发 onChange，也不会新增历史。 */
  setColor(color: string): void;
  destroy(): void;
}

const TRANSPARENT_PICKER_COLOR = '#00000000';
const FALLBACK_PICKER_COLOR = '#3498db';

function toPickerColor(color: string): string {
  if (color === 'transparent') {
    return TRANSPARENT_PICKER_COLOR;
  }
  return normalizeHexColor(color) ?? FALLBACK_PICKER_COLOR;
}

function fromPickerColor(color: Pickr.HSVaColor): string {
  // Pickr 在 alpha 为 1 时会省略 alpha 字节，正好对应项目的 6/8 位格式。
  return color.toHEXA().toString().toLowerCase();
}

/** 创建 Pickr Nano 颜色选择器，并隔离其事件和销毁流程。 */
export function createColorPickerField(options: ColorPickerFieldOptions): ColorPickerField {
  let currentColor = toPickerColor(options.initialColor);
  let destroyed = false;

  const pickr = Pickr.create({
    el: options.mount,
    theme: 'nano',
    appClass: 'theme-editor-pickr-app',
    default: currentColor,
    comparison: false,
    lockOpacity: false,
    defaultRepresentation: 'HEXA',
    components: {
      palette: true,
      preview: true,
      opacity: true,
      hue: true,
      interaction: {
        input: true,
        save: true,
      },
    },
    i18n: {
      'ui:dialog': `${options.label}选择器`,
      'btn:toggle': options.label,
      'btn:save': '确定',
      'aria:btn:save': '应用颜色并关闭',
      'aria:input': '颜色值',
      'aria:palette': '颜色选择区域',
      'aria:hue': '色相滑块',
      'aria:opacity': '透明度滑块',
    },
  });

  function syncVisual(): void {
    if (destroyed) {
      return;
    }
    pickr.setColor(currentColor, true);
    pickr.applyColor(true);
  }

  function handleChange(color: Pickr.HSVaColor, source: string): void {
    if (destroyed) {
      return;
    }
    const next = fromPickerColor(color);
    currentColor = next;
    options.onChange(next);
    if (source === 'swatch') {
      options.onSettle?.();
    }
  }

  function handleSettle(): void {
    if (!destroyed) {
      options.onSettle?.();
    }
  }

  pickr.on('init', syncVisual);
  pickr.on('change', handleChange);
  pickr.on('changestop', (source: string) => {
    if (source === 'slider') {
      handleSettle();
    }
  });
  pickr.on('save', () => {
    handleSettle();
    pickr.hide();
  });
  pickr.on('hide', handleSettle);

  // 构造器里的 RAF 初始化完成后再同步一次，确保按钮和输入框显示初始颜色。
  syncVisual();

  return {
    setColor(color: string): void {
      if (destroyed) {
        return;
      }
      currentColor = toPickerColor(color);
      syncVisual();
    },

    destroy(): void {
      if (destroyed) {
        return;
      }
      destroyed = true;
      pickr.destroyAndRemove();
    },
  };
}
