# 项目说明（给 AI 协作者）

本仓库是 Criel 的个人博客与游戏站。当前处于 `refactor/vite-ts` 分支的渐进式重构期。

## 必读

- `docs/REFACTOR_PLAN.md`：重构目标、技术选型、阶段划分与工作方式，动手前先读。
- `README.md`、`docs/PUZZLE_GAME.md`：现有功能与玩法说明。

## 开发

- 环境：Node.js 22+、npm。
- **不要自动启动开发服务器（`npm run dev`）或预览服务器（`npm run preview`）**；需要看效果时由用户自己启动，除非用户明确要求。
- `npm install` 安装依赖。
- `npm run dev` 启动 Vite 开发服务器。
- `npm run build` 执行 TypeScript 类型检查并构建到 `dist/`。
- `npm run preview` 预览构建结果。
- `npm run typecheck`、`npm run lint`、`npm run format`、`npm run format:check` 分别做类型检查、ESLint、Prettier 格式化与检查。
- `npm test` 运行 Vitest 单测；`npm run test:watch` 进入监听模式。
- `dist/` 是构建产物，不提交。

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

## 代码与注释规范

- 使用 TypeScript strict；核心逻辑优先写成纯函数，`core` 不碰 DOM，`data` 不直接操作页面。
- 优先使用不可变数据：返回新数组/新对象，不修改入参。
- 公开函数、类型和领域常量要有中文注释，说明“为什么”和“边界”，不要逐行复述代码。
- 领域约定必须写进注释或类型，例如：
  - `Direction` 表示方块移动方向，不是空白块移动方向；
  - 棋盘按行优先展开，`0` 是空白块；
  - 时间单位、坐标是否从 0 开始、统计是否包含空白块，都要写清楚。
- 关键算法注释要说明输入、输出、边界和兼容性；复杂公式最好附一个具体例子。
- 旧实现中的特殊行为、历史 bug、数据兼容要求，要在对应代码旁注明来源或原因。
- 测试描述用中文；核心逻辑必须有 Vitest 单测，测试文件与模块放在同一目录，命名为 `*.test.ts`。
- 不写无信息量的注释（如 `// 自增`、`// 循环`）；注释应帮助读者理解意图、约束和原因。

## 开发流程（必须遵守）

后续开发按以下顺序进行，不要跳步：

1. **说明方案**：动手前先说明要实现哪些东西、涉及哪些文件、核心算法/数据兼容影响、验收方式。
2. **讨论确认**：等用户提问、补充并明确确认后，再开始写代码。
3. **实现**：按确认的范围实现，不自行扩大范围；保持页面可运行。
4. **讲解**：实现完成后，逐个说明新增/修改的函数作用、算法或改动点，并说明测试与验证结果。
5. **Review**：等待用户 review 和进一步讨论；根据反馈修改，直到用户明确确认。
6. **提交**：只有用户完全确认后才执行 `git commit`；提交信息使用“英文前缀 + 中文内容”，例如 `feat: 添加拼图核心逻辑与单元测试`。

补充约定：

- 一次只讨论并迁移一个功能或模块，确认后再动手；不做大爆炸式重构。
- 改动前先确认旧行为和数据兼容要求，改动后更新文档。
- 关键决策同步到 `docs/REFACTOR_PLAN.md`（或后续的 `docs/ARCHITECTURE.md`）。
- 发现旧实现可能有 bug 时，先说明证据和影响，不要直接按“新写法”覆盖旧行为。
- 提交前运行 `npm test`、`npm run typecheck`、`npm run lint`、`npm run format:check`；涉及构建时再运行 `npm run build`。
