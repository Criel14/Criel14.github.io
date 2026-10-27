# 游戏清单与接入约定

> 状态：2026-10 起贪吃蛇下线；本文件记录现有游戏与后续新游戏的接入约定。
>
> 相关文档：`docs/REFACTOR_PLAN.md`、`docs/PUZZLE_ARCHITECTURE.md`

## 1. 游戏清单

| 游戏 | 状态 | 页面入口 | 源码 |
| --- | --- | --- | --- |
| 数字华容道 | 维护中 | `/puzzle-game/puzzle.html`、`settings.html`、`score-list.html`、`replay.html` | `src/games/puzzle/` |
| 贪吃蛇 | 已下线（2026-10） | 无 | 历史实现见 git tag `pre-refactor-2026-10` |

- `puzzle-game/` 是为了保持线上 URL 不变而保留的历史入口路径；新游戏不要照搬 `-game` 后缀。
- 下线游戏不保留占位页；历史代码通过 git tag / worktree 查阅。

## 2. 新游戏目录

新游戏统一放在 `src/games/<game-id>/`，`game-id` 使用小写 kebab-case，例如 `minesweeper`。

```text
src/games/<game-id>/
├─ types.ts          # 游戏领域类型与不变量
├─ core/             # 纯逻辑：规则、状态机、计分、生成/打乱等；不碰 DOM 与存储
├─ data/             # localStorage / IndexedDB、schema、校验、编解码
├─ ui/               # DOM / Canvas 渲染、输入、格式化
├─ pages/            # 页面入口组装
└─ styles/           # 游戏私有样式
```

分层约束与拼图一致：`core` 不碰 DOM；`data` 不直接操作页面；`ui` 只做 DOM 适配；`pages` 负责组装。游戏私有逻辑不要放进 `src/shared/`；只有两个以上游戏真正复用的模块才上移。

## 3. 页面入口

- 新游戏入口放仓库顶层 `/<game-id>/`，例如 `/minesweeper/index.html`；多页面游戏可以使用 `/minesweeper/game.html`、`/minesweeper/settings.html`。
- 每个 HTML 入口都要加入 `vite.config.ts` 的 `build.rollupOptions.input`，否则不会输出到 `dist/`。
- 入口 HTML 负责引入本游戏样式和 `pages/*.ts`；共享样式从 `src/shared/styles/` 引入。
- 首页 `index.html` 增加卡片，卡片编号按展示顺序递增；不可玩的游戏不要放成链接。
- README 增加游戏简介和功能列表；下线时同步移除。

## 4. 命名与存储

- localStorage：`<game-id>.v1.<name>`，例如 `minesweeper.v1.settings`。
- IndexedDB：使用独立数据库 `<game-id>.v1`，不要复用拼图的 `puzzle.v2`。
- 全站偏好继续使用 `site.v1.preferences`；游戏不要另存一份语言/颜色主题/计时器字体/大鼠标指针。
- 旧数据默认不迁移；需要兼容时先写明来源、版本和失败降级策略。删除数据必须提供显式入口，不自动清理用户数据。

## 5. 测试与验收

- `core` 纯函数、`data` 编解码和关键 UI 状态至少有 Vitest 单测；测试与源码同目录，命名 `*.test.ts`，描述用中文。
- 跨页面浏览器测试暂不做；需要时由用户手动验收，后续恢复 E2E 再统一放 `tests/e2e/`。
- 新游戏接入至少确认：
  - `npm run build`、`npm test`、`npm run lint`、`npm run format:check` 通过；
  - 首页入口可达，直接访问 HTML 路径可运行；
  - 键盘/移动端基本可用，无控制台错误；
  - 游戏私有逻辑没有污染 `src/shared/`。

## 6. 下线流程

1. 从首页移除卡片，删除 README 对应章节。
2. 从 `vite.config.ts` 移除入口，删除顶层 `/<game-id>/` 目录和 `src/games/<game-id>/`。
3. 在本文“游戏清单”把状态改为“已下线”，保留 git tag / 提交记录作为历史参考。
4. 旧数据不自动删除；如需提示用户清理，提供显式入口并说明影响范围。
