# 数字华容道游戏主题与 P8-4c

> 状态：P8-4c-1 已实现（2026-10-24），待手动验收；P8-4c-2 主题编辑器待开始。
>
> 分支：`refactor/vite-ts`
>
> 说明：本文件是游戏主题领域模型、设置页主题列表和主题编辑器的单一设计来源。设置页外壳、分类导航、未保存提示条和全站偏好仍以 `docs/SETTINGS_PAGE.md` 为准；本文件只覆盖“设置 → 游戏主题”及其子页面。

## 0. 背景与目标

游戏主题只控制棋盘上方块的外观，不控制网站深浅色、页面背景、按钮或弹框。网站外观使用 `site.v1.preferences`，游戏主题使用 `puzzle.v2.appearance`，两者互不影响。

P8-4b 只完成了设置页骨架和“游戏主题”占位。P8-4c 拆成两个任务：

- **P8-4c-1 主题列表与选择**：在设置页展示内置/自定义主题，渲染 10×10 已复原棋盘预览，支持选中、保存、重置，以及进入编辑/新建主题的入口。
- **P8-4c-2 主题编辑器**：独立的 `theme-editor.html`，编辑主题名称、着色模式、色板、空白色、字体色、盲玩色和 metrics，保存后回到设置页。

本轮先做 P8-4c-1；P8-4c-2 的编辑器页面在 P8-4c-1 中只放最小占位页，避免加号/编辑入口点出 404。

目标：

- 复用现有 `Theme` / `AppearanceState` 数据模型，不新增 schema 版本。
- 复用设置页现有卡片选中态、保存条和焦点管理。
- 主题预览与游戏页使用同一套渲染逻辑，避免颜色和 metrics 漂移。
- 主题选择走 draft，用户点击设置页“保存”后才写 `puzzle.v2.appearance`。
- 内置主题只读；自定义主题可编辑。
- 自定义主题上限从 3 放宽到 20，同时保持 localStorage 体积可控。

非目标：

- 不实现网站深色主题。
- 不实现中英文翻译。
- 不实现主题导入/导出、云同步、排序或跨设备同步。
- 不实现自动保存。
- 不在本轮实现离开确认弹框；记录 TODO。
- 不迁移旧版主题配置；旧版 `config` 等键仍不读取。

## 1. 任务拆分

### 1.1 P8-4c-1 主题列表与选择

- 设置页 `#game-theme` section 从占位换成动态主题列表。
- 内置主题 + 自定义主题 + 加号卡。
- 每张主题卡渲染 10×10 已复原棋盘预览，显示数字、主题颜色、空白色、字号、间隙和圆角。
- 内置主题不显示编辑按钮，在编辑按钮的位置显示“内置”徽标；自定义主题显示铅笔编辑按钮。
- 点击主题卡只更新设置页 draft 中的 `activeThemeId`，底部保存条出现；保存时写入 `puzzle.v2.appearance`。
- 加号卡和编辑按钮跳转到 `theme-editor.html`；本轮页面只放占位内容。
- 新增 `plus` / `pencil` 图标和动态 `createIcon` 工具。
- 新增 `isAppearanceEqual` 纯函数，用于主题选择草稿的脏状态判断。
- 自定义主题上限从 3 改为 20；达到上限后加号卡禁用并显示提示。
- 更新设置页、任务、架构、存储和图标文档。

### 1.2 P8-4c-2 主题编辑器

- 新增独立页面 `/puzzle-game/theme-editor.html`。
- 新建：无查询参数；编辑：`?theme=<themeId>`。
- 编辑主题名称、着色模式（降阶/按行/固定色）、palette、空白色、字体色、盲玩隐藏数字颜色、字号/间隙/圆角。
- 原生 `<input type="color">`；实时预览；内置主题只读，新建时可复制内置主题作为初始值。
- 页面自己维护 draft，点击“保存”才写 `puzzle.v2.appearance`；“取消”/返回丢弃 draft。
- 保存时保留 `activeThemeId` 和其他主题，只更新目标主题。
- 编辑器页面不复用设置页的保存条；这是有意的两段式保存流程，详见第 5 节。
- 更新 E2E 和手动验收。

## 2. 领域模型

### 2.1 Theme

```ts
Theme {
  id: string
  name: string
  builtin: boolean

  color: {
    mode: 'layer' | 'row' | 'fixed'
    palette: readonly string[]   // layer 18 / row 10 / fixed 99
    blankColor: string           // 'transparent' 或 '#rrggbb'
    fontColor: string            // 'auto' 或 '#rrggbb'
  }

  blindTileColor: string         // '#rrggbb'，默认 '#66ccff'
  metrics: {
    fontSizeRatio: number        // 0–1
    gapRatio: number             // 0–0.1
    radiusRatio: number          // 0–0.5
  }
}
```

- 一个主题只对应一种着色模式；切换模式就是换一个主题，不做“一个主题支持多种模式”。
- 颜色绑定数字块，不绑定当前位置；打乱后颜色跟着数字移动。
- `palette` 长度由 mode 决定，不是由当前阶数决定。小阶数只使用前几项。
- `blankColor` 只用于空白块，默认 `transparent`，让棋盘背景透出。
- `fontColor` 为 `auto` 时按背景亮度自动选黑白；否则使用固定 `#rrggbb`。
- `blindTileColor` 只用于盲玩隐藏数字时的非空方块；空白块仍使用 `blankColor`。
- `metrics` 是主题级比例，以格子边长为基准，不保存固定像素。

### 2.2 着色模式

| mode | 含义 | palette 长度 | 取色索引 |
| --- | --- | --- | --- |
| `layer` | 降阶，按当前阶数的 L 形层取色 | 18 | `getTileLayer(tile, size) - 1` |
| `row` | 按数字块原本所属行取色 | 10 | `Math.floor((tile - 1) / size)` |
| `fixed` | 每个数字永久绑定一种颜色 | 99 | `tile - 1` |

最大层数为 `2 * size - 2`；10×10 正好用满 18 层。`row` 和 `fixed` 只用于自定义主题，内置主题没有这两种预设。

### 2.3 BoardMetrics

| 字段 | 范围 | 含义 |
| --- | --- | --- |
| `fontSizeRatio` | 0–1 | 字号 = 格子边长 × 比例 |
| `gapRatio` | 0–0.1 | 间隙 = 格子边长 × 比例 |
| `radiusRatio` | 0–0.5 | 圆角 = 格子边长 × 比例 |

读取时非数字、`NaN`、`Infinity` 回退默认值；有限但越界的值夹取到范围内。默认值为 `0.5 / 0.03 / 0.04`（取自彩虹主题）。

### 2.4 AppearanceState

```ts
AppearanceState {
  activeThemeId: string
  themes: Theme[]
}
```

- `themes` 至少包含两套内置主题。
- `activeThemeId` 必须能解析到 `themes` 中的某个主题，否则读取时回退第一个内置主题。
- 内置主题始终以代码里的 canonical 版本为准；存储里的内置主题数据读取时会被替换。
- 自定义主题按存储顺序追加在内置主题之后。

### 2.5 内置主题

| id | 名称 | 模式 | metrics | 其他 |
| --- | --- | --- | --- | --- |
| `rainbow` | 彩虹 | `layer` | `0.5 / 0.03 / 0.04` | 18 色高饱和；字体白色；空白透明；盲玩色 `#66ccff` |
| `rainbow-soft` | 彩虹微调 | `layer` | `0.5 / 0 / 0.01` | 18 色低饱和；字体白色；空白透明；盲玩色 `#66ccff` |

- `DEFAULT_THEME_ID = 'rainbow'`。
- 两套内置主题都不可编辑、不可删除、不可覆盖。
- 用户要调整内置主题的颜色或 metrics 时，在 P8-4c-2 中复制为自定义主题再编辑。

### 2.6 自定义主题

- `builtin: false`。
- `id` 非空字符串，不能与内置主题 ID 或其他主题重复；P8-4c-2 新建时生成唯一 ID。
- `name` trim 后非空；P8-4c-2 需要限制展示长度并处理卡片省略号。
- 可以使用 `layer` / `row` / `fixed` 任意一种模式。
- 最多 20 个。`CUSTOM_THEME_SLOT_COUNT = 20` 是数据校验和 UI 的共同上限。
- 归一化时非法 palette、非法颜色、非法 metrics、重复 ID、内置 ID 和 `builtin: true` 的主题会被丢弃；可恢复的 metrics、空白色和字体色按规则回退。
- 自定义主题只保存必要数据，不保存预览 DOM、主题卡片顺序或 UI 状态。

### 2.7 不变量

- `Theme.color.palette` 长度必须等于对应 mode 的约定值，全部为 `#rrggbb`。
- `blankColor` 允许 `transparent` 或 `#rrggbb`。
- `fontColor` 允许 `auto` 或 `#rrggbb`。
- `blindTileColor` 必须是 `#rrggbb`。
- `metrics` 必须在约定范围内；读取时归一化。
- `AppearanceState.themes` 至少包含两套内置主题；自定义主题不超过 20 个。
- `activeThemeId` 必须能解析到已有主题；否则回退第一个内置主题。
- 任何写操作返回新对象；不原地修改内置主题常量或调用方传入的对象。

### 2.8 不属于 Theme 的数据

- 网站深浅色、语言：`site.v1.preferences`。
- 拼图阶数、游戏模式、操作模式、当前分组、自定义光标、极简 UI：`puzzle.v2.settings`。
- 成绩、录像：IndexedDB `puzzle.v2`。

游戏主题只影响方块渲染；页面背景、文字、按钮、边框和弹框使用 `src/shared/styles/base.css` 的语义 token。

## 3. 存储

### 3.1 位置

```text
localStorage key: puzzle.v2.appearance
envelope: { version: 3, data: AppearanceState }
```

- 读取使用 `loadAppearanceResult()`，返回 `ok` / `missing` / `corrupt` / `unavailable` 和一份可用的 `AppearanceState`。
- 写入使用 `saveAppearance()`，写入前统一归一化。
- 不新增 localStorage key，不修改 `SCHEMA_VERSION = 3`，不新增 IndexedDB store。
- 旧版主题配置不迁移；新实现不读取旧键。

### 3.2 上限从 3 改为 20

- `CUSTOM_THEME_SLOT_COUNT` 从 `3` 改为 `20`。
- 归一化最多保留前 20 个合法自定义主题。
- 存储体积估算：`fixed` 模式最重，99 个颜色约 1KB JSON；20 个全按最重计算约 20–25KB，远低于 localStorage 常见 5MB 配额。
- 主题数据不是性能瓶颈；主要成本是设置页渲染 22+ 张卡片的 100 格预览。当前规模可接受；如果低端设备滚动卡顿，再给卡片加 `content-visibility` 或延迟渲染。
- 上限变更不改 schema；已保存的 0–3 个自定义主题不需要迁移。

### 3.3 多标签页与覆盖

- 不做多标签页实时同步。
- 设置页保存主题选择时会写入完整的 `AppearanceState` 快照；编辑器页保存主题内容时也会写入完整快照。
- 两个页面同时打开并分别保存时，按最后一次写入覆盖，不做合并。这是当前存储策略的已知取舍，文档不承诺跨标签页冲突解决。

## 4. 设置页主题列表（P8-4c-1）

### 4.1 信息架构

设置页外壳、左侧导航、`#game-theme` hash、底部保存条不变。只替换“游戏主题” section 的内容：

```text
游戏主题
选择棋盘主题。内置主题不可编辑；自定义主题可以调整颜色、字号、间隙与圆角。

┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
│  10×10     │ │  10×10     │ │  10×10     │ │            │
│  已复原棋盘 │ │  已复原棋盘 │ │  已复原棋盘 │ │     +      │
│            │ │            │ │            │ │            │
│ 彩虹   内置 │ │ 彩虹微调 内置│ │ 我的主题 ✎ │ │            │
└────────────┘ └────────────┘ └────────────┘ └────────────┘
```

- 内置主题在前，自定义主题按存储顺序在后，最后是加号卡。
- 当前选中的主题显示主题蓝边框、浅蓝背景和右上角勾选标记，与网站外观卡一致。
- 说明文案使用“选择棋盘主题。内置主题不可编辑；自定义主题可以调整颜色、字号、间隙与圆角。”

### 4.2 主题卡结构

推荐 DOM 结构（实现时可微调类名，但语义保持不变）：

```html
<div class="theme-card theme-card--game" data-theme-id="rainbow">
  <input
    class="theme-card__input"
    type="radio"
    name="activeThemeId"
    value="rainbow"
    id="game-theme-option-0"
    aria-label="彩虹（内置主题）"
    checked
  />
  <div class="theme-card__surface">
    <div class="theme-card__preview" aria-hidden="true">
      <!-- 10×10 board-view -->
    </div>
    <div class="theme-card__footer">
      <span class="theme-card__title" title="彩虹">彩虹</span>
      <span class="settings-badge">内置</span>
    </div>
    <span class="settings-check" aria-hidden="true">
      <svg class="icon" viewBox="0 0 24 24"><use href="#icon-check"></use></svg>
    </span>
    <label class="theme-card__hitarea" for="game-theme-option-0"></label>
  </div>
  <!-- 自定义主题才渲染编辑按钮 -->
  <a class="theme-card__edit" href="/puzzle-game/theme-editor.html?theme=custom-1"
     aria-label="编辑主题：我的主题" title="编辑主题">
    <svg class="icon" viewBox="0 0 24 24"><use href="#icon-pencil"></use></svg>
  </a>
</div>
```

要点：

- 棋盘预览里有 `div`，不能直接把整个卡片做成 `<label>`；卡片表面用 `div`，上面盖一层透明的 `<label for>` 负责整卡选中。
- 编辑按钮放在 `label` 外面，点击编辑不会触发选中。
- 原生 radio 仍按 `name="activeThemeId"` 分组，支持方向键切换。
- 预览加 `aria-hidden="true"`；radio 的 `aria-label` 包含主题名，内置主题追加“内置主题”。
- 名字过长时省略号 + `title`；`footer` 为编辑按钮预留右侧空间。
- 内置主题在编辑按钮的位置显示“内置”徽标；自定义主题显示铅笔图标按钮。
- 主题卡和加号卡使用同一套卡片尺寸约束，换行后加号卡仍与主题卡同高。

### 4.3 10×10 预览

- 使用 `createSolvedBoard(10)` 生成 `[1, 2, …, 99, 0]`。
- 复用 `ui/board-view.ts` 和 `styles/board.css`，让预览与游戏页使用同一套取色、空白色、字号、间隙、圆角逻辑。
- 预览外层加 `aria-hidden="true"` 和 `pointer-events: none`；预览不参与交互，不抢焦点。
- 预览不额外加内嵌边框或背景，棋盘直接放在主题卡表面上，宽约 `14rem`，默认显示数字。
- 主题的 `blankColor` 为 `transparent` 时，空白块和方块间隙直接透出卡片背景；选中卡片的浅蓝背景也会透出。
- 预览模块建议拆成 `ui/theme-preview.ts` 的 `createThemePreview({ theme, size?, numbersVisible? })`，P8-4c-2 编辑器可以复用同一模块做实时预览。
- 设置页需要额外加载 `board.css`，但不加载 `game.css`。

### 4.4 加号卡

- 所有主题之后追加一张同样大小的卡片。
- 视觉上只有一个大号加号，使用 `plus` 图标；不显示可见文字。
- 使用 `<a>` 跳转 `/puzzle-game/theme-editor.html`；`aria-label` 和 `title` 为“新建主题”。
- 使用虚线边框和弱化颜色，与可选择主题卡区分；悬停时使用主题蓝提示可点击。
- 当前自定义主题数量达到 20 时，加号卡置灰禁用，设置 `aria-disabled="true"`，阻止跳转，并显示“最多创建 20 个自定义主题。”的说明。
- 加号卡不属于 radio 组，不参与主题选中。

### 4.5 布局与响应式

- 主题卡网格使用 `repeat(auto-fit, minmax(15rem, 1fr))`：大屏约 3 列，中等宽度 2 列，窄屏 1 列。
- 预览棋盘约 `14rem`；如果在实际设备上数字仍偏小，把最小列宽调到 `20rem` 即可变成 2 列并继续放大，不需要改结构。
- 移动端沿用设置页单列布局；卡片、编辑按钮和加号卡都必须可点，不出现横向滚动。
- 主题卡数量最多 22 张（2 内置 + 20 自定义）+ 1 张加号卡；页面变长时可以滚动，底部保存条不遮挡最后一行。

### 4.6 可访问性

- 主题选择使用原生 radio；视觉卡片只负责呈现，不伪造 radio 语义。
- 每个 radio 有可读的 `aria-label`，包含主题名和是否内置。
- 预览和勾选标记为装饰性内容，`aria-hidden="true"`。
- 编辑按钮是独立的链接，`aria-label` 为“编辑主题：<名称>”，不与卡片选中冲突。
- 加号卡是独立链接，`aria-label` 为“新建主题”。
- 焦点环落在卡片表面；Tab 顺序为当前选中的 radio → 编辑按钮/加号卡。
- 达到上限的加号卡不仅靠颜色表达禁用，还要有可见说明和 `aria-disabled`。
- 尊重 `prefers-reduced-motion`；主题卡和保存条沿用设置页现有规则。

### 4.7 读取、草稿与保存

- 设置页启动时同时读取全站偏好和 `puzzle.v2.appearance`。
- 主题列表使用 `loadAppearanceResult()` 的归一化结果渲染；读取状态与偏好读取状态合并显示在现有顶部 banner：
  - `corrupt`：提示数据损坏，保存后覆盖；
  - `unavailable`：提示浏览器存储不可用；
  - `missing` / `ok`：静默使用默认值。
- 设置页维护 `saved` / `draft` 两份 `AppearanceState`：
  - 点击主题卡只更新 `draft.activeThemeId`；
  - `isDirty` 使用新增的 `isAppearanceEqual(saved, draft)` 判断；
  - 底部保存条出现/消失沿用现有逻辑；
  - “重置”恢复 `saved`，不写 localStorage；
  - “保存”调用 `saveAppearance(draft)`，成功后用归一化结果更新 `saved` / `draft` 并重新渲染卡片；
  - 保存失败保留 draft 和保存条，错误显示在保存条内。
- 保存主题选择时写入完整的 `AppearanceState`；由于设置页渲染时已加载完整主题列表，正常流程不会丢失主题内容。
- 设置页保存只负责“选择哪个主题”和全站偏好，不编辑主题内容。
- 返回游戏页后重新加载 `puzzle.v2.appearance`，新主题才会生效；设置页内选择不即时影响游戏页。

### 4.8 与全站偏好的关系

- 主题选择和网站外观/语言共用同一个底部保存条。
- 保存顺序沿用当前 controller 顺序；任一 controller 失败则保留保存条并显示错误。
- 主题选择和网站偏好在不同存储 key，不要求跨 key 原子性。
- 主题内容编辑在独立页面保存，不进入设置页保存条；详见第 5 节。

## 5. 主题编辑器（P8-4c-2）

### 5.1 页面与路由

```text
/puzzle-game/theme-editor.html                 新建主题
/puzzle-game/theme-editor.html?theme=<themeId> 编辑自定义主题
```

- 返回链接固定指向 `/puzzle-game/settings.html#game-theme`。
- 内置主题没有编辑入口；`?theme=rainbow` 或 `?theme=rainbow-soft` 视为非法编辑目标，页面提示并返回设置页。
- 不存在的主题 ID、损坏数据、非法参数都显示非阻塞错误和返回设置页入口，不崩溃。
- P8-4c-1 先提供占位页；P8-4c-2 再替换为真实编辑器。

### 5.2 为什么使用独立 HTML 页面

- 编辑器控件多（名称、模式、18/10/99 色板、空白色、字体色、盲玩色、三个 metrics 滑杆）且需要较大预览区；独立页面可以全宽布局，不受设置页 260px 导航和内容列限制。
- 设置页只负责“选择主题”，控制器简单；编辑器代码不进入设置页包体，符合运行时轻量原则。
- 编辑器需要自己的保存/取消语义；独立页面比在设置页里扩展嵌套 hash 和两套 dirty 状态更清晰。
- 与现有 Vite MPA 结构一致：`puzzle.html` / `settings.html` / `score-list.html` / `replay.html` 之外新增 `theme-editor.html`。
- 代价是两段式保存：设置页保存条负责主题选择，编辑器页自己负责主题内容。用户离开设置页进入编辑器时，未保存的主题选择会被丢弃；这符合当前“离开即丢弃草稿”的策略，后续用确认弹框改进。

### 5.3 草稿与保存

- 编辑器页读取 `loadAppearanceResult()`，找到目标主题；新建时生成一个新的自定义主题草稿。
- 所有颜色、模式和 metrics 修改只更新页面内 draft，不写 localStorage，不即时影响游戏页。
- “保存”：
  1. 校验名称、palette 长度、颜色格式、metrics 范围和主题数量；
  2. 将目标主题合并回完整的 `AppearanceState`；
  3. 保留原 `activeThemeId` 和其他主题；
  4. 调用 `saveAppearance(nextAppearance)`；
  5. 成功后返回设置页 `#game-theme`。
- “取消”/返回：丢弃 draft，不写存储。
- 新建主题保存后默认不自动设为当前主题；用户回设置页后自行选择。此行为在 P8-4c-2 实现前可再确认。
- 保存失败时保留 draft，显示错误，不自动离开页面。
- 不允许在每次选色/拖动滑杆时直接调用 `saveAppearance`。

### 5.4 编辑器内容

- 主题名称。
- 着色模式：降阶 / 按行 / 固定色；切换模式时按新模式补齐/截断 palette，并在 UI 中提示影响。
- 色板：layer 18 色、row 10 色、fixed 99 色；原生 `<input type="color">`。
- 空白色：`transparent` 或固定色。
- 字体色：`auto` 或固定色。
- 盲玩隐藏数字颜色：`#rrggbb`。
- metrics：字号、间隙、圆角。
- 实时预览：默认 10×10 已复原棋盘，可切换数字可见/盲玩预览；P8-4c-2 再定最终布局。
- 新建时可以复制一套内置主题作为初始值；内置主题本身不被修改。
- 编辑内置主题的入口不存在；如果将来提供“基于内置主题新建”，走复制流程。

### 5.5 校验与错误

- 名称 trim 后不能为空；具体最大长度在 P8-4c-2 决定。
- palette 长度必须与模式匹配；所有颜色必须是 `#rrggbb`。
- `blankColor` 允许透明或 `#rrggbb`；`fontColor` 允许 `auto` 或 `#rrggbb`；`blindTileColor` 必须是 `#rrggbb`。
- metrics 按现有 `normalizeMetrics` 范围处理；越界时夹取或提示。
- 自定义主题数量不能超过 20；新建前检查上限。
- 非法主题 ID、内置主题 ID、重复 ID 不允许保存。
- 保存失败使用页面内错误提示，不使用 `alert`；不丢失用户 draft。
- 编辑器和设置页都不做自动保存。

### 5.6 离开页面

- 当前策略：返回、浏览器后退、刷新都直接丢弃编辑器 draft，不弹确认框。
- 与设置页一致，记录 TODO，后续再决定是否增加确认弹框。
- 保存成功后返回设置页；设置页重新加载存储，显示最新主题。

## 6. 数据与兼容

- 不修改 `AppearanceState`、`Theme`、`ColorMode`、`BoardMetrics` 的结构。
- `SCHEMA_VERSION` 保持 3；`puzzle.v2.appearance` envelope 不变。
- 自定义主题上限从 3 改为 20，属于校验策略变更，不涉及数据迁移。
- 已有 0–3 个自定义主题的数据继续有效；超过 20 个的异常数据在读取时截断。
- 旧版 `config` / `scores` / `currentScore` / `currentScoreList` 仍不读取；主题编辑器不提供旧主题迁移。
- 不新增 IndexedDB 数据；成绩和录像不受影响。
- 设置页保存主题选择与编辑器保存主题内容都按“最后写入覆盖”处理，不提供多标签页合并。

## 7. 文件与模块

| 文件/目录 | 职责 |
| --- | --- |
| `puzzle-game/settings.html` | 游戏主题 section 挂载点；引入 `board.css` |
| `puzzle-game/theme-editor.html` | 编辑器入口；P8-4c-1 为占位页，P8-4c-2 替换 |
| `src/games/puzzle/pages/settings.ts` | 设置页启动与错误兜底 |
| `src/games/puzzle/pages/theme-editor.ts` | 编辑器页启动、参数解析、draft 组装（P8-4c-2） |
| `src/games/puzzle/ui/settings-page.ts` | 设置页外壳、保存条、主题选择 controller |
| `src/games/puzzle/ui/game-theme-picker.ts` | 主题卡、加号卡、选中事件、编辑/新建链接 |
| `src/games/puzzle/ui/theme-preview.ts` | 复用 BoardView 的主题预览，设置页与编辑器共用 |
| `src/games/puzzle/styles/settings.css` | 设置页主题卡、棋盘预览布局、编辑按钮、加号卡、响应式 |
| `src/games/puzzle/styles/board.css` | 复用现有棋盘网格/方块样式；设置页加载 |
| `src/games/puzzle/core/appearance/appearance.ts` | 主题状态纯函数；新增 `isAppearanceEqual` |
| `src/games/puzzle/core/appearance/appearance.test.ts` | 相等比较与上限测试 |
| `src/games/puzzle/data/appearance-store.ts` | 读取、归一化、保存 `puzzle.v2.appearance` |
| `src/games/puzzle/data/appearance-store.test.ts` | 上限 20、归一化与往返测试 |
| `src/shared/icons/sprite.svg` | 新增 `plus` / `pencil` |
| `src/shared/icons/create-icon.ts` | 动态创建 `<svg class="icon"><use href="#icon-...">` |
| `vite.config.ts` | 新增 `puzzleThemeEditor` 构建入口 |
| `docs/PUZZLE_THEME.md` | 本文件，游戏主题单一设计来源 |
| `docs/SETTINGS_PAGE.md` | 设置页外壳、保存条、导航；链接本文件 |
| `docs/ICONS.md` | 登记 `plus` / `pencil` 和 `createIcon` |

模块约束：

- `core` 不碰 DOM / localStorage；`ui` 只做 DOM；`data` 负责归一化和持久化；`pages` 负责组装。
- 设置页主题列表不导入游戏 session、成绩、录像、图表或 IndexedDB。
- 主题编辑器不导入游戏页输入/计时逻辑，只复用 `Theme`、`AppearanceState`、预览和存储。
- 不新增运行时依赖。

## 8. 实现步骤

### 8.1 P8-4c-1

- [x] 把 `CUSTOM_THEME_SLOT_COUNT` 改为 20，更新相关测试。
- [x] 新增 `isAppearanceEqual` 与测试。
- [x] 新增 `plus` / `pencil` 图标和 `createIcon` 工具。
- [x] 新增 `ui/theme-preview.ts`。
- [x] 新增 `ui/game-theme-picker.ts`，渲染主题卡、加号卡、选中事件。
- [x] `settings.html` 游戏主题 section 改挂载点，引入 `board.css`。
- [x] `settings-page.ts` 接入 appearance 读取/保存 controller，合并读取状态提示。
- [x] `settings.css` 完成主题卡、预览、编辑按钮、加号卡和响应式。
- [x] 新增 `theme-editor.html` 占位页和 Vite 入口。
- [x] 更新 `PUZZLE_THEME.md`、`SETTINGS_PAGE.md`、`PUZZLE_GAME_PAGE.md`、`PUZZLE_TASKS.md`、`PUZZLE_ARCHITECTURE.md`、`PUZZLE_STORAGE.md`、`REFACTOR_PLAN.md`、`ICONS.md`、`PUZZLE_SCORE_PAGE.md`。
- [x] 运行 `npm test`、`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm run build`。

实现备注（2026-10-24）：

- 主题卡由 `ui/game-theme-picker.ts` 从归一化后的 `AppearanceState` 动态渲染；内置主题在前，自定义主题按存储顺序，最后是加号卡。
- 10×10 预览由 `ui/theme-preview.ts` 复用 `board-view` 渲染，设置页额外加载 `board.css`。
- 设置页新增 `puzzle-theme` controller，只更新 `activeThemeId`；保存时归一化并写入完整 `puzzle.v2.appearance`。
- `theme-editor.html` 目前是占位页，加号/编辑入口已可跳转并返回 `#game-theme`。
- 自定义主题上限为 20；达到上限时加号卡置灰禁用并显示说明。
- 自动检查已通过；手动验收待用户启动开发服务器后执行。

### 8.2 P8-4c-2

- [ ] 实现 `theme-editor.html` 真实页面和 `pages/theme-editor.ts`。
- [ ] 实现名称、模式、色板、空白色、字体色、盲玩色和 metrics 编辑。
- [ ] 实现实时预览和盲玩预览。
- [ ] 实现新建/编辑/复制内置主题、校验、保存和返回。
- [ ] 增加编辑器页 E2E。
- [ ] 补充手动验收。
- [ ] 根据用户反馈决定是否加入离开确认弹框。

## 9. 验收

### 9.1 自动检查

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

### 9.2 P8-4c-1 手动检查

主题列表：

- [ ] 设置页进入“游戏主题”，看到两套内置主题，顺序为彩虹、彩虹微调。
- [ ] 每张卡显示 10×10 已复原棋盘，数字可见，颜色/空白色/字号/间隙/圆角与主题一致。
- [ ] 内置主题右侧显示“内置”徽标，不显示编辑按钮。
- [ ] 自定义主题（可用下方测试数据）显示铅笔编辑按钮。
- [ ] 点击主题卡选中效果与网站外观卡一致：主题蓝边框、浅蓝背景、右上角勾选。
- [ ] 点击编辑按钮不会改变当前选中主题。
- [ ] 所有主题之后显示加号卡，只有加号，点击进入 `theme-editor.html`。
- [ ] 自定义主题达到 20 个时，加号卡禁用并显示上限说明。
- [ ] 主题名过长时省略号显示，`title` 有完整名称。
- [ ] 窄屏下 3/2/1 列切换正常，无横向滚动。

#### 测试数据

手动测试自定义主题/20 个上限时，可先在 DevTools 备份并写入测试数据（会覆盖当前外观数据）：

```js
const base = {
  builtin: false,
  color: {
    mode: 'layer',
    palette: [
      '#e74c3c',
      '#e67e22',
      '#f1c40f',
      '#2ecc71',
      '#1abc9c',
      '#3498db',
      '#9b59b6',
      '#34495e',
      '#e84393',
      '#00b894',
      '#fdcb6e',
      '#6c5ce7',
      '#d63031',
      '#0984e3',
      '#00cec9',
      '#b2bec3',
      '#636e72',
      '#2d3436',
    ],
    blankColor: 'transparent',
    fontColor: '#ffffff',
  },
  blindTileColor: '#66ccff',
  metrics: { fontSizeRatio: 0.5, gapRatio: 0.03, radiusRatio: 0.04 },
};
const themes = Array.from({ length: 20 }, (_, index) => ({
  ...base,
  id: `custom-test-${index + 1}`,
  name: `测试主题 ${index + 1}`,
}));
localStorage.setItem(
  'puzzle.v2.appearance',
  JSON.stringify({
    version: 3,
    data: { activeThemeId: themes[0].id, themes },
  }),
);
location.reload();
```

测试完成后删除 `puzzle.v2.appearance` 或恢复备份；删除后会回到两套内置主题。

保存流程：

- [ ] 选择另一个主题后出现未保存提示条。
- [ ] 点击“重置”恢复上次保存的选中主题，提示条消失。
- [ ] 点击“保存”后提示条消失；刷新后选中主题仍保留。
- [ ] `localStorage['puzzle.v2.appearance']` 的 `activeThemeId` 更新，版本仍为 3。
- [ ] 保存失败时提示条保留，错误可见，draft 不丢。
- [ ] 点击返回、浏览器后退、刷新都会丢弃未保存的主题选择。
- [ ] 切换设置分类不丢主题选择 draft。

读取与错误：

- [ ] 缺失外观数据时静默显示两套内置主题。
- [ ] `corrupt` 时使用归一化结果并显示警告；保存后覆盖。
- [ ] localStorage 不可用时页面仍渲染，显示存储不可用提示。
- [ ] 编辑器占位页可打开、可返回设置页 `#game-theme`。
- [ ] 无控制台错误。

可访问性：

- [ ] Tab 可到达当前选中主题的 radio、编辑按钮和加号卡。
- [ ] 方向键可在主题之间切换。
- [ ] 内置/禁用状态不只靠颜色表达。
- [ ] 预览不进入无障碍树，不产生噪声。

### 9.3 P8-4c-2 手动检查

实现 P8-4c-2 时补充：

- [ ] 三种模式、18/10/99 色板、空白色、字体色、盲玩色、metrics 可编辑并实时预览。
- [ ] 内置主题不被修改；复制内置主题后编辑的是自定义主题。
- [ ] 新建/编辑保存后刷新仍生效，返回设置页显示更新后的卡片。
- [ ] 取消/返回丢弃 draft，不写存储。
- [ ] 非法名称、颜色、palette 长度和数量上限有可见错误。
- [ ] 保存失败保留 draft。

## 10. 测试点

### 10.1 `isAppearanceEqual`

- 相同 `activeThemeId` 和主题列表返回 `true`。
- `activeThemeId` 不同返回 `false`。
- 主题顺序、数量、id、name、builtin 不同返回 `false`。
- `color.mode`、palette 任意一项、`blankColor`、`fontColor` 不同返回 `false`。
- `blindTileColor` 不同返回 `false`。
- 任一 metrics 字段不同返回 `false`。
- 不修改入参。

### 10.2 上限 20

- `CUSTOM_THEME_SLOT_COUNT === 20`。
- 归一化最多保留 20 个自定义主题。
- 21 个自定义主题时只保留前 20 个合法项。
- 内置主题仍固定两套，不受上限影响。
- 保存后读取可往返。

### 10.3 手动 DOM

- 设置页主题卡渲染、选中、编辑/加号链接、保存条、重置、保存失败、上限提示。
- 键盘与移动端。
- 读取状态 banner。
- 不做 DOM 单元测试；项目当前没有 DOM 测试环境，交互随 P8 手动验收，E2E 在 P8-4c-2/P8-6 补充。

## 11. 待讨论与 TODO

- **TODO（P8-4c）**：设置页和主题编辑器存在未保存修改时，离开前是否弹确认框；当前版本直接丢弃草稿，后续再决定。
- P8-4c-2 新建主题保存后是否自动设为当前主题；当前倾向不自动切换。
- 自定义主题是否支持命名规则、删除、排序；P8-4c-2 再决定。
- 编辑器页最终布局（左侧控件 + 右侧 sticky 预览，或上下布局）。
- 主题名称最大长度与 i18n 文案。
- 20 个主题时的低端设备性能；必要时给卡片加 `content-visibility` 或延迟渲染预览。
- 是否需要“基于内置主题新建”的快捷入口。

## 12. 决策记录

| 日期 | 决策 |
| --- | --- |
| 2026-10-24 | P8-4c 拆成 P8-4c-1（设置页主题列表/选择）和 P8-4c-2（独立编辑器页） |
| 2026-10-24 | 自定义主题上限从 3 放宽到 20；不升 schema version |
| 2026-10-24 | 内置主题在编辑按钮位置显示“内置”徽标；自定义主题显示铅笔按钮 |
| 2026-10-24 | 主题卡预览使用 10×10 已复原棋盘并显示数字，复用 BoardView |
| 2026-10-24 | 主题卡网格自动 3/2/1 列，预览约 14rem；数字偏小时可切 2 列 |
| 2026-10-24 | 加号卡只有加号；达到 20 个后置灰禁用并提示上限 |
| 2026-10-24 | 主题编辑器使用独立 `theme-editor.html`，自己有 draft/保存/取消 |
| 2026-10-24 | 设置页保存条负责主题选择和全站偏好；编辑器页保存主题内容 |
| 2026-10-24 | 离开设置页/编辑器直接丢弃草稿；确认弹框记录 TODO |
| 2026-10-24 | 新增 `plus` / `pencil` 图标和 `createIcon` 工具 |

## 13. 参考

- 设置页外壳与保存条：`docs/SETTINGS_PAGE.md`
- 拼图架构契约：`docs/PUZZLE_ARCHITECTURE.md`
- 存储设计：`docs/PUZZLE_STORAGE.md`
- P8 任务索引：`docs/PUZZLE_GAME_PAGE.md`
- 任务清单：`docs/PUZZLE_TASKS.md`
- 图标规范：`docs/ICONS.md`
- 重构总览：`docs/REFACTOR_PLAN.md`
- 旧版行为参考：`docs/PUZZLE_GAME.md`、git tag `pre-refactor-2026-10`
