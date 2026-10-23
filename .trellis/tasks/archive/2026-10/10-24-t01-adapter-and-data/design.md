# T01 技术设计：stateAdapter 与 diagram 数据

> 研究基线：class @ 65e1328，App.jsx 2251 行（行号为写作时参考，锚点以函数名为准）。

## 1. 边界与不变量

- **唯一耦合点**：`src/diagram/stateAdapter.js` 是 diagram 层唯一知道上游字段名的模块。验收红线：`src/diagram/` 其余文件出现 `objectKeyframes`、`characterKeyframes`、`bodyType` 等上游字段名即违规（`type/name/color/position/rotation/scale/pose` 这些本就是 product-spec 语义的字段，经 stateAdapter 输出后使用不算违规）。
- **接缝 S5（PATCHES.md 登记）**：App.jsx 仅 6 个触点，全部只做「挂载与传参」：
  1. `normalizeProjectData` 返回对象加 `diagram: normalizeDiagram(data?.diagram)`
  2. `projectData` 参数加 `diagram`，返回对象带 `diagram: normalizeDiagram(diagram)`
  3. `currentProject` useMemo 传入 `diagram`
  4. `saveProject` 的 `projectData(...)` 调用传入 `diagram`
  5. `applyProjectSnapshot` 加 `setDiagram(normalized.diagram)`
  6. 状态声明 `const [diagram, setDiagram] = useState(() => normalizeDiagram(startupProject?.diagram))`
  - 顶部 import：`import { normalizeDiagram } from './diagram/diagramData.js'`
  - 依赖注入反转：App.jsx 不 import stateAdapter（T02 起视口层才接）；本任务 App.jsx 只认 diagramData。
- **历史栈/自动保存零改动**：diagram 进入 `currentProject` 后，既有 50 步快照栈与 900ms 自动保存自动覆盖 diagram；`applyProjectSnapshot` 恢复时同步 `setDiagram`。

## 2. 模块结构

```
src/diagram/
  diagramData.js        DEFAULT_DIAGRAM / normalizeDiagram(raw)
  diagramData.test.js
  stateAdapter.js       createStateAdapter(deps) + 纯映射函数
  stateAdapter.test.js
```

- 纯 JS ESM，无 React/three import → 可被 App.jsx/Vite 引用，也可被 `node --test` 直接跑（package.json 已有 `"type": "module"`）。

## 3. diagram 数据契约（product-spec §3 定版）

```js
DEFAULT_DIAGRAM = {
  axisPair: null,                    // null | [actorIdA, actorIdB]
  gazeTargets: {},                   // { actorId: {objectId} | {point:[x,z]} }
  layers: { grid:true, labels:true, frustum:true, axis:true, sight:true, paths:true, ghosts:true },
  shotMeta: {},                      // { shotId: {camLetter, shotSizeOverride, subjectId} }
  promptDrafts: {},                  // { shotId: {actionLine} }
}
```

`normalizeDiagram(raw)` 合并语义：
- 非对象输入 → 返回深拷贝默认值（不返回共享引用）；
- 逐顶层键浅合并，`layers` 逐键合并；
- 垃圾值回退默认：`axisPair` 非「null 或二元字符串数组」→ null；`gazeTargets` 值既无 `objectId`（字符串）也无 `point`（二元有限数）→ 丢弃该键；`shotMeta.*` 各字段类型不符 → 丢弃该字段；`promptDrafts.*.actionLine` 非字符串 → 空串；`camLetter` 允许空串（表自动）；
- 不认识顶层键 → 忽略（禁止再往工程加字段，spec 第 3 节封闭集合）。

## 4. stateAdapter 契约

```js
createStateAdapter({
  getSnapshot,          // () => ({ objects, camera, shots, activeShotId, selectedId, diagram })
  updateObject,         // (id, patch) => void   —— App.jsx 的 updateObjectById
  updateDiagram,        // (updater) => void     —— setDiagram(prev => ...)
})
```

纯映射（导出以便单测与 T03+ 复用）：
- `objectToView(o)` → `{ id, type, name, color, x, z, y(高度,只读), yaw(rotation[1] 水平角), scale:[sx,sy,sz], pose: o.type==='person' ? o.pose : null, locked? }`
- `cameraToView(c)` → `{ x, z, y, yaw(c.rotation[1]), focalLength, aspectRatio }`
- `shotToView(s)` → `{ id, name, objects: s.objects.map(objectToView), camera: cameraToView(s.camera) }`

适配器实例方法（全部经 deps，不自持状态）：
- `getScene()` → `{ objects: [...objectToView], camera: cameraToView(...), selectedId }`
- `getActiveShot()` → shotToView(当前 activeShotId 的 shot)
- `getGhostShots()` → 除 active 外全部 shotToView（数据从 shots 现算，不落盘；本任务只给数据，渲染是 T05）
- `setObjectPlane(id, { x?, z?, yaw? })` → 读现值，仅改 X/Z/yaw，Y 高度与其余两轴 rotation 原样保留，调 `updateObject(id, { position, rotation })`（数值非法则忽略该字段）
- `patchDiagram(patch)` → `updateDiagram(prev => mergeDiagramPatch(prev, patch))`（浅合并，layers 键级合并——复用 normalizeDiagram 的合并内核）

## 5. 测试策略

`node --test "src/diagram/**/*.test.js"`（node 22 内置 runner，零新依赖；不改上游 package.json，命令记入 PATCHES 台账与 fork-discipline 回归清单；Node 22 裸目录形式不匹配，须用 glob 形式）：
- diagramData：默认值深拷贝（改返回值不影响 DEFAULT）、老工程 undefined/部分字段补齐、非法值逐类回退、未知顶层键忽略；
- stateAdapter：person/box/camera 映射正确、setObjectPlane 保 Y 保 roll/pitch、非法数值忽略、patchDiagram 不改其它键、getGhostShots 排除当前镜。

## 6. 兼容性与风险

- 原版 MONOFORM 打开带 diagram 工程：原版 `normalizeProjectData` 的 `...data` 展开原样携带 diagram、无消费者，不报错（结构上保证；人工验证项留观）。
- 老工程（无 diagram）：normalize 补默认 → 打开即有；首次保存后字段落盘。
- 风险：`projectData` 每次 memo 调 `normalizeDiagram`（浅合并 + 数个键检查，微秒级，可忽略）。
- 明确非目标：不加 npm test 脚本（不动上游 package.json）；不做任何 UI（T02 起）；ghost 只出数据不出渲染。
