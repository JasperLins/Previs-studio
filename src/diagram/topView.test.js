// node --test "src/diagram/**/*.test.js" 直接可跑（node 22 内置 runner，零依赖）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TOP_VIEW_UP, applyPlaneLock, computeTopViewBounds, isTopView, pickScaleBar, worldPerPixel } from './topView.js'

test('TOP_VIEW_UP：上 = 场景北（-Z），且冻结防篡改', () => {
  assert.deepEqual(TOP_VIEW_UP, [0, 0, -1])
  assert.equal(Object.isFrozen(TOP_VIEW_UP), true)
})

test('isTopView：顶视开且不在摄像机视角时才成立（摄像机视角优先）', () => {
  assert.equal(isTopView({ topView: true, cameraView: false }), true)
  assert.equal(isTopView({ topView: true, cameraView: true }), false)
  assert.equal(isTopView({ topView: false, cameraView: false }), false)
  assert.equal(isTopView({ topView: false, cameraView: true }), false)
  assert.equal(isTopView({}), false)
  assert.equal(isTopView(), false)
})

test('isTopView：truthy 非布尔值按布尔语义归一', () => {
  assert.equal(isTopView({ topView: 1, cameraView: 0 }), true)
  assert.equal(isTopView({ topView: 1, cameraView: 'x' }), false)
})

test('applyPlaneLock：锁 Y 高度与俯仰/翻滚，放行 X/Z 与水平角', () => {
  const data = { position: [1, 2, 3], rotation: [0.1, 0.5, 0.2] }
  const next = applyPlaneLock(data, { position: [9, 99, 8], rotation: [1.1, 1.5, 1.2], scale: [1, 2, 3] })
  assert.deepEqual(next.position, [9, 2, 8])
  assert.deepEqual(next.rotation, [0.1, 1.5, 0.2])
  assert.deepEqual(next.scale, [1, 2, 3])
})

test('applyPlaneLock：不改入参，返回新对象', () => {
  const data = { position: [1, 2, 3], rotation: [0.1, 0.5, 0.2] }
  const next = { position: [9, 99, 8], rotation: [1.1, 1.5, 1.2] }
  const result = applyPlaneLock(data, next)
  assert.deepEqual(data.position, [1, 2, 3])
  assert.deepEqual(data.rotation, [0.1, 0.5, 0.2])
  assert.deepEqual(next.position, [9, 99, 8])
  assert.deepEqual(next.rotation, [1.1, 1.5, 1.2])
  assert.notEqual(result, next)
  assert.notEqual(result.position, next.position)
  assert.notEqual(result.rotation, next.rotation)
})

test('applyPlaneLock：data 缺 position 与 rotation 时原样放行 next 拷贝', () => {
  const next = { position: [1, 2, 3], rotation: [0.1, 0.5, 0.2], extra: '保留' }
  for (const data of [null, undefined, {}, { name: 'x' }, { position: null, rotation: null }]) {
    const result = applyPlaneLock(data, next)
    assert.deepEqual(result, next)
    assert.notEqual(result, next)
  }
})

test('applyPlaneLock：data 只缺一组字段时按另一组正常夹紧', () => {
  const next = { position: [9, 99, 8], rotation: [1.1, 1.5, 1.2] }
  assert.deepEqual(applyPlaneLock({ position: [1, 2, 3] }, next), { position: [9, 2, 8], rotation: [1.1, 1.5, 1.2] })
  assert.deepEqual(applyPlaneLock({ rotation: [0.1, 0.5, 0.2] }, next), { position: [9, 99, 8], rotation: [0.1, 1.5, 0.2] })
})

test('applyPlaneLock：data 数组分量非有限数视为缺该分量', () => {
  const next = { position: [9, 99, 8], rotation: [1.1, 1.5, 1.2] }
  const result = applyPlaneLock({ position: [1, NaN, 3], rotation: [NaN, 0.5, NaN] }, next)
  assert.deepEqual(result, { position: [9, 99, 8], rotation: [1.1, 1.5, 1.2] })
})

test('applyPlaneLock：next 缺字段时不报错、不无中生有', () => {
  const data = { position: [1, 2, 3], rotation: [0.1, 0.2, 0.3] }
  assert.deepEqual(applyPlaneLock(data, {}), {})
  assert.deepEqual(applyPlaneLock(data, null), {})
  assert.deepEqual(applyPlaneLock(data, undefined), {})
})

test('computeTopViewBounds：空/无效输入回退中心 [0,0] 与半径 6', () => {
  const inputs = [undefined, null, 'x', [], [null], [{}], [{ position: null }], [{ position: 'bad' }], [{ position: [NaN, 0, NaN] }], [{ position: [1, 0, NaN] }], [{ position: [NaN, 0, 3] }]]
  for (const input of inputs) {
    assert.deepEqual(computeTopViewBounds(input), { center: [0, 0], radius: 6 }, `输入 ${JSON.stringify(input)} 应回退默认`)
  }
})

test('computeTopViewBounds：Y 分量非有限数不影响（只看 X/Z）', () => {
  assert.deepEqual(computeTopViewBounds([{ position: [1, NaN, 3] }]), { center: [1, 3], radius: 2 })
})

test('computeTopViewBounds：单对象 → 中心即其 X/Z，半径取下限 2', () => {
  assert.deepEqual(computeTopViewBounds([{ position: [3, 1, -4] }]), { center: [3, -4], radius: 2 })
})

test('computeTopViewBounds：X/Z 包围盒对角线决定半径（diag/2 + 2），Y 不参与', () => {
  const objects = [
    { position: [-5, 0, -1] },
    { position: [5, 30, 1] },
  ]
  const bounds = computeTopViewBounds(objects)
  assert.deepEqual(bounds.center, [0, 0])
  assert.ok(Math.abs(bounds.radius - (Math.hypot(10, 2) / 2 + 2)) < 1e-9)
})

test('computeTopViewBounds：NaN/非数值位置的对象被跳过，不影响其余包围盒', () => {
  const objects = [
    { position: [0, 0, 0] },
    { position: [4, 0, 3] },
    { position: [NaN, 0, NaN] },
    { position: ['x', 0, 2] },
    { nope: true },
  ]
  const bounds = computeTopViewBounds(objects)
  assert.deepEqual(bounds.center, [2, 1.5])
  assert.ok(Math.abs(bounds.radius - (Math.hypot(4, 3) / 2 + 2)) < 1e-9)
})

test('pickScaleBar：60–160px 区间内向下取档', () => {
  assert.deepEqual(pickScaleBar(0.01), { meters: 1, px: 100 })    // 5m/2m 超 160px → 1m=100px
  assert.deepEqual(pickScaleBar(0.03), { meters: 2, px: 67 })     // 5m=167 超 → 2m=67
  assert.deepEqual(pickScaleBar(0.04), { meters: 5, px: 125 })    // 5m=125 直达最大档
  assert.deepEqual(pickScaleBar(0.005), { meters: 0.5, px: 100 }) // 1m=200 超 → 0.5m=100
})

test('pickScaleBar：区间无法满足时退化——极度缩小取最大档、极度放大取最小档', () => {
  assert.deepEqual(pickScaleBar(0.2), { meters: 5, px: 25 })      // 5m 仅 25px（<60，无更大档）
  assert.deepEqual(pickScaleBar(0.001), { meters: 0.5, px: 500 }) // 0.5m 也 >160px（无更小档）
})

test('pickScaleBar：非法输入回退 {meters:1, px:0}（比例尺隐藏）', () => {
  for (const input of [0, -0.01, NaN, Infinity, undefined, null, 'abc']) {
    assert.deepEqual(pickScaleBar(input), { meters: 1, px: 0 }, `输入 ${String(input)} 应回退`)
  }
})

test('worldPerPixel：R3F 正交口径 = 1/zoom，非法 zoom 回退 0', () => {
  assert.equal(worldPerPixel(1), 1)
  assert.equal(worldPerPixel(100), 0.01)
  assert.equal(worldPerPixel(0.5), 2)
  assert.equal(worldPerPixel(0), 0)
  assert.equal(worldPerPixel(-5), 0)
  assert.equal(worldPerPixel(NaN), 0)
  assert.equal(worldPerPixel(Infinity), 0)
  assert.equal(worldPerPixel(undefined), 0)
})

test('worldPerPixel 与 pickScaleBar 串联：zoom 100 → 1m 档 100px', () => {
  assert.deepEqual(pickScaleBar(worldPerPixel(100)), { meters: 1, px: 100 })
})
