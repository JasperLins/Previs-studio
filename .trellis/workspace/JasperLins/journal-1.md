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
