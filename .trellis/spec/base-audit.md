# 基座代码审计（MONOFORM v0.6.0，2026-10-24 基于源码核查）

> 用途：开发前必读。所有结论来自实际源码（克隆 main @ f34cb80 审计），不是 README 转述。上游更新后若结构变化，先更新本文件。

## 技术栈

React 19 + Vite 8 + Three.js 0.170 + @react-three/fiber 9 + @react-three/drei 10 + lucide-react（图标）+ mediabunny（MP4 导出）。纯前端，工程存浏览器本地 / JSON 文件导出。启动：`npm install && npm run dev`；另有 Windows 一键启动脚本。

## 文件地图（src/ 共约 4300 行）

| 文件 | 行数 | 职责 | 我们动不动 |
|---|---|---|---|
| `src/App.jsx` | 2251 | 几乎全部状态与 UI：资源库、层级、属性面板、时间轴、镜头管理、保存/导出 | 只许接缝（见下） |
| `src/Viewport.jsx` | 1336 | R3F 画布：各类模型渲染（PrimitiveModel 按 type 分发）、人物骨骼渲染、CameraModel、变换控制器 | 只许接缝 |
| `src/ShotsPanel.jsx` | 45 | 镜头列表 UI | 基本不动 |
| `src/rig.js` | 192 | 人物骨骼/姿势预设 | 不动 |
| `src/styles.css` | 477 | 全局样式 | 可追加我们自己的类名，不改原有规则 |
| `src/main.jsx` | 10 | 入口 | 不动 |

## 状态模型（App.jsx，全部为可序列化 JSON）

- `objects[]`：场景对象数组。字段：`id, name, type, position[3], rotation[3]（欧拉）, scale[3], color`；人物额外有 `bodyType, pose, poseTime, joints`；装配体有 `parts`。
- 已有 type 全集：`person`、`box, sphere, cylinder, plane`、`arch, stairs, door, window, table, chair, sofa, roof, tree, vehicle`、`assembly`（parts 组合）、`model`（导入 GLB，带 url）、`depthMesh`。
- `camera`：`{ position[3], rotation[3], focalLength（默认 42）, aspectRatio（如 '16:9') }`。机位朝向由 rotation 决定，无 lookAt 锁定（有一次性「摄像机对准」）。
- `shots[]`：每镜一份完整快照 `{ objects, camera, lighting, reference, keyframes, objectKeyframes, … }`，上限 30 镜。切镜时当前状态写回对应 shot。
- 其他：`selectedId, transformMode（translate/rotate/scale）, snapEnabled, keyframes（机位）, characterKeyframes/objectKeyframes, lighting, reference（参考图）, editorView（编辑相机 position/target）, cameraView（是否机位视角）`。
- 历史栈：50 步撤销/重做（既有实现，2.5D 编辑必须走同一栈）。
- 持久化：自动保存到 localStorage；工程导出 `.monoform.json`；导入同格式（有 normalize/迁移逻辑，新增字段需走它）。

## 渲染要点（Viewport.jsx）

- `PrimitiveModel({type})` 按 type 分发到各模型函数（TableModel/SofaModel/DoorModel…），均为程序化几何拼装，尺寸由 scale 驱动——顶视符号替换可按同一 type 映射。
- 人物：`MixamoPersonModel`（X-Bot GLB + 骨骼 + IK），姿势由 pose 字段驱动。
- `CameraModel` 渲染机位实体模型；编辑视图相机由 `editorView` 状态 + OrbitControls 类机制控制（顶视预设改这里，接缝 S2）。
- 已有焦距预设 18/24/35/50/85/120mm；画幅预设 16:9、9:16、4:3、3:4 及自定义。

## 接缝候选（开发时逐条登记进 PATCHES.md）

| 编号 | 文件 | 接缝 | 用途 |
|---|---|---|---|
| S1 | App.jsx | 视口工具栏区域加「顶视」切换按钮 | 模式入口 |
| S2 | App.jsx/Viewport.jsx | editorView 增加正交顶视预设的读写 | 顶视相机 |
| S3 | Viewport.jsx | 画布内挂载我们的 Gizmo 层与符号替换层组件（传 objects/camera/selectedId 引用） | 标注与符号 |
| S4 | App.jsx | 右侧面板加页签「机位词」（P2） | 提示词面板 |
| S5 | App.jsx | 工程 normalize/保存逻辑透传 `diagram` 扩展字段 | 数据兼容 |

原则：接缝只做「挂载与传参」，任何业务逻辑写在 `src/diagram/` 内。

## 已知限制（设计时已绕开，勿重复发现）

1. 单机位多镜头：无「一镜多机位」数据结构 → 幽灵机位方案（见 product-spec）。
2. 无墙段类型：房间靠薄 box 拼 → 符号替换把薄高 box 视作墙（见 diagram-symbols）。
3. 每镜复制整场：布景修改不跨镜同步 → 课堂流程约束，非代码问题。
4. 无任何提示词/AI 功能 → 编译器全新模块，零冲突。
5. 仓库无 LICENSE、无 tags/releases、单 main 分支 → 同步按目标提交（见 fork-discipline）。
