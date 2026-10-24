# T04 技术设计：顶视符号替换（人物/门/窗/墙）

> 研究基线：class @ ed0dda7。模型几何（Viewport.jsx）：门=门板 slab scale[0.78,0.86,0.07]（薄 Z 长 X，框柱 ±0.46X）；窗=1×1 框薄 Z(0.14) 带中梃；assembly parts=[{position, rotationDegrees, scale, shape}] 可纯算包围盒；box 尺寸=scale。人物面朝约定：Mixamo X-Bot 前向 +Z（设计以常量承载，浏览器验收「鼻向 2 例」实测定号，不符则翻常量）。

## 0. 规格先行

base-audit.md S3 行追加：顶视下 `SceneObject` 的 `hideModel` 传参（四类替换对象隐藏原模型）与符号层可点选（raycast→onSelect）；PATCHES.md 同步登记。diagram-symbols.md 不改（本任务就是实现它）。

## 1. 架构（沿用 T03 已验证的模式）

```
src/diagram/symbols/
  geometry.js        纯函数 + 常量（node --test）
  geometry.test.js
  SymbolLayer.jsx    R3F 层（S3 挂 EditorScene，仅 topView 时渲染）
```

- **SymbolLayer**：`{ objects, selectedId, labelsOn, onSelect }` → 每对象一个 `<group position=[x,0.03,z] rotation=[0,yaw,0]>`：
  - 四类替换型（person/door/window/thinWall）：画符号（下述），原模型由 `hideModel` 隐藏；
  - chair：足迹描边 + 靠背侧加粗线（本地 -Z 边，diagram-symbols）；
  - 其余对象：足迹描边（中性色细线），模型保留；
  - model/assembly/depthMesh：足迹框（assembly 由 parts 包围盒；GLB/depthMesh 用 1×1 代理 + 近似标注）+ 名称标签；
  - 点选：符号 mesh 带 `onPointerDown={e => { e.stopPropagation(); onSelect(id) }}`（被隐藏模型的选取由符号接管；TransformControls 仍挂原 group，gizmo 不受 visible=false 影响，拖拽路径不变）。
- **px→世界尺寸**：同 T03——每帧 `1/camera.zoom` 缩放各符号组（图面尺寸恒定 ±20% 容差）；足迹类（门/窗/墙/椅/框）用**真实比例**（米制，不随 zoom 缩放），只有「固定图面尺寸」类（人物圆环 34px 系）走 zoom 缩放。
- **hideModel 接缝**：App 传 `topViewActive`（已有 planeLock 同源）→ Viewport `SceneObject` 内 content 包一层 `visible={!hideModel}`（hideModel = topView && SWAP_TYPES 有 type）。一行 seam。
- **标签**：人物名默认开、其余默认关，`diagram.layers.labels` 总闸；DOM 自管（复用 T03 模式：effect 建删 + useFrame 投影定位，缩略为单个 LabelsHost 组件统一管理所有名称标签，避免每对象一份监听）。

## 2. 符号规格落点（diagram-symbols 定版 → 几何实现）

- **人物**：圆环外径 34px（ring line 2px，色=object.color）；头点实心 10px（#333）；朝向刻度 8px 短线（方向 = yaw 旋转后的前向，符号常量 `PERSON_FORWARD = [0, 0, 1]`）；小圆足迹直径≈0.6m 真实比例。姿势变体（`poseVariant(pose)` 纯函数映射 rig 预设）：sit 系→侧短弧；半蹲/全蹲→圆缩至 26px；walk/run 系→身后 14px 虚线尾迹；其余→标准圆 + 姿势名并入标签。
- **门**：门板线 = 足迹宽（真实比例，沿本地 X）；铰链 = 本地 -X 端；90° 开启弧（线 1px，半径=足迹宽，向本地 -Z 侧张开——常量 `DOOR_SWING_SIGN`，浏览器验收「门开向 2 例」实测定号）；框柱两点。
- **窗**：三线沿本地 X：两条外框线（足迹厚 = min(sx,sz) 的两端）+ 中线，真实比例。
- **墙（薄高 box 判定 `isThinWall(scale)`：min(sx,sz)≤0.35 且 sy≥1.8）**：双线（足迹厚的两端）+ 两端收口短线，真实比例；非薄高 box 不替换。
- **chair**：足迹矩形描边 + 本地 -Z 边加粗线（1.5×线宽）。
- 选中态：符号/描边色切主题强调色 `#f3dba5`（与上游选中材质一致）。

## 3. 纯函数契约（geometry.js）

- `SWAP_TYPES = new Set(['person','door','window'])`（wall 是 box 的子集判定非类型）
- `isThinWall(scale)` → 布尔（非法输入 false）
- `footprintOf(object)` → `{ w, d }`（box/sphere/cylinder…按 scale；person→{0.6,0.6}；door/window 按 0.92/0.16 与 1/0.14 基型乘 scale；assembly=parts 包围盒；model/depthMesh→null 用代理）
- `poseVariant(pose)` → 'stand'|'sit'|'crouch'|'walk'|'other'（rig 预设 id 全集映射，未识别→'other'）
- `doorHingeArc(w, d)` → 铰链点/弧参数（按 §2 常量）
- 朝向常量：`PERSON_FORWARD`、`DOOR_SWING_SIGN`（±1，验收校准）

## 4. 接缝清单（全部 S3 范围内）

1. App.jsx：MainViewport 调用行加 `symbolLayer={{ labels: diagram.layers.labels }}`（其余 objects/selectedId/onSelect 已有）；不改其它。
2. Viewport.jsx：`SceneObject` 签名 +`hideModel=false`，content 包 `visible`；`EditorScene` 挂 `<SymbolLayer>`（topView && 符号层开——图层开关挂 `labels`？不——符号替换本体无开关（isTopView 即启用，product-spec §2.25），仅标签受 layers.labels）；PATCHES 登记。
3. styles.css：追加 `dg-obj-label` 类（对象名标签，小于机位牌，无底色或浅底）。

## 5. 验收映射

- 10 对象位置/朝向核对：浏览器顶视截图 vs 3D 截图成对比较（人物鼻向/门开向/椅背各 ≥2 例；PERSON_FORWARD/DOOR_SWING_SIGN 校准闭环）；
- 姿势变体：pose 下拉切 自然坐姿/全蹲/行走 → 符号变体切换（DOM/截图验证）；
- 进出顶视无闪烁/无丢失：切换 + 数据不变断言（objects 数量与 id 不变）；
- 性能：样例场景 10 对象，无逐帧 React 渲染（useFrame 只改 transform/组级 scale）；
- Shot Designer 对照评审：留用户实机（记录进任务档案）。
- 非目标：机位符号（T03 已做）；幽灵/轴线/视线（T05）；门/窗真实开合状态（模型本身无此状态，符号用约定弧）。
