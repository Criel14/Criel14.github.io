/**
 * 数字华容道游戏页入口（P8-2）。
 *
 * 负责页面组装：读取设置和外观、创建/刷新对局、采集三种输入、
 * 用 rAF 更新 Time / Step / TPS、同步盲玩数字可见性，并读取当前桶的
 * ao5 / ao12。保存成绩、重玩和设置面板分别留给 P8-3、P8-4。
 */

import type {
  Direction,
  GameMode,
  GameSettings,
  GroupId,
  MoveMode,
  PuzzleSize,
  SessionConfig,
  SessionState,
} from '../types';
import { getActiveTheme } from '../core/appearance/appearance';
import { isPuzzleSize } from '../core/board';
import { isGroupId } from '../core/groups';
import { generateScramble } from '../core/scramble';
import { createSession, getSessionView, moveByDirection, moveByTile } from '../core/session';
import { sortScores } from '../core/score';
import { computeAoAt } from '../core/stats';
import { loadAppearanceResult } from '../data/appearance-store';
import { isDataStoreError } from '../data/errors';
import { listScoresByBucket, probeScoreStorage } from '../data/score-store';
import { loadSettingsResult, saveSettings, type SettingsLoadResult } from '../data/settings-store';
import { attachBoardInput } from '../ui/board-input';
import { createBoardView, type BoardView } from '../ui/board-view';
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
  readonly refreshButton: HTMLButtonElement;
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
    groupOptions: [...document.querySelectorAll<HTMLButtonElement>('[data-group-option]')],
    statTime: requireElement<HTMLElement>('[data-stat="time"]'),
    statSteps: requireElement<HTMLElement>('[data-stat="steps"]'),
    statTps: requireElement<HTMLElement>('[data-stat="tps"]'),
    statAo5: requireElement<HTMLElement>('[data-stat="ao5"]'),
    statAo12: requireElement<HTMLElement>('[data-stat="ao12"]'),
    refreshButton: requireElement<HTMLButtonElement>('[data-action="refresh"]'),
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

/** 把当前设置反映到左栏和分组入口。 */
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

function renderPage(lifecycle: Lifecycle, notifier: Notifier): void {
  const settingsResult = loadSettingsResult();
  const appearanceResult = loadAppearanceResult();
  reportLoadStatus(notifier, 'settings', settingsResult.status);
  reportLoadStatus(notifier, 'appearance', appearanceResult.status);

  let settings = settingsResult.settings;
  const elements = getElements();
  renderSettings(settings, elements);

  const theme = getActiveTheme(appearanceResult.appearance);
  let session: SessionState | null = null;
  let boardView: BoardView | null = null;
  let detachInput: (() => void) | null = null;
  let frameGeneration = 0;
  let aoRequestId = 0;
  let openPopover: HTMLElement | null = null;
  let openTrigger: HTMLButtonElement | null = null;
  let hudSnapshot: HudSnapshot = { time: '', steps: '', tps: '' };

  lifecycle.onDispose(() => {
    frameGeneration += 1;
    aoRequestId += 1;
    detachInput?.();
    detachInput = null;
    boardView?.destroy();
    boardView = null;
  });

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

  function commitSession(next: SessionState): void {
    if (session === null || next === session) {
      return;
    }

    session = next;
    boardView?.update(session.board);
    updateHud(performance.now());

    if (session.phase === 'solved') {
      // 棋盘锁定后移除输入监听，避免仍显示可点击光标。
      detachInput?.();
      detachInput = null;
      // 冻结最后一次 HUD，并让已排队的 rAF 在下一帧退出。
      frameGeneration += 1;
      // P8-3 在这里保存成绩和录像；P8-2 只锁盘。
    }
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

  /** 阶数变化时重建棋盘；输入监听由下一局开始时重新挂到新元素。 */
  function replaceBoard(): void {
    detachInput?.();
    detachInput = null;
    boardView?.destroy();
    elements.boardMount.replaceChildren();

    boardView = createBoardView({
      root: elements.boardMount,
      size: settings.size,
      theme,
      numbersVisible: true,
    });
  }

  function startNewGame(): void {
    if (boardView === null) {
      return;
    }

    let next: SessionState;
    try {
      const config: SessionConfig = {
        size: settings.size,
        gameMode: settings.gameMode,
        moveMode: settings.moveMode,
        groupId: settings.groupId,
        scramble: generateScramble(settings.size),
        isRetry: false,
        createdAtEpochMs: Date.now(),
      };
      next = createSession(config, performance.now());
    } catch (error) {
      console.error('无法开始新的拼图对局', error);
      notifier.show({
        id: 'new-game-error',
        type: 'error',
        title: '无法开始新局',
        message: '生成打乱或创建会话失败，请刷新后重试。',
        duration: null,
      });
      return;
    }

    session = next;
    hudSnapshot = { time: '', steps: '', tps: '' };
    boardView.update(session.board);
    attachInput();
    updateHud(performance.now());
    startHudLoop();
  }

  /**
   * 读取当前 size + gameMode + groupId 桶的最近窗口。
   * ao 需要完整窗口；不足 5 / 12 条或跨 5 分钟间隔时显示 —。
   */
  async function loadCurrentAo(): Promise<void> {
    const requestId = ++aoRequestId;
    const filter = {
      size: settings.size,
      gameMode: settings.gameMode,
      groupId: settings.groupId,
    };

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
    if (value === settings.size) {
      return;
    }

    settings = { ...settings, size: value };
    renderSettings(settings, elements);
    persistSettings();
    replaceBoard();
    startNewGame();
    void loadCurrentAo();
  }

  function selectGameMode(value: GameMode): void {
    closePopover(true);
    if (value === settings.gameMode) {
      return;
    }

    settings = { ...settings, gameMode: value };
    renderSettings(settings, elements);
    persistSettings();
    startNewGame();
    void loadCurrentAo();
  }

  function selectMoveMode(value: MoveMode): void {
    closePopover(true);
    if (value === settings.moveMode) {
      return;
    }

    settings = { ...settings, moveMode: value };
    renderSettings(settings, elements);
    persistSettings();
    startNewGame();
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

    // 弹框、对话框和文本输入优先；避免游戏快捷键打断它们。
    if (openPopover !== null || hasOpenDialog() || isTextInputTarget(event.target)) {
      return;
    }

    if (event.key === ' ' || event.code === 'Space') {
      if (event.repeat || consumesSpace(event.target)) {
        return;
      }
      event.preventDefault();
      startNewGame();
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

  lifecycle.listen(elements.refreshButton, 'click', () => {
    startNewGame();
  });
  lifecycle.listen(document, 'keydown', handleKeydown);
  bindPopovers();

  replaceBoard();
  startNewGame();
  void loadCurrentAo();
  void probeScoreStorage().catch((error: unknown) => {
    reportStorageError(notifier, error);
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
