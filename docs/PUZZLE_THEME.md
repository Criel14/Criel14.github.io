# 数字华容道游戏主题与按阶数分配（P8-4c）

> 状态：P8-4c-1 设置页主题列表已实现（2026-10-24），待手动验收；P8-4c-2 设计确认（2026-10-24），P8-4c-2a 领域模型与存储已实现并通过自动检查（2026-10-24），P8-4c-2b 设置页按阶数分配已实现并通过自动检查（2026-10-25），待手动验收；P8-4c-2d 主题编辑器已实现（2026-10-25，第 6 节），自动检查通过，待手动验收；P8-4c-2c 游戏页回退提示、P8-4c-2e 最终验收待开始。P8-4c-2 拆成 P8-4c-2a 领域模型与存储、P8-4c-2b 设置页按阶数分配、P8-4c-2c 游戏页按阶数解析、P8-4c-2d 主题编辑器、P8-4c-2e 测试与验收。P8-4c-2d 的界面已从早期“逐行色板列表”改为左右 `1 : 2` 的实时预览 + 油漆桶/吸管涂色，并加入 50 步撤销/重做。
>
> 分支：`refactor/vite-ts`
>
> 说明：本文件是游戏主题领域模型、按阶数分配、设置页主题列表和主题编辑器的单一设计来源。设置页外壳、分类导航、未保存提示条和全站偏好仍以 `docs/SETTINGS_PAGE.md` 为准；本文件只覆盖“设置 → 游戏主题”、主题数据与主题编辑器。

## 0. 背景与目标

游戏主题只控制棋盘上方块的外观，不控制网站深浅色、页面背景、按钮、弹框或棋盘外的边框。网站外观使用 `site.v1.preferences`，游戏主题使用 `puzzle.v2.appearance`，两者互不影响。

P8-4c-1 已经完成“一个主题对应一个当前选择”的列表：内置主题 + 自定义主题 + 加号卡，卡片用 radio 选中，10×10 预览。P8-4c-2 在此基础上做一次模型升级：

- 主题增加“支持的阶数”`supportedSizes`，默认全部 2–10；主题预览改为渲染其支持的最大阶数。
- 当前选择从单个 `activeThemeId` 改为按阶数分配 `themeIdBySize`，每个阶数独立选择主题。
- 主题增加逐块字体色 `fontPalette` 和方块内边框 `innerBorder`。
- 增加系统回退主题，用于主题损坏、版本不兼容、localStorage 不可用等异常，以及新建主题的初始外观。
- 盲玩隐藏数字的颜色默认改为 `#3498db`，并保留为主题字段。

目标：

- 改数据结构时保持概念清晰：主题能力、当前分配、异常回退三者分开。
- 设置页仍然使用“草稿 + 保存条”，不自动保存。
- 主题编辑器使用左侧控件 + 右侧实时预览，支持样式刷/油漆桶/吸管和 50 步撤销/重做；新建主题只在内存中生成草稿，未修改退出不创建主题。
- 主题预览与游戏页共用 `board-view` / `board.css`，颜色、字体、边框和 metrics 不漂移。
- 内置主题只读；自定义主题可编辑；自定义主题上限仍为 20。
- 主题名称在编辑器中限制 20 显示宽度（10 个汉字 / 20 个英文字母），允许重名。
- 运行时保持轻量，不引入新依赖；撤销历史只存在内存。

非目标：

- 不实现网站深色主题。
- 不实现中英文翻译。
- 不实现主题导入/导出、云同步、跨设备同步、排序或主题市场。
- 不做 v3 → v4 外观数据迁移；升级时清一次 `puzzle.v2.appearance`。
- 不做“按当时主题回放”；成绩和录像不保存主题快照。
- 不做主题删除 UI；如后续增加，删除规则见第 3.4 节。
- 不实现离开确认弹框；2026-10-25 确认，编辑器返回/刷新直接丢弃草稿，底部保存条是唯一提醒。

## 1. 任务拆分

### 1.1 P8-4c-1（已完成，待手动验收）

P8-4c-1 的历史实现：

- 设置页 `#game-theme` 从占位换成动态主题列表。
- 两套内置主题 + 自定义主题 + 加号卡；自定义主题上限 20。
- 主题卡用 radio 单选，右上角勾选；预览固定 10×10。
- 设置页保存主题选择，写入 `puzzle.v2.appearance`。
- 新增 `theme-editor.html` 占位页、`theme-preview`、`game-theme-picker`、`isAppearanceEqual`、`plus` / `pencil` 图标。

P8-4c-2 会替换 P8-4c-1 的“单主题 radio + 固定 10×10 预览”交互；P8-4c-1 的实现备注作为历史记录保留。

### 1.2 P8-4c-2 子任务

- **P8-4c-2a 领域模型与存储**
  - `Theme` 增加 `supportedSizes`、`fontPalette`、`innerBorder`；移除 `fontColor`。
  - `AppearanceState` 移除 `activeThemeId`，增加 `themeIdBySize`。
  - 新增回退主题、默认外观、回退外观、按阶数解析和分配纯函数。
  - `puzzle.v2.appearance` 升到 version 4；`puzzle.v2.settings` 保持 version 3。
  - 不做 v3 迁移；清理 `puzzle.v2.appearance` 后使用默认外观。
  - 更新 schema 校验、归一化、测试和存储文档。
- **P8-4c-2b 设置页按阶数分配**（已实现，待手动验收）
  - 主题卡改为按钮，点击打开“应用到”对话框。
  - 卡片预览改为支持的最大阶数；右上角显示覆盖阶数徽标。
  - 回退警告直接显示在主题卡网格上方；不提供“当前分配”9 格总览。
  - 对话框只列该主题支持的阶数；当前已应用的选中并锁定；`全选` 仅作批量勾选辅助。
  - 保存/重置/脏状态/焦点管理沿用设置页。
  - 回退主题警告和读取状态提示。
- **P8-4c-2c 游戏页按阶数解析**
  - 不再启动时固定一个主题；`replaceBoard(size)` 按当前阶数取主题。
  - 重玩使用成绩的阶数解析主题。
  - 回退主题提示。
  - 录像/成绩页后续实现时复用同一解析入口。
- **P8-4c-2d 主题编辑器**（已实现 2026-10-25，待手动验收）
  - 独立 `theme-editor.html` 真实页面；页头返回 + 标题“游戏主题设置” + 撤销/重做按钮。
  - 桌面端左右 `1 : 2` 布局：左侧名称/支持阶数/着色模式/样式刷/整盘样式，右侧最大支持阶数的实时预览。
  - 支持阶数使用 2×5 多选框，不提供“全选”；正在使用的阶数不能取消支持后保存。
  - 名称上限 20 显示宽度（10 个汉字或 20 个英文字母）；允许重名。
  - 油漆桶点击棋盘按层/行/单块涂色；吸管从棋盘读回当前组样式；悬停只高亮受影响方块。
  - 盲玩色、内边框、字号、间隙、圆角实时预览；空白色固定透明，不提供编辑。
  - 文字色全部使用明确颜色，不提供 auto；旧主题的 auto 在打开时转成黑/白。
  - 新建主题只在内存中复制回退主题，名称“新的主题”；未修改退出不创建主题。
  - 保存后停留在编辑器并更新 URL；新主题不自动分配阶数；不做离开确认。
  - 50 步撤销/重做，页头按钮 + 快捷键；重置可撤销；样式刷/吸管不进入历史。
- **P8-4c-2e 测试与验收**
  - 核心纯函数、schema、store 单测。
  - 设置页/编辑器手动验收；E2E 在 P8-6 补充。
  - 同步更新 `PUZZLE_STORAGE.md`、`PUZZLE_ARCHITECTURE.md`、`PUZZLE_GAME_PAGE.md`、`PUZZLE_TASKS.md`、`SETTINGS_PAGE.md`、`REFACTOR_PLAN.md`。

## 2. 领域模型

### 2.1 阶数

`PuzzleSize` 仍为 2–10。新增/复用一个统一的全部阶数常量：

```ts
export const PUZZLE_SIZES: readonly PuzzleSize[] = [2, 3, 4, 5, 6, 7, 8, 9, 10];
```

- `Theme.supportedSizes`、`AppearanceState.themeIdBySize`、设置页对话框和编辑器都使用同一顺序。
- 任何“全部阶数”的判断都以这 9 个值为准，不写死“10 个阶数”。

### 2.2 Theme

```ts
interface ColorModeFields {
  /**
   * 方块背景色。长度由 mode 决定：
   * - layer：18，索引 0–17 对应层 1–18；
   * - row：10，索引 0–9 对应数字块原本所属的第 1–10 行；
   * - fixed：99，索引 0–98 对应数字 1–99。
   */
  readonly palette: readonly string[];

  /**
   * 方块字体色。与 palette 等长，索引一一对应。
   * 每一项为 'auto' 或 '#rrggbb'。
   * 'auto' 根据该方块自己的背景色自动选黑/白。
   */
  readonly fontPalette: readonly string[];

  /** 空白块背景色；整盘统一。允许 'transparent' 或 '#rrggbb'。 */
  readonly blankColor: string;
}

interface LayerColorMode extends ColorModeFields {
  readonly mode: 'layer';
}

interface RowColorMode extends ColorModeFields {
  readonly mode: 'row';
}

interface FixedColorMode extends ColorModeFields {
  readonly mode: 'fixed';
}

type ColorMode = LayerColorMode | RowColorMode | FixedColorMode;

/** 方块内边框；整盘统一，不随数字变化。 */
interface ThemeInnerBorder {
  /** 'transparent' 或 '#rrggbb'。 */
  readonly color: string;
  /** 单边宽度 = 格子边长 × widthRatio；范围 0–0.1，0 表示无边框。 */
  readonly widthRatio: number;
}

interface Theme {
  readonly id: string;
  readonly name: string;
  readonly builtin: boolean;

  /**
   * 该主题设计上适配的阶数。
   * 非空、升序、去重，可以不连续；默认全部 2–10。
   * 不影响 palette / fontPalette 的长度。
   */
  readonly supportedSizes: readonly PuzzleSize[];

  readonly color: ColorMode;

  /** 方块内边框；整盘统一。 */
  readonly innerBorder: ThemeInnerBorder;

  /**
   * 盲玩隐藏数字时，所有非空方块的背景色。
   * 必须为 #rrggbb；默认 #3498db。空白块仍使用 blankColor。
   */
  readonly blindTileColor: string;

  /** 字号、间隙、圆角比例；整盘统一。 */
  readonly metrics: BoardMetrics;
}
```

### 2.3 逐块外观与整盘统一

按用户可定制维度分成两类：

| 维度 | 字段 | 粒度 |
| --- | --- | --- |
| 方块背景色 | `color.palette` | 逐块，索引由 mode 决定 |
| 方块字体色 | `color.fontPalette` | 逐块，与 `palette` 同索引 |
| 空白色 | `color.blankColor` | 整盘统一 |
| 盲玩隐藏色 | `blindTileColor` | 整盘统一 |
| 方块内边框 | `innerBorder` | 整盘统一 |
| 字号 / 间隙 / 圆角 | `metrics` | 整盘统一 |

明确约束：

- 一个主题只对应一种着色模式；切换模式就是换一个主题。
- 颜色绑定数字块，不绑定当前位置；打乱后颜色跟着数字移动。
- `palette` 和 `fontPalette` 的长度由 mode 决定，不由当前阶数或 `supportedSizes` 决定。小阶数只使用前几项。
- `blankColor` 只用于空白块。
- `fontPalette` 的空白块位置不使用，空白块字体始终透明。
- 盲玩模式下数字隐藏，`fontPalette` 不参与渲染。

### 2.4 逐块字体色

`fontPalette` 取代 P8-4c-1 的单个 `fontColor`。

- 长度：`layer 18`、`row 10`、`fixed 99`。
- 每一项：`'auto'` 或 `#rrggbb`。
- `'auto'`：用该方块背景色计算 WCAG 相对亮度，自动选择黑/白；复用现有 `getReadableFontColor`。
- 固定色：直接使用；编辑器可以提示对比度，但不强制。
- 内置主题：18 个 `#ffffff`，保持旧版白字视觉。
- 回退主题：18 个 `'auto'`；编辑器新建/打开主题时会转成显式黑/白，不再保留 auto。
- 取色索引与 `palette` 完全一致：`getPaletteIndex(tile, size, color)`。
- 归一化时：
  - `fontPalette` 缺失或长度不对 → 全部补 `'auto'`；
  - 单项非法 → `'auto'`；
  - `palette` 本身非法 → 丢弃主题（与旧规则一致）。

示例：

```ts
// layer 模式：第 1–3 层白字，第 4 层黑字，其余自动
fontPalette: ['#ffffff', '#ffffff', '#ffffff', '#000000', ...Array(14).fill('auto')];

// fixed 模式：数字 1 用白字，其余自动
fontPalette: ['#ffffff', ...Array(98).fill('auto')];
```

### 2.5 内边框

`innerBorder` 是**方块内部**的边框，不是棋盘外框，也不是 CSS `border`。

- 不改变方块外尺寸：方块在 grid 中的 track 仍是 `--cell-size`。
- 用 `padding` 预留边框占用，用 `inset box-shadow` 绘制边框；文字限制在 padding 内。
- 颜色：`'transparent'` 或 `#rrggbb`。
- 宽度：单边 `--cell-size × widthRatio`，范围 `0–0.1`；`0` 表示无边框。
- **边框颜色透明但 `widthRatio > 0` 时仍然占用内边距**，这样颜色和尺寸解耦，改颜色不会导致字号跳动；不需要占位时把宽度设为 0。
- 边框应用到所有方块，包括空白块；空白块没有文字，但会显示边框。
- 圆角仍按 `--cell-size × radiusRatio` 计算；内边框跟随圆角。
- 内置主题、回退主题、新建主题默认：`{ color: 'transparent', widthRatio: 0 }`。

#### 字号公式

P8-4c-1 的字号：

```text
fontSize = cellSize × fontSizeRatio
```

其中 `cellSize` 是扣掉所有 gap 后的单格边长。

加入内边框后：

```text
innerBorderWidth = cellSize × innerBorder.widthRatio
innerSize        = cellSize - 2 × innerBorderWidth
fontSize         = innerSize × fontSizeRatio
```

CSS 落点：

```css
.puzzle-board__grid {
  --gap-size: calc(100cqw / var(--board-size) * var(--tile-gap-ratio));
  --cell-size: calc(
    (100cqw - (var(--board-size) - 1) * var(--gap-size)) / var(--board-size)
  );

  /* 单边内边框宽度 */
  --tile-inner-border-width: calc(
    var(--cell-size) * var(--tile-inner-border-width-ratio, 0)
  );

  /* 去掉左右两条内边框后的可用边长 */
  --tile-inner-size: calc(
    var(--cell-size) - 2 * var(--tile-inner-border-width)
  );
}

.puzzle-board__tile {
  /* 用 padding 把文字限制在内边框里面；方块外尺寸不变 */
  padding: var(--tile-inner-border-width);

  /* 字号按内区域算 */
  font-size: calc(var(--tile-inner-size) * var(--tile-font-ratio));

  /* 内边框用 inset shadow 画，不参与布局 */
  box-shadow: inset 0 0 0
    var(--tile-inner-border-width)
    var(--tile-inner-border-color);
}
```

边界：

- `widthRatio = 0`：`padding: 0`、字号公式退化成原来的 `cellSize × fontSizeRatio`，内置主题和回退主题视觉不变。
- `widthRatio > 0`：字号自动缩小；用户可以在编辑器里调大 `fontSizeRatio` 补偿。
- `fontSizeRatio` 的范围仍是 0–1，但现在相对于“边框内区域”，不是整个格子。
- 字体色 `auto` 仍按方块背景色计算，不参与边框颜色。

### 2.6 BoardMetrics

| 字段 | 范围 | 含义 |
| --- | --- | --- |
| `fontSizeRatio` | 0–1 | 字号 = 边框内边长 × 比例 |
| `gapRatio` | 0–0.1 | 间隙 = 格子边长 × 比例 |
| `radiusRatio` | 0–0.5 | 圆角 = 格子边长 × 比例 |

- 读取时非数字、`NaN`、`Infinity` 回退默认值；有限但越界的值夹取到范围内。
- 默认值仍为 `0.5 / 0.03 / 0.04`（取自彩虹主题）。
- `innerBorder.widthRatio` 不属于 `BoardMetrics`，因为它同时带颜色；但归一化时使用同样的夹取逻辑。

### 2.7 AppearanceState

```ts
interface AppearanceState {
  /**
   * 每个阶数当前使用的主题 ID，9 个键必须齐全。
   * 正常情况下指向 themes 中的主题；
   * 数据异常时允许指向 FALLBACK_THEME_ID。
   */
  readonly themeIdBySize: Readonly<Record<PuzzleSize, string>>;

  readonly themes: readonly Theme[];
}

const FALLBACK_THEME_ID = 'fallback';
```

- 移除 `activeThemeId`；不再存在单一“当前主题”。
- `themes` 至少包含两套内置主题；自定义主题按存储顺序追加。
- 回退主题不在 `themes` 里，因此不会被渲染成卡片、不会被选择、不会被持久化。
- `themeIdBySize` 是唯一事实来源；某个主题“应用到哪些阶数”由它派生，不单独存储。
- 每个阶数同一时间只能有一个主题。

### 2.8 回退主题

```ts
const FALLBACK_THEME: Theme = {
  id: 'fallback',
  name: '回退主题',
  builtin: true,
  supportedSizes: [2, 3, 4, 5, 6, 7, 8, 9, 10],
  color: {
    mode: 'layer',
    palette: Array(18).fill('#3498db'),
    fontPalette: Array(18).fill('auto'),
    blankColor: 'transparent',
  },
  innerBorder: { color: 'transparent', widthRatio: 0 },
  blindTileColor: '#3498db',
  metrics: {
    fontSizeRatio: 0.5,
    gapRatio: 0.06,
    radiusRatio: 0,
  },
};
```

> 空白块仍使用 `blankColor: 'transparent'`；如果后续希望空白块也显示蓝色，再微调 `blankColor` 即可。非空方块全部是 `#3498db`。

用途：

- 某个阶数指向的主题不存在、已损坏、或不再支持该阶数 → 该阶数渲染回退主题。
- 整个 `AppearanceState` 损坏到无法恢复 → 所有阶数使用回退主题。
- localStorage 不可用 → 所有阶数使用回退主题。
- 外观版本不兼容（例如旧的 v3 数据）→ 使用回退主题并提示。
- 用户新建主题 → 编辑器初始 draft 复制回退主题，换新 id、`builtin: false`、名称“新的主题”；draft 只存在内存，保存后才写入 `themes`。
- **首次使用、键缺失** → 使用默认彩虹外观，不用回退主题；回退主题只用于异常或新建草稿。

约束：

- `FALLBACK_THEME_ID` 是保留 ID；自定义主题不能使用 `'fallback'`、`'rainbow'`、`'rainbow-soft'`。
- 回退主题 `builtin: true`，但不在 `BUILTIN_THEMES` 里；主题列表只遍历 `appearance.themes`。
- `themeIdBySize` 可以包含 `'fallback'`；这是合法的异常状态，不是用户可选择的目标。
- 回退主题的所有颜色/尺寸都是代码常量，修改后下次加载立即生效，不写存储。

### 2.9 内置主题

| id | 名称 | 模式 | supportedSizes | fontPalette | innerBorder | metrics |
| --- | --- | --- | --- | --- | --- | --- |
| `rainbow` | 彩虹 | `layer` | 全部 | 18 × `#ffffff` | transparent / 0 | `0.5 / 0.03 / 0.04` |
| `rainbow-soft` | 彩虹微调 | `layer` | 全部 | 18 × `#ffffff` | transparent / 0 | `0.5 / 0 / 0.01` |

- `DEFAULT_THEME_ID = 'rainbow'`。
- 两套内置主题都不可编辑、不可删除、不可覆盖。
- 内置主题始终以代码中的 canonical 版本为准；存储里的同名主题读取时会被替换。
- 两套内置主题的 `blindTileColor` 使用新的默认值 `#3498db`。
- 用户要调整内置主题的颜色、字体色、边框或 metrics 时，复制为自定义主题再编辑。

### 2.10 自定义主题

- `builtin: false`。
- `id` 非空字符串，不能与内置主题 ID、回退主题 ID 或其他主题重复；新建时生成唯一 ID。
- `name` `trim()` 后非空；编辑器限制 20 显示宽度（10 个汉字 / 20 个英文字母），允许重名；数据层保持宽松以兼容旧数据。
- `supportedSizes` 非空、升序、去重；默认全部 2–10。
- 可以使用 `layer` / `row` / `fixed` 任意一种模式。
- `palette` / `fontPalette` 长度必须与 mode 匹配。
- `innerBorder` 和 `blindTileColor` 统一作用于整盘。
- 最多 20 个。`CUSTOM_THEME_SLOT_COUNT = 20` 是数据校验和 UI 的共同上限。
- 归一化时非法 palette、非法颜色、重复 ID、内置/回退 ID 和 `builtin: true` 的主题会被丢弃；可恢复的 `fontPalette`、`innerBorder`、metrics、空白色和盲玩色按规则回退。
- 自定义主题按存储顺序展示；不保存预览 DOM、卡片顺序或 UI 状态。

### 2.11 不变量

- `name`：`trim()` 后非空；编辑器限制 20 显示宽度；允许重名。
- `id`：非空、唯一，不能使用内置 ID 或回退 ID。
- `supportedSizes`：非空、每一项是 2–10 的整数、升序、去重。
- `palette`：长度等于 mode 约定值，全部为 `#rrggbb`。
- `fontPalette`：长度等于 `palette`，每一项为 `'auto'` 或 `#rrggbb`。
- `blankColor`：`'transparent'` 或 `#rrggbb`。
- `innerBorder.color`：`'transparent'` 或 `#rrggbb`。
- `innerBorder.widthRatio`：0–0.1 的有限数。
- `blindTileColor`：`#rrggbb`。
- `metrics`：在约定范围内；读取时归一化。
- `themeIdBySize`：9 个键齐全，值为非空字符串。
- 对每个阶数，`themeIdBySize[size]` 要么是 `'fallback'`，要么能解析到 `themes` 中一个 `supportedSizes` 包含该阶数的主题。
- `themes` 至少包含两套内置主题；自定义主题不超过 20 个。
- 任何写操作返回新对象；不原地修改内置主题常量或调用方传入的对象。
- `isAppearanceEqual` 比较 `themeIdBySize`、主题顺序、全部主题字段（含 `supportedSizes`、`fontPalette`、`innerBorder`、`blindTileColor`、metrics）。

### 2.12 不属于 Theme 的数据

- 网站深浅色、语言：`site.v1.preferences`。
- 拼图阶数、游戏模式、操作模式、当前分组、自定义光标、极简 UI：`puzzle.v2.settings`。
- 成绩、录像：IndexedDB `puzzle.v2`。
- 主题只影响方块本身；页面背景、文字、按钮、边框和弹框使用 `src/shared/styles/base.css` 的语义 token。

## 3. 按阶数分配

### 3.1 三个概念

| 概念 | 存储/来源 | 含义 |
| --- | --- | --- |
| 支持阶数 | `Theme.supportedSizes` | 这个主题设计上可以用于哪些阶数 |
| 当前分配 | `AppearanceState.themeIdBySize` | 每个阶数现在使用哪个主题 |
| 覆盖范围 | 派生值 | 某个主题当前实际覆盖哪些阶数 |

**主题支持 10×10，不代表它当前被应用到 10×10。** 主题卡片的覆盖徽标显示“当前分配”，不是“支持范围”；支持范围在“应用到”对话框和编辑器里体现。

### 3.2 应用规则

假设主题 A 覆盖全部，主题 B 支持 10×10。用户把 B 应用到 10×10：

```ts
themeIdBySize[10] = 'B';
```

结果：

- B 的覆盖范围：`[10]`
- A 的覆盖范围自动变成：`[2,3,4,5,6,7,8,9]`
- **A 的 `supportedSizes` 仍然是全部 2–10，不修改。**

覆盖范围永远从 `themeIdBySize` 派生，不单独存一份 `themeCoverage`。派生时按“解析后”的主题计算：指向缺失主题、主题不支持该阶数或值为回退 ID 的阶数，都算回退主题覆盖，不计入任何真实主题。这样不会出现“支持范围”和“覆盖范围”两份数据不同步。

### 3.3 每个阶数始终有且只有一个主题

因为 `themeIdBySize` 有 9 个键，所以不存在“未分配”状态。由此得到设置页对话框的约束：

- 已属于该主题的阶数：选中并锁定，不能直接取消。
- 属于其他主题的阶数：可以勾选，勾选后会替换原主题。
- 主题不支持的阶数：不出现在对话框里。
- 至少选择一个；没有选择时“确定”禁用。

如果用户想让 10×10 从 A 换到 B，正确操作是打开 B 的对话框，把 10×10 选上；不要打开 A 取消 10×10。取消后 10×10 没有主题可用，只能落到回退主题，反而制造异常状态。

### 3.4 主题删除、支持范围缩小与不可解析

- 主题被删除：受影响的阶数使用回退主题，直到用户重新选择。
- 主题的 `supportedSizes` 缩小：不再支持的阶数使用回退主题。
- `themeIdBySize` 指向不存在的主题，或主题不支持该阶数：使用回退主题。
- 不做“自动回到上一个主题”的历史记录。存储里没有 per-size 的历史栈；如需撤销，需要额外字段，当前不做。
- 主题删除 UI 当前不存在；如果后续增加，删除一个仍被使用的主题必须先让用户确认，受影响阶数落到回退主题。

### 3.5 回退状态提示

- 设置页：存在使用回退主题的阶数时，在主题卡网格上方显示警告并列出阶数；不再提供“当前分配”总览。
- 游戏页：加载时如果存在回退阶数，显示非阻塞提示；不要只靠棋盘变蓝让用户猜。
- 读取状态为 `corrupt` / `unavailable` / 版本不兼容时，顶部 banner 与回退提示可以同时存在；文案不要重复堆叠。

## 4. 存储

### 4.1 位置与 envelope

```text
localStorage key: puzzle.v2.appearance
envelope: { version: 4, data: AppearanceState }
```

- 读取使用 `loadAppearanceResult()`，返回 `ok` / `missing` / `corrupt` / `unavailable` 和一份可用的 `AppearanceState`；`corrupt` 时另带 `issue`，用于区分版本不兼容与普通数据损坏。
- 写入使用 `saveAppearance()`，写入前统一归一化。
- 不新增 localStorage key，不修改 IndexedDB store。
- 设置继续使用 `puzzle.v2.settings`，version 3。

### 4.2 版本拆分与清缓存

- `APPEARANCE_SCHEMA_VERSION = 4`。
- `SETTINGS_SCHEMA_VERSION = 3`。
- 两个 store 独立演进，不再共用一个 `SCHEMA_VERSION`；外观升级不会连带重置设置/分组。
- **不做 v3 → v4 迁移。** 升级后清一次 `puzzle.v2.appearance`：
  - 清掉后键缺失，使用默认彩虹外观；
  - 不清时 v3 数据按版本不兼容处理，使用回退主题并提示；
  - 自定义主题会随 v3 数据一起丢弃，这是本轮明确接受的代价；
  - `puzzle.v2.settings`、`site.v1.preferences`、IndexedDB 不受影响。
- `puzzle.v2.appearance` 键名不变；“v2”是存储代际，不是 envelope 版本。
- 旧版 `config` / `scores` / `currentScore` / `currentScoreList` 仍不读取，只提供显式清理入口。

### 4.3 JSON 示例

```json
{
  "version": 4,
  "data": {
    "themeIdBySize": {
      "2": "rainbow",
      "3": "rainbow",
      "4": "rainbow",
      "5": "rainbow",
      "6": "rainbow",
      "7": "rainbow",
      "8": "rainbow",
      "9": "rainbow",
      "10": "custom-10"
    },
    "themes": [
      {
        "id": "custom-10",
        "name": "只用于 10×10",
        "builtin": false,
        "supportedSizes": [10],
        "color": {
          "mode": "layer",
          "palette": ["#e74c3c", "...18 项"],
          "fontPalette": ["#ffffff", "...18 项"],
          "blankColor": "transparent"
        },
        "innerBorder": {
          "color": "#ffffff",
          "widthRatio": 0.02
        },
        "blindTileColor": "#3498db",
        "metrics": {
          "fontSizeRatio": 0.5,
          "gapRatio": 0.03,
          "radiusRatio": 0.04
        }
      }
    ]
  }
}
```

内置主题不会出现在存储的 `themes` 里；读取时由代码补上 canonical 版本。

### 4.4 归一化与损坏修复

`normalizeAppearance(raw)`：

1. 内置主题始终使用代码中的 canonical 版本，`supportedSizes` 全部。
2. 自定义主题：
   - `builtin` 必须是 `false`；
   - `id` 不能是内置 ID 或 `'fallback'`；
   - `name` `trim()` 后非空；
   - `supportedSizes` 非法或为空 → 丢弃主题；
   - `palette` 长度/颜色非法 → 丢弃主题；
   - `fontPalette` 缺失/长度不对 → 全部补 `'auto'`；单项非法 → `'auto'`；
   - `blankColor` 非法 → `transparent`；
   - `innerBorder` 缺失/非法 → `{ transparent, 0 }`；宽度越界夹取；
   - `blindTileColor` 非法 → `#3498db`；
   - `metrics` 按 `normalizeMetrics` 修复；
   - 重复 ID、内置 ID、回退 ID → 丢弃。
3. 最多保留前 20 个合法自定义主题。
4. `themeIdBySize`：
   - 每个阶数优先使用存储中的 ID；
   - 只有该 ID 能找到主题、且主题的 `supportedSizes` 包含这个阶数时才有效；
   - 否则使用 `FALLBACK_THEME_ID`；
   - 缺失键、非字符串值、未知 ID 都按回退处理。
5. 返回 `{ themeIdBySize, themes }`，不修改入参。

读取状态：

- `missing`：首次使用，默认彩虹外观，静默。
- `corrupt`：JSON 可解析但 schema 不合法；尽量保留可恢复的自定义主题，非法阶数使用回退主题，页面提示。
- `unavailable`：localStorage 不可用；使用回退外观，页面提示。
- 版本不兼容（v3 或其他版本）：使用回退外观，页面提示清理 `puzzle.v2.appearance`。

### 4.5 容量

- `fixed` 模式最重：99 个背景色 + 99 个字体色，约 2KB/主题。
- 20 个自定义主题约 40KB，加上 `themeIdBySize` 和边框字段，仍远低于 localStorage 常见配额。
- 内置主题不落库；回退主题不落库。
- 主题数据不是性能瓶颈；设置页渲染 22+ 张卡片的预览是主要成本，必要时给卡片加 `content-visibility`。

### 4.6 多标签页

- 不做多标签页实时同步。
- 设置页保存和编辑器保存都会写入完整的 `AppearanceState` 快照。
- 两个页面同时打开并分别保存时，按最后一次写入覆盖，不做合并。
- 已知取舍：一个标签页改了主题分配，另一个标签页仍显示旧快照；刷新后以最新存储为准。

## 5. 设置页主题列表与按阶数分配（P8-4c-2b）

### 5.1 信息架构

设置页外壳、左侧导航、`#game-theme` hash、底部保存条不变。替换“游戏主题” section 的内容：

```text
游戏主题
为每个阶数选择棋盘主题。点击主题卡选择要应用的阶数；内置主题不可编辑，自定义主题可以调整颜色、字体、边框、字号、间隙与圆角。

[回退警告（仅异常时）]

┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
│  10×10     │ │  10×10     │ │  10×10     │ │            │
│  已复原棋盘 │ │  已复原棋盘 │ │  已复原棋盘 │ │     +      │
│     所有阶数│ │      2–9 阶 │ │      10 阶  │ │            │
│ 彩虹   内置 │ │ 彩虹微调 内置│ │ 我的主题 ✎ │ │            │
└────────────┘ └────────────┘ └────────────┘ └────────────┘
```

> 示意图里的 `10×10` 表示“该主题支持的最大阶数”；如果主题只支持到 9×9，预览就是 9×9。覆盖徽标是另一回事。

- 内置主题在前，自定义主题按存储顺序在后，最后是加号卡。
- 回退警告直接位于主题卡网格上方；主题卡网格由 controller 从 `draft` 渲染。
- 不再提供“当前分配”9 格总览；每个阶数的当前主题由卡片覆盖徽标和对话框勾选状态表达。
- 回退主题不出现在卡片列表里；异常阶数由回退警告列出。

说明文案：

> 为每个阶数选择棋盘主题。点击主题卡选择要应用的阶数；内置主题不可编辑，自定义主题可以调整颜色、字体、边框、字号、间隙与圆角。

### 5.2 当前分配展示（已移除）

- 2026-10-25 调整：移除“当前分配”9 格总览，避免设置页信息重复和视觉杂乱。
- 当前每个阶数使用哪个主题，通过卡片右上角覆盖徽标和“应用到”对话框的勾选/锁定状态查看。
- 存在回退阶数时仍显示文字警告并列出完整阶数；不恢复总览。

### 5.3 主题卡

主题卡不再是 radio；每张卡是一个“打开应用到对话框”的按钮。

结构：

```html
<div class="theme-card theme-card--game" data-theme-id="rainbow">
  <div class="theme-card__surface">
    <div class="theme-card__preview" aria-hidden="true">
      <!-- 支持的最大阶数棋盘 -->
    </div>
    <span class="theme-card__coverage" aria-hidden="true">所有阶数</span>
    <div class="theme-card__footer">
      <span class="theme-card__title" title="彩虹">彩虹</span>
      <span class="settings-badge">内置</span>
    </div>
  </div>
  <button
    class="theme-card__hitarea"
    type="button"
    aria-haspopup="dialog"
    aria-label="彩虹，内置主题，已应用到所有阶数；打开应用到对话框"
  ></button>
  <!-- 自定义主题才有编辑按钮 -->
  <a class="theme-card__edit" href="/puzzle-game/theme-editor.html?theme=custom-1"
     aria-label="编辑主题：我的主题" title="编辑主题">✎</a>
</div>
```

要点：

- 预览尺寸 = `Math.max(...theme.supportedSizes)`；不再固定 10×10。
- 覆盖徽标放在卡片右上角，沿用现有卡片高度；`pointer-events: none`，点击穿透到 hitarea。
- 卡片处于“使用中”（覆盖至少一个阶数）时使用主题蓝边框/浅蓝背景；未使用时不加覆盖徽标。
- 只有自定义主题显示铅笔编辑按钮；内置主题在 footer 显示“内置”。
- 加号卡仍跳转 `theme-editor.html`；达到 20 个时禁用并提示。
- 编辑按钮 z-index 高于 hitarea，点击编辑不会打开对话框。
- 预览使用 `ui/theme-preview.ts` + `board-view` + `board.css`，与游戏页共享颜色、字体、边框和 metrics。

### 5.4 覆盖徽标

徽标显示该主题**当前应用到的阶数**，不是支持范围。

| 覆盖情况 | 文案 | 示例 |
| --- | --- | --- |
| 全部 9 个阶数 | `所有阶数` |  |
| 1 个阶数 | `4 阶` |  |
| 1 段连续区间 | `2–9 阶` |  |
| 2 段区间 | `2–4、8–10 阶` |  |
| 3 段及以上 | `N 个阶数` | `5 个阶数` |
| 没有覆盖 | 不显示徽标；aria 中说“未应用” |  |

- `所有阶数` 只在覆盖全部 9 个阶数时出现；只覆盖某主题支持的全部阶数、但没覆盖 10×10 时，仍显示实际范围（例如 `2–9 阶`）。
- 完整阶数列表放在徽标的 `title` 和按钮的 `aria-label` 中，例如“已应用到 2×2、3×3、4×4……”。
- 对话框内的尺寸标签用 `2×2`、`4×4`；卡片徽标用 `4 阶`、`2–9 阶`，节省空间。
- 徽标只是状态摘要，不参与选择。

### 5.5 “应用到”对话框

对话框只列**该主题支持的阶数**；不再显示“已应用/将应用”等状态行，也不显示当前主题名或替换警告。

```text
┌ 请选择应用的阶数 ──────────────┐
│ [2×2] [3×3] [4×4] [5×5] [6×6] │
│ [7×7] [8×8] [9×9] [10×10] [全选]│
│                               │
│                     [取消] [确定]│
└───────────────────────────────┘
```

交互：

- 主题支持全部 9 个阶数时就是 2 行 × 5 列；只支持 8–10 时只有 3 个选项 + `全选`。
- 当前已属于该主题的阶数：选中 + `disabled`，锁定不可取消。
- 其他支持的阶数：可勾选；勾选后确认即替换原主题。
- `全选` 是辅助按钮，选择该主题支持的全部阶数；已经全选时禁用或 no-op。只有一个支持阶数时隐藏 `全选`。
- 不显示“已应用/将应用/将替换”等文字；当前状态由勾选和禁用表达。
- 没有任何选中项时“确定”禁用。
- 确认只更新设置页 draft，不直接写 localStorage；关闭后底部保存条出现，用户再点“保存”。
- 取消、Esc、关闭按钮都丢弃本次对话框修改。
- 使用原生 `<dialog>`，复用 `ui/dialog.ts` 的 `createDialog`；设置页需要加载 `overlays.css` 或拆分出的 `dialog.css`。
- 对话框 `title` 固定为“请选择应用的阶数”；正文只有阶数网格；省略额外说明。
- 阶数选项隐藏原生 checkbox，视觉上整块 label 就是勾选目标；保留 checkbox 语义、键盘操作和禁用状态。
- 对话框容器、阶数选项以及取消/确定按钮沿用设置页的浮起表面、扁平高光和按钮样式；标题与按钮区不画分隔横线。
- 对话框和保存条的出现/消失都使用 160ms 淡入淡出 + 轻微位移动画；对话框在退场结束后才移除 DOM；`prefers-reduced-motion` 下关闭动画。
- 初始焦点放在第一个可勾选选项；没有可勾选项时放到“确定”。
- 对话框关闭后，如果卡片重渲染，焦点回到对应主题卡的新 hitarea。

### 5.6 保存、重置与脏状态

设置页维护 `saved` / `draft` 两份 `AppearanceState`：

- 启动时使用 `loadAppearanceResult()` 的归一化结果。
- 打开对话框并确认后：`draft = assignThemeToSizes(draft, themeId, selectedSizes)`。
- 只更新 `themeIdBySize`，不修改主题的 `supportedSizes`。
- `isDirty` 使用 `isAppearanceEqual(saved, draft)`，比较 `themeIdBySize` 和全部主题字段。
- 底部保存条出现/消失、重置、保存失败保留 draft，沿用现有设置页逻辑。
- “重置”恢复 `saved`，不写 localStorage。
- “保存”调用 `saveAppearance(draft)`；成功后用归一化结果更新 `saved` / `draft` 并重新渲染卡片和回退警告。
- 保存后如果仍有回退阶数，警告继续显示；不会因为保存成功而隐藏。
- 设置页只负责“选择主题/分配阶数”；主题内容编辑在独立编辑器页。
- 返回游戏页后重新加载 `puzzle.v2.appearance`，新分配才会生效；设置页内修改不即时影响游戏页。

### 5.7 读取状态与回退提示

- `missing` / `ok`：静默；`missing` 使用默认彩虹外观。
- `corrupt`：读取结果的 `issue` 区分普通损坏和版本不兼容。普通损坏提示已尽量恢复；v3/未知版本提示清理 `puzzle.v2.appearance`。两种情况下，回退警告都会列出使用回退主题的阶数。
- `unavailable`：顶部 banner 提示存储不可用；主题列表仍渲染，使用回退外观；保存失败在保存条显示。
- 版本不兼容：提示清理 `puzzle.v2.appearance`；页面使用回退外观。
- 只要 `draft` 中存在回退阶数，就在主题卡网格上方显示警告；用户为这些阶数选择真实主题后警告消失。

### 5.8 响应式与可访问性

- 主题卡网格 `repeat(auto-fit, minmax(15rem, 1fr))`；大屏 3 列，中等 2 列，窄屏 1 列。
- 主题卡、编辑按钮、加号卡都可点；不出现横向滚动。
- 主题卡是原生 `<button>` 覆盖层，支持 Tab、Enter、Space 打开对话框；不再使用 radio 语义。
- 每个按钮的 `aria-label` 包含主题名、内置/自定义、覆盖范围；徽标视觉文本 `aria-hidden`。
- 对话框使用原生 checkbox + label，但 checkbox 视觉隐藏；`全选` 是独立按钮，有可读标签。
- 回退状态不只靠颜色，必须有文字“回退主题”。
- 焦点环落在卡片表面或 hitarea 上；对话框关闭后焦点回到触发卡片。
- 尊重 `prefers-reduced-motion`；沿用设置页现有规则。

## 6. 主题编辑器（P8-4c-2d）

> 状态：已实现（2026-10-25），自动检查通过，待手动验收。本节描述最终交互，不再沿用早期“逐行色板列表 + 批量填充”的编辑器方案。

### 6.1 页面与路由

```text
/puzzle-game/theme-editor.html                  新建主题
/puzzle-game/theme-editor.html?theme=<themeId>  编辑自定义主题
```

- 页面 `h1` 固定为“游戏主题设置”；返回链接固定指向 `/puzzle-game/settings.html#game-theme`。
- 新建不写 URL 参数；保存成功后使用 `history.replaceState` 改为 `?theme=<id>`，继续停留在编辑器，不自动返回设置页。
- 内置主题没有编辑入口；`?theme=rainbow`、`?theme=rainbow-soft`、`?theme=fallback` 都视为非法编辑目标。
- 不存在的主题 ID、非法参数、损坏且无法解析的目标主题，都显示非阻塞错误和返回设置页入口，不渲染可编辑控件，也不崩溃。
- 新建时如果自定义主题已达 20 个，页面直接显示上限提示，不生成可保存的草稿。
- 读取 `loadAppearanceResult()`；`corrupt` / `unavailable` / 版本不兼容时显示页面顶部 banner，文案和设置页一致。
- 页面加载 `base.css`、`settings.css`、`board.css`、`overlays.css` 和 `theme-editor.css`；不加载 `game.css`。
- 编辑器不导入游戏 session、输入、计时、成绩、录像、图表或 IndexedDB。

### 6.2 布局

```text
┌────────────────────────────────────────────────────────────┐
│ [←]  游戏主题设置                           [↶] [↷]        │
├──────────────────────────┬─────────────────────────────────┤
│ 名称                     │ 预览                            │
│ [新的主题            ]   │ ┌───────────────────────────┐   │
│ 8 / 20 字宽              │ │                           │   │
│                          │ │       已复原棋盘          │   │
│ 支持阶数                 │ │                           │   │
│ [2][3][4][5][6]          │ │                           │   │
│ [7][8][9][10]            │ └───────────────────────────┘   │
│                          │                                 │
│ 着色模式                 │                                 │
│ [按层][按行][全自定义]   │                                 │
│                          │                                 │
│ 样式刷                   │                                 │
│ 背景 [■] 文字 [■]        │                                 │
│ [油漆桶] [吸管]          │                                 │
│                          │                                 │
│ 整盘样式                 │                                 │
│ 盲玩色 [■]               │                                 │
│ 内边框 [透明] 宽 0%      │                                 │
│ 字号 50% 间隙 6% 圆角 0% │                                 │
└──────────────────────────┴─────────────────────────────────┘
            [你有未保存的修改。]  [重置] [保存]
```

- 页面背景、卡片表面、按钮、保存条、警告条和焦点样式沿用设置页的视觉 token 与浮起表面。
- 桌面端主体是两栏卡片，宽度比约 `1 : 2`；左侧是可滚动的控制区，右侧是 `position: sticky; top: 24px;` 的预览卡。
- 预览棋盘限制在约 `34rem`，不铺满右侧整栏；具体尺寸以实际视觉验收为准。
- 界面上不显示操作说明、悬停数量或预览解释文字；控件自身和错误提示承担全部信息，保持简洁。
- 窄于 900px 时改为单列，预览放在控制区上方；预览宽度自适应，不出现横向滚动。
- 底部保存条复用 `.settings-savebar`，只有 `dirty` 时显示；文案、重置、保存和错误提示行为与设置页一致。
- 页头右侧放置撤销/重做图标按钮；没有可撤销/重做操作时禁用，并保留可见的禁用态。
- 新建和编辑共用同一页面结构，只在标题辅助信息、初始基线、保存方式和 URL 上有差异。

### 6.3 状态模型

```ts
type ThemeEditorKind = 'new' | 'edit';
type ThemeEditorTool = 'bucket' | 'eyedropper';

interface ThemeBrush {
  /** 方块背景色，必须是 #rrggbb。 */
  readonly background: string;
  /** 方块文字色，必须是 #rrggbb；编辑器不再使用 auto。 */
  readonly fontColor: string;
}

interface ThemeEditorState {
  readonly kind: ThemeEditorKind;
  readonly themeId: string;
  /** 上次保存成功的主题；新建时是“新的主题 + 回退样式”的初始 draft。 */
  readonly baseline: Theme;
  /** 当前编辑中的主题；所有控件和预览只读这一份。 */
  readonly draft: Theme;
  /** 当前样式刷；不属于 Theme，不写存储、不参与脏状态和历史。 */
  readonly brush: ThemeBrush;
  readonly tool: ThemeEditorTool;
}
```

- `baseline` / `draft` 都使用 `prepareThemeForEditor()` + `cloneTheme()`；该函数把旧数据里的 `auto` 字体色转成明确黑/白，并把空白色固定为 `transparent`。
- 禁止原地修改 `FALLBACK_THEME`、内置主题或存储中的对象。
- `dirty = !isThemeDirty(baseline, draft)`；名称首尾空格在比较前按 `trim()` 处理。
- `brush`、`tool` 只影响编辑体验，不进入主题、存储或脏状态。
- 不支持在一个主题里混用多种着色模式；模式是 `Theme.color.mode` 的一部分。
- **不升级 schema**：`Theme` / `AppearanceState` 字段不变，`APPEARANCE_SCHEMA_VERSION` 仍为 4；`auto` 与 `blankColor` 继续为旧数据保留，但编辑器不再提供编辑入口。

### 6.4 新建、保存、重置与离开

#### 6.4.1 新建

- 打开新建页时只在内存中生成 draft：`prepareThemeForEditor(createCustomThemeDraft(id, '新的主题'))`，复制 `FALLBACK_THEME`、换新 ID、`builtin: false`，并把旧 `auto` 字体色转成显式白色、空白色固定透明。
- **此时不写 localStorage，也不把主题加入 `AppearanceState.themes`。**
- 初始 `baseline = draft`，`dirty = false`，底部保存条不显示。
- 用户没有做任何修改就返回/刷新/关闭页面时，不产生任何主题，也不留下“新的主题”空壳。
- 不使用“先持久化再删除”的方案，避免关闭标签页、崩溃和多标签页留下幽灵数据。

#### 6.4.2 保存

“保存”按以下顺序执行：

1. 校验名称、`supportedSizes`、`palette` / `fontPalette` 长度、颜色格式、`innerBorder`、`metrics`、主题数量、ID 冲突和“正在使用的阶数不能取消支持”。
2. 将 `draft` 合并回完整的 `AppearanceState`：保留 `themeIdBySize` 和其他主题；新增时追加到自定义主题列表，编辑时替换同 ID 主题。
3. 调用 `saveAppearance(nextAppearance)`，写入完整外观快照。
4. 成功后 `baseline = cloneTheme(normalizedDraft)`、`draft = cloneTheme(normalizedDraft)`，保存条隐藏。
5. 新建保存成功后 `kind = 'edit'`，用 `history.replaceState` 把 URL 改为 `?theme=<id>`；刷新后进入编辑模式，而不是再次新建。
6. 通过 live region 宣布“主题已保存”；不自动返回设置页。

- 保存失败保留 draft 和保存条，在保存条内显示错误；不清空用户修改。若 `upsert` 因 20 个上限、保留 ID 或其他并发冲突没有实际写入，也按保存失败处理，不假装成功。
- 保存后**不自动分配阶数**；用户回设置页通过“应用到”对话框自行选择。
- 保存不会清空撤销/重做历史；之后撤销会让主题重新变为未保存状态，保存条再次出现。
- 不允许在每次选色、拖动滑杆或输入名称时直接调用 `saveAppearance()`。

#### 6.4.3 重置

- 重置把 `draft` 恢复为 `baseline`：新建时回到“新的主题 + 回退样式”，编辑时回到上次保存的版本。
- 重置只改页面状态，不写 localStorage。
- 重置本身作为一步可撤销操作；撤销后可以恢复重置前的内容。
- 重置后 `dirty = false`，保存条消失；如果继续修改，保存条重新出现。

#### 6.4.4 离开

- **不做离开确认弹框，也不注册 `beforeunload`。** 2026-10-25 确认：底部保存条是唯一提醒。
- 点击返回、浏览器后退、刷新、关闭标签页都直接丢弃 draft。
- 新建且没有修改时离开：不创建主题。
- 新建且修改后离开：丢弃草稿，不创建主题。
- 编辑已有主题后离开：保留上次保存的版本，未保存修改丢失。
- 设置页从编辑器返回时处理 bfcache：如果 `pageshow` 的 `event.persisted` 为 true，重新读取外观并重渲染主题列表，避免显示旧数据。
- 编辑器自身从 bfcache 恢复时重新加载页面，避免前进/后退把未保存草稿原样带回来；重新加载后按 URL 的 `?theme` 进入编辑或新建模式。
- 多标签页不做实时同步，仍按最后写入覆盖；编辑器保存完整 `AppearanceState`，不与其他标签页合并。

### 6.5 主题名称

- 名称输入框位于左侧控制区最上方，默认值“新的主题”。
- 名称保存前 `trim()`，不能为空；展示时使用省略号 + `title`，不破坏卡片布局。
- 编辑器限制为 **20 个显示宽度单位**：
  - 汉字、全角标点、日文假名、韩文、emoji 等宽字符按 2 计；
  - 英文字母、数字、空格、西里尔字母、阿拉伯字母等按 1 计；
  - 按 grapheme cluster 计数，可用 `Intl.Segmenter`，不可用时退化为按 code point 计数；
  - 宽字符可用 Unicode East Asian Width 的 `F` / `W` 类别，或等价的范围判断；emoji 序列整体按 2 计；
  - 因此最多是 10 个汉字或 20 个英文字母；混合文本按实际显示宽度计算。
- 输入框旁显示 `当前宽度 / 20`，超限时显示红色错误文案，保存时阻止并聚焦名称输入框。
- 名称允许重复；ID 才是主题身份。数据层只要求 `trim()` 后非空，不强制 20 显示宽度，避免旧数据或手工写入数据被直接丢弃；长度限制由编辑器负责。
- 修改名称计入脏状态和撤销历史。

### 6.6 支持阶数

- 使用 2×5 的 9 个多选框：2×2–10×10；**不提供“全选”按钮**，减少视觉杂乱。
- 至少选择一个阶数；取消最后一个阶数时立即恢复并提示。
- 已保存的主题如果正在被某些阶数使用，对应阶数显示“使用中”提示。
- 允许取消勾选正在被使用的阶数，但立即显示错误并阻止保存，直到重新勾选或回设置页为这些阶数选择其他主题。
- 新增支持阶数不冲突，直接允许。
- 预览阶数 = `Math.max(...supportedSizes)`；取消最大阶数后预览自动降级。支持阶数不改变 `palette` / `fontPalette` 的固定长度。
- 缩小支持范围不会截断 palette；隐藏的层/行/数字颜色仍保留，之后扩大支持范围时继续使用。
- 修改支持阶数计入脏状态和撤销历史。

### 6.7 着色模式与涂色

#### 6.7.1 模式

UI 使用三个分段选项：

| UI 文案 | `color.mode` | 点击一个方块影响的范围 |
| --- | --- | --- |
| 按层 | `layer` | 该数字所在的旧版 L 形层，整层一起变色 |
| 按行 | `row` | 该数字在已复原棋盘中原本所属的行，整行一起变色 |
| 全自定义 | `fixed` | 只影响该数字自己 |

- “按层”对应文档中的“降阶”（`layer`），继续使用 `getTileLayer()` 的 L 形分层，不改同心环；2×2 为 2 层，10×10 为 18 层。
- 一个主题只能对应一种模式；切换模式会改变模式的语义和 palette 的长度。
- 切换模式时按索引保留重叠部分：`layer` 18、`row` 10、`fixed` 99；新模式多出来的背景色补 `#3498db`，字体色补默认蓝对应的白色 `#ffffff`。切换本身计入历史。
- 颜色始终绑定数字，不绑定棋盘位置；编辑器预览使用已复原棋盘，游戏页打乱后颜色跟随数字移动。

#### 6.7.2 样式刷

- 样式刷由背景色和文字色组成，两者都必须是明确的 `#rrggbb`；编辑器不提供“自动”文字色。
- 打开主题时，旧数据里的 `fontPalette: 'auto'` 由 `prepareThemeForEditor()` 转成当前背景对应的黑/白，保证编辑器里所有颜色都是具体值。
- 左侧样式刷旁显示一个迷你方块预览，实时展示当前背景与文字色。
- 样式刷自身变化**不修改主题、不显示保存条、不进入撤销历史**；只有点击棋盘应用后才算修改。
- 首次进入编辑器时，样式刷从当前主题第一个可编辑色板项读取；读取不到时使用默认蓝色和白色。
- 不提供逐行色板列表、批量字体色、全部白/黑或折叠 99 项等旧方案；编辑通过样式刷和吸管完成。
- 样式刷区域不显示额外说明文字。

#### 6.7.3 油漆桶与吸管

- 工具区有两个互斥按钮：“油漆桶”和“吸管”。
- **油漆桶（默认）**：
  - 点击右侧任意非空白方块，按当前模式计算 palette 索引；
  - 把样式刷的背景色写入 `palette[index]`，文字色写入 `fontPalette[index]`；
  - 按层/按行模式会同时改变该组的所有方块；全自定义只改该数字；
  - 样式刷与目标组当前颜色完全相同时视为 no-op，不修改主题、不显示保存条、不产生历史；
  - 有实际变化时每次点击产生一步撤销历史。
- **吸管**：
  - 点击右侧任意非空白方块，把该组当前的 `palette[index]` / `fontPalette[index]` 读入样式刷；
  - 如果主题里仍是旧 `auto` 字体色，吸管解析成明确的对比色，保证样式刷始终是具体颜色；
  - 不修改主题、不显示保存条、不进入历史；
  - 用于“只改某一层的文字色，但保留原背景色”这类场景。
- 悬停非空白方块时只高亮所有将受影响的方块，不显示数量或操作说明文字。
- 点击空白块不涂色；空白块固定透明，编辑器不提供空白色设置。
- 棋盘涂色第一版以鼠标/触屏为主；左侧控件、撤销/重做、保存条完整支持键盘。棋盘涂色的完整键盘/读屏替代方案随 P8-5 可访问性工作补充。

### 6.8 整盘样式

这些字段整盘统一，不随数字变化；全部实时更新右侧预览，计入脏状态和撤销历史。

- **空白色**：编辑器固定使用 `transparent`，不提供编辑控件；旧主题打开时由 `prepareThemeForEditor()` 统一为透明，保存后写回透明。
- **盲玩色**：`#rrggbb`；默认 `#3498db`；用于盲玩隐藏数字时的所有非空方块，空白块仍使用空白色。
- **内边框颜色**：`transparent` 或 `#rrggbb`；默认 `transparent`。
- **内边框宽度**：0–0.1，UI 显示为格子边长的百分比，默认 0。
  - 边框颜色透明但宽度大于 0 时仍占用内边距。
- **字号**：0–1，UI 显示为 0%–100%，相对于“边框内区域”，不是整个格子。
- **间隙**：0–0.1，UI 显示为 0%–10%，相对于格子边长。
- **圆角**：0–0.5，UI 显示为 0%–50%，相对于格子边长。
- 滑杆使用原生 `<input type="range">`，同时显示数值；拖动时实时预览，但不能每移动一像素写一次历史或存储。
- 整盘样式区域不显示额外说明文字。

### 6.9 预览

- 右侧始终渲染 `max(supportedSizes)` 阶的已复原棋盘；默认主题支持全部阶数，所以默认预览 10×10。
- 只支持 2–5 阶时预览 5×5；支持阶数变化且最大值变化时销毁并重建 `BoardView`，最大值不变时只更新主题。
- 预览复用 `board-view` + `board.css`，与设置页卡片和游戏页共享同一套取色、字体色、内边框和 metrics 渲染；设置页卡片继续使用装饰性的 `ui/theme-preview.ts`，编辑器通过 `ui/theme-editor-board.ts` 包装交互和悬停高亮，不使用 `aria-hidden` 的卡片预览。
- 预览卡头部只显示“预览”，不显示阶数文本；棋盘始终显示数字，不提供“显示数字”开关，也不做盲玩预览。
- 预览下方不显示悬停摘要、涂色说明或解释文字；错误文案仍显示在对应控件旁或保存条内。
- 预览不保存 DOM、不把棋盘对象放入撤销历史。
- 预览棋盘宽度限制在约 `34rem`，比右侧整栏略窄，避免 10×10 棋盘过大。

### 6.10 撤销/重做

- 使用完整 `Theme` 快照，不存 DOM、棋盘视图或页面状态。
- 历史最多 **50 步**；撤销和重做共用这批快照，任意时刻总快照数不超过 50。
- 内存评估：最重的 `fixed` 主题约 99 个背景色 + 99 个字体色，单份快照为几 KB 量级；50 份约 250KB–500KB，远低于常见页面内存压力。不需要做 patch、结构共享或持久化历史。
- 新修改会清空 redo；撤销把快照从 undo 移到 redo，不会增加总快照数。
- 进入历史的内容：
  - 名称；
  - 支持阶数；
  - 着色模式及切换时 palette/fontPalette 的截断/补齐；
  - 油漆桶涂色结果；
  - 盲玩色、内边框、metrics；
  - 重置操作。
- 不进入历史的内容：
  - 样式刷颜色；
  - 油漆桶/吸管工具切换；
  - 读取状态、焦点和悬停状态。
- 连续操作要合并成一步：
  - 同一个滑杆或颜色选择器从第一次 `input` 到 `change`（或约 600ms 内的连续输入）算一步；
  - 名称输入按连续输入合并，暂停或失焦后开始新的一步；
  - 复选框、模式切换、支持阶数变化、每次油漆桶点击各自算一步。
- 快捷键：
  - `Ctrl/Cmd + Z` 撤销；
  - `Ctrl/Cmd + Shift + Z` 重做；
  - 兼容 `Ctrl/Cmd + Y` 重做。
- 页头右侧提供撤销/重做图标按钮；没有历史时禁用。按钮使用 `aria-label` / `title` 显示快捷键说明。
- 键盘处理：
  - 有可撤销/重做操作时 `preventDefault()`；
  - 名称输入框聚焦时也统一走编辑器撤销，避免文本撤销和画布撤销混在一起；
  - 中文输入法组合期间（`isComposing`）忽略快捷键；
  - 保存进行中忽略快捷键。
- 撤销/重做后同步左侧控件、右侧预览和保存条；不重建整个左侧 DOM，避免丢失焦点。
- 保存不清空历史；重置可撤销；历史上限只保留最近 50 步。

### 6.11 校验、错误与冲突

- 保存前校验：
  - 名称 `trim()` 后非空且不超过 20 显示宽度；
  - `supportedSizes` 非空、每一项 2–10、升序去重；
  - `palette` 长度匹配 mode，全部为 `#rrggbb`；
  - `fontPalette` 与 `palette` 等长，每项为 `'auto'` 或 `#rrggbb`；
  - `blankColor` / `innerBorder.color` 为 `transparent` 或 `#rrggbb`；
  - `blindTileColor` 为 `#rrggbb`；
  - `innerBorder.widthRatio` 0–0.1，metrics 在约定范围内；
  - 自定义主题不超过 20 个；
  - ID 不是内置 ID、回退 ID 或其他主题 ID。
- 取消正在被使用的阶数支持时阻止保存，错误文案列出完整阶数，例如“该主题正在用于 8×8、9×9，请先在设置页为这些阶数选择其他主题。”
- 名称错误显示在名称输入框下方并聚焦；支持阶数错误显示在支持阶数区域；保存失败显示在保存条内。
- 不使用 `alert`；保存失败保留 draft、控件值和当前预览。
- 读取 `corrupt` / `unavailable` / 版本不兼容时显示顶部 banner；仍然允许编辑，但保存失败时在保存条内提示存储问题。
- 20 个上限：新建入口在设置页禁用；直接访问新建 URL 时显示上限说明，不生成可保存草稿。

### 6.12 与设置页的衔接

- 设置页的加号卡进入无参数的新建页；自定义主题的铅笔按钮进入 `?theme=<id>`。
- 编辑器保存成功后仍停留在编辑器；用户点击返回按钮回到 `settings.html#game-theme`。
- 设置页返回时重新读取外观；如果页面来自 bfcache，按 6.4.4 处理。
- 新主题保存后不自动分配阶数，设置页主题卡没有覆盖徽标（aria 为“未应用到任何阶数”），用户通过“应用到”对话框选择阶数。
- 编辑已有主题时保留原有 `themeIdBySize`；修改名称、颜色、边框或 metrics 不会改变分配。
- 设置页和编辑器都不做自动保存；两处都只在显式点击“保存”时写 `puzzle.v2.appearance`。

### 6.13 响应式与可访问性

- 桌面两栏，窄屏单列；预览在窄屏放在控制区上方，尽量保持可见。
- 所有标签使用 `<label>` / `<fieldset>` / `<legend>`；原生 checkbox、range、color、text input 保留键盘和读屏语义。
- 模式切换、油漆桶/吸管使用带 `aria-pressed` 的按钮，不能只靠颜色表达状态。
- 撤销/重做按钮有 `aria-label`、`title` 和禁用态；快捷键有文字提示。
- 按 2026-10-25 的视觉收敛，预览悬停只高亮受影响方块，不显示文字摘要；完整键盘/读屏高亮方案随 P8-5 补充。
- 尊重 `prefers-reduced-motion`；保存条、撤销淡入等动画在减少动态时关闭。
- 棋盘涂色的完整键盘/读屏替代方案记录为 P8-5 待办；编辑器第一版至少保证左侧控件、保存条、撤销/重做和错误提示键盘可用。

## 7. 游戏页（P8-4c-2c）

### 7.1 按阶数解析主题

游戏页不再在启动时固定一个主题：

```ts
const appearance = appearanceResult.appearance;

function replaceBoard(size: PuzzleSize): void {
  const theme = getThemeForSize(appearance, size);
  boardView = createBoardView({ root, size, theme, numbersVisible: true });
}
```

- 切换阶数时，`ensureBoard(settings.size)` 重建棋盘并取该阶数的主题。
- `getThemeForSize` 在主题不存在、不支持该阶数或 ID 为回退时返回 `FALLBACK_THEME`。
- 主题颜色、字体色、内边框、盲玩色和 metrics 都通过同一 `Theme` 传入 `board-view`。

### 7.2 重玩

- 重玩使用成绩的 `size`，不能使用当前设置阶数。
- `ensureBoard(retrySource.size)` 和 `startRetryGame()` 都按重玩成绩的阶数解析主题。
- 退出重玩后回到当前设置阶数，重新解析主题。

### 7.3 回退提示

- 读取外观后，如果 `themeIdBySize` 中存在回退阶数，用现有 notifier 显示非阻塞警告。
- 文案列出受影响的阶数，例如“2×2、4×4 的主题数据异常，已使用系统回退主题。请到设置页重新选择。”
- `corrupt` / `unavailable` / 版本不兼容时合并为一条 appearance 警告，避免重复提示。
- 棋盘照常渲染，不阻塞游戏。

### 7.4 回放与成绩

- 成绩和录像不保存主题快照。
- 回放页将来实现时，按成绩的 `size` 使用**当前**主题分配，而不是还原当时的主题。
- 如需“按当时主题回放”，在成绩中增加 `themeId` 是后续独立需求，不影响当前结构。
- 成绩页当前不渲染棋盘；如果后续增加棋盘预览，同样使用 `getThemeForSize(appearance, score.size)`。

### 7.5 进行中的对局

- 设置页是独立页面，进入会卸载当前局；运行中/重玩中/保存中禁用入口。
- 不跨标签页实时同步；另一个标签页修改主题后，当前页刷新或重新加载才生效。
- 游戏页只读 `puzzle.v2.appearance`，不写主题数据。

## 8. 数据与兼容

- 外观 key：`puzzle.v2.appearance`；版本 4。
- 设置 key：`puzzle.v2.settings`；版本 3。
- 全站偏好：`site.v1.preferences`；版本 1。
- **不做 v3 → v4 迁移**；升级时清一次 `puzzle.v2.appearance`，自定义主题会丢失。
- 不清时 v3 数据按不兼容处理：使用回退主题，并提示清理 key。
- 键缺失时使用默认彩虹外观；不自动写入。
- 旧版 `config` / `scores` / `currentScore` / `currentScoreList` 仍不读取；显式清理入口不变。
- 成绩、录像、分组、IndexedDB 不受主题模型升级影响。
- 主题编辑器不新增 localStorage key，不升级 schema；新建主题、撤销/重做和名称宽度限制都不改变存储格式。
- 编辑器名称限制只在 UI 执行；数据层保持 `trim()` 后非空和允许重名的规则。
- 主题导入/导出、设置迁移、数据清理 UI 属于后续扩展。

## 9. 文件与模块

| 文件/目录 | 职责 |
| --- | --- |
| `src/games/puzzle/types.ts` | `Theme`、`ColorMode`、`ThemeInnerBorder`、`AppearanceState`、`PuzzleSize` |
| `src/games/puzzle/core/appearance/presets.ts` | 内置主题、回退主题、默认盲玩色、默认 metrics |
| `src/games/puzzle/core/appearance/theme.ts` | 逐块取色、字体色解析、克隆、颜色校验；导出可复用的 palette 索引解析 |
| `src/games/puzzle/core/appearance/metrics.ts` | metrics 归一化、CSS 变量（含内边框） |
| `src/games/puzzle/core/appearance/appearance.ts` | 默认/回退外观、按阶数解析、分配、覆盖、相等比较；导出 `isThemeEqual` 供编辑器判断脏状态 |
| `src/games/puzzle/core/appearance/editor.ts` | 编辑器纯函数：模式切换时 palette/fontPalette 截断补齐、按方块取涂色目标、样式刷应用、主题校验 |
| `src/games/puzzle/core/appearance/name.ts` | 主题名称显示宽度、grapheme 计数、trim 与长度校验（纯函数，可供测试） |
| `src/games/puzzle/data/schema.ts` | 版本常量、Theme/AppearanceState 校验 |
| `src/games/puzzle/data/appearance-store.ts` | v4 读取、归一化、保存 |
| `src/games/puzzle/ui/game-theme-picker.ts` | 主题卡、覆盖徽标、回退警告、打开对话框 |
| `src/games/puzzle/ui/theme-assignment-dialog.ts` | “应用到”对话框 |
| `src/games/puzzle/ui/theme-coverage.ts` | 覆盖范围摘要、完整阶数列表和尺寸文案 |
| `src/games/puzzle/ui/theme-preview.ts` | 设置页卡片等装饰性主题预览（复用 BoardView，`aria-hidden`） |
| `src/games/puzzle/ui/theme-history.ts` | 编辑器快照历史：50 步上限、undo/redo、连续输入合并辅助 |
| `src/games/puzzle/ui/theme-editor-controls.ts` | 名称、支持阶数、模式、样式刷、吸管、整盘样式控件与校验展示 |
| `src/games/puzzle/ui/theme-editor-board.ts` | 编辑器棋盘交互：悬停高亮、涂色目标、油漆桶/吸管 |
| `src/games/puzzle/ui/theme-editor.ts` | 编辑器页面 controller：草稿、历史、保存、重置、URL、bfcache |
| `src/games/puzzle/ui/settings-page.ts` | `puzzle-theme` controller、保存条、读取状态、回退警告；处理 bfcache 重读外观 |
| `src/games/puzzle/ui/board-view.ts` | 在 tile 上增加 `data-tile` 等稳定钩子；不承担编辑器输入逻辑 |
| `src/games/puzzle/pages/game.ts` | 按阶数解析主题、回退提示 |
| `src/games/puzzle/pages/theme-editor.ts` | 编辑器页面入口、参数解析、错误边界和组装 |
| `src/games/puzzle/styles/board.css` | 内边框、字号内区域公式、逐块字体色 |
| `src/games/puzzle/styles/settings.css` | 主题卡、徽标、回退警告、对话框内容、保存条、响应式 |
| `src/games/puzzle/styles/theme-editor.css` | 编辑器两栏布局、预览卡、控件、涂色工具、撤销按钮、窄屏 |
| `src/games/puzzle/styles/overlays.css` / `dialog.css` | 对话框基础样式 |
| `src/shared/icons/sprite.svg` | 新增 `undo` / `redo` 图标；实现时登记到 `docs/ICONS.md` |
| `puzzle-game/settings.html` | 游戏主题 section 文案和挂载点；加载 board.css / dialog 样式 |
| `puzzle-game/theme-editor.html` | 编辑器真实页面 |
| `vite.config.ts` | 编辑器入口已存在，无需新增 |
| `docs/PUZZLE_THEME.md` | 本文件，主题与按阶数分配单一设计来源 |

模块约束：

- `core` 不碰 DOM / localStorage；`ui` 只做 DOM；`data` 负责归一化和持久化；`pages` 负责组装。
- 设置页主题列表不导入游戏 session、成绩、录像、图表或 IndexedDB。
- 主题编辑器不导入游戏输入/计时逻辑，只复用 `Theme`、`AppearanceState`、预览和存储。
- 历史快照只保存 `Theme` 深拷贝，不保存 DOM、棋盘对象、样式刷或预览状态；`theme-history.ts` 是纯状态模块，不碰 DOM。
- 主题名称宽度、模式切换、涂色、脏比较等纯逻辑必须可被 Vitest 直接测试，不依赖 DOM。
- 不新增运行时依赖。

## 10. 实现步骤

### 10.1 P8-4c-2a 领域模型与存储

- [x] `types.ts` 增加 `supportedSizes`、`fontPalette`、`ThemeInnerBorder`；移除 `fontColor`；`AppearanceState` 改为 `themeIdBySize`。
- [x] `presets.ts` 增加 `FALLBACK_THEME`、`FALLBACK_THEME_ID`；内置主题补 `supportedSizes` / `fontPalette` / `innerBorder`；默认盲玩色改为 `#3498db`。
- [x] `theme.ts` 按索引解析字体色；克隆 `fontPalette` / `innerBorder`。
- [x] `metrics.ts` 输出 `--tile-inner-border-color` / `--tile-inner-border-width-ratio`。
- [x] `appearance.ts` 实现 `createDefaultAppearance`、`createFallbackAppearance`、`getThemeForSize`、`assignThemeToSizes`、`getThemeCoverage`、`getFallbackSizes`、`getPreviewSize`、`isAppearanceEqual`。
- [x] `schema.ts` 拆分 `SETTINGS_SCHEMA_VERSION = 3` / `APPEARANCE_SCHEMA_VERSION = 4`；校验新字段。
- [x] `appearance-store.ts` 读取 v4；v3/未知版本使用回退外观；不做迁移。
- [x] 核心与 store 测试。
- [x] 更新 `PUZZLE_STORAGE.md`、`PUZZLE_ARCHITECTURE.md`。

实现备注（2026-10-24）：`npm test`（398 项）、`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm run build` 均通过。同时接入 `board.css` 的内边框和字号内区域公式；为保持构建通过，游戏页已按阶数解析主题，设置页暂时仍是单选并应用到该主题支持的全部阶数；完整按阶数 UI 由 P8-4c-2b 替换。

### 10.2 P8-4c-2b 设置页按阶数分配

- [x] `game-theme-picker.ts` 改为按钮卡片、覆盖徽标、回退警告；预览取最大支持阶数。
- [x] 新增 `theme-assignment-dialog.ts`，只列支持阶数，当前已应用锁定，`全选` 辅助。
- [x] 新增 `theme-coverage.ts`，集中处理徽标摘要、完整阶数列表和尺寸文案。
- [x] `settings-page.ts` 的 `puzzle-theme` controller 改为 `themeIdBySize` draft/保存/重置。
- [x] 设置页加载对话框样式；回退警告和读取状态。
- [x] `settings.css` 完成卡片、徽标、回退警告、对话框和响应式。
- [x] 更新 `SETTINGS_PAGE.md`、`PUZZLE_GAME_PAGE.md`。

实现备注（2026-10-25）：`game-theme-picker` 不再持有 radio；卡片使用独立透明按钮打开原生 `<dialog>`，确认结果交给 `puzzle-theme` controller 更新 draft。`AppearanceLoadResult` 新增可选 `issue`（不改变四态 `status`），设置页据此区分 v3/未知版本与普通损坏。`puzzle-game/settings.html` 加载 `overlays.css`。随后根据视觉反馈移除“当前分配”9 格总览，回退警告保留在卡片网格上方；同时增加卡片高度和预览区顶部留白，覆盖徽标改为扁平样式。`npm test`（409 项）、`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm run build` 均通过；手动验收待执行。

### 10.3 P8-4c-2c 游戏页

- [ ] `game.ts` 在 `replaceBoard(size)` 中按阶数解析主题；移除启动时固定主题。
- [ ] 重玩使用成绩阶数解析。
- [ ] 回退提示与 `corrupt` / `unavailable` 文案合并。
- [ ] 回放页后续实现时复用 `getThemeForSize`。

### 10.4 P8-4c-2d 主题编辑器（已实现 2026-10-25）

- [x] `theme-editor.html` 从占位页改为真实页面：页头返回、标题“游戏主题设置”、撤销/重做按钮、保存条、读取状态 banner。
- [x] 新增 `styles/theme-editor.css`：桌面 `1 : 2` 两栏、右侧 sticky 预览、窄屏单列、控件和工具样式。
- [x] 新增 `pages/theme-editor.ts` 与 `ui/theme-editor.ts`：参数解析、new/edit 状态、baseline/draft、错误边界。
- [x] 名称输入：默认“新的主题”、20 显示宽度、计数器、trim、空值/超限错误、允许重名。
- [x] 支持阶数：2×5 多选框、无“全选”、至少一个、使用中提示、阻止取消使用中的阶数。
- [x] 着色模式：按层/按行/全自定义；模式切换时 palette/fontPalette 按索引截断/补齐。
- [x] 样式刷：背景色 + 明确文字色（无 auto）；迷你预览；默认从当前主题读取，旧 auto 转显式色。
- [x] 涂色：油漆桶点击按模式修改 palette/fontPalette；吸管读回样式；悬停只高亮受影响方块；空白块不参与。
- [x] 整盘样式：盲玩色、内边框颜色/宽度、字号、间隙、圆角；空白色固定透明、不提供编辑；实时预览并在拖动结束后合并历史。
- [x] 预览：最大支持阶数、始终显示数字、支持阶数变化时重建、与设置页/游戏页一致；无悬停说明文字。
- [x] 撤销/重做：50 步快照、页头图标按钮、Ctrl/Cmd+Z、Ctrl/Cmd+Shift+Z、Ctrl/Cmd+Y；连续输入合并；重置可撤销；保存不清空历史。
- [x] 新建草稿只在内存：未修改退出不创建主题；保存后停留编辑器并用 `replaceState` 更新 `?theme=<id>`。
- [x] 保存后不自动分配阶数；不做离开确认；返回/刷新直接丢弃草稿。
- [x] 设置页 `pageshow` 处理 bfcache，避免返回后看到旧主题列表。
- [x] 新增 `undo` / `redo` / `paint-bucket` / `pipette` 图标并更新 `docs/ICONS.md`。
- [x] 单测：模式切换、涂色目标、名称宽度、历史栈、脏比较、校验。
- [x] 更新 `SETTINGS_PAGE.md`、`PUZZLE_TASKS.md`、`PUZZLE_ARCHITECTURE.md`、`PUZZLE_STORAGE.md`、`REFACTOR_PLAN.md`、`PUZZLE_GAME_PAGE.md`。

实现备注（2026-10-25）：新增 `core/appearance/editor.ts`（模式切换、涂色目标、样式刷应用/读取、`prepareThemeForEditor()`、脏比较和保存前校验）、`core/appearance/name.ts`（grapheme/显示宽度计算）、`ui/theme-history.ts`（50 份快照线性历史与连续输入合并）、`ui/theme-editor-board.ts`（棋盘悬停/点击/高亮）、`ui/theme-editor-controls.ts`（左侧控件）和 `ui/theme-editor.ts`（controller）。`board-view` 的 tile 增加稳定的 `data-tile` 钩子；`getTilePaletteIndex` 从 `theme.ts` 导出复用。设置页新增 `pageshow` + `persisted` 处理，bfcache 返回时重新读取外观并重渲染主题列表。

视觉收敛（2026-10-25）：移除预览和左侧的全部操作说明文字；移除“显示数字”开关，预览始终显示数字；移除空白色编辑，编辑器固定透明；移除文字色“自动”，旧 auto 在打开时转成显式黑/白；预览棋盘最大宽度收到约 `34rem`。样式刷和工具切换不进入主题、脏状态或历史；名称连续输入、滑杆和颜色选择器按 600ms 窗口或 `change` 合并。`npm test`（463 项）、`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm run build` 通过；手动验收待执行。

### 10.5 P8-4c-2e 测试与验收

- [ ] `npm test`、`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm run build`（编辑器实现阶段已全部通过；P8-4c-2e 最终验收仍按完整链路重跑）。
- [ ] 设置页、游戏页、编辑器手动验收。
- [ ] E2E 在 P8-6 补充；编辑器至少覆盖新建未修改退出、保存后 URL、撤销/重做和名称超限。
- [ ] 更新所有相关文档和决策记录。

## 11. 验收

### 11.1 自动检查

```bash
npm test
npm run typecheck
npm run lint
npm run format:check
npm run build
```

要求：

- 全部通过；
- `dist/puzzle-game/settings.html` 和 `dist/puzzle-game/theme-editor.html` 存在；
- 构建产物不包含未使用的游戏/图表模块；
- 无新增运行时依赖。

### 11.2 数据与兼容

- [ ] 清除 `puzzle.v2.appearance` 后刷新，显示两套内置主题，所有阶数使用彩虹。
- [ ] 存在 v3 外观数据时，页面使用回退主题并提示清理；设置/分组不受影响。
- [ ] v4 外观数据能往返保存/读取。
- [ ] 自定义主题超过 20 个时只保留前 20 个。
- [ ] `themeIdBySize` 缺失键、未知 ID、不支持阶数时使用回退主题。
- [ ] 主题的 `supportedSizes` 变更后，非法分配落到回退主题。
- [ ] 损坏的 `fontPalette` / `innerBorder` / `blindTileColor` 按规则修复或丢弃主题。

手动测试可先备份并写入一个只支持 10×10 的自定义主题：

```js
const custom = {
  id: 'custom-10',
  name: '只用于 10×10',
  builtin: false,
  supportedSizes: [10],
  color: {
    mode: 'layer',
    palette: Array(18).fill('#3498db'),
    fontPalette: Array(18).fill('auto'),
    blankColor: 'transparent',
  },
  innerBorder: { color: 'transparent', widthRatio: 0 },
  blindTileColor: '#3498db',
  metrics: { fontSizeRatio: 0.5, gapRatio: 0.03, radiusRatio: 0.04 },
};
const themeIdBySize = Object.fromEntries(
  [2, 3, 4, 5, 6, 7, 8, 9, 10].map((size) => [
    size,
    size === 10 ? custom.id : 'rainbow',
  ]),
);
localStorage.setItem(
  'puzzle.v2.appearance',
  JSON.stringify({ version: 4, data: { themeIdBySize, themes: [custom] } }),
);
location.reload();
```

测试内边框和逐块字体色时，把 `custom.innerBorder` 改成 `{ color: '#ffffff', widthRatio: 0.03 }`，并把 `fontPalette` 改成前几层不同颜色即可。测试完成后清掉 `puzzle.v2.appearance`，回到默认彩虹外观。

### 11.3 设置页主题列表

- [ ] 两套内置主题在前，自定义主题按存储顺序，最后是加号卡。
- [ ] 每张卡预览其支持的最大阶数；只支持 8×8 的主题显示 8×8。
- [ ] 覆盖徽标按第 5.4 节规则显示；`所有阶数` 只在覆盖全部 9 个阶数时出现。
- [ ] 使用中的卡片有主题蓝边框/浅蓝背景；未使用卡片不显示覆盖徽标。
- [ ] 不再显示“当前分配”总览；出现回退阶数时，卡片网格上方有文字警告并列出阶数。
- [ ] 自定义主题显示铅笔按钮；点击编辑不打开“应用到”对话框。
- [ ] 加号卡跳转编辑器；20 个上限禁用并提示。
- [ ] 窄屏 3/2/1 列切换正常，无横向滚动。
- [ ] 页面无控制台错误。

### 11.4 “应用到”对话框

- [ ] 只显示该主题支持的阶数；不支持的不出现。
- [ ] 当前已应用的阶数选中并锁定。
- [ ] 其他支持的阶数可勾选；确认后替换原主题。
- [ ] `全选` 选择全部支持阶数；只有一个支持阶数时隐藏。
- [ ] 没有选中项时“确定”禁用。
- [ ] 不显示“已应用/将应用/将替换”等额外状态行。
- [ ] 确认后底部保存条出现；取消不改变 draft。
- [ ] 关闭后焦点回到对应主题卡。
- [ ] 切换分类不丢 draft；返回/刷新丢弃未保存修改。

### 11.5 游戏页

- [ ] 切换阶数后，棋盘使用该阶数分配的主题。
- [ ] 重玩使用成绩阶数的主题，不受当前设置阶数影响。
- [ ] 某个阶数使用回退主题时，棋盘显示回退外观并出现非阻塞提示。
- [ ] 主题颜色、逐块字体色、内边框、盲玩色、metrics 与设置页预览一致。
- [ ] 盲玩隐藏数字时使用 `#3498db`（或主题自定义值）；空白块不参与盲玩色。
- [ ] 无控制台错误。

### 11.6 颜色、字体色与内边框

- [ ] 内置主题和回退主题默认内边框透明/0，视觉与升级前一致。
- [ ] 自定义主题设置内边框颜色和宽度后，边框画在方块内部，方块外尺寸不变。
- [ ] 边框宽度 >0 时字号按“格子边长减去左右内边框”计算，文字位于边框内。
- [ ] 边框颜色透明但宽度 >0 时仍占用内边距；宽度设为 0 后恢复原始字号。
- [ ] 逐块字体色按层/行/数字正确应用；`auto` 根据该块背景选黑/白。
- [ ] 内置主题字体色仍为白色；回退主题和新建主题默认 `auto`。
- [ ] 空白块没有字体色；盲玩模式不显示字体色。
- [ ] 设置页卡片预览、编辑器预览和游戏页三者一致。

### 11.7 主题编辑器

页面与布局：

- [ ] 页头显示返回按钮、标题“游戏主题设置”和撤销/重做按钮；没有历史时按钮禁用。
- [ ] 桌面为左侧控制、右侧预览的 `1 : 2` 两栏；右侧预览滚动时保持可见，棋盘宽度约 `34rem`。
- [ ] 界面没有操作说明、悬停数量或预览解释文字。
- [ ] 窄屏为单列、预览在上、无横向滚动。
- [ ] 页面加载 `base.css`、`settings.css`、`board.css`、`overlays.css`、`theme-editor.css`，不加载 `game.css`。

新建与保存：

- [ ] 新建主题默认复制回退主题：18 个 `#3498db`、18 个显式白色、空白色透明、透明边框/0、gap 0.06、radius 0；名称为“新的主题”。
- [ ] 新建页打开后不写 localStorage；未修改直接返回不会产生主题。
- [ ] 修改后显示保存条；重置回到基线并消失；重置可通过撤销恢复。
- [ ] 保存成功后停留在编辑器，URL 从无参数变为 `?theme=<id>`；刷新进入编辑模式。
- [ ] 新主题保存后不自动分配阶数；设置页卡片无覆盖徽标，aria 为“未应用到任何阶数”。
- [ ] 编辑已有主题保存后不改变原有 `themeIdBySize`。
- [ ] 保存失败保留 draft 和错误；保存按钮不重复提交。
- [ ] 返回/刷新/关闭直接丢弃草稿，不弹确认框；编辑已有主题时保留上次保存版本。
- [ ] 设置页从编辑器返回时能显示新主题（bfcache 处理生效）。

名称与支持阶数：

- [ ] 名称最多 20 显示宽度；10 个汉字、20 个英文字母可通过；11 个汉字或 21 个英文字母被阻止。
- [ ] 混合中英文、emoji、组合字符按 grapheme 和显示宽度计数。
- [ ] 名称为空或超限时出现错误、阻止保存并聚焦名称输入框。
- [ ] 允许创建同名主题。
- [ ] 支持阶数为 2×5 多选框，没有“全选”；至少保留一个。
- [ ] 取消正在被使用的阶数时出现错误并阻止保存；重新勾选后可保存。
- [ ] 预览始终使用支持的最大阶数；只在最大值变化时重建棋盘。

涂色与预览：

- [ ] 按层模式点击一个方块会改变整层；按行改变整行；全自定义只改变该数字。
- [ ] 切换模式时 palette/fontPalette 按索引截断/补齐，背景补 `#3498db`、字体补显式白色。
- [ ] 样式刷背景/文字色都可直接选择，没有“自动”开关；迷你预览正确。
- [ ] 打开旧主题时，`auto` 字体色变成明确黑/白；保存后写回显式颜色。
- [ ] 油漆桶点击后立即更新预览和保存条；吸管点击只更新样式刷，不修改主题。
- [ ] 悬停时只高亮全部受影响方块，不显示层/行/数字和数量摘要。
- [ ] 点击空白块不涂色；空白块固定透明，界面上没有空白色编辑控件。
- [ ] 预览标题只有“预览”，棋盘始终显示数字，没有“显示数字”开关或盲玩预览。
- [ ] 盲玩色、内边框颜色/宽度、字号、间隙、圆角实时预览。
- [ ] 内边框透明但宽度 >0 时仍占用内边距。
- [ ] 预览、设置页卡片和游戏页的三者视觉一致。

撤销/重做：

- [ ] 页头按钮、`Ctrl/Cmd+Z`、`Ctrl/Cmd+Shift+Z`、`Ctrl/Cmd+Y` 均可撤销/重做。
- [ ] 名称、支持阶数、模式、涂色、整盘样式、重置进入历史。
- [ ] 样式刷、吸管、工具切换不进入历史。
- [ ] 连续拖动滑杆/颜色选择器只产生一步历史；名称连续输入合并。
- [ ] 中文输入法组合期间不触发撤销/重做。
- [ ] 名称输入框聚焦时，撤销统一作用于编辑器。
- [ ] 历史最多 50 步；撤销/重做后保存条正确显示或隐藏。
- [ ] 保存后历史保留；保存后撤销会让主题重新变为未保存。

错误与边界：

- [ ] 内置主题、回退 ID、缺失主题、非法 `?theme=` 显示错误和返回入口，不渲染编辑控件。
- [ ] 新建时已有 20 个自定义主题，直接显示上限说明，不生成可保存草稿。
- [ ] 存储不可用时显示 banner，保存失败在保存条内提示。
- [ ] 页面无控制台错误。

### 11.8 可访问性

- [ ] Tab 可到达主题卡按钮、编辑按钮、加号卡和对话框控件。
- [ ] Enter/Space 可打开主题卡对话框；Esc/取消关闭。
- [ ] 方向键不需要模拟 radio 行为；卡片是按钮语义。
- [ ] 覆盖徽标、回退状态都有文字说明，不只靠颜色。
- [ ] 回退警告可被读屏读出完整阶数；设置页不再有“当前分配”总览。
- [ ] 预览和徽标不抢焦点。
- [ ] 编辑器撤销/重做按钮可 Tab 到达，禁用态正确，快捷键有可读说明。
- [ ] 编辑器名称、支持阶数、模式、滑杆、颜色选择器和保存条均可键盘操作。
- [ ] 尊重 `prefers-reduced-motion`。

## 12. 测试点

### 12.1 核心纯函数

- `createDefaultAppearance()`：两套内置主题，所有阶数 `rainbow`。
- `createFallbackAppearance()`：两套内置主题，所有阶数 `fallback`。
- `createCustomThemeDraft()`：复制回退主题，`builtin: false`，`supportedSizes` 全部，名称默认“新的主题”；不修改 `FALLBACK_THEME`。
- `isThemeEqual()`：逐字段比较，包括名称、支持阶数、mode、palette/fontPalette、空白色、盲玩色、内边框和 metrics；不修改入参。
- `getThemeForSize()`：
  - 正常主题/阶数返回该主题；
  - 未知 ID、主题缺失、不支持该阶数、回退 ID 返回 `FALLBACK_THEME`。
- `assignThemeToSizes()`：
  - 只更新选中的阶数；
  - 主题不支持某阶数时忽略；
  - 缺失主题返回原状态；
  - 无变化返回同一对象；不修改入参。
- `getThemeCoverage()`：从 `themeIdBySize` 派生；无效分配按回退处理。
- `getFallbackSizes()` / `hasFallbackSizes()`：列出解析到回退主题的阶数。
- `getPreviewSize()`：返回 `Math.max(...supportedSizes)`；空数组回退 10。
- `isAppearanceEqual()`：
  - `themeIdBySize` 不同返回 false；
  - `supportedSizes`、`fontPalette`、`innerBorder`、`blindTileColor`、metrics 不同返回 false；
  - 不修改入参。
- `upsertCustomTheme()` / `removeCustomTheme()`：内置/回退保护；自定义主题顺序；删除后受影响阶数落回退。
- `prepareThemeForEditor()`：旧 `auto` 字体色转成明确黑/白，空白色固定为透明，返回深拷贝。
- 编辑器模式切换：`layer`/`row`/`fixed` 之间按索引保留，长度正确截断/补齐；背景补 `#3498db`、字体补显式白色；不修改入参。
- 编辑器涂色：按层/行/固定色解析目标索引；空白块、非法阶数、越界数字和 `auto`/非法文字色不涂色；同一组多个方块只改一个 palette 项。
- 编辑器吸管：旧 `auto` 字体色解析成明确对比色；空白块返回 null。
- 编辑器名称宽度：10 个汉字 = 20；20 个英文 = 20；混合文本正确；emoji/组合字符按 grapheme；超限判定正确。
- 编辑器历史：50 步上限；新修改清空 redo；撤销/重做移动快照；重置可撤销；快照数量不超过 50。
- 编辑器校验：空名称、超限名称、空支持阶数、非法颜色、非法 metrics、重复/保留 ID、20 个上限均被拦截。

### 12.2 取色与 CSS 变量

- `getTileVisual()`：
  - 三种模式按索引取背景色和字体色；
  - `fontPalette` 为 `auto` 时按该块背景计算黑白；
  - 固定字体色直接使用；
  - 空白/非法块返回空白色 + 透明字体；
  - 缺失 palette/fontPalette 项回退。
- `toCssVariables()`：
  - `--blank-color`、`--blind-tile-bg`；
  - `--tile-inner-border-color`、`--tile-inner-border-width-ratio`；
  - `--tile-font-ratio`、`--tile-gap-ratio`、`--tile-radius-ratio`；
  - 不输出逐块字体色。
- `normalizeMetrics()`：原有范围；内边框宽度单独归一化。
- `cloneTheme()`：palette、fontPalette、innerBorder、metrics 都是新引用。

### 12.3 Schema 与 store

- `isTheme()`：`supportedSizes`、`fontPalette`、`innerBorder`、`blindTileColor` 的严格校验。
- `isAppearanceState()`：9 个 `themeIdBySize` 键；值要么是 `fallback`，要么能解析到支持该阶数的主题。
- `normalizeAppearance()`：
  - 缺失/非法 `supportedSizes` 丢弃主题；
  - `fontPalette` 缺失/长度不对补 `auto`；
  - `innerBorder` 缺失/非法回退透明/0；
  - `blindTileColor` 非法回退 `#3498db`；
  - `themeIdBySize` 非法/不支持落回退；
  - 最多 20 个自定义主题；内置 canonical。
- `loadAppearanceResult()`：
  - 缺失 → 默认彩虹；
  - v4 合法 → `ok`；
  - v4 字段损坏 → `corrupt` + 可恢复数据 + `issue: 'invalid-data'`；
  - JSON 损坏 → 回退外观 + `corrupt` + `issue: 'invalid-json'`；
  - v3/未知版本 → 回退外观 + `corrupt` + `issue: 'legacy-version' | 'unknown-version'`；
  - 存储不可用 → 回退外观 + `unavailable`。
- `saveAppearance()`：写入 version 4；归一化；往返一致。
- `SETTINGS_SCHEMA_VERSION === 3`、`APPEARANCE_SCHEMA_VERSION === 4`。

### 12.4 覆盖文案

- 9 个阶数 → `所有阶数`。
- 单个 → `4 阶`。
- 连续区间 → `2–9 阶`。
- 两段 → `2–4、8–10 阶`。
- 三段及以上 → `5 个阶数`。
- 空 → 无徽标，aria “未应用到任何阶数”。
- `detail` 始终给出完整阶数列表，供 `title` / aria 使用。

### 12.5 手动 DOM / E2E

- 主题卡按钮、编辑/加号链接、覆盖徽标、回退警告。
- “应用到”对话框：只列支持阶数、当前锁定、全选、确定禁用、焦点回收。
- 保存/重置/失败/读取状态/回退警告。
- 游戏页按阶数切换、重玩、回退提示。
- 编辑器：
  - 新建未修改退出、修改后退出、重置、保存、保存后刷新、URL 变化；
  - 名称 20 显示宽度、中文/英文/emoji、同名主题；
  - 支持阶数多选、无全选、使用中阻止取消；
  - 三种模式涂色、吸管、悬停高亮、空白块固定透明、始终显示数字；
  - 整盘样式实时预览、内边框透明宽度；
  - 撤销/重做按钮与快捷键、连续拖动合并、IME、保存后撤销；
  - 50 步上限、重置可撤销；
  - 设置页返回后的 bfcache 刷新。
- 键盘和窄屏。
- 本项目当前没有 DOM 测试环境；交互随 P8 手动验收，E2E 在 P8-6 补充。

## 13. 待讨论与 TODO

- 自定义主题是否支持删除、重命名、排序；当前只有编辑和新建。
- 棋盘涂色的完整键盘/读屏替代方案，随 P8-5 可访问性工作处理；第一版以鼠标/触屏为主。
- 是否需要“基于内置主题新建”的快捷入口；当前默认复制回退主题，可后续增加。
- 20 个主题时的低端设备性能；必要时给卡片加 `content-visibility` 或延迟渲染预览。
- 是否支持主题导入/导出、云同步、主题市场。
- 是否在成绩中保存 `themeId`，实现“按当时主题回放”。
- 是否需要维护入口清理 `puzzle.v2.appearance` 或旧版键。
- 网站深色主题与游戏主题的适配关系。
- 撤销历史是否需要跨刷新保留；当前只存在页面内存中。
- 主题名称是否需要在数据层也强制 20 显示宽度；当前只由编辑器限制，数据层保持宽松。
- 小支持范围是否缩短 `palette` / `fontPalette` 长度；已确认不缩短，固定 18/10/99，隐藏项保留。
- 数据层仍接受旧主题的 `fontPalette: 'auto'` 和自定义 `blankColor`；编辑器打开时会转成显式颜色并把空白色固定为透明，是否需要在未来版本做一次性迁移待定。

## 14. 决策记录

| 日期 | 决策 |
| --- | --- |
| 2026-10-24 | P8-4c 拆成 P8-4c-1（主题列表/选择）和 P8-4c-2（模型升级 + 按阶数分配 + 编辑器） |
| 2026-10-24 | 主题增加 `supportedSizes`，默认全部 2–10；预览渲染支持的最大阶数 |
| 2026-10-24 | `AppearanceState` 移除 `activeThemeId`，改为 `themeIdBySize`；每个阶数独立分配 |
| 2026-10-24 | 覆盖范围从 `themeIdBySize` 派生，不存储主题覆盖列表；应用 B 到 10×10 只改 10×10 的 ID，不改 A 的 `supportedSizes` |
| 2026-10-24 | 每个阶数始终有且只有一个主题；已应用阶数在对话框中锁定，取消只能通过给其他主题分配 |
| 2026-10-24 | 覆盖徽标放卡片右上角，沿用现有卡片高度；“所有阶数”只在覆盖全部 9 个阶数时出现 |
| 2026-10-24 | “应用到”对话框只列支持阶数；当前已应用锁定；`全选` 仅作辅助；不显示额外状态/替换文案 |
| 2026-10-24 | 增加系统回退主题，不进入 `themes`、不可选择、不持久化；用于异常和新主题初始值 |
| 2026-10-24 | 键缺失使用默认彩虹；损坏/不可用/版本不兼容使用回退主题 |
| 2026-10-25 | 移除“当前分配”9 格总览；回退警告保留并直接位于主题卡网格上方 |
| 2026-10-25 | 对话框标题固定为“请选择应用的阶数”；隐藏原生 checkbox，整块阶数选项作为勾选目标；取消/确定复用设置页按钮样式 |
| 2026-10-24 | 盲玩色默认改为 `#3498db`；仍是主题级单色，所有非空方块统一 |
| 2026-10-24 | `fontColor` 改为逐块 `fontPalette`，长度与 `palette` 一致，每项 `auto` 或 `#rrggbb` |
| 2026-10-24 | 增加方块内边框 `innerBorder`；整盘统一；颜色支持透明，宽度 0–0.1；内置/回退/新建默认透明/0 |
| 2026-10-24 | 内边框不改变方块外尺寸；字号按“格子边长 − 2 × 内边框宽度”计算，文字通过 padding 限制在边框内 |
| 2026-10-24 | 边框颜色透明但宽度 >0 时仍占用内边距；不需要占位时宽度设为 0 |
| 2026-10-24 | 外观 envelope 升到 version 4；设置保持 version 3；不做 v3 → v4 迁移，清 `puzzle.v2.appearance` |
| 2026-10-24 | 编辑器取消勾选正在被使用的支持阶数时阻止保存 |
| 2026-10-24 | 新建主题默认复制回退主题；保存后不自动分配 |
| 2026-10-25 | 主题编辑器改为左右 `1 : 2` 布局：左侧控件、右侧最大支持阶数的实时预览；页头返回 + 标题 + 撤销/重做按钮 |
| 2026-10-25 | 逐块外观不再用色板列表编辑，改为“样式刷 + 油漆桶点击棋盘”；增加吸管从棋盘读回当前组样式 |
| 2026-10-25 | 编辑器支持阶数使用 2×5 多选框，移除“全选”；仍在使用的阶数不能取消支持后保存 |
| 2026-10-25 | 新建主题只创建内存 draft，名称为“新的主题”；未修改退出不创建主题，保存后才写入 `themes` |
| 2026-10-25 | 编辑器保存后留在当前页；新建保存成功后 URL 改为 `?theme=<id>`，不自动返回设置页 |
| 2026-10-25 | 编辑器不做离开确认、不注册 `beforeunload`；返回/刷新直接丢弃草稿，底部保存条是唯一提醒 |
| 2026-10-25 | 增加 50 步快照撤销/重做；页头按钮 + `Ctrl/Cmd+Z`、`Ctrl/Cmd+Shift+Z`、`Ctrl/Cmd+Y`；重置可撤销，保存不清空历史 |
| 2026-10-25 | 样式刷、吸管和工具切换不进入主题历史，也不触发脏状态 |
| 2026-10-25 | 视觉收敛：移除预览和左侧全部说明文字，预览始终显示数字，移除“显示数字”开关 |
| 2026-10-25 | 编辑器移除空白色编辑；空白块固定透明，旧主题打开时统一为透明 |
| 2026-10-25 | 编辑器移除文字色“自动”；旧 auto 在打开时转成显式黑/白，模式切换新增项补显式白色 |
| 2026-10-25 | 预览棋盘最大宽度缩小到约 `34rem` |
| 2026-10-25 | 名称上限 20 显示宽度（10 个汉字 / 20 个英文字母），允许重名；数据层保持宽松 |
| 2026-10-25 | “按层”继续保持旧版 L 形分层，不改为同心环 |
| 2026-10-25 | 主题编辑器不升级 schema；历史只保存 Theme 快照，不保存 DOM 或棋盘对象 |
| 2026-10-25 | 设置页从编辑器返回时处理 bfcache，重新读取外观并重渲染主题列表 |

## 15. 参考

- 设置页外壳与保存条：`docs/SETTINGS_PAGE.md`
- 拼图架构契约：`docs/PUZZLE_ARCHITECTURE.md`
- 存储设计：`docs/PUZZLE_STORAGE.md`
- P8 任务索引：`docs/PUZZLE_GAME_PAGE.md`
- 任务清单：`docs/PUZZLE_TASKS.md`
- 图标规范：`docs/ICONS.md`
- 重构总览：`docs/REFACTOR_PLAN.md`
- 旧版行为参考：`docs/PUZZLE_GAME.md`、git tag `pre-refactor-2026-10`
