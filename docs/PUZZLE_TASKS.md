# 数字华容道重构任务清单

> 配套文档：`docs/PUZZLE_ARCHITECTURE.md`
>
> 当前分支：`refactor/vite-ts`
>
> 状态：P0 文档已完成，P1 已完成
>
> 标记：`[ ]` 未开始 / `[~]` 进行中 / `[x]` 已完成 / `[!]` 阻塞
>
> 执行规则：一次只做一个任务；每个任务先补测试再实现；完成后更新本文件状态。提交前需用户确认。

## 0. 总览

| 阶段 | 内容                      | 依赖       | 状态  |
| ---- | ------------------------- | ---------- | ----- |
| P0   | 架构与任务文档            | —          | `[x]` |
| P1   | 领域类型与 score 共享函数 | P0         | `[x]` |
| P2   | appearance 纯逻辑         | P1         | `[ ]` |
| P3   | session 纯逻辑            | P1         | `[ ]` |
| P4   | stats 纯逻辑              | P1         | `[ ]` |
| P5   | replay 纯逻辑             | P1         | `[ ]` |
| P6   | data 层与旧数据清理       | P1–P5      | `[ ]` |
| P7   | 共享 UI 基础              | P2、P6     | `[ ]` |
| P8   | 游戏页                    | P3、P6、P7 | `[ ]` |
| P9   | 成绩页                    | P4、P6、P7 | `[ ]` |
| P10  | 回放页                    | P5、P6、P7 | `[ ]` |
| P11  | 文档、清理与验收          | P8–P10     | `[ ]` |

**本轮范围：P1–P5（纯逻辑）**。P6 之后为数据/UI 阶段，按顺序推进，不提前写页面。

每个阶段结束都运行：

```bash
npm test
npm run typecheck
npm run lint
npm run format:check
```

UI 阶段不自动启动 dev server；需要看效果时由用户启动。

---

## P0 文档与契约

### P0-1 架构文档

- [x] 文件：`docs/PUZZLE_ARCHITECTURE.md`
- 内容：数据模型、存储键、派生公式、session/stats/replay/appearance 设计、模块边界、URL 契约、测试策略、决策记录。
- 验收：文档 review 通过；后续实现以文档为准。

### P0-2 任务清单

- [x] 文件：`docs/PUZZLE_TASKS.md`
- 内容：按阶段拆分可执行任务，标注文件、内容、测试与验收。
- 验收：每个任务都能独立开始和验收。

### P0-3 更新重构计划

- [x] 文件：`docs/REFACTOR_PLAN.md`
- 内容：删除旧数据兼容策略，改为 `puzzle.v2.*` 新键、不迁移旧数据；补充新文档入口。
- 验收：重构计划与架构文档不矛盾。

---

## P1 领域类型与 score 共享函数

### P1-1 重建领域类型

- [x] 文件：`src/games/puzzle/types.ts`
- 内容：
  - 保留 `PuzzleSize`、`GameMode`、`MoveMode`、`Direction`、`Board`。
  - `MoveRecord.timeMs` 从 `number | null` 改为必填 `number`。
  - 新增 `GroupId`（固定 1–10 的字面量联合类型）、`Group`（`id: GroupId`、`name`，不存 `order`）、`GameSettings`、`ScoreRecord`、`ReplayRecord`、`SessionPhase`、`SessionConfig`、`SessionState`、`SessionView`、`SessionResult`、`Theme`、`BoardMetrics`、`AppearanceState`、`ScoreFilter`、`ScoreStats`、`ScoreHighlight`、`ChartSeries`。
  - `GameSettings.groupId`、`ScoreRecord.groupId`、`ScoreFilter.groupId` 统一使用 `GroupId`；`groups` 固定 10 项，名称允许重名。
  - 中文注释写清时间单位、epoch/相对时间、坐标、派生字段不落库、固定分组等约束。
- 测试/验收：
  - `npm run typecheck` 通过。
  - 现有 `board` / `moves` / `scramble` 测试不回归。
  - 类型中不再出现 `Group.order` 或字符串 `groupId`。
- 依赖：P0。

### P1-2 score 共享函数

- [x] 文件：`src/games/puzzle/core/score.ts`、`score.test.ts`
- 内容：
  - `calculateTps(moveCount, durationMs)`：`durationMs <= 0` 返回 0。
  - `compareScores(a, b)`：`finishedAt` 升序，相同按 `id` 升序。
  - `sortScores(scores)`：返回新数组，不修改入参。
  - `getBucketKey({ size, gameMode, groupId })`：`groupId` 使用 `GroupId`。
  - `filterScoresByBucket(scores, filter)`。
  - `getScoreStartedAt(score)`：`finishedAt - durationMs`。
  - `assignNumbers(scores)`：先排序，再返回 `{ score, number }[]`，`number` 从 1 开始。
- 测试：
  - TPS 正常/0/负数保护。
  - 排序稳定、不修改原数组。
  - 桶过滤只保留目标组合（`groupId` 为 1–10）。
  - `getScoreStartedAt` 与 `finishedAt - durationMs` 一致。
  - 删除一条后编号连续。
- 依赖：P1-1。

---

## P2 appearance 纯逻辑

### P2-0 主题类型重构

- [ ] 文件：`src/games/puzzle/types.ts`
- 内容：
  - 新增共享字段接口 `ColorModeFields`（内部），以及 `LayerColorMode`、`RowColorMode`、`FixedColorMode`、`ColorMode`；不引入 `ColorModeKind`。
  - `Theme` 改为统一入口：`id`、`name`、`builtin`、`color: ColorMode`、`metrics: BoardMetrics`。
  - `AppearanceState` 移除 `metrics`，只保留 `activeThemeId`、`themes`。
  - `BoardMetrics` 保留，作为主题内的尺寸比例类型。
- 测试/验收：
  - `npm run typecheck` 通过。
  - 现有 board/moves/scramble/score 测试不回归。
- 依赖：P1-1。

### P2-1 层算法

- [ ] 文件：`src/games/puzzle/core/appearance/layers.ts`、`layers.test.ts`
- 内容：
  - `getTileLayer(tile, size)`：保留旧版 L 形公式；`tile <= 0` 或越界返回 0。
  - `getLayerCount(size)`：返回 `2 * size - 2`；非法 size 返回 0。
  - `isTileInLayerRange` / `getLayerPaletteIndex` 等小工具（按需）。
- 测试：
  - 2–10 阶所有方块逐一遍历，层号在 `1..2*size-2`。
  - 空白块 0 返回 0。
  - 4×4 的层分布与旧实现一致。
  - 非法 tile、越界 size 不抛异常。
- 依赖：P2-0。

### P2-2 内置主题与默认尺寸

- [ ] 文件：`src/games/puzzle/core/appearance/presets.ts`、`presets.test.ts`
- 内容：
  - `BUILTIN_THEMES`：只保留旧代码的两套降阶主题 `rainbow`、`rainbow-soft`，完整保留 18 层背景色和 metrics。
  - 两套主题的 `color.mode` 均为 `layer`，`palette` 为旧配置的 1–18 层颜色；`blankColor: 'transparent'`，`fontColor: '#ffffff'`。
  - `rainbow` 的 metrics 为 `0.5 / 0.03 / 0.04`；`rainbow-soft` 为 `0.5 / 0 / 0.01`。
  - `DEFAULT_METRICS` 取 `rainbow` 的 metrics，作为新建自定义主题和损坏回退值。
  - 按行/固定色不作为内置预设；后续再定默认色板。
  - 所有常量 `Object.freeze` / 只读，导出前深拷贝。
- 测试：
  - 两套主题各有 18 个颜色，颜色均为合法 `#rrggbb`。
  - 字体色均为白色，`blankColor` 为 `transparent`。
  - 两套 metrics 与旧实现一致。
  - 冻结和克隆隔离。
- 依赖：P2-0。

### P2-3 取色与主题克隆

- [ ] 文件：`src/games/puzzle/core/appearance/theme.ts`、`theme.test.ts`
- 内容：
  - `getTileVisual(tile, size, theme)`：返回 `{ background, color }`；空白块返回 `blankColor` 和 `transparent`。
  - 按 `theme.color.mode` 取色：降阶 `getTileLayer - 1`；按行 `Math.floor((tile - 1) / size)`；固定色 `tile - 1`。
  - `fontColor === 'auto'` 时按背景亮度选择黑/白，否则使用主题配置的字体色。
  - `getTileColor` / `getTileFontColor` 作为底层单测入口（按需）。
  - `isValidHexColor`、`isValidBlankColor`、`cloneTheme`。
  - `createCustomTheme` 暂不实现，等 UI 需要时再加。
- 测试：
  - 降阶、按行、固定色三种模式的取色。
  - 空白块、非法 tile、缺失色板项回退。
  - 自动字体色对深/浅背景的判定。
  - 克隆后修改数组不影响原主题。
  - 非法 hex / blankColor 判定。
- 依赖：P2-1、P2-2。

### P2-4 主题尺寸比例

- [ ] 文件：`src/games/puzzle/core/appearance/metrics.ts`、`metrics.test.ts`
- 内容：
  - `DEFAULT_METRICS` 或复用 presets。
  - `clampRatio(value, min, max)`。
  - `normalizeMetrics(raw)`：非数字、NaN、Infinity、越界值回退/夹取。
  - `toCssVariables(theme)`：读取 `theme.metrics` 和 `theme.color.blankColor`，返回纯对象，不碰 DOM。
- 测试：
  - 字号 0–1、间隙 0–0.1、圆角 0–0.5 的边界。
  - `NaN` / `Infinity` / 字符串输入（防御性）回退。
  - CSS 变量键名与值正确，且来自传入主题的 metrics。
- 依赖：P2-0、P2-2。

### P2-5 外观状态与公共入口

- [ ] 文件：`src/games/puzzle/core/appearance/appearance.ts`、`appearance.test.ts`、`index.ts`
- 内容：
  - `createDefaultAppearance()`：两套内置主题 + 默认激活 `rainbow`；不生成空 Theme 占位。
  - `getActiveTheme(appearance)`：找不到时回退第一个内置主题。
  - `cloneAppearance(appearance)`。
  - `upsertCustomTheme`、`removeCustomTheme`、`setActiveTheme`：纯函数，返回新状态。
  - 内置主题不可删除、不可覆盖；自定义主题携带自己的颜色模式和 metrics。
  - `CUSTOM_THEME_SLOT_COUNT = 3` 供 UI 展示空槽位，不写入 `themes`。
- 测试：
  - 默认状态只有两套内置主题，activeThemeId 失效回退。
  - 新增/更新/删除自定义主题；自定义主题可带 row/fixed 模式和 metrics。
  - 删除当前主题后回退。
  - 内置主题保护。
  - 克隆隔离。
- 依赖：P2-0–P2-4。

---

## P3 session 纯逻辑

### P3-1 创建与移动

- [ ] 文件：`src/games/puzzle/core/session.ts`、`session.test.ts`
- 内容：
  - `createSession(config, createdAtMs)`：校验 `size`、`scramble`、`groupId`、`createdAtEpochMs`；非法输入抛错或返回明确错误（二选一，保持全项目一致）。
  - `moveByDirection(state, direction, atMs)`：键盘单步；非法方向 no-op。
  - `moveByTile(state, tileIndex, atMs)`：调用 `planLineMove`；无移动 no-op；多步共享同一 `timeMs`。
  - 第一次有效移动设置 `firstMoveAtMs`，阶段 `observing → running`。
  - 每次移动后检查 `isSolved`，进入 `solved` 并记录 `solvedAtMs`。
  - `solved` 后拒绝移动。
- 测试：
  - normal/blind 第一次移动启动计时。
  - 无效点击/越界键盘不改变状态。
  - 整行点击记录多步、时间相同、`moveCount === moves.length`。
  - 复原后锁盘。
  - 不修改入参 state。
- 依赖：P1-1。

### P3-2 视图与结果

- [ ] 文件：`src/games/puzzle/core/session.ts`、`session.test.ts`
- 内容：
  - `getSessionView(state, nowMs)`：返回 `phase`、`elapsedMs`、`observeMs`、`tps`、`hideNumbers`。
  - normal：第一次移动前 elapsed 0；之后从 `firstMoveAtMs` 计时。
  - blind：从 `createdAtMs` 计时，包含观察；`hideNumbers` 只在 running 为 true。
  - `getSessionResult(state)`：只在 solved 返回；计算 `durationMs`、`observeMs`、`moveCount`、`startedAt`、`finishedAt`、`manhattanDistance`、retry 标记。
  - 结算后视图时间冻结，不被后续 `nowMs` 改变。
- 测试：
  - normal/blind 的 elapsed/observe 语义。
  - 未复原返回 null。
  - 结算 epoch 映射正确。
  - 结算后继续传入更大的 nowMs，结果不变。
  - 重玩结果仍返回，但 `isRetry` 为 true。
- 依赖：P3-1。

---

## P4 stats 纯逻辑

### P4-1 ao5 / ao12

- [ ] 文件：`src/games/puzzle/core/stats.ts`、`stats.test.ts`
- 内容：
  - `SESSION_GAP_MS = 5 * 60 * 1000`。
  - `computeAoAt(scores, index, windowSize)`：窗口、5 分钟间隔、去尾平均。
  - `computeBestAo(scores, windowSize)`。
  - 时间必须先用 `sortScores` 排序。
  - 5 分钟间隔使用 `getScoreStartedAt(next) - previous.finishedAt`。
- 测试：
  - 不足 5/12 条返回 null。
  - 5 条/12 条刚好满足。
  - 去掉最小/最大后平均。
  - 间隔恰好 300000ms 有效，超过无效。
  - 负间隔/NaN 无效。
  - 窗口内任意一对超时则整体无效。
- 依赖：P1-2。

### P4-2 聚合统计

- [ ] 文件：`src/games/puzzle/core/stats.ts`、`stats.test.ts`
- 内容：
  - `computeScoreStats(scores)`：返回 `ScoreStats`。
  - 时间/步数/TPS/观察时间的算术平均。
  - 最佳时间/步数取最小，最佳 TPS 取最大，最佳 ao 取 `computeBestAo`。
  - 空桶全部 `null`，`count = 0`。
- 测试：
  - 空、单条、多条。
  - 算术平均（不是去尾平均）。
  - 并列最佳。
  - TPS 为 0/非法值时不被污染。
  - 最佳 ao 没有有效值时返回 null。
- 依赖：P1-2、P4-1。

### P4-3 高亮与图表数据

- [ ] 文件：`src/games/puzzle/core/stats.ts`、`stats.test.ts`
- 内容：
  - `computeScoreHighlights(scores)`：时间/步数/ao 最小最好、最大最差；TPS 最大最好、最小最差；并列全部标记。
  - `buildChartSeries(scores)`：`labels` 为派生 number，`timeSeconds`、`steps` 与之一一对应。
  - 空/单条成绩返回合法空/单点数据。
- 测试：
  - 并列、单条、空桶。
  - 时间/步数/TPS/ao 的高亮方向。
  - 图表数组长度一致、顺序与排序一致。
- 依赖：P1-2、P4-1、P4-2。

---

## P5 replay 纯逻辑

### P5-1 时间轴构建

- [ ] 文件：`src/games/puzzle/core/replay.ts`、`replay.test.ts`
- 内容：
  - `buildReplayTimeline(score, replay)`：第 0 帧为 scramble；逐步应用 moves。
  - normal 时间偏移 `observeMs`；blind 不偏移。
  - 时间单调 clamp；非法方向、棋盘损坏、moveCount 不一致写入 issues 并停止。
  - `durationMs` 以 score 为准，且不小于最后一帧。
  - `getFrameAt(timeline, positionMs)` 二分查找，首尾 clamp。
- 测试：
  - 0 步成绩只有首帧。
  - normal/blind 时间轴差异。
  - 非法 moves、moveCount 不一致。
  - 时间倒退 clamp。
  - 首帧前/末帧后查找。
- 依赖：P1-1、P1-2。

### P5-2 播放器状态机

- [ ] 文件：`src/games/puzzle/core/replay-playback.ts`、`replay-playback.test.ts`
- 内容：
  - `PLAYBACK_SPEEDS`：0.125–10 的旧倍速列表。
  - `createPlayback`、`play`、`pause`、`seekToFrame`、`stepBy`、`setSpeed`、`updatePlayback`。
  - 用 `positionMs` + 锚点，不逐帧 interval。
  - 倍速变化先更新位置再重设锚点。
  - 到末尾自动停止。
- 测试：
  - 播放/暂停/恢复不跳时间。
  - 1x→10x、10x→0.5x 不整体缩放历史时间。
  - seek/step 边界。
  - 末尾自动暂停。
  - 非播放状态 update 不推进。
- 依赖：P5-1。

### P5-3 回放集成与边界测试

- [ ] 文件：`src/games/puzzle/core/replay.test.ts`（或新增集成测试）
- 内容：把 timeline 与 playback 串起来，覆盖真实成绩形态。
- 测试：
  - normal 4×4 完整回放，关键时间点帧正确。
  - blind 回放包含观察等待。
  - 0 步、最后一步、seek 到中间后继续播放。
  - issues 不为空时 UI 可提示但不崩溃。
- 依赖：P5-1、P5-2。

---

## P6 data 层与旧数据清理

### P6-1 存储适配器

- [ ] 文件：`src/games/puzzle/data/storage.ts`、`storage.test.ts`
- 内容：
  - `Storage` 接口：`get`、`set`、`remove`、`keys`。
  - `createLocalStorage()` 与 `createMemoryStorage()`。
  - `readJson` / `writeJson`：JSON 解析失败、配额错误、存储不可用返回明确结果。
  - `ensureMeta()`：首次访问创建 `puzzle.v2.meta`，记录 version 与 createdAt。
  - 统一 `puzzle.v2.` 前缀。
- 测试：
  - 内存存储读写/删除。
  - 损坏 JSON 不抛到页面层。
  - 配额/不可用模拟。
- 依赖：P1-1。

### P6-2 schema 与类型守卫

- [ ] 文件：`src/games/puzzle/data/schema.ts`、`schema.test.ts`
- 内容：
  - `STORAGE_KEYS` 常量。
  - `SCHEMA_VERSION = 2`。
  - 各存储信封类型。
  - `isScoreRecord`、`isReplayRecord`、`isGameSettings`、`isAppearanceState` 等守卫。
  - 校验固定 10 组、`GroupId` 为 1–10、`groupId` 在范围内；名称允许重名。
  - 校验 `Theme.color.mode` 对应的 palette 长度（18/10/99）、颜色格式、`fontColor` / `blankColor`、`Theme.metrics` 范围。
  - 非法记录跳过策略。
- 测试：
  - 合法/非法 score、replay、settings、appearance。
  - 缺字段、错误类型、越界 size、非法颜色。
  - 分组数量/ID 非法、`groupId` 越界、损坏名称回退。
  - 主题模式/色板长度/metrics 非法。
  - 数组里混入坏记录时只过滤坏记录。
- 依赖：P1-1、P6-1。

### P6-3 设置存储

- [ ] 文件：`src/games/puzzle/data/settings-store.ts`、`settings-store.test.ts`
- 内容：
  - 默认设置：size 4、normal、slide、无自定义光标、非极简 UI。
  - 默认固定 10 个分组，ID 1–10，名称 G1–G10；只允许修改 `Group.name`，不新增、不删除、不排序；允许重名。
  - `loadSettings` / `saveSettings`。
  - `groupId` 失效回退 `1`；缺失分组按 ID 补齐默认名称。
  - 缺失/损坏字段补默认值。
- 测试：
  - 首次加载默认值（10 组、ID 1–10、当前分组为 1）。
  - 保存分组改名后读回一致；允许重名。
  - 非法 groupId、size、mode 回退。
  - 损坏/缺失分组补齐后 ID 不变。
- 依赖：P6-1、P6-2。

### P6-4 外观存储

- [ ] 文件：`src/games/puzzle/data/appearance-store.ts`、`appearance-store.test.ts`
- 内容：
  - `loadAppearance` / `saveAppearance`。
  - activeThemeId 失效回退内置主题。
  - 内置主题不可被覆盖/删除；自定义主题列表保留。
  - 按 `theme.color.mode` 校验 palette 长度（18/10/99）、颜色、`fontColor`、`blankColor`。
  - 每个主题的 metrics 独立 clamp；非法值回退 `DEFAULT_METRICS`。
  - 非法主题过滤。
- 测试：
  - 首次加载默认外观（两套内置主题）。
  - 保存/读回自定义主题（含 row/fixed 模式与 metrics）。
  - 损坏模式/色板/metrics 过滤或回退，不崩溃。
  - 内置主题不可删除。
- 依赖：P2-5、P6-1、P6-2。

### P6-5 成绩与录像存储

- [ ] 文件：`src/games/puzzle/data/score-store.ts`、`replay-store.ts`、`score-store.test.ts`
- 内容：
  - `listScores`、`getScoreById`、`addScore`、`removeScore`、`clearScores`、`clearScoresByGroup(groupId)`。
  - `loadReplay`、`saveReplay`、`removeReplay`。
  - `addScore` 先写 replay 再写 scores；scores 失败时回滚 replay。
  - 删除先 scores 再 replay；孤立 replay 可清理。
  - `clearScoresByGroup` 删除该 `groupId` 下所有 `size + gameMode` 的成绩与 replay，保留分组和名称。
  - 不写 `tps`、`number`、`ao` 等派生字段。
- 测试：
  - 新增/读取/删除/清空。
  - 按分组清空只删除目标组，其他组保留；replay 一并删除。
  - 写入顺序与失败回滚。
  - 孤立 replay 清理。
  - 损坏记录过滤。
- 依赖：P6-1、P6-2、P1-2。

### P6-6 旧数据清理

- [ ] 文件：`src/games/puzzle/data/legacy.ts`、`legacy.test.ts`
- 内容：
  - `LEGACY_KEYS = ['config', 'scores', 'currentScore', 'currentScoreList']`。
  - `hasLegacyData()`、`clearLegacyData()`。
  - 新代码不读取这些键。
- 测试：
  - 有/无旧键检测。
  - 清理只删除旧键，不影响 `puzzle.v2.*`。
  - 全仓库搜索确认没有旧键读取。
- 依赖：P6-1。

---

## P7 共享 UI 基础

### P7-1 格式化

- [ ] 文件：`src/games/puzzle/ui/format.ts`、`format.test.ts`
- 内容：
  - `formatDuration(ms)`：`12.34` / `1:02.34`。
  - `formatTps(tps)`：两位小数。
  - `formatDateTime(epochMs)`：本地日期时间。
  - `formatCount` / `formatPercent`（按需）。
- 测试：
  - 0、毫秒边界、59.99s、60s、小时级。
  - 负数/NaN 防御。
- 依赖：P1-1。

### P7-2 board-view 与主题应用

- [ ] 文件：`src/games/puzzle/ui/board-view.ts`、`board-style.ts`、`styles/board.css`
- 内容：
  - `createBoardView({ root, size, theme, interactive })`。
  - `update(board)`、`setTheme(theme)`、`destroy()`；metrics 已包含在 theme 中。
  - 每个 tile 通过 `getTileVisual` 设置 `--tile-bg` / `--tile-fg`；CSS 不区分着色模式。
  - `board-style` 从 `theme.metrics` 设置 `--tile-font-ratio`、`--tile-gap-ratio`、`--tile-radius-ratio`、`--blank-color`。
  - 事件委托：click / mouseover / touchstart / touchmove 统一绑定在 board 容器。
  - `ResizeObserver` 计算 `--cell-size`。
  - 只读模式用于成绩详情和回放。
- 测试/验收：
  - 主题切换/修改 metrics 只更新 CSS 变量和 tile 颜色，不重建 tile。
  - 三种着色模式的 tile 颜色正确。
  - 2–10 阶布局正确。
  - 不使用每 tile 独立监听器。
  - `destroy` 后监听器和 observer 释放。
- 依赖：P2-5、P6-4。

### P7-3 对话框、提示与生命周期

- [ ] 文件：`src/games/puzzle/ui/dialog.ts`、`notice.ts`、`lifecycle.ts`
- 内容：
  - 基于原生 `<dialog>` 的确认框/设置框封装。
  - 非阻塞 toast/notice。
  - `createAbortController` / `dispose` 辅助，统一页面卸载。
- 测试/验收：
  - Esc/取消/确认行为一致。
  - 焦点回到触发元素。
  - 页面销毁后无残留监听器。
- 依赖：P6-1。

---

## P8 游戏页

### P8-1 页面骨架

- [ ] 文件：`puzzle-game/puzzle.html`、`src/games/puzzle/pages/game.ts`、`styles/game.css`
- 内容：
  - 替换占位页，保留原 URL。
  - 加载 settings/appearance；初始化空棋盘。
  - 统一的错误边界：存储不可用、主题损坏时显示提示并继续。
- 验收：页面可加载，无控制台错误。
- 依赖：P6、P7。

### P8-2 输入、session 与 HUD

- [ ] 文件：`pages/game.ts`、`styles/game.css`
- 内容：
  - 新局生成 scramble，创建 session。
  - click/slide/keyboard 三种输入；触摸支持；Ctrl 暂停滑动触发（沿用旧行为）。
  - rAF 更新 Time / Step / TPS；blind 模式首次移动后隐藏数字。
  - 键盘快捷键：空格新局、方向键/WASD、`/` 极简 UI 等（按旧功能清单核对）。
- 验收：三种模式都能完成一局；计时/步数/TPS 正确；盲玩切换正确。
- 依赖：P3、P7-2、P8-1。

### P8-3 结算、保存与重玩

- [ ] 文件：`pages/game.ts`
- 内容：
  - solved 后构造 `ScoreRecord` + `ReplayRecord`，调用 score-store 保存。
  - 保存失败提示，不丢当前结果。
  - `?retry=<id>`：读取成绩打乱，创建 retry session；复原后不保存。
  - 完成后锁定棋盘，显示“新一局/查看成绩”入口。
- 验收：正常成绩落库；重玩不落库；刷新后成绩仍在。
- 依赖：P3-2、P6-5、P8-2。

### P8-4 设置与外观编辑器

- [ ] 文件：`pages/game.ts`、`ui/dialog.ts`、`styles/game.css`
- 内容：
  - 游戏设置：阶数、模式、操作模式、分组选择；分组名称编辑（固定 10 组，不增删，允许重名）。
  - 外观：两套内置降阶主题；自定义主题支持降阶/按行/固定色三种模式。
  - 色板编辑：降阶 18 色、按行 10 色、固定色 99 色；空白色、字体色（auto 或固定色）。
  - 每个主题独立编辑字号/间隙/圆角；内置主题只读，修改时复制为自定义主题。
  - 原生 `<input type="color">`；实时预览；显式保存。
  - 保存外观不重开一局；运行中禁用设置入口。
- 验收：三种模式切换/改色/改比例实时预览；自定义主题保存后刷新仍生效；内置主题不被修改；不影响当前局；分组改名后 HUD 和成绩页显示新名称。
- 依赖：P2、P6-3、P6-4、P8-2。

### P8-5 光标、极简 UI 与可访问性

- [ ] 文件：`pages/game.ts`、`styles/game.css`
- 内容：
  - 自定义光标开关并持久化。
  - 极简 UI 持久化，保留恢复入口。
  - tab 顺序、aria-label、焦点样式、键盘可操作。
  - 移动端横屏布局和触摸操作。
- 验收：键盘可完成一局；移动端可操作；无焦点陷阱。
- 依赖：P8-2、P6-3。

### P8-6 游戏页 E2E

- [ ] 文件：`tests/e2e/game.spec.ts`
- 内容：
  - 加载页面、切阶数、三种输入各完成一局、盲玩隐藏、成绩保存。
  - 切换内置/自定义主题，刷新后主题与 metrics 保留。
  - 分组改名后刷新，HUD 和成绩页显示新名称。
  - 刷新后设置与成绩保留。
- 验收：Playwright 通过；用户手动验收。
- 依赖：P8-3、P8-4。

---

## P9 成绩页

### P9-1 页面骨架与 URL 筛选

- [ ] 文件：`puzzle-game/score-list.html`、`src/games/puzzle/pages/stats.ts`、`styles/stats.css`
- 内容：
  - 解析 `size` / `mode` / `group`（固定编号 1–10）；非法回退。
  - 筛选变化用 `history.pushState`；监听 `popstate`。
  - 从 settings 读默认筛选。
- 验收：刷新/前进后退/分享链接都能恢复筛选。
- 依赖：P6-3、P7-1。

### P9-2 统计与列表

- [ ] 文件：`pages/stats.ts`
- 内容：
  - 加载 scores，过滤/排序/编号。
  - 显示组统计、表格、高亮、空状态。
  - 分组筛选和列表显示 `Group.name`，不使用 ID 作为文案。
  - 不显示旧版“榜首列是阶数”的错位表头。
- 验收：统计数字与纯函数一致；空桶显示空状态。
- 依赖：P4、P9-1。

### P9-3 详情与删除

- [ ] 文件：`pages/stats.ts`、`ui/dialog.ts`
- 内容：
  - `?score=<id>` 打开详情；显示打乱缩略图、时间、观察、曼哈顿距离（由 scramble 计算）、步数、TPS、ao、日期等。
  - 删除单条/清空当前筛选/清空分组全部成绩/全部，使用原生确认框；删除后局部更新，不 `location.reload()`。
  - “清空分组数据”按 `groupId` 删除该组所有 `size + gameMode` 的成绩与 replay，保留分组和名称；确认框显示名称、编号和成绩条数。
  - 删除后清理 URL 中失效的 score id。
- 验收：删除后编号/统计/图表立即更新；清空分组后该组为空且分组仍存在；刷新一致。
- 依赖：P6-5、P9-2。

### P9-4 折线图

- [ ] 文件：`pages/stats.ts`、`ui/chart.ts`（按需）
- 内容：
  - 懒加载 ECharts。
  - 时间 + 步数双轴；数据来自 `buildChartSeries`。
  - 0/1 条成绩隐藏图表；resize 更新；销毁时 dispose。
- 验收：图表按需加载；切换筛选不重复初始化；无内存泄漏警告。
- 依赖：P4-3、P9-2。

### P9-5 成绩页 E2E

- [ ] 文件：`tests/e2e/stats.spec.ts`
- 内容：
  - 筛选、详情、删除、分组改名/清空、刷新、URL 恢复。
  - 图表出现/隐藏。
- 验收：Playwright 通过；用户手动验收。
- 依赖：P9-3、P9-4。

---

## P10 回放页

### P10-1 页面骨架与数据加载

- [ ] 文件：`puzzle-game/replay.html`、`src/games/puzzle/pages/replay.ts`、`styles/replay.css`
- 内容：
  - 解析 `?score=<id>`；加载 score + replay。
  - 缺失/损坏显示空状态和返回成绩页入口。
  - 初始化只读 board-view 和 timeline。
- 验收：合法 id 正常显示；非法 id 不崩溃。
- 依赖：P5-1、P6-5、P7-2。

### P10-2 播放器与控制

- [ ] 文件：`pages/replay.ts`
- 内容：
  - 播放/暂停、上一步/下一步、倍速列表、进度条。
  - rAF 驱动；倍速切换重锚；边界禁用按钮。
  - 键盘空格/左右方向键。
  - 时间/步数显示来自当前帧。
- 验收：倍速切换时间轴不跳变；暂停恢复不跳步；seek 准确。
- 依赖：P5-2、P10-1。

### P10-3 重玩、错误与 E2E

- [ ] 文件：`pages/replay.ts`、`tests/e2e/replay.spec.ts`
- 内容：
  - “重玩”跳转 `puzzle.html?retry=<id>`。
  - 回放数据损坏提示 issues，不崩溃。
  - E2E：打开回放、播放、暂停、改倍速、重玩。
- 验收：Playwright 通过；用户手动验收。
- 依赖：P10-2、P8-3。

---

## P11 文档、清理与最终验收

### P11-1 文档更新

- [ ] 文件：`README.md`、`docs/PUZZLE_GAME.md`、`docs/REFACTOR_PLAN.md`、`docs/PUZZLE_TASKS.md`
- 内容：
  - 更新拼图功能说明、存储键、URL 参数、固定分组与清空分组数据规则、三种着色模式与主题级 metrics、开发命令。
  - 标记任务完成状态。
  - 记录实际实现与本文档的差异。
- 验收：文档与新实现一致。

### P11-2 清理

- [ ] 文件：全仓库
- 内容：
  - 删除未使用的占位 CSS/HTML 片段和死代码。
  - 确认没有代码读取旧键 `config` / `scores` / `currentScore` / `currentScoreList`。
  - 检查没有重复的 board 渲染实现、没有每 tile 监听器。
  - 保留旧图片等运行时资源；不删除 `docs/images`。
- 验收：`rg` 搜索旧键只在 `data/legacy.ts` 出现；构建产物无多余依赖。

### P11-3 最终验收

- [ ] 文件：无（执行）
- 内容：
  - `npm test`、`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm run build`。
  - Playwright 冒烟测试。
  - 手动验收：
    - 2×2 / 4×4 / 10×10。
    - normal / blind。
    - click / slide / keyboard。
    - 内置降阶预设、三种着色模式、自定义主题复制/保存、主题级字号/间隙/圆角。
    - 成绩保存、统计、详情、删除。
    - 回放播放/暂停/倍速/seek、重玩不保存。
    - 刷新、URL 分享、浏览器后退。
    - 旧数据清理按钮。
- 验收：全部通过；用户确认后提交。

---

## 验收清单（手动）

- [ ] 首次打开游戏页，默认 4×4、normal、slide、G1（分组 ID 1）。
- [ ] 分组固定 10 个（ID 1–10）；可改名、允许重名，HUD 和成绩页显示名称。
- [ ] 清空分组数据只删除该组所有阶数/模式的成绩与回放，不删除分组和名称。
- [ ] 2×2、4×4、10×10 都能正常打乱、移动、复原。
- [ ] normal 第一次移动前计时为 0，移动后开始计时。
- [ ] blind 计时包含观察时间，第一次移动后隐藏数字，复原后恢复。
- [ ] click/slide/keyboard 都能完成一局；一次整行滑动按多步计数。
- [ ] 复原后棋盘锁定，不会重复保存。
- [ ] 成绩保存后刷新仍在；重玩同一打乱不新增成绩。
- [ ] 成绩页筛选、统计、高亮、详情、删除、清空分组正确；删除后不刷新页面也更新。
- [ ] 回放播放/暂停/上下一步/倍速/进度条正确；倍速变化不跳时间轴。
- [ ] 两套内置降阶主题可切换；自定义主题支持降阶/按行/固定色，颜色和 metrics 保存后刷新仍生效；切换主题不重开一局。
- [ ] 修改内置主题时先生成自定义副本，内置主题本身保持不变。
- [ ] 旧数据不读取；清理按钮只删旧键，不影响新数据。
- [ ] 移动端横屏可用；键盘可完成一局；无控制台错误。

## 提交节奏

- 每个任务完成后更新本文件状态，并运行该阶段验收命令。
- 一个任务一个提交，提交信息使用“英文前缀 + 中文内容”。
- 提交前必须由用户确认；不自动启动 dev server。
