# 数字华容道重构架构

> 状态：P0–P7 已实现；P8-0 设计确认（2026-10-21），P8-1 页面骨架、P8-2 输入/session/统计、P8-3 结算/保存/重玩与重玩状态栏已完成（2026-10-22～10-23）；分组模型改为事件级（2026-10-24 设计确认），P8-4a-0 分组模型与数据层、P8-4a 分组弹框已完成（2026-10-24），P8-4b 独立设置页与网站偏好已实现（2026-10-24，详见 `docs/SETTINGS_PAGE.md`，待手动验收），P8-4c-1 设置页主题列表已实现（待手动验收），P8-4c-2 设计确认（2026-10-24，详见 `docs/PUZZLE_THEME.md`），P8-4c-2a 主题模型升级与存储已实现（2026-10-24，自动检查通过），P8-4c-2b 设置页按阶数分配已实现（2026-10-25，自动检查通过，待手动验收），P8-4c-2c～e 待开始，P8-5～P8-6 待开始（P7-3 交互与视觉随 P8 手动验收）；回放、存储、设置页、游戏主题和成绩页的详细设计见独立文档
>
> 分支：`refactor/vite-ts`
>
> 范围：拼图模块（`puzzle-game`）；其他游戏不在本文范围，接入约定见 `docs/GAMES.md`
>
> 配套文档：`docs/PUZZLE_GAME_PAGE.md`、`docs/SETTINGS_PAGE.md`、`docs/PUZZLE_THEME.md`、`docs/PUZZLE_REPLAY.md`、`docs/PUZZLE_STORAGE.md`、`docs/PUZZLE_SCORE_PAGE.md`、`docs/PUZZLE_TASKS.md`、`docs/REFACTOR_PLAN.md`、`docs/PUZZLE_GAME.md`
>
> 注意：`docs/PUZZLE_GAME.md` 描述的是旧版行为和历史数据格式，仅作功能参考；回放细节以 `docs/PUZZLE_REPLAY.md` 为准，存储细节以 `docs/PUZZLE_STORAGE.md` 为准，本文保留架构级约束。

## 0. 决策摘要

- **旧数据不迁移、不兼容**。旧键只提供显式清理入口，新实现不读取旧成绩、旧配置和旧录像。
- **存储分层**：设置、外观和全站偏好继续用 localStorage；成绩列表和录像使用 IndexedDB（`puzzle.v2`），利用索引查询和原子事务。全站偏好使用 `site.v1.preferences`，详见 `docs/SETTINGS_PAGE.md` 和 `docs/PUZZLE_STORAGE.md`。
- **录像紧凑编码**：core / UI 使用 `ReplayRecord`，IndexedDB 中由 data 层编码为 `directions + timeDeltas`，读取时解码。
- **分组按事件划分**。事件 = 阶数 + 游戏模式，共 18 个；每个事件固定 5 个分组，`GroupId` 为 1–5，共 90 个。只允许修改名称，不新增、不删除；成绩桶由 `size + gameMode + groupId` 组成。分组管理见 `docs/PUZZLE_SCORE_PAGE.md`。
- **录像先全量保存**。每条成绩保留对应录像；容量评估和后续清理策略见 `docs/PUZZLE_STORAGE.md`。
- **纯逻辑优先**。`core` 不碰 DOM / localStorage / IndexedDB；`data` 负责持久化与校验；`ui` 只做 DOM；`pages` 负责组装。
- **成绩只存事实**。`tps`、`number`、`ao5`、`ao12`、时间格式化全部读时派生。
- **页面间不通过 localStorage 传状态**。回放、重玩使用 URL 参数 + score id。
- **外观统一到 `Theme`**：每个主题包含一种着色模式（降阶 / 按行 / 固定色）、逐块背景色/字体色、空白色、盲玩色、方块内边框和自带的字号、间隙、圆角；主题声明 `supportedSizes`，当前分配按阶数存 `themeIdBySize`；内置保留两套降阶预设，自定义主题上限 20；异常使用系统回退主题。P8-4c-2 在设置页按阶数分配，并在独立 `theme-editor.html` 编辑主题内容，详见 `docs/PUZZLE_THEME.md`。
- **设置页独立**：P8-4b 使用 `/puzzle-game/settings.html`，采用分类导航 + 草稿/保存条；不再使用游戏页模态框。详见 `docs/SETTINGS_PAGE.md`。
- **计时使用单调时钟 + 显式 session 状态机**；回放使用时间轴 + `requestAnimationFrame`，详见 `docs/PUZZLE_REPLAY.md`。
- **不引入 UI 框架、状态库、插件系统**。项目规模不大，边界清晰比抽象层数更重要。

## 1. 目标与非目标

### 目标

- 四个核心模块可独立测试、独立演进：`session`、`stats`、`replay`、`appearance`。
- 数据模型只保存事实，派生值只有一个计算入口。
- 页面可独立加载，状态可从 URL 恢复；刷新、后退、分享链接行为可预期。
- 旧代码只作为行为参考，不复制旧实现中的历史 workaround。
- 外观支持降阶、按行、固定色三种着色模式；每个主题独立保存逐块背景色/字体色、整盘空白色/盲玩色/内边框和尺寸比例，并按阶数分配使用。
- 保持运行时轻量：无框架，图表按需加载，不依赖运行时 CDN。

### 非目标

- 不迁移旧 `scores` / `config` / `currentScore` / `currentScoreList`。
- 不做旧页面双写或旧数据兼容层。
- 不做分组新增/删除/排序；每个事件固定 5 个槽位，仅支持改名。
- 其他游戏不在本文范围，接入约定见 `docs/GAMES.md`。
- 不做后端、账号、云同步。
- 不做通用插件系统或通用指标注册表。
- 不为了“看起来工程化”引入额外依赖。

## 2. 核心原则

1. **单向依赖**
   - `core` 只依赖 `types.ts` 和其他 core 模块。
   - `data` 依赖 `core` 与 `types`，不碰 DOM。
   - `ui` 依赖 `core` 的类型和纯函数，不碰持久化。
   - `pages` 负责组合 `core` / `data` / `ui`。
2. **事实与派生分离**
   - 存储中只保存无法重新计算的事实。
   - 平均、TPS、序号、ao、格式化结果都不落库。
3. **不可变**
   - core 函数返回新对象/新数组，不修改入参。
4. **显式状态**
   - session、播放器都用明确的状态机，不用零散全局布尔值。
5. **单一来源**
   - 桶筛选、排序、编号、ao 规则各只有一个实现。
6. **URL 是导航状态**
   - 统计筛选、选中的成绩、回放目标都可通过 URL 恢复。
7. **小模块**
   - 一个文件只解决一个明确问题；外观按 layers / theme / metrics / presets 拆分。
8. **可测试**
   - core 不依赖浏览器 API；时间、随机源、存储都通过参数注入。

## 3. 领域词汇

| 术语              | 含义                                                                |
| ----------------- | ------------------------------------------------------------------- |
| `PuzzleSize`      | 棋盘阶数，2–10                                                      |
| `Board`           | 行优先展开的一维数组，`0` 是空白块                                  |
| `GameMode`        | `normal` 普通模式 / `blind` 盲玩模式                                |
| `MoveMode`        | `click` 点击 / `slide` 滑动 / `keyboard` 键盘                       |
| `Direction`       | 方块移动方向，不是空白块移动方向                                    |
| `Session`         | 从创建打乱到复原的一局游戏                                          |
| `ScoreRecord`     | 已保存的一局成绩，只含事实字段                                      |
| `ReplayRecord`    | 与某条成绩对应的移动序列                                            |
| `Event`           | `size + gameMode` 组成的事件；共 18 个，每个事件有 5 个固定分组     |
| `Bucket`          | `size + gameMode + groupId` 组成的一个成绩桶，即“事件 + 分组”       |
| `GroupId`         | 事件内的固定分组槽位 1–5；成绩、筛选和 URL 使用编号，不随名称变化   |
| `Group`           | 某个事件下的固定分组，共 90 个；只允许修改名称                      |
| `ColorMode`       | 主题的着色模式：降阶、按行或固定色，包含逐块背景色/字体色和空白色  |
| `Theme`           | 统一外观入口：名称 + 支持阶数 + `ColorMode` + 内边框 + 盲玩色 + metrics，内置主题不可修改 |
| `BoardMetrics`    | 某个主题自带的字号、间隙、圆角比例，用户可调整                      |
| `ThemeInnerBorder` | 方块内边框：整盘统一的颜色与宽度，不改变方块外尺寸                 |
| `AppearanceState` | 按阶数分配 `themeIdBySize` + 主题列表；尺寸比例保存在各自主题中     |
| `FALLBACK_THEME`  | 系统回退主题：不进主题列表、不可选择、不持久化，用于异常和新建草稿 |

## 4. 数据模型

```ts
export type PuzzleSize = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type GameMode = 'normal' | 'blind';
export type MoveMode = 'click' | 'slide' | 'keyboard';
export type Direction = 'U' | 'D' | 'L' | 'R';
export type Board = readonly number[];

export interface MoveRecord {
  direction: Direction;
  /** 相对本局创建时刻的毫秒数，必须 >= 0 且单调不减。 */
  timeMs: number;
}

/** 事件内固定分组槽位：1–5；分组数量固定，不新增、不删除。 */
export type GroupId = 1 | 2 | 3 | 4 | 5;

/**
 * 某个事件（阶数 + 游戏模式）下的固定分组。
 * 分组身份由 size + gameMode + id 共同确定；改名不改变身份。
 */
export interface Group {
  readonly size: PuzzleSize;
  readonly gameMode: GameMode;
  /** 事件内槽位 1–5；改名不改变 ID。 */
  readonly id: GroupId;
  /** 用户可见名称；允许重名，trim 后不能为空，最长 30 字符。 */
  readonly name: string;
}

export interface GameSettings {
  size: PuzzleSize;
  gameMode: GameMode;
  moveMode: MoveMode;
  /** 当前选中的分组槽位 1–5，跨事件共享。 */
  groupId: GroupId;
  /** 固定 90 个分组：18 个事件 × 5 个槽位；只允许修改 name。 */
  groups: readonly Group[];
  customCursor: boolean;
  minimalUi: boolean;
}

export interface ScoreRecord {
  id: string;
  size: PuzzleSize;
  gameMode: GameMode;
  moveMode: MoveMode;
  /** 本局所属的事件内分组槽位 1–5；事件由 size + gameMode 确定。 */
  groupId: GroupId;
  /** normal 不含观察时间；blind 含观察时间。单位 ms。 */
  durationMs: number;
  /** 第一次有效移动前的时间；没有移动时不会产生成绩。单位 ms。 */
  observeMs: number;
  /**
   * 摘要字段：步数。可由 replay.moves.length 得到，
   * 但统计页不应加载整条录像，因此保留并校验一致性。
   */
  moveCount: number;
  scramble: Board;
  /** 完成时刻，epoch ms。开局时刻由 finishedAt - durationMs 派生。 */
  finishedAt: number;
}

export interface ReplayRecord {
  scoreId: string;
  moves: readonly MoveRecord[];
}

/** 着色模式对象共有的字段。 */
interface ColorModeFields {
  /**
   * 方块背景色。长度由 mode 决定：
   * - layer：18，索引 0–17 对应层 1–18；
   * - row：10，索引 0–9 对应数字块原本所属的第 1–10 行；
   * - fixed：99，索引 0–98 对应数字 1–99。
   */
  palette: readonly string[];

  /**
   * 方块字体色。与 palette 等长，索引一一对应。
   * 每项为 'auto' 或 '#rrggbb'；'auto' 根据该块背景自动选黑/白。
   */
  fontPalette: readonly string[];

  /** 空白格背景色；整盘统一。默认 transparent。 */
  blankColor: string;
}

/** 降阶：现有 L 形分层，颜色绑定数字块。 */
export interface LayerColorMode extends ColorModeFields {
  mode: 'layer';
}

/** 按行：按数字块原本所属行着色，颜色跟随数字块。 */
export interface RowColorMode extends ColorModeFields {
  mode: 'row';
}

/** 固定色：每个数字单独着色，与阶数和位置无关。 */
export interface FixedColorMode extends ColorModeFields {
  mode: 'fixed';
}

export type ColorMode = LayerColorMode | RowColorMode | FixedColorMode;

/** 某个主题自带的尺寸比例；用户可调整。 */
export interface BoardMetrics {
  /** 字号 = 边框内边长 × fontSizeRatio，范围 0–1。 */
  fontSizeRatio: number;
  /** 间隙 = 实际格子边长 × gapRatio，范围 0–0.1。 */
  gapRatio: number;
  /** 圆角 = 实际格子边长 × radiusRatio，范围 0–0.5。 */
  radiusRatio: number;
}

/** 方块内边框；整盘统一，不改变方块外尺寸。 */
export interface ThemeInnerBorder {
  /** 'transparent' 或 '#rrggbb'。 */
  color: string;
  /** 单边宽度 = 格子边长 × widthRatio；0–0.1，0 表示无边框。 */
  widthRatio: number;
}

/** 统一外观入口：颜色、边框、盲玩色和尺寸比例都属于主题。 */
export interface Theme {
  id: string;
  name: string;
  builtin: boolean;
  /** 主题设计上支持的阶数；非空、升序、去重，默认全部 2–10。 */
  supportedSizes: readonly PuzzleSize[];
  color: ColorMode;
  /** 方块内边框；整盘统一。 */
  innerBorder: ThemeInnerBorder;
  /**
   * 盲玩隐藏数字时，所有非空方块的背景色。
   * 必须为 #rrggbb；默认 #3498db，用户可在自定义主题里调整。
   */
  blindTileColor: string;
  metrics: BoardMetrics;
}

/** 外观状态：每个阶数一个主题 ID + 主题列表。 */
export interface AppearanceState {
  /** 9 个键必须齐全；异常时允许指向 FALLBACK_THEME_ID。 */
  themeIdBySize: Readonly<Record<PuzzleSize, string>>;
  themes: readonly Theme[];
}
```

`ReplayRecord` 是 core / UI 的运行时类型。IndexedDB 中不直接存这个对象，而是由 data 层编码为 `StoredReplayV2`（`directions` + `timeDeltas`），读取时再解码。存储格式见 `docs/PUZZLE_STORAGE.md`，回放语义见 `docs/PUZZLE_REPLAY.md`。

### 4.1 不变量

- `Board` 必须是 `0..size²-1` 的完整排列，长度等于 `size²`。
- `MoveRecord.timeMs` 非负、有限，按数组顺序单调不减。
- `ScoreRecord.durationMs >= 0`（同一毫秒完成时可以为 0），`observeMs >= 0`，`finishedAt` 是有效 epoch 毫秒；持久化时移动时间和时长保留 3 位小数。
- 开局时刻不落库：`startedAt = finishedAt - durationMs`，由 `getScoreStartedAt(score)` 统一派生。
- 曼哈顿距离不落库：由 `scramble` + `size` 用 `manhattanDistance()` 派生。
- `ScoreRecord.moveCount === ReplayRecord.moves.length`；回放数据不完整时标记为损坏，不猜测补齐。
- `GameSettings.groups` 固定包含 90 项：9 种阶数 × 2 种游戏模式 × 5 个槽位；按 `size` 升序、`gameMode` 普通在前、`id` 1–5 排列。不允许新增、删除、排序或修改事件/槽位。
- `Group.name` 允许重名；`trim()` 后不能为空，长度不超过 30；非法/损坏名称显示时回退为 `分组{id}`。
- `ScoreRecord.groupId`、`GameSettings.groupId`、`ScoreFilter.groupId` 必须是 1–5 的整数。分组身份由 `size + gameMode + groupId` 共同确定；分组固定存在，因此不需要处理“分组被删除”的引用失效。
- 分组只允许改名，不允许改变所属事件或槽位；改名不影响已保存成绩。
- `ScoreRecord.id` 全局唯一；新成绩用 `crypto.randomUUID()`，无该 API 时使用带随机后缀的回退实现。
- `Theme.color.palette` / `fontPalette` 长度由 mode 决定：layer 18、row 10、fixed 99；`palette` 颜色统一为 `#rrggbb`，`fontPalette` 每项为 `auto` 或 `#rrggbb`，`blankColor` 允许 `transparent` 或 `#rrggbb`。
- `Theme.innerBorder.color` 允许 `transparent` 或 `#rrggbb`；`widthRatio` 为 0–0.1；默认 `{ transparent, 0 }`。内边框不改变方块外尺寸，字号按“格子边长 − 2 × 内边框宽度”计算。
- `Theme.supportedSizes` 非空、升序、去重，每项为 2–10；默认全部。
- `Theme.blindTileColor` 必须是 `#rrggbb`；默认 `#3498db`，只用于盲玩隐藏数字时的非空方块，空白块仍使用 `blankColor`。
- `Theme.metrics` 必须在约定范围内；非法值回退 `DEFAULT_METRICS`。
- `AppearanceState.themeIdBySize` 必须有 2–10 共 9 个键；每个值要么是 `FALLBACK_THEME_ID`，要么能解析到 `themes` 中一个 `supportedSizes` 包含该阶数的主题。
- `AppearanceState.themes` 至少包含两套内置主题；回退主题不在 `themes` 中。
- 内置主题不可修改、不可删除；自定义主题可以编辑逐块颜色/字体色、空白色、盲玩色、内边框和 metrics，上限 20 个（`CUSTOM_THEME_SLOT_COUNT = 20`）。
- **不存储** `tps`、`number`、`ao5`、`ao12`、`dateTime` 字符串、`device`。

## 5. 存储

> 详细设计、DB schema、repository API 与错误处理见 `docs/PUZZLE_STORAGE.md`。本节只保留架构级约束。

### 5.1 存储分层

| 数据 | 存储 | 位置 |
| --- | --- | --- |
| 游戏设置 | localStorage | `puzzle.v2.settings`，`{ version: 3, data: GameSettings }` |
| 外观主题 | localStorage | `puzzle.v2.appearance`，`{ version: 4, data: AppearanceState }` |
| 全站偏好 | localStorage | `site.v1.preferences`，`{ version: 1, data: SitePreferences }` |
| 成绩摘要 | IndexedDB | DB `puzzle.v2` → store `scores`，主键 `id` |
| 录像 | IndexedDB | DB `puzzle.v2` → store `replays`，主键 `scoreId` |

IndexedDB 索引：

- `scores.by-bucket: [size, gameMode, groupId]`：统计页只加载目标桶。
- `scores.by-event: [size, gameMode]`：按事件统计和清空该事件的所有分组。
- 不再使用全局 `by-group: groupId`；分组属于事件，跨所有阶数/模式按 `groupId` 清空没有意义。

不再使用 `puzzle.v2.meta`；localStorage envelope 自带 `version`，IndexedDB 使用 `DB_VERSION = 2`。之前计划中的 `puzzle.v2.scores`、`puzzle.v2.replay.<scoreId>` 也已取消（v2 未上线，不做迁移）。

### 5.2 读写规则

- 拼图设置、外观：同步读写；设置缺失/损坏回退默认值，外观缺失回退默认彩虹、损坏时尽量恢复且无法解析的阶数回退系统回退主题、不可用/版本不兼容整体回退系统回退主题；写入失败显示非阻塞提示。
- 全站偏好：由设置页独立读写，不参与游戏页 settings/appearance 的启动加载；缺失、损坏或不可用的处理见 `docs/SETTINGS_PAGE.md`。
- 成绩、录像：异步 repository；新增、删除、按桶/按事件清空都在**同一个 IndexedDB 事务**中完成，不再需要写入顺序和回滚逻辑。
- 统计页只调用 `listScoresByBucket(filter)`，不加载录像；回放页只加载一条成绩和一条录像。
- 所有读取都经过 schema 校验；非法成绩跳过，非法/缺失录像返回 `null`，不让整页崩溃。
- 写入失败（配额不足、IndexedDB 不可用、blocked）返回明确的 `DataStoreError`；游戏页保留待保存队列，并通过提示上的“重试保存”再次写入，已成功写入的数据不受影响。
- 不做多标签页实时同步；IndexedDB 事务本身安全，页面刷新后可见其他标签页的修改。

### 5.3 录像编码

core / UI 使用 `ReplayRecord { scoreId, moves }`；IndexedDB 中由 data 层编码为 `StoredReplayV2`：

```ts
interface StoredReplayV2 {
  scoreId: string;
  directions: string;      // 每字符一步：U/D/L/R
  timeDeltas: readonly number[]; // 与 directions 等长，非负增量，保留 3 位小数
}
```

- 解码后恢复为 `MoveRecord[]`，时间由增量累加得到并保持 3 位小数精度。
- 步数上限 `MAX_REPLAY_MOVES = 100_000`。
- 不存储每一帧的棋盘；回放时间轴由 scramble + moves 派生。

### 5.4 旧数据

旧键 `config`、`scores`、`currentScore`、`currentScoreList` **不再读取**。

`data/legacy.ts` 提供：

```ts
hasLegacyData(): boolean;
clearLegacyData(): void;
```

- 不自动删除；未来的设置页“维护”分类或开发时手动调用。
- GitHub Pages 与 Netlify 是不同 origin，需要分别在对应域名下清理。
- v2 尚未上线，不存在从旧 v2 localStorage 键迁移到 IndexedDB 的逻辑。

### 5.5 存储选型

- 设置、外观和全站偏好继续使用同步 `localStorage`：数据小、启动即用；全站偏好由设置页独立读写。
- 成绩、录像使用 IndexedDB：配额更大、支持索引查询和跨 store 原子事务。
- IndexedDB 通过 `idb` 轻量封装；单元测试使用 `fake-indexeddb`。
- 页面只依赖 repository 接口，不直接操作 localStorage / IndexedDB。
- 当前不做 localStorage 降级存储，避免两套数据源和迁移问题。

## 6. 派生值

### 6.1 TPS

```ts
tps = durationMs > 0 ? moveCount / (durationMs / 1000) : 0;
```

- `durationMs` 是成绩的有效时间，normal 不含观察，blind 含观察。
- 存储原始数字，显示时保留两位小数。

### 6.2 排序与编号

- 桶内排序：`finishedAt` 升序；相同则按 `id` 升序，保证稳定。
- `number` 从 1 开始，等于排序后的下标 + 1。
- `number` 不落库；删除成绩后自动重排。

### 6.3 桶

```ts
bucketKey = `${size}:${gameMode}:${groupId}`;
```

- `moveMode` 不参与桶。
- `groupId` 是事件内槽位 1–5，不是名称；事件由 `size + gameMode` 确定，改名不影响桶键和历史成绩。
- 统计页筛选条件与桶一致；清空当前分组即清空当前桶。

### 6.4 平均

- 所有“平均”使用**算术平均**。
- 空桶返回 `null`；不要用 `0` 冒充缺失值。
- `ao5` / `ao12` 使用去尾平均：排序后去掉一个最小值和一个最大值，对中间 `n-2` 个求平均。

### 6.5 ao5 / ao12

```ts
const SESSION_GAP_MS = 5 * 60 * 1000;
```

对下标 `index` 计算 `aoN`：

1. 需要 `index >= N - 1`，否则返回 `null`。
2. 取窗口 `[index - N + 1, index]`。
3. 对窗口中相邻两条成绩，计算：
   ```ts
   nextStartedAt = next.finishedAt - next.durationMs;
   gap = nextStartedAt - previous.finishedAt;
   ```
   如果 `gap` 非有限，或 `Math.abs(gap) > SESSION_GAP_MS`，整个窗口无效，返回 `null`。
4. 对窗口内 `durationMs` 排序，去掉最小和最大，返回中间值的平均。
5. `bestAo5` / `bestAo12` 取所有有效值中的最小值；没有有效值返回 `null`。

### 6.6 高亮

- 时间、步数、ao：最小值标“最好”，最大值标“最差”。
- TPS：最大值标“最好”，最小值标“最差”。
- 并列时所有并列项都标记。
- `null` / 无效值不参与比较，也不高亮。

### 6.7 时间格式

- 内部只使用整数毫秒。
- UI 统一通过 `formatDuration(ms)` 输出：
  - `< 60s`：`12.34`
  - `>= 60s`：`1:02.34`
- 不在存储中保存格式化后的时间字符串。

## 7. Session

### 7.1 状态

```text
create → observing → running → solved
```

| 状态        | 含义                                                                      |
| ----------- | ------------------------------------------------------------------------- |
| `observing` | 已创建，尚无有效移动；normal 计时显示 0；blind 数字可见                   |
| `running`   | 已有至少一次有效移动；normal 从第一次移动计时；blind 从创建计时并隐藏数字 |
| `solved`    | 已复原；棋盘锁定；允许切换参数、选择下一局分组或新开一局                |

- 无效移动不改变状态。
- `solved` 后拒绝继续移动，不再产生新成绩。

### 7.2 类型

```ts
export type SessionPhase = 'observing' | 'running' | 'solved';

export interface SessionConfig {
  size: PuzzleSize;
  gameMode: GameMode;
  moveMode: MoveMode;
  groupId: GroupId;
  scramble: Board;
  isRetry: boolean;
  retryOf?: string;
  createdAtEpochMs: number;
}

export interface SessionState {
  config: SessionConfig;
  board: Board;
  moves: readonly MoveRecord[];
  phase: SessionPhase;
  createdAtMs: number;
  firstMoveAtMs: number | null;
  solvedAtMs: number | null;
}

export interface SessionView {
  phase: SessionPhase;
  elapsedMs: number;
  observeMs: number;
  tps: number;
  hideNumbers: boolean;
}

export interface SessionResult {
  size: PuzzleSize;
  gameMode: GameMode;
  moveMode: MoveMode;
  groupId: GroupId;
  durationMs: number;
  observeMs: number;
  moveCount: number;
  scramble: Board;
  moves: readonly MoveRecord[];
  manhattanDistance: number;
  startedAt: number;
  finishedAt: number;
  isRetry: boolean;
  retryOf?: string;
}
```

`SessionResult` 是瞬时结果，可以包含 `startedAt`、`manhattanDistance` 等派生便利字段；写入 `ScoreRecord` 时只保留事实字段，派生字段不落库。

### 7.3 API

```ts
createSession(config: SessionConfig, createdAtMs: number): SessionState;
moveByDirection(state: SessionState, direction: Direction, atMs: number): SessionState;
moveByTile(state: SessionState, tileIndex: number, atMs: number): SessionState;
getSessionView(state: SessionState, nowMs: number): SessionView;
getSessionResult(state: SessionState): SessionResult | null;
```

### 7.4 计时语义

- `normal`
  - 第一次有效移动前：`elapsedMs = 0`。
  - 第一次有效移动后：`elapsedMs = min(nowMs, solvedAtMs) - firstMoveAtMs`。
  - 第一次移动前 `observeMs` 返回当前观察时长；之后固定为 `firstMoveAtMs - createdAtMs`。
- `blind`
  - `elapsedMs = min(nowMs, solvedAtMs) - createdAtMs`，包含观察时间。
  - 第一次移动前 `observeMs` 返回当前观察时长；之后固定为 `firstMoveAtMs - createdAtMs`。
- 所有时间差最小为 0；`nowMs` 早于 `createdAtMs` 或传入非法值时按 0 处理，不回写状态。
- `tps` 使用当前 `elapsedMs` 计算。
- 页面用 `performance.now()` 作为 `createdAtMs` / `atMs` / `nowMs`；`createdAtEpochMs` 只在创建时取一次 `Date.now()`。
- 不做暂停。页面切到后台时 rAF 停止，但墙钟继续；回到前台后 `getSessionView` 自动追上。
- 设置页是独立页面；`observing` / `solved` 可进入，运行中/重玩中/保存中禁用，避免卸载当前局。P8-4c-2 在设置页按阶数分配主题，并在独立 `theme-editor.html` 编辑主题内容；不再有“打开设置面板”的模态流程。左栏参数切换允许，但会放弃当前局并重新开局。该策略由 UI 执行，core 不处理。

### 7.5 移动

- `moveByDirection`：一次单块移动，用于键盘模式。
- `moveByTile`：调用 `planLineMove`，一次点击/滑动可能产生多步。
  - 多步共享同一个 `timeMs`。
  - 按顺序写入 `moves`，`moveCount` 等于步数。
  - 没有可移动步骤时返回原 state。
- 第一次有效移动同时设置 `firstMoveAtMs` 并把阶段切到 `running`。
- 每次移动后检查 `isSolved`；满足时设置 `solvedAtMs`，阶段切到 `solved`。

### 7.6 结算

- `getSessionResult` 只在 `solved` 时返回结果，否则返回 `null`。
- `durationMs`：normal 为 `solvedAtMs - firstMoveAtMs`；blind 为 `solvedAtMs - createdAtMs`。
- `startedAt`：normal 为 `createdAtEpochMs + (firstMoveAtMs - createdAtMs)`；blind 为 `createdAtEpochMs`。
- `finishedAt = createdAtEpochMs + (solvedAtMs - createdAtMs)`。
- `createdAtMs`、`firstMoveAtMs`、`solvedAtMs` 都是单调时钟值；映射到 epoch 时必须先减去 `createdAtMs`，不能把 `performance.now()` 的起始值直接加到 `createdAtEpochMs` 上。
- `moveCount = moves.length`。
- `manhattanDistance` 由初始 `scramble` 计算，不随移动变化。
- `isRetry` 结果不写入成绩；core 只标记，页面用 `createSettlement` 拒绝并为普通结果生成可保存的成绩/录像对。

## 8. Stats

### 8.1 筛选与编号

```ts
interface ScoreFilter {
  size: PuzzleSize;
  gameMode: GameMode;
  groupId: GroupId;
}

filterScoresByBucket(scores, filter): ScoreRecord[];
assignNumbers(scores): Array<{ score: ScoreRecord; number: number }>;
```

- 先过滤，再排序，再编号。
- `filter` 使用固定编号 `GroupId`；显示名称由 settings 中的 groups 解析，筛选和存储都不使用名称。
- 统计页、详细页、删除操作都使用同一套排序/编号规则。
- 数据层通过 IndexedDB 的 `by-bucket` 索引只加载目标桶；`filterScoresByBucket` 仍用于内存数据和测试。

### 8.2 聚合

```ts
interface ScoreStats {
  count: number;
  bestTimeMs: number | null;
  averageTimeMs: number | null;
  bestStep: number | null;
  averageStep: number | null;
  bestTps: number | null;
  averageTps: number | null;
  bestAo5Ms: number | null;
  bestAo12Ms: number | null;
  averageObserveMs: number | null;
}

computeScoreStats(scores): ScoreStats;
```

- 平均使用算术平均。
- 空桶返回全 `null`（`count` 为 0）。
- TPS 按每条成绩的 `moveCount / durationMs` 计算，再求平均。
- TPS 为 0（`durationMs <= 0`）或非有限值时不参与平均和最佳值；没有有效 TPS 时返回 `null`。
- `bestAo5` / `bestAo12` 在 `computeScoreStats` 内部先按完成时间排序，不要求调用方预先排序。

### 8.3 ao

```ts
computeAoAt(scores, index, windowSize): number | null;
computeBestAo(scores, windowSize): number | null;
```

- 规则见 6.5。
- 成绩必须先按 6.2 排序。

### 8.4 高亮

```ts
interface ScoreHighlight {
  scoreId: string;
  bestTime: boolean;
  worstTime: boolean;
  bestStep: boolean;
  worstStep: boolean;
  bestTps: boolean;
  worstTps: boolean;
  bestAo5: boolean;
  worstAo5: boolean;
  bestAo12: boolean;
  worstAo12: boolean;
}

computeScoreHighlights(scores): ScoreHighlight[];
```

### 8.5 图表数据

```ts
interface ChartSeries {
  labels: readonly number[];
  timeSeconds: readonly number[];
  steps: readonly number[];
}

buildChartSeries(scores): ChartSeries;
```

- `labels` 使用派生 `number`。
- 图表渲染层按需加载 ECharts；core 不引用图表库。
- 0 或 1 条成绩时由 UI 决定隐藏图表；`buildChartSeries` 仍返回空/单点数据。

### 8.6 页面状态

- 统计筛选放 URL：`?size=4&mode=normal&group=1`；事件由 `size + mode` 确定。
- `group` 使用事件内槽位 1–5；页面显示对应 `Group.name`，改名不影响已分享链接。
- 成绩页筛选采用“事件 → 分组”二级下拉，具体交互见 `docs/PUZZLE_SCORE_PAGE.md`。
- 选中成绩放 URL：`&score=<id>`，详情用原生 `<dialog>`。
- 筛选变化使用 `history.pushState`；浏览器前进/后退可恢复。
- 筛选切换会异步查询 IndexedDB；页面需忽略过期请求，避免旧结果覆盖新筛选。
- 不再写 `currentScoreList`，不再通过 `config` 保存统计筛选。

## 9. Replay

> 详细设计、取帧规则、播放器边界和长录像测试见 `docs/PUZZLE_REPLAY.md`。

### 9.1 时间轴

```ts
interface ReplayFrame {
  board: Board;
  step: number;
  /** 播放时间轴毫秒，从 0 开始单调不减。 */
  timeMs: number;
}

interface ReplayIssue {
  code: 'invalid-board' | 'move-count-mismatch' | 'invalid-move' | 'non-monotonic-time';
  message: string;
  step?: number;
}

interface ReplayTimeline {
  scoreId: string;
  frames: readonly ReplayFrame[];
  durationMs: number;
  issues: readonly ReplayIssue[];
}

buildReplayTimeline(score: ScoreRecord, replay: ReplayRecord): ReplayTimeline;
getFrameIndexAt(timeline: ReplayTimeline, positionMs: number): number;
getFrameAt(timeline: ReplayTimeline, positionMs: number): ReplayFrame | null;
```

构建规则：

1. 第 0 帧是 `score.scramble`，`step = 0`，`timeMs = 0`。
2. 逐步应用 `replay.moves`，每一步生成一帧。
3. `normal` 的播放时间：`max(0, move.timeMs - score.observeMs)`。
4. `blind` 的播放时间：`move.timeMs`（包含观察时间）。
5. 时间必须单调不减；非法时间 clamp 到上一帧时间并记录 `non-monotonic-time`。
6. `moveCount` 与 moves 长度不一致时记录 `move-count-mismatch`，但仍用实际 moves 构建；方向非法或当前盘面无法执行时记录 `invalid-move`，保留已构建帧并停止。
7. 初始盘面/阶数非法时记录 `invalid-board`，返回空时间轴（`frames: []`、`durationMs: 0`），不抛异常。
8. `durationMs` 以 `score.durationMs` 为准，并保证不小于最后一帧时间。
9. `getFrameIndexAt` / `getFrameAt` 用二分查找；空时间轴返回 `-1` / `null`，位置在首帧前返回首帧，在末帧后返回末帧。`positionMs = 0` 显示打乱帧。

### 9.2 播放器

```ts
interface PlaybackState {
  positionMs: number;
  playing: boolean;
  speed: number;
  anchorPositionMs: number;
  anchorNowMs: number;
}

const PLAYBACK_SPEEDS = [0.125, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 5, 10];

createPlayback(timeline): PlaybackState;
play(state, timeline, nowMs): PlaybackState;
pause(state, timeline, nowMs): PlaybackState;
seekToFrame(state, timeline, index, nowMs): PlaybackState;
stepBy(state, timeline, delta, nowMs): PlaybackState;
setSpeed(state, timeline, speed, nowMs): PlaybackState;
updatePlayback(state, timeline, nowMs): {
  state: PlaybackState;
  frame: ReplayFrame | null;
  finished: boolean;
};
```

- 播放位置用 `positionMs`，不是 `setInterval` 逐帧推进。
- 倍速变化时先结算当前位置、重设锚点，再应用新速度；不能让时间轴整体跳变。
- 播放到 `durationMs` 自动停止，停在最后一帧；再次 `play` 从头开始。
- 上一步/下一步按帧索引移动，边界 clamp；UI 在边界禁用按钮。
- `seekToFrame` / `stepBy` 会暂停播放。
- UI 用 `requestAnimationFrame` 调用 `updatePlayback`；暂停/结束/页面隐藏时停止循环。
- 空时间轴 `frame = null`、`finished = true`，页面显示空状态。

### 9.3 存储编码

IndexedDB 中由 data 层存为 `StoredReplayV2 { scoreId, directions, timeDeltas }`，读取时解码为 `ReplayRecord`。core 不感知存储编码。详见 `docs/PUZZLE_STORAGE.md`。

### 9.4 URL 与重玩

- 回放：`replay.html?score=<id>`。
- 重玩：`puzzle.html?retry=<id>`。
- 重玩读取成绩的 `size`、`gameMode`、`groupId`、`scramble`；`moveMode` 使用当前设置；结果不保存。
- 重玩加载期间显示 loading；阶数/游戏模式锁定，切换操作模式或刷新/`Space` 都保留同一打乱。
- 重玩时隐藏 ao5/ao12，在 TPS 下方、统计入口上方显示退出图标按钮和“重玩中”标签；退出会清理 `retry` 参数并按当前 settings 开始普通新局。
- 重玩读取失败时清理 `retry` 参数，提示后回退普通新局。
- 回放按成绩的阶数使用当前主题分配（`getThemeForSize`）；如果以后需要“忠实回放当时主题”，在成绩中增加 `themeId` 即可，不影响当前结构。

## 10. Appearance

### 10.1 层算法

保留旧版 L 形分层，不做同心环：

```ts
function getTileLayer(tile: number, size: PuzzleSize): number {
  if (tile <= 0 || tile >= size * size) return 0; // 0 表示空白/非法
  const index = tile - 1;
  const row = Math.floor(index / size);
  const col = index % size;
  return col >= row ? 2 * row + 1 : 2 * (col + 1);
}
```

- 最大层数：`2 * size - 2`；2×2 为 2 层，10×10 为 18 层。
- 降阶模式的 `palette` 固定 18 色；当前阶数只使用前 `2*size-2` 层。
- 颜色绑定的是方块数字，不是方块当前位置；打乱后颜色跟随数字块移动。
- `tile === 0` 使用 `theme.color.blankColor`；默认 `transparent`，让棋盘背景透出，不强行改成旧版的 `#f0f0f0`。

### 10.2 Theme / ColorMode / BoardMetrics

- `Theme` 是统一外观入口：
  - `supportedSizes`：主题设计上支持的阶数，默认全部 2–10；
  - `color: ColorMode`：着色模式、逐块背景色 `palette`、逐块字体色 `fontPalette`、空白色；
  - `innerBorder`：方块内边框，整盘统一；
  - `blindTileColor`：盲玩隐藏数字时的非空方块背景色；
  - `metrics: BoardMetrics`：字号、间隙、圆角，按主题保存。
- 一个主题只对应一种着色模式，不做“一个主题支持多种模式”；切换模式就是切换主题。
- 内置主题先保留两套降阶预设：
  - `rainbow`：旧“预设1 / 彩虹”，高饱和，metrics 为 `0.5 / 0.03 / 0.04`。
  - `rainbow-soft`：旧“预设2 / 彩虹微调”，低饱和，metrics 为 `0.5 / 0 / 0.01`。
- 按行、固定色当前只作为自定义主题可选的模式，不提供内置预设。
- 两套内置主题的 `fontPalette` 都是 18 个 `#ffffff`，沿用旧版白色；回退主题和新建主题默认 18 个 `'auto'`，根据背景亮度自动选择黑/白。
- `blankColor` 默认 `transparent`，让棋盘背景透出。
- `innerBorder` 默认 `{ transparent, 0 }`；内边框不改变方块外尺寸，字号按边框内区域计算。
- `blindTileColor` 默认 `#3498db`，属于 `Theme`，用户可在自定义主题里调整；空白块不参与这个颜色。
- 内置主题不可修改、不可删除；用户要调整颜色、字体色、边框或 metrics 时，复制为自定义主题再编辑。
- 回退主题 `FALLBACK_THEME` 是系统常量，不在 `BUILTIN_THEMES`，不可选择、不持久化；用于异常阶数和新主题初始 draft。
- 修改主题时深拷贝，禁止原地修改常量。

### 10.3 取色与渲染

- `getTileVisual(tile, size, theme)` 统一返回 `{ background, color }`：
  - 降阶：`getTileLayer(tile, size) - 1` 取 `palette` / `fontPalette`；
  - 按行：`Math.floor((tile - 1) / size)` 取 `palette` / `fontPalette`，颜色跟随数字块原本所属行；
  - 固定色：`tile - 1` 取 `palette` / `fontPalette`，数字与颜色永久绑定；
  - 空白块使用 `theme.color.blankColor`，字体色为 `transparent`。
- `fontPalette[index] === 'auto'` 时由该块背景亮度自动选择黑/白；否则使用配置的 `#rrggbb`。
- `ui/board-view.ts` 给每个 tile 设置 `--tile-bg` / `--tile-fg`；CSS 使用这两个变量，不关心当前是哪种模式。
- `core/appearance/metrics.ts` 的 `toCssVariables(theme)` 从 `theme.metrics`、`color.blankColor`、`innerBorder` 和 `blindTileColor` 生成 `--tile-font-ratio`、`--tile-gap-ratio`、`--tile-radius-ratio`、`--blank-color`、`--blind-tile-bg`、`--tile-inner-border-color`、`--tile-inner-border-width-ratio`；页面通过 CSS 变量渲染，不逐项写死样式。
- 内边框用 `inset box-shadow` 绘制；`.puzzle-board__tile` 用 `padding: var(--tile-inner-border-width)` 把文字限制在边框内，字号使用 `calc(var(--tile-inner-size) * var(--tile-font-ratio))`。边框宽度 0 时退化为原字号公式。
- 盲玩隐藏数字时，非空方块统一使用 `--blind-tile-bg`；空白块保持 `--blank-color`。
- 棋盘用 `container-type: inline-size`，内层 grid 用 `cqw` 计算 `--cell-size`，不依赖 `ResizeObserver`。
- `ui/board-view.ts` 只渲染；点击、鼠标经过和触摸路径由 `ui/board-input.ts` 采集后交给页面。
- 换主题或修改 metrics 只更新 CSS 变量和 tile 颜色，不重建 tile。
- 游戏页按当前阶数调用 `getThemeForSize(appearance, size)`；不再启动时固定一个主题。
- 颜色选择器使用原生 `<input type="color">`，不引入 jscolor。

### 10.4 设置交互

- 设置页是独立页面 `/puzzle-game/settings.html`，详见 `docs/SETTINGS_PAGE.md`。
- P8-4b 做设置页骨架、外观/语言偏好和保存条；P8-4c-1 接入主题列表；P8-4c-2 接入按阶数分配（`themeIdBySize`）和独立主题编辑器。
- 设置页主题分配先进入本地 draft，点击设置页“保存”后才写 `puzzle.v2.appearance`；不能点击卡片就落库。
- “应用到”对话框只列主题支持的阶数；当前已应用阶数锁定；确认只更新 draft，底部保存条负责最终保存。
- 主题编辑器是独立页面 `/puzzle-game/theme-editor.html`，自己维护 draft，点击编辑器“保存”后才写存储；不能在每次选色时直接落库。
- 设置页从 `observing` / `solved` 进入；运行中/重玩中/保存中禁用，避免当前局被卸载。
- 游戏主题编辑只编辑自定义主题；内置主题只读，修改时先复制成自定义主题，再编辑副本。
- 自定义主题上限 20 个；数据模型允许列表扩展，但存储和 UI 以 `CUSTOM_THEME_SLOT_COUNT` 为准。
- 自定义主题的 `supportedSizes` 缩小到正在被使用的阶数之外时，编辑器阻止保存，要求先在设置页切换这些阶数。
- 分组管理集中在成绩页；设置页不重复实现，后续如需要只放跳转链接。
- 自定义光标、极简 UI 属于 `GameSettings`，不属于 `Theme`；P8-5 再决定是否接入设置页“游戏”分类。
- 编辑器和设置页都按“显式保存”处理；返回/刷新丢弃 draft，确认弹框记录 TODO。详见 `docs/PUZZLE_THEME.md`。

### 10.5 页面主题 token

- 拼图外观主题只控制方块；页面背景、文字、边框、按钮、弹窗和提示使用 `src/shared/styles/base.css` 的语义 token。
- 当前 token：`--color-bg`、`--color-text`、`--color-muted`、`--color-border`、`--color-border-muted`、`--color-surface`、`--color-surface-hover`、`--color-accent`、`--color-accent-hover`、`--color-accent-soft`、`--color-on-accent`。
- 主题色 `--color-accent: #3498DB` 用于设置页选中项、保存按钮和游戏页弹框选中项；详细取舍见 `docs/SETTINGS_PAGE.md` 第 7 节。
- 深色/浅色主题只需在 `html[data-theme='dark']` 覆盖这些 token，并同步 `color-scheme`；本轮只建立 token 层，不实现切换入口。
- 棋盘 CSS 不写死页面颜色；空白块透明时自然透出页面背景。

### 10.6 对话框、提示与生命周期

- `ui/dialog.ts` 基于原生 `<dialog>`：`createDialog` 提供通用外壳，`confirmDialog` 返回 `Promise<boolean>`。
- Esc 与取消都返回取消，只有确认返回 `true`；关闭后焦点回到触发元素；危险操作默认聚焦取消；点击遮罩不关闭；`dismissible: false` 时 Esc 无效；`setBusy(true)` 阻止重复提交和 Esc。
- `ui/notice.ts` 提供非阻塞 notice：顶部居中、稳定 id 去重、loading 可原地更新为成功/失败；info/success 使用 `role="status"`，warning/error 使用 `role="alert"`，不抢焦点。
- 存储错误通过 `showStorageErrorNotice` 映射 `unavailable` / `blocked` / `quota` / `validation` / `corrupt` / `unknown`；回放 `issues` 通过 `showReplayIssueNotice` 提示，不阻塞页面。
- `ui/lifecycle.ts` 提供 `createLifecycle` 与 `dispose`：统一 `AbortSignal`、事件监听、定时器、rAF 和销毁回调；页面卸载或重开一局时统一清理。
- `styles/overlays.css` 提供基础样式，颜色使用 `base.css` 语义 token；页面级布局在 P8 调整。
- UI 层不 import data；`StorageNoticeCode` 在 `notice.ts` 内定义，页面传入 `DataStoreErrorCode` 时由 TypeScript 校验。
- P7-3 不引入 dialog / notice 库，也不引入 DOM 模拟环境；dialog / notice 的交互与视觉在 P8 接入手动验收。

## 11. 模块边界与目录

```text
src/games/puzzle/
├─ types.ts
├─ core/
│  ├─ board.ts
│  ├─ groups.ts
│  ├─ moves.ts
│  ├─ scramble.ts
│  ├─ score.ts
│  ├─ session.ts
│  ├─ stats.ts
│  ├─ replay.ts
│  ├─ replay-playback.ts
│  └─ appearance/
│     ├─ layers.ts
│     ├─ theme.ts
│     ├─ metrics.ts
│     ├─ presets.ts
│     ├─ appearance.ts
│     └─ index.ts
├─ data/
│  ├─ local-storage.ts
│  ├─ db.ts
│  ├─ errors.ts
│  ├─ schema.ts
│  ├─ time.ts
│  ├─ replay-codec.ts
│  ├─ settings-store.ts
│  ├─ appearance-store.ts
│  ├─ score-store.ts
│  ├─ replay-store.ts
│  └─ legacy.ts
├─ ui/
│  ├─ format.ts
│  ├─ board-view.ts
│  ├─ board-input.ts
│  ├─ settings-page.ts
│  ├─ game-theme-picker.ts
│  ├─ theme-assignment-dialog.ts
│  ├─ theme-coverage.ts
│  ├─ theme-preview.ts
│  ├─ dialog.ts
│  ├─ notice.ts
│  └─ lifecycle.ts
├─ pages/
│  ├─ game.ts
│  ├─ settings.ts
│  ├─ stats.ts
│  └─ replay.ts
└─ styles/
   ├─ board.css
   ├─ overlays.css
   ├─ game.css
   ├─ settings.css
   ├─ stats.css
   └─ replay.css

src/shared/preferences/
├─ types.ts        # SitePreferences、默认值、key/version
├─ store.ts        # 读取、归一化、保存、存储错误
├─ draft.ts        # 脏状态比较、重置
└─ apply.ts        # 应用到 document（深色模式/i18n 预留）
```

设置页由 `pages/settings.ts` 组装，`ui/settings-page.ts` 负责导航、表单和保存条；`src/shared/preferences/` 不依赖拼图 core/data。

### 11.1 依赖规则

```text
types ← core ← data ← pages
types ← core ← ui   ← pages
```

- `core` 不得 import `data`、`ui`、`pages`。
- `data` 不得 import `ui`、`pages`，不得访问 `document` / `window`；localStorage / IndexedDB 只能通过 data 层的适配器访问。
- `ui` 不得 import `data`；需要数据时由 `pages` 传入。
- `pages` 是唯一允许同时 import `core` / `data` / `ui` 的层。
- `pages/settings.ts` 可以 import `src/shared/preferences/`；`ui/settings-page.ts` 不直接访问 localStorage，由页面注入 controller。
- `pages` 负责 await 异步 repository，并处理 loading / 存储错误。
- 禁止循环依赖。

### 11.2 公共 API

- `core/appearance/index.ts` 统一导出 appearance 的公共函数。
- 其他 core 模块直接按文件 import，不做大而全的 barrel。
- `data/*-store.ts` 只导出 repository 函数；页面不直接操作 localStorage / IndexedDB。
- 设置、外观 repository 为同步 API，读取返回带 `status` 的结果；成绩、录像 repository 为异步 API；`probeScoreStorage()` 用于页面启动时探测 IndexedDB。
- 全站偏好由 `src/shared/preferences/store.ts` 提供同步 API，不经过拼图 data 层；设置页负责把结果转换为 controller。
- `data/db.ts`、`data/local-storage.ts`、`data/replay-codec.ts` 属于 data 层内部实现，页面不直接 import。
- `ui/board-view.ts` 不关心成绩、session、统计，只接收 `Board` + `Theme`；`Theme` 已包含 metrics。`update` 只重绘变化的格子，`setTheme` 只更新 CSS 变量和颜色。
- `ui/board-input.ts` 只上报格子下标和原始事件，不 import `core` 的 session/moves，不判断 `moveMode`；页面决定点击、滑动或忽略。

## 12. URL 契约

| 页面     | URL                                                       | 说明                               |
| -------- | --------------------------------------------------------- | ---------------------------------- |
| 游戏页   | `/puzzle-game/puzzle.html`                                | 设置从 `puzzle.v2.settings` 读取   |
| 设置页   | `/puzzle-game/settings.html`                              | 全站偏好 + 游戏主题分配；详见 `docs/SETTINGS_PAGE.md` |
| 主题编辑器 | `/puzzle-game/theme-editor.html?theme=<themeId>`        | 新建省略 `theme`；编辑自定义主题；详见 `docs/PUZZLE_THEME.md` |
| 重玩     | `/puzzle-game/puzzle.html?retry=<scoreId>`                | 使用该成绩的配置与打乱，不保存结果 |
| 成绩页   | `/puzzle-game/score-list.html?size=4&mode=normal&group=1` | 事件 + 分组筛选；group 使用事件内槽位 1–5 |
| 成绩详情 | 同上，追加 `&score=<id>`                                  | 原生 `<dialog>`，可刷新恢复        |
| 回放页   | `/puzzle-game/replay.html?score=<id>`                     | 缺少/非法 id 显示空状态            |
| 首页     | `/`                                                       | 不变                               |

- 不使用 `currentScore` / `currentScoreList` 作为页面间通道。
- 非法参数回退：`size` 回退 settings 中的阶数，`mode` 回退 `normal`，`group` 回退 1–5 中的有效槽位（优先 settings 当前槽位）。
- 筛选变化用 `history.pushState`；详情打开/关闭同步 `score` 参数。
- 旧 URL 路径保留，不新增重定向；新增设置页路径 `/puzzle-game/settings.html`。
- 设置页分类使用 hash（`#appearance` / `#language` / `#game-theme` / `#about`），切换用 `history.replaceState`，不污染后退历史。

## 13. 测试策略

- **core**：Vitest 单元测试；时间、随机源、棋盘全部通过参数注入；不依赖 DOM。
- **data**：localStorage 适配器用内存 `Storage` 测试；IndexedDB repository 用 `fake-indexeddb` 测试；覆盖缺键、损坏 JSON、非法记录、配额/不可用错误、索引查询、原子事务。全站偏好 store 使用内存适配器测试，不依赖浏览器。
- **ui**：纯格式化函数和 lifecycle 用 Vitest node 单测；dialog / notice / board-view / 设置页等 DOM 交互不引入 DOM 模拟环境，以手动验收和后续 Playwright 为主。
- **测试命名**：中文描述，和现有 `board.test.ts` / `moves.test.ts` 保持一致。
- **每次提交前**：
  ```bash
  npm test
  npm run typecheck
  npm run lint
  npm run format:check
  ```
- **UI 阶段**：不自动启动 dev server；由用户启动后手动验收或运行 Playwright。

必须覆盖的关键场景：

- session：normal/blind 计时、观察时间、无效移动、整行多步、复原锁定、重玩不保存。
- stats：空桶、单条、算术平均、去尾 ao、5 分钟边界、并列高亮、删除后重编号、清空分组后为空。
- replay：0 步、正常回放、盲玩偏移、非法 move、倍速切换、暂停恢复、seek 边界、10×10 约 3,000 步长录像。
- appearance：2–10 层映射、三种着色模式取色、逐块字体色 `auto`/固定色、内边框消失/存在时的字号公式、两套内置主题不可变、主题级 metrics clamp、`supportedSizes` / `themeIdBySize` 分配、回退主题、自定义主题复制/删除、主题切换不重建棋盘。
- ui：lifecycle 的 signal / 监听器 / 定时器 / rAF 清理；dialog / notice 的 Esc、焦点回收、非阻塞提示在 P8 手动验收。
- data：localStorage 设置/外观读写、IndexedDB 原子事务、`by-bucket` / `by-event` 索引、按桶/事件/全部清空、录像编码往返、90 个事件级分组与改名、旧键不读取、清理旧键。
- preferences：缺键/损坏/不可用状态、字段归一化、保存往返、脏状态比较和重置。
- settings：hash 分类、草稿/重置/保存、未保存提示条、语言偏好、运行中设置入口禁用，随 P8-4b 手动验收和 P8-6 E2E 覆盖。

## 14. 决策记录

| 决策       | 选择                                     | 理由                                                    |
| ---------- | ---------------------------------------- | ------------------------------------------------------- |
| 旧数据     | 不迁移、不兼容                           | 站点已无用户；减少历史特例和迁移代码                    |
| 存储分层   | localStorage（设置/外观/全站偏好）+ IndexedDB（成绩/录像） | 小数据同步读写；大数据支持索引、配额和原子事务 |
| 全站偏好   | `site.v1.preferences`，version 1         | 外观/语言与拼图私有数据分开；迁移全站设置页不迁移数据    |
| 设置页     | 独立页面 + 草稿/保存条                   | 分类可扩展；避免模态框拥挤；重置/丢弃语义清晰            |
| 主题色     | `#3498DB` + 白字                         | 统一设置页和游戏页选中态；接受小字号对比度取舍          |
| 成绩模型   | 只存事实，派生值读时算                   | 消除 time/tps/ao/number 不一致                          |
| 平均       | 算术平均；ao 才用去尾平均                | 数学语义清晰，旧数据已丢弃                              |
| 分组       | 事件级固定 5 组，`GroupId` 1–5，仅允许改名 | 分组属于 `size + gameMode` 事件；避免全局分组与模式错位；90 组存储可忽略 |
| 分组清空   | 只清空成绩与录像，不删除分组             | 分组是固定结构，名称保留；按桶（事件+分组）或事件执行  |
| 分组管理   | 集中到成绩页；游戏页只切换               | 管理需要事件上下文；避免三处重复实现                    |
| 录像存储   | 与成绩摘要分开，IndexedDB 紧凑编码；先全量保存 | 统计页不加载 moves；长录像体积更小、读取更快；容量评估后暂不设保留策略 |
| 成绩页筛选 | 事件（阶数+模式）→ 分组二级下拉          | 阶数是桶的必要维度；两级选择与分组模型一致              |
| 页面状态   | URL 参数 + repository                    | 去掉 `currentScore` 过期与配置错位                      |
| 计时       | `performance.now()`，不做暂停            | 后台不继续累计 tick 误差；语义更接近真实                |
| 回放       | 时间轴 + rAF                             | 倍速、暂停、seek 都可用同一套状态                       |
| 外观       | 每个 Theme 内含 ColorMode + innerBorder + blindTileColor + BoardMetrics | 颜色、字体色、边框和尺寸随主题切换，用户可自定义；避免全局状态分叉 |
| 主题分配   | `supportedSizes` + `themeIdBySize`，覆盖范围派生 | 主题能力与当前分配分离；每个阶数独立选择；不存两份覆盖数据 |
| 回退主题   | `FALLBACK_THEME`，不进入主题列表         | 主题损坏/版本不兼容时使用中性外观，不误报为彩虹主题被重置 |
| 逐块字体色 | `fontPalette`，与 `palette` 等长，每项 `auto`/hex | 支持不同层/行/数字提高辨识度；`auto` 保留对比度逻辑      |
| 内边框     | `ThemeInnerBorder`，整盘统一，inset shadow + padding | 不改变方块外尺寸；字号按边框内区域计算                  |
| 盲玩颜色   | `Theme.blindTileColor`，默认 `#3498db`   | 隐藏数字时的方块颜色也属于外观主题，用户可调整          |
| 着色模式   | 降阶 / 按行 / 固定色                     | 覆盖分层、按行、逐数字三种需求；一个主题只用一种模式    |
| 按行       | 按数字块原本所属行                       | 颜色跟随数字块，移动时不闪色                            |
| 内置预设   | 先保留两套降阶                           | 复刻旧视觉；按行/固定色的默认预设后续再定               |
| 颜色选择器 | 原生 `<input type="color">`              | 无额外依赖，旧数据已丢弃                                |
| 图表       | ECharts 懒加载                           | 统计页才加载；core 与渲染解耦                           |
| 运行中设置 | 禁止                                     | 设置页是独立页面，进入会离开当前局；避免误丢成绩         |
| 设置页路由 | 先放 `/puzzle-game/settings.html`        | 不占用全站根路径；偏好 key 已按全站设计，后续可迁移      |
| 存储选型   | localStorage + IndexedDB + repository    | 设置小且需同步；成绩/录像大且需要索引和原子事务         |
| IDB 封装   | `idb` + `fake-indexeddb`                 | 轻量、类型完整；避免手写事务/请求封装；测试可覆盖事务和索引 |

## 15. 后续扩展点

以下不阻塞当前实现：

- 分组数量扩展（超过每事件 5 组）需要 IndexedDB / localStorage schema 迁移；当前固定 5 组/事件。
- 设置页迁移到全站 `/settings.html`、深色主题和多语言，详见 `docs/SETTINGS_PAGE.md`；按阶数分配、回退主题与独立编辑器见 `docs/PUZZLE_THEME.md`。
- 分组名称 i18n：默认名按浏览器语言切换 `分组N` / `GroupN`，已有名称不自动翻译；见 `docs/PUZZLE_SCORE_PAGE.md`。
- 录像保留策略（只保留最近 N 月、只保留最佳成绩录像、只删录像保留成绩）；当前先全量保存。
- 更多内置预设（按行/固定色）与预设管理；当前只保留两套降阶内置主题。
- 自定义主题删除、排序、命名规则与导入/导出；当前只有新建/编辑。
- 成绩 / 录像 / 设置导入导出 JSON。
- 长录像时间轴改为 checkpoint / 按需物化盘面；当前保留完整帧。
- 成绩保存 `themeId`，实现“按当时主题回放”。
- 限时观察、暂停模式等新规则。
- 国际化 typed messages。
- 自定义光标改为 SVG data URI。
- 图表库替换为 uPlot 或自绘 SVG。
- 使用 `navigator.storage.persist()` 申请持久化存储。
- 多标签页同步、可访问性增强。
