# MONOFORM 二次开发 · 开发文档包

> 项目：在 GuiYi-Xi/monoform-previs-studio（MONOFORM 素形白模预演工作台）之上二次开发，为 AI 漫剧课堂增加「导演机位图 + 提示词编译」能力。
> 开发管理：Trellis（`.trellis/`）+ ZCode（Trellis 平台标识 `--zcode`，生成 `.zcode/` 配置，命令前缀 `/trellis:`）。
> 用途：课堂自用训练，不对外发布。上游仓库无开源许可证——只在本机/课堂范围内使用与分发（见 spec/fork-discipline.md）。

## 文档地图

| 文档 | 内容 | 在 Trellis 中的位置 |
|---|---|---|
| `00-overview.md` | 项目背景、已拍板决策（ADR 摘要）、架构总图 | 项目根 `docs/`，人工与 AI 必读 |
| `spec/product-spec.md` | 产品规格（开发版）：功能范围、视图与标注层、交互、数据、验收总纲 | `.trellis/spec/` |
| `spec/base-audit.md` | 基座代码审计：文件地图、状态模型、关键函数、接缝候选点 | `.trellis/spec/` |
| `spec/diagram-symbols.md` | 符号体系规格：每类对象的顶视画法、尺寸、配色、标签 | `.trellis/spec/` |
| `spec/prompt-compiler.md` | 提示词编译规格：投影算法、术语映射表、分层模板、测试用例 | `.trellis/spec/` |
| `spec/fork-discipline.md` | Fork 纪律：适配层、接缝台账、上游同步 SOP、退出条件 | `.trellis/spec/` + 仓库根 |
| `PATCHES.md` | 接缝台账（模板，开发中逐条登记） | 仓库根，随代码提交 |
| `tasks/T00–T07` | 任务拆分：每份含目标、范围、实现要点、验收、依赖 | 逐个录入 `.trellis/tasks/` |

完整讨论过程见上一级目录的《2.5D模式产品规格-讨论稿.md》（v0.3）——那是决策来源；本包是给开发用的定版提炼，两者冲突时以本包为准，并回改讨论稿。

## 开工顺序（ZCode + Trellis）

1. Fork/克隆上游到本地工作仓库，`git remote add upstream https://github.com/GuiYi-Xi/monoform-previs-studio.git`（细节见 fork-discipline）。
2. 在仓库根执行 Trellis 初始化并选择 ZCode 平台（`trellis init --zcode`），生成 `.trellis/` 与 `.zcode/`。
3. 把本包 `spec/` 下 5 份文件放进 `.trellis/spec/`；`00-overview.md` 与 `PATCHES.md` 放仓库根/docs。
4. 按 `tasks/` 编号顺序在 Trellis 中逐个建任务（T00 先行），每份任务的「验收」段落就是 check 阶段的依据。
5. 每个任务开工前先跑 Trellis 的 before-dev 流程读 spec；完工用 check 流程对照本包验收项核验。

## 全局硬约束（任何任务都不得违反）

1. **不改上游状态结构**：我们的代码读写 MONOFORM 状态只经适配层（`src/diagram/stateAdapter`，见 fork-discipline）。
2. **新功能只进新目录** `src/diagram/`；对上游文件的改动只许是登记在 PATCHES.md 的接缝。
3. **标注层不进成片**：轴线、视线、视锥、标签等 Gizmo 只在编辑视图渲染，禁止进入 MONOFORM 的 PNG/MP4 导出画面（导出我们自己的机位图除外）。
4. **图文同源**：俯视图、透视关系、提示词全部由同一份场景状态在同一时刻计算，禁止缓存旧结果冒充实时。
5. **只自动化几何层**：动作、表演、台词永远由用户填写，编译器不得生成。
