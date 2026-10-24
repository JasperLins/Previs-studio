# Self-check 记录（2026-10-24）

## 验证命令

- `npm run build` — 通过（chunk-size 警告为上游既有）
- `node --test src/shotPresets.test.js` — 11/11 通过（含斜距构图锁定测试）
- `node --test "src/diagram/**/*.test.js"` — 136/136 通过（回归基线保持）
- `node --test`（全仓）— 182/182 通过（其中一次单发 fail 无法复现，连续 3 次全绿，判定为 Windows 下 node --test 并发启动偶发）

## trellis-check 结论（PASS，无 P0/P1）

- 纪律合规：App.jsx 改动严格限于 S9 四接缝点；styles.css 纯末尾追加 `dg-shot-preset-*`；PATCHES.md/base-audit.md S9 行与实际落点一致；未动 Viewport.jsx/ShotsPanel.jsx/rig.js。
- 公式与 design.md 逐项一致；`addShot` 限额/缩略图/命名逻辑未动；「当前视角」与旧 addShot 逐行等价；取消三路径零副作用。

## check 后修正的缺陷（1 处，设计层）

- 俯拍类预设取景距离按水平距计算而实际视线是斜的（鸟瞰 pitch 1.52 斜距 ≈ 20× 水平距，物体缩成小点）→ 改为沿视线斜距定义：水平距 = d·cos(pitch)、Δy = d·sin(pitch)。design.md 已同步修订并加斜距锁定测试。

## 浏览器验证（IAB 全新标签页 + npm run dev，2026-10-24）

1. ✅ 未选中/选中主摄像机 → 新建镜头直接创建，无面板（现状保持）。
2. ✅ 选中「人物 · 主角」→ 新建镜头 → 弹「添加机位」面板：标题/「镜头将对准：人物 · 主角」/15 预设两列网格完整，视觉与设计稿一致（截图目视核验）。
3. ✅ 取消三路径（Esc / 遮罩点击 / 关闭按钮）→ 面板关闭、镜头数不变、无 toast。
4. ✅ 45°俯拍 → 新建「镜头 02」、toast「已新建"镜头 02" · 机位：45°俯拍」；摄像机视角截图核验：人物全身入画、45° 俯视构图、留白正常。
5. ✅ 选中旋转过的「平台」→ 正面全景 → toast 正确；摄像机视角截图核验：平台完整入画、正面全景构图正常（机位跟随物体自身朝向）。

## 已知残留（记录，不修）

- 面板打开期间全局快捷键仍活跃（如 Delete 可删目标物体，面板静默回退当前相机）——与上游 ProjectSettingsDialog 同模式，如需修须先补接缝登记（check P2-1）。
- 水平取景复核固定 16:9 基准，竖幅镜头下极宽物体理论上可能水平出画（design 明示取舍，check P2-3）。
- `assembly`/`model`(GLB)/`depthMesh` 的包围尺寸按 scale 近似估算，首版接受（design 风险节）。
