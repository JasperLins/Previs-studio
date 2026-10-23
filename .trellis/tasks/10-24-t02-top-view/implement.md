# T02 执行计划

> 阅读顺序：design.md → prd.md → fork-discipline.md → product-spec.md §1/§2 → base-audit.md（接缝表）。

## 步骤

1. **规格先行**：更新 base-audit.md 接缝表 S2/S3 描述（按 design §0）；PATCHES.md 的 S1/S2/S3 行由实现时一并登记（锚点、改动、日期）。
2. **`src/diagram/topView.js`**：五个纯函数（design §6）+ `topView.test.js`（含边界：空对象数组、NaN 位置、zoom≤0、data 缺 position/rotation）。
3. **`src/diagram/TopViewControls.jsx` / `TopViewGrid.jsx` / `TopViewOverlay.jsx`**：design §2/§4/§5。drei/fiber 组件不进单测。
4. **styles.css 末尾追加** `dg-` 前缀类（顶视底色、overlay 布局、方向标/比例尺样式）。只许追加。
5. **接缝**：App.jsx（S1 按钮 + topView 状态/保存恢复 + overlay 挂载 + planeLock/gridOn 传参 + Canvas props）与 Viewport.jsx（design §4 清单）。逐项对照，不越界。
6. **PATCHES.md 登记 S1/S2/S3**（改动描述+日期 2026-10-24，同步复核留空）。
7. **验证**：
   - `node --test "src/diagram/**/*.test.js"` 全绿（T01 的 30 例 + 新增）；
   - `npm run build` 通过；
   - 红线：`grep -rn "objectKeyframes\|characterKeyframes\|bodyType\|poseTime" src/diagram/ --include="*.js" --include="*.jsx" | grep -v test | grep -v stateAdapter.js` 为空（.jsx 组件同样受查，但 props 透传链中的通用词 position/rotation 不属上游专有）；
   - App.jsx/Viewport.jsx diff 逐行属于 design §4/§5 清单。
8. **浏览器验证**（主会话）：验收四项 + 进出顶视切镜保持 + 撤销。

## 验证命令

```bash
node --test "src/diagram/**/*.test.js"
npm run build
```

## 回滚点

- 步骤 5 前全部为新增文件，`git clean -fd src/diagram/ + checkout styles.css` 可净回滚；
- 接缝单独回滚：`git checkout HEAD -- src/App.jsx src/Viewport.jsx docs/PATCHES.md .trellis/spec/base-audit.md`。

## 审查门

- Viewport.jsx 的 diff 只许出现 design §4 的 4 处；App.jsx 只许 S1 按钮、状态声明、toggleTopView、Canvas props、overlay 挂载、导航提示分支；
- 顶视进入/退出代码路径不得触碰 objects/camera/shots 任何 setState（视图态纯度）；
- TopViewControls 上报 zoom 不得引发每帧 React 渲染（必须节流）。
