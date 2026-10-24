# 图标规范

> 状态：2026-10-24 起使用本地 SVG sprite 统一管理图标。游戏页图标已全部迁移到 sprite；设置页图标已随 P8-4b 加入；占位页的 `←`、弹窗/提示的 `×`、首页卡片的 `→` 仍为文字字符，暂不处理。

## 目标

- 全站使用单色线性图标，优先 Lucide。
- 图标只维护一份，页面通过 `<use>` 引用，避免复制路径。
- 图标颜色跟随主题文字色，深浅主题切换时不需要替换 SVG。
- 构建时把 sprite 内联进 HTML，不依赖运行时 CDN，不增加额外请求。

## 来源与许可

- 图标源：[Lucide](https://lucide.dev/)。
- 当前图标来源：
  - `settings` ← Lucide `settings`
  - `scores` ← Lucide `logs`
  - `groups` ← Lucide `layout-template`
  - `mode-normal` / `mode-blind` ← `eye` / `eye-off`
  - `move-click` / `move-slide` / `move-keyboard` ← `mouse-pointer-click` / `spline-pointer` / `keyboard`
  - `size` ← 基于 Lucide 图标修改的自定义图标（用户提供）
  - `home` ← Lucide `house`
  - `refresh` ← Lucide `rotate-cw`
  - `exit-retry` ← Lucide `undo-2`
  - `chevron-down` ← Lucide `chevron-down`
  - `arrow-left` ← Lucide `arrow-left`
  - `paintbrush` / `globe` / `palette` / `info` ← 同名 Lucide 图标
  - `rotate-ccw` / `save` / `check` / `external-link` / `mail` ← 同名 Lucide 图标
  - `monitor` / `sun` / `moon` ← 同名 Lucide 图标
- `palette` 的四个圆点使用 `fill="currentColor"`；它是 sprite 中唯一带填充的图标，其余图标保持只描边。
- Lucide 使用 ISC License；部分图标派生自 Feather，另有 MIT 许可。
- 新增图标时在下方“图标清单”登记来源和许可。

### Lucide ISC License

```text
ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

### Feather MIT License

以下图标直接或间接来自 Feather 时需要保留此声明，例如 `chevron-down`、`x`、`arrow-left` 等。

```text
The MIT License (MIT)

Copyright (c) 2013-present Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## 单一来源

`src/shared/icons/sprite.svg` 是所有图标的唯一来源。

每个图标写成 `<symbol>`：

```svg
<symbol id="icon-settings" viewBox="0 0 24 24">
  <path d="…" />
  <circle cx="12" cy="12" r="3" />
</symbol>
```

约定：

- ID 统一为 `icon-<name>`，名称使用小写短横线。
- `viewBox` 统一为 `0 0 24 24`；需要其他画布尺寸时在清单中注明。
- `<symbol>` 内只保留几何元素，不写 `fill`、`stroke`、`stroke-width`、`width`、`height`、`class`。
- 图标颜色由 `.icon` 的 `currentColor` 决定；线宽目前统一为 `1.8`。
- 不要为了某个页面复制一份图标路径；需要不同尺寸时用 CSS 类，不要改 sprite。

## 页面引用

HTML 中这样使用：

```html
<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <use href="#icon-settings"></use>
</svg>
```

- 外层 `<svg>` 负责尺寸、颜色和可访问性；`<use>` 只引用 symbol。
- 图标按钮必须有 `aria-label` 和 `title`；纯装饰图标加 `aria-hidden="true"` 和 `focusable="false"`。
- 常用尺寸：
  - `.icon`：27×27px，左栏方形按钮默认；
  - `.icon--small`：20×20px，分组按钮；
  - `.icon--chevron`：16×16px，下拉箭头；
  - `.board-refresh .icon`：34×34px，棋盘下方刷新。
- 页面需要在 `<body>` 开头保留 `<!-- icon-sprite -->` 占位符；Vite 插件会把它替换成 sprite 内容。

## 颜色与主题

图标颜色只由 CSS 控制，sprite 内不写死颜色。

```css
.icon {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
```

- `currentColor` 跟随父元素的 `color`；按钮的 `--ink`、`--muted` 等 token 变化时，图标自动变色。
- 深色主题只需覆盖 `body.game-page` 上的颜色 token，例如 `--ink`、`--muted`、`--button-face`，图标不用改。
- 需要图标颜色与文字颜色不同时，在引用处加类并设置 `color`，或使用 `--icon-color` 变量。
- 单色图标是当前唯一支持的形态。多色图标或需要单独改某条路径颜色时，要在 symbol 内用 CSS 变量，或改为独立内联 SVG；不要直接在 symbol 里写死十六进制颜色。

## 添加或替换图标

1. 从 [Lucide](https://lucide.dev/icons/) 搜索并复制 SVG。
2. 去掉外层 `<svg>` 的 `width`、`height`、`class`、`fill`、`stroke`、`stroke-width`、`stroke-linecap`、`stroke-linejoin`，只保留内部几何元素。
3. 在 `src/shared/icons/sprite.svg` 中新增 `<symbol id="icon-<name>" viewBox="0 0 24 24">…</symbol>`。
4. 页面里用 `<svg class="icon" …><use href="#icon-<name>"></use></svg>` 引用。
5. 在下方清单登记名称、用途、来源和状态。
6. 运行 `npm run typecheck`、`npm run lint`、`npm run build`，并确认构建产物中 sprite 已内联。

替换已有图标时，只改 `sprite.svg` 里的 symbol 内容，页面引用不用动。

## 图标清单

| 名称             | 用途             | 来源                | 状态                        |
| ---------------- | ---------------- | ------------------- | --------------------------- |
| `settings`       | 设置按钮         | Lucide `settings`   | 已迁移（2026-10-24）        |
| `scores`         | 成绩列表按钮     | Lucide `logs`       | 已迁移（2026-10-24）        |
| `groups`         | 分组入口         | Lucide `layout-template` | 已迁移（2026-10-24）   |
| `mode-normal`    | 游戏模式·普通    | Lucide `eye`        | 已迁移（2026-10-24）        |
| `mode-blind`     | 游戏模式·盲玩    | Lucide `eye-off`    | 已迁移（2026-10-24）        |
| `move-click`     | 操作模式·点击    | Lucide `mouse-pointer-click` | 已迁移（2026-10-24） |
| `move-slide`     | 操作模式·滑动    | Lucide `spline-pointer` | 已迁移（2026-10-24）    |
| `move-keyboard`  | 操作模式·键盘    | Lucide `keyboard`   | 已迁移（2026-10-24）        |
| `size`           | 左栏阶数按钮     | 基于 Lucide 修改    | 已迁移（2026-10-24）        |
| `home`           | 回到主页         | Lucide `house`      | 已迁移（2026-10-24）        |
| `refresh`        | 刷新棋盘         | Lucide `rotate-cw`  | 已迁移（2026-10-24）        |
| `exit-retry`     | 重玩状态栏退出 / 设置页返回 | Lucide `undo-2`     | 已迁移；设置页复用（2026-10-24） |
| `chevron-down`   | 分组弹框展开     | Lucide `chevron-down` | 已迁移（2026-10-24）      |
| `←`              | 占位页返回首页   | 文字字符            | 暂不处理                    |
| `×`              | 弹窗/提示关闭    | 文字字符            | 暂不处理                    |
| `→`              | 首页游戏卡片箭头 | 文字字符            | 暂不处理                    |

### P8-4b 设置页图标

以下图标已随 P8-4b 加入 sprite，沿用 Lucide 几何和 1.8 线宽规范：

| 名称            | 用途             | 来源                  | 状态                  |
| --------------- | ---------------- | --------------------- | --------------------- |
| `paintbrush`    | 外观分类         | Lucide `paintbrush`   | 已加入（2026-10-24）  |
| `globe`         | 语言分类         | Lucide `globe`        | 已加入（2026-10-24）  |
| `palette`       | 游戏主题分类     | Lucide `palette`      | 已加入（2026-10-24）  |
| `info`          | 关于分类         | Lucide `info`         | 已加入（2026-10-24）  |
| `rotate-ccw`    | 重置未保存修改   | Lucide `rotate-ccw`   | 已加入（2026-10-24）  |
| `save`          | 保存设置         | Lucide `save`         | 已加入（2026-10-24）  |
| `monitor`       | 跟随系统主题     | Lucide `monitor`      | 已加入（2026-10-24）  |
| `sun`           | 浅色主题         | Lucide `sun`          | 已加入（2026-10-24）  |
| `moon`          | 深色主题         | Lucide `moon`         | 已加入（2026-10-24）  |
| `check`         | 选中态标记       | Lucide `check`        | 已加入（2026-10-24）  |
| `external-link` | 关于页外链       | Lucide `external-link` | 已加入（2026-10-24） |
| `mail`          | 关于页邮箱       | Lucide `mail`         | 已加入（2026-10-24）  |

外观、语言、游戏主题三个导航图标于 2026-10-24 按用户提供的 Lucide SVG 替换；`palette` 的圆点保留 `fill="currentColor"`。设置页返回按钮复用游戏页重玩状态栏的 `exit-retry` 图标；`arrow-left` 仍保留在 sprite 中，当前设置页不再使用。

## 构建机制

`vite.config.ts` 中的 `iconSpritePlugin()` 负责：

- 读取 `src/shared/icons/sprite.svg`；
- 在开发和构建时把 HTML 里的 `<!-- icon-sprite -->` 替换成 sprite 内容；
- 开发时修改 sprite 会触发整页刷新；
- 构建后带 `<!-- icon-sprite -->` 占位符的页面自带 sprite，无额外请求、无运行时 JS 依赖。

`prototype/layout-lab.html` 也保留占位符；它只在开发服务器中访问，不参与构建。

## 后续

- 游戏页图标已全部迁移到 sprite；设置页图标已随 P8-4b 加入并登记，后续只处理占位页 `←`、弹窗/提示 `×`、首页 `→` 是否也改为 SVG。
- 评估线宽是否从 `1.8` 统一为 Lucide 默认的 `2`。
- 成绩页、回放页及后续游戏页新增图标时直接复用本方案。
- 需要动态生成图标时，再在 `src/shared/icons/` 增加 `createIcon(name)` 工具，避免在业务代码里拼 SVG 字符串。
