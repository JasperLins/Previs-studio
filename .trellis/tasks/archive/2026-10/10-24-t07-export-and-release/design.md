# T07 技术设计：机位图导出与课堂发布

## 1. 评估结论（prd 第 1 项，先行定案）

**不做顶视截图，实现只读导出渲染 `src/diagram/exportDiagram`**。理由：
1. 顶视图的标签（人物名/机位牌/幽灵名/路径序号）是 **DOM 叠加层**，不在 WebGL canvas 里——截图根本截不到标签；
2. 截图需隐藏整圈 UI 后裁剪，脆弱且分辨率受限；画布网格/符号线宽与 zoom 耦合，不保证打印可读；
3. 全部符号几何已是纯函数（T04 geometry / T03 frustum / T05 data），SVG 渲染是零新推导的纯组装，且矢量打印无限清晰。
结论记入任务档案「评估记录」节。

## 2. 模块结构

```
src/diagram/exportDiagram/
  svg.js       buildShotDiagramSvg(input) → SVG 字符串（纯函数，node --test 可测）
  svg.test.js  结构断言（白底/标题/符号要素/图例/比例尺/无 UI 元素类名）
  raster.js    svgToPngBlob(svg, scale)（浏览器：Image→canvas→Blob）
```

## 3. SVG 输入/版面（输入全部中性视图形状，App 接缝组装）

- 输入：`{ objects, camera, ghosts, axis, gazes, cameraTrack, objectTracks, layers, shotName, projectName, letter, warnState }`；
- 版面 A4 横向比例（1600×1131px 基准）：白底 `#ffffff`；顶部标题 `{工程名} · {镜头名} 机位图`；左上方向标 N（-Z 向上）；左下图例框（人物/机位/视锥/幽灵/轴线/视线/路径 七行小样）；左下比例尺（按场景包围盒自动选档，复用 pickScaleBar 思想按米/px 换算）；
- 世界→画布：取场景+机位+幽灵包围盒外扩 1.5m，等比缩放居中（画幅区域留出标题/图例边距）；**北朝上**（与顶视约定一致）。

## 4. 绘制复用（全部既有纯函数）

- 网格：1m 主线浅灰 + 0.5m 次线更浅（可关：layers.grid）；
- 家具足迹：footprintOf → 矩形/圆描边；门/窗/墙/椅按 diagram-symbols 画法（复用 geometry.js 的 doorHingeArc/isThinWall）；
- 人物：圆环+头点+朝向刻度+姿势变体（poseVariant）+名称标签（默认开）；
- 机位：机身矩形+楔形+视锥扇形（horizontalFovDeg/coneLengthMeters）+ 标签牌三行（Cam 字母/景别 promptResult.meta.shotSize/焦距）+ 越轴橙态；
- 幽灵：灰 40% 同款机位符号+镜头名；
- 轴线（虚线+延长）、视线（蓝虚线/目标/定长）、路径（折线+序号+箭头）；
- 图例/标题文字：系统无衬线，≥11px。

## 5. 接缝（最小）

- `TopViewOverlay` 动作区加「导出机位图」按钮 → 回调 `onExportDiagram`（新 prop）；
- App：handler 组装中性输入（复用 annotationData/promptResult/cameraGizmo 现成 memo）→ buildShotDiagramSvg → svgToPngBlob → 下载 `{工程名}_{镜头名}_机位图.png`；PATCHES S1 行登记。

## 6. 发布件

- `docs/课堂使用说明.md`（一页）：流程（建布景→复制镜头→顶视摆位→打关键帧→轴线检查→复制生成版提示词）+ 已知限制（无墙段类型、每镜一份布景、动作层手写）；
- 回归清单全项跑（fork-discipline）+ 逐项记录；
- `class-v1` annotated 标签 + PATCHES.md 版本标/同步记录首行。

## 7. 验收映射

- PNG 白底干净无 UI 元素、A4 可读 → 浏览器实测导出 + 视觉模型核对（白底/无工具栏类元素/标签清晰）；
- 使用说明试读 → 用户代验（记录）；
- 回归清单全过 + class-v1 就位 → 本任务执行记录逐项列出。
