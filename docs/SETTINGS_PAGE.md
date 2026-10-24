# 设置页设计与 P8-4b/P8-4c 任务

> 状态：P8-4b 设置页骨架与网站偏好已实现（2026-10-24），待手动验收；P8-4c 拆成 P8-4c-1 主题列表与 P8-4c-2 独立主题编辑器，P8-4c-1 已实现（2026-10-24），待手动验收；P8-4c-2 待开始。
>
> 分支：`refactor/vite-ts`
>
> 说明：本文件是设置页外壳、分类导航、保存条和全站偏好的单一设计来源；游戏主题模型、主题列表和编辑器细节以 `docs/PUZZLE_THEME.md` 为准。`docs/PUZZLE_GAME_PAGE.md` 只保留 P8 总览和任务索引。

## 0. 背景与目标

旧版拼图把设置放在游戏页的模态框里，P8-4b 原计划也沿用这个方向。但随着设置项增加，模态框会变得越来越拥挤，也不利于后续添加多语言、游戏主题、数据管理等分类。新版改为独立设置页，整体信息架构参考 Modrinth 的设置页：

- 左侧分类导航，右侧内容卡片；
- 顶部返回按钮和页面标题；
- 修改不立即生效，底部出现“未保存的修改”提示条；
- 保存后统一应用，重置撤销本次修改；
- 返回、浏览器后退、刷新直接丢弃未保存的草稿。

P8-4b 的目标是把设置页的骨架、网站偏好和保存流程做扎实，而不是一次性完成所有设置项。页面必须方便后续增加分类，不引入 Vue/React，也不新增 UI 依赖。

## 1. 任务边界

### 1.1 P8-4b 本轮范围

- 新增独立设置页 `/puzzle-game/settings.html`。
- 分类导航：显示设置（外观、语言）、游戏（游戏主题）、更多（关于）。
- 网站外观：浅色可选；跟随系统、深色置灰并标记“开发中”。
- 语言：中文、English 均可选；保存语言偏好，但本轮不实现界面翻译。
- 游戏主题：只做分类和占位内容，不读写现有外观数据。
- 关于：仓库、GitHub、邮箱、存储说明。
- 底部未保存提示条：重置、保存、错误提示、键盘可访问。
- 新增全站偏好存储 `site.v1.preferences`，与拼图设置/外观分开。
- 定义全站主题色 `#3498DB`，接入设置页选中项和游戏页弹框选中项。
- 游戏页设置按钮改为跳转设置页；运行中、重玩中、保存中禁用。
- 补充单元测试、文档和构建入口。

### 1.2 P8-4c 后续范围（已拆分）

原 P8-4b 的完整外观编辑器拆成两个任务，详细设计见 `docs/PUZZLE_THEME.md`：

- **P8-4c-1 主题列表与选择**（本轮）：
  - 设置页 `#game-theme` 从占位换成动态主题列表；
  - 10×10 已复原棋盘预览，显示数字、主题颜色和 metrics；
  - 内置主题显示“内置”徽标，自定义主题显示编辑按钮；
  - 加号卡跳转主题编辑器；
  - 主题选择纳入设置页草稿/保存条，保存时写入 `puzzle.v2.appearance`；
  - 自定义主题上限从 3 放宽到 20；
  - 新增 `theme-editor.html` 最小占位页。
- **P8-4c-2 主题编辑器**（后续）：
  - 独立 `/puzzle-game/theme-editor.html`；
  - 两套内置降阶主题；自定义主题支持降阶/按行/固定色；
  - 18/10/99 色板编辑；
  - 空白色、字体色（auto 或固定色）、盲玩隐藏数字颜色；
  - 每个主题独立的字号/间隙/圆角；
  - 原生 `<input type="color">`、实时预览；
  - 内置主题只读，修改时复制为自定义主题；
  - 编辑器页面自己维护 draft，点击“保存”后才落库。

P8-4c-1 的主题选择走设置页 draft，P8-4c-2 的主题内容走编辑器页 draft；两者都不允许在每次修改时直接调用 `saveAppearance`。

### 1.3 本轮非目标

- 不实现深色主题 CSS。
- 不实现中英文翻译。
- 不实现游戏主题编辑器和外观数据读写。
- 不实现自动保存。
- 不添加 `beforeunload` 离开确认。
- 不在首页增加设置入口。
- 不做导入导出、云同步、账号、数据清理。
- 不迁移旧数据；新 key 从默认值开始。
- 不修改拼图核心逻辑、成绩或录像数据。

## 2. 页面与路由

### 2.1 路径

```text
/puzzle-game/settings.html
```

本轮页面放在拼图路径下，避免过早占用全站根路径；但“外观/语言”属于全站偏好，存储设计不按拼图私有数据处理，详见第 6 节。

### 2.2 返回

左上角返回按钮固定指向：

```text
/puzzle-game/puzzle.html
```

按钮复用游戏页重玩状态栏的 `exit-retry` 图标（Lucide `undo-2`），`aria-label="返回游玩页面"`，`title="返回游玩页面"`。本轮不解析 `from` 查询参数，也不使用 `history.back()`，避免从新标签页打开时退到站外。

返回行为：

- 未保存修改直接丢弃，不弹确认框。
- 已保存修改保留。
- 返回后游戏页重新加载，按当前 settings 开始新的一局。

### 2.3 分类与 hash

分类使用 hash 深链接：

| 分类     | hash         |
| -------- | ------------ |
| 外观     | `#appearance` |
| 语言     | `#language`   |
| 游戏主题 | `#game-theme` |
| 关于     | `#about`      |

规则：

- 首次加载读取 `location.hash`，合法值直接显示对应分类。
- 缺失、未知或已移除的 hash 回退到 `#appearance`。
- 用户点击分类时使用 `history.replaceState` 更新 hash，不向历史栈追加分类记录。
- 因此浏览器“后退”会离开设置页，而不是在分类之间循环。
- 刷新后保留分类 hash，但未保存草稿丢失。
- 切换分类不丢草稿；切到“关于”时，如果其他分类有未保存修改，底部提示条仍然显示。
- 用户主动切换分类后，把焦点移到该分类标题（标题加 `tabindex="-1"`），让键盘和屏幕阅读器用户知道内容已切换；首次加载不主动抢焦点。

### 2.4 打开设置页的游戏状态限制

设置页是独立页面，进入后游戏页会卸载，当前局无法恢复。因此保留旧设计的安全约束：

```ts
function canOpenSettings(): boolean {
  return (
    !isBusy() &&
    !retryMode &&
    session !== null &&
    (session.phase === 'observing' || session.phase === 'solved') &&
    pendingSettlements.length === 0
  );
}
```

- 允许：观察阶段、已完成阶段。
- 禁用：运行中、保存中、重玩中（包括重玩加载和重玩完成）、存在待保存成绩时。
- 首次加载尚未创建 session 时禁用。
- 禁用时设置链接保持可聚焦，但阻止默认跳转，设置 `aria-disabled="true"`，并显示原因：
  - 运行中：“进行中无法打开设置”；
  - 保存中：“正在保存，暂时无法打开设置”；
  - 待保存：“成绩尚未保存，暂时无法打开设置”；
  - 重玩中：“重玩中无法打开设置”。
- 鼠标中键/新标签页打开不阻止：原标签页的当前局不会被卸载，属于安全操作。

### 2.5 与旧模态框设计的差异

旧 P8-4b 有一条“保存外观不重开一局”。改为独立页面后，这条不再成立：

- 进入设置页就会离开游戏页；
- 返回游戏页会重新加载并开始新局；
- 因此运行中不允许打开设置页，避免误丢成绩；
- P8-4c-1 接入主题列表、P8-4c-2 接入独立编辑器时，也不再需要“保存主题不重开当前局”的兼容逻辑。

## 3. 信息架构与布局

### 3.1 线框

```text
┌──────────────────────────────────────────────────────────────┐
│ [←]  设置                                                    │
│                                                              │
│ ┌──────────────────┐  ┌────────────────────────────────────┐ │
│ │ 显示设置          │  │ 网站外观                            │ │
│ │   外观            │  │ 选择网站的显示主题。                │ │
│ │   语言            │  │ ┌────────┐ ┌────────┐ ┌────────┐  │ │
│ │ 游戏              │  │ │跟随系统│ │ 浅色   │ │ 深色   │  │ │
│ │   游戏主题        │  │ └────────┘ └────────┘ └────────┘  │ │
│ │ 更多              │  │                                    │ │
│ │   关于            │  │ 语言                                │ │
│ │                   │  │ ┌────────────┐ ┌────────────┐      │ │
│ │                   │  │ │ 中文       │ │ English    │      │ │
│ │                   │  │ └────────────┘ └────────────┘      │ │
│ └──────────────────┘  └────────────────────────────────────┘ │
│                                                              │
│              [你有未保存的修改。]  [重置]  [保存]             │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 布局

- 页面背景使用中性浅灰 `#ebebeb`，与游戏页背景一致。
- 页面最大宽度约 `1200px`，水平居中。
- 顶部 header：返回按钮 + `h1` 标题“设置”；返回按钮约 44×44，标题约 2rem。
- 主体两栏：左侧导航约 `260px`，右侧内容自适应，间距约 `24px`。
- 左侧导航是独立浅灰浮起卡片，滚动时 `position: sticky; top: 24px;`。
- 右侧内容也是浅灰浮起卡片，最小高度约 `560px`，底部留出悬浮保存条的空间。
- 页面内容底部 padding 约 `8rem`，避免最后一项被保存条遮挡。
- 窄屏时导航和内容改为单列，导航可以横向滚动或换行。

### 3.3 视觉基调

参考 Modrinth 的信息架构，但表面样式与游戏页按钮统一：

- 浅灰浮起卡片、浅灰页面背景、细边框、顶部白色高光和双层阴影。
- 不使用渐变、玻璃模糊、大面积重阴影。
- 字体继续使用 `base.css` 的系统字体栈，不引入外部字体。
- 小标题、分类标签可以使用 `--font-mono` 和字距，增加工具感。
- 按钮、导航卡、内容卡、主题/语言卡、空状态和保存条共用同一套浮起表面；主按钮使用主题蓝。
- 警告条保留黄色语义，但圆角、边框和阴影沿用同一套规则。
- 图标统一使用 `src/shared/icons/sprite.svg`，线宽 1.8，颜色跟随 `currentColor`。

建议的页面 token：

```css
--settings-page-bg: #ebebeb;
--settings-surface: #f8f8f8;
--settings-surface-hover: #f0f0f0;
--settings-surface-inset: #ffffff;
--settings-border: #dedede;
--settings-border-strong: #cfcfcf;
--settings-text: #222222;
--settings-muted: #6f6f6f;
--settings-radius: 14px;
--settings-radius-sm: 11px;
--settings-raised-shadow:
  inset 0 1px 0 rgb(255 255 255 / 0.95),
  0 2px 4px rgb(0 0 0 / 0.08),
  0 1px 1px rgb(0 0 0 / 0.04);
--settings-raised-shadow-active:
  inset 0 1px 0 rgb(255 255 255 / 0.85),
  0 1px 2px rgb(0 0 0 / 0.06);
```

这些 token 放在 `settings.css` 的 `body.settings-page` 上，不改变首页和游戏页的现有视觉。

### 3.4 导航样式

- 导航按组显示，组标题如“显示设置”“游戏”“关于”，使用 0.75rem 左右的弱化文字和字距。
- 导航项是带图标的链接，高度约 42px，圆角 11px，图标 18–20px。
- 选中项使用 `#3498DB` 实心背景 + 白字，和 Modrinth 的选中块保持同样的观感。
- 未选中项悬停使用 `#f0f0f0`。
- 当前项设置 `aria-current="page"`。
- 分类本身都可进入；未实现的是分类里的功能控件，不是分类导航。

### 3.5 内容卡片

- 每个分类一个 `<section>`，用 `hidden` 切换。
- 分类标题使用 `h2`，下方是 0.95rem 左右的说明文字。
- 选项卡片使用单选组：
  - 主题卡：上方是 CSS 绘制的迷你界面预览，下方是 radio + 名称；
  - 语言卡：左侧语言缩写/文字，右侧名称和说明；
  - 选中卡使用 2px 主题蓝边框 + 浅蓝外圈/勾选标记。
- 禁用卡降低透明度，显示“开发中”徽标，并保留 `title="功能开发中"`。
- 关于页使用简单的行式链接，不做卡片嵌套。

### 3.6 响应式

- `≥ 900px`：左右两栏。
- `600–899px`：导航改为顶部横向滚动标签，内容占满宽度。
- `< 600px`：
  - header 标题缩小；
  - 主题卡改为单列或两列；
  - 语言卡单列；
  - 保存条宽度为 `calc(100% - 1rem)`，文字和按钮允许换行。
- 本轮不追求游戏页的完整移动端布局；设置页至少保证不出现横向滚动、按钮可点、文字不溢出。

### 3.7 可访问性

- 页面使用 `<main>`、`<nav aria-label="设置分类">`、多个 `<section>`。
- 每个分类有可见 `h2`；切换分类后焦点移到 `h2`。
- 主题/语言使用原生 `<input type="radio">`，视觉卡片只是 `<label>`。
- 禁用项使用原生 `disabled` 或 `aria-disabled`，并显示可见的“开发中”徽标；不能只靠颜色表达状态。
- 保存条不抢焦点；文字变化通过 `aria-live="polite"` 宣布；错误使用 `role="alert"`。
- 所有按钮、链接支持 Tab、Enter、Space；焦点样式清晰。
- 尊重 `prefers-reduced-motion`，保存条动画在减少动态时关闭。
- 选中态不能只用颜色，还要有勾选图标/边框/文字状态。

## 4. 分类内容

### 4.1 外观（网站外观）

导航短标签：`外观`；内容标题：`网站外观`。

说明文案：

> 选择网站的显示主题。深色主题将在后续版本提供。

三张主题卡：

| 选项     | 本轮状态 | 说明                                   |
| -------- | -------- | -------------------------------------- |
| 跟随系统 | 禁用     | 显示“开发中”，`title="功能开发中"`     |
| 浅色     | 可选     | 默认选中；当前唯一真正生效的主题        |
| 深色     | 禁用     | 显示“开发中”，`title="功能开发中"`     |

- 主题预览使用 CSS 绘制的迷你界面，不使用截图。
- 浅色卡选中时使用主题蓝边框和勾选标记。
- 禁用卡仍然展示深色/跟随系统的视觉预期，但不允许选择。
- 本轮不写 `prefers-color-scheme` 监听，也不切换页面 CSS。
- `themeMode` 字段仍然接受 `system` / `light` / `dark`，为后续深色主题保留；如果从存储中读到非 `light` 值，页面不崩溃，对应禁用卡仍显示为已选，并提示“当前版本暂不生效”，用户可以选择浅色并保存。

### 4.2 语言

说明文案：

> 选择界面语言。英文界面翻译将在后续版本提供，当前会保存你的语言偏好。

两个选项：

| 选项     | 值        | 本轮行为                                   |
| -------- | --------- | ------------------------------------------ |
| 中文     | `zh-CN`   | 默认值；界面保持中文                       |
| English  | `en`      | 可选中、可保存；界面暂时仍为中文，显示说明 |

- English 卡可以加一个“翻译开发中”的信息徽标，但它不是禁用项。
- 选择 English 后，底部出现保存条；保存后刷新，English 仍保持选中。
- 本轮不修改 `<html lang>`，避免屏幕阅读器用英文读中文内容；等翻译接入后再根据偏好设置。
- 本轮不建立翻译字典或伪 i18n 层，所有文案继续硬编码中文。
- 后续 i18n 落地时，语言偏好直接复用 `site.v1.preferences.language`，不需要迁移。

### 4.3 游戏主题（P8-4c）

说明文案：

> 选择棋盘主题。内置主题不可编辑；自定义主题可以调整颜色、字号、间隙与圆角。

P8-4c-1 内容：

- 两套内置主题 + 用户自定义主题的动态卡片列表。
- 每张卡渲染 10×10 已复原棋盘预览，显示数字、主题颜色、空白色、字号、间隙和圆角。
- 内置主题在编辑按钮位置显示“内置”徽标；自定义主题显示铅笔编辑按钮。
- 所有主题之后追加一张只有加号的卡片，跳转 `theme-editor.html`。
- 主题选择只更新设置页 draft，保存时写入 `puzzle.v2.appearance`；重置、未保存提示条和焦点管理沿用现有设置页逻辑。
- 读取外观数据失败或损坏时，复用顶部 banner 提示；缺失时静默使用内置主题。
- 设置页加载 `board.css` 以复用棋盘预览；不加载 `game.css`。
- P8-4c-2 的主题内容编辑在独立 `theme-editor.html` 中进行，不进入设置页保存条。

详细 DOM、预览尺寸、20 个上限、编辑器路由和验收见 `docs/PUZZLE_THEME.md`。

### 4.4 关于

静态内容，不参与未保存状态：

- 项目名称：Criel's Game Space；
- 仓库：`https://github.com/Criel14/Criel14.github.io`
- GitHub：`https://github.com/Criel14`
- 邮箱：`chencriel@qq.com`
- 存储说明：纯静态站点，设置和成绩保存在当前浏览器；不上传服务器。
- 外部链接使用 `target="_blank"` 和 `rel="noreferrer"`。
- 不使用表单，不需要保存按钮。

## 5. 未保存修改流程

### 5.1 状态模型

设置页维护一份页面级状态：

```ts
interface SettingsPageState {
  saved: SitePreferences; // 上次保存成功的快照
  draft: SitePreferences; // 当前表单值
  saving: boolean;
}
```

- 初始：`saved = draft = loadPreferencesResult().preferences`。
- 用户修改控件：只更新 `draft`，不写 localStorage，不应用到页面。
- `isDirty = saved.themeMode !== draft.themeMode || saved.language !== draft.language`。
- 修改回原值：`isDirty` 变回 false，保存条自动消失。
- 保存成功：`saved = draft = normalize(draft)`，保存条消失。
- 重置：`draft = saved`，保存条消失。

### 5.2 底部悬浮条

结构示意：

```html
<div class="settings-savebar" data-savebar hidden>
  <div class="settings-savebar__info">
    <p class="settings-savebar__text">你有未保存的修改。</p>
    <p class="settings-savebar__error" data-save-error role="alert" hidden></p>
  </div>
  <div class="settings-savebar__actions">
    <button type="button" data-action="reset">
      <svg class="icon" aria-hidden="true"><use href="#icon-rotate-ccw"></use></svg>
      重置
    </button>
    <button type="button" data-action="save">
      <svg class="icon" aria-hidden="true"><use href="#icon-save"></use></svg>
      <span data-save-label>保存</span>
    </button>
  </div>
</div>

<p class="visually-hidden" data-live-region aria-live="polite"></p>
```

实现说明：保存按钮的文案放在 `[data-save-label]` 内，保存中只更新这个 span，不重建图标。

行为：

- 只在 `isDirty` 时显示；不脏时 `hidden`。
- 固定在视口底部居中，宽度 `min(960px, calc(100% - 2rem))`。
- 浅灰表面、1px 边框、14px 圆角，顶部白色高光和双层阴影与游戏页按钮一致。
- 文本在左，按钮在右；窄屏允许换行。
- “重置”为次要按钮，“保存”为主题蓝主按钮。
- 出现时使用短暂的位移动画；减少动态时关闭。
- 保存条不抢焦点；用户仍可在页面内继续操作。
- 保存中：两个按钮禁用，保存按钮文案变为“保存中…”。
- 保存失败：保留保存条，显示错误文案，例如“保存失败，请检查浏览器存储权限后重试。”
- 保存成功：隐藏保存条，通过 live region 宣布“设置已保存”。
- 重置成功：隐藏保存条，通过 live region 宣布“已撤销未保存的修改”。
- 保存或重置成功后，焦点回到当前分类标题，避免保存条隐藏后焦点丢失。

### 5.3 重置与保存

重置：

- 恢复的是 `saved`，不是出厂默认值。
- 不写 localStorage。
- 如果当前没有未保存修改，按钮不可见（保存条本身不显示）。

保存：

- 将 `draft` 归一化后写入 `site.v1.preferences`。
- 写入成功后更新 `saved`，调用 `applyPreferences`，隐藏保存条。
- 写入失败时保留 `draft` 和保存条，不清空用户修改。
- 保存按钮不可重复点击；保存中禁用。
- 失败错误不使用 alert 弹窗，必须在保存条内可见。

### 5.4 离开页面

按需求，不做离开确认：

- 点击左上角返回：直接离开，草稿丢弃。
- 浏览器后退：直接离开，草稿丢弃。
- 刷新：重新加载，草稿丢弃，已保存值恢复。
- 关闭标签页：草稿丢弃。
- 点击主题编辑/新建入口：进入独立编辑器页，设置页未保存的主题选择草稿丢弃。
- 只有点击“保存”才会写入 localStorage。

分类切换使用 `replaceState`，不会让浏览器后退只在分类之间切换，因此“后退”符合离开页面的预期。

**TODO（P8-4c）**：设置页和主题编辑器存在未保存修改时，离开前是否弹确认框；当前版本直接丢弃草稿，后续再决定。详细策略见 `docs/PUZZLE_THEME.md` 第 5.6 节。

### 5.5 分类控制器与保存条的关系

页面级保存条不直接绑定某个分类，而是汇总所有 controller：

```ts
interface SettingsController {
  /** controller 级标识；一个 controller 可以覆盖多个 section。 */
  readonly id: string;
  isDirty(): boolean;
  reset(): void;
  save(): void | Promise<void>;
}
```

- 本轮只有一个 `site-preferences` controller，同时负责外观和语言。
- 关于页没有 controller，不参与脏状态。
- P8-4c-1 的主题列表作为第二个 controller（`puzzle-theme`）接入，只负责当前主题选择的 draft/保存/重置。
- P8-4c-2 的主题编辑器是独立页面，不进入设置页 controller，也不复用设置页保存条。
- P8-5 的自定义光标/极简 UI 可以作为“游戏”分类下的第三个 controller 接入。
- 页面在任意表单变化后调用 `refreshSavebar()`；保存时依次调用所有 controller 的 `save()`，任一失败则中止并保留保存条。

## 6. 数据设计

### 6.1 存储位置

新增 localStorage key：

```text
site.v1.preferences
```

信封格式：

```json
{
  "version": 1,
  "data": {
    "themeMode": "light",
    "language": "zh-CN"
  }
}
```

与现有数据分开：

| 数据             | 存储                       | 本轮是否修改 |
| ---------------- | -------------------------- | ------------ |
| 全站偏好         | `site.v1.preferences`      | 新增         |
| 拼图设置         | `puzzle.v2.settings`       | 不修改       |
| 拼图外观         | `puzzle.v2.appearance`     | 不修改       |
| 成绩/录像        | IndexedDB `puzzle.v2`      | 不修改       |

即使设置页当前在 `/puzzle-game/` 下，也不把外观/语言放进 `puzzle.v2.settings`；以后迁移到全站设置页时不需要迁移数据。

### 6.2 类型与默认值

```ts
export type ThemeMode = 'system' | 'light' | 'dark';
export type SiteLanguage = 'zh-CN' | 'en';

export interface SitePreferences {
  readonly themeMode: ThemeMode;
  readonly language: SiteLanguage;
}

export const DEFAULT_SITE_PREFERENCES: SitePreferences = {
  themeMode: 'light',
  language: 'zh-CN',
};
```

- 默认使用 `light` 而不是 `system`，因为本轮没有深色主题，跟随系统也不会产生可见效果。
- 语言默认 `zh-CN`。
- 类型放在 `src/shared/preferences/`，不依赖拼图模块。

### 6.3 归一化

读取和保存前都做归一化：

- `themeMode` 只接受 `system` / `light` / `dark`，非法值回退 `light`。
- `language` 只接受 `zh-CN` / `en`，非法值回退 `zh-CN`。
- 忽略未知字段。
- 非对象、缺字段、类型错误不抛异常，回退默认值。
- 本轮 UI 只允许选择 `light`，但归一化接受三种主题值，避免未来版本写入的数据被当前版本破坏。

### 6.4 读取状态

```ts
type PreferencesReadStatus = 'ok' | 'missing' | 'corrupt' | 'unavailable';

interface PreferencesLoadResult {
  readonly status: PreferencesReadStatus;
  readonly preferences: SitePreferences;
}
```

| 状态          | 行为                                                     |
| ------------- | -------------------------------------------------------- |
| `ok`          | 使用存储值                                               |
| `missing`     | 使用默认值，不显示警告                                   |
| `corrupt`     | 使用归一化结果，保留可恢复字段；页面顶部显示非阻塞警告   |
| `unavailable` | 使用默认值，页面顶部显示“浏览器存储不可用，修改可能无法保存” |

- 读取失败不阻塞页面渲染。
- 读取时不在缺失状态下自动写入默认值；只有用户点击保存才创建 key。
- `corrupt` 时不自动覆盖原数据；用户保存时才覆盖。
- 字段级损坏只回退出问题的字段，另一个合法字段继续保留。
- 保存成功后清除读取警告 banner，因为此时存储里已经是归一化后的有效数据。
- 警告条使用页面内 banner，不使用模态框。

### 6.5 保存与应用

保存流程：

1. 归一化 draft；
2. 序列化为 `{ version: 1, data }`；
3. 写入 `site.v1.preferences`；
4. 成功后更新 `saved`；
5. 调用 `applyPreferences(saved)`；
6. 隐藏保存条并宣布保存成功。

本轮 `applyPreferences` 的行为：

- 设置 `document.documentElement.dataset.theme`；`system` 暂按 `light` 处理，存储中的 `dark` 会写入 dataset，但本轮没有对应 CSS，不产生可见效果。
- 设置 `document.documentElement.dataset.language`（供后续调试/i18n 使用）。
- 不修改 `<html lang>`。
- 不设置 `color-scheme: dark`，因为深色 CSS 尚未实现。
- 不重新加载页面；本轮两个偏好都没有可见的即时效果。
- 后续深色模式接入时，在这里解析 `system` 并设置 `color-scheme` 和 `data-theme`。

保存失败：

- 抛出可识别的存储错误，页面捕获后显示保存条内错误。
- 不更新 `saved`，不隐藏保存条。
- 不清空 draft。

### 6.6 版本与迁移

- 新 key 从 `version: 1` 开始。
- 本轮不做旧数据迁移，也不读取旧 `config` 等键。
- 版本不匹配视为 `corrupt`，回退默认值并提示。
- 未来需要迁移时，在 `src/shared/preferences/` 内增加版本分支，不把迁移逻辑散落到页面。
- 拼图的 `SCHEMA_VERSION = 3` 和 IndexedDB `DB_VERSION = 2` 不受影响。

### 6.7 存储适配与测试

- `src/shared/preferences/store.ts` 接受可注入的存储适配器，默认使用 `localStorage`。
- 适配器最小接口：`getItem(key)` / `setItem(key, value)`。
- 测试使用内存实现，不依赖真实浏览器 localStorage。
- 浏览器存储访问异常统一转换为可识别的 `unavailable` 错误。
- 本轮不重构拼图现有的 `data/local-storage.ts`；如果后续需要，再把通用适配器抽到 `src/shared/storage/`，避免在 P8-4b 扩大改动面。

## 7. 主题色

### 7.1 全局 token

在 `src/shared/styles/base.css` 增加：

```css
:root {
  --color-accent: #3498db;
  --color-accent-hover: #2f8fce;
  --color-accent-soft: #e8f4fb;
  --color-on-accent: #ffffff;
}
```

### 7.2 使用位置

- 设置页左侧导航选中项：实心主题蓝 + 白字。
- 设置页主题/语言卡片选中边框、勾选标记、radio `accent-color`。
- 设置页“保存”主按钮；悬停使用 `--color-accent-hover`。
- 游戏页弹框选中项：把 `--selected-bg` 从 `#2b2b2b` 改为 `var(--color-accent)`，`--selected-fg` 改为 `var(--color-on-accent)`。
- 游戏页分组弹框、阶数、游戏模式、操作模式共用这个选中态。
- 首页暂时不改；主题色 token 先留给后续全站使用。
- 焦点环优先保证对比度，不强制使用主题蓝；设置页可以在浅色表面使用更深的焦点色。

### 7.3 对比度说明

`#3498DB` 与白色文字的对比度约为 3.2:1，低于 WCAG AA 对普通字号文本的 4.5:1 要求。当前决策是保留 Modrinth 风格的实心色块观感：

- 选中项都是短标签，使用 600 字重；
- 不使用主题蓝承载长段落文字；
- 后续如果做可访问性审计，可以只把“带文字的选中底色”加深到 `#2478A8`，同时保留 `#3498DB` 作为品牌/指示色。

这是有意取舍，不是遗漏。

### 7.4 深色模式预留

- 深色模式接入时，通过 `[data-theme='dark']` 覆盖语义 token。
- `#3498DB` 在深色背景上可能需要调整亮度或透明度，届时只改 token，不改组件。
- 深色模式还需要同步游戏页的 `--page-bg`、`--ink`、`--button-face` 等局部 token。
- 本轮只定义 token，不写深色 CSS。

## 8. 扩展方式

### 8.1 分类注册表

设置页使用一个小的分类定义表驱动导航：

```ts
type SettingsSectionId = 'appearance' | 'language' | 'game-theme' | 'about';

interface SettingsSectionDefinition {
  readonly id: SettingsSectionId;
  readonly label: string;
  readonly icon: string;
  readonly group: 'display' | 'game' | 'more';
  readonly hash: string;
}
```

- 导航 DOM 由注册表在页面启动时生成，注册表负责顺序、图标、当前项和 hash 校验。
- 每个分类对应一个 `<section data-settings-section="...">`。
- 新增分类需要：注册表项 + HTML section + 可选 controller。
- 不引入路由库；hash 足够。

### 8.2 控制器接口

```ts
interface SettingsController {
  readonly id: string;
  isDirty(): boolean;
  reset(): void;
  save(): void | Promise<void>;
}
```

页面外壳负责：

- 汇总 `isDirty`；
- 控制保存条显隐；
- 调用所有 controller 的 `reset()` / `save()`；
- 保存失败时保留草稿并显示错误；
- 保存成功后统一宣布结果。

本轮 `site-preferences` controller 负责外观和语言；关于页没有 controller。

### 8.3 未来分类接入

- **P8-4c-1 游戏主题列表**：新增 `puzzle-theme` controller，读取 `puzzle.v2.appearance` 到草稿，只更新 `activeThemeId`，保存时写回完整 `AppearanceState`；使用 `ui/theme-preview.ts` 的 10×10 预览，不立即改游戏页。
- **P8-4c-2 主题编辑器**：独立 `/puzzle-game/theme-editor.html`，自己有 draft/保存/取消；不进入设置页 controller。详见 `docs/PUZZLE_THEME.md`。
- **P8-5 自定义光标/极简 UI**：新增 `PuzzleBehaviorController`，读写 `puzzle.v2.settings` 的 `customCursor` / `minimalUi`；保存时只更新这两个字段，保留 size/gameMode/groups 等其他设置。
- **数据管理**：未来可以增加“清除旧数据”“导出设置”等分类；清除操作必须二次确认，不能混进普通保存流程。
- 多个 controller 保存时按顺序执行；任一失败则停止并保留保存条。需要原子性的跨存储操作不在本轮设计范围内。

### 8.4 未来迁移到全站设置页

当前路径是 `/puzzle-game/settings.html`，但偏好存储已经是全站 key。迁移步骤：

1. 新增 `/settings.html` 入口；
2. 把页面外壳移到 `src/shared/` 或新的 `src/site/`；
3. 把返回按钮改为 `?from=` 白名单或固定首页；
4. 游戏主题分类如保留，按游戏分子标签；
5. 首页 footer 增加设置入口；
6. `site.v1.preferences` 不变，不需要迁移。

这些都不在本轮实现。

## 9. 游戏页接入

### 9.1 设置按钮

把 `puzzle-game/puzzle.html` 里的：

```html
<button class="icon-button" type="button" data-action="settings" ...>
```

改为：

```html
<a
  class="icon-button"
  href="/puzzle-game/settings.html"
  data-action="settings"
  aria-label="设置"
  title="设置"
>
  <svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <use href="#icon-settings"></use>
  </svg>
</a>
```

- 继续复用 `.icon-button` 样式。
- 在 `src/games/puzzle/pages/game.ts` 的 `GameElements` 中增加 `settingsLink`。
- 增加点击监听：不可打开时 `event.preventDefault()`。
- `updateControlState()` 中同步 `aria-disabled`、`title` 和禁用样式。
- 图标按钮的 `:focus-visible` 和禁用态沿用现有规则。

### 9.2 禁用逻辑

```ts
function canOpenSettings(): boolean {
  return (
    !isBusy() &&
    !retryMode &&
    session !== null &&
    (session.phase === 'observing' || session.phase === 'solved') &&
    pendingSettlements.length === 0
  );
}
```

`updateControlState()` 里：

```ts
const canOpen = canOpenSettings();
elements.settingsLink.setAttribute('aria-disabled', String(!canOpen));
elements.settingsLink.classList.toggle('is-disabled', !canOpen);
elements.settingsLink.title = canOpen
  ? '设置'
  : isSaving
    ? '正在保存，暂时无法打开设置'
    : pendingSettlements.length > 0
      ? '成绩尚未保存，暂时无法打开设置'
      : retryMode
        ? '重玩中无法打开设置'
        : '进行中无法打开设置';
```

- `aria-disabled` 是语义状态，不删除 `href`，这样新标签页打开仍然可用。
- 左键和 Enter 触发时由 click 监听阻止。
- 保存失败后待保存队列非空时继续禁用设置入口，避免离开页面丢掉成绩。
- 禁用态样式：`opacity: 0.45; cursor: not-allowed;`。
- 不禁用普通链接的右键/新标签页行为，因为原标签页的局不会被卸载。

### 9.3 选中项主题色

在 `src/games/puzzle/styles/game.css` 中：

```css
--selected-bg: var(--color-accent);
--selected-fg: var(--color-on-accent);
```

- 阶数、游戏模式、操作模式、分组弹框的选中项统一变为主题蓝。
- 不改变按钮默认浅灰面、棋盘主题色和页面背景。
- 选中项仍然需要 `aria-pressed="true"`，不能只靠颜色。

### 9.4 返回游戏后的行为

- 返回游戏页会重新加载，读取已保存的 `puzzle.v2.settings` / `puzzle.v2.appearance`。
- 本轮外观/语言没有可见效果；游戏仍使用当前主题和中文文案。
- 之前正在观察的局不会恢复；因为进入设置页前已通过状态限制避免运行中的局被误丢。
- 如果用户在设置页没有保存，返回后仍是原设置。
- 如果保存了语言 `en`，返回游戏页仍显示中文，直到 i18n 落地。

## 10. 文件与模块

| 文件/目录 | 职责 |
| --- | --- |
| `puzzle-game/settings.html` | 设置页入口、静态结构、sprite 占位、CSS/TS 引用 |
| `src/games/puzzle/pages/settings.ts` | 页面启动、错误边界、组装 controller |
| `src/games/puzzle/ui/settings-page.ts` | 导航、section 切换、表单绑定、保存条、焦点管理 |
| `src/games/puzzle/ui/settings-sections.ts` | 分类注册表、hash 解析、controller 接口 |
| `src/games/puzzle/ui/settings-sections.test.ts` | 注册表与 hash 解析测试 |
| `src/games/puzzle/styles/settings.css` | 设置页布局、卡片、导航、保存条、响应式 |
| `src/shared/preferences/types.ts` | 类型、默认值、key/version 常量 |
| `src/shared/preferences/store.ts` | 读取、归一化、保存、存储错误 |
| `src/shared/preferences/apply.ts` | 应用偏好到 document（本轮只做轻量设置） |
| `src/shared/preferences/draft.ts` | 脏状态比较、重置辅助 |
| `src/shared/preferences/*.test.ts` | store、归一化、脏状态测试 |
| `src/shared/styles/base.css` | 全局主题色 token |
| `src/shared/icons/sprite.svg` | 返回、外观、语言、游戏、关于、重置、保存等图标 |
| `puzzle-game/puzzle.html` | 设置按钮改为链接 |
| `src/games/puzzle/pages/game.ts` | 设置链接禁用逻辑 |
| `src/games/puzzle/styles/game.css` | 弹框选中项使用主题蓝 |
| `vite.config.ts` | 新增 `puzzleSettings` 构建入口 |
| `docs/SETTINGS_PAGE.md` | 本文件，设置页单一设计来源 |
| `docs/PUZZLE_GAME_PAGE.md` | 更新 P8-4b/P8-4c 索引 |
| `docs/PUZZLE_TASKS.md` | 更新任务状态 |
| `docs/REFACTOR_PLAN.md` | 更新阶段状态和目录说明 |
| `docs/PUZZLE_STORAGE.md` | 记录 `site.v1.preferences` |
| `docs/ICONS.md` | 登记新增图标 |

模块约束：

- `src/shared/preferences/` 不导入 `src/games/puzzle/`。
- `settings.ts` 不导入拼图核心、成绩、录像、图表或 IndexedDB。
- `settings.html` 只加载 `base.css`、`settings.css`、设置页 TS 和 sprite。
- 页面不引入新的运行时依赖。

## 11. 实现步骤

### 11.1 P8-4b-1 偏好数据与主题色基础

- [x] 新增 `src/shared/preferences/` 类型、默认值、store、apply、draft。
- [x] 编写 store/归一化/脏状态测试。
- [x] 在 `base.css` 增加主题色 token。
- [x] 在 `sprite.svg` 增加设置页图标。
- [x] 运行 `npm test`、`npm run typecheck`。

### 11.2 P8-4b-2 设置页骨架

- [x] 新增 `puzzle-game/settings.html`。
- [x] 新增 `settings.css`，完成 header、两栏、导航、内容卡片、响应式。
- [x] 完成 hash 路由、分类切换、`replaceState`、焦点管理。
- [x] 完成外观、语言、游戏主题占位、关于四个 section。
- [x] 完成保存条、重置、保存、错误提示、live region。
- [x] 完成读取警告 banner。
- [x] 在 `vite.config.ts` 增加构建入口。

### 11.3 P8-4b-3 游戏页接入与文档

- [x] 设置按钮改为链接。
- [x] 增加 `canOpenSettings()` 和禁用状态。
- [x] 弹框选中项改为主题蓝。
- [x] 更新 `docs/PUZZLE_GAME_PAGE.md`、`docs/PUZZLE_TASKS.md`、`docs/REFACTOR_PLAN.md`、`docs/PUZZLE_STORAGE.md`、`docs/ICONS.md`。
- [x] 运行完整检查。

实现备注（2026-10-24）：

- 偏好 store 在字段级损坏时保留可恢复字段并返回 `corrupt`，页面显示警告；保存后一次覆盖原数据。
- 设置页导航由 `SETTINGS_SECTIONS` 生成，section 内容保持静态 HTML；切换分类使用 `replaceState`，并监听 `hashchange` 兼容手动修改地址栏。
- controller 接口使用 controller 级 `id`（`site-preferences`），不绑定单个 section。
- 保存条、重置和保存按钮加入图标；主题卡使用 CSS 预览和 `monitor` / `sun` / `moon` 图标。
- 导航卡、内容卡、主题/语言卡、空状态、保存条和按钮统一使用 `--settings-surface` + `--settings-raised-shadow`，与游戏页按钮的浅灰浮起风格一致；警告条保留黄色语义，但共用圆角和阴影。
- 保存或重置成功后焦点回到当前分类标题；保存条出现时不主动抢焦点。
- 游戏页设置链接保留 `href`，用 `aria-disabled` 表达禁用；新标签页行为不拦截。

### 11.4 P8-4c-1 主题列表与选择

- [x] 自定义主题上限从 3 改为 20。
- [x] 接入 appearance draft controller，只负责 `activeThemeId` 选择。
- [x] 新增 `ui/theme-preview.ts` 和 `ui/game-theme-picker.ts`。
- [x] 设置页主题卡、内置徽标、编辑按钮和加号卡。
- [x] 新增 `theme-editor.html` 占位页和 Vite 入口。
- [x] 新增 `plus` / `pencil` 图标和 `createIcon` 工具。
- [x] 新增 `isAppearanceEqual` 与测试。
- [x] 更新文档和自动检查。
- [ ] 手动验收。

实现备注（2026-10-24）：

- 主题 section 只保留挂载点，卡片由 `ui/game-theme-picker.ts` 动态渲染。
- 每张卡使用 `ui/theme-preview.ts` + `board-view` 渲染 10×10 已复原棋盘；设置页加载 `board.css`。
- 设置页新增 `puzzle-theme` controller；选择只改 draft，保存时写入完整 `puzzle.v2.appearance`。
- 内置主题显示“内置”徽标，自定义主题显示铅笔编辑按钮；加号卡跳转 `theme-editor.html` 占位页。
- 自定义主题上限 20；达到上限时加号卡禁用并显示说明。
- 自动检查已通过；手动验收待执行。

### 11.5 P8-4c-2 主题编辑器

- [ ] 实现独立 `theme-editor.html`。
- [ ] 实现名称、模式、色板、空白色、字体色、盲玩色和 metrics。
- [ ] 实现实时预览、复制内置主题、校验和保存。
- [ ] 增加编辑器页 E2E 和手动验收。
- [ ] 视用户反馈加入离开确认弹框。

## 12. 验收

### 12.1 自动检查

```bash
npm test
npm run typecheck
npm run lint
npm run format:check
npm run build
```

要求：

- 全部通过；
- `dist/puzzle-game/settings.html` 存在；
- 构建产物不包含未使用的游戏/图表模块；
- 无新增运行时依赖。

### 12.2 手动检查

页面与导航：

- [ ] 游戏页设置按钮进入 `/puzzle-game/settings.html`。
- [ ] 页面显示返回按钮和“设置”标题。
- [ ] 左侧导航分组、图标、选中态正确。
- [ ] 点击分类不刷新页面，hash 更新，`aria-current` 正确。
- [ ] 直接打开 `#language` / `#game-theme` / `#about` 能显示对应分类。
- [ ] 未知 hash 回退到外观。
- [ ] 刷新后保留分类 hash。
- [ ] 浏览器后退离开设置页，而不是在分类间循环。

保存流程：

- [ ] 初始为浅色 + 中文，底部没有保存条。
- [ ] 选择 English 后出现保存条。
- [ ] 改回中文后保存条自动消失。
- [ ] 再次选择 English，点击“重置”恢复中文，保存条消失。
- [ ] 选择 English，点击“保存”，保存条消失；刷新后 English 仍选中。
- [ ] 保存后 `localStorage` 存在 `site.v1.preferences`，版本为 1。
- [ ] 保存失败时保存条保留，错误文案可见，draft 不丢。
- [ ] 选择另一个游戏主题后出现保存条；点击“重置”恢复上次保存的主题。
- [ ] 点击“保存”后主题选择写入 `puzzle.v2.appearance`，刷新后仍选中。
- [ ] 点击返回、浏览器后退、刷新都会丢弃未保存修改。
- [ ] 切换分类不丢 draft；在“关于”页保存条仍然可见。
- [ ] 点击编辑/新建主题进入独立页面时，设置页未保存的主题选择被丢弃（当前策略）。

各分类：

- [ ] 浅色卡默认选中；跟随系统/深色禁用并显示“开发中”和 tooltip。
- [ ] 语言卡显示“英文界面翻译将在后续版本提供”的说明。
- [ ] 游戏主题显示内置/自定义主题卡片和 10×10 预览。
- [ ] 内置主题显示“内置”徽标，自定义主题显示编辑按钮。
- [ ] 加号卡跳转 `theme-editor.html`；达到 20 个自定义主题时禁用并提示上限。
- [ ] 关于页链接可点击，外部链接使用新标签页。
- [ ] 伪类和键盘状态可见。

游戏页：

- [ ] 观察阶段设置入口可打开。
- [ ] 第一次移动后设置入口禁用，点击不跳转。
- [ ] 保存中/重玩中设置入口禁用。
- [ ] 普通局完成后设置入口恢复可用；重玩局完成后仍禁用，退出重玩后才恢复。
- [ ] 保存失败且待保存队列未清空时，设置入口保持禁用；重试保存成功后恢复。
- [ ] 阶数、模式、操作、分组弹框选中项为主题蓝。
- [ ] 设置页返回后游戏页正常开始新局。

响应式与可访问性：

- [ ] 窄屏不出现横向滚动。
- [ ] 导航、卡片、保存条在窄屏可操作。
- [ ] Tab 顺序合理；保存条不抢焦点。
- [ ] 禁用项不仅靠颜色表达。
- [ ] `prefers-reduced-motion` 下保存条动画关闭。
- [ ] 无控制台错误。

### 12.3 数据检查

在 DevTools 中确认：

```text
localStorage['site.v1.preferences']
```

内容形如：

```json
{
  "version": 1,
  "data": {
    "themeMode": "light",
    "language": "en"
  }
}
```

确认：

- P8-4b 偏好保存不修改 `puzzle.v2.settings` / `puzzle.v2.appearance`；
- P8-4c-1 保存主题选择时只更新 `puzzle.v2.appearance` 的 `activeThemeId`（同时写入当前完整主题快照），不修改 `puzzle.v2.settings`；
- 不新增 IndexedDB 数据；
- 损坏 JSON 时页面不崩溃，显示警告并回退默认值；
- localStorage 不可用时页面仍可渲染并提示。

## 13. 测试点

### 13.1 `src/shared/preferences/store.test.ts`

- 缺失 key 返回 `missing` + 默认值。
- 合法数据返回 `ok` + 原值。
- JSON 损坏返回 `corrupt` + 默认值。
- 版本不匹配返回 `corrupt` + 默认值。
- 非法 `themeMode` 回退 `light`。
- 非法 `language` 回退 `zh-CN`。
- 未知字段被忽略。
- 保存写入 `{ version: 1, data }`。
- 保存后读取可往返。
- 存储写入异常时抛出可识别错误。
- 存储读取异常返回 `unavailable`。

### 13.2 `src/shared/preferences/draft.test.ts`

- 相同偏好返回 `false`。
- `themeMode` 不同返回 `true`。
- `language` 不同返回 `true`。
- 重置后返回 `false`。
- 归一化后比较不受未知字段影响。

### 13.3 hash/分类纯函数（如拆分）

- 合法 hash 返回对应 section。
- 缺失/未知 hash 返回 `appearance`。
- 空字符串、`#`、大小写差异按约定处理。

### 13.4 游戏主题

详细测试点见 `docs/PUZZLE_THEME.md` 第 10 节。设置页至少覆盖：

- `CUSTOM_THEME_SLOT_COUNT === 20`。
- `isAppearanceEqual` 对 `activeThemeId`、主题列表和 metrics 的差异判断。
- 归一化最多保留 20 个自定义主题，内置主题不受影响。
- 主题卡渲染、选中、编辑/加号链接、保存条、重置、保存失败、20 个上限提示。
- 读取 `corrupt` / `unavailable` 时的 banner。

### 13.5 手动 DOM 测试

- 导航切换、radio 选择、保存条显隐。
- 保存成功/失败。
- 焦点回收和 live region。
- 禁用项 tooltip。
- 响应式布局。

不做 DOM 单元测试；本项目目前没有 DOM 测试环境，页面交互随 P8 手动验收，E2E 在 P8-4c-2/P8-6 补充。

## 14. 未来与待讨论

- 深色主题：何时接入、是否需要 OLED、深色下的主题蓝如何调整。
- 多语言：翻译文件格式、默认语言、`<html lang>` 更新、设置页文案迁移。
- 游戏主题：P8-4c-1 主题列表与 P8-4c-2 独立编辑器，详见 `docs/PUZZLE_THEME.md`；命名/删除/排序仍待定。
- **TODO（P8-4c）**：设置页和主题编辑器存在未保存修改时，离开前是否弹确认框；当前直接丢弃草稿。
- 自定义光标/极简 UI：放在设置页“游戏”分类下，还是留在游戏页快捷入口。
- 全站设置页迁移：路径、返回来源、首页入口。
- 设置导入/导出、数据清理、存储持久化申请。
- 是否需要在设置页显示应用版本/构建信息。
- 是否需要在首页 footer 增加设置入口（本轮不做）。

## 15. 决策记录

| 日期       | 决策                                                                 |
| ---------- | -------------------------------------------------------------------- |
| 2026-10-24 | 设置从模态框改为独立页面，参考 Modrinth 的左侧导航 + 右侧内容布局     |
| 2026-10-24 | 页面路径先放 `/puzzle-game/settings.html`，偏好存储按全站数据设计     |
| 2026-10-24 | 游戏主题本轮只做占位，完整编辑器拆到 P8-4c（后拆为 4c-1/4c-2）        |
| 2026-10-24 | 语言中/英均可选并保存，但本轮不实现翻译；深色/跟随系统禁用            |
| 2026-10-24 | 主题色使用 `#3498DB` + 白字；接受小字号对比度不足的视觉取舍            |
| 2026-10-24 | 修改不立即生效；底部保存条统一保存/重置；返回/刷新丢弃草稿            |
| 2026-10-24 | 运行中/保存中/重玩中禁用设置入口，避免独立页面导致当前局丢失          |
| 2026-10-24 | 新增 `site.v1.preferences`，不写入 `puzzle.v2.settings` / appearance   |
| 2026-10-24 | 分类导航使用 hash + `replaceState`，不污染浏览器后退历史               |
| 2026-10-24 | P8-4c 拆成主题列表（4c-1）与独立编辑器页（4c-2）                      |
| 2026-10-24 | 自定义主题上限从 3 放宽到 20；不升 schema version                     |
| 2026-10-24 | 设置页保存条负责主题选择；编辑器页自己有 draft/保存/取消               |
| 2026-10-24 | 离开设置页/编辑器直接丢弃草稿；确认弹框记录 TODO                       |

## 16. 参考

- 重构总览：`docs/REFACTOR_PLAN.md`
- 游戏主题与 P8-4c：`docs/PUZZLE_THEME.md`
- 游戏页与 P8 任务：`docs/PUZZLE_GAME_PAGE.md`
- 任务清单：`docs/PUZZLE_TASKS.md`
- 存储设计：`docs/PUZZLE_STORAGE.md`
- 图标规范：`docs/ICONS.md`
- 拼图架构：`docs/PUZZLE_ARCHITECTURE.md`
- 成绩页与分组：`docs/PUZZLE_SCORE_PAGE.md`
- Modrinth 设置页截图：对话中提供，仅作为布局参考，不作为视觉复制目标
