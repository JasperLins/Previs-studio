# 内置课堂预设库：项目面板一键载入 presets 预设

## Goal

把 presets/*.monoform.json 打进应用包，ProjectsPanel 增加「课堂预设」分组，一键载入走 importProjectFile 同管线；跨浏览器可用。

## Background

课堂母版预设以 `presets/*.monoform.json` 存在仓库中（P0 已交付 01–03，P1 的 04–07 待放行）。当前学生只能用顶栏「打开」手动选文件载入，且载入后的工程库（IndexedDB）按 电脑+浏览器+域名 隔离，换浏览器/换机器后工程库为空，不利于课堂分发与跨浏览器查看学习。

## Requirements

1. 新纯函数模块 `src/projects/builtinPresets.js`：import `presets/` 下的 `.monoform.json`，导出预设清单（当前 01–03；P1 放行后追加 import 即可）。
2. `ProjectsPanel`（右侧「项目」页签）新增「课堂预设」分组：列出内置预设（名称、镜头数），每项「载入」按钮；复用现有 `dg-projects-*` 类，零新增 CSS。
3. App 接缝：新增 `loadBuiltinPreset` 回调，走 `importProjectFile` 同一载入管线（normalizeProjectData → applyProjectSnapshot → adoptProject → pendingRegistrationId → toast），不动核心状态结构。
4. 台账同步：base-audit.md 的 S8 行、docs/PATCHES.md 的 S8 条目追加本次延伸。

## Constraints（fork 纪律）

- 不新增接缝：改动落在 S8 既有范围（App.jsx 项目面板挂载/回调 + 逻辑在 `src/projects/` 新文件）。
- ProjectsPanel 保持哑组件：只加 props 与展示，不含工程数据逻辑。
- `presets/` 目录保持单一数据源：模块直接 import JSON，不复制文件。
- 与进行中任务 `10-24-preset-framing-fix` 的未提交改动隔离：App.jsx / base-audit.md / PATCHES.md 已有未提交改动，提交时按 hunk 拆分，只提交本任务增量；P0 预设数据文件单独成 commit。

## Acceptance Criteria

- [ ] `npm run build` 通过；`node --test "src/diagram/**/*.test.js"` 全绿。
- [ ] 全新浏览器上下文打开应用 →「项目」页签能看到 3 个内置预设（名称与镜头数正确）。
- [ ] 点击任一预设「载入」→ toast 成功、场景/镜头数与该预设一致、零控制台报错；载入后注册进本机工程库（与「打开工程」一致）。
- [ ] 项目库不可用（unavailable）时预设分组仍可见可载入。
- [ ] 台账（base-audit S8 / PATCHES.md）与 presets/README.md 已更新。
