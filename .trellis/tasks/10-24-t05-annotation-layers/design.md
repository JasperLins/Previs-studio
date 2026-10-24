# T05 技术设计：标注层补全（轴线/视线/路径/幽灵机位）

> 研究基线：class @ 0f4fcc1 + archive。关键帧形状：相机轨 `keyframes[{frame,position[3],rotation,focalLength}]`（App:191）；对象轨 `objectKeyframes[id][{frame,position?,rotation?,pose,…}]`（App:293）；ghost 数据源=各 shot 快照 camera（T01 已有 getGhostShots 雏形）。

## 0. 规格先行

base-audit.md S3 行追加：AnnotationLayer 挂载与 App 侧标注数据组装（中性形状）；PATCHES.md 登记。

## 1. 数据边界（上游形状止于 App 接缝）

App 用 useMemo 组装 **中性标注数据**（不把 keyframes/objectKeyframes 等上游字段名传入 diagram）：

```js
annotationData = {
  axis: { a: {id,x,z}, b: {id,x,z} } | null,        // diagram.axisPair → 人物现值
  crossing: boolean,                                  // 纯函数判定（App 算，喂层与横幅）
  gazes: [{ actorId, actorName, x, z, yaw, target: {x,z} | null }],
  cameraTrack: [{ frame, x, z }],                     // keyframes → 中性
  objectTracks: [{ id, name, points: [{frame, x, z}] }],
  ghosts: [{ shotId, shotName, x, z, yaw, focalLength }],  // 同场其余镜头
}
layers = diagram.layers（七开关 + 本任务不改 schema）
```

## 2. 纯函数（src/diagram/annotations/data.js + node --test）

- `axisSide(a, b, cam)` → '+1' | '-1' | '0'（叉积符号：ab×ac 的 z 分量）；`isCrossing(prev, cur)` → 侧别翻转判定
- `pickGhostShots(shots, activeShotId)` → 同场判定（对象 id 集合有交集即同场）→ ghost 列表（camera 中性化）
- `resolveAxisPair(axisPairIds, objects)` → {a,b} 或 null（人不在场→null 自动降级）
- `resolveGazes(gazeTargets, objects)` → 视线列表（目标缺→定长 1.2m 标记）
- `pathPoints(track)` → 按帧排序去重点位
- UI 数据：`personOptions(objects)` / `targetOptions(objects)`

## 3. AnnotationLayer（S3 挂 EditorScene，!cameraView 时渲染）

- **轴线**（layers.axis）：a–b 灰虚线（6/4 间隔，细盒拼接）+ 两端各延长 1m；crossing 时整体橙 `#f97316`。
- **视线**（layers.sight）：人物符号边缘发出蓝 `#3b82f6` 虚线（4/4）；有目标止于目标边缘，无目标定长 1.2m（方向=人物 yaw 前向）。
- **路径**（layers.paths）：黑 1.5px 折线（细盒拼接）+ 节点小圆（白字深底序号=关键帧序，DOM 或 sprite 二选一，实现定）+ 末端实心箭头；相机轨与对象轨各一条；无关键帧不画。
- **幽灵机位**（layers.ghosts）：重构 CameraGizmo 抽出展示件 `CameraSymbol`（符号+扇形+边线参数化颜色），当前镜=绿系（现有），ghost=40% 透明灰 + 镜头名小标签；不可点（NO_RAYCAST）、无标签牌交互。
- **越轴联动**：crossing=true 时当前 CameraGizmo 变橙（符号/锥/标签牌底色），由 App 传 `warned` 进 cameraGizmo 数据（T03 组件加一个可选色板参数，接缝行内加一字段）。
- **警告横幅**：App 层 DOM（`dg-axis-warning`，视口顶部，橙色条「机位越过轴线 · 建议回到 ▸ 侧」），crossing 驱动显隐——App 渲染，不进画布。

## 4. 图层面板与锁定（TopViewOverlay 扩展，全部我们的文件）

- 「图层」区：七开关（grid 现有网格开关合并入此，开关状态=diagram.layers，经 patchDiagram 写——**grid 双入口去重：保留原开关逻辑，面板里 grid 开关同步同一状态**）；
- 「轴线」区：两个人物下拉（personOptions），写 `diagram.axisPair`；
- 「视线」区：人物→目标下拉（含「清除」），写 `diagram.gazeTargets`（对象目标；地面点数据结构支持、点选 UI 本期不做——记为偏离）；
- 「锁定画布」开关：运行时态（不落盘）；on 时 App 传 `transformMode='select'` 生效值 + SymbolLayer/符号点选禁用（教师演示只读）。
- 面板放顶视 overlay 右侧竖排小面板（可折叠）；3D 编辑视图下图层状态同样生效（标注层挂 EditorScene 两视图通用），面板入口仅顶视（记为取舍）。

## 5. 接缝清单

1. App.jsx：annotationData useMemo（用 data.js 纯函数组装中性数据）+ crossing useMemo + MainViewport 行加 `annotations={annotationData}` + `cameraGizmo.warned` + 锁定生效 transformMode（一行三元）+ 顶部警告横幅 DOM + TopViewOverlay 新 props（面板回调：patchDiagram 写 axisPair/gazeTargets/layers）。
2. Viewport.jsx：EditorScene 挂 `<AnnotationLayer annotations={annotations} layers={diagram.layers} …>`（topView 与 3D 通用，!cameraView）；PATCHES 登记。
3. styles.css：追加 `dg-annotation-*` / `dg-axis-warning` / 面板样式（dg- 前缀）。

## 6. 测试与验收映射

- data.js 单测：axisSide 四象限/共线、isCrossing 翻转、pickGhostShots 同场/异场/交集边界、resolveGazes 目标缺失定长、pathPoints 排序去重。
- 浏览器验收：布置双人+轴线，机位经 3 个位置（叉积两侧+线上）拖动（用面板改机位位置滑杆替代 gizmo 拖动——自动化限制）核对警告出现/消失与手算侧别；设注视目标→视线止于目标、清除→定长；给人物打 2 帧位移关键帧→路径节点编号、删帧→路径同步；3 镜同场叠显幽灵+异场不显；图层逐项开关；导出帧核对（结构隔离同 T03 论证）。
- 非目标：越轴自动纠偏；地面点注视的点选 UI；3D 视图下的图层面板入口。
