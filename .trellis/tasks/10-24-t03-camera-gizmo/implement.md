# T03 执行计划

> 阅读顺序：design.md → prd.md → diagram-symbols.md「机位」节 → product-spec.md §2 → fork-discipline.md。

## 步骤

1. `src/diagram/gizmos/frustum.js` + `frustum.test.js`（design §2 契约；AC#1 六档焦距对照表误差 <0.01°；边界：f≤0、空对象、机后点、零距离）。
2. `src/diagram/gizmos/CameraGizmo.jsx`（design §3：扇形+边线+机身符号+楔形+drei Html 标签+边缘翻转；顶视 px 精确/3D 距离等比两套 scale；只读）。
3. styles.css 末尾追加 `dg-cam-label` 类（深蓝圆角牌、三行布局、翻转变体、pointer-events:none）。
4. 接缝（design §4）：App.jsx MainViewport 一行 props + useMemo 计算 letter/subjectName；Viewport.jsx MainViewport 透传 + EditorScene 挂载一行；PATCHES.md S3 行更新。
5. 验证：
   - `node --test "src/diagram/**/*.test.js"` 全绿（含既有 51 例）；
   - `npm run build` 通过；
   - 红线 grep 同 T02（上游字段名只许出现在 stateAdapter 与测试桩）；
   - `git diff --stat`：App.jsx/Viewport.jsx 改动行数 ≤ 设计清单（MainViewport 两处 + EditorScene 签名/挂载）。

## 验证命令

```bash
node --test "src/diagram/**/*.test.js"
npm run build
```

## 回滚点

新增文件独立可回滚；接缝回滚 `git checkout HEAD -- src/App.jsx src/Viewport.jsx src/styles.css docs/PATCHES.md`。

## 审查门

- CameraGizmo 零写操作（无 onUpdate/setState 外泄；useFrame 只改自身 transform/DOM class）；
- 标签 DOM 挂在 canvas 容器内且 pointer-events:none（不得挡住画布点击）；
- drei Html 仅用于标签，不引入额外依赖；
- 焦距→角度只经 frustum.js 一个公式来源（禁止组件内另写 atan）。
