# T00 仓库初始化与 Trellis/ZCode 接入

> 来源：开发文档包 `T00-repo-init.md`（本任务是其 Trellis 化载体）。与现状不符处，以 T00 与 spec 为准修正。

## Goal

得到一个能跑、能管、可同步上游的工作仓库（fork-discipline 定义的仓库形态）。

## Requirements（T00 范围 → 现状差距 → 执行方案）

1. **远程与分支**（fork-discipline 仓库形态）
   - 现状：仅 `origin` = git@github.com:GuiYi-Xi/monoform-previs-studio.git（即上游原作者仓库），仅 `main` 分支，无标签。
   - 方案：`git remote rename origin upstream` 并 fetch 验证连通；建 `upstream-mirror`（只跟上游 main，不提交）与 `class`（生产分支）均基于基线 f34cb80；我们的提交只落 `class`。
   - `origin`（我们自己的私有仓库）：用户未提供地址，本任务无法设置，作为遗留项汇报。
2. **基线可用性**：`npm install` 幂等通过；`npm run dev` 可启动并被 HTTP 访问；`npm run build` 通过（fork-discipline 回归清单第一项）。base-audit 核心流程（建场景、关键帧、导 MP4）属交互验收，headless 环境尽力验证，无法覆盖处如实标注待人工。
3. **Trellis/ZCode 接入**：`.trellis/` 与 `.zcode/` 已由 `trellis init --zcode` 生成（现状已满足）；验证 ZCode 会话上下文注入可用（本会话 SessionStart 已注入即证）。
4. **文档落位**：`.trellis/spec/` 五份已就位（维持）；`.trellis/00-overview.md`、`.trellis/PATCHES.md` → `docs/`（T00 写「仓库根/docs」，解读为仓库根下的 docs 目录，因该目录已存在且属我们的文档层；上游 docs/ 内容不冲突）；`.trellis/tasks/T00–T07*.md` 逐个录入 Trellis 任务（T00 = 本任务；T01–T07 建为 planning 状态任务，不启动）。原件先随导入 commit 入库留档，录入完成后删除，内容以 Trellis 任务目录为准。
5. **基线记录**：PATCHES.md 基线节填实际哈希 f34cb80 与日期；在 f34cb80 上打 annotated 标签 `class-v0-base`。

## Acceptance Criteria（T00 验收清单）

- [x] 原版 dev 服务器可启动，核心流程无报错
- [x] ZCode 打开项目时 Trellis 上下文可注入（或可手动 start）
- [x] `.trellis/spec/` 五份文件就位，`git status` 结构符合 fork-discipline 的仓库形态（upstream 远程、upstream-mirror/class 分支、class-v0-base 标签、工作树干净）

## 验收自检记录（2026-10-24）

1. **dev/核心流程**：`npm install` 幂等通过；`npm run build` 通过（chunk>500kB 警告为上游原有，非错误）；dev server 启动返回 200，`main.jsx/App.jsx/Viewport.jsx/rig.js/ShotsPanel.jsx` 模块编译均 200。浏览器自动化（IAB）走核心流程：页面完整启动 → 资源库加「方块」→ 对象入场景并持久化（自动保存 objects=person+3×box）→ 点「镜头关键帧」→ localStorage 自动保存出现 1 个机位关键帧；全程 console.error/window error/unhandledrejection 收集器为空。**未覆盖**：导出 MP4（交互式导出待人工各走一遍）。
2. **Trellis 注入**：本会话 SessionStart/UserPromptSubmit hook 正常注入 Trellis 上下文与 workflow-state；`task.py create/start/list/add-context` 全部可用（会话标识经 `TRELLIS_CONTEXT_ID` 手动提供）。
3. **spec/仓库形态**：`.trellis/spec/` 五份就位；`upstream` 远程（fetch 连通验证）；`upstream-mirror` 与 `class` 基于基线 f34cb80；annotated 标签 `class-v0-base` 打于 f34cb80；工作树 clean。**偏差**：`origin`（我们的私有仓库）未设置——地址待用户提供后 `git remote add origin <url>`。
4. **落位**：`docs/00-overview.md`、`docs/PATCHES.md`（基线已填 `f34cb80642aa…28d7`）；T01–T07 录入为 planning 状态任务（prd.md 为原件忠实拷贝，git 识别为 rename）；原始 T*.md 已删除（首个导入 commit 6911f2d 留档）。

## Notes

- 轻量运维型任务，PRD-only；无代码实现，故在主会话直接执行（git 状态变更与文件落位为确定性步骤，逐步验证），不 dispatch trellis-implement。
- 不启动 T01；T01–T07 仅创建任务（planning）。
