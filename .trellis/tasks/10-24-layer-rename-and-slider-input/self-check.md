# Self-check 记录（2026-10-24）

## 验证命令

- `npm run build` — 通过（chunk-size 警告为上游既有，与本次无关）
- `node --test src/sliderNumber.test.js` — 11/11 通过
- `node --test "src/diagram/**/*.test.js"` — 136/136 通过（回归，未触碰 diagram）

## 接缝合规

- src/App.jsx 全部改动落在 S6/S7（import 1 行、AxisSlider/焦距/动作相位 output 替换、SceneList 行内重命名、LeftSidebar/Inspector 传参、renameObject/syncObjectNameToShots、渲染行 2 处 prop）。
- src/styles.css 仅末尾追加 5 条 `dg-` 前缀规则，无既有规则修改。
- 新文件：src/SliderNumberInput.jsx、src/sliderNumber.js（纯函数）、src/sliderNumber.test.js。
- docs/PATCHES.md 与 .trellis/spec/base-audit.md 已登记 S6/S7。

## 检查中发现并修复的缺陷

1. SliderNumberInput 无改动 focus+blur 会把离网格值静默吸附（如旋转 37.4° 显示 37，点进点出被改写为 37°；等比缩放的连续比例值同理）→ 加 dirtyRef：仅在用户实际改动文本后提交。
2. 无改动 blur 触发空改名（产生一条无操作撤销记录）→ SceneList/Inspector 两处加"值未变化不提交"守卫。

## 遗留说明

- 浏览器交互项（双击重命名、滑块键入的手感）按 fork-discipline 回归注记属人工验证路径，代码路径已经静态审查覆盖；建议课堂使用前 `npm run dev`（新标签页）快速过一遍。
- Inspector 名称框输入首尾空格的未修剪值会留在当前镜（上游 onChange 行为），跨镜为修剪值——外观级边角，不修。
