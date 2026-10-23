# T00 · 仓库初始化与 Trellis/ZCode 接入

**目标**：得到一个能跑、能管、可同步上游的工作仓库。
**依赖**：无。**期次**：P0 前置。

## 范围

1. 克隆上游到工作仓库；加 `upstream` 远程；建 `upstream-mirror` 与 `class` 分支（见 fork-discipline）。
2. `npm install && npm run dev` 跑通原版；按 base-audit 走一遍核心流程（建场景、关键帧、导 MP4）确认基线可用。
3. 在仓库根初始化 Trellis 并选择 ZCode 平台（`trellis init --zcode`），确认生成 `.trellis/` 与 `.zcode/`。
4. 把开发文档包落位：`spec/*` → `.trellis/spec/`；`00-overview.md`、`PATCHES.md` → 仓库根/docs；`tasks/*` 内容逐个录入 Trellis 任务。
5. 在 PATCHES.md 填实际基线提交哈希；给基线打标 `class-v0-base`。

## 验收

- [ ] 原版 dev 服务器可启动，核心流程无报错
- [ ] ZCode 打开项目时 Trellis 上下文可注入（或可手动 start）
- [ ] `.trellis/spec/` 五份文件就位，`git status` 结构符合 fork-discipline 的仓库形态
