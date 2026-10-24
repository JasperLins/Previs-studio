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
| S1 | src/App.jsx | 视口工具栏 `viewport-view-options`（摄像机视角按钮后）；`App()` 状态声明区（cameraView 后）；`openCameraView` / `openEditorView`（三视图模式互斥：点击即退出顶视）及其后的 `toggleTopView`；`viewport-canvas-layer` 挂载处；导航提示行 | 「顶视」按钮（is-active 样式，cameraView 时点击先退出摄像机视角；反向：编辑/摄像机视角点击时退出顶视并按需恢复 editorView）；视图态 `topView/topViewFit/topViewZoom/topViewHalfGrid` + `topViewSavedRef` + `toggleTopView`（进入存 `editorViewRef`、算 `computeTopViewBounds`；退出 `setEditorView` 恢复——全程不触 objects/camera/shots）；`handleTopViewReport`（接收 TopViewControls 节流上报的 zoom）；MainViewport 传 `topView/planeLock/topViewCenter/topViewRadius/topViewGrid/topViewHalfGrid/onTopViewportReport` 且 key 三态（shot-view/top-view/scene-view）；canvas-layer 挂 `TopViewOverlay` + `dg-topview` class；导航提示 topView 分支；T03 追加：顶部 import `camLetter/nearestInFramePerson`（./diagram/gizmos/frustum.js）、topViewRadius 后一个 `cameraGizmo` useMemo（字母 shotMeta 手填优先否则按镜序、对象名取最近入画人物、on=diagram.layers.frustum）、MainViewport 调用行末追加 `cameraGizmo={cameraGizmo}` 一 prop | 顶视模式入口（挂载与传参，逻辑在 src/diagram/）；T03 机位 Gizmo 传参 | 2026-10-24 | |
| S2 | src/App.jsx / src/Viewport.jsx | `MainViewport`（Canvas 相机配置）；`SceneObject` / `CameraModel` 的 TransformControls 与 syncTransform | topView 时 Canvas `orthographic` + 相机置于场景中心上方 100（near 0.1/far 400，姿态与 zoom 由 TopViewControls 设定）；`planeLock` prop 透传：translate 隐藏 Y 轴、rotate 只留水平环（scale 不约束）；两处 syncTransform 在 planeLock 时提交前调 `applyPlaneLock`（保 Y/俯仰/翻滚，src/diagram/topView.js；planeLock=false 的 3D 视图原样提交，不受影响）双保险 | 顶视正交相机 + 地面约束编辑 | 2026-10-24 | |
| S3 | src/Viewport.jsx | `EditorScene`（画布内挂载区） | 挂载 diagram 首批组件：topView 时渲染 `TopViewControls`（替换上游 OrbitControls：禁旋转、平移/缩放、节流上报）与 `TopViewGrid`（米制网格/图纸底），同时屏蔽上游背景色/fog（正交远处会全雾化）/`EditorCameraReporter` 回写/`ViewFocusController`；`Ground` 在 topView 时隐藏（图纸底由 TopViewGrid 提供）。T03 追加：顶部 import `CameraGizmo`、`EditorScene` 签名末加 `cameraGizmo` 参数、`CameraModel` 挂载行后一行挂 `<CameraGizmo>`（!cameraView 且 cameraGizmo.on 时渲染：机位视锥扇形+机身符号+标签牌，只读组件，src/diagram/gizmos/；仅挂 EditorScene，结构性不进 PNG/MP4 导出）。后续 Gizmo/符号层（T04+）在同一挂载区追加 | 顶视相机控制与图纸底（标注与符号层的首个挂载点）；T03 机位视锥 Gizmo 挂载 | 2026-10-24 | |
| S4 | src/App.jsx | 右侧面板页签 | （待 T06 填）加「机位词」页签 | 提示词面板 | | |
| S5 | src/App.jsx | 顶部 import；`normalizeProjectData`（return 加 diagram 键）；`projectData`（参数与 return 加 diagram）；`App()` 状态声明区（`const [diagram, setDiagram]`）；`currentProject` useMemo（传入 diagram 并入 deps）；`applyProjectSnapshot`（`setDiagram(normalized.diagram)`）；`saveProject`（projectData 调用传 diagram） | 接缝只挂载传参：透传 diagram 扩展字段并经 `normalizeDiagram` 补默认值，逻辑全在 `src/diagram/diagramData.js`；diagram 随 currentProject 进入既有 50 步历史栈与 900ms 自动保存 | 数据兼容：老工程打开补默认、保存后字段落盘、原版打开带 diagram 工程不报错 | 2026-10-24 | |

## 同步记录

| 日期 | 上游目标提交 | 执行人 | 冲突文件 | 回归清单结果 | 新版本标 |
|---|---|---|---|---|---|
| | | | | | |
