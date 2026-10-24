# T03 技术设计：机位视锥 Gizmo 与标签牌

> 研究基线：class @ 3eb59c6。相机数据链：`displayCamera`（App:1327，含关键帧动画态）→ `MainViewport cameraData` → `EditorScene cameraData` → 既有 `CameraModel`（:1263 区域）。导出隔离：PNG（App:2283）/MP4（:2289）走 `CameraPreview exportMode`（PreviewScene），不含 EditorScene → 本任务的 gizmo 层只挂 EditorScene 即结构性满足「不进导出」。

## 0. 规格对照（diagram-symbols「机位」节 + product-spec §2）

- 机身符号：绿色（`#22c55e` 系）矩形 22×14px（固定图面尺寸，±20%）+ 朝向侧等腰梯形楔形（长 10px），楔形指向 = 拍摄方向 = `camera.rotation` 水平分量（yaw=rotation[1]，与 CameraModel 朝向同源）。
- 视锥扇形：浅绿半透明，填充透明度 0.12、边线透明度 0.5；水平张角 = 2·arctan(18/f)（全画幅口径）；锥长 = 最远入画主体距离 + 1m，无入画主体时回退 5m（v1 定值；「固定 5m 开关」属 T05 图层面板）。
- 标签牌：深蓝 `#1e3a8a` 圆角（4px）白字，内边距 4×8px，三行：`Cam {字母}` / 景别 / `{focalLength}mm`。景别本任务用占位符「景别待 T06」（T06 换共享推断函数后生效 shotSizeOverride 逻辑）。拍摄对象名并入首行或第二行显示（`Cam A · 奶奶` 样式，对象名来自最近入画人物，实时跟随改名）。
- 字母：`diagram.shotMeta[activeShotId].camLetter` 非空用之；否则按 shots 序自动（A、B…Z、AA…，上限 30 镜）。
- 图层开关：`diagram.layers.frustum` 为 false 时锥+符号描边强调+标签全部隐藏（AC#4：锥与标签同隐）。
- 仅当前镜头机位（实色）；幽灵机位是 T05，本任务不做。

## 1. 模块结构

```
src/diagram/gizmos/
  frustum.js         纯函数（可 node --test）
  frustum.test.js
  CameraGizmo.jsx    R3F 组件（经 S3 挂 EditorScene；只读渲染，不持状态、不写数据）
```

## 2. 纯函数契约（frustum.js）

- `horizontalFovDeg(focalLength)` → `2·atan(18/f)` 换算度（f≤0 → 90 兜底）
- `verticalFovDeg(focalLength)` → `2·atan(12/f)`
- `isInFrame(camera, position, hfovDeg, vfovDeg)` → 布尔：构建机位前向（由 camera.position/rotation[1] yaw 的水平前向 + 忽略俯仰的简化口径 v1：水平角判定 + 距离>0.1；**注意**：rotation 为欧拉 [x,y,z]，前向取 yaw 旋转后的 -Z 方向水平投影）
- `coneLengthMeters(camera, objects, hfovDeg, vfovDeg)` → max(入画对象距离)+1，无入画对象 → 5；下限 2m 防退化
- `nearestInFramePerson(camera, objects)` → 最近入画 person 的对象引用或 null
- `camLetter(index)` → 'A'…'Z','AA'…（0 起，负数/非整数兜底 'A'）

## 3. CameraGizmo 组件（只读）

- 输入 props：`{ cameraData, objects, layerOn, letter, subjectName }`（App 侧算好 letter/subjectName/layerOn 再传，Viewport 只透传——接缝最薄）。
- 渲染（一个 group，位于 camera X/Z、y=0.02 地面层）：
  - 扇形：`CircleGeometry(r=锥长, thetaStart/Length=hfov)`，材质 `#22c55e`，opacity 0.12（透明、depthWrite false），旋转使平铺地面、张角中心线 = 拍摄方向；
  - 边线：两条 `Line`（从机位到扇形两端点），同色 opacity 0.5；
  - 机身符号：22×14 矩形 plane + 楔形 ShapeGeometry，实色 `#22c55e`，白描边可选；整体按「图面尺寸」换算 world scale；
  - 标签：drei `<Html>`（screen-space、不遮挡、`pointerEvents:none`）三行深蓝牌；每帧 useFrame 投影机位屏幕坐标，接近画布右/上边缘（<160px 阈值）时翻转到机位左/下侧（class 切换）。
- 尺寸策略：顶视（camera 为 OrthographicCamera）→ scale = px × (1/zoom)，每帧从 `useThree` 读 zoom；3D 编辑视图 → 按 camera 距离等比（scale = dist × 0.011，约 22px@典型距离），保持近似图面尺寸。
- 挂载条件：`!cameraView`（3D 编辑视图与顶视都显示；摄像机视角不显示——监看画面本就是机位所见）。
- CameraModel 保持原样（顶视下与符号叠放为已知取舍，视觉评审留 T04/T05；交互选择/拖拽仍走 CameraModel，不重复实现）。

## 4. 接缝（全部落在既有 S1/S3 范围）

1. App.jsx：MainViewport 调用行（:2222 一行内）追加 4 个 props：`cameraGizmo={{ on: diagram.layers.frustum, letter, subjectName }}`——letter/subjectName 在 App 用 frustum.js 纯函数由 diagram.shotMeta + shots 序 + animatedObjects 现算（useMemo）。
2. Viewport.jsx：`MainViewport` 透传 → `EditorScene` 挂 `<CameraGizmo cameraData={cameraData} objects={objects} ... />`（一行 + 签名参数）。
3. PATCHES.md S3 行更新锚点描述（追加 CameraGizmo 挂载）。
4. styles.css 末尾追加 `dg-cam-label` 系类（标签牌样式；drei Html 渲染的 DOM 走我们的类名）。

## 5. 测试与验收映射

- frustum.test.js：AC#1 焦距档位表（18→90.0°、24→73.7°、35→54.4°、50→39.6°、85→23.9°、120→17.1°，独立公式对照，误差断言 <0.01°）；isInFrame（机后/画外左/画外右/入画）；coneLength（多主体取最远+1、空回退 5、下限 2）；camLetter 序列。
- AC#2 切镜归属：切镜换 activeShotId → App useMemo 重算 letter（shot 序）→ 标签更新；对象名改动 → subjectName 实时（React 数据流，浏览器验证）。
- AC#3 不进导出：结构性隔离（gizmo 仅在 EditorScene；导出走 CameraPreview/PreviewScene）+ 浏览器核对导出监看画面。
- AC#4 图层开关：diagram.layers.frustum=false → gizmo 整体不挂载（浏览器验证：临时置 false 看 DOM/画面）。
- 浏览器验收：进顶视 → 符号/锥/牌在位；改焦距（镜头面板 42→24→120）锥张角目测变宽变窄；拖机位（或面板改机位位置）锥跟随；关 frustum 图层全隐。

## 6. 非目标

- 幽灵机位（T05）；景别真实推断与 shotSizeOverride（T06，本任务占位）；锥长「固定 5m」开关（T05 图层面板）；轴线的越轴变色（T05）。
