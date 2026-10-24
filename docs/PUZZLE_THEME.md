# 数字华容道游戏主题与按阶数分配（P8-4c）

> 状态：P8-4c-1 设置页主题列表已实现（2026-10-24），待手动验收；P8-4c-2 设计确认（2026-10-24），P8-4c-2a 领域模型与存储已实现并通过自动检查（2026-10-24），P8-4c-2b 设置页按阶数分配已实现并通过自动检查（2026-10-25），待手动验收；P8-4c-2c 游戏页回退提示、P8-4c-2d 主题编辑器、P8-4c-2e 最终验收待开始。P8-4c-2 拆成 P8-4c-2a 领域模型与存储、P8-4c-2b 设置页按阶数分配、P8-4c-2c 游戏页按阶数解析、P8-4c-2d 主题编辑器、P8-4c-2e 测试与验收。
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
- 主题预览与游戏页共用 `board-view` / `board.css`，颜色、字体、边框和 metrics 不漂移。
- 内置主题只读；自定义主题可编辑；自定义主题上限仍为 20。
- 运行时保持轻量，不引入新依赖。

非目标：

- 不实现网站深色主题。
- 不实现中英文翻译。
- 不实现主题导入/导出、云同步、跨设备同步、排序或主题市场。
- 不做 v3 → v4 外观数据迁移；升级时清一次 `puzzle.v2.appearance`。
- 不做“按当时主题回放”；成绩和录像不保存主题快照。
- 不做主题删除 UI；如后续增加，删除规则见第 3.4 节。
- 不在本轮实现离开确认弹框；记录 TODO。

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
- **P8-4c-2d 主题编辑器**
  - 独立 `theme-editor.html` 真实页面。
  - 支持阶数、逐块背景色、逐块字体色、空白色、盲玩色、内边框、metrics。
  - 预览按支持的最大阶数渲染，支持数字显示/隐藏。
  - 新建主题复制回退主题；内置主题只读。
  - 取消勾选正在被该主题使用的阶数时阻止保存。
  - 保存冲突、校验、错误提示和返回设置页。
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
- 回退主题和新建主题：18 个 `'auto'`。
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
- 用户新建主题 → 编辑器初始 draft 复制回退主题，换新 id、`builtin: false`、名称“新主题”。
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
- `name` `trim()` 后非空；展示长度和省略号在编辑器中处理。
- `supportedSizes` 非空、升序、去重；默认全部 2–10。
- 可以使用 `layer` / `row` / `fixed` 任意一种模式。
- `palette` / `fontPalette` 长度必须与 mode 匹配。
- `innerBorder` 和 `blindTileColor` 统一作用于整盘。
- 最多 20 个。`CUSTOM_THEME_SLOT_COUNT = 20` 是数据校验和 UI 的共同上限。
- 归一化时非法 palette、非法颜色、重复 ID、内置/回退 ID 和 `builtin: true` 的主题会被丢弃；可恢复的 `fontPalette`、`innerBorder`、metrics、空白色和盲玩色按规则回退。
- 自定义主题按存储顺序展示；不保存预览 DOM、卡片顺序或 UI 状态。

### 2.11 不变量

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
┌ 应用到：彩虹 ────────────────┐
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
- 对话框 `title` 为“应用到：<主题名>”；正文只有阶数网格；省略额外说明。
- 初始焦点放在第一个可勾选的 checkbox；没有可勾选项时放到“确定”。
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
- 对话框使用原生 checkbox + label；`全选` 是独立按钮，有可读标签。
- 回退状态不只靠颜色，必须有文字“回退主题”。
- 焦点环落在卡片表面或 hitarea 上；对话框关闭后焦点回到触发卡片。
- 尊重 `prefers-reduced-motion`；沿用设置页现有规则。

## 6. 主题编辑器（P8-4c-2d）

### 6.1 页面与路由

```text
/puzzle-game/theme-editor.html                 新建主题
/puzzle-game/theme-editor.html?theme=<themeId> 编辑自定义主题
```

- 返回链接固定指向 `/puzzle-game/settings.html#game-theme`。
- 内置主题没有编辑入口；`?theme=rainbow` / `?theme=rainbow-soft` / `?theme=fallback` 视为非法编辑目标，提示并返回设置页。
- 不存在的主题 ID、损坏数据、非法参数都显示非阻塞错误和返回设置页入口，不崩溃。
- 编辑器页面需要加载 `base.css`、`settings.css`、`board.css` 和对话框样式。

### 6.2 草稿与保存

- 编辑器读取 `loadAppearanceResult()`，找到目标主题；新建时复制回退主题生成草稿。
- 所有修改只更新页面内 draft，不写 localStorage，不即时影响游戏页。
- “保存”：
  1. 校验名称、`supportedSizes`、palette/fontPalette 长度、颜色格式、innerBorder、metrics 和主题数量；
  2. 检查是否移除了正在被使用的支持阶数；如果有，阻止保存并提示；
  3. 将目标主题合并回完整的 `AppearanceState`；
  4. 保留 `themeIdBySize` 和其他主题；
  5. 调用 `saveAppearance(nextAppearance)`；
  6. 成功后返回设置页 `#game-theme`。
- “取消”/返回：丢弃 draft，不写存储。
- 新建主题保存后不自动分配阶数；用户回设置页自行选择。此行为已确认。
- 保存失败保留 draft，显示页面内错误，不自动离开。
- 不允许在每次选色/拖动滑杆时直接调用 `saveAppearance`。

### 6.3 内容分区

编辑器分为四块：

1. **基本信息**：名称、支持阶数。
2. **逐块外观**：着色模式、背景色 `palette`、字体色 `fontPalette`、空白色。
3. **整盘统一**：盲玩色、内边框、字号/间隙/圆角。
4. **预览**：按支持的最大阶数渲染，支持数字显示/隐藏。

### 6.4 支持阶数

- 2×5 勾选网格：2×2–10×10；至少选择一个。
- `全选` 选择全部 9 个。
- 已保存的主题如果正在被某些阶数使用，这些阶数在编辑器里显示“使用中”提示。
- 取消勾选一个正在被使用的阶数：允许操作，但立即显示错误并禁用保存，直到重新勾选或回设置页切换该阶数的主题。
- 新增支持阶数不冲突，直接允许。
- 预览阶数 = `Math.max(...supportedSizes)`；取消最大阶数后预览自动降级。
- 支持阶数不改变 `palette` / `fontPalette` 的长度。

### 6.5 逐块颜色与字体色

- 着色模式：降阶 / 按行 / 固定色。
- 切换模式时按新模式截断/补齐 `palette` 和 `fontPalette`：
  - `layer` 18、`row` 10、`fixed` 99；
  - 保留重叠部分；新补的字体色用 `'auto'`，背景色用默认/回退色。
- 每个色板条目一行：
  - 索引说明：层 / 行 / 数字；
  - 背景色 `<input type="color">`；
  - 字体色 `<input type="color">` + `自动` 开关；
  - 字体色选择 `自动` 时禁用颜色输入，由背景色计算黑/白。
- 批量操作：
  - 字体色全部 `自动`；
  - 全部白色；
  - 全部黑色；
  - 把第 1 项的字体色复制到全部。
- `fixed` 模式默认只展开“当前最大支持阶数用得到的前 N 项”；其余折叠到“显示全部颜色”，避免一上来就是 99 行。
- 可以显示对比度提示，但不强制阻止低对比度颜色。
- 编辑器里不保存预览 DOM 或临时颜色。

### 6.6 整盘统一

- **空白色**：`transparent` 或 `#rrggbb`；默认 `transparent`。
- **盲玩色**：`#rrggbb`；默认 `#3498db`；用于盲玩隐藏数字时的所有非空方块。
- **内边框颜色**：`transparent` 或 `#rrggbb`；默认 `transparent`。
- **内边框宽度**：0–0.1 滑杆，显示为格子边长的百分比；默认 0。
  - 提示：边框颜色透明但宽度大于 0 时仍占用内边距；不需要占位请把宽度设为 0。
- **字号**：0–1，相对于“边框内区域”，不是整个格子。
- **间隙**：0–0.1，相对于格子边长。
- **圆角**：0–0.5，相对于格子边长。
- 这些字段都是整盘统一，不随数字变化。

### 6.7 预览

- 默认 10×10 已复原棋盘；如果主题只支持到 8×8，则预览 8×8。
- 支持数字显示/隐藏切换，用于预览盲玩色。
- 支持实时更新：颜色、字体色、边框、metrics、支持阶数变化后立即重绘。
- 预览使用 `ui/theme-preview.ts` + `board-view`，与游戏页同一套渲染逻辑。
- 预览不参与交互，不抢焦点。

### 6.8 新建主题默认值

新建主题由 `createCustomThemeDraft(id)` 复制 `FALLBACK_THEME`：

- 名称“新主题”；
- `builtin: false`；
- 新唯一 ID；
- `supportedSizes` 全部 2–10；
- 18 个 `#3498db` 背景色；
- 18 个 `'auto'` 字体色；
- 空白色 `transparent`；
- 内边框 `{ transparent, 0 }`；
- 盲玩色 `#3498db`；
- metrics `0.5 / 0.06 / 0`。

用户可以在保存前调整；保存后回设置页手动分配。内置主题本身不被修改。

### 6.9 冲突与校验

- 名称 `trim()` 后不能为空；最大长度待定，展示时省略号 + `title`。
- `supportedSizes` 非空、每一项 2–10；重复项去重。
- `palette` 长度必须匹配 mode；所有颜色 `#rrggbb`。
- `fontPalette` 长度必须匹配 `palette`；每项 `'auto'` 或 `#rrggbb`。
- `blankColor` / `innerBorder.color` 允许透明或 `#rrggbb`。
- `blindTileColor` 必须是 `#rrggbb`。
- `innerBorder.widthRatio` 0–0.1；`metrics` 按现有范围夹取。
- 自定义主题数量不能超过 20；新建前检查上限。
- 非法 ID、内置 ID、回退 ID、重复 ID 不允许保存。
- 保存失败在页面内提示，不使用 `alert`；不丢失 draft。
- 取消勾选正在被使用的支持阶数时阻止保存；错误文案列出阶数，例如“该主题正在用于 8×8、9×9，请先在设置页为这些阶数选择其他主题。”
- 编辑器和设置页都不做自动保存。

### 6.10 离开页面

- 当前策略：返回、浏览器后退、刷新都直接丢弃编辑器 draft，不弹确认框。
- 与设置页一致，记录 TODO，后续再决定是否增加确认弹框。
- 保存成功后返回设置页；设置页重新加载存储，显示最新主题和分配。

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
- 主题导入/导出、设置迁移、数据清理 UI 属于后续扩展。

## 9. 文件与模块

| 文件/目录 | 职责 |
| --- | --- |
| `src/games/puzzle/types.ts` | `Theme`、`ColorMode`、`ThemeInnerBorder`、`AppearanceState`、`PuzzleSize` |
| `src/games/puzzle/core/appearance/presets.ts` | 内置主题、回退主题、默认盲玩色、默认 metrics |
| `src/games/puzzle/core/appearance/theme.ts` | 逐块取色、字体色解析、克隆、颜色校验 |
| `src/games/puzzle/core/appearance/metrics.ts` | metrics 归一化、CSS 变量（含内边框） |
| `src/games/puzzle/core/appearance/appearance.ts` | 默认/回退外观、按阶数解析、分配、覆盖、相等比较 |
| `src/games/puzzle/data/schema.ts` | 版本常量、Theme/AppearanceState 校验 |
| `src/games/puzzle/data/appearance-store.ts` | v4 读取、归一化、保存 |
| `src/games/puzzle/ui/game-theme-picker.ts` | 主题卡、覆盖徽标、回退警告、打开对话框 |
| `src/games/puzzle/ui/theme-assignment-dialog.ts` | “应用到”对话框 |
| `src/games/puzzle/ui/theme-coverage.ts` | 覆盖范围摘要、完整阶数列表和尺寸文案 |
| `src/games/puzzle/ui/theme-preview.ts` | 复用 BoardView 的主题预览 |
| `src/games/puzzle/ui/settings-page.ts` | `puzzle-theme` controller、保存条、读取状态、回退警告 |
| `src/games/puzzle/pages/game.ts` | 按阶数解析主题、回退提示 |
| `src/games/puzzle/pages/theme-editor.ts` | 编辑器组装、参数解析、draft、保存 |
| `src/games/puzzle/styles/board.css` | 内边框、字号内区域公式、逐块字体色 |
| `src/games/puzzle/styles/settings.css` | 主题卡、徽标、回退警告、对话框内容、响应式 |
| `src/games/puzzle/styles/overlays.css` / `dialog.css` | 设置页对话框基础样式 |
| `puzzle-game/settings.html` | 游戏主题 section 文案和挂载点；加载 board.css / dialog 样式 |
| `puzzle-game/theme-editor.html` | 编辑器真实页面 |
| `vite.config.ts` | 编辑器入口已存在，无需新增 |
| `docs/PUZZLE_THEME.md` | 本文件，主题与按阶数分配单一设计来源 |

模块约束：

- `core` 不碰 DOM / localStorage；`ui` 只做 DOM；`data` 负责归一化和持久化；`pages` 负责组装。
- 设置页主题列表不导入游戏 session、成绩、录像、图表或 IndexedDB。
- 主题编辑器不导入游戏输入/计时逻辑，只复用 `Theme`、`AppearanceState`、预览和存储。
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

### 10.4 P8-4c-2d 主题编辑器

- [ ] `theme-editor.html` 真实页面和 `pages/theme-editor.ts`。
- [ ] 支持阶数 2×5 网格、全选、使用中提示、阻止保存冲突。
- [ ] 逐块背景色 + 字体色（自动/固定）、批量操作、模式切换补齐/截断。
- [ ] 空白色、盲玩色、内边框、metrics。
- [ ] 预览最大支持阶数、数字显示/隐藏。
- [ ] 新建主题复制回退主题；保存/取消/错误提示。
- [ ] 更新 `SETTINGS_PAGE.md`、`PUZZLE_TASKS.md`。

### 10.5 P8-4c-2e 测试与验收

- [ ] `npm test`、`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm run build`。
- [ ] 设置页、游戏页、编辑器手动验收。
- [ ] E2E 在 P8-6 补充。
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

- [ ] 新建主题默认复制回退主题：18 个 `#3498db`、18 个 `auto`、透明边框/0、gap 0.06、radius 0。
- [ ] 支持阶数 2×5 网格，至少一个；预览按最大支持阶数渲染。
- [ ] 逐块背景色 + 字体色可编辑；`自动` 开关、批量操作和 `fixed` 99 项折叠可用。
- [ ] 切换模式时 palette/fontPalette 正确截断/补齐。
- [ ] 内边框颜色/宽度、盲玩色、metrics 可编辑并实时预览。
- [ ] 取消勾选正在被使用的阶数时出现错误并阻止保存；重新勾选后可保存。
- [ ] 内置主题无编辑入口；非法 `?theme=` 提示并返回。
- [ ] 保存后返回设置页，刷新仍生效；取消/返回不写存储。
- [ ] 保存失败保留 draft 和错误提示。

### 11.8 可访问性

- [ ] Tab 可到达主题卡按钮、编辑按钮、加号卡和对话框控件。
- [ ] Enter/Space 可打开主题卡对话框；Esc/取消关闭。
- [ ] 方向键不需要模拟 radio 行为；卡片是按钮语义。
- [ ] 覆盖徽标、回退状态都有文字说明，不只靠颜色。
- [ ] 回退警告可被读屏读出完整阶数；设置页不再有“当前分配”总览。
- [ ] 预览和徽标不抢焦点。
- [ ] 尊重 `prefers-reduced-motion`。

## 12. 测试点

### 12.1 核心纯函数

- `createDefaultAppearance()`：两套内置主题，所有阶数 `rainbow`。
- `createFallbackAppearance()`：两套内置主题，所有阶数 `fallback`。
- `createCustomThemeDraft()`：复制回退主题，`builtin: false`，`supportedSizes` 全部。
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
- 编辑器支持阶数、逐块字体色、内边框、盲玩色、冲突阻止、保存/取消。
- 键盘和窄屏。
- 本项目当前没有 DOM 测试环境；交互随 P8 手动验收，E2E 在 P8-6 补充。

## 13. 待讨论与 TODO

- **TODO（P8-4c-2）**：设置页和主题编辑器存在未保存修改时，离开前是否弹确认框；当前直接丢弃草稿。
- 自定义主题是否支持删除、重命名、排序；当前只有编辑和新建。
- 主题名称最大长度；当前只要求 `trim()` 后非空。
- 新建主题保存后是否自动分配阶数；当前不自动，用户回设置页手动选择。
- 是否为小支持范围缩短 `palette` / `fontPalette` 长度；当前固定 18/10/99，编辑器折叠未使用项。
- 是否需要“基于内置主题新建”的快捷入口；当前默认复制回退主题，可后续增加。
- 20 个主题时的低端设备性能；必要时给卡片加 `content-visibility` 或延迟渲染预览。
- 是否支持主题导入/导出、云同步、主题市场。
- 是否在成绩中保存 `themeId`，实现“按当时主题回放”。
- 是否需要维护入口清理 `puzzle.v2.appearance` 或旧版键。
- 网站深色主题与游戏主题的适配关系。

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
| 2026-10-24 | 盲玩色默认改为 `#3498db`；仍是主题级单色，所有非空方块统一 |
| 2026-10-24 | `fontColor` 改为逐块 `fontPalette`，长度与 `palette` 一致，每项 `auto` 或 `#rrggbb` |
| 2026-10-24 | 增加方块内边框 `innerBorder`；整盘统一；颜色支持透明，宽度 0–0.1；内置/回退/新建默认透明/0 |
| 2026-10-24 | 内边框不改变方块外尺寸；字号按“格子边长 − 2 × 内边框宽度”计算，文字通过 padding 限制在边框内 |
| 2026-10-24 | 边框颜色透明但宽度 >0 时仍占用内边距；不需要占位时宽度设为 0 |
| 2026-10-24 | 外观 envelope 升到 version 4；设置保持 version 3；不做 v3 → v4 迁移，清 `puzzle.v2.appearance` |
| 2026-10-24 | 编辑器取消勾选正在被使用的支持阶数时阻止保存 |
| 2026-10-24 | 新建主题默认复制回退主题；保存后不自动分配 |

## 15. 参考

- 设置页外壳与保存条：`docs/SETTINGS_PAGE.md`
- 拼图架构契约：`docs/PUZZLE_ARCHITECTURE.md`
- 存储设计：`docs/PUZZLE_STORAGE.md`
- P8 任务索引：`docs/PUZZLE_GAME_PAGE.md`
- 任务清单：`docs/PUZZLE_TASKS.md`
- 图标规范：`docs/ICONS.md`
- 重构总览：`docs/REFACTOR_PLAN.md`
- 旧版行为参考：`docs/PUZZLE_GAME.md`、git tag `pre-refactor-2026-10`
