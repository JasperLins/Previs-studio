# Journal - JasperLins (Part 1)

> AI development session journal
> Started: 2026-10-24

---



## Session 1: T00 仓库初始化与 Trellis/ZCode 接入

**Date**: 2026-10-24
**Task**: T00 仓库初始化与 Trellis/ZCode 接入
**Branch**: `class`

### Summary

按 T00 与 fork-discipline 完成仓库初始化：origin(JasperLins/Previs-studio)+upstream 双远程、upstream-mirror/class 分支、基线标签 class-v0-base@f34cb80；文档落位（docs/00-overview.md、docs/PATCHES.md 填基线）；T01–T07 录入 Trellis 为 planning 任务；npm build/dev 与浏览器核心流程（加对象+镜头关键帧）零报错验证；已推送 class 与标签到 origin。

### Git Commits

| Hash | Message |
|------|---------|
| `6911f2d` | (see git log) |
| `6f41a73` | (see git log) |
| `776694f` | (see git log) |
| `65e1328` | (see git log) |

### Status

[OK] **Completed**


## Session 2: T01 适配层与 diagram 数据

**Date**: 2026-10-24
**Task**: T01 适配层与 diagram 数据
**Branch**: `class`

### Summary

建立 src/diagram 唯一耦合点：stateAdapter（对象/机位/镜头视图 + setObjectPlane 地面写回）与 diagramData（product-spec §3 契约 normalize）；接缝 S5 六触点使 diagram 进入既有撤销栈与自动保存；30 单测（node --test glob 形式，零新依赖）全绿，build 通过，浏览器实测老工程补齐/撤销/刷新存活零报错；PATCHES.md 登记 S5。

### Git Commits

| Hash | Message |
|------|---------|
| `cd0196f` | (see git log) |
| `232b4b8` | (see git log) |
| `40bc601` | (see git log) |

### Status

[OK] **Completed**


## Session 3: T02 顶视正交编辑视图与地面约束编辑

**Date**: 2026-10-24
**Task**: T02 顶视正交编辑视图与地面约束编辑
**Branch**: `class`

### Summary

顶视正交编辑视图落地：topView.js 纯函数（19 测）+ TopViewControls/Grid/Overlay 组件；接缝 S1/S2/S3 登记 PATCHES；check 修复 4 项（含 3D 视图 Y 轴被误夹紧的严重回归）；51/51 测试、build 过；浏览器验收：进出数据不变、切镜保持、+1m 保 Y=0、三步撤销精确回位、比例尺 2m=139px 吻合；gizmo 拖拽自动化不可达经 A/B 判别为输入限制，用户实机确认通过。

### Git Commits

| Hash | Message |
|------|---------|
| `06aa9ed` | (see git log) |
| `e9a8f89` | (see git log) |

### Status

[OK] **Completed**


## Session 4: T03 机位视锥 Gizmo 与标签牌

**Date**: 2026-10-24
**Task**: T03 机位视锥 Gizmo 与标签牌
**Branch**: `class`

### Summary

frustum.js 纯函数（20 测：六档焦距双校验/入画/锥长/字母）+ CameraGizmo（扇形+机身符号+标签牌）；主会话实测修复：drei Html 在 R3F v9 多 Canvas 不产出 DOM→自管 DOM 标签、边线改盒体；浏览器验收四项全过（焦距联动/改名与切镜归属/导出结构隔离/frustum 开关同隐）；坑沉淀 spec（Html 桥接、软重载旧模块缓存、HMR 偶发失灵）。

### Git Commits

| Hash | Message |
|------|---------|
| `2fca5e6` | (see git log) |
| `14eac65` | (see git log) |

### Status

[OK] **Completed**


## Session 5: T04 顶视符号替换

**Date**: 2026-10-24
**Task**: T04 顶视符号替换
**Branch**: `class`

### Summary

symbols/geometry.js（足迹/薄墙/姿势映射/铰链弧，13 测）+ SymbolLayer（四类替换+椅背线+足迹描边+代理框+可点选+LabelsHost）；浏览器实测三朝向常量全部定号（人物刻度=3D 面向、门弧北张西铰、椅背同侧）、姿势三变体切换、进出数据完整；Shot Designer 对照经用户实机过目后指示继续（通过）。

### Git Commits

| Hash | Message |
|------|---------|
| `7bfb7d1` | (see git log) |
| `0f4fcc1` | (see git log) |

### Status

[OK] **Completed**


## Session 6: T05 标注层补全

**Date**: 2026-10-24
**Task**: T05 标注层补全
**Branch**: `class`

### Summary

annotations/data.js（侧别/越线/幽灵/解析/路径，21 测）+ AnnotationLayer（轴线/视线/路径节点/幽灵复用重构的 CameraSymbol）+ 图层面板（七开关/轴线人物/视线目标/锁定画布）+ CameraGizmo warned 橙板；子代理 quota 中断后主会话补齐接缝并修面板 pointer-events；越轴三点实测精确、幽灵/图层开关双向过；路径拖帧留人工。105/105、build 过。

### Git Commits

| Hash | Message |
|------|---------|
| `b2e735b` | (see git log) |
| `0c6df50` | (see git log) |

### Status

[OK] **Completed**


## Session 7: T06 提示词编译器与机位词面板

**Date**: 2026-10-24
**Task**: T06 提示词编译器与机位词面板
**Branch**: `class`

### Summary

promptCompiler 四模块（映射档位/纯投影含 36×24 画幅裁切与高对象任一部入画语义/地标防编造/五层管线+轴线侧别+上镜差异）+ 18 例单测（§4 十用例全过）；接缝 S4 右侧页签 + PromptPanel（动作层持久化/复制/导出 TXT/描述卡）；标签牌景别与编译器同源实测一致。全程主会话内联（quota），浏览器验收过。

### Git Commits

| Hash | Message |
|------|---------|
| `97fb645` | (see git log) |
| `b945a49` | (see git log) |

### Status

[OK] **Completed**


## Session 8: T06b 运动层与生成版输出

**Date**: 2026-10-24
**Task**: T06b 运动层与生成版输出
**Branch**: `class`

### Summary

运动层（机位六型推导+节奏词+人物走位/姿势切换+时长，阈值 0.3m/8°/5mm）、站位语句化、生成版复制；用户委托 8 场景测试打分 9.5/10，抓出并修复跟拍误判（推拉配对主体轨首末位置）；spec §6 先行；127/127 测试。

### Git Commits

| Hash | Message |
|------|---------|
| `8b8a839` | (see git log) |
| `13bc534` | (see git log) |
| `33e9247` | (see git log) |

### Status

[OK] **Completed**


## Session 9: T07 机位图导出与课堂发布（class-v1）

**Date**: 2026-10-24
**Task**: T07 机位图导出与课堂发布（class-v1）
**Branch**: `class`

### Summary

exportDiagram SVG 纯函数渲染（A4 白底/图例/比例尺/全符号）+ 栅格化下载 + 课堂使用说明；视觉审查修 4 缺陷（墙单线 bug 等）+ 补对象旋转；回归清单全项过（含真实 PNG/MP4 导出）；class-v1 标签 + PATCHES 收口。项目 T00–T07 全量完成。

### Git Commits

| Hash | Message |
|------|---------|
| `9b55f3e` | (see git log) |
| `5c01875` | (see git log) |

### Status

[OK] **Completed**

## Session 10: 层级双击重命名 + 滑块数值键入（S6/S7）

**Date**: 2026-10-24
**Task**: 10-24-layer-rename-and-slider-input
**Branch**: `class`

### Summary

场景层级双击就地重命名（Enter/blur 提交、Esc 取消、空值回退、30 字上限），改名按 object.id 扇出到全部镜头快照使机位词跨镜头同步（编译器纯函数派生，零额外代码）；全部滑块（位置/旋转/缩放/关节/焦距/动作相位）数值可键入，非法/超轨道范围自动还原（还原而非 clamp，用户定案），合法值对齐 step 网格。新接缝 S6/S7 登记 PATCHES.md；新文件 SliderNumberInput/sliderNumber（11 单测）。检查修复 2 缺陷：focus+blur 静默吸附（dirtyRef）、无改动空改名撤销记录（未变化守卫）。构建 + 136 diagram 单测回归全绿。

### Status

[OK] **Completed**
