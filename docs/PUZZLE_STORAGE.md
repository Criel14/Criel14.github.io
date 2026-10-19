# 数字华容道数据存储设计

> 状态：P6 已完成（数据层与旧数据清理均已实现）
>
> 分支：`refactor/vite-ts`
>
> 范围：localStorage / IndexedDB 分层、数据库 schema、repository API、录像紧凑编码、错误处理
>
> 配套文档：`docs/PUZZLE_ARCHITECTURE.md`、`docs/PUZZLE_REPLAY.md`、`docs/PUZZLE_TASKS.md`

## 0. 决策摘要

- **设置和外观继续用 localStorage**：数据小、同步读写、页面启动即可用。
- **成绩列表和录像改用 IndexedDB**：数据大、需要按桶查询、需要原子事务。
- **不使用 `puzzle.v2.meta`**：localStorage 的 envelope 自带 `version`，IndexedDB 用 `DB_VERSION`。
- **数据库**：`puzzle.v2`，版本从 `1` 开始；object store 为 `scores` 和 `replays`，两者分开。
- **录像紧凑编码**：IndexedDB 中存 `directions` 字符串 + `timeDeltas` 增量数组，读取时解码为 `ReplayRecord`。
- **时间精度**：持久化的移动时间和时长统一保留 3 位小数；session 运行时仍使用完整精度。
- **IndexedDB 封装**：使用 `idb` 运行时依赖；测试使用 `fake-indexeddb`。
- **原子事务**：新增、删除成绩和录像都在同一个事务中完成，不再需要“先写 replay、失败回滚”。
- **v2 尚未上线，不做旧 v2 数据迁移**；旧版 localStorage 键只提供显式清理入口。
- **不做多标签页实时同步**：IndexedDB 事务本身安全，但页面刷新后才能看到其他标签页的修改。

## 1. 存储分层

| 数据 | 存储 | 位置 | 读写方式 |
| --- | --- | --- | --- |
| 游戏设置 | localStorage | `puzzle.v2.settings` | 同步 |
| 外观主题 | localStorage | `puzzle.v2.appearance` | 同步 |
| 成绩摘要 | IndexedDB | DB `puzzle.v2` → store `scores` | 异步 |
| 录像 | IndexedDB | DB `puzzle.v2` → store `replays` | 异步 |
| 旧版数据 | localStorage | `config` / `scores` / `currentScore` / `currentScoreList` | 只清理，不读取 |

这样分层的原因：

- 设置和外观在游戏页初始化时就要用，同步 localStorage 不需要 loading。
- 成绩需要按 `size + gameMode + groupId` 查询，IndexedDB 索引比每次解析整个数组更合适。
- 成绩和录像需要一起增删，放在同一个数据库里才能用事务保证一致性。
- 录像可能很长，IndexedDB 配额远大于 localStorage。
- 统计页只加载一个成绩桶，不加载任何录像。

### 1.1 不再使用的旧 v2 localStorage 方案

以下键是之前文档中的计划，现已取消：

- `puzzle.v2.scores`
- `puzzle.v2.replay.<scoreId>`
- `puzzle.v2.meta`

v2 没有正式上线，不提供从这些键迁移到 IndexedDB 的逻辑。若本地开发环境曾产生这些键，可以手动清理，或在后续维护入口中一并删除；不读取、不迁移。

## 2. localStorage

### 2.1 键与 envelope

| 键 | 内容 |
| --- | --- |
| `puzzle.v2.settings` | `{ version: 2, data: GameSettings }` |
| `puzzle.v2.appearance` | `{ version: 2, data: AppearanceState }` |

- 所有键统一 `puzzle.v2.` 前缀。
- 缺失键返回默认设置 / 默认外观。
- JSON 解析失败、schema 非法时回退默认值，并记录一次警告，不让页面崩溃。
- 写入失败（配额不足、存储不可用）抛出 `DataStoreError`，由页面显示非阻塞提示。
- localStorage 是同步 API，设置/外观读取不需要 loading 状态。

### 2.2 设置

默认值：

- `size: 4`
- `gameMode: 'normal'`
- `moveMode: 'slide'`
- `groupId: 1`
- `groups`: 固定 10 个，ID 1–10，默认名称 `G1`–`G10`
- `customCursor: false`
- `minimalUi: false`

约束：

- `groups` 固定 10 项，按 ID 1–10 排列；只允许修改 `name`。
- 名称允许重名，`trim()` 后不能为空，最长 30 字符。
- 非法 `groupId` 回退 `1`；缺失分组按 ID 补齐默认名称。
- 保存设置只写 `puzzle.v2.settings`，不影响成绩和录像。

### 2.3 外观

- 存储 `AppearanceState`：`activeThemeId` + `themes`。
- 内置主题不可修改、不可删除；自定义主题可以编辑颜色和 metrics。
- 主题非法时过滤；`activeThemeId` 失效时回退第一个内置主题。
- 外观保存不重开当前局；运行中禁止打开外观编辑由 UI 执行。

### 2.4 localStorage 适配器

`data/local-storage.ts` 提供：

```ts
interface StorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  keys(): string[];
}

createLocalStorage(): StorageAdapter;
createMemoryStorage(initial?: Readonly<Record<string, string>>): StorageAdapter;
readJson(storage: StorageAdapter, key: string): unknown | null;
writeJson(storage: StorageAdapter, key: string, value: unknown): void;
```

- `createMemoryStorage` 用于 Vitest，不依赖浏览器。
- `readJson` 只把 JSON 解析失败当作缺失数据返回 `null`；存储访问错误继续抛 `DataStoreError`，由 store 决定回退默认值。
- `writeJson` 捕获序列化错误和 `QuotaExceededError` 等异常，转换为 `DataStoreError`。
- 页面和 core 不直接调用 `localStorage`；只有 data 层使用适配器。

## 3. IndexedDB

### 3.1 数据库与 object store

```text
DB: puzzle.v2
version: 1

scores
  keyPath: id
  indexes:
    by-bucket: [size, gameMode, groupId]
    by-group: groupId

replays
  keyPath: scoreId
```

设计说明：

- `scores` 只存 `ScoreRecord`，不包含 moves；统计页不会加载录像。
- `replays` 以 `scoreId` 为主键，和成绩一一对应。
- `by-bucket` 用于统计页按 `size + gameMode + groupId` 查询，只返回目标桶。
- `by-group` 用于“按分组清空全部成绩”和分组条数统计，跨所有 size / gameMode。
- 不在 IndexedDB 中存 `number`、`tps`、`ao5`、`ao12` 等派生值。
- 不存 `puzzle.v2.meta`；版本由 `DB_VERSION` 和 localStorage envelope 管理。

### 3.2 `idb` 类型定义

```ts
import type { DBSchema } from 'idb';
import type { GameMode, GroupId, PuzzleSize, ScoreRecord } from '../types';
import type { StoredReplayV2 } from './replay-codec';

export const DB_NAME = 'puzzle.v2';
export const DB_VERSION = 1;

export interface PuzzleDB extends DBSchema {
  scores: {
    key: string;
    value: ScoreRecord;
    indexes: {
      'by-bucket': [PuzzleSize, GameMode, GroupId];
      'by-group': GroupId;
    };
  };
  replays: {
    key: string;
    value: StoredReplayV2;
  };
}
```

### 3.3 连接管理

`data/db.ts` 负责：

```ts
getDB(): Promise<IDBPDatabase<PuzzleDB>>;
closeDB(): Promise<void>;
deletePuzzleDB(): Promise<void>; // 测试或维护入口使用
```

- 使用模块级 `dbPromise` 单例；同一页面只打开一次连接。
- `upgrade` 中创建 object store 和索引；当前 `DB_VERSION = 1`。
- 监听 `blocked` / `blocking` / `terminated`：
  - `blocked`：其他标签页占用旧版本，提示用户关闭后重试。
  - `blocking`：本页阻塞升级，关闭连接并提示刷新。
  - `terminated`：清空 `dbPromise`，下次操作重新打开。
- 打开失败（隐私模式、浏览器限制）转换为 `DataStoreError('unavailable')`。
- 不把 `IDBDatabase` 暴露给页面；页面只使用 repository 函数。

### 3.4 事务与原子性

成绩和录像的写操作必须放在同一个 `readwrite` 事务中：

```ts
const storedReplay = encodeReplay(replay);
const tx = db.transaction(['scores', 'replays'], 'readwrite');

await Promise.all([
  tx.objectStore('scores').add(score),
  tx.objectStore('replays').add(storedReplay),
]);

await tx.done;
```

- 任意一边失败，事务回滚，不会留下孤立成绩或孤立录像。
- 新增使用 `add` 而不是 `put`：`id` / `scoreId` 重复时明确失败，避免覆盖已有成绩。
- 删除成绩时同时删除对应录像。
- 按桶/按组清空时，在同一个事务中删除两个 store。
- 清空全部时，在同一个事务中 `clear()` 两个 store。

IndexedDB 的事务只应包含数据库请求；不要在事务中 `await` 与数据库无关的异步操作，否则事务可能提前提交。

## 4. 录像紧凑编码

### 4.1 core 与存储的分工

core / UI 使用：

```ts
interface ReplayRecord {
  readonly scoreId: string;
  readonly moves: readonly MoveRecord[];
}
```

IndexedDB 使用：

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

- `ReplayRecord` 是 core / UI 的运行时类型，便于测试和回放逻辑。
- `StoredReplayV2` 只存在于 data 层；`loadReplay` 解码后返回 `ReplayRecord`。
- 页面、回放时间轴、统计逻辑都不感知存储编码。

### 4.2 编码与解码

编码：

```ts
let previous = 0;
const timeDeltas = moves.map((move) => {
  // 先按绝对时间四舍五入到 3 位小数，再计算增量；
  // 避免长录像的累计误差随步数增长。
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

### 4.3 校验

写入前和读取时都校验：

- `scoreId` 非空字符串，且与成绩 ID 一致。
- `directions.length === timeDeltas.length`。
- `directions` 只包含 `U/D/L/R`。
- 每个 `timeDelta` 是非负有限数；写入时统一四舍五入到 3 位小数。
- 累计 `timeMs` 是有限数，且单调不减；超过 `Number.MAX_SAFE_INTEGER` 视为损坏。
- 步数不超过 `MAX_REPLAY_MOVES = 100_000`。
- `encodeReplay` 遇到非法 `MoveRecord`（方向、负数、回退时间）时抛 `DataStoreError('validation')`。
- `decodeReplay` 失败时 `loadReplay` 返回 `null`，不把异常抛到页面。

### 4.4 体积估算

| 步数 | 对象数组（旧方案） | 紧凑编码（约） |
| --- | --- | --- |
| 2,000 | 70KB | 12–15KB |
| 5,000 | 175KB | 28–35KB |
| 10,000 | 340KB | 55–65KB |

IndexedDB 本身配额远大于 localStorage，但紧凑编码仍然有价值：

- 减少结构化克隆和磁盘占用。
- 长录像读取更快。
- 为未来导出/导入 JSON 保持可读格式。

暂不做二进制/bit packing/base64：对 10,000 步只能再省一部分，但会显著增加编码、解码和测试复杂度。若未来确实需要，再评估 `Uint8Array` 或压缩。

## 5. Repository API

### 5.1 成绩与录像

`data/score-store.ts`：

```ts
listScoresByBucket(filter: ScoreFilter): Promise<ScoreRecord[]>;
getScoreById(id: string): Promise<ScoreRecord | null>;

addScoreWithReplay(score: ScoreRecord, replay: ReplayRecord): Promise<void>;
removeScore(id: string): Promise<void>;

countScoresByBucket(filter: ScoreFilter): Promise<number>;
countScoresByGroup(groupId: GroupId): Promise<number>;
countAllScores(): Promise<number>;

clearScoresByBucket(filter: ScoreFilter): Promise<number>;
clearScoresByGroup(groupId: GroupId): Promise<number>;
clearAllScores(): Promise<void>;
```

`data/replay-store.ts`：

```ts
loadReplay(scoreId: string): Promise<ReplayRecord | null>;
```

约定：

- 不公开独立的 `saveReplay` / `removeReplay`，避免产生孤立录像；写入和删除统一走 `score-store` 的原子操作。
- `listScoresByBucket` 使用 `by-bucket` 索引，只返回目标桶；排序、编号、ao 仍由 core 的 `stats` / `score` 函数完成。
- `getScoreById` 使用主键，不做全表扫描。
- `loadReplay` 使用主键，解码失败或缺失返回 `null`。
- `countScoresByGroup` / `countScoresByBucket` 用于清空确认框；`countAllScores` 用于“清空全部”确认。
- `clearScoresByBucket` / `clearScoresByGroup` 返回实际删除的成绩条数。
- `removeScore` 和清空操作在同一个事务里同时删除成绩和录像。

### 5.2 设置与外观

`data/settings-store.ts`：

```ts
loadSettings(storage?: StorageAdapter): GameSettings;
saveSettings(settings: GameSettings, storage?: StorageAdapter): void;
```

`data/appearance-store.ts`：

```ts
loadAppearance(storage?: StorageAdapter): AppearanceState;
saveAppearance(appearance: AppearanceState, storage?: StorageAdapter): void;
```

- 同步 API。
- 默认使用 `createLocalStorage()`；测试可传入 `createMemoryStorage()`。
- 页面不直接操作键名。

## 6. 页面读写流程

### 6.1 游戏页

1. 同步读取 settings / appearance。
2. `?retry=<id>`：异步 `getScoreById(id)`；加载期间显示 loading。
   - 找不到成绩：显示错误，回到普通新局或提供返回成绩页入口。
3. 复原后构造 `ScoreRecord` + `ReplayRecord`，`await addScoreWithReplay(score, replay)`。
4. 保存失败：保留当前结果，显示非阻塞提示，允许重试；不要把失败结果直接丢掉。
5. 保存过程中禁用“再来一局”，避免重复写入。

### 6.2 成绩页

1. 解析 URL 的 `size / mode / group`。
2. `await listScoresByBucket(filter)`；只加载当前桶。
3. 用 core 的 `sortScores` / `assignNumbers` / `computeScoreStats` 计算展示数据。
4. 删除单条：`await removeScore(id)`，局部更新。
5. 清空当前筛选：`await clearScoresByBucket(filter)`。
6. 清空分组：先 `countScoresByGroup(groupId)`，确认后 `clearScoresByGroup(groupId)`。
7. 清空全部：先 `countAllScores()`，确认后 `clearAllScores()`。
8. 筛选快速切换时使用请求序号或取消标记，忽略过期结果，避免旧数据覆盖新筛选。

统计页永远不调用 `loadReplay`。

### 6.3 回放页

1. 解析 `?score=<id>`。
2. `await getScoreById(id)` 和 `await loadReplay(id)`。
3. 成绩缺失 → 空状态；成绩存在但录像缺失/损坏 → “录像不可用”状态。
4. `buildReplayTimeline(score, replay)`，空时间轴或 issues 非空时显示提示，但仍允许播放可用部分。
5. 使用当前外观主题渲染回放棋盘。

## 7. 错误处理

### 7.1 错误类型

`data/errors.ts` 或 `data/schema.ts` 提供：

```ts
type DataStoreErrorCode =
  | 'unavailable'
  | 'blocked'
  | 'quota'
  | 'validation'
  | 'corrupt'
  | 'unknown';

class DataStoreError extends Error {
  readonly code: DataStoreErrorCode;
  readonly cause?: unknown;
}
```

映射：

| 场景 | code | 页面行为 |
| --- | --- | --- |
| IndexedDB 不可用 / 打开失败 | `unavailable` | 提示存储不可用；设置仍可用 |
| `blocked` / `versionchange` | `blocked` | 提示关闭其他标签页或刷新 |
| `QuotaExceededError` | `quota` | 提示清理成绩/录像或重试 |
| 写入数据不合法 | `validation` | 阻止写入，记录错误 |
| 读取记录损坏 | `corrupt` | 过滤记录 / 显示空状态 |
| 其他异常 | `unknown` | 非阻塞提示，保留页面可用 |

### 7.2 原则

- 不因为一条损坏记录让整页崩溃。
- `listScoresByBucket` 过滤非法成绩并记录警告；返回可用的成绩。
- `getScoreById` / `loadReplay` 缺失或非法时返回 `null`。
- localStorage 设置/外观损坏时回退默认值。
- **不做 localStorage 降级存储**：IndexedDB 不可用时，成绩功能明确不可用，避免出现两套数据源和迁移问题。
- 可以提示用户使用导出/清理功能；导出功能属于后续扩展。

### 7.3 浏览器限制

- 隐私模式、企业策略、浏览器设置可能导致 IndexedDB 不可用。
- 配额通常远大于 localStorage，但仍可能被系统回收；`navigator.storage.persist()` 可作为后续增强，不在 P6 必做。
- GitHub Pages 与 Netlify 是不同 origin，数据不互通，和 localStorage 时期一致。

## 8. 测试策略

### 8.1 依赖

```bash
npm install idb
npm install -D fake-indexeddb
```

- `idb` 进入 `dependencies`。
- `fake-indexeddb` 进入 `devDependencies`，只在 Vitest 中使用。

### 8.2 `local-storage.test.ts`

- 内存存储读写/删除。
- 损坏 JSON 返回 `null`。
- 写入异常转换为 `DataStoreError`。
- 缺失键返回默认值。
- 设置/外观的默认值、非法字段回退。

### 8.3 `replay-codec.test.ts`

- 0 步、1 步、3,000 步、10,000 步往返一致。
- 方向字符串非法、长度不一致、负 delta、非有限 delta、累计溢出。
- 超过 `MAX_REPLAY_MOVES` 被拒绝。
- `encodeReplay` 拒绝非单调时间。
- 估算体积：10,000 步紧凑编码明显小于对象数组。

### 8.4 `score-store.test.ts`（fake-indexeddb）

- 新增成绩 + 录像后两者都可读。
- 重复 `id` 导致事务回滚，不留下孤立录像。
- `listScoresByBucket` 只返回目标 `size + gameMode + groupId`。
- `by-group` 查询/计数跨 size 和 gameMode。
- 删除单条同时删除录像。
- 清空当前桶只删除目标桶。
- 清空分组只删除目标组，其他组保留。
- 清空全部清空两个 store。
- 损坏成绩记录被过滤；损坏录像返回 `null`。
- 成绩和录像数量一致；没有孤立数据。

测试隔离：

- 每个测试文件使用 `import 'fake-indexeddb/auto'`。
- `beforeEach` / `afterEach` 调用 `closeDB()` 和 `deletePuzzleDB()`，或使用独立数据库名。
- 不使用真实浏览器数据库，避免测试互相污染。

### 8.5 长录像

- 保存并读取 10×10、约 3,000 步录像。
- 校验解码后的 moves 与原始一致。
- 校验记录体积在紧凑编码预期范围内（不写死过窄的字节数）。

### 8.6 E2E

Playwright 阶段补充真实浏览器 IndexedDB 冒烟：

- 完成一局后刷新，成绩和录像仍在。
- 删除成绩后录像不存在。
- 清空分组后该组为空，其他组保留。
- 设置和外观刷新后仍在（localStorage）。
- 隐私模式/存储不可用的提示（可手动验收）。

## 9. 目录与依赖边界

```text
src/games/puzzle/data/
├─ local-storage.ts    # localStorage 适配器、内存实现、JSON 读写
├─ db.ts               # IndexedDB 打开、schema、连接管理
├─ errors.ts           # DataStoreError 与错误码
├─ schema.ts           # 各 record 的类型守卫
├─ time.ts             # 3 位小数时间精度工具
├─ replay-codec.ts     # StoredReplayV2 编码/解码/校验
├─ settings-store.ts   # localStorage：设置
├─ appearance-store.ts # localStorage：外观
├─ score-store.ts      # IndexedDB：成绩 + 录像原子操作
├─ replay-store.ts     # IndexedDB：只读加载录像
└─ legacy.ts           # 旧 localStorage 键清理
```

依赖规则：

- `core` 不 import `data`。
- `data` 可以 import `core` 的类型和纯函数，不 import `ui` / `pages`。
- `data` 是唯一允许访问 localStorage / IndexedDB 的层。
- `ui` 不 import `data`；需要数据时由 `pages` 传入。
- `pages` 负责 await 异步 repository、loading 状态和错误提示。
- `replay-codec.ts` 是纯函数模块，不直接访问数据库。

## 10. 文档与计划影响

- `docs/PUZZLE_ARCHITECTURE.md` 第 5 节改为存储分层摘要，详细规则以本文为准。
- `docs/PUZZLE_REPLAY.md` 负责回放时间轴、播放器和录像编码约定。
- `docs/PUZZLE_TASKS.md` 的 P6-1 / P6-2 / P6-5 按本文重写。
- `docs/REFACTOR_PLAN.md` 第 6 节数据策略、第 9 节待讨论同步更新。
- P7–P10 页面任务需要补充异步加载、loading、错误提示和请求竞态处理。
- P11 文档与最终验收需要覆盖 IndexedDB 持久化、隐私模式、配额错误和长录像。

## 11. 不做的事

- 不从旧版 localStorage 成绩/录像迁移。
- 不从已取消的 `puzzle.v2.scores` / `puzzle.v2.replay.*` 迁移。
- 不做 localStorage 降级存储。
- 不做多标签页实时同步。
- 不在 P6 做二进制/压缩编码。
- 不在 P6 做成绩/录像导入导出；列入后续扩展。
- 不把 Settings / Appearance 放进 IndexedDB。
