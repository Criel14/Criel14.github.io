# 数字华容道数据存储设计

> 状态：P6 已完成（数据层与旧数据清理均已实现）；分组模型改为事件级（2026-10-24 设计确认），P8-4a-0 分组模型与数据层已完成（2026-10-24）；P8-4b 独立设置页与 `site.v1.preferences` 已实现（2026-10-24，待手动验收）
>
> 分支：`refactor/vite-ts`
>
> 范围：localStorage / IndexedDB 分层、全站偏好、数据库 schema、repository API、录像紧凑编码、错误处理、容量估算
>
> 配套文档：`docs/PUZZLE_ARCHITECTURE.md`、`docs/PUZZLE_REPLAY.md`、`docs/PUZZLE_SCORE_PAGE.md`、`docs/PUZZLE_TASKS.md`、`docs/SETTINGS_PAGE.md`

## 0. 决策摘要

- **设置和外观继续用 localStorage**：数据小、同步读写、页面启动即可用。
- **全站偏好独立存储**：外观模式/语言存 localStorage `site.v1.preferences`（version 1），与拼图设置/外观分开；详见 `docs/SETTINGS_PAGE.md`。
- **成绩列表和录像改用 IndexedDB**：数据大、需要按桶查询、需要原子事务。
- **不使用 `puzzle.v2.meta`**：localStorage 的 envelope 自带 `version`，IndexedDB 用 `DB_VERSION`。
- **分组按事件划分**：事件 = 阶数 + 游戏模式，共 18 个；每个事件固定 5 个分组，共 90 个。`GroupId` 为事件内槽位 1–5，只允许改名。详见 `docs/PUZZLE_SCORE_PAGE.md`。
- **数据库**：`puzzle.v2`，`DB_VERSION = 2`；object store 为 `scores` 和 `replays`，两者分开。
- **录像先全量保存**：每条成绩保留对应录像；容量评估见 4.4，后续再按需增加保留策略。
- **录像紧凑编码**：IndexedDB 中存 `directions` 字符串 + `timeDeltas` 增量数组，读取时解码为 `ReplayRecord`。
- **时间精度**：持久化的移动时间和时长统一保留 3 位小数；session 运行时仍使用完整精度。
- **IndexedDB 封装**：使用 `idb` 运行时依赖；测试使用 `fake-indexeddb`。
- **原子事务**：新增、删除成绩和录像都在同一个事务中完成，不再需要“先写 replay、失败回滚”。
- **v2 尚未上线，不做旧 v2 数据迁移**；旧版 localStorage 键只提供显式清理入口；分组模型变更后清一次浏览器缓存即可。
- **不做多标签页实时同步**：IndexedDB 事务本身安全，但页面刷新后才能看到其他标签页的修改。

## 1. 存储分层

| 数据 | 存储 | 位置 | 读写方式 |
| --- | --- | --- | --- |
| 游戏设置 | localStorage | `puzzle.v2.settings` | 同步 |
| 外观主题 | localStorage | `puzzle.v2.appearance` | 同步 |
| 全站偏好 | localStorage | `site.v1.preferences` | 同步 |
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
| `puzzle.v2.settings` | `{ version: 3, data: GameSettings }` |
| `puzzle.v2.appearance` | `{ version: 3, data: AppearanceState }` |
| `site.v1.preferences` | `{ version: 1, data: SitePreferences }` |

- 拼图数据的键统一 `puzzle.v2.` 前缀；全站偏好使用 `site.v1.` 前缀，二者独立演进。
- 缺失键分别返回默认设置 / 默认外观 / 默认全站偏好。
- 拼图旧 envelope 版本（2）在清缓存后不再存在；如未清理，会按损坏数据处理并回退默认值。
- JSON 解析失败、schema 非法时回退默认值，并记录一次警告，不让页面崩溃。
- 写入失败（配额不足、存储不可用）抛出 `DataStoreError`，由页面显示非阻塞提示。
- localStorage 是同步 API，设置/外观/全站偏好读取不需要 loading 状态。

### 2.2 设置

默认值：

- `size: 4`
- `gameMode: 'normal'`
- `moveMode: 'slide'`
- `groupId: 1`
- `groups`: 固定 90 个；18 个事件 × 5 个槽位，默认名称 `分组1`–`分组5`
- `customCursor: false`
- `minimalUi: false`

约束：

- 事件 = `size + gameMode`；每个事件固定 5 项，`id` 为 1–5。`groups` 按阶数升序、普通在前、槽位 1–5 排列。
- 分组身份由 `size + gameMode + id` 共同确定；只允许修改 `name`，不允许改变事件/槽位，也不新增、删除或排序。
- 名称允许重名，`trim()` 后不能为空，最长 30 字符。
- 非法 `groupId` 回退 `1`；缺失分组按 `(size, gameMode, id)` 补齐默认名称。
- 默认名当前固定中文 `分组N`；`TODO(i18n)` 接入语言检测后再按语言返回 `GroupN`。
- 首次加载且键缺失时，页面写入默认设置，确保 90 个分组存在；损坏数据不自动覆盖。
- 保存设置只写 `puzzle.v2.settings`，不影响成绩和录像。

### 2.3 外观

- 存储 `AppearanceState`：`activeThemeId` + `themes`。
- 内置主题不可修改、不可删除；自定义主题可以编辑颜色、盲玩色和 metrics。
- 主题非法时过滤；`activeThemeId` 失效时回退第一个内置主题。
- `Theme.blindTileColor` 是盲玩隐藏数字时的方块背景色，必须是 `#rrggbb`；缺失或非法的主题会被过滤。
- P8-4b 设置页不读写外观；P8-4c 的外观编辑器先写 draft，用户点击“保存”后才写 `puzzle.v2.appearance`。
- 设置页是独立页面；从 `observing` / `solved` 进入，运行中/重玩中/保存中禁用入口，避免卸载当前局。

### 2.4 全站偏好

| 项 | 值 |
| --- | --- |
| key | `site.v1.preferences` |
| envelope | `{ version: 1, data: SitePreferences }` |
| 默认值 | `{ themeMode: 'light', language: 'zh-CN' }` |
| 代码 | `src/shared/preferences/` |
| 设计 | `docs/SETTINGS_PAGE.md` |

- `themeMode` 接受 `system` / `light` / `dark`，本轮 UI 只开放 `light`。
- `language` 接受 `zh-CN` / `en`，本轮可保存但界面暂不翻译。
- 缺失键不自动写入；用户在设置页点击“保存”才创建 key。
- 读取状态为 `ok` / `missing` / `corrupt` / `unavailable`，页面按状态提示。
- 字段级损坏时保留可恢复字段并返回 `corrupt`；保存时再一次性归一化并覆盖原数据。
- 该 store 使用自己的轻量存储适配器，不依赖拼图 `data/local-storage.ts`；后续可合并到 `src/shared/storage/`。
- 设置页路由当前是 `/puzzle-game/settings.html`，但 key 不放进 `puzzle.v2.*`，以后迁移全站设置页不需要迁移数据。

### 2.5 localStorage 适配器

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
readJsonResult(storage: StorageAdapter, key: string): JsonReadResult;
writeJson(storage: StorageAdapter, key: string, value: unknown): void;
```

- `createMemoryStorage` 用于 Vitest，不依赖浏览器。
- `readJsonResult` 返回 `ok` / `missing` / `corrupt` / `unavailable` 四种状态：
  - `ok` 时附带解析后的 `value`；
  - 缺失键为 `missing`，JSON 解析失败为 `corrupt`；
  - 存储访问失败为 `unavailable`，不再向上抛异常。
- `writeJson` 捕获序列化错误和 `QuotaExceededError` 等异常，转换为 `DataStoreError`。
- 页面和 core 不直接调用 `localStorage`；只有 data 层使用适配器。
- 全站偏好不复用这个拼图适配器；见 2.4。

## 3. IndexedDB

### 3.1 数据库与 object store

```text
DB: puzzle.v2
version: 2

scores
  keyPath: id
  indexes:
    by-bucket: [size, gameMode, groupId]
    by-event: [size, gameMode]

replays
  keyPath: scoreId
```

设计说明：

- `scores` 只存 `ScoreRecord`，不包含 moves；统计页不会加载录像。
- `replays` 以 `scoreId` 为主键，和成绩一一对应。
- `by-bucket` 用于统计页按 `size + gameMode + groupId` 查询，只返回目标桶。
- `by-event` 用于“清空当前事件的所有分组”和事件级计数。
- 不再使用全局 `by-group: groupId`；分组属于事件，跨所有阶数/模式按 `groupId` 清空没有意义。
- 不在 IndexedDB 中存 `number`、`tps`、`ao5`、`ao12` 等派生值。
- 不存 `puzzle.v2.meta`；版本由 `DB_VERSION` 和 localStorage envelope 管理。

### 3.2 `idb` 类型定义

```ts
import type { DBSchema } from 'idb';
import type { GameMode, GroupId, PuzzleSize, ScoreRecord } from '../types';
import type { StoredReplayV2 } from './replay-codec';

export const DB_NAME = 'puzzle.v2';
export const DB_VERSION = 2;

export interface PuzzleDB extends DBSchema {
  scores: {
    key: string;
    value: ScoreRecord;
    indexes: {
      'by-bucket': [PuzzleSize, GameMode, GroupId];
      'by-event': [PuzzleSize, GameMode];
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
- `upgrade` 中创建 object store 和索引；当前 `DB_VERSION = 2`。
- 从旧版本 1 升级时，先删除旧的 `scores` / `replays` store 再重建，避免旧的全局 `groupId 1–10` 和新的事件级槽位混在一起；v2 尚未上线，这属于开发期重置。
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
- 按桶/按事件清空时，在同一个事务中删除两个 store。
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

### 4.5 全量保存录像的容量估算

当前决策：**先全量保存每条成绩对应的录像**，不按成绩等级或时间裁剪。

保守估算：

```text
单条录像 ≈ 9–10 字节/步 + 约 200 字节固定开销
单条成绩 + 索引 ≈ 0.5–1.5KB（随阶数增长）
```

| 单局步数 | 录像约 | 成绩+索引约 | 单局合计约 |
| --- | --- | --- | --- |
| 100 步（4×4 常见） | 1–1.5KB | 0.6KB | 2KB |
| 300 步（5×5 左右） | 3–3.5KB | 0.8KB | 4KB |
| 1,000 步 | 9–11KB | 1KB | 11KB |
| 3,000 步（10×10 常见） | 27–33KB | 1.3KB | 29KB |
| 10,000 步（长局） | 90–110KB | 1.5KB | 100KB |

按不同规模估算：

| 成绩数量 | 平均步数 | 估算占用 |
| --- | --- | --- |
| 1,000 局 | 150 | 约 2.5MB |
| 10,000 局 | 150 | 约 25MB |
| 10,000 局 | 300 | 约 40MB |
| 10,000 局 | 2,500（偏 10×10） | 约 250MB |
| 100,000 局 | 300 | 约 400MB |
| 100,000 局 | 2,500 | 约 2.5GB |

结论：

- 90 个分组名称在 localStorage 中约 6–12KB，和录像相比可以忽略，不需要为了存储限制分组数量。
- 以 3×3 / 4×4 为主时，1 万局约 20–30MB，桌面浏览器通常很轻松。
- 大量 10×10 长局时，1 万局可能到 200–300MB；桌面通常可接受，移动 Safari 需要留意配额和回收。
- 浏览器配额不是固定值；后续可在设置/维护区显示 `navigator.storage.estimate()` 的实际用量。
- 暂不做保留策略；后续如需要，再加“只删除录像、保留成绩”“只保留最近 N 个月”或“只保留最佳成绩录像”。

## 5. Repository API

### 5.1 成绩与录像

`data/score-store.ts`：

```ts
listScoresByBucket(filter: ScoreFilter): Promise<ScoreRecord[]>;
getScoreById(id: string): Promise<ScoreRecord | null>;

addScoreWithReplay(score: ScoreRecord, replay: ReplayRecord): Promise<void>;
removeScore(id: string): Promise<void>;

countScoresByBucket(filter: ScoreFilter): Promise<number>;
countScoresByEvent(size: PuzzleSize, gameMode: GameMode): Promise<number>;
countAllScores(): Promise<number>;

clearScoresByBucket(filter: ScoreFilter): Promise<number>;
clearScoresByEvent(size: PuzzleSize, gameMode: GameMode): Promise<number>;
clearAllScores(): Promise<void>;

probeScoreStorage(): Promise<void>;
```

`data/replay-store.ts`：

```ts
loadReplay(scoreId: string): Promise<ReplayRecord | null>;
```

约定：

- 不公开独立的 `saveReplay` / `removeReplay`，避免产生孤立录像；写入和删除统一走 `score-store` 的原子操作。
- `listScoresByBucket` 使用 `by-bucket` 索引，只返回目标桶；排序、编号、ao 仍由 core 的 `stats` / `score` 函数完成。
- `getScoreById` 使用主键，不做全表扫描。
- `probeScoreStorage` 只打开数据库连接，用于页面启动时探测 IndexedDB 是否可用；失败抛出 `DataStoreError`。
- `loadReplay` 使用主键，解码失败或缺失返回 `null`。
- `countScoresByBucket` / `countScoresByEvent` 用于清空确认框；`countAllScores` 用于“清空全部”确认。
- `clearScoresByBucket` / `clearScoresByEvent` 返回实际删除的成绩条数；清空分组即清空当前桶，分组本身和名称保留。
- `removeScore` 和清空操作在同一个事务里同时删除成绩和录像。

### 5.2 设置与外观

`data/settings-store.ts`：

```ts
loadSettingsResult(storage?: StorageAdapter): {
  status: StorageReadStatus;
  settings: GameSettings;
};
ensureSettingsResult(storage?: StorageAdapter): SettingsLoadResult;
saveSettings(settings: GameSettings, storage?: StorageAdapter): void;
```

- `ensureSettingsResult` 只在完全缺失时写入默认设置（含 90 个分组），保证首次打开页面后分组数据存在；损坏数据不自动覆盖。
- 设置默认值和归一化规则见 2.2。
- 全站偏好的读取/保存与拼图设置/外观分开，接口和草稿流程见 `docs/SETTINGS_PAGE.md` 第 6 节。

`data/appearance-store.ts`：

```ts
loadAppearanceResult(storage?: StorageAdapter): {
  status: StorageReadStatus;
  appearance: AppearanceState;
};
saveAppearance(appearance: AppearanceState, storage?: StorageAdapter): void;
```

- 同步 API。
- 读取结果保留 `ok` / `missing` / `corrupt` / `unavailable` 状态，并始终附带一份可用的回退数据；页面据此决定是否显示提示。
- 默认使用 `createLocalStorage()`；测试可传入 `createMemoryStorage()`。
- 页面不直接操作键名。

## 6. 页面读写流程

### 6.1 游戏页

1. 同步读取 settings / appearance，使用结果型 API 区分缺失、损坏和不可用；缺失静默回退，损坏/不可用显示非阻塞提示。
2. 普通启动时调用 `probeScoreStorage()` 探测 IndexedDB；失败显示非阻塞提示，设置和棋盘仍可使用。重玩启动用 `getScoreById` 完成读取，不再额外探测。
3. `?retry=<id>`：异步 `getScoreById(id)`；加载期间显示棋盘占位和 loading。
   - 重玩使用成绩的 `size` / `gameMode` / `groupId` / `scramble`，`moveMode` 使用当前设置。
   - 重玩期间隐藏 ao5/ao12，在 TPS 下方、统计入口上方显示退出图标按钮和“重玩中”标签；退出会清理 `retry` 参数并按当前 settings 开始普通新局。
   - 找不到或读取失败：显示提示，清理 `retry` 参数，回到普通新局。
4. 普通局复原后用 `createSettlement` 构造 `ScoreRecord` + `ReplayRecord`，加入待保存队列，按顺序 `await addScoreWithReplay(score, replay)`。
   - 重玩结果不进入队列，不写入 IndexedDB。
5. 保存失败：保留失败项和后续待保存项，显示可重试的常驻提示；已成功写入的记录不回滚。
6. 保存过程中禁用刷新、`Space` 和参数切换，避免重复写入；失败后允许继续新局，队列仍保留。

### 6.2 成绩页

1. 解析 URL 的 `size / mode / group`；第一级是事件（阶数+模式），第二级是当前事件的 5 个分组。
2. `await listScoresByBucket(filter)`；只加载当前桶。
3. 用 core 的 `sortScores` / `assignNumbers` / `computeScoreStats` 计算展示数据。
4. 删除单条：`await removeScore(id)`，局部更新。
5. 清空当前分组：`await clearScoresByBucket(filter)`，先 `countScoresByBucket(filter)`。
6. 清空当前事件的所有分组：先 `countScoresByEvent(size, gameMode)`，确认后 `clearScoresByEvent(size, gameMode)`。
7. 清空全部：先 `countAllScores()`，确认后 `clearAllScores()`。
8. 分组改名：修改当前事件的 5 个名称，显式保存到 settings；成绩只引用槽位，不需要迁移。
9. 筛选快速切换时使用请求序号或取消标记，忽略过期结果，避免旧数据覆盖新筛选。

详细页面交互见 `docs/PUZZLE_SCORE_PAGE.md`。

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
- localStorage 设置/外观损坏时返回 `corrupt` 状态并回退可恢复值，页面显示非阻塞提示。
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
- 缺失键、损坏 JSON、存储不可用分别返回 `missing` / `corrupt` / `unavailable`。
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
- `by-event` 查询/计数覆盖当前事件的所有 5 个分组。
- 删除单条同时删除录像。
- 清空当前桶只删除目标桶。
- 清空当前事件只删除该事件的分组，其他事件保留。
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
- 清空当前分组后该桶为空，分组本身和其他组保留；清空当前事件后其他事件保留。
- 分组改名后刷新仍生效，成绩和录像不受影响。
- 设置和外观刷新后仍在（localStorage）；全站偏好刷新后仍在。
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

全站偏好不在该目录，位于 `src/shared/preferences/`，不依赖拼图 data 层；设置页路由见 `docs/SETTINGS_PAGE.md`。

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
- `docs/PUZZLE_SCORE_PAGE.md` 负责成绩页、分组管理和“事件 → 分组”筛选交互。
- `docs/PUZZLE_TASKS.md` 的 P6-1 / P6-2 / P6-5 按本文重写。
- `docs/REFACTOR_PLAN.md` 第 6 节数据策略、第 9 节待讨论同步更新。
- P7–P10 页面任务需要补充异步加载、loading、错误提示和请求竞态处理。
- P11 文档与最终验收需要覆盖 IndexedDB 持久化、隐私模式、配额错误和长录像。

## 11. 不做的事

- 不从旧版 localStorage 成绩/录像迁移。
- 不从已取消的 `puzzle.v2.scores` / `puzzle.v2.replay.*` 迁移。
- 不迁移旧的全局 10 分组设置；分组模型改为事件级后，开发环境清一次缓存即可。
- 不在 P6 做保留策略；当前先全量保存录像。
- 不做 localStorage 降级存储。
- 不做多标签页实时同步。
- 不在 P6 做二进制/压缩编码。
- 不在 P6 做成绩/录像导入导出；列入后续扩展。
- 不把 Settings / Appearance 放进 IndexedDB。
