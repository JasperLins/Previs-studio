# T02 技术设计：顶视正交编辑视图与地面约束

> 研究基线：class @ 40bc601。关键机制（行号为参考，锚点以符号名为准）：
> `MainViewport`（Viewport.jsx:1308）按 `cameraView` 切 Canvas 相机配置与 key（'shot-view'/'scene-view'）；编辑视图由 `OrbitControls makeDefault target=editorCameraData.target`（:1256）驱动；对象变换 `TransformControls`（:1071）`showX/Y/Z + *Snap` + `onObjectChange=syncTransform`（:950/:1091）→ `onUpdate` → App `updateObjectById`；视角工具按钮区在 App.jsx:2166-2175（is-active 样式，openEditorView/openCameraView 模式）。

## 0. 规格先行（本任务第一步）

base-audit.md 接缝表 S2/S3 描述扩展（先改规格，代码后动）：
- S2 追加：顶视下 `SceneObject/CameraModel` 的 TransformControls 约束传参（`planeLock` prop 透传 + syncTransform 调 `applyPlaneLock`）。
- S3 追加：首个挂载件 = `TopViewControls / TopViewGrid`（顶视相机控制与米制网格/图纸底）。

## 1. 状态与数据流（全部为视图态，不进工程 JSON）

App.jsx 新增：
- `const [topView, setTopView] = useState(false)`
- `topViewSavedRef = useRef(null)`——进入时存 `editorViewRef.current`，退出时恢复（`setEditorView(clone)` 触发 Canvas key 重挂）
- `const [topViewZoom, setTopViewZoom] = useState(1)`——比例尺数据源（低频更新：控制 change 时节流上报）
- 网格开关绑定 `diagram.layers.grid`（经 `patchDiagram(prev, {layers:{...}})` 纯函数改，persist 由 T01 通道自动落盘）；0.5m 次格开关为组件本地态（默认开）。

进入动作 `toggleTopView()`：cameraView 为 true 时先退出摄像机视角；进入时由 `computeTopViewBounds(objects)`（纯函数）求场景中心与合适初始观察半径（对象 X/Z 包围盒，空场景回退中心 [0,0]、半径 6m）。

## 2. 顶视相机（src/diagram/TopViewControls.jsx，挂载于 EditorScene）

- `topView` 时 EditorScene 不渲染上游 OrbitControls，改渲染本组件：内部仍用 drei `<OrbitControls makeDefault enableRotate={false} enableDamping={false} mouseButtons 平移/缩放>`，target=场景中心。
- 挂载时把默认相机设为正交姿态：`camera.up.set(0,0,-1)`（上=场景北 -Z）、position=[cx, 100, cz]（高处俯视，near/far 覆盖场景高度）、lookAt(center)；zoom 初始 = min(canvasH, …)/观察半径 换算（含 20% 边距）。正交投影由 MainViewport 的 `orthographic` Canvas 配置提供（见 §4）。
- onChange 节流（~150ms 或 pointerup/wheel 事件）上报 `{zoom, heightPx}` → App setState 供比例尺。
- 方向约定唯一来源：组件内常量 + `topView.js` 导出 `TOP_VIEW_UP = [0,0,-1]`，供 T03/T04 对齐。

## 3. 地面约束（planeLock 传参链）

- App `topView` → MainViewport → EditorScene → `SceneObject` / `CameraModel` 新增 `planeLock` prop（prop 透传属接缝 S2 范围）。
- TransformControls（两处）：
  - translate：`showY={planeLock ? false : 原值}`
  - rotate：planeLock 时 `showX={false} showZ={false}`（只留 Y 环=水平角）
  - scale 不约束。
- `syncTransform`（两处）在 onUpdate 前调纯函数 `applyPlaneLock(data, next)`（src/diagram/topView.js）：`next.position[1]=data.position[1]`，`next.rotation[0]=data.rotation[0]`、`next.rotation[2]=data.rotation[2]`（data 为该对象已提交状态）。双保险防任何路径的 Y 漂移。
- 吸附（translationSnap 0.1 / rotationSnap 5°）与撤销（updateObjectById→currentProject→50 步栈）走既有机制，零改动。

## 4. Viewport 接缝改动清单（S1/S2/S3 全量）

1. `MainViewport`：key 三态 `cameraView ? 'shot-view' : topView ? 'top-view' : 'scene-view'`；topView 时 `<Canvas orthographic camera={{position:[cx,100,cz], zoom:初始, near:0.1, far:400}}>`（center/zoom 由 App 经 props 传入）。
2. `EditorScene`：`planeLock` 透传；topView 时不渲染上游 OrbitControls、渲染 `<TopViewControls>`；`<Ground showGrid={...} showSurface={!topView && ...}>`（图纸底由 TopViewGrid 自带浅色地面替代）。
3. `SceneObject` / `CameraModel`：`planeLock` prop + TransformControls showY/X/Z + syncTransform 两行调 `applyPlaneLock`。
4. `TopViewGrid`（diagram，经 S3 挂载）：浅色地面大平面（#f4f1ea）+ 米制网格（1m 主线 #b9b3a6、0.5m 次线 #d8d4ca 可关，drei Grid 或线段实现自选，尺寸随场景半径×2+10m、infiniteGrid 禁用避免透视淡出）+ 中心十字轴线弱化线。
5. 画布底色：视口容器加 `dg-topview` class（styles.css 末尾追加，`dg-` 前缀纪律），浅色图纸底 + 提升对比。

## 5. UI（App.jsx，S1 + 挂载）

- 视角工具区（:2167 编辑视角按钮旁）加「顶视」按钮：is-active 同款样式，`toggleTopView`，cameraView 时点击=先退出摄像机视角再进顶视。
- 视口容器内挂 `<TopViewOverlay>`（src/diagram/TopViewOverlay.jsx，纯 HTML/SVG）：
  - 左上方向标：N↑（SVG，固定指北，标注「北 · -Z」）；
  - 左下比例尺：`pickScaleBar(worldPerPx)` 选 0.5/1/2/5m 档（目标 60–160px），线段+读数；
  - 网格开关小按钮（1m 常开；0.5m 次格本地开关）；
  - 右上角「退出顶视」快捷（等同按钮）。
- 导航提示行（:2187）topView 时替换为顶视操作提示（拖拽=平移 X/Z · 滚轮=缩放 · 拖对象=地面移动）。

## 6. 纯函数（src/diagram/topView.js + node --test）

- `isTopView({topView, cameraView})` → `topView && !cameraView`（T04 总开关唯一来源）
- `applyPlaneLock(data, next)` → 保 Y 保俯仰/翻滚（data 缺字段时原样返回 next 拷贝）
- `computeTopViewBounds(objects)` → `{center:[cx,cz], radius}`（X/Z 包围盒；空/无效输入回退 `{center:[0,0], radius:6}`；radius=max(2, bbox 对角/2+2)）
- `pickScaleBar(worldPerPx)` → `{meters, px}`（0.5/1/2/5 档，60–160px 区间，向下取档）
- `worldPerPixel(zoom)` → `1/zoom`（R3F 正交默认 frustum 口径，TopViewControls 上报 heightPx 供换算）

## 7. 验收映射

- 进出顶视不改场景数据：视图态不进 projectData；进入/退出只动 editorView/topView → 切镜（activeShotId 变化）不重挂 Canvas（key 与 shot 无关），内容随 props 刷新 ✓
- 拖 1m 切回 3D 一致无漂移：planeLock 双保险（gizmo 隐藏 + applyPlaneLock 夹紧）✓
- 正交无透视变形：orthographic Canvas ✓（验收时等距两段图上等长目测）
- 网格/比例尺数值一致：网格间距=米制常量；比例尺=worldPerPixel(zoom) 换算 ✓
- 明确非目标：符号替换与机位 Gizmo（T03/T04）；幽灵机位；顶视下关键帧拖帧行为不变。
