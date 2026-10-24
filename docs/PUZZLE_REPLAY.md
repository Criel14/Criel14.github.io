# 数字华容道回放设计

> 状态：P5 已实现（时间轴、播放器与长录像测试）
>
> 分支：`refactor/vite-ts`
>
> 范围：`core/replay.ts`、`core/replay-playback.ts`、回放存储编码约定
>
> 配套文档：`docs/PUZZLE_ARCHITECTURE.md`、`docs/PUZZLE_STORAGE.md`、`docs/PUZZLE_TASKS.md`

## 0. 结论摘要

- 回放使用**时间轴 + `requestAnimationFrame`**，不用 `setInterval` 逐帧推进。
- `normal` 的播放时间扣除观察时间，`blind` 的播放时间包含观察时间。
- 时间轴每一帧保存 `board`、`step`、`timeMs`；`getFrameAt` 用二分查找。
- 回放数据损坏时记录 `issues`，尽量保留可播放的部分，不抛异常。
- 录像在 core / UI 中使用 `ReplayRecord { scoreId, moves }`；IndexedDB 中由 data 层编码为 `StoredReplayV2` 紧凑格式，见 `docs/PUZZLE_STORAGE.md`。
- P5 不提前实现 checkpoint / 按需物化盘面；用 10×10、约 3,000 步的长录像测试覆盖性能边界，后续再按实际数据决定是否升级。

## 1. 时间语义

`MoveRecord.timeMs` 是**相对本局创建时刻**的毫秒数，不是墙钟时间，也不一定是播放时间轴时间。

成绩中的时间字段：

| 字段 | 含义 |
| --- | --- |
| `observeMs` | 第一次有效移动前的时间；`normal` 的播放要扣掉它 |
| `durationMs` | 有效用时；`normal` 不含观察时间，`blind` 含观察时间 |
| `finishedAt` | 完成时刻，epoch ms |
| `moves[].timeMs` | 相对创建时刻的移动时间，单调不减 |

播放时间换算：

```ts
normal: playbackTime = max(0, move.timeMs - score.observeMs)
blind:  playbackTime = move.timeMs
```

以 3×3 为例：

- `normal`：创建后 1,000ms 第一次移动，3,000ms 第二次移动，`observeMs = 1000`，`durationMs = 2000`。
  - 播放时间轴：第 0 帧 0，第一次移动 0，第二次移动 2000。
- `blind`：创建后 3,000ms 第一次移动，6,000ms 复原，`observeMs = 3000`，`durationMs = 6000`。
  - 播放时间轴：第 0 帧 0，第一次移动 3000，第二次移动 6000。

`normal` 的第一次移动播放时间通常为 0，因为 `observeMs` 就是第一次移动相对创建时刻的时间。`blind` 的首步前会保留观察等待。

## 2. 类型

回放相关类型放在各自的 core 模块中，不放入 `types.ts`：它们是运行时派生状态，不是需要持久化的领域事实。

```ts
/** 回放时间轴上的一帧；timeMs 是播放时间轴，不是 MoveRecord.timeMs。 */
export interface ReplayFrame {
  readonly board: Board;
  /** 已应用的步数，0 表示打乱盘面。 */
  readonly step: number;
  /** 播放时间轴毫秒，从 0 开始单调不减。 */
  readonly timeMs: number;
}

export type ReplayIssueCode =
  | 'invalid-board'
  | 'move-count-mismatch'
  | 'invalid-move'
  | 'non-monotonic-time';

export interface ReplayIssue {
  readonly code: ReplayIssueCode;
  readonly message: string;
  /** 1-based 步号；与具体移动无关的 issue 省略。 */
  readonly step?: number;
}

export interface ReplayTimeline {
  readonly scoreId: string;
  readonly frames: readonly ReplayFrame[];
  /** 播放总时长，单位 ms；保证不小于最后一帧的 timeMs。 */
  readonly durationMs: number;
  readonly issues: readonly ReplayIssue[];
}
```

播放器状态：

```ts
export interface PlaybackState {
  readonly positionMs: number;
  readonly playing: boolean;
  readonly speed: number;
  readonly anchorPositionMs: number;
  readonly anchorNowMs: number;
}

export interface PlaybackUpdate {
  readonly state: PlaybackState;
  readonly frame: ReplayFrame | null;
  readonly finished: boolean;
}

export const PLAYBACK_SPEEDS = [
  0.125, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 5, 10,
] as const;
```

## 3. 时间轴构建

### 3.1 API

```ts
buildReplayTimeline(score: ScoreRecord, replay: ReplayRecord): ReplayTimeline;
getFrameIndexAt(timeline: ReplayTimeline, positionMs: number): number;
getFrameAt(timeline: ReplayTimeline, positionMs: number): ReplayFrame | null;
```

`getFrameIndexAt` 返回当前应显示的帧下标；空时间轴返回 `-1`。`getFrameAt` 基于它返回帧，空时间轴返回 `null`。

### 3.2 构建规则

1. 校验 `score.size` 与 `score.scramble`。
   - 非法时返回 `frames: []`、`durationMs: 0`，记录 `invalid-board`，不抛异常。
   - 回放页据此显示“录像不可用”，不崩溃。
2. 第 0 帧固定为打乱盘面：`step = 0`、`timeMs = 0`。
3. 如果 `score.moveCount !== replay.moves.length`，记录 `move-count-mismatch`，但**继续**使用实际 `moves` 构建。
   - 摘要不一致属于数据完整性问题，不代表后续移动一定无法执行。
4. 逐步应用移动：
   - 方向非法，或 `applyMove` 返回 `null`：记录 `invalid-move`，保留已经构建的帧并停止。
   - 每一步生成一帧，`step = index + 1`。
5. 时间换算：

```ts
const rawTime = score.gameMode === 'normal'
  ? move.timeMs - score.observeMs
  : move.timeMs;

let timeMs = max(0, rawTime);
timeMs = max(timeMs, previousFrame.timeMs);
```

   - `move.timeMs` 非有限、为负数，或换算后小于上一帧时间：记录 `non-monotonic-time`，夹到上一帧时间并继续。
6. `durationMs` 以 `score.durationMs` 为准，并保证不小于最后一帧时间：

```ts
const lastFrameTime = frames.at(-1)?.timeMs ?? 0;
const scoreDuration = Number.isFinite(score.durationMs)
  ? Math.max(0, score.durationMs)
  : 0;
const durationMs = Math.max(scoreDuration, lastFrameTime);
```

7. 防御性归一化：
   - `score.observeMs` 非有限或为负数时按 `0` 处理。
   - `score.durationMs` 非有限或为负数时按最后一帧时间处理。
   - data 层仍负责拒绝非法 `ScoreRecord`；core 的归一化只保证回放页不崩溃。

### 3.3 issue 策略

| 情况 | code | 是否继续 | 帧处理 |
| --- | --- | --- | --- |
| 初始盘面 / 阶数非法 | `invalid-board` | 停止 | 返回空时间轴 |
| `moveCount` 与 `moves.length` 不一致 | `move-count-mismatch` | 继续 | 使用实际 moves 构建 |
| 方向非法或当前盘面无法执行 | `invalid-move` | 停止 | 保留已构建帧 |
| 时间非有限、负数或回退 | `non-monotonic-time` | 继续 | 夹到上一帧时间 |

`issues` 按发现顺序排列。`invalid-board` 和 `invalid-move` 的 issue 不允许被后续数据“修复”或猜测补齐。

## 4. 取帧规则

`getFrameIndexAt` 的语义：

- 空时间轴：返回 `-1`。
- `positionMs` 非有限，或 `positionMs <= 首帧.timeMs`：返回 `0`。
- 其他情况：返回**最后一个** `timeMs <= positionMs` 的帧下标。
- 超过最后一帧时间：返回最后一帧下标。

因此：

- `positionMs = 0` 显示打乱帧，用户可以先看到初始盘面。
- 多步整行/整列移动共享同一时间时，播放跨过 0 后会显示这一组移动完成后的盘面。
- 在后面的时间点恰好等于多个帧的 `timeMs` 时，显示同时间组的最后一帧。

二分查找示例：

```ts
let low = 0;
let high = frames.length - 1;

while (low < high) {
  const mid = Math.ceil((low + high) / 2);
  if (frames[mid].timeMs <= positionMs) {
    low = mid;
  } else {
    high = mid - 1;
  }
}
```

## 5. 播放器状态机

### 5.1 位置公式

```ts
position = anchorPositionMs
  + max(0, nowMs - anchorNowMs) * speed;

position = clamp(position, 0, timeline.durationMs);
```

播放中不逐帧累加 `positionMs`，而是用锚点计算，避免定时器误差累积。

### 5.2 API

```ts
createPlayback(timeline: ReplayTimeline): PlaybackState;
play(state: PlaybackState, timeline: ReplayTimeline, nowMs: number): PlaybackState;
pause(state: PlaybackState, timeline: ReplayTimeline, nowMs: number): PlaybackState;
seekToFrame(state, timeline, index, nowMs): PlaybackState;
stepBy(state, timeline, delta, nowMs): PlaybackState;
setSpeed(state, timeline, speed, nowMs): PlaybackState;
updatePlayback(state, timeline, nowMs): PlaybackUpdate;
```

`play` / `pause` / `setSpeed` 也接收 `timeline`，这样所有位置相关函数都能把 `positionMs` 夹在 `[0, durationMs]` 内，不需要在 `PlaybackState` 中重复保存时长。

### 5.3 行为

| 操作 | 行为 |
| --- | --- |
| `createPlayback` | 初始位置 0、暂停、速度 1、锚点为 0 |
| `play` | 从当前位置开始；如果 `positionMs >= durationMs`，从 0 重新播放；空时间轴或 `durationMs <= 0` 时 no-op |
| `pause` | 结算当前位置并冻结；未播放时 no-op |
| `seekToFrame` | 暂停并跳到指定帧；索引 clamp 到 `[0, frames.length - 1]`；空时间轴 no-op |
| `stepBy` | 先结算当前位置，再按帧索引移动 `delta`；边界 clamp；并暂停 |
| `setSpeed` | 只接受 `PLAYBACK_SPEEDS` 中的值；播放中先结算当前位置并重设锚点，再应用新速度 |
| `updatePlayback` | 播放中按锚点推进；到达 `durationMs` 自动暂停并停在最后一帧；暂停时只取当前帧，不推进 |

详细约定：

- `nowMs` 非有限或早于 `anchorNowMs` 时按“没有经过时间”处理，不回写 `NaN`。
- `setSpeed` 不允许整体缩放历史时间。例如已以 1x 播放 1,000ms，再切到 10x，应从当前 1,000ms 位置继续，而不是变成 10,000ms。
- `stepBy` 的 `delta` 必须是整数；非整数返回原 state。
- `seekToFrame` / `stepBy` 会暂停播放，和旧版“点击上一步/下一步/进度条后暂停”的行为一致。
- `updatePlayback` 暂停时 `finished = positionMs >= durationMs`；空时间轴 `finished = true`、`frame = null`。
- 播放到末尾后再次 `play`，从 0 开始，和旧版“播放完再点播放从头开始”一致。

### 5.4 页面驱动

- 页面用 `requestAnimationFrame` 调用 `updatePlayback`。
- 暂停、播放结束、页面隐藏时停止 rAF。
- 只在 `frame.step` 变化时更新棋盘；时间文本可以每帧更新。
- 高倍速时如果一次 rAF 跨过多步，直接渲染当前最新帧，跳过中间步骤。
- 进度条按帧索引控制，调用 `seekToFrame`；不要按时间线性扫描。

## 6. 录像存储编码

core / UI 使用：

```ts
interface ReplayRecord {
  readonly scoreId: string;
  readonly moves: readonly MoveRecord[];
}
```

IndexedDB 中由 data 层存为紧凑格式：

```ts
interface StoredReplayV2 {
  readonly scoreId: string;
  /** 每个字符一步，只允许 U/D/L/R，长度等于步数。 */
  readonly directions: string;
  /**
   * 时间增量，单位 ms，与 directions 等长。
   * 第 0 项是相对创建时刻的 timeMs；后续项是相对上一步的增量。
   * 写入时统一保留 3 位小数，且均 >= 0。
   */
  readonly timeDeltas: readonly number[];
}
```

编码：

```ts
let previous = 0;
const timeDeltas = moves.map((move) => {
  // 绝对时间先四舍五入到 3 位小数，再计算增量。
  const roundedTimeMs = roundTimeMs(move.timeMs);
  const delta = roundTimeMs(roundedTimeMs - previous);
  previous = roundedTimeMs;
  return delta;
});

const directions = moves.map((move) => move.direction).join('');
```

解码：

```ts
let timeMs = 0;
const moves = [...directions].map((direction, index) => {
  timeMs = roundTimeMs(timeMs + timeDeltas[index]);
  return { direction, timeMs };
});
```

约束：

- `directions.length === timeDeltas.length`。
- `directions` 只允许 `U/D/L/R`。
- 每个 `timeDelta` 是非负有限数；写入时统一四舍五入到 3 位小数。
- 累计 `timeMs` 是有限数，且不超过 `Number.MAX_SAFE_INTEGER`。
- 步数上限 `MAX_REPLAY_MOVES = 100_000`，防止损坏数据分配超大数组。
- 解码失败时 `loadReplay` 返回 `null`，页面显示空状态。

估算（10×10 长录像）：

| 步数 | 对象数组（当前旧方案） | 紧凑编码（约） |
| --- | --- | --- |
| 2,000 | 70KB | 12–15KB |
| 5,000 | 175KB | 28–35KB |
| 10,000 | 340KB | 55–65KB |

紧凑编码的详细存储规则见 `docs/PUZZLE_STORAGE.md`。

## 7. 长录像与性能

### 7.1 时间轴内存

`ReplayTimeline.frames` 每一帧保存完整棋盘，内存复杂度是 `O(步数 × size²)`：

- 10×10 每帧约 100 个数字；3,000 步约 2.5MB。
- 10×10 10,000 步约 8MB。
- 4×4 / 5×5 基本可以忽略。

P5 先保留完整帧，原因是：

- 播放器、seek、进度条都实现简单。
- 10×10 常见录像通常在 1,000–3,000 步，2–3MB 可以接受。
- 真实数据出现压力前，不提前引入复杂的 checkpoint API。

### 7.2 后续升级路径

如果实际录像长期超过约 5,000 步，或移动端出现明显内存压力，再把时间轴改为：

- `frames` 只存 `step` / `timeMs` 元数据。
- 每 K 步保存一个完整棋盘 checkpoint（例如 K = 256）。
- `getBoardAt(timeline, step)` 从最近的 checkpoint 向前推演。
- 内存降为 `O(步数 + 步数/K × size²)`，随机 seek 最多推演 K 步。

该改动会改变 `ReplayFrame` 的形态和 P10 的取盘方式，不在 P5 范围内。

### 7.3 长录像测试

`replay-integration.test.ts` 增加一个 10×10、约 3,000 步的确定性用例：

1. 从复原盘面出发，用固定种子的伪随机源生成 3,000 步合法移动，得到打乱盘面。
2. 把这些移动按相反顺序、相反方向反转，作为从打乱盘面复原的录像。
3. 验证：
   - 帧数为 3,001；
   - 最后一帧是复原盘面；
   - `getFrameAt` 在中间和末尾正确；
   - seek 到中间后继续播放；
   - 播放到末尾自动暂停；
   - `issues` 为空。

测试不依赖 `Math.random`，避免偶发失败。

## 8. 测试计划

### `replay.test.ts`

- 0 步成绩只有首帧。
- normal 的时间偏移：观察 1,000ms，移动时间 1,000/3,000 → 播放时间 0/2,000。
- blind 不偏移，首步前保留观察等待。
- 非法方向、当前盘面无法执行的移动 → `invalid-move` 并停止。
- `moveCount` 不一致 → 记录 issue，但仍构建后续帧。
- 时间倒退、负数、`NaN` → clamp 到上一帧并记录 issue。
- `score.durationMs` 小于最后一帧时取最后一帧。
- 初始盘面损坏 → 空时间轴 + `invalid-board`。
- `getFrameAt` 首帧前、末帧后、中间、时间并列、空时间轴。
- 不修改传入的 `score` / `replay`。

### `replay-playback.test.ts`

- 创建状态、播放/暂停/恢复不跳时间。
- 1x → 10x、10x → 0.5x 时重新锚定，历史位置不被重新缩放。
- seek / step 的边界 clamp。
- 到达末尾自动暂停，停在最后一帧。
- 暂停状态下 `updatePlayback` 不推进。
- 末尾再次 `play` 从头播放。
- 空时间轴、非法 `nowMs` 不产生 `NaN`。

### `replay-integration.test.ts`

- 真实 session 生成一局 normal 4×4，关键时间点帧正确。
- blind 回放包含观察等待。
- 0 步、最后一步、seek 到中间后继续播放。
- 10×10、约 3,000 步长录像。
- `issues` 非空时 timeline 和 playback 仍可正常运行。

## 9. 不做的事

- 不在 core 中读写 localStorage / IndexedDB。
- 不在 P5 中实现 checkpoint / 按需物化盘面。
- 不引入二进制/压缩编码；当前紧凑 JSON 足够。
- 不做“按当时主题回放”；回放按成绩的阶数使用当前主题分配（`getThemeForSize`），后续如需可在成绩中增加 `themeId`。
