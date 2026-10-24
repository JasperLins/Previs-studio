# 执行计划 — 选中物体新建镜头时机位预设

前置：`design.md` 定稿；`base-audit.md` 已登记 S9（规格先行，fork 纪律）。实现顺序自上而下，每步可独立验证。

## 步骤

### S0 台账（fork 纪律）

- [x] `base-audit.md` 接缝表加 S9 行（已随 design 定稿完成）。
- [ ] `docs/PATCHES.md` 接缝登记表加 S9 行（锚点：App() 状态区 / addShot / SettingsDialog 挂载行附近；改动与目的照 S9 定义；日期 2026-10-24）。

### S1 `src/shotPresets.js` — 预设与机位计算（纯函数）

- [ ] `SHOT_CAMERA_PRESETS`：15 个预设（id/label/hint + azimuth/pitch/framing/focal/eye/roll/shoulder），参数表见 design.md。
- [ ] `objectFramingBounds(object)`：person / 几何体两分支 → `{ center, height, width, depth, yaw }`。
- [ ] `cameraRotationBetween(position, target)`：`cameraRotationToward` 同语义内部实现（无 fallback，不动 App 原函数）。
- [ ] `presetCameraForObject(presetId, object, currentCamera)`：`current`/未知 → `null`；否则 `{ position, rotation, focalLength }`（focal clamp 18–120，cameraY ≥ 0.05）。
- [ ] 取景：`fovV = 2×atan(12/focal)`；垂直取景距离 + 水平（16:9、width）复核取大。

### S2 `src/shotPresets.test.js` — node:test 单测

- [ ] 覆盖 design.md「测试」小节全部断言组（朝向反验、方位跟随 yaw、俯仰方向、景别排序、roll、null 分支、box 取景、身高等比）。
- [ ] `node --test src/shotPresets.test.js` 全绿。

### S3 `src/ShotPresetDialog.jsx` + App.jsx S9 接缝

- [ ] `ShotPresetDialog`：受控组件（object/presets/onPick/onCancel），遮罩点击/关闭钮/Esc 取消，两列网格（label + hint）。
- [ ] App.jsx：import；状态区 `shotPresetTargetId`；`handleAddShotClick` 入口（LeftSidebar `onAddShot` 改指它）；`addShot(presetId)` 扩展（override 合并 nextShot.camera、toast 带预设名）；渲染区挂 `<ShotPresetDialog>`。
- [ ] ShotsPanel/LeftSidebar 传参结构不动。

### S4 `styles.css` — 末尾追加 `dg-shot-preset-*`

- [ ] `dg-shot-preset-overlay`（遮罩，z-index ≥ 40）/ `dg-shot-preset-dialog`（深色卡片）/ `dg-shot-preset-grid`（两列）/ `.dg-shot-preset-option`（hover 高亮）；不改任何既有样式块。

### S5 验证

- [ ] `node --test src/shotPresets.test.js` 全绿。
- [ ] `npm run build` 成功。
- [ ] `npm run dev` 手动路径（注意 fork-discipline 渲染坑：验证前开全新标签页）：
  1. 未选中物体 → 新建镜头：直接创建（现状不变，无面板）。
  2. 选中人物 → 新建：弹面板 → 取消（遮罩/Esc/关闭钮）→ 无新建、无 toast、状态不变。
  3. 选中人物 → 45°俯拍 → 新镜头激活，监视器中人物完整入画、机位符合预设；toast 含预设名。
  4. 选中旋转过的平台（rotation.y ≠ 0）→ 正面全景 → 机位在平台自身正前方。
  5. 当前视角 → 与旧 `addShot` 相机一致。
  6. 回归：加对象/切镜/导 PNG 各走一遍（S8 项目库自动保存不报错）。

## 检查点与回滚

- S2 后纯函数可独立回归；S3/S4 为接线与皮肤，出错 `git checkout -- src/App.jsx src/styles.css` 即回滚。
- 全部完成后走 Phase 3：spec 复核（base-audit S9 描述与实际落点一致）→ commit → archive。

## 验证命令汇总

```bash
node --test src/shotPresets.test.js
node --test "src/diagram/**/*.test.js"   # 回归既有单测
npm run build
npm run dev                              # 手动验证 S5 清单
```
