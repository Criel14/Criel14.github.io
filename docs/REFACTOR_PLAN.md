# 重构计划

> 状态：阶段 3 进行中（拼图 P0–P7 已完成；P8-0 设计确认（2026-10-21），P8-1 页面骨架、P8-2 输入/session/统计、P8-3 结算/保存/重玩与重玩状态栏已完成（2026-10-22～10-23）；分组模型改为事件级（2026-10-24 设计确认），P8-4a-0 分组模型与数据层、P8-4a 分组弹框已完成（2026-10-24），P8-4b 设置面板、P8-5 光标/极简 UI/可访问性、P8-6 E2E 待开始；P7-3 交互与视觉随 P8 手动验收，详细设计见 `docs/PUZZLE_GAME_PAGE.md`、`docs/PUZZLE_REPLAY.md`、`docs/PUZZLE_STORAGE.md`、`docs/PUZZLE_SCORE_PAGE.md`）
>
> 分支：`refactor/vite-ts`
>
> 基线 tag：`pre-refactor-2026-10`

## 0. 背景与意图（给后续 AI 的上下文）

- 这个仓库是 Criel 的个人博客与游戏站，部署在 GitHub Pages 和 Netlify，纯静态、无后端，用户数据全部保存在浏览器本地：小设置和外观用 localStorage，成绩列表和录像用 IndexedDB。
- `puzzle-game` 写于大二暑假，是作者刚学前端三件套时的练习项目；`snake-game` 是后来借助 coding agent 做的小游戏。两套代码都带有明显的“能跑就行”痕迹：全局状态、重复渲染、直接读写 localStorage、重依赖全量引入等。
- 作者现在的目标不是把旧代码整理整齐，而是把项目重构为更工程化、更可扩展、更容易长期维护的形态，同时保留现有功能与体验；拼图旧数据已确认丢弃，不迁移。
- 作者重视运行时轻量：不希望在两个小游戏上引入 Vue/React 这类框架；但愿意使用成熟库解决图表、图标、国际化等通用问题，避免重复造轮子。
- 旧代码只作为行为参考，不是架构约束。渲染方式、数据结构、模块边界都可以重写；判断标准是功能、体验和数据模型，而不是“和以前写法一致”。旧代码里的临时写法不代表作者现在认可的工程标准，不要为了兼容旧实现而保留明显的问题。拼图旧数据已确认丢弃，不迁移；具体见第 6 节。
- 本次重构允许优化 UI 表现和性能，但不是重做视觉设计，原有玩法和识别度应尽量保留。
- 国际化（中/英）是本次新增的目标，需要覆盖两个游戏及其按钮、提示、tooltip、aria 文案等。
- 工作方式：一次只讨论一个功能或模块，充分讨论后再实现；不要自行扩大范围，也不要在未确认时做大规模改动。
- 后续 AI 提出方案时，应优先考虑：是否轻量、是否可测试、是否便于逐步迁移、是否影响用户数据与迁移成本、是否引入不必要的依赖或抽象。项目规模不大，工程化要服务于维护和扩展，避免过度设计。
- 这个文档是重构的指导性计划，不是详细实现说明；具体实现应在对应功能的讨论中再决定。

## 1. 目标

- 在不丢失现有功能和用户数据的前提下，完成工程化重构。
- 运行时保持轻量：不引入 Vue/React 等 UI 框架。
- 允许重写渲染逻辑、内部数据结构和模块边界；旧代码只作为行为参考，不作为架构约束。
- 每个阶段都可以独立部署、验证和回滚。

## 2. 技术选型

- 构建：Vite，多页应用（MPA），保留现有页面 URL。
- 语言：TypeScript（strict），浏览器原生 DOM / Canvas。
- 测试：Vitest 覆盖核心逻辑和数据层；Playwright 做少量端到端冒烟测试。
- 规范：ESLint + Prettier。
- 部署：GitHub Actions 构建 `dist` 发布 GitHub Pages；Netlify 使用同一构建命令。
- 存储：localStorage（设置/外观）+ IndexedDB（成绩/录像）；IndexedDB 使用 `idb` 轻量封装，测试使用 `fake-indexeddb`。
- 图表：ECharts 按需引入，仅成绩页加载；如果后续仍然偏重，再评估 uPlot。
- 图标：使用 Lucide 单色线性图标，统一维护在 `src/shared/icons/sprite.svg`，构建时内联到 HTML；生产环境不依赖运行时 CDN。详见 `docs/ICONS.md`。
- 国际化：轻量 typed module + 原生 `Intl`；规模变大后再评估 i18next / intl-messageformat。
- 组件库：不使用 Vue/React 组件库；复杂交互优先原生 HTML + 少量 headless 库。

## 3. 依赖原则

- 通用、困难、非核心的问题优先用成熟库：图表、日期格式化、颜色选择、焦点管理、国际化、IndexedDB 封装。
- 项目核心逻辑自己实现：华容道规则、打乱算法、计分、贪吃蛇状态机、碰撞与冲刺。
- IndexedDB 使用 `idb` 处理 Promise 化和事务；测试使用 `fake-indexeddb`，不引入重型 ORM。
- 引入依赖前先回答：它解决什么问题、增加多少体积、是否可替换、是否影响离线和国内访问。
- 不为“看起来工程化”引入抽象；`shared` 只放真正跨游戏复用的模块。
- 优先使用浏览器原生能力：`<dialog>`、`<input type="color">`、`Intl`、Canvas 2D、Web Animations。
- CDN 只用于原型或临时试验；生产依赖通过 npm 打包，避免版本漂移和第三方可用性风险。

## 4. 目录结构（参考）

```text
.
├─ index.html
├─ puzzle-game/                  # HTML 入口保留原路径
├─ snake-game/
├─ src/
│  ├─ shared/                    # 通用 ui、styles、icons、time、i18n
│  └─ games/
│     ├─ puzzle/
│     │  ├─ core/                # board、moves、scramble、session、stats、replay、appearance
│     │  ├─ data/                # localStorage、IndexedDB、schema、录像编码、stores、legacy
│     │  ├─ ui/                  # board-view、设置、成绩表、图表、格式化
│     │  ├─ pages/               # 三个页面入口
│     │  └─ styles/
│     └─ snake/
│        ├─ core/                # 状态机、碰撞、冲刺、模式
│        ├─ data/                # 最佳记录、设置
│        ├─ ui/                  # renderer、hud、主题、i18n
│        ├─ pages/
│        └─ styles/
├─ public/                       # 运行时图片、图标等静态资源
├─ tests/e2e/
├─ docs/                         # 文档，不参与构建
├─ .github/workflows/
├─ vite.config.ts
├─ tsconfig.json
└─ package.json
```

说明：

- HTML 入口继续放在原路径，构建后输出到 `dist` 下对应路径，旧链接不变。
- `core` 不碰 DOM；`data` 负责持久化、schema 与校验；`ui` 只做 DOM 适配；`pages` 负责组装。拼图不迁移旧数据，详见 `docs/PUZZLE_ARCHITECTURE.md`。
- 单元测试与 `core` 模块放在一起；跨页面浏览器测试放 `tests/e2e`。
- `docs/` 只放文档和截图，不参与构建；旧代码不复制到 `docs/reference`，用 git tag / worktree 对照。

## 5. 分阶段步骤

0. **基线与行为记录**：整理功能清单和必要的行为记录；不改代码。
1. **工程骨架**：Vite + TypeScript + 多页入口 + CI/部署；现有页面先原样跑通。
2. **拼图核心**：拆分 board、moves、scramble、session、stats、replay、appearance；先纯逻辑，后 data/UI；补核心单测。实现顺序见 `docs/PUZZLE_TASKS.md`。
3. **拼图页面**：共享 board-view，迁移游戏页、成绩页、回放页；设置/外观用 localStorage，成绩/录像用 IndexedDB，不迁移旧数据。
4. **贪吃蛇**：拆分 engine、renderer、i18n、theme、storage；保持玩法手感。
5. **收尾**：依赖瘦身、UI/可访问性/性能优化、旧资源清理、文档更新。

每个阶段结束后都应满足：页面可运行、核心功能可用、没有明显控制台错误，并且可以单独回滚。

## 6. 数据与兼容策略

- **拼图旧数据不迁移、不兼容**。旧键 `config`、`scores`、`currentScore`、`currentScoreList` 不再读取。
- 旧键只提供显式清理入口（`src/games/puzzle/data/legacy.ts`），不自动删除；GitHub Pages 与 Netlify 需分别清理。
- **存储分层**：设置、外观存 localStorage；成绩列表和录像存 IndexedDB（DB `puzzle.v2`，stores `scores` / `replays`，索引 `by-bucket` / `by-event`）。
- **录像先全量保存**：每条成绩保留对应录像；容量评估见 `docs/PUZZLE_STORAGE.md` 4.5，后续再按需增加保留策略。
- **录像紧凑编码**：IndexedDB 中存 `directions` + `timeDeltas`，读取时解码为 `ReplayRecord`；不存储逐帧棋盘。持久化时间保留 3 位小数。
- 成绩只存事实；`tps`、`number`、`ao5`、`ao12`、格式化时间等派生值读时计算。详见 `docs/PUZZLE_ARCHITECTURE.md` 与 `docs/PUZZLE_STORAGE.md`。
- 成绩 ID 使用 `crypto.randomUUID()`（含回退实现），不使用雪花 ID；ID 用于稳定引用，展示编号由桶内排序派生。
- 拼图分组按事件划分：事件 = 阶数 + 游戏模式，共 18 个；每个事件固定 5 个分组（ID 1–5），共 90 个。只允许修改名称，不新增、不删除分组；清空当前分组即清空对应成绩桶，清空当前事件删除该事件 5 个分组的成绩与录像。
- 分组管理集中在成绩页；游戏页只负责切换。详见 `docs/PUZZLE_SCORE_PAGE.md`。
- 页面间不通过 localStorage 传状态；回放、重玩使用 URL 参数 + score id。
- 统计筛选、选中成绩等页面状态使用 URL 参数；旧页面 URL 路径保留。
- 版本管理：localStorage envelope 使用 `version: 3`；IndexedDB 使用 `DB_VERSION = 2`。不再使用 `puzzle.v2.meta`；当前 v2 不做旧版本迁移，分组模型变更后清一次缓存即可。
- 不做 localStorage 降级成绩存储；IndexedDB 不可用时明确提示，避免两套数据源。
- 贪吃蛇旧数据策略在其重构阶段单独决定，默认同样优先新键、不迁移旧记录。
- 旧代码只作为行为参考，不复制进新目录；需要对照时使用 git tag、`git show` 或 worktree。

## 7. 功能与验收

- 以 README、`docs/PUZZLE_GAME.md` 和实际行为为准，维护一份功能清单。
- 每个功能实现前先讨论：旧行为是什么、是否保留或优化、如何验收。
- 必须覆盖：
  - 拼图：三种操作模式、盲玩、计时/观察时间、ao5/ao12 规则、三种着色模式（降阶/按行/固定色）、主题级字号/间隙/圆角、盲玩隐藏数字颜色、预设与自定义主题、自定义光标、录像回放、录像重玩、事件级分组、按分组/事件清空成绩与删除成绩、全量保存录像。
  - 贪吃蛇：三种模式、碰撞缓冲、锁定冲刺、计分、最佳记录、速度设置、中英文、深浅主题。
- 数据：拼图旧成绩、旧配置、旧自定义方案不迁移；提供显式清理入口。成绩/录像使用 IndexedDB，设置/外观使用 localStorage；长录像不占满 localStorage。贪吃蛇在对应阶段决定。
- 质量：构建通过、核心测试通过、移动端和键盘可用、无控制台错误。
- 性能目标（非硬性指标）：首页几乎零 JS；游戏页不加载图表；图表按需加载；图标不依赖第三方 CDN。

## 8. 工作方式

- 每次只讨论并实现一个功能或一个模块，确认后再动手。
- 保持代码随时可运行，不做长时间的“大爆炸式”重构。
- 改动前先看功能清单、数据模型与不变量；改动后更新文档。
- 重构期间不顺手加入无关功能；新功能单独立项。
- 关键决策记录在本文件、`docs/PUZZLE_ARCHITECTURE.md`、`docs/PUZZLE_REPLAY.md` 或 `docs/PUZZLE_STORAGE.md` 中。

## 9. 待讨论

- 图标：游戏页已全部迁移到本地 sprite；待定线宽是否从 `1.8` 统一为 `2`，以及 `←` / `×` / `→` 是否也纳入 sprite。详见 `docs/ICONS.md`。
- 国际化：自研 typed module / i18next / intl-messageformat；默认语言和切换入口；默认分组名 `分组N` / `GroupN` 的生成时机。
- 自定义光标：保留 PNG / 改为 SVG data URI。
- 贪吃蛇渲染：DOM diff / Canvas 2D。
- 自由模式当前“暂无”的处理：实现还是移除对应文案。
- 外观自定义主题是否支持命名、删除、排序（当前 3 个槽位；主题已支持三种着色模式和独立 metrics）。
- 分组数量扩展（超过每事件 5 组）需要 schema/UI 调整；当前固定 5 组/事件。
- 录像保留策略：当前全量保存；后续是否增加“只删除录像、保留成绩”“只保留最近 N 个月”或“只保留最佳成绩录像”。
- 成绩 / 录像 / 设置导入导出 JSON（v2 schema 稳定后再做）。
- 长录像时间轴是否改为 checkpoint / 按需物化盘面（当前保留完整帧）。
- 是否使用 `navigator.storage.persist()` 申请持久化存储。
- 图表最终选型：当前按需加载 ECharts，后续可评估 uPlot / 自绘 SVG。

## 10. 参考

- 现有功能说明：`README.md`、`docs/PUZZLE_GAME.md`
- 游戏页设计与 P8 任务：`docs/PUZZLE_GAME_PAGE.md`
- 成绩页与分组管理：`docs/PUZZLE_SCORE_PAGE.md`
- 拼图架构契约：`docs/PUZZLE_ARCHITECTURE.md`
- 回放设计：`docs/PUZZLE_REPLAY.md`
- 数据存储设计：`docs/PUZZLE_STORAGE.md`
- 拼图任务清单：`docs/PUZZLE_TASKS.md`
- 图标规范与清单：`docs/ICONS.md`
- 旧版本基线：git tag `pre-refactor-2026-10`
- 旧代码只读 worktree：`D:\Project\Criel14.github.io-legacy`（detached HEAD，指向基线 tag；供重构期间随时检索旧实现，不修改、不提交）
  - 缺失时重建：`git worktree add ../Criel14.github.io-legacy pre-refactor-2026-10 --detach`
- 重构分支：`refactor/vite-ts`
