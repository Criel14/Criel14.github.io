# 项目说明（给 AI 协作者）

本仓库是 Criel 的个人博客与游戏站。当前处于 `refactor/vite-ts` 分支的渐进式重构期。

## 必读

- `docs/REFACTOR_PLAN.md`：重构目标、技术选型、阶段划分与工作方式，动手前先读。
- `README.md`、`docs/PUZZLE_GAME.md`：现有功能与玩法说明。

## 旧代码参考（只读）

重构前的完整实现保存在 git tag `pre-refactor-2026-10`，并已检出到与主仓库同级的独立 worktree：

```text
D:\Project\Criel14.github.io-legacy
```

- 该目录是 detached HEAD，只用于查阅旧实现：**不要修改、不要提交**。
- 需要还原旧行为、旧 localStorage 键名/字段、CSS 细节或交互边界时，先去该目录检索，不要凭印象重写。
- 旧代码只作为行为参考，不作为架构约束；不要把旧文件整段复制回主仓库。
- 若该目录不存在（换机器或被清理），在主仓库执行：
  `git worktree add ../Criel14.github.io-legacy pre-refactor-2026-10 --detach`
- 也可以不创建 worktree，直接用 `git show pre-refactor-2026-10:path/to/file` 查看单个文件。

旧入口速查（路径相对 legacy worktree）：

- 拼图游戏：`puzzle-game/puzzle.html`、`puzzle-game/js/puzzle.js`、`puzzle-game/js/defaultConfig.js`
- 成绩页：`puzzle-game/score-list.html`、`puzzle-game/js/scoreList.js`、`puzzle-game/js/scoreListChart.js`
- 回放页：`puzzle-game/replay.html`、`puzzle-game/js/replay.js`
- 贪吃蛇：`snake-game/snake.html`、`snake-game/snake.js`、`snake-game/snake.css`

## 工作方式

- 一次只讨论并迁移一个功能或模块，确认后再动手；不做大爆炸式重构。
- 保持页面随时可运行；改动前先确认旧行为和数据兼容要求，改动后更新文档。
- 关键决策同步到 `docs/REFACTOR_PLAN.md`（或后续的 `docs/ARCHITECTURE.md`）。
