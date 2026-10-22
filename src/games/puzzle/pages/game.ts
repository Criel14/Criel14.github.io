/**
 * 数字华容道游戏页入口（P8-1）。
 *
 * 本阶段只负责页面骨架：读取设置和外观、渲染已复原棋盘与静态统计、
 * 初始化存储提示。不生成打乱、不创建 session、不处理重玩、不保存成绩。
 */

import type { GameSettings, GroupId } from '../types';
import { getActiveTheme } from '../core/appearance/appearance';
import { createSolvedBoard } from '../core/board';
import { isGroupId } from '../core/groups';
import { loadAppearanceResult } from '../data/appearance-store';
import { isDataStoreError } from '../data/errors';
import { probeScoreStorage } from '../data/score-store';
import { loadSettingsResult, type SettingsLoadResult } from '../data/settings-store';
import { createBoardView } from '../ui/board-view';
import { formatDuration, formatTps } from '../ui/format';
import { createLifecycle, type Lifecycle } from '../ui/lifecycle';
import { createNotifier, showStorageErrorNotice, type Notifier } from '../ui/notice';

interface GameElements {
  readonly sizeDisplay: HTMLElement;
  readonly sizeButton: HTMLButtonElement;
  readonly sizeOptions: readonly HTMLButtonElement[];
  readonly gameModeButton: HTMLButtonElement;
  readonly gameModeOptions: readonly HTMLButtonElement[];
  readonly moveModeButton: HTMLButtonElement;
  readonly moveModeOptions: readonly HTMLButtonElement[];
  readonly groupButton: HTMLButtonElement;
  readonly groupName: HTMLElement;
  readonly groupOptions: readonly HTMLButtonElement[];
  readonly statTime: HTMLElement;
  readonly statSteps: HTMLElement;
  readonly statTps: HTMLElement;
  readonly statAo5: HTMLElement;
  readonly statAo12: HTMLElement;
  readonly boardMount: HTMLElement;
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`游戏页缺少元素：${selector}`);
  }
  return element;
}

function getElements(): GameElements {
  return {
    sizeDisplay: requireElement<HTMLElement>('[data-size-display]'),
    sizeButton: requireElement<HTMLButtonElement>('[data-popover-trigger="size"]'),
    sizeOptions: [...document.querySelectorAll<HTMLButtonElement>('[data-size-option]')],
    gameModeButton: requireElement<HTMLButtonElement>('[data-popover-trigger="game-mode"]'),
    gameModeOptions: [...document.querySelectorAll<HTMLButtonElement>('[data-game-mode-option]')],
    moveModeButton: requireElement<HTMLButtonElement>('[data-popover-trigger="move-mode"]'),
    moveModeOptions: [...document.querySelectorAll<HTMLButtonElement>('[data-move-mode-option]')],
    groupButton: requireElement<HTMLButtonElement>('[data-popover-trigger="group"]'),
    groupName: requireElement<HTMLElement>('[data-group-name]'),
    groupOptions: [...document.querySelectorAll<HTMLButtonElement>('[data-group-option]')],
    statTime: requireElement<HTMLElement>('[data-stat="time"]'),
    statSteps: requireElement<HTMLElement>('[data-stat="steps"]'),
    statTps: requireElement<HTMLElement>('[data-stat="tps"]'),
    statAo5: requireElement<HTMLElement>('[data-stat="ao5"]'),
    statAo12: requireElement<HTMLElement>('[data-stat="ao12"]'),
    boardMount: requireElement<HTMLElement>('#puzzle-board'),
  };
}

function getGroupName(settings: GameSettings, id: GroupId): string {
  return settings.groups.find((group) => group.id === id)?.name ?? `G${id}`;
}

function setPressed(
  buttons: readonly HTMLButtonElement[],
  datasetKey: string,
  value: string,
): void {
  for (const button of buttons) {
    button.setAttribute('aria-pressed', String(button.dataset[datasetKey] === value));
  }
}

/** 把当前设置反映到左栏和分组入口；P8-1 不绑定任何选择事件。 */
function renderSettings(settings: GameSettings, elements: GameElements): void {
  const sizeLabel = `${settings.size}×${settings.size}`;
  elements.sizeDisplay.textContent = sizeLabel;
  elements.sizeButton.title = `切换阶数（当前 ${sizeLabel}）`;
  elements.sizeButton.setAttribute('aria-label', elements.sizeButton.title);
  setPressed(elements.sizeOptions, 'sizeOption', String(settings.size));

  const gameModeLabel = settings.gameMode === 'normal' ? '普通' : '盲玩';
  elements.gameModeButton.dataset.gameMode = settings.gameMode;
  elements.gameModeButton.title = `游戏模式：${gameModeLabel}`;
  elements.gameModeButton.setAttribute('aria-label', elements.gameModeButton.title);
  setPressed(elements.gameModeOptions, 'gameModeOption', settings.gameMode);

  const moveModeLabel =
    settings.moveMode === 'click' ? '点击' : settings.moveMode === 'slide' ? '滑动' : '键盘';
  elements.moveModeButton.dataset.moveMode = settings.moveMode;
  elements.moveModeButton.title = `操作模式：${moveModeLabel}`;
  elements.moveModeButton.setAttribute('aria-label', elements.moveModeButton.title);
  setPressed(elements.moveModeOptions, 'moveModeOption', settings.moveMode);

  const groupName = getGroupName(settings, settings.groupId);
  elements.groupName.textContent = groupName;
  elements.groupButton.title = `切换分组：${groupName}`;
  elements.groupButton.setAttribute('aria-label', elements.groupButton.title);

  for (const option of elements.groupOptions) {
    const id = Number(option.dataset.groupOption);
    if (!isGroupId(id)) {
      continue;
    }
    const name = getGroupName(settings, id);
    option.textContent = name;
    option.title = name;
    option.setAttribute('aria-label', `选择分组：${name}`);
    option.setAttribute('aria-pressed', String(id === settings.groupId));
  }
}

/** P8-1 的静态统计占位；P8-2 起改为 session 视图。 */
function renderStats(elements: GameElements): void {
  elements.statTime.textContent = formatDuration(0);
  elements.statSteps.textContent = '0';
  elements.statTps.textContent = formatTps(0);
  elements.statAo5.textContent = '—';
  elements.statAo12.textContent = '—';
}

function reportLoadStatus(
  notifier: Notifier,
  kind: 'settings' | 'appearance',
  status: SettingsLoadResult['status'],
): void {
  if (status === 'ok' || status === 'missing') {
    return;
  }

  if (status === 'unavailable') {
    showStorageErrorNotice(notifier, 'unavailable');
    return;
  }

  const isSettings = kind === 'settings';
  notifier.show({
    id: `${kind}-corrupt`,
    type: 'warning',
    title: isSettings ? '设置数据已损坏' : '外观数据已损坏',
    message: isSettings
      ? '已回退到可恢复的设置，部分选项可能恢复为默认值。'
      : '已回退到默认主题，部分自定义主题可能不可用。',
    duration: 8_000,
  });
}

function renderPage(lifecycle: Lifecycle, notifier: Notifier): void {
  const settingsResult = loadSettingsResult();
  const appearanceResult = loadAppearanceResult();
  reportLoadStatus(notifier, 'settings', settingsResult.status);
  reportLoadStatus(notifier, 'appearance', appearanceResult.status);

  const elements = getElements();
  renderSettings(settingsResult.settings, elements);
  renderStats(elements);

  const theme = getActiveTheme(appearanceResult.appearance);
  elements.boardMount.replaceChildren();
  const boardView = createBoardView({
    root: elements.boardMount,
    size: settingsResult.settings.size,
    theme,
    // P8-1 使用已复原预览；盲玩在首次有效移动后隐藏数字，由 P8-2 接入。
    numbersVisible: true,
  });
  boardView.update(createSolvedBoard(settingsResult.settings.size));
  lifecycle.onDispose(() => boardView.destroy());

  void probeScoreStorage().catch((error: unknown) => {
    showStorageErrorNotice(notifier, isDataStoreError(error) ? error.code : 'unknown');
  });
}

function boot(): void {
  const lifecycle = createLifecycle();
  const notifier = createNotifier({ signal: lifecycle.signal });

  try {
    renderPage(lifecycle, notifier);
  } catch (error) {
    console.error('数字华容道游戏页初始化失败', error);
    notifier.show({
      id: 'game-init-error',
      type: 'error',
      title: '页面初始化失败',
      message: '页面未能完整加载，请刷新后重试。',
      duration: null,
    });
  }
}

boot();
