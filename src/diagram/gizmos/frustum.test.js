// node --test "src/diagram/**/*.test.js" 直接可跑（node 内置 runner，零依赖）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { camLetter, coneLengthMeters, headingYawRad, horizontalForward, horizontalFovDeg, isInFrame, nearestInFramePerson, verticalFovDeg } from './frustum.js'

// 外部参照值：全画幅水平 FoV 公众口径（35mm→54.4°、85mm→23.9° 等），非本模块公式回抄。
// （任务书参照表 35→54.410 / 85→23.902 与公式 2·arctan(18/f) 差 >0.01°，按 product-spec §2 公式为准。）
const HFOV_TABLE = [
  [18, 90.0],
  [24, 73.7398],
  [35, 54.4322],
  [50, 39.5978],
  [85, 23.9132],
  [120, 17.0615],
]

test('horizontalFovDeg：六档焦距外部参照对照，误差 <0.01°', () => {
  for (const [f, expected] of HFOV_TABLE) {
    assert.ok(
      Math.abs(horizontalFovDeg(f) - expected) < 0.01,
      `f=${f}：实际 ${horizontalFovDeg(f).toFixed(4)}° vs 参照 ${expected}°`,
    )
  }
})

test('horizontalFovDeg：独立恒等式 tan(hfov/2) = 18/f（非同式自证）', () => {
  for (const f of [8, 16, 18, 24, 35, 42, 50, 85, 120, 300]) {
    const halfRad = (horizontalFovDeg(f) / 2) * (Math.PI / 180)
    const ratio = Math.tan(halfRad)
    assert.ok(Math.abs(ratio - 18 / f) < 1e-9, `f=${f}：tan(半角)=${ratio} ≠ 18/f=${18 / f}`)
  }
})

test('horizontalFovDeg：非法焦距（≤0 / 非有限数 / 缺省）兜底 90', () => {
  for (const f of [0, -35, NaN, Infinity, -Infinity, undefined, null, 'abc']) {
    assert.equal(horizontalFovDeg(f), 90, `f=${String(f)} 应回退 90`)
  }
})

test('verticalFovDeg：独立恒等式 tan(vfov/2) = 12/f，非法兜底 90', () => {
  for (const f of [18, 24, 35, 50, 85, 120]) {
    const halfRad = (verticalFovDeg(f) / 2) * (Math.PI / 180)
    assert.ok(Math.abs(Math.tan(halfRad) - 12 / f) < 1e-9, `f=${f}`)
  }
  assert.ok(Math.abs(verticalFovDeg(18) - 67.3801) < 0.01, '18mm 垂直角参照 67.38°')
  for (const f of [0, -50, NaN, undefined, null]) {
    assert.equal(verticalFovDeg(f), 90, `f=${String(f)} 应回退 90`)
  }
})

// —— isInFrame：机位在原点朝北（yaw=0 → 前向 -Z），35mm（hfov≈54.43°，半角≈27.22°）——
const cameraNorth = { position: [0, 1.5, 0], rotation: [0, 0, 0], focalLength: 35 }
const hfov35 = horizontalFovDeg(35)

test('isInFrame：四象限——正前入画，机后/左右画外出画', () => {
  assert.equal(isInFrame(cameraNorth, [0, 0, -5], hfov35, 90), true)   // 正前（北）
  assert.equal(isInFrame(cameraNorth, [0, 0, 5], hfov35, 90), false)   // 机后
  assert.equal(isInFrame(cameraNorth, [5, 0, 0], hfov35, 90), false)   // 正右（90° > 半角）
  assert.equal(isInFrame(cameraNorth, [-5, 0, 0], hfov35, 90), false)  // 正左
})

test('isInFrame：视场内斜向入画、视场外斜向出画', () => {
  assert.equal(isInFrame(cameraNorth, [1, 0, -5], hfov35, 90), true)   // 偏角 ≈11.3° < 27.2°
  assert.equal(isInFrame(cameraNorth, [3, 0, -5], hfov35, 90), false)  // 偏角 ≈31.0° > 27.2°
})

test('isInFrame：半角边界两侧（浮点安全取边界 ±0.1）', () => {
  assert.equal(isInFrame(cameraNorth, [4.9, 0, -5], 90, 90), true)     // ≈44.4° < 45°
  assert.equal(isInFrame(cameraNorth, [5.1, 0, -5], 90, 90), false)    // ≈45.6° > 45°
})

test('isInFrame：yaw 旋转前向跟随（yaw=π/2 → 前向 -X）', () => {
  const cameraWest = { position: [0, 1.5, 0], rotation: [0, Math.PI / 2, 0], focalLength: 35 }
  assert.equal(isInFrame(cameraWest, [-5, 0, 0], hfov35, 90), true)
  assert.equal(isInFrame(cameraWest, [0, 0, -5], hfov35, 90), false)
  const cameraDiagonal = { position: [0, 1.5, 0], rotation: [0, Math.PI / 4, 0], focalLength: 35 }
  assert.equal(isInFrame(cameraDiagonal, [-5, 0, -5], hfov35, 90), true)  // 前向恰指西北
})

test('isInFrame：零距离与近机位（≤0.1m）不算入画', () => {
  assert.equal(isInFrame(cameraNorth, [0, 0, 0], hfov35, 90), false)
  assert.equal(isInFrame(cameraNorth, [0.05, 0, 0.02], hfov35, 90), false)
})

test('isInFrame：v1 只做水平角判定（vfovDeg 极窄不影响正前目标）', () => {
  assert.equal(isInFrame(cameraNorth, [0, 0, -5], hfov35, 1), true)
})

// —— 欧拉翻支（回归红线）：three 四元数→欧拉分解在 |yaw|>90° 时翻支——
// 物理朝向 yaw=200° 会被存成 (x=-180°, y=-20°, z=-180°)（同一旋转）。
// 直接取 rotation[1] 会把朝向镜像成 -20°；水平朝向消费必须走 horizontalForward/headingYawRad。
const deg = Math.PI / 180
const yaw200 = [0, 200 * deg, 0]
const yaw200Flipped = [180 * deg, -20 * deg, 180 * deg] // 与 yaw200 同一旋转（翻支表示）

test('headingYawRad：翻支前后同一物理朝向返回同一水平角（yaw=200°）', () => {
  const direct = headingYawRad(yaw200)
  const flipped = headingYawRad(yaw200Flipped)
  assert.ok(Math.abs(direct - flipped) < 1e-9, `直接 ${direct / deg}° vs 翻支 ${flipped / deg}°`)
  // atan2 值域 (-π,π]：200° 表达为 -160°，按方向（sin/cos）等价判定
  assert.ok(Math.abs(Math.sin(direct) - Math.sin(200 * deg)) < 1e-9, `sin 方向应为 200°，实际 ${direct / deg}°`)
  assert.ok(Math.abs(Math.cos(direct) - Math.cos(200 * deg)) < 1e-9, `cos 方向应为 200°，实际 ${direct / deg}°`)
})

test('headingYawRad：带俯仰/翻滚的组合翻支（真实分解值）等价', () => {
  // (pitch-13°, yaw120°, roll8°) 经 three 分解 → (167°, 60°, -172°)：物理朝向不变
  const original = [-13 * deg, 120 * deg, 8 * deg]
  const flipped = [167 * deg, 60 * deg, -172 * deg]
  const a = headingYawRad(original)
  const b = headingYawRad(flipped)
  assert.ok(Math.abs(a - b) < 1e-6, `${a / deg}° vs ${b / deg}°`)
})

test('horizontalForward：单位向量；非法 rotation 兜底朝北；俯仰 ±90° 退化兜底', () => {
  const f = horizontalForward([0, 0, 0])
  assert.ok(f.x === 0 && f.z === -1, `朝北应为 (0,-1)，实际 (${f.x},${f.z})`) // === 口径：-0 视同 0
  assert.ok(Math.hypot(f.x, f.z) > 1 - 1e-12, '单位长度')
  assert.ok(horizontalForward(null).z === -1)
  assert.ok(horizontalForward([NaN, NaN, NaN]).z === -1)
  // 俯仰 -90°（正上方）+ yaw 0：水平前向退化 → 兜底 (0,-1) 不产出 NaN
  const degenerate = horizontalForward([-Math.PI / 2, 0, 0])
  assert.ok(Number.isFinite(degenerate.x) && Number.isFinite(degenerate.z))
})

test('isInFrame：翻支存储下前向仍指真实朝向（200° 镜头正前目标入画、机后出画）', () => {
  // 200° 朝向的单位前向 ≈ (0.342, 0.940)：目标沿前向 10m
  const ahead = [3.42, 0, 9.4]
  const behind = [-3.42, 0, -9.4]
  for (const rotation of [yaw200, yaw200Flipped]) {
    const camera = { position: [0, 1.5, 0], rotation, focalLength: 35 }
    assert.equal(isInFrame(camera, ahead, hfov35, 90), true, `rotation=${JSON.stringify(rotation)} 前向目标应入画`)
    assert.equal(isInFrame(camera, behind, hfov35, 90), false, `rotation=${JSON.stringify(rotation)} 机后目标应出画`)
  }
})

test('coneLengthMeters：翻支存储下锥长仍按真实朝向取最远入画对象', () => {
  const fwd = horizontalForward(yaw200) // 沿真实前向精确 10m（hypot 恰为 10，锥长 11）
  const objects = [{ position: [fwd.x * 10, 0, fwd.z * 10] }]
  for (const rotation of [yaw200, yaw200Flipped]) {
    const camera = { position: [0, 1.5, 0], rotation, focalLength: 18 }
    assert.ok(Math.abs(coneLengthMeters(camera, objects, 90, 90) - 11) < 1e-9, `rotation=${JSON.stringify(rotation)}`)
  }
})

test('isInFrame：机位/目标缺 position 或分量非法 → false；hfov 非法按 90 兜底', () => {
  assert.equal(isInFrame(null, [0, 0, -5], 90, 90), false)
  assert.equal(isInFrame({}, [0, 0, -5], 90, 90), false)
  assert.equal(isInFrame({ position: [0, 0, 0] }, null, 90, 90), false)
  assert.equal(isInFrame({ position: [0, 0, 0] }, [NaN, 0, -5], 90, 90), false)
  assert.equal(isInFrame({ position: [0, 0, 0], rotation: [NaN, NaN, NaN] }, [0, 0, -5], NaN, 90), true)
})

// —— coneLengthMeters：机位原点朝北，18mm（hfov=90°，半角 45°）——
const cameraWide = { position: [0, 1.5, 0], rotation: [0, 0, 0], focalLength: 18 }
const hfov90 = 90

test('coneLengthMeters：多主体取最远入画距离 +1（画外主体不计）', () => {
  const objects = [
    { position: [0, 0, -3] },   // 入画 3m
    { position: [0, 0, -10] },  // 入画 10m（最远）
    { position: [10, 0, -1] },  // 偏角 ≈84° 出画
  ]
  assert.equal(coneLengthMeters(cameraWide, objects, hfov90, 90), 11)
})

test('coneLengthMeters：空对象 / 全出画 / 无效输入回退 5', () => {
  assert.equal(coneLengthMeters(cameraWide, [], hfov90, 90), 5)
  assert.equal(coneLengthMeters(cameraWide, [{ position: [0, 0, 8] }], hfov90, 90), 5)
  assert.equal(coneLengthMeters(cameraWide, null, hfov90, 90), 5)
  assert.equal(coneLengthMeters(cameraWide, [{ nope: true }, { position: [NaN, 0, -1] }], hfov90, 90), 5)
  assert.equal(coneLengthMeters(null, [{ position: [0, 0, -3] }], hfov90, 90), 5)
})

test('coneLengthMeters：近主体下限 2m 防退化；hfovDeg 缺省由焦距现算', () => {
  assert.equal(coneLengthMeters(cameraWide, [{ position: [0, 0, -0.5] }], hfov90, 90), 2)
  // 35mm（半角 27.2°）：[-1,0,-5] 偏角 ≈11.3° 入画 → 5.385m + 1
  const objects = [{ position: [-1, 0, -5] }]
  const byFocal = coneLengthMeters(cameraNorth, objects)
  assert.ok(Math.abs(byFocal - (Math.hypot(1, 5) + 1)) < 1e-9)
})

test('coneLengthMeters：锥长按机位偏移计算（机位不在原点）', () => {
  const cameraMoved = { position: [10, 1.5, 10], rotation: [0, 0, 0], focalLength: 18 }
  assert.equal(coneLengthMeters(cameraMoved, [{ position: [10, 0, 5] }], hfov90, 90), 6)
})

// —— nearestInFramePerson ——
test('nearestInFramePerson：返回最近入画 person 的对象引用', () => {
  const near = { id: 'p1', type: 'person', position: [0, 0, -3] }
  const far = { id: 'p2', type: 'person', position: [0, 0, -8] }
  assert.equal(nearestInFramePerson(cameraWide, [far, near]), near)
})

test('nearestInFramePerson：非 person 不计；全出画 / 无 person → null', () => {
  const table = { id: 't1', type: 'table', position: [0, 0, -2] }
  assert.equal(nearestInFramePerson(cameraWide, [table]), null)
  assert.equal(nearestInFramePerson(cameraWide, [{ id: 'p1', type: 'person', position: [0, 0, 8] }]), null)
  assert.equal(nearestInFramePerson(cameraWide, []), null)
  assert.equal(nearestInFramePerson(cameraWide, null), null)
  assert.equal(nearestInFramePerson(null, [{ id: 'p1', type: 'person', position: [0, 0, -2] }]), null)
})

test('nearestInFramePerson：判定用机位自身焦距（窄角下正前近距离人物出画）', () => {
  // 120mm 半角 ≈8.5°：[-1,0,-5] 偏角 ≈11.3° 出画；正前 [0,0,-5] 仍在
  const narrow = { position: [0, 1.5, 0], rotation: [0, 0, 0], focalLength: 120 }
  const side = { id: 'p1', type: 'person', position: [-1, 0, -5] }
  const front = { id: 'p2', type: 'person', position: [0, 0, -5] }
  assert.equal(nearestInFramePerson(narrow, [side, front]), front)
})

// —— camLetter ——
test('camLetter：0 起 A…Z，26 起 AA、AB…（上限外继续进位）', () => {
  assert.equal(camLetter(0), 'A')
  assert.equal(camLetter(1), 'B')
  assert.equal(camLetter(25), 'Z')
  assert.equal(camLetter(26), 'AA')
  assert.equal(camLetter(27), 'AB')
  assert.equal(camLetter(51), 'AZ')
  assert.equal(camLetter(52), 'BA')
  assert.equal(camLetter(701), 'ZZ')
  assert.equal(camLetter(702), 'AAA')
})

test('camLetter：负数 / 非整数 / NaN 兜底 A', () => {
  for (const index of [-1, -100, 1.5, NaN, Infinity, undefined, null]) {
    assert.equal(camLetter(index), 'A', `index=${String(index)} 应回退 A`)
  }
})
