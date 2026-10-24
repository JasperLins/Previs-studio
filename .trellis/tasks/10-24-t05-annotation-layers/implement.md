# T05 执行计划

> 阅读顺序：design.md → prd.md → diagram-symbols.md「标注层符号」节 → product-spec.md §2（轴线/视线/路径/幽灵行为定义）→ fork-discipline.md。

## 步骤

1. 规格先行：base-audit.md S3 行追加 AnnotationLayer 说明。
2. `src/diagram/annotations/data.js` + `data.test.js`：design §2 全契约（axisSide/isCrossing/pickGhostShots/resolveAxisPair/resolveGazes/pathPoints/personOptions/targetOptions）。
3. 重构 `src/diagram/gizmos/CameraGizmo.jsx`：抽 `CameraSymbol` 展示件（颜色/透明度参数化），CameraGizmo 复用并加 `warned` 橙色板；行为不回退（T03 验收项复测：标签/翻转/焦距联动）。
4. `src/diagram/annotations/AnnotationLayer.jsx`：轴线/视线/路径/幽灵（design §3；细盒拼虚线，禁 drei Line/Html）。
5. `TopViewOverlay.jsx` 扩展：图层面板（七开关+轴线人物双下拉+视线目标下拉+锁定画布）；锁定为运行时态回调。
6. 接缝（design §5）：App annotationData/crossing useMemo + 传参 + 警告横幅 + 锁定 transformMode 三元；EditorScene 挂载；styles.css 追加；PATCHES S3 登记。
7. 验证：`node --test "src/diagram/**/*.test.js"` 全绿（84+新增）；`npm run build`；红线 grep（keyframes/objectKeyframes/characterKeyframes 不得出现在 src/diagram 非 stateAdapter/测试桩——中性化边界检查）；`git diff --stat`（App 预算 ≤14 行，Viewport ≤4 行）。
8. 浏览器验收（主会话，design §6）。

## 验证命令

```bash
node --test "src/diagram/**/*.test.js"
npm run build
```

## 回滚点

新增文件独立回滚；CameraGizmo 重构如出问题 `git checkout HEAD -- src/diagram/gizmos/`（连同本任务新文件一起退，无耦合残留）；接缝同前例。

## 审查门

- AnnotationLayer 零写状态（纯渲染 + 既有 onSelect 透传）；useFrame 无 setState；
- 上游字段名红线（重点：keyframes/objectKeyframes 只许出现在 App 接缝行）；
- CameraGizmo 重构后 T03 验收四项行为等价（标签内容/翻转/焦距/开关）；
- 幽灵不可交互（raycast 全禁用）；
- 警告横幅不进画布（DOM 在视口容器层，导出隔离论证同 T03）。
