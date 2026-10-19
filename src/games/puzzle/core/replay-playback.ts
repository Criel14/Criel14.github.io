import type { ReplayFrame, ReplayTimeline } from './replay';
import { getFrameAt, getFrameIndexAt } from './replay';

/** 旧版回放的倍速档位；setSpeed 只接受这些值。 */
export const PLAYBACK_SPEEDS = [0.125, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 5, 10] as const;

/**
 * 播放器状态。
 *
 * positionMs 是最近一次结算后的位置；播放中真实位置由
 * anchorPositionMs + (nowMs - anchorNowMs) * speed 计算。
 * 这样不依赖逐帧定时器，倍速切换也不会缩放已经播放过的历史时间。
 */
export interface PlaybackState {
  readonly positionMs: number;
  readonly playing: boolean;
  readonly speed: number;
  readonly anchorPositionMs: number;
  readonly anchorNowMs: number;
}

/** updatePlayback 的返回值；frame 与 state.positionMs 对应。 */
export interface PlaybackUpdate {
  readonly state: PlaybackState;
  readonly frame: ReplayFrame | null;
  readonly finished: boolean;
}

function getDurationMs(timeline: ReplayTimeline): number {
  return Number.isFinite(timeline.durationMs) ? Math.max(0, timeline.durationMs) : 0;
}

function clampPosition(positionMs: number, durationMs: number): number {
  if (!Number.isFinite(positionMs)) {
    return 0;
  }
  return Math.min(Math.max(0, durationMs), Math.max(0, positionMs));
}

/**
 * 把调用方时间夹到锚点之后。
 * 非法时间或早于锚点的时钟回拨按“没有经过时间”处理，避免产生 NaN 或负时长。
 */
function getSafeNow(nowMs: number, anchorNowMs: number): number {
  const fallback = Number.isFinite(anchorNowMs) ? anchorNowMs : 0;
  if (!Number.isFinite(nowMs)) {
    return fallback;
  }
  return Math.max(fallback, nowMs);
}

function isPlaybackSpeed(speed: number): boolean {
  return (PLAYBACK_SPEEDS as readonly number[]).includes(speed);
}

/** 播放中按锚点公式推进；暂停时只返回已保存的位置。 */
function getPositionAt(state: PlaybackState, timeline: ReplayTimeline, nowMs: number): number {
  const durationMs = getDurationMs(timeline);
  if (!state.playing) {
    return clampPosition(state.positionMs, durationMs);
  }

  const anchorNowMs = Number.isFinite(state.anchorNowMs) ? state.anchorNowMs : 0;
  const anchorPositionMs = Number.isFinite(state.anchorPositionMs) ? state.anchorPositionMs : 0;
  const elapsedMs = Math.max(0, getSafeNow(nowMs, anchorNowMs) - anchorNowMs);
  const speed = Number.isFinite(state.speed) && state.speed > 0 ? state.speed : 1;

  return clampPosition(anchorPositionMs + elapsedMs * speed, durationMs);
}

/** 创建暂停在开头的播放状态。 */
export function createPlayback(timeline: ReplayTimeline): PlaybackState {
  const positionMs = clampPosition(0, getDurationMs(timeline));
  return {
    positionMs,
    playing: false,
    speed: 1,
    anchorPositionMs: positionMs,
    anchorNowMs: 0,
  };
}

/**
 * 开始播放。
 *
 * 已播放到末尾时从 0 重新开始；空时间轴或零时长时保持原状态。
 * 已经处于播放状态时 no-op，避免重复调用重置锚点。
 */
export function play(state: PlaybackState, timeline: ReplayTimeline, nowMs: number): PlaybackState {
  const durationMs = getDurationMs(timeline);
  if (state.playing || timeline.frames.length === 0 || durationMs <= 0) {
    return state;
  }

  const currentPosition = clampPosition(state.positionMs, durationMs);
  const positionMs = currentPosition >= durationMs ? 0 : currentPosition;
  const speed = isPlaybackSpeed(state.speed) ? state.speed : 1;

  return {
    positionMs,
    playing: true,
    speed,
    anchorPositionMs: positionMs,
    anchorNowMs: getSafeNow(nowMs, state.anchorNowMs),
  };
}

/** 暂停并结算当前位置；已经暂停时 no-op。 */
export function pause(
  state: PlaybackState,
  timeline: ReplayTimeline,
  nowMs: number,
): PlaybackState {
  if (!state.playing) {
    return state;
  }

  const positionMs = getPositionAt(state, timeline, nowMs);
  return {
    positionMs,
    playing: false,
    speed: state.speed,
    anchorPositionMs: positionMs,
    anchorNowMs: getSafeNow(nowMs, state.anchorNowMs),
  };
}

/** 跳到指定帧并暂停；索引越界时 clamp，空时间轴 no-op。 */
export function seekToFrame(
  state: PlaybackState,
  timeline: ReplayTimeline,
  index: number,
  nowMs: number,
): PlaybackState {
  if (timeline.frames.length === 0 || Number.isNaN(index)) {
    return state;
  }

  const targetIndex = Math.min(timeline.frames.length - 1, Math.max(0, Math.trunc(index)));
  const positionMs = timeline.frames[targetIndex].timeMs;

  return {
    positionMs,
    playing: false,
    speed: state.speed,
    anchorPositionMs: positionMs,
    anchorNowMs: getSafeNow(nowMs, state.anchorNowMs),
  };
}

/**
 * 按帧索引前进/后退并暂停。
 * delta 必须是整数；播放中调用时先结算当前位置，再按当前显示帧计算目标。
 */
export function stepBy(
  state: PlaybackState,
  timeline: ReplayTimeline,
  delta: number,
  nowMs: number,
): PlaybackState {
  if (timeline.frames.length === 0 || !Number.isInteger(delta)) {
    return state;
  }

  const currentPosition = getPositionAt(state, timeline, nowMs);
  const currentIndex = getFrameIndexAt(timeline, currentPosition);
  const targetIndex = Math.min(timeline.frames.length - 1, Math.max(0, currentIndex + delta));
  const positionMs = timeline.frames[targetIndex].timeMs;

  return {
    positionMs,
    playing: false,
    speed: state.speed,
    anchorPositionMs: positionMs,
    anchorNowMs: getSafeNow(nowMs, state.anchorNowMs),
  };
}

/**
 * 切换倍速。
 *
 * 播放中先按旧速度结算当前位置，再以该位置重设锚点；
 * 不能直接用新速度重算整个时间轴，否则历史位置会整体跳变。
 */
export function setSpeed(
  state: PlaybackState,
  timeline: ReplayTimeline,
  speed: number,
  nowMs: number,
): PlaybackState {
  if (!isPlaybackSpeed(speed) || speed === state.speed) {
    return state;
  }

  const durationMs = getDurationMs(timeline);
  const positionMs = getPositionAt(state, timeline, nowMs);
  const playing = state.playing && positionMs < durationMs;

  return {
    positionMs,
    playing,
    speed,
    anchorPositionMs: positionMs,
    anchorNowMs: getSafeNow(nowMs, state.anchorNowMs),
  };
}

/**
 * 推进播放状态并取出当前帧。
 *
 * - 播放中到达 durationMs 时自动暂停，停在最后一帧；
 * - 暂停时只取当前帧，不推进；
 * - 空时间轴返回 frame: null、finished: true。
 */
export function updatePlayback(
  state: PlaybackState,
  timeline: ReplayTimeline,
  nowMs: number,
): PlaybackUpdate {
  if (timeline.frames.length === 0) {
    return {
      state: {
        ...state,
        positionMs: 0,
        playing: false,
        anchorPositionMs: 0,
        anchorNowMs: getSafeNow(nowMs, state.anchorNowMs),
      },
      frame: null,
      finished: true,
    };
  }

  const durationMs = getDurationMs(timeline);

  if (!state.playing) {
    const positionMs = clampPosition(state.positionMs, durationMs);
    const frame = getFrameAt(timeline, positionMs);
    const finished = positionMs >= durationMs;
    const nextState =
      positionMs === state.positionMs
        ? state
        : {
            ...state,
            positionMs,
            anchorPositionMs: positionMs,
          };

    return { state: nextState, frame, finished };
  }

  const positionMs = getPositionAt(state, timeline, nowMs);
  const frame = getFrameAt(timeline, positionMs);
  const finished = positionMs >= durationMs;
  const nextState = finished
    ? {
        ...state,
        positionMs,
        playing: false,
        anchorPositionMs: positionMs,
        anchorNowMs: getSafeNow(nowMs, state.anchorNowMs),
      }
    : { ...state, positionMs };

  return { state: nextState, frame, finished };
}
