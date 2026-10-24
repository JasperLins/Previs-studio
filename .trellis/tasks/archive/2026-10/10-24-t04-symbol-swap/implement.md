# T04 执行计划

> 阅读顺序：design.md → prd.md → diagram-symbols.md（全文，本任务就是实现它）→ product-spec.md §1.4 → fork-discipline.md。

## 步骤

1. 规格先行：base-audit.md S3 行追加 hideModel 传参与符号层点选说明。
2. `src/diagram/symbols/geometry.js` + `geometry.test.js`：design §3 全契约；pose 映射须覆盖 src/rig.js 的 RIG_PRESET_OPTIONS 全部 id（先 grep 列全集再写映射，未识别归 'other'）。
3. `src/diagram/symbols/SymbolLayer.jsx`：design §1/§2；LabelsHost 统一管名称标签（DOM 自管模式复用 T03 建立的做法：effect 建删 + useFrame 投影，**不逐帧 setState**）；符号 mesh 可点选（stopPropagation + onSelect）；选中态 #f3dba5。
4. styles.css 末尾追加 `dg-obj-label` 系。
5. 接缝（design §4）：App 一行 prop；Viewport SceneObject hideModel + EditorScene 挂载；PATCHES.md S3 登记。
6. 验证：`node --test "src/diagram/**/*.test.js"` 全绿（71+新增）；`npm run build`；红线 grep；`git diff --stat`（App.jsx ≤2 行、Viewport.jsx ≤6 行）。
7. 浏览器验收（主会话）：design §5 前四项 + 朝向常量校准。

## 验证命令

```bash
node --test "src/diagram/**/*.test.js"
npm run build
```

## 回滚点

新增文件独立回滚；接缝 `git checkout HEAD -- src/App.jsx src/Viewport.jsx src/styles.css docs/PATCHES.md .trellis/spec/base-audit.md`。

## 审查门

- SymbolLayer 零写操作（onSelect 是透传回调）；useFrame 无 setState、无常驻分配；
- 足迹真实比例类符号**不得**进 zoom 缩放组（只有固定图面尺寸类进）；
- pose 映射与 rig.js 预设 id 全集一致（测试枚举对照）；
- hideModel 判定只依 topView 与 type/scale，不读任何 UI 态。
