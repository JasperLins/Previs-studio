# T01 执行计划

> 前置阅读顺序：design.md → prd.md → .trellis/spec/fork-discipline.md（纪律）→ product-spec.md §3（数据契约）。

## 步骤

1. **`src/diagram/diagramData.js`**：`DEFAULT_DIAGRAM` + `normalizeDiagram(raw)`（合并语义见 design §3；深拷贝默认值）。
2. **`src/diagram/diagramData.test.js`**：design §5 的 diagramData 用例。
3. **`src/diagram/stateAdapter.js`**：纯映射 `objectToView/cameraToView/shotToView` + `createStateAdapter(deps)`（design §4）。
4. **`src/diagram/stateAdapter.test.js`**：design §5 的 adapter 用例。
5. **跑测试**：`node --test "src/diagram/**/*.test.js"` 全绿（Node 22 裸目录不匹配，须用 glob 形式）。
6. **接缝 S5**（App.jsx 六触点，见 design §1；只挂载传参，逻辑全在 diagramData）+ 顶部 import。
7. **PATCHES.md 登记 S5**：文件、锚点函数名、改动描述、目的、日期 2026-10-24、同步复核留空。
8. **回归**：`npm run build` 通过；`node --test "src/diagram/**/*.test.js"` 全绿。
9. **浏览器验证**（人工/自动化各一遍）：打开无 diagram 老工程不报错且 `monoform-project` 自动保存出现 diagram 默认值；改一次场景（触发保存）后刷新，diagram 字段仍在；撤销/重做可用。

## 验证命令

```bash
node --test "src/diagram/**/*.test.js"
npm run build
```

## 回滚点

- 步骤 6 前的一切均为新增文件（`git checkout -- src/ .trellis/ docs/ && git clean -fd src/diagram/` 可净回滚）；
- 接缝完成后如出问题：`git checkout HEAD -- src/App.jsx docs/PATCHES.md` 单独回接缝，diagram 新文件保留不影响上游运行。

## 审查门

- 红线检查：`grep -rn "objectKeyframes\|characterKeyframes\|bodyType\|poseTime\|joints" src/diagram/ --include="*.js" | grep -v test | grep -v stateAdapter.js` 必须为空（上游字段名只许出现在 stateAdapter 与测试桩里）。
- App.jsx diff 只许出现 design §1 列出的触点行。
