/**
 * 数字华容道游戏页入口（P8-3）。
 *
 * 负责页面组装：读取设置和外观、创建/刷新对局、采集输入、驱动 HUD，
 * 并在复原后保存成绩与录像。`?retry=<id>` 会读取原成绩的打乱创建重玩局，
 * 重玩结果只展示、不计入成绩列表。
 */

import type {
  Direction,
  GameMode,
  GameSettings,
  GroupId,
  MoveMode,
  PuzzleSize,
  ScoreFilter,
  ScoreRecord,
  SessionConfig,
  SessionState,
} from '../types';
import { getThemeForSize } from '../core/appearance/appearance';
import { FALLBACK_THEME_ID } from '../core/appearance/presets';
import { isPuzzleSize } from '../core/board';
import { getGroupName as resolveGroupName, isGroupId } from '../core/groups';
import { generateScramble } from '../core/scramble';
import {
  createSession,
  getSessionResult,
  getSessionView,
  moveByDirection,
  moveByTile,
} from '../core/session';
import { createSettlement, type Settlement } from '../core/settlement';
import { sortScores } from '../core/score';
import { computeAoAt } from '../core/stats';
import { loadAppearanceResult } from '../data/appearance-store';
import { isDataStoreError } from '../data/errors';
import {
  addScoreWithReplay,
  getScoreById,
  listScoresByBucket,
  probeScoreStorage,
} from '../data/score-store';
import {
  createDefaultSettings,
  ensureSettingsResult,
  saveSettings,
  type SettingsLoadResult,
} from '../data/settings-store';
import { applyPreferences } from '../../../shared/preferences/apply';
import { loadPreferences } from '../../../shared/preferences/store';
import { SITE_PREFERENCES_STORAGE_KEY } from '../../../shared/preferences/types';
import { attachBoardInput } from '../ui/board-input';
import { createBoardView, type BoardView } from '../ui/board-view';
import { formatDuration, formatTps } from '../ui/format';
import { createLifecycle, type Lifecycle } from '../ui/lifecycle';
import {
  createNotifier,
  getStorageNotice,
  showStorageErrorNotice,
  type Notifier,
} from '../ui/notice';

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
  readonly groupPopoverSize: HTMLElement;
  readonly groupPopoverMode: HTMLElement;
  readonly groupOptions: readonly HTMLButtonElement[];
  readonly statTime: HTMLElement;
  readonly statSteps: HTMLElement;
  readonly statTps: HTMLElement;
  readonly statAo5: HTMLElement;
  readonly statAo12: HTMLElement;
  readonly aoRows: readonly HTMLElement[];
  readonly retryPanel: HTMLElement;
  readonly retryExitButton: HTMLButtonElement;
  readonly statsActions: HTMLElement;
  readonly refreshButton: HTMLButtonElement;
  readonly settingsLink: HTMLAnchorElement;
  readonly boardMount: HTMLElement;
}

interface HudSnapshot {
  readonly time: string;
  readonly steps: string;
  readonly tps: string;
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
    groupPopoverSize: requireElement<HTMLElement>('[data-group-popover-size]'),
    groupPopoverMode: requireElement<HTMLElement>('[data-group-popover-mode]'),
    groupOptions: [...document.querySelectorAll<HTMLButtonElement>('[data-group-option]')],
    statTime: requireElement<HTMLElement>('[data-stat="time"]'),
    statSteps: requireElement<HTMLElement>('[data-stat="steps"]'),
    statTps: requireElement<HTMLElement>('[data-stat="tps"]'),
    statAo5: requireElement<HTMLElement>('[data-stat="ao5"]'),
    statAo12: requireElement<HTMLElement>('[data-stat="ao12"]'),
    aoRows: [...document.querySelectorAll<HTMLElement>('[data-ao-row]')],
    retryPanel: requireElement<HTMLElement>('[data-retry-panel]'),
    retryExitButton: requireElement<HTMLButtonElement>('[data-action="exit-retry"]'),
    statsActions: requireElement<HTMLElement>('.stats-actions'),
    refreshButton: requireElement<HTMLButtonElement>('[data-action="refresh"]'),
    settingsLink: requireElement<HTMLAnchorElement>('[data-action="settings"]'),
    boardMount: requireElement<HTMLElement>('#puzzle-board'),
  };
}

function getGroupName(settings: GameSettings, id: GroupId): string {
  return resolveGroupName(settings.groups, settings.size, settings.gameMode, id);
}

/** 事件显示名，例如 `3×3 普通`；用于完整分组标题和 aria-label。 */
function getEventLabel(size: PuzzleSize, gameMode: GameMode): string {
  return `${size}×${size} ${gameMode === 'normal' ? '普通' : '盲玩'}`;
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

/** 把当前设置反映到左栏和分组入口。 */
function renderSettings(settings: GameSettings, elements: GameElements): void {
  const sizeLabel = `${settings.size}×${settings.size}`;
  // 左栏主显示在乘号两侧留空格；标题和 aria-label 继续使用紧凑写法。
  elements.sizeDisplay.textContent = `${settings.size} × ${settings.size}`;
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

  const eventLabel = getEventLabel(settings.size, settings.gameMode);
  const groupName = getGroupName(settings, settings.groupId);
  elements.groupName.textContent = groupName;
  elements.groupPopoverSize.textContent = sizeLabel;
  elements.groupPopoverMode.textContent = gameModeLabel;
  elements.groupButton.title = `切换分组：${eventLabel} · ${groupName}`;
  elements.groupButton.setAttribute('aria-label', elements.groupButton.title);

  for (const option of elements.groupOptions) {
    const id = Number(option.dataset.groupOption);
    if (!isGroupId(id)) {
      continue;
    }
    const name = getGroupName(settings, id);
    const fullName = `${eventLabel} · ${name}`;
    option.textContent = name;
    option.title = fullName;
    option.setAttribute('aria-label', `选择分组：${fullName}`);
    option.setAttribute('aria-pressed', String(id === settings.groupId));
  }
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
      : '已使用系统回退主题，部分自定义主题可能不可用。',
    duration: 8_000,
  });
}

function reportStorageError(notifier: Notifier, error: unknown): void {
  showStorageErrorNotice(notifier, isDataStoreError(error) ? error.code : 'unknown');
}

/** 从键盘事件解析方块移动方向；WASD 与方向键等价。 */
function getDirectionFromKey(key: string): Direction | null {
  const normalized = key.length === 1 ? key.toLowerCase() : key;

  switch (normalized) {
    case 'ArrowUp':
    case 'w':
      return 'U';
    case 'ArrowDown':
    case 's':
      return 'D';
    case 'ArrowLeft':
    case 'a':
      return 'L';
    case 'ArrowRight':
    case 'd':
      return 'R';
    default:
      return null;
  }
}

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
}

/** 空格在按钮/链接上应交给元素自身处理，避免同时触发新局。 */
function consumesSpace(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  return target.closest('button, a, input, textarea, select, [contenteditable]') !== null;
}

function hasOpenDialog(): boolean {
  return document.querySelector('dialog[open]') !== null;
}

const TIMER_ONLY_CLASS = 'game-page--timer-only';

/**
 * 极简计时偏好由 applyPreferences 写入 <html data-timer-only-on-move>。
 * 游戏页只在每局第一次有效移动时读取，运行中修改设置不会改变当前局。
 */
function isTimerOnlyOnMoveEnabled(): boolean {
  return document.documentElement.dataset.timerOnlyOnMove === 'true';
}

/** 切换极简计时视图；用 body class 让 CSS 隐藏菜单、统计明细和入口。 */
function setTimerOnlyView(active: boolean): void {
  document.body.classList.toggle(TIMER_ONLY_CLASS, active);
}

/** 成绩 ID 只在结算时生成；无 randomUUID 的浏览器使用时间戳 + 随机后缀。 */
function createScoreId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `score-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readRetryId(): string | null {
  const value = new URLSearchParams(window.location.search).get('retry');
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** 重玩加载失败时清理 URL，避免刷新后反复进入错误状态。 */
function clearRetryParam(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('retry')) {
    return;
  }
  url.searchParams.delete('retry');
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

function renderPage(lifecycle: Lifecycle, notifier: Notifier): void {
  let settingsResult: SettingsLoadResult;
  try {
    settingsResult = ensureSettingsResult();
  } catch {
    settingsResult = { status: 'unavailable', settings: createDefaultSettings() };
  }

  const appearanceResult = loadAppearanceResult();
  reportLoadStatus(notifier, 'settings', settingsResult.status);
  reportLoadStatus(notifier, 'appearance', appearanceResult.status);

  /*
   * 只有外观数据可读时才判断回退主题；corrupt / unavailable 已经由上面的
   * 外观提示说明原因，再叠一条“暂未设置主题”会让用户误以为是配置问题。
   */
  const canReportThemeFallback =
    appearanceResult.status === 'ok' || appearanceResult.status === 'missing';

  /**
   * 当前阶数落到系统回退主题时显示一条提示；切回正常阶数时关闭。
   * 固定 id 保证切换阶数时只更新同一条，不堆叠多条提示。
   */
  function updateThemeFallbackNotice(size: PuzzleSize, themeId: string): void {
    if (!canReportThemeFallback || themeId !== FALLBACK_THEME_ID) {
      notifier.dismiss('theme-fallback');
      return;
    }

    notifier.show({
      id: 'theme-fallback',
      type: 'warning',
      message: `${size}×${size} 阶数暂未设置主题，请前往设置页设置`,
      duration: 6_000,
    });
  }

  let settings = settingsResult.settings;
  const elements = getElements();
  renderSettings(settings, elements);

  let session: SessionState | null = null;
  let boardView: BoardView | null = null;
  let boardSize: PuzzleSize | null = null;
  let detachInput: (() => void) | null = null;
  let frameGeneration = 0;
  let aoRequestId = 0;
  let retrySource: ScoreRecord | null = null;
  let retryMode = false;
  let retryLoading = false;
  let retryRequestId = 0;
  let isSaving = false;
  const pendingSettlements: Settlement[] = [];
  let openPopover: HTMLElement | null = null;
  let openTrigger: HTMLButtonElement | null = null;
  let hudSnapshot: HudSnapshot = { time: '', steps: '', tps: '' };

  lifecycle.onDispose(() => {
    frameGeneration += 1;
    aoRequestId += 1;
    retryRequestId += 1;
    detachInput?.();
    detachInput = null;
    boardView?.destroy();
    boardView = null;
    boardSize = null;
  });

  /** 重玩时左栏和统计使用成绩原配置；操作模式仍取当前设置。 */
  function getDisplaySettings(): GameSettings {
    if (retrySource === null) {
      return settings;
    }
    return {
      ...settings,
      size: retrySource.size,
      gameMode: retrySource.gameMode,
      groupId: retrySource.groupId,
    };
  }

  function getActiveFilter(): ScoreFilter {
    const display = getDisplaySettings();
    return {
      size: display.size,
      gameMode: display.gameMode,
      groupId: display.groupId,
    };
  }

  function isBusy(): boolean {
    return retryLoading || isSaving;
  }

  /** 观察阶段和完成后的等待阶段允许；running/重玩/保存/加载中锁定。 */
  function canUseIdleActions(): boolean {
    return (
      !isBusy() &&
      !retryMode &&
      session !== null &&
      (session.phase === 'observing' || session.phase === 'solved')
    );
  }

  function canSwitchGroup(): boolean {
    return canUseIdleActions();
  }

  /** 设置页是独立页面，进入会卸载当前局；只在不会误丢成绩的阶段允许。 */
  function canOpenSettings(): boolean {
    return canUseIdleActions() && pendingSettlements.length === 0;
  }

  function getSettingsDisabledReason(): string {
    if (isSaving) {
      return '正在保存，暂时无法打开设置';
    }
    if (pendingSettlements.length > 0) {
      return '成绩尚未保存，暂时无法打开设置';
    }
    if (retryMode) {
      return '重玩中无法打开设置';
    }
    if (retryLoading) {
      return '正在加载重玩，暂时无法打开设置';
    }
    if (session === null) {
      return '页面尚未就绪，暂时无法打开设置';
    }
    return '进行中无法打开设置';
  }

  function updateRetryUi(): void {
    for (const row of elements.aoRows) {
      row.hidden = retryMode;
    }
    elements.retryPanel.hidden = !retryMode;
    elements.statsActions.classList.toggle('stats-actions--retry', retryMode);
  }

  function updateControlState(): void {
    const busy = isBusy();
    const retryLocked = retryMode;
    const groupEnabled = canSwitchGroup();

    elements.sizeButton.disabled = busy || retryLocked;
    elements.gameModeButton.disabled = busy || retryLocked;
    elements.moveModeButton.disabled = busy;
    elements.groupButton.disabled = !groupEnabled;
    elements.refreshButton.disabled = busy;
    elements.retryExitButton.disabled = isSaving;

    const settingsEnabled = canOpenSettings();
    elements.settingsLink.setAttribute('aria-disabled', String(!settingsEnabled));
    elements.settingsLink.classList.toggle('is-disabled', !settingsEnabled);
    elements.settingsLink.title = settingsEnabled ? '设置' : getSettingsDisabledReason();

    for (const option of elements.sizeOptions) {
      option.disabled = busy || retryLocked;
    }
    for (const option of elements.gameModeOptions) {
      option.disabled = busy || retryLocked;
    }
    for (const option of elements.moveModeOptions) {
      option.disabled = busy;
    }
    for (const option of elements.groupOptions) {
      option.disabled = !groupEnabled;
    }

    elements.boardMount.toggleAttribute('aria-busy', retryLoading);
    updateRetryUi();
    if (busy || (!groupEnabled && openTrigger === elements.groupButton)) {
      closePopover();
    }
  }

  function setHudText(time: string, steps: string, tps: string): void {
    if (time !== hudSnapshot.time) {
      elements.statTime.textContent = time;
    }
    if (steps !== hudSnapshot.steps) {
      elements.statSteps.textContent = steps;
    }
    if (tps !== hudSnapshot.tps) {
      elements.statTps.textContent = tps;
    }
    hudSnapshot = { time, steps, tps };
  }

  function updateHud(nowMs: number): void {
    if (session === null) {
      setHudText(formatDuration(0), '0', formatTps(0));
      return;
    }

    const view = getSessionView(session, nowMs);
    setHudText(formatDuration(view.elapsedMs), String(session.moves.length), formatTps(view.tps));
    boardView?.setNumbersVisible(!view.hideNumbers);
  }

  function startHudLoop(): void {
    const generation = ++frameGeneration;
    const tick = (): void => {
      if (generation !== frameGeneration) {
        return;
      }
      updateHud(performance.now());
      if (session !== null && session.phase !== 'solved') {
        lifecycle.requestFrame(tick);
      }
    };
    lifecycle.requestFrame(tick);
  }

  /** 按当前操作模式重新挂载棋盘输入；keyboard 模式由全局 keydown 处理。 */
  function attachInput(): void {
    detachInput?.();
    detachInput = null;

    if (boardView === null || settings.moveMode === 'keyboard') {
      return;
    }

    const moveMode = settings.moveMode;
    detachInput = attachBoardInput(
      boardView.element,
      {
        onActivate: moveMode === 'click' ? (index) => moveTile(index) : undefined,
        onHover:
          moveMode === 'slide'
            ? (index, event) => {
                // 按住 Ctrl 暂停滑动触发，沿用旧版操作习惯；点击/键盘不受影响。
                if (!event.ctrlKey) {
                  moveTile(index);
                }
              }
            : undefined,
      },
      { captureTouchMove: moveMode === 'slide' },
    );
  }

  function showBoardLoading(): void {
    detachInput?.();
    detachInput = null;
    boardView?.destroy();
    boardView = null;
    boardSize = null;
    elements.boardMount.replaceChildren();
    elements.boardMount.setAttribute('aria-busy', 'true');

    const placeholder = document.createElement('div');
    placeholder.className = 'board-loading';
    placeholder.textContent = '正在加载重玩…';
    placeholder.setAttribute('aria-hidden', 'true');
    elements.boardMount.append(placeholder);
  }

  /** 阶数变化时重建棋盘；输入监听由下一局开始时重新挂到新元素。 */
  function replaceBoard(size: PuzzleSize): void {
    detachInput?.();
    detachInput = null;
    boardView?.destroy();
    boardView = null;
    boardSize = null;
    elements.boardMount.replaceChildren();
    elements.boardMount.removeAttribute('aria-busy');

    const theme = getThemeForSize(appearanceResult.appearance, size);
    boardView = createBoardView({
      root: elements.boardMount,
      size,
      theme,
      numbersVisible: true,
    });
    boardSize = size;
    updateThemeFallbackNotice(size, theme.id);
  }

  function ensureBoard(size: PuzzleSize): void {
    if (boardView !== null && boardSize === size) {
      return;
    }
    replaceBoard(size);
  }

  function showNewGameError(error: unknown): void {
    console.error('无法开始新的拼图对局', error);
    notifier.show({
      id: 'new-game-error',
      type: 'error',
      title: '无法开始新局',
      message: '生成打乱或创建会话失败，请刷新后重试。',
      duration: null,
    });
  }

  function startSession(config: SessionConfig): boolean {
    if (boardView === null) {
      return false;
    }

    let next: SessionState;
    try {
      next = createSession(config, performance.now());
    } catch (error) {
      showNewGameError(error);
      return false;
    }

    session = next;
    // 新局从完整 UI 开始观察；只有第一次有效移动后才可能进入极简计时。
    setTimerOnlyView(false);
    updateControlState();
    hudSnapshot = { time: '', steps: '', tps: '' };
    boardView.update(session.board);
    attachInput();
    updateHud(performance.now());
    startHudLoop();
    return true;
  }

  function startNewGame(): boolean {
    if (isSaving) {
      return false;
    }

    try {
      ensureBoard(settings.size);
      const config: SessionConfig = {
        size: settings.size,
        gameMode: settings.gameMode,
        moveMode: settings.moveMode,
        groupId: settings.groupId,
        scramble: generateScramble(settings.size),
        isRetry: false,
        createdAtEpochMs: Date.now(),
      };
      return startSession(config);
    } catch (error) {
      showNewGameError(error);
      return false;
    }
  }

  function startRetryGame(): boolean {
    if (retrySource === null || isSaving) {
      return false;
    }

    try {
      ensureBoard(retrySource.size);
      const config: SessionConfig = {
        size: retrySource.size,
        gameMode: retrySource.gameMode,
        moveMode: settings.moveMode,
        groupId: retrySource.groupId,
        scramble: retrySource.scramble,
        isRetry: true,
        retryOf: retrySource.id,
        createdAtEpochMs: Date.now(),
      };
      return startSession(config);
    } catch (error) {
      showNewGameError(error);
      return false;
    }
  }

  function startNextGame(): void {
    if (isBusy()) {
      return;
    }
    if (retryMode) {
      startRetryGame();
      return;
    }
    startNewGame();
  }

  function moveTile(index: number): void {
    if (session === null || session.phase === 'solved') {
      return;
    }
    commitSession(moveByTile(session, index, performance.now()));
  }

  function moveKeyboard(direction: Direction): void {
    if (settings.moveMode !== 'keyboard' || session === null || session.phase === 'solved') {
      return;
    }
    commitSession(moveByDirection(session, direction, performance.now()));
  }

  function commitSession(next: SessionState): void {
    if (session === null || next === session) {
      return;
    }

    const previousPhase = session.phase;
    const phaseChanged = previousPhase !== next.phase;
    session = next;
    boardView?.update(session.board);
    updateHud(performance.now());

    // 每局只在 observing → running 的第一次有效移动时读取偏好。
    if (previousPhase === 'observing' && next.phase === 'running' && isTimerOnlyOnMoveEnabled()) {
      setTimerOnlyView(true);
    }

    if (phaseChanged) {
      // observing → running 后分组必须锁定；solved 也保持锁定直到开新局。
      updateControlState();
    }

    if (session.phase === 'solved') {
      // 复原后恢复完整 UI，让成绩提示、重玩入口和刷新按钮重新可见。
      setTimerOnlyView(false);
      // 棋盘锁定后移除输入监听，避免仍显示可点击光标。
      detachInput?.();
      detachInput = null;
      // 冻结最后一次 HUD，并让已排队的 rAF 在下一帧退出。
      frameGeneration += 1;
      handleSolvedSession(session);
    }
  }

  function handleSolvedSession(state: SessionState): void {
    const result = getSessionResult(state);
    if (result === null) {
      notifier.show({
        id: 'score-result-error',
        type: 'error',
        title: '无法结算本局',
        message: '完成状态异常，本局成绩未保存。',
        duration: 8_000,
      });
      return;
    }

    // 重玩只用于复现同一打乱，完成结果不进入成绩列表。
    if (result.isRetry) {
      notifier.show({
        id: 'retry-finished',
        type: 'success',
        title: '重玩完成',
        message: '本局不计入成绩列表。',
        duration: 4_000,
      });
      return;
    }

    let settlement: Settlement;
    try {
      settlement = createSettlement(createScoreId(), result);
    } catch (error) {
      console.error('无法生成成绩记录', error);
      notifier.show({
        id: 'score-result-error',
        type: 'error',
        title: '无法结算本局',
        message: '成绩数据生成失败，本局成绩未保存。',
        duration: 8_000,
      });
      return;
    }

    pendingSettlements.push(settlement);
    void flushSettlements();
  }

  function showSaveLoading(): void {
    notifier.dismiss('score-save');
    notifier.show({
      id: 'score-save',
      type: 'loading',
      title: '正在保存成绩',
      message: `正在保存 ${pendingSettlements.length} 局成绩和录像…`,
      duration: null,
      dismissible: false,
    });
  }

  function showSaveError(error: unknown): void {
    const code = isDataStoreError(error) ? error.code : 'unknown';
    const content = getStorageNotice(code);
    notifier.dismiss('score-save');
    notifier.show({
      ...content,
      id: 'score-save',
      title: '成绩未保存',
      message: `${content.message} 当前还有 ${pendingSettlements.length} 局成绩待保存。`,
      duration: null,
      dismissible: false,
      actionLabel: '重试保存',
      onAction: () => {
        void flushSettlements();
      },
    });
  }

  function showSaveSuccess(count: number): void {
    if (count <= 0) {
      return;
    }
    notifier.dismiss('score-save');
    notifier.show({
      id: 'score-save',
      type: 'success',
      title: '成绩已保存',
      message: count > 1 ? `已保存 ${count} 局成绩和录像。` : '本局成绩和录像已保存。',
      duration: 2_500,
      dismissible: true,
    });
  }

  /**
   * 串行写入待保存队列。失败项保留在队列中，页面可以继续新局；
   * 用户通过错误提示上的“重试保存”再次触发，不会产生重复成绩。
   */
  async function flushSettlements(): Promise<void> {
    if (isSaving || pendingSettlements.length === 0) {
      return;
    }

    isSaving = true;
    updateControlState();
    showSaveLoading();

    let savedCount = 0;
    let failure: unknown = null;
    let failed = false;
    try {
      while (pendingSettlements.length > 0) {
        const settlement = pendingSettlements[0];
        if (settlement === undefined) {
          break;
        }
        await addScoreWithReplay(settlement.score, settlement.replay);
        pendingSettlements.shift();
        savedCount += 1;
      }
    } catch (error) {
      failure = error;
      failed = true;
    } finally {
      isSaving = false;
      updateControlState();
    }

    if (lifecycle.signal.aborted) {
      return;
    }

    if (failed) {
      showSaveError(failure);
      if (savedCount > 0) {
        void loadCurrentAo();
      }
      return;
    }

    showSaveSuccess(savedCount);
    if (savedCount > 0) {
      void loadCurrentAo();
    }
  }

  /**
   * 读取当前 size + gameMode + groupId 桶的最近窗口。
   * ao 需要完整窗口；不足 5 / 12 条或跨 5 分钟间隔时显示 —。
   */
  async function loadCurrentAo(): Promise<void> {
    // 重玩结果不进入统计，重玩期间 ao 区域由状态面板替代。
    if (retryMode) {
      return;
    }

    const requestId = ++aoRequestId;
    const filter = getActiveFilter();

    try {
      const scores = await listScoresByBucket(filter);
      if (requestId !== aoRequestId) {
        return;
      }

      const sorted = sortScores(scores);
      const lastIndex = sorted.length - 1;
      const ao5 = computeAoAt(sorted, lastIndex, 5);
      const ao12 = computeAoAt(sorted, lastIndex, 12);
      elements.statAo5.textContent = ao5 === null ? '—' : formatDuration(ao5);
      elements.statAo12.textContent = ao12 === null ? '—' : formatDuration(ao12);
    } catch (error) {
      if (requestId !== aoRequestId) {
        return;
      }
      elements.statAo5.textContent = '—';
      elements.statAo12.textContent = '—';
      reportStorageError(notifier, error);
    }
  }

  function persistSettings(): void {
    try {
      saveSettings(settings);
    } catch (error) {
      reportStorageError(notifier, error);
    }
  }

  function closePopover(restoreFocus = false): void {
    if (openPopover !== null) {
      openPopover.hidden = true;
    }
    if (openTrigger !== null) {
      openTrigger.setAttribute('aria-expanded', 'false');
      if (restoreFocus) {
        openTrigger.focus();
      }
    }
    openPopover = null;
    openTrigger = null;
  }

  function togglePopover(trigger: HTMLButtonElement, name: string): void {
    const popover = document.querySelector<HTMLElement>(`[data-popover="${name}"]`);
    if (popover === null) {
      return;
    }

    if (openPopover === popover) {
      closePopover();
      return;
    }

    closePopover();
    popover.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    openPopover = popover;
    openTrigger = trigger;
  }

  function selectSize(value: PuzzleSize): void {
    closePopover(true);
    if (isBusy() || retryMode || value === settings.size) {
      return;
    }

    settings = { ...settings, size: value };
    renderSettings(getDisplaySettings(), elements);
    persistSettings();
    startNewGame();
    void loadCurrentAo();
    updateControlState();
  }

  function selectGameMode(value: GameMode): void {
    closePopover(true);
    if (isBusy() || retryMode || value === settings.gameMode) {
      return;
    }

    settings = { ...settings, gameMode: value };
    renderSettings(getDisplaySettings(), elements);
    persistSettings();
    startNewGame();
    void loadCurrentAo();
    updateControlState();
  }

  function selectMoveMode(value: MoveMode): void {
    closePopover(true);
    if (isBusy() || value === settings.moveMode) {
      return;
    }

    settings = { ...settings, moveMode: value };
    renderSettings(getDisplaySettings(), elements);
    persistSettings();
    if (retryMode) {
      startRetryGame();
    } else {
      startNewGame();
    }
    updateControlState();
  }

  /**
   * 观察阶段切换分组：保留当前打乱和计时，不重开本局。
   * 完成后切换只影响下一次开局，不修改已完成成绩的分组。
   * 观察阶段同步 session.config.groupId，保证本局结算写入新分组。
   */
  function selectGroup(value: GroupId): void {
    closePopover(true);
    if (!canSwitchGroup() || value === settings.groupId) {
      return;
    }

    settings = { ...settings, groupId: value };
    if (session !== null && session.phase === 'observing') {
      session = { ...session, config: { ...session.config, groupId: value } };
    }

    renderSettings(getDisplaySettings(), elements);
    persistSettings();
    void loadCurrentAo();
    updateControlState();
  }

  function handleKeydown(event: Event): void {
    if (!(event instanceof KeyboardEvent)) {
      return;
    }

    if (event.key === 'Escape') {
      if (openPopover !== null) {
        event.preventDefault();
        closePopover(true);
      }
      return;
    }

    // 弹框、对话框和文本输入优先。
    if (openPopover !== null || hasOpenDialog() || isTextInputTarget(event.target)) {
      return;
    }

    if (event.key === ' ' || event.code === 'Space') {
      if (isBusy() || event.repeat || consumesSpace(event.target)) {
        return;
      }
      event.preventDefault();
      startNextGame();
      return;
    }

    if (settings.moveMode !== 'keyboard') {
      return;
    }

    const direction = getDirectionFromKey(event.key);
    if (direction === null || session === null || session.phase === 'solved') {
      return;
    }

    event.preventDefault();
    moveKeyboard(direction);
  }

  function bindPopovers(): void {
    lifecycle.listen(elements.sizeButton, 'click', () => {
      togglePopover(elements.sizeButton, 'size');
    });
    lifecycle.listen(elements.gameModeButton, 'click', () => {
      togglePopover(elements.gameModeButton, 'game-mode');
    });
    lifecycle.listen(elements.moveModeButton, 'click', () => {
      togglePopover(elements.moveModeButton, 'move-mode');
    });
    lifecycle.listen(elements.groupButton, 'click', () => {
      togglePopover(elements.groupButton, 'group');
    });

    for (const option of elements.sizeOptions) {
      lifecycle.listen(option, 'click', () => {
        const value = Number(option.dataset.sizeOption);
        if (isPuzzleSize(value)) {
          selectSize(value);
        }
      });
    }

    for (const option of elements.gameModeOptions) {
      lifecycle.listen(option, 'click', () => {
        const value = option.dataset.gameModeOption;
        if (value === 'normal' || value === 'blind') {
          selectGameMode(value);
        }
      });
    }

    for (const option of elements.moveModeOptions) {
      lifecycle.listen(option, 'click', () => {
        const value = option.dataset.moveModeOption;
        if (value === 'click' || value === 'slide' || value === 'keyboard') {
          selectMoveMode(value);
        }
      });
    }

    for (const option of elements.groupOptions) {
      lifecycle.listen(option, 'click', () => {
        const value = Number(option.dataset.groupOption);
        if (isGroupId(value)) {
          selectGroup(value);
        }
      });
    }

    lifecycle.listen(document, 'pointerdown', (event) => {
      if (openPopover === null || openTrigger === null) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (openPopover.contains(target) || openTrigger.contains(target)) {
        return;
      }
      closePopover();
    });
  }

  function exitRetry(): void {
    if (!retryMode || isSaving) {
      return;
    }

    // 让正在进行的 getScoreById 结果失效，加载中也可以直接退出。
    retryRequestId += 1;
    retryMode = false;
    retryLoading = false;
    retrySource = null;
    setTimerOnlyView(false);

    notifier.dismiss('retry-loading');
    notifier.dismiss('retry-finished');
    clearRetryParam();
    renderSettings(settings, elements);
    updateControlState();

    const started = startNewGame();
    void loadCurrentAo();
    if (started) {
      notifier.show({
        id: 'retry-exited',
        type: 'info',
        title: '已退出重玩',
        message: '已开始普通新局。',
        duration: 2_500,
      });
    }
  }

  function showRetryFallback(error: unknown, failed: boolean): void {
    if (failed) {
      const code = isDataStoreError(error) ? error.code : 'unknown';
      const content = getStorageNotice(code);
      notifier.show({
        ...content,
        id: 'retry-load-error',
        title: '重玩加载失败',
        message: `${content.message} 已开始普通新局。`,
        duration: content.duration,
      });
      return;
    }

    notifier.show({
      id: 'retry-missing',
      type: 'warning',
      title: '未找到重玩成绩',
      message: '成绩可能已被删除或损坏，已开始普通新局。',
      duration: 8_000,
    });
  }

  async function initializePage(): Promise<void> {
    const retryId = readRetryId();
    if (retryId === null) {
      startNewGame();
      void loadCurrentAo();
      void probeScoreStorage().catch((error: unknown) => {
        reportStorageError(notifier, error);
      });
      return;
    }

    retryMode = true;
    retryLoading = true;
    const requestId = ++retryRequestId;
    updateControlState();
    showBoardLoading();
    notifier.show({
      id: 'retry-loading',
      type: 'loading',
      title: '正在加载重玩',
      message: '正在读取成绩和打乱…',
      duration: null,
      dismissible: false,
    });

    let score: ScoreRecord | null = null;
    let failure: unknown = null;
    let loadFailed = false;
    try {
      score = await getScoreById(retryId);
    } catch (error) {
      failure = error;
      loadFailed = true;
      console.error('加载重玩成绩失败', error);
    }

    if (requestId !== retryRequestId || lifecycle.signal.aborted) {
      return;
    }

    notifier.dismiss('retry-loading');

    let startFailed = false;
    if (score !== null) {
      retrySource = score;
      renderSettings(getDisplaySettings(), elements);
      if (startRetryGame()) {
        retryLoading = false;
        updateControlState();
        return;
      }
      startFailed = true;
      retrySource = null;
    }

    retryLoading = false;
    retryMode = false;
    clearRetryParam();
    renderSettings(settings, elements);
    updateControlState();
    if (!startFailed) {
      showRetryFallback(failure, loadFailed);
    }
    startNewGame();
    void loadCurrentAo();
  }

  lifecycle.listen(elements.refreshButton, 'click', () => {
    startNextGame();
  });
  lifecycle.listen(elements.settingsLink, 'click', (event) => {
    if (!(event instanceof MouseEvent)) {
      return;
    }
    // 新标签页不会卸载当前局，保留 Ctrl/Cmd/Shift/中键等原生行为。
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    if (!canOpenSettings()) {
      event.preventDefault();
    }
  });
  lifecycle.listen(elements.retryExitButton, 'click', () => {
    exitRetry();
  });
  lifecycle.listen(document, 'keydown', handleKeydown);
  /*
   * 设置页可能在另一个标签页保存（游戏页保留当前局），也可能由 bfcache
   * 恢复；这两种情况都不会重新执行 boot，需要重新读取偏好并切换字体 token。
   */
  lifecycle.listen(window, 'pageshow', (event) => {
    if (event instanceof PageTransitionEvent && event.persisted) {
      applyStoredPreferences();
    }
  });
  lifecycle.listen(window, 'storage', (event) => {
    if (event instanceof StorageEvent && event.key === SITE_PREFERENCES_STORAGE_KEY) {
      applyStoredPreferences();
    }
  });
  bindPopovers();
  updateControlState();

  void initializePage().catch((error: unknown) => {
    console.error('数字华容道游戏页初始化失败', error);
    notifier.show({
      id: 'game-init-error',
      type: 'error',
      title: '页面初始化失败',
      message: '页面未能完整加载，请刷新后重试。',
      duration: null,
    });
  });
}

/** 读取并应用全站偏好；启动、bfcache 恢复和跨标签页保存后共用。 */
function applyStoredPreferences(): void {
  applyPreferences(loadPreferences().preferences);
}

function boot(): void {
  const lifecycle = createLifecycle();
  const notifier = createNotifier({ signal: lifecycle.signal });

  try {
    // 计时器字体必须在首帧前应用，避免从默认 JetBrains Mono 闪切到用户字体。
    applyStoredPreferences();
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
