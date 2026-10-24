/**
 * 设置页分类注册表与页面级 controller 接口。
 *
 * 导航和 hash 解析都以这里为准；新增分类时需要同时补注册表项和
 * HTML 里的 `<section data-settings-section="...">`。
 */

export type SettingsSectionId = 'appearance' | 'language' | 'game-theme' | 'about';

export type SettingsSectionGroup = 'display' | 'game' | 'more';

export interface SettingsSectionDefinition {
  readonly id: SettingsSectionId;
  readonly label: string;
  readonly icon: string;
  readonly group: SettingsSectionGroup;
  readonly hash: string;
}

export const SETTINGS_SECTIONS = [
  {
    id: 'appearance',
    label: '外观',
    icon: 'paintbrush',
    group: 'display',
    hash: 'appearance',
  },
  {
    id: 'language',
    label: '语言',
    icon: 'globe',
    group: 'display',
    hash: 'language',
  },
  {
    id: 'game-theme',
    label: '游戏主题',
    icon: 'palette',
    group: 'game',
    hash: 'game-theme',
  },
  {
    id: 'about',
    label: '关于',
    icon: 'info',
    group: 'more',
    hash: 'about',
  },
] as const satisfies readonly SettingsSectionDefinition[];

export const SETTINGS_GROUP_LABELS: Readonly<Record<SettingsSectionGroup, string>> = {
  display: '显示设置',
  game: '游戏',
  more: '更多',
};

export const DEFAULT_SETTINGS_SECTION: SettingsSectionId = 'appearance';

const HASH_TO_SECTION = new Map<string, SettingsSectionDefinition>(
  SETTINGS_SECTIONS.map((section) => [section.hash, section]),
);

/**
 * 解析 URL hash。
 *
 * 允许带或不带 `#`，按小写匹配；空值、未知值或已移除的分类统一回退
 * 到外观，避免用户看到空白页面。
 */
export function resolveSettingsSection(hash: string): SettingsSectionDefinition {
  const normalized = hash.trim().replace(/^#/, '').trim().toLowerCase();
  return HASH_TO_SECTION.get(normalized) ?? SETTINGS_SECTIONS[0];
}

/**
 * 页面级 controller。
 *
 * 一个 controller 可以覆盖多个 section：本轮 `site-preferences` 同时
 * 负责外观和语言。保存条只依赖 isDirty / reset / save，不关心具体表单。
 */
export interface SettingsController {
  readonly id: string;
  isDirty(): boolean;
  reset(): void;
  save(): void | Promise<void>;
}
