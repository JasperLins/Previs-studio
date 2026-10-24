// node --test "src/**/*.test.js" 直接可跑（node 22 内置 runner，零依赖；裸目录形式不匹配）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SHOT_CAMERA_PRESETS, objectFramingBounds, presetCameraForObject } from './shotPresets.js'

const standardPerson = { id: 'p1', name: '人物 · 主角', type: 'person', bodyType: 'standard', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], rigRoot: [0, 0, 0] }
const currentCamera = { position: [7.4, 4.6, 8.2], rotation: [-0.3, 0.72, 0], focalLength: 42, aspectRatio: '16:9' }

// 与实现同公式（App.jsx cameraRotationToward 同语义）的朝向反验函数
function orientationToward(position, target) {
  let dx = target[0] - position[0]
  let dy = target[1] - position[1]
  let dz = target[2] - position[2]
  const length = Math.hypot(dx, dy, dz)
  dx /= length; dy /= length; dz /= length
  return [Math.asin(Math.min(1, Math.max(-1, dy))), Math.atan2(-dx, -dz), 0]
}

// 按实现同公式重算取景目标点（默认包围中心；过肩预设沿前向偏移 0.8 × 身高）
function expectedTarget(object, presetId) {
  const bounds = objectFramingBounds(object)
  const preset = SHOT_CAMERA_PRESETS.find(option => option.id === presetId)
  if (!preset || preset.shoulder == null) return bounds.center
  const fwd = [Math.sin(bounds.yaw), 0, Math.cos(bounds.yaw)]
  return [
    bounds.center[0] + fwd[0] * 0.8 * bounds.height,
    bounds.center[1],
    bounds.center[2] + fwd[2] * 0.8 * bounds.height,
  ]
}

const distanceToTarget = (camera, target) => Math.hypot(
  target[0] - camera.position[0],
  target[1] - camera.position[1],
  target[2] - camera.position[2],
)

const FRONT_PRESET_IDS = ['front_close', 'front_medium', 'front_full']

test('SHOT_CAMERA_PRESETS：15 个预设、id 唯一、current 之外参数齐全', () => {
  assert.equal(SHOT_CAMERA_PRESETS.length, 15)
  assert.equal(new Set(SHOT_CAMERA_PRESETS.map(preset => preset.id)).size, 15)
  for (const preset of SHOT_CAMERA_PRESETS) {
    assert.ok(preset.label, `${preset.id} 应有 label`)
    assert.ok(preset.hint, `${preset.id} 应有 hint`)
    if (preset.id !== 'current') {
      for (const key of ['azimuth', 'pitch', 'framing', 'focal', 'eye']) assert.ok(key in preset, `${preset.id} 应有 ${key}`)
    }
  }
})

test('标准人物 bounds：身高 1.8、宽 0.55、体厚 0.3、中心在身高中点、yaw 跟随 rotation[1]', () => {
  const bounds = objectFramingBounds(standardPerson)
  assert.equal(bounds.height, 1.8)
  assert.equal(bounds.width, 0.55)
  assert.equal(bounds.depth, 0.3)
  assert.deepEqual(bounds.center, [0, 0.9, 0])
  assert.equal(bounds.yaw, 0)
  const turned = objectFramingBounds({ ...standardPerson, rotation: [0, Math.PI / 2, 0] })
  assert.equal(turned.yaw, Math.PI / 2)
})

test('每个预设（current 除外）对标准人物返回合法机位：位置有限、距目标 > 0.3、朝向一致、焦距合规、物体只读', () => {
  for (const preset of SHOT_CAMERA_PRESETS) {
    if (preset.id === 'current') continue
    const before = JSON.stringify(standardPerson)
    const camera = presetCameraForObject(preset.id, standardPerson, currentCamera)
    assert.ok(camera, `${preset.id} 应返回机位`)
    assert.deepEqual(JSON.stringify(standardPerson), before, `${preset.id} 不应修改物体`)
    assert.ok(camera.position.every(Number.isFinite), `${preset.id} 位置应有限`)
    assert.ok(camera.rotation.every(Number.isFinite), `${preset.id} 旋转应有限`)
    const target = expectedTarget(standardPerson, preset.id)
    assert.ok(distanceToTarget(camera, target) > 0.3, `${preset.id} 距目标应 > 0.3`)
    const expected = orientationToward(camera.position, target)
    assert.ok(
      Math.abs(camera.rotation[0] - expected[0]) < 1e-9 && Math.abs(camera.rotation[1] - expected[1]) < 1e-9,
      `${preset.id} rotation 应与相机→目标方向一致`,
    )
    assert.ok(camera.focalLength >= 18 && camera.focalLength <= 120, `${preset.id} focalLength 应在 18–120`)
    assert.ok(camera.position[1] >= 0.05, `${preset.id} 相机不应钻地`)
  }
})

test('正面系：yaw=0 相机在 +Z 侧；yaw=π/2 跟随朝向到 +X 侧', () => {
  for (const id of FRONT_PRESET_IDS) {
    const camera = presetCameraForObject(id, standardPerson, currentCamera)
    assert.ok(camera.position[2] > 0, `${id} 在 yaw=0 时应在物体 +Z 前方`)
  }
  const turned = { ...standardPerson, rotation: [0, Math.PI / 2, 0] }
  for (const id of FRONT_PRESET_IDS) {
    const camera = presetCameraForObject(id, turned, currentCamera)
    assert.ok(camera.position[0] > 0, `${id} 在 yaw=π/2 时应在物体 +X 前方`)
  }
})

test('俯拍类（eye=null）相机高于取景中心；低角度类低于取景中心', () => {
  const { center } = objectFramingBounds(standardPerson)
  for (const id of ['high_45', 'top_down', 'birdseye']) {
    const camera = presetCameraForObject(id, standardPerson, currentCamera)
    assert.ok(camera.position[1] > center[1], `${id} 应俯拍（相机高于中心）`)
  }
  for (const id of ['low_angle', 'low_wide']) {
    const camera = presetCameraForObject(id, standardPerson, currentCamera)
    assert.ok(camera.position[1] < center[1], `${id} 应仰拍（相机低于中心）`)
  }
})

test('俯拍类取景距离为沿视线斜距：相机到目标距离 ≈ 按表观高度计算的取景距离（构图不随俯角缩水）', () => {
  const { height, width, depth, center } = objectFramingBounds(standardPerson)
  for (const id of ['high_45', 'top_down', 'birdseye']) {
    const preset = SHOT_CAMERA_PRESETS.find(option => option.id === id)
    const tanHalfFov = 12 / preset.focal
    // 表观高度：身高轴贴近视线被压缩 + 体厚贡献（与实现同公式）
    const theta = Math.abs(preset.pitch)
    const apparent = height * Math.cos(theta) + depth * Math.sin(theta)
    const expected = Math.max(
      (apparent / 2) / tanHalfFov * preset.framing,
      (width / 2) / (tanHalfFov * (16 / 9)) * preset.framing,
    )
    const camera = presetCameraForObject(id, standardPerson, currentCamera)
    const slant = distanceToTarget(camera, center)
    assert.ok(Math.abs(slant - expected) < 1e-9 * expected + 1e-9, `${id} 斜距 ${slant} 应等于取景距离 ${expected}`)
  }
})

test('俯拍三预设人物画面占幅落在目标区间（展现人物的产品口径）', () => {
  const targets = { high_45: [0.65, 0.80], top_down: [0.45, 0.60], birdseye: [0.25, 0.40] }
  for (const [id, [min, max]] of Object.entries(targets)) {
    const camera = presetCameraForObject(id, standardPerson, currentCamera)
    const slant = distanceToTarget(camera, expectedTarget(standardPerson, id))
    const tanHalfFov = 12 / camera.focalLength
    const { height, depth } = objectFramingBounds(standardPerson)
    const preset = SHOT_CAMERA_PRESETS.find(option => option.id === id)
    const apparent = height * Math.cos(Math.abs(preset.pitch)) + depth * Math.sin(Math.abs(preset.pitch))
    const fill = apparent / (2 * tanHalfFov * slant)
    assert.ok(fill >= min && fill <= max, `${id} 画面占幅 ${fill.toFixed(3)} 应在 [${min}, ${max}]`)
  }
})

test('景别排序：front_close < front_medium < front_full（相机到目标距离）', () => {
  const distances = FRONT_PRESET_IDS.map(id => {
    const camera = presetCameraForObject(id, standardPerson, currentCamera)
    return distanceToTarget(camera, expectedTarget(standardPerson, id))
  })
  assert.ok(distances[0] < distances[1] && distances[1] < distances[2], `距离应递增：${distances}`)
})

test('荷兰角 rotation[2] ≈ roll；其余预设 roll 为 0', () => {
  const dutch = presetCameraForObject('dutch', standardPerson, currentCamera)
  assert.ok(Math.abs(dutch.rotation[2] - 0.22) < 1e-6, 'rotation[2] 应等于 roll')
  const plain = presetCameraForObject('front_medium', standardPerson, currentCamera)
  assert.equal(plain.rotation[2], 0)
})

test('current / 未知预设 → null（沿用当前摄像机）', () => {
  assert.equal(presetCameraForObject('current', standardPerson, currentCamera), null)
  assert.equal(presetCameraForObject('no_such_preset', standardPerson, currentCamera), null)
  assert.equal(presetCameraForObject('front_close', null, currentCamera), null)
})

test('几何体（box）：center = position + [0, height/2, 0]；取景距离满足全高入画', () => {
  const box = { id: 'b1', name: '平台', type: 'box', position: [1.4, 0.45, -0.8], rotation: [0, -0.18, 0], scale: [2.8, 0.9, 2.1] }
  const bounds = objectFramingBounds(box)
  assert.equal(bounds.height, 0.9)
  assert.equal(bounds.width, 2.8)
  assert.equal(bounds.depth, 2.1)
  assert.ok(Math.abs(bounds.center[0] - 1.4) < 1e-9 && Math.abs(bounds.center[1] - 0.9) < 1e-9 && Math.abs(bounds.center[2] + 0.8) < 1e-9, 'center 应为 position + [0, h/2, 0]')
  for (const id of FRONT_PRESET_IDS) {
    const camera = presetCameraForObject(id, box, currentCamera)
    const tanHalfFov = 12 / camera.focalLength
    const required = bounds.height / (2 * tanHalfFov) * 0.9
    const distance = distanceToTarget(camera, bounds.center)
    assert.ok(distance >= required, `${id} 距离 ${distance} 应 ≥ 全高入画下限 ${required}`)
  }
})

test('人物 scale×2：机位距离约等比放大（×2，误差 ±10%）', () => {
  const base = distanceToTarget(
    presetCameraForObject('front_medium', standardPerson, currentCamera),
    expectedTarget(standardPerson, 'front_medium'),
  )
  const tall = { ...standardPerson, scale: [2, 2, 2] }
  const scaled = distanceToTarget(
    presetCameraForObject('front_medium', tall, currentCamera),
    expectedTarget(tall, 'front_medium'),
  )
  assert.ok(Math.abs(scaled / base - 2) < 0.1, `比例 ${scaled / base} 应在 2 ± 10%`)
})
