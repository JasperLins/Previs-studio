// node --test "src/diagram/**/*.test.js" 直接可跑（裸目录形式不匹配）。测试桩按上游真实形态构造（含 bodyType/poseTime/joints 等字段名），
// 以验证适配器只取所需、其余字段不被触碰——桩里的上游字段名仅作注入用途（审查门允许）。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { objectToView, cameraToView, shotToView, createStateAdapter } from './stateAdapter.js'
import { DEFAULT_DIAGRAM } from './diagramData.js'

// 上游形状的注入桩（App.jsx objects[] 的真实形态摘录）
const personStub = {
  id: 'actor-lead', name: '人物 · 主角', type: 'person', bodyType: 'standard', pose: 'walk', poseTime: 0.5,
  continuousMotion: false, joints: { mixamorigHips: [0, 0, 0] }, rigRoot: [0, 0, 0], footLock: false,
  position: [-1.25, 0, 0.3], rotation: [0, 0.25, 0], scale: [1, 1, 1], color: '#e8e3d8',
}
const boxStub = {
  id: 'block-stage', name: '平台', type: 'box',
  position: [1.4, 0.45, -0.8], rotation: [0, -0.18, 0], scale: [2.8, 0.9, 2.1], color: '#9a968c', locked: true,
}
const cameraStub = {
  position: [7.4, 4.6, 8.2], rotation: [0.1, 0.9, -0.05], focalLength: 42, aspectRatio: '16:9',
}
const shotStubs = [
  { id: 'shot-01', name: '镜头 01', objects: [personStub], camera: cameraStub, objectKeyframes: {}, keyframes: [] },
  { id: 'shot-02', name: '镜头 02', objects: [boxStub], camera: { ...cameraStub, focalLength: 85 }, objectKeyframes: {}, keyframes: [] },
  { id: 'shot-03', name: '镜头 03', objects: [], camera: cameraStub, objectKeyframes: {}, keyframes: [] },
]

function createHarness({ objects = [personStub, boxStub], camera = cameraStub, shots = shotStubs, activeShotId = 'shot-01', selectedId = 'actor-lead', diagram = DEFAULT_DIAGRAM } = {}) {
  const state = { objects, camera, shots, activeShotId, selectedId, diagram }
  const objectUpdates = []
  const diagramUpdates = []
  const adapter = createStateAdapter({
    getSnapshot: () => state,
    updateObject: (id, patch) => objectUpdates.push({ id, patch }),
    updateDiagram: updater => diagramUpdates.push(updater),
  })
  return { state, objectUpdates, diagramUpdates, adapter }
}

test('objectToView：person 映射正确（pose 保留，骨骼/相位等其余字段不进视图）', () => {
  const view = objectToView(personStub)
  assert.deepEqual(view, {
    id: 'actor-lead', type: 'person', name: '人物 · 主角', color: '#e8e3d8',
    x: -1.25, y: 0, z: 0.3, yaw: 0.25, scale: [1, 1, 1], pose: 'walk', locked: false,
  })
  assert.equal('bodyType' in view, false)
  assert.equal('joints' in view, false)
})

test('objectToView：box 映射正确（pose 为 null、locked 透传）', () => {
  const view = objectToView(boxStub)
  assert.equal(view.type, 'box')
  assert.equal(view.x, 1.4)
  assert.equal(view.y, 0.45)
  assert.equal(view.z, -0.8)
  assert.equal(view.yaw, -0.18)
  assert.deepEqual(view.scale, [2.8, 0.9, 2.1])
  assert.equal(view.pose, null)
  assert.equal(view.locked, true)
})

test('objectToView：scale 是拷贝，改视图不改上游对象', () => {
  const view = objectToView(personStub)
  view.scale[0] = 99
  assert.equal(personStub.scale[0], 1)
})

test('cameraToView：位置/水平角/焦距/画幅映射正确', () => {
  const view = cameraToView(cameraStub)
  // yaw 为全量欧拉反推的水平朝向（headingYawRad）：夹具带 0.1rad 俯仰 → 0.9 投影为 0.9024…
  assert.deepEqual(view, { x: 7.4, y: 4.6, z: 8.2, yaw: 0.9024372909980054, focalLength: 42, aspectRatio: '16:9' })
})

test('shotToView：id/name/objects/camera 齐全，objects 已是视图模型', () => {
  const view = shotToView(shotStubs[1])
  assert.equal(view.id, 'shot-02')
  assert.equal(view.name, '镜头 02')
  assert.equal(view.camera.focalLength, 85)
  assert.equal(view.objects.length, 1)
  assert.equal(view.objects[0].type, 'box')
  assert.equal('objectKeyframes' in view, false)
})

test('getScene：objects/camera/selectedId 均为视图模型', () => {
  const { adapter } = createHarness()
  const scene = adapter.getScene()
  assert.equal(scene.objects.length, 2)
  assert.equal(scene.objects[0].id, 'actor-lead')
  assert.equal(scene.objects[0].x, -1.25)
  assert.equal(scene.camera.focalLength, 42)
  assert.equal(scene.selectedId, 'actor-lead')
})

test('getActiveShot：返回 activeShotId 对应镜头', () => {
  const { adapter } = createHarness({ activeShotId: 'shot-02' })
  const active = adapter.getActiveShot()
  assert.equal(active.id, 'shot-02')
  assert.equal(active.camera.focalLength, 85)
})

test('getGhostShots：排除当前镜，其余镜头全给', () => {
  const { adapter } = createHarness({ activeShotId: 'shot-01' })
  const ghosts = adapter.getGhostShots()
  assert.deepEqual(ghosts.map(ghost => ghost.id), ['shot-02', 'shot-03'])
  const { adapter: adapter3 } = createHarness({ activeShotId: 'shot-03' })
  assert.deepEqual(adapter3.getGhostShots().map(ghost => ghost.id), ['shot-01', 'shot-02'])
})

test('setObjectPlane：只改 x/z/yaw，保留 Y 高度与俯仰/翻滚', () => {
  const { adapter, objectUpdates } = createHarness()
  adapter.setObjectPlane('block-stage', { x: 5, z: -3, yaw: Math.PI / 2 })
  assert.equal(objectUpdates.length, 1)
  const { id, patch } = objectUpdates[0]
  assert.equal(id, 'block-stage')
  assert.deepEqual(patch.position, [5, 0.45, -3], 'Y 高度 0.45 原样保留')
  assert.deepEqual(patch.rotation, [0, Math.PI / 2, 0], 'X/Z 两轴旋转原样保留，只改 yaw')
})

test('setObjectPlane：只给 x 时不产生 rotation 写入，反之亦然', () => {
  const { adapter, objectUpdates } = createHarness()
  adapter.setObjectPlane('actor-lead', { x: 2 })
  assert.deepEqual(objectUpdates[0].patch, { position: [2, 0, 0.3] })
  adapter.setObjectPlane('actor-lead', { yaw: -0.5 })
  assert.deepEqual(objectUpdates[1].patch, { rotation: [0, -0.5, 0] })
})

test('setObjectPlane：非法数值（NaN/Infinity/字符串/undefined）忽略该字段', () => {
  const { adapter, objectUpdates } = createHarness()
  adapter.setObjectPlane('actor-lead', { x: NaN, z: '2.5', yaw: Infinity })
  assert.equal(objectUpdates.length, 0, '全部非法 → 不调用 updateObject')
  adapter.setObjectPlane('actor-lead', { x: 1.5, z: Number.NaN })
  assert.deepEqual(objectUpdates[0].patch, { position: [1.5, 0, 0.3] }, 'z 非法忽略，只写 x')
})

test('setObjectPlane：对象不存在时不调用 updateObject', () => {
  const { adapter, objectUpdates } = createHarness()
  adapter.setObjectPlane('no-such-id', { x: 1 })
  assert.equal(objectUpdates.length, 0)
})

test('patchDiagram：浅合并顶层键，layers/shotMeta/promptDrafts 键级合并，其它键不动', () => {
  const diagram = {
    axisPair: ['a', 'b'],
    gazeTargets: { a: { objectId: 'x' } },
    layers: { ...DEFAULT_DIAGRAM.layers, grid: false },
    shotMeta: { s1: { camLetter: 'A' } },
    promptDrafts: { s1: { actionLine: '走' } },
  }
  const state = { objects: [personStub], camera: cameraStub, shots: shotStubs, activeShotId: 'shot-01', selectedId: 'actor-lead', diagram }
  let pendingUpdater = null
  const adapter = createStateAdapter({
    getSnapshot: () => state,
    updateObject: () => {},
    updateDiagram: updater => { pendingUpdater = updater },
  })
  adapter.patchDiagram({ layers: { axis: false }, promptDrafts: { s2: { actionLine: '入画' } } })
  state.diagram = pendingUpdater(state.diagram)
  assert.deepEqual(state.diagram.axisPair, ['a', 'b'], '未提及的顶层键不动')
  assert.deepEqual(state.diagram.gazeTargets, { a: { objectId: 'x' } }, '未提及的顶层键不动')
  assert.equal(state.diagram.layers.grid, false, 'layers 键级合并：grid 保留原值')
  assert.equal(state.diagram.layers.axis, false, 'layers 键级合并：axis 被更新')
  assert.equal(state.diagram.layers.labels, true, 'layers 键级合并：未提及键保留默认')
  assert.deepEqual(state.diagram.shotMeta, { s1: { camLetter: 'A' } }, '未提及的顶层键不动')
  assert.deepEqual(state.diagram.promptDrafts, { s1: { actionLine: '走' }, s2: { actionLine: '入画' } }, 'promptDrafts 键级合并：单镜补丁不清掉他镜草稿')
})

test('patchDiagram：空 patch / 非 object patch 不触发 updateDiagram', () => {
  const diagramUpdates = []
  const adapter = createStateAdapter({
    getSnapshot: () => ({}),
    updateObject: () => {},
    updateDiagram: updater => diagramUpdates.push(updater),
  })
  adapter.patchDiagram(undefined)
  adapter.patchDiagram(null)
  adapter.patchDiagram('layers')
  adapter.patchDiagram({})
  assert.equal(diagramUpdates.length, 1, '空对象 {} 视为有效 patch（走一次规范化），非对象一律忽略')
})

test('patchDiagram：垃圾值经 normalizeDiagram 内核回退', () => {
  let pendingUpdater = null
  const adapter = createStateAdapter({
    getSnapshot: () => ({}),
    updateObject: () => {},
    updateDiagram: updater => { pendingUpdater = updater },
  })
  adapter.patchDiagram({ axisPair: 'bad', layers: { grid: 'yes' } })
  const next = pendingUpdater(DEFAULT_DIAGRAM)
  assert.equal(next.axisPair, null)
  assert.equal(next.layers.grid, true)
})
