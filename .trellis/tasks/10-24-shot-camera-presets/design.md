# 技术设计 — 选中物体新建镜头时机位预设

## 总体方案

新增纯函数模块 `src/shotPresets.js`（预设定义 + 机位计算，无 React 依赖，`node --test` 单测）与面板组件 `src/ShotPresetDialog.jsx`（自管 `dg-` 样式）；`App.jsx` 仅按接缝 S9 做挂载与传参（fork 纪律：功能代码不上游文件、样式只追加 `dg-` 前缀、接缝先登记 base-audit.md + PATCHES.md 再动手）。

不引入新依赖，不改数据模型（`shot.camera` 形态不变），不改 `Viewport.jsx` / `ShotsPanel.jsx` / `rig.js`。

## 规格与台账（fork 纪律前置）

- `base-audit.md` 接缝表已登记 **S9**（App.jsx：状态区 `shotPresetTargetId`、`handleAddShotClick` 入口、`addShot(presetId)`、`<ShotPresetDialog>` 挂载）。
- `docs/PATCHES.md` 在实现时同步登记 S9 行（锚点/改动/目的/日期）。
- 新文件落位沿 S7 先例（通用 UI 功能）：纯函数 + 单测 `src/shotPresets.js` / `src/shotPresets.test.js`，组件 `src/ShotPresetDialog.jsx`。
- styles.css 只在文件末尾追加 `dg-shot-preset-*` 类；遮罩、卡片、网格全部自管，不复用上游 `settings-overlay` 等类（零上游耦合）。

## 模块设计

### `src/shotPresets.js`（新文件，纯函数）

```js
// 预设定义：方位角/俯仰/距离/焦距/roll 都是"相对物体"的参数
export const SHOT_CAMERA_PRESETS = [
  { id: 'current',        label: '当前视角',   hint: '沿用当前摄像机' },
  { id: 'front_close',    label: '正面特写',   azimuth: 0,    pitch: 0.08, framing: 0.62, focal: 50, eye: 0.72 },
  { id: 'front_medium',   label: '正面中景',   azimuth: 0,    pitch: 0.10, framing: 1.15, focal: 42, eye: 0.62 },
  { id: 'front_full',     label: '正面全景',   azimuth: 0,    pitch: 0.16, framing: 2.20, focal: 35, eye: 0.55 },
  { id: 'side_track',     label: '侧面跟拍',   azimuth: Math.PI / 2,  pitch: 0.06, framing: 1.10, focal: 42, eye: 0.62 },
  { id: 'side_close',     label: '侧面近景',   azimuth: Math.PI / 2,  pitch: 0.08, framing: 0.68, focal: 50, eye: 0.72 },
  { id: 'back_medium',    label: '背面中景',   azimuth: Math.PI,      pitch: 0.10, framing: 1.15, focal: 42, eye: 0.62 },
  { id: 'high_45',        label: '45°俯拍',    azimuth: Math.PI / 4,  pitch: 0.785, framing: 1.35, focal: 42, eye: null },  // eye=null → 高度由 pitch 推导
  { id: 'top_down',       label: '俯拍全景',   azimuth: Math.PI / 4,  pitch: 1.35,  framing: 1.60, focal: 35, eye: null },
  { id: 'birdseye',       label: '鸟瞰',       azimuth: 0,            pitch: 1.52,  framing: 1.45, focal: 28, eye: null },
  { id: 'low_angle',      label: '低角度仰拍', azimuth: Math.PI * 0.08, pitch: -0.30, framing: 1.05, focal: 32, eye: 0.18 },
  { id: 'low_wide',       label: '低角度广角', azimuth: Math.PI * 0.16, pitch: -0.42, framing: 1.35, focal: 20, eye: 0.10 },
  { id: 'dutch',          label: '荷兰角',     azimuth: Math.PI * 0.12, pitch: 0.06, framing: 1.10, focal: 40, eye: 0.62, roll: 0.22 },
  { id: 'over_shoulder',  label: '过肩镜头',   azimuth: Math.PI * 0.82, pitch: 0.02, framing: 1.45, focal: 42, eye: 0.92, shoulder: -0.45 },
  { id: 'over_shoulder_right', label: '过肩镜头（右）', azimuth: Math.PI * 0.18, pitch: 0.02, framing: 1.45, focal: 42, eye: 0.92, shoulder: 0.45 },
]
```

参数语义（全部相对物体；`azimuth` 是绕物体朝向的偏角，0 = 正前方；`framing` 是取景留白系数，越小越近）：

- `pitch`：俯拍类预设的视线俯仰（+ 俯），相机放在沿视线斜距 `distance` 处：水平距 = `distance×cos(pitch)`、高度 = 中心高 + `distance×sin(pitch)`，此时忽略 `eye`。
- `eye`：非俯拍类预设的相机高度系数（× 物体身高 H）；高度定了之后由位置与目标点用统一朝向函数反推 rotation，pitch 字段此时只作文档语义。
- `roll`：绕视线滚转（荷兰角），写入 `rotation[2]`。
- `shoulder`：过肩横向偏移系数（× 物体宽），相机平移出肩部、目标点沿物体前向偏移（越过肩看向前方）。

核心导出：

```js
export function objectFramingBounds(object)   // → { center:[x,y,z], height, width, depth, yaw }
export function presetCameraForObject(presetId, object, currentCamera)
// → { position, rotation, focalLength } 或 null（current / 未知预设 → null，表示沿用 currentCamera）
```

### 机位计算（纯函数）

1. `objectFramingBounds(object)`：
   - `person`：`height = 1.8 × bodyHeightFactor × scale[1]`（bodyHeightFactor 与 Viewport proportions.height 同表：tall 1.14 / broad 1.03 / female 0.98 / male 1.06 / 其余 1）；`width = 0.55 × scale[0]`；center = position + rotate([rigRoot.x×scaleX, rigRoot.y×scaleY + height/2, rigRoot.z×scaleZ])（身高中点，绕 rotation 旋转，与 `visualCenterForObject` 同一变换套路）。
   - 其他（几何体全家桶：box/sphere/table…，scale 即包围尺寸）：`height = scale[1]`、`width = scale[0]`、`depth = scale[2]`，center = position + rotate([0, height/2, 0])（position 为几何中心——初始平台 y=0.45×scaleY 0.9 恰落地可证）。
   - `yaw = object.rotation?.[1] || 0`；"前方" = yaw 旋转后的 +Z。
   - `visualCenterForObject` 属于 App.jsx（未导出）。为避免搬动既有函数，`shotPresets.js` 自带同语义实现（身高中点），App 侧不重复传参；测试锁定数值。
2. 视场角：`fovV = 2 × atan(12 / focalLength)`（全画幅 24mm 高对应 three.js 垂直 fov 口径，与项目 18–120mm 滑杆兼容）。
3. 距离：`distance = (height / 2) / tan(fovV / 2) × framing`，再用水平视场与 `width` 复核一遍取较大值（16:9 基准，避免宽物体出画）。**distance 一律是沿视线的斜距**（保证取景构图正确）。
4. 位置：
   - 前向 `fwd = [sin(yaw), 0, cos(yaw)]`，右向 `right = [cos(yaw), 0, -sin(yaw)]`。
   - 水平方位 = `yaw + azimuth` 的反方向。高度分解（2026-10-24 检查阶段修正：俯拍类旧公式按水平距 × tan(pitch) 抬高，导致斜距随 pitch 放大、物体缩成小点）：
     - `eye != null`（平视/仰角类）：水平距 = `distance`（Δy 小，斜距≈水平距，误差可忽略），`cameraY = center.y + (eye − 0.5) × H`；
     - `eye == null`（俯拍类）：水平距 = `distance × cos(pitch)`，`cameraY = center.y + distance × sin(pitch)`；
     - `cameraY = max(cameraY, 0.05)`（不钻地）。
   - `shoulder`：位置沿 `right` 平移 `shoulder × width`，目标点沿前向偏移 `0.8 × height`（看向前方）。
   - 目标点默认 `center`。
5. `rotation = cameraRotationBetween(position, target)`（App `cameraRotationToward` 同语义的本模块实现，输入已保证合法故无需 fallback，不动 App 原函数）；`roll` 写入 `rotation[2]`。
6. `focalLength` clamp 18–120（与 `normalizeCamera` 一致）；`aspectRatio` 不在返回值中，App 侧保持当前镜头值。

### 测试 `src/shotPresets.test.js`

node:test 直跑（项目惯例，见 `diagramData.test.js` 头注释）：

- 每个预设对标准人物（position [0,0,0]、scale 1）返回合法 camera：位置有限、与目标点距离 > 0、rotation 与「相机→目标」方向一致（用朝向函数反验）。
- 「正面」系：yaw=0 → 相机 z > 0（+Z 前方）；yaw=π/2 → 相机 x > 0（跟随朝向）。
- 俯拍类：cameraY > center.y；低角度类：cameraY < center.y；俯拍类（high_45/top_down/birdseye）相机到目标点斜距 ≈ 按 framing 算的取景距离（±15%，锁定构图不随 pitch 缩水）。
- 景别排序：`front_close` 距离 < `front_medium` < `front_full`。
- 荷兰角 `rotation[2] ≈ roll`；`current` → null；未知 id → null。
- 几何体（box）：center = position + [0, h/2, 0]；距离满足全高入画（≥ H/(2 tan(fov/2))×0.9）。
- scale×2 的人物：机位距离约等比放大（×2 误差 ±10%）。

## App.jsx 集成（接缝 S9，仅挂载与传参）

1. import：`import { SHOT_CAMERA_PRESETS, presetCameraForObject } from './shotPresets'`、`import ShotPresetDialog from './ShotPresetDialog'`。
2. 状态区：`const [shotPresetTargetId, setShotPresetTargetId] = useState(null)`。
3. 入口：LeftSidebar 的 `onAddShot` 改指 `handleAddShotClick`：
   ```js
   const handleAddShotClick = () => {
     const target = objects.find(o => o.id === selectedId)
     if (target) setShotPresetTargetId(target.id)   // 弹面板
     else addShot()                                  // 现状：未选中 → 直接新建
   }
   ```
   `selectedId === CAMERA_ID` 时 `objects.find` 为 undefined → 走旧路径。
4. `addShot(presetId)` 扩展（限额/缩略图/命名逻辑不动）：
   ```js
   const addShot = (presetId = null) => {
     // …原有校验与持久化…
     const target = objects.find(o => o.id === shotPresetTargetId)
     const override = presetId && target ? presetCameraForObject(presetId, target, camera) : null
     const nextCamera = override ? { ...cloneProjectValue(camera), ...override } : cloneProjectValue(camera)
     // nextShot.camera = nextCamera；toast：`已新建“{name}” · {override ? '机位 ' + preset.label : '场景已复制…'}`
   }
   ```
5. 渲染区（SettingsDialog 挂载行附近）：`shotPresetTargetId && <ShotPresetDialog object={target} onPick={…} onCancel={…} />`；`onPick = id => { setShotPresetTargetId(null); addShot(id) }`。
6. `ShotsPanel.jsx` / `LeftSidebar` 传参结构不变（仍只调 `onAdd`）。

### `src/ShotPresetDialog.jsx`（新组件）

- Props：`{ object, presets, onPick, onCancel }`（presets 由 App 传 `SHOT_CAMERA_PRESETS`，组件零业务）。
- 结构：`dg-shot-preset-overlay`（遮罩，点击 onCancel）> `dg-shot-preset-dialog`（role=dialog）> 头部（`添加机位` + 「镜头将对准：{object.name}」 + 关闭钮）+ 两列网格 `dg-shot-preset-grid`（按钮 = label 主文字 + hint 次文字）。
- 键盘：Esc → onCancel（useEffect 挂 keydown）；无默认提交语义（非 form）。
- 受控组件、无本地状态。

### styles.css（末尾追加 `dg-shot-preset-*`）

- `dg-shot-preset-overlay`：全屏遮罩，z-index 高于工具栏（≥ 40），居中布局。
- `dg-shot-preset-dialog`：深色卡片（对齐设计稿图 1 与上游 `#26` 系卡片色调），固定宽 ~300px。
- `dg-shot-preset-grid`：两列 grid；`.dg-shot-preset-option` 按钮 hover/active 高亮（accent 边框）。

## 边界与兼容

- 30 镜上限、`uniqueShotName`、缩略图持久化、50 步历史栈全部不动；预设仅影响新镜头的 `camera` 字段（纯值替换，无新持久化字段）。
- `normalizeCamera` 对预设产物（有限数组 + 合法 focal）天然通过；老工程零迁移。
- `applyShotState` 切镜后 `setSelectedId(shot.objects[0]?.id || CAMERA_ID)` 与现状一致，不影响面板（面板只在点击瞬间查一次 selectedId）。
- 隐藏/锁定物体照常可作为拍摄对象（锁定只限制编辑，不限制取景）。
- 自动保存/IndexedDB 双写（S8）不感知本特性：camera 属既有快照字段。

## 回滚

- 新文件三件（shotPresets.js / .test.js / ShotPresetDialog.jsx）+ App.jsx S9 接缝 + styles.css 末尾追加段 + base-audit/PATCHES 台账行；`git revert` 单提交即完全回滚，无数据迁移。

## 风险

- 几何体 position 语义（中心 vs 底部）：按现有初始数据（平台 y=0.45 × scaleY 0.9 恰落地）判定为"中心"；若发现底部语义的旧数据，只需改 `objectFramingBounds` 的 center 公式，影响面收敛在该函数。
- 人物朝向 +Z 的假设来自 Viewport 背部标记（z=−0.215）；以"人物默认 rotation 0 时正面机位在 +Z 侧"为准，测试锁定。
- `assembly` / `model` / `depthMesh` 等类型的包围尺寸未必由 scale 直接表达（model 以 GLB 实际尺寸渲染）——首版按 scale 估算并接受近似；标注在 prd Non-Goals 之外的风险项，后续可在 `objectFramingBounds` 按 type 精化。
