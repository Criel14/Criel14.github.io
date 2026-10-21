/**
 * 游戏页布局实验室（临时原型）。
 *
 * 只用于确认桌面端三栏布局、弹框交互和扁平按钮样式；
 * 不读写存储、不创建 session、不绑定真实游戏输入。
 */

import type { GameMode, GroupId, MoveMode, PuzzleSize } from '../types';
import { createSolvedBoard, isPuzzleSize } from '../core/board';
import { isGroupId } from '../core/groups';
import { BUILTIN_THEMES } from '../core/appearance/presets';
import { createBoardView, type BoardView } from '../ui/board-view';

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`布局实验室缺少元素：${selector}`);
  }
  return element;
}

const THEME = BUILTIN_THEMES[0];
const GROUP_NAMES = Array.from({ length: 10 }, (_, index) => `G${index + 1}`);

const sizeDisplay = requireElement<HTMLElement>('[data-size-display]');
const boardMount = requireElement<HTMLElement>('#lab-board');
const sizeButton = requireElement<HTMLButtonElement>('[data-popover-trigger="size"]');
const modeButton = requireElement<HTMLButtonElement>('[data-popover-trigger="game-mode"]');
const moveButton = requireElement<HTMLButtonElement>('[data-popover-trigger="move-mode"]');
const groupButton = requireElement<HTMLButtonElement>('[data-popover-trigger="group"]');
const groupName = requireElement<HTMLElement>('[data-group-name]');

const sizeOptions = [...document.querySelectorAll<HTMLButtonElement>('[data-size-option]')];
const gameModeOptions = [
  ...document.querySelectorAll<HTMLButtonElement>('[data-game-mode-option]'),
];
const moveModeOptions = [
  ...document.querySelectorAll<HTMLButtonElement>('[data-move-mode-option]'),
];
const groupOptions = [...document.querySelectorAll<HTMLButtonElement>('[data-group-option]')];

let size: PuzzleSize = 4;
let gameMode: GameMode = 'normal';
let moveMode: MoveMode = 'slide';
let groupId: GroupId = 1;
let boardView: BoardView | null = null;
let openPopover: HTMLElement | null = null;
let openTrigger: HTMLButtonElement | null = null;

function getGroupName(id: GroupId): string {
  return GROUP_NAMES[id - 1] ?? `G${id}`;
}

function syncPressedByValue(
  buttons: readonly HTMLButtonElement[],
  datasetKey: string,
  value: number,
): void {
  for (const button of buttons) {
    button.setAttribute('aria-pressed', String(Number(button.dataset[datasetKey]) === value));
  }
}

function syncPressedByString(
  buttons: readonly HTMLButtonElement[],
  datasetKey: string,
  value: string,
): void {
  for (const button of buttons) {
    button.setAttribute('aria-pressed', String(button.dataset[datasetKey] === value));
  }
}

function updateSizeDisplay(): void {
  const label = `${size}×${size}`;
  sizeDisplay.textContent = label;
  sizeButton.title = `切换阶数（当前 ${label}）`;
  sizeButton.setAttribute('aria-label', sizeButton.title);
}

function updateModeButton(): void {
  const label = gameMode === 'normal' ? '普通' : '盲玩';
  modeButton.dataset.gameMode = gameMode;
  modeButton.title = `游戏模式：${label}`;
  modeButton.setAttribute('aria-label', modeButton.title);
}

function updateMoveButton(): void {
  const labels: Record<MoveMode, string> = {
    click: '点击',
    slide: '滑动',
    keyboard: '键盘',
  };
  const label = labels[moveMode];
  moveButton.dataset.moveMode = moveMode;
  moveButton.title = `操作模式：${label}`;
  moveButton.setAttribute('aria-label', moveButton.title);
}

function updateGroupButton(): void {
  const name = getGroupName(groupId);
  groupName.textContent = name;
  groupButton.title = `切换分组：${name}`;
  groupButton.setAttribute('aria-label', groupButton.title);
}

function renderBoard(): void {
  boardView?.destroy();
  boardView = createBoardView({
    root: boardMount,
    size,
    theme: THEME,
    numbersVisible: gameMode === 'normal',
  });
  boardView.update(createSolvedBoard(size));
}

function setSize(next: PuzzleSize): void {
  if (size !== next) {
    size = next;
    updateSizeDisplay();
    renderBoard();
  }
  syncPressedByValue(sizeOptions, 'sizeOption', size);
}

function setGameMode(next: GameMode): void {
  gameMode = next;
  updateModeButton();
  boardView?.setNumbersVisible(next === 'normal');
  syncPressedByString(gameModeOptions, 'gameModeOption', gameMode);
}

function setMoveMode(next: MoveMode): void {
  moveMode = next;
  updateMoveButton();
  syncPressedByString(moveModeOptions, 'moveModeOption', moveMode);
}

function setGroup(next: GroupId): void {
  groupId = next;
  updateGroupButton();
  syncPressedByValue(groupOptions, 'groupOption', groupId);
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

for (const trigger of document.querySelectorAll<HTMLButtonElement>('[data-popover-trigger]')) {
  trigger.addEventListener('click', () => {
    const name = trigger.dataset.popoverTrigger;
    if (name !== undefined) {
      togglePopover(trigger, name);
    }
  });
}

for (const option of sizeOptions) {
  option.addEventListener('click', () => {
    const value = Number(option.dataset.sizeOption);
    if (!isPuzzleSize(value)) {
      return;
    }
    setSize(value);
    closePopover(true);
  });
}

for (const option of gameModeOptions) {
  option.addEventListener('click', () => {
    const value = option.dataset.gameModeOption;
    if (value === 'normal' || value === 'blind') {
      setGameMode(value);
      closePopover(true);
    }
  });
}

for (const option of moveModeOptions) {
  option.addEventListener('click', () => {
    const value = option.dataset.moveModeOption;
    if (value === 'click' || value === 'slide' || value === 'keyboard') {
      setMoveMode(value);
      closePopover(true);
    }
  });
}

for (const option of groupOptions) {
  option.addEventListener('click', () => {
    const value = Number(option.dataset.groupOption);
    if (isGroupId(value)) {
      setGroup(value);
      closePopover(true);
    }
  });
}

document.addEventListener('pointerdown', (event) => {
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

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && openPopover !== null) {
    event.preventDefault();
    closePopover(true);
  }
});

updateSizeDisplay();
updateModeButton();
updateMoveButton();
updateGroupButton();
renderBoard();

// 初始选中态以脚本状态为准，避免以后调整默认值时 HTML 与脚本不一致。
setSize(size);
setGameMode(gameMode);
setMoveMode(moveMode);
setGroup(groupId);
