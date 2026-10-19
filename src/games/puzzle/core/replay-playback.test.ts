import { describe, expect, it } from 'vitest';
import type { Board } from '../types';
import type { ReplayTimeline } from './replay';
import {
  createPlayback,
  pause,
  play,
  setSpeed,
  seekToFrame,
  stepBy,
  updatePlayback,
} from './replay-playback';

const BOARD: Board = [1, 2, 3, 4, 5, 6, 7, 8, 0];

function createTimeline(): ReplayTimeline {
  return {
    scoreId: 'score-1',
    frames: [
      { board: BOARD, step: 0, timeMs: 0 },
      { board: BOARD, step: 1, timeMs: 1_000 },
      { board: BOARD, step: 2, timeMs: 2_000 },
      { board: BOARD, step: 3, timeMs: 5_000 },
    ],
    durationMs: 5_000,
    issues: [],
  };
}

describe('createPlayback', () => {
  it('初始暂停在开头，速度为 1 倍', () => {
    const state = createPlayback(createTimeline());

    expect(state).toEqual({
      positionMs: 0,
      playing: false,
      speed: 1,
      anchorPositionMs: 0,
      anchorNowMs: 0,
    });
  });
});

describe('play / pause / updatePlayback', () => {
  it('播放、暂停和恢复不跳时间', () => {
    const timeline = createTimeline();
    const playing = play(createPlayback(timeline), timeline, 1_000);

    const advanced = updatePlayback(playing, timeline, 2_000);
    expect(advanced.state.positionMs).toBe(1_000);
    expect(advanced.state.playing).toBe(true);
    expect(advanced.frame?.step).toBe(1);

    const paused = pause(advanced.state, timeline, 2_000);
    expect(paused).toMatchObject({
      positionMs: 1_000,
      playing: false,
      anchorPositionMs: 1_000,
    });

    const stillPaused = updatePlayback(paused, timeline, 5_000);
    expect(stillPaused.state.positionMs).toBe(1_000);
    expect(stillPaused.state.playing).toBe(false);
    expect(stillPaused.frame?.step).toBe(1);

    const resumed = play(paused, timeline, 5_000);
    const afterResume = updatePlayback(resumed, timeline, 5_500);
    expect(afterResume.state.positionMs).toBe(1_500);
    expect(afterResume.frame?.step).toBe(1);
    expect(afterResume.state.playing).toBe(true);
  });

  it('暂停时 updatePlayback 不推进', () => {
    const timeline = createTimeline();
    const update = updatePlayback(createPlayback(timeline), timeline, 99_999);

    expect(update.state.positionMs).toBe(0);
    expect(update.state.playing).toBe(false);
    expect(update.frame?.step).toBe(0);
    expect(update.finished).toBe(false);
  });

  it('到达末尾自动暂停，停在最后一帧；再次播放在头开始', () => {
    const timeline = createTimeline();
    const playing = play(createPlayback(timeline), timeline, 0);
    const finished = updatePlayback(playing, timeline, 6_000);

    expect(finished.state).toMatchObject({
      positionMs: 5_000,
      playing: false,
      anchorPositionMs: 5_000,
    });
    expect(finished.frame?.step).toBe(3);
    expect(finished.finished).toBe(true);

    const afterFinished = updatePlayback(finished.state, timeline, 7_000);
    expect(afterFinished.state.positionMs).toBe(5_000);
    expect(afterFinished.finished).toBe(true);

    const restarted = play(finished.state, timeline, 7_000);
    expect(restarted).toMatchObject({
      positionMs: 0,
      playing: true,
      anchorPositionMs: 0,
      anchorNowMs: 7_000,
    });

    const afterRestart = updatePlayback(restarted, timeline, 7_500);
    expect(afterRestart.state.positionMs).toBe(500);
    expect(afterRestart.frame?.step).toBe(0);
  });

  it('非法 nowMs 不产生 NaN', () => {
    const timeline = createTimeline();
    const playing = play(createPlayback(timeline), timeline, Number.NaN);
    const update = updatePlayback(playing, timeline, 1_000);
    const paused = pause(playing, timeline, Number.NaN);

    expect(Number.isFinite(playing.anchorNowMs)).toBe(true);
    expect(Number.isFinite(update.state.positionMs)).toBe(true);
    expect(Number.isFinite(update.state.anchorNowMs)).toBe(true);
    expect(Number.isFinite(paused.positionMs)).toBe(true);
    expect(Number.isFinite(paused.anchorNowMs)).toBe(true);
  });
});

describe('setSpeed', () => {
  it('播放中切换倍速先结算当前位置，不整体缩放历史时间', () => {
    const timeline = createTimeline();
    let state = play(createPlayback(timeline), timeline, 0);
    state = updatePlayback(state, timeline, 1_000).state;
    expect(state.positionMs).toBe(1_000);

    const fast = setSpeed(state, timeline, 10, 1_000);
    expect(fast.positionMs).toBe(1_000);
    expect(fast.speed).toBe(10);

    const afterFast = updatePlayback(fast, timeline, 1_100);
    expect(afterFast.state.positionMs).toBe(2_000);

    const slow = setSpeed(afterFast.state, timeline, 0.5, 1_100);
    expect(slow.positionMs).toBe(2_000);
    expect(slow.speed).toBe(0.5);

    const afterSlow = updatePlayback(slow, timeline, 2_100);
    expect(afterSlow.state.positionMs).toBe(2_500);
  });

  it('拒绝非法倍速或重复设置', () => {
    const timeline = createTimeline();
    const state = createPlayback(timeline);

    expect(setSpeed(state, timeline, 7, 0)).toBe(state);
    expect(setSpeed(state, timeline, 1, 0)).toBe(state);
  });

  it('暂停状态下切换倍速不改变位置', () => {
    const timeline = createTimeline();
    const state = createPlayback(timeline);
    const fast = setSpeed(state, timeline, 10, 0);

    expect(fast.positionMs).toBe(0);
    expect(fast.playing).toBe(false);
    expect(fast.speed).toBe(10);
  });
});

describe('seekToFrame / stepBy', () => {
  it('seek 到指定帧并暂停，索引越界时 clamp', () => {
    const timeline = createTimeline();
    const playing = play(createPlayback(timeline), timeline, 0);

    const last = seekToFrame(playing, timeline, 99, 100);
    expect(last.positionMs).toBe(5_000);
    expect(last.playing).toBe(false);
    expect(last.anchorPositionMs).toBe(5_000);

    const first = seekToFrame(last, timeline, -5, 100);
    expect(first.positionMs).toBe(0);
    expect(first.playing).toBe(false);

    expect(seekToFrame(first, timeline, Number.POSITIVE_INFINITY, 100).positionMs).toBe(5_000);
    expect(seekToFrame(first, timeline, Number.NaN, 100)).toBe(first);
  });

  it('步进按帧索引移动并暂停，边界和非法 delta 安全', () => {
    const timeline = createTimeline();
    const initial = createPlayback(timeline);

    const next = stepBy(initial, timeline, 1, 0);
    expect(next.positionMs).toBe(1_000);
    expect(next.playing).toBe(false);
    expect(next.anchorPositionMs).toBe(1_000);

    const first = stepBy(next, timeline, -99, 0);
    expect(first.positionMs).toBe(0);

    expect(stepBy(first, timeline, 1.5, 0)).toBe(first);
  });

  it('播放中步进先结算当前位置，再移动并暂停', () => {
    const timeline = createTimeline();
    const playing = play(createPlayback(timeline), timeline, 0);
    const advanced = updatePlayback(playing, timeline, 1_500).state;

    const next = stepBy(advanced, timeline, 1, 1_500);
    expect(next.positionMs).toBe(2_000);
    expect(next.playing).toBe(false);
  });

  it('seek 到中间后可以继续播放', () => {
    const timeline = createTimeline();
    const seeked = seekToFrame(createPlayback(timeline), timeline, 2, 0);
    const resumed = play(seeked, timeline, 0);
    const update = updatePlayback(resumed, timeline, 500);

    expect(update.state.positionMs).toBe(2_500);
    expect(update.state.playing).toBe(true);
    expect(update.frame?.step).toBe(2);
  });
});

describe('空时间轴', () => {
  const empty: ReplayTimeline = {
    scoreId: 'score-1',
    frames: [],
    durationMs: 0,
    issues: [],
  };

  it('play / seek / step 安全 no-op', () => {
    const state = createPlayback(empty);

    expect(play(state, empty, 0)).toBe(state);
    expect(seekToFrame(state, empty, 0, 0)).toBe(state);
    expect(stepBy(state, empty, 1, 0)).toBe(state);
  });

  it('update 返回 null 帧和 finished', () => {
    const update = updatePlayback(createPlayback(empty), empty, 0);

    expect(update.frame).toBeNull();
    expect(update.finished).toBe(true);
    expect(update.state.playing).toBe(false);
    expect(update.state.positionMs).toBe(0);
  });
});
