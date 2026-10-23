# PATCHES · 接缝台账

> 规则见 spec/fork-discipline.md。每改一处上游文件，先在此登记再动手；上游同步时逐条复核。

## 当前基线

- 上游仓库：https://github.com/GuiYi-Xi/monoform-previs-studio（remote 名 `upstream`，只拉不推）
- 上游基线提交：`f34cb80642aa7dd749951f347aa70ed205ac28d7`（2026-10-24 克隆即审计基线；本地 `main`、`upstream-mirror`、`class` 起点均为此提交）
- 我们的版本标：`class-v0-base`（打于 f34cb80，T00）；`class-v1` 待 T07 发布
- origin（我们的私有仓库）：`git@github.com:JasperLins/Previs-studio.git`（T00 已配置；首次推送：`git push -u origin class` + `git push --tags`）

## 接缝登记

| 编号 | 文件 | 锚点（函数/区域） | 改动 | 目的 | 登记日期 | 同步复核 |
|---|---|---|---|---|---|---|
| S1 | src/App.jsx | 视口工具栏 | （待 T02 填）加「顶视」切换按钮 | 模式入口 | | |
| S2 | src/App.jsx / src/Viewport.jsx | editorView 相关 | （待 T02 填）顶视正交预设读写 | 顶视相机 | | |
| S3 | src/Viewport.jsx | 画布根组件 | （待 T03 填）挂载 diagram 标注/符号层 | 标注与符号 | | |
| S4 | src/App.jsx | 右侧面板页签 | （待 T06 填）加「机位词」页签 | 提示词面板 | | |
| S5 | src/App.jsx | 顶部 import；`normalizeProjectData`（return 加 diagram 键）；`projectData`（参数与 return 加 diagram）；`App()` 状态声明区（`const [diagram, setDiagram]`）；`currentProject` useMemo（传入 diagram 并入 deps）；`applyProjectSnapshot`（`setDiagram(normalized.diagram)`）；`saveProject`（projectData 调用传 diagram） | 接缝只挂载传参：透传 diagram 扩展字段并经 `normalizeDiagram` 补默认值，逻辑全在 `src/diagram/diagramData.js`；diagram 随 currentProject 进入既有 50 步历史栈与 900ms 自动保存 | 数据兼容：老工程打开补默认、保存后字段落盘、原版打开带 diagram 工程不报错 | 2026-10-24 | |

## 同步记录

| 日期 | 上游目标提交 | 执行人 | 冲突文件 | 回归清单结果 | 新版本标 |
|---|---|---|---|---|---|
| | | | | | |
