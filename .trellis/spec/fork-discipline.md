# Fork 纪律与上游同步 SOP

> 上游：https://github.com/GuiYi-Xi/monoform-previs-studio（无 LICENSE、无 tags/releases、单 main 分支；2026-10-24 核查）。本项目为课堂自用二次开发。

## 仓库形态

- 本地工作仓库保留两个远程：`origin` = 我们的仓库（建议私有；待建，见 docs/PATCHES.md 基线节），`upstream` = 原作者仓库（只拉不推）。
- 分支：`upstream-mirror` 只跟随上游 main，不直接提交；`class` 为我们的生产分支（上游 + 接缝 + `src/diagram/`）。
- 我们的每次发布在 `class` 上打标：`class-v1、class-v2…`，并在 PATCHES.md 记录其对应的上游提交哈希；基线标为 `class-v0-base`（T00 已打于 f34cb80）。
- 文档落位（T00 定）：项目总览与 ADR 在 `docs/00-overview.md`；接缝台账在 `docs/PATCHES.md`；开发规格在 `.trellis/spec/`；任务规格经 Trellis 任务承载（`.trellis/tasks/`）。

## 三条纪律

1. **适配层唯一入口**：`src/diagram/stateAdapter`（单文件或单目录）是唯一允许 import 上游状态结构的地方。diagram 内其他模块只面对适配层输出的数据模型。上游改结构 → 只改适配层。
2. **接缝最小化 + 台账**：对上游文件的改动只许出现在 base-audit.md 列出的接缝（S1–S5）范围内；新增接缝必须先改规格再动手。每处接缝登记进 PATCHES.md（文件、锚点、目的、日期）。功能代码一律放 `src/diagram/` 新文件。样式只许在 styles.css 末尾追加我们前缀（`dg-`）的类。
3. **纯函数资产**：promptCompiler、符号几何计算、diagram 数据处理必须是无副作用纯函数并配单测——它们是可移植资产，与底座解耦。

## 上游同步 SOP

触发：按月巡检，或上游出现想要的功能。步骤：

1. `git fetch upstream`，在 upstream-mirror 上确认目标提交，哈希记入 PATCHES.md 草稿区。
2. 从目标提交开 `sync-test` 分支，合并 `class`。预期冲突只出现在接缝文件；若 `src/diagram/` 出现冲突，先停下修纪律。
3. 逐条按 PATCHES.md 台账复核接缝是否仍然成立（锚点漂移就重新定位接缝）。
4. 跑回归清单（下方），全过后合入 `class`，打新标，更新 PATCHES.md 与 base-audit.md 的审计基线（提交哈希/日期）。
5. 若上游实现了与我们重叠的通用功能（如自带顶视图）：评审后优先采用上游实现，删除我们的对应代码，并在此文件记录替代关系。

## 回归清单（每次同步与每期发布必跑）

- [ ] `npm run build` 通过
- [ ] 打开无 diagram 字段的老工程不报错；带 diagram 的工程可保存/重开
- [ ] 带 diagram 的工程用原版 MONOFORM 打开不报错（忽略扩展字段）
- [ ] 原有流程：加对象、拖变换、打机位/人物关键帧、切镜、导 PNG、导 MP4 各走一遍
- [ ] product-spec 第 4 节验收总纲逐项过
- [ ] `src/diagram/` 单测全绿

## 退出条件（出现任一，启动自立评估并记录）

- 作者明确反对使用/分发；
- 需要对外发布或产品化（许可证成为硬约束）；
- 核心需求超出其架构（如一镜多机位成刚需、需要协作）；
- 上游长期停更（fork 自然转主线，届时重命名并自担维护，代码总量约 4300 行，成本有界）。
