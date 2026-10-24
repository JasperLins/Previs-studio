// prompt-compiler.md §4 十用例 + 基元 + 确定性。全部纯 node --test。
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { horizontalTier, depthTier, orientationTier, shotSizeTier, distanceWording } from './mapping.js'
import { cameraBasis, projectPoint, sensorHalfAngles, orientationAngleDeg, parseAspect } from './projection.js'
import { compileShot, inferShotSize } from './compile.js'

// ===== 基线场景（§4：房间——前台在北、左墙两窗、门在南侧中、桌椅在东；奶奶西北、男主西侧中部）=====
const person = (id, name, x, z, yaw, poseLabel = '站立') => ({
  id, name, type: 'person', position: [x, 0, z], rotation: [0, yaw, 0], scale: [1, 1.7, 1], poseLabel,
})
const prop = (id, name, x, z, sy = 1) => ({
  id, name, type: 'box', position: [x, 0, z], rotation: [0, 0, 0], scale: [1, sy, 1],
})
const baseline = () => ([
  prop('desk', '前台', 0, -3, 1.1),
  prop('win1', '窗·北', -3.2, -1),
  prop('win2', '窗·南', -3.2, 1),
  prop('door', '门', 0, 3, 2.1),
  prop('table', '桌', 2.6, 0.4),
  prop('chair', '椅', 2.6, 1.6),
  person('lead', '男主', -0.8, 0.2, -Math.PI / 2, '行走'),   // 面朝东（镜头侧）
  person('granny', '奶奶', -1.2, -2.4, Math.PI, '站立'),      // 面朝南
])
const camAtDoor = { position: [0, 1.6, 3], rotation: [0, 0, 0], focalLength: 42, aspectRatio: '16:9' }
const camEastOfLead = { position: [9, 1.6, 0.2], rotation: [0, Math.PI / 2, 0], focalLength: 42, aspectRatio: '16:9' }

// ===== 基元 =====
test('mapping：横向 9 档边界', () => {
  assert.equal(horizontalTier(-0.2).key, 'out-left')
  assert.equal(horizontalTier(0).key, 'left-edge')
  assert.equal(horizontalTier(0.08).key, 'left-edge')
  assert.equal(horizontalTier(0.09).key, 'left')
  assert.equal(horizontalTier(0.5).key, 'center')
  assert.equal(horizontalTier(0.93).key, 'right-edge')
  assert.equal(horizontalTier(1.2).key, 'out-right')
})
test('mapping：景深/朝向/景别档位与距离措辞', () => {
  assert.equal(depthTier(2, 10).key, 'foreground')
  assert.equal(depthTier(10, 10).key, 'midground')
  assert.equal(depthTier(15, 10).key, 'background')
  assert.equal(orientationTier(20).label, '正面')
  assert.equal(orientationTier(45).label, '四分之三侧面')
  assert.equal(orientationTier(90).label, '侧面')
  assert.equal(orientationTier(140).label, '四分之三背面')
  assert.equal(orientationTier(170).label, '背面')
  assert.equal(shotSizeTier(0.9).label, '特写')
  assert.equal(shotSizeTier(0.6).label, '近景')
  assert.equal(shotSizeTier(0.35).label, '中近景')
  assert.equal(shotSizeTier(0.2).label, '中景')
  assert.equal(shotSizeTier(0.1).label, '全景')
  assert.equal(shotSizeTier(0.05).label, '远景')
  assert.equal(distanceWording(2.63), '约 2.6 米')
})
test('projection：正北相机基与已知点投影', () => {
  const basis = cameraBasis(camAtDoor)
  assert.ok(basis.forward.every((v, i) => Math.abs(v - [0, 0, -1][i]) < 1e-9))
  assert.ok(basis.right.every((v, i) => Math.abs(v - [1, 0, 0][i]) < 1e-9))
  const p = projectPoint(basis, camAtDoor, 42, '16:9', [0, 1.6, 0], 0, 0) // 视线等高点
  assert.equal(p.inFrame, true)
  assert.ok(Math.abs(p.screenX - 0.5) < 1e-9)
})
test('projection：画幅裁切口径（36×24，≥3:2 宽边固定 / <3:2 高边固定）', () => {
  const wide = sensorHalfAngles(42, '16:9')
  const vertical = sensorHalfAngles(42, '9:16')
  assert.ok(Math.abs(wide.halfW - 18) < 1e-9)
  assert.ok(Math.abs(wide.halfH - 18 / (16 / 9)) < 1e-9)
  assert.ok(Math.abs(vertical.halfH - 12) < 1e-9)
  assert.ok(Math.abs(vertical.halfW - 12 * (9 / 16)) < 1e-9)
  assert.equal(parseAspect('4:3'), 4 / 3)
  assert.equal(parseAspect('21:9'), 21 / 9)
})
test('projection：orientationAngleDeg 四象限', () => {
  assert.ok(Math.abs(orientationAngleDeg(0, [0, 0, 0], [0, 0, 5]) - 180) < 1e-6)  // 面北 vs 机位在南 → 背向
  assert.ok(Math.abs(orientationAngleDeg(Math.PI, [0, 0, 0], [0, 0, 5])) < 1e-6)  // 面南 vs 机位在南 → 正对
  assert.ok(Math.abs(orientationAngleDeg(-Math.PI / 2, [0, 0, 0], [5, 0, 0])) < 1e-6) // 面东 vs 机位在东
})

// ===== §4 十用例 =====
test('用例1：门口朝北拍——男主左前景侧面、奶奶中后景偏左正面、两人距离图测一致', () => {
  const r = compileShot({ objects: baseline(), camera: camAtDoor })
  assert.ok(r.layers.blocking.includes('男主'), r.layers.blocking)
  assert.ok(r.layers.blocking.includes('男主在画面左'), r.layers.blocking)
  assert.ok(/前景|中景距离/.test(r.layers.blocking), r.layers.blocking)
  assert.ok(r.layers.blocking.includes('侧面'), r.layers.blocking)
  assert.ok(r.layers.blocking.includes('奶奶'), r.layers.blocking)
  assert.ok(r.layers.blocking.includes('正面'), r.layers.blocking)
  assert.ok(r.layers.blocking.includes('约 2.6 米'), r.layers.blocking)  // |(0.4, 2.6)| = 2.63
  assert.ok(!r.layers.scene.includes('门'), '门在机后，不进场景层')
  assert.ok(r.layers.scene.includes('前台'), r.layers.scene)
})

test('用例2：机位在男主东侧正对他——男主中央正面近景', () => {
  const objects = baseline()
  const cam = { ...camEastOfLead, focalLength: 42 }
  const r = compileShot({ objects, camera: cam })
  // 深度 9.8m、42mm：h ≈ 0.72 → 近景
  assert.equal(r.meta.shotSize, '近景')
  assert.ok(r.layers.blocking.includes('男主在画面中央'), r.layers.blocking)
  assert.ok(r.layers.blocking.includes('正面'), r.layers.blocking)
  assert.ok(r.meta.subjectName === '男主')
})

test('用例3：焦距 24→85 同机位景别至少跨两档', () => {
  const objects = baseline()
  const r24 = compileShot({ objects, camera: { ...camEastOfLead, focalLength: 24 } })
  const r85 = compileShot({ objects, camera: { ...camEastOfLead, focalLength: 85 } })
  const order = ['远景', '全景', '中景', '中近景', '近景', '特写']
  const i24 = order.indexOf(r24.meta.shotSize)
  const i85 = order.indexOf(r85.meta.shotSize)
  assert.ok(i24 >= 0 && i85 >= 0, `${r24.meta.shotSize} ${r85.meta.shotSize}`)
  assert.ok(i85 - i24 >= 2, `${r24.meta.shotSize} → ${r85.meta.shotSize}`)
})

test('用例4：机位过两人轴线——一致性层侧别翻转', () => {
  const objects = baseline()
  const west = compileShot({ objects, camera: { position: [-6, 1.6, 0], rotation: [0, Math.PI / 2, 0], focalLength: 42, aspectRatio: '16:9' }, diagram: {} })
  const east = compileShot({ objects, camera: camEastOfLead, diagram: {} })
  const m = text => text.match(/轴线的([AB])侧/)
  const a = m(west.layers.consistency)
  const b = m(east.layers.consistency)
  assert.ok(a && b, `${west.layers.consistency} | ${east.layers.consistency}`)
  assert.notEqual(a[1], b[1])
  assert.ok(west.layers.consistency.includes('不越轴'))
})

test('用例5：奶奶注视门——视线句变为看向门，不再对视', () => {
  const objects = baseline()
  const diagram = { gazeTargets: { granny: { objectId: 'door' } } }
  const r = compileShot({ objects, camera: camAtDoor, diagram })
  assert.ok(r.layers.blocking.includes('奶奶看向门'), r.layers.blocking)
  assert.ok(!r.layers.blocking.includes('对视'), r.layers.blocking)
})

test('用例6：仅一名人物入画——无两人关系句', () => {
  const objects = baseline()
  // 机位贴男主、正对他、85mm：奶奶在画面外
  const r = compileShot({ objects, camera: { position: [1.2, 1.6, 0.2], rotation: [0, Math.PI / 2, 0], focalLength: 85, aspectRatio: '16:9' } })
  assert.ok(!r.layers.blocking.includes('的左侧'), r.layers.blocking)
  assert.ok(!r.layers.blocking.includes('对视'), r.layers.blocking)
  assert.ok(r.layers.blocking.includes('男主'), r.layers.blocking)
})

test('用例7：动作层留空——占位行且其余层完整', () => {
  const r = compileShot({ objects: baseline(), camera: camAtDoor })
  assert.equal(r.layers.action, '（待填写）')
  assert.ok(r.layers.framing.length > 0)
  assert.ok(r.layers.blocking.length > 0)
  assert.ok(r.layers.scene.length > 0)
})

test('用例8：9:16 竖幅复测用例1——横向落点按竖幅重算', () => {
  const wide = compileShot({ objects: baseline(), camera: camAtDoor })
  const tall = compileShot({ objects: baseline(), camera: { ...camAtDoor, aspectRatio: '9:16' } })
  // 16:9 下男主左侧入画；9:16 水平视场变窄（halfW 18→6.75）→ 男主/奶奶出画
  assert.ok(wide.layers.blocking.includes('男主在画面左'), wide.layers.blocking)
  assert.ok(!tall.layers.blocking.includes('男主在画面'), tall.layers.blocking)
  assert.ok(tall.layers.consistency.includes('男主 在画外'), tall.layers.consistency)
})

test('用例9：人物背对镜头——输出背面', () => {
  const objects = [person('solo', '路人', 0, 0, 0)] // 面北
  const cam = { position: [0, 1.6, 5], rotation: [0, 0, 0], focalLength: 42, aspectRatio: '16:9' } // 机位在南
  const r = compileShot({ objects, camera: cam })
  assert.ok(r.layers.blocking.includes('背面'), r.layers.blocking)
})

test('用例10：导入 GLB 对象入画——场景层以 name 列举不崩溃', () => {
  const objects = [...baseline(), { id: 'glb1', name: '石狮子', type: 'model', position: [1.5, 0, -1.2], rotation: [0, 0, 0], scale: [0.8, 1.0, 0.8] }]
  const r = compileShot({ objects, camera: camAtDoor })
  assert.ok(r.layers.scene.includes('石狮子'), r.layers.scene)
})

test('确定性：同输入两次编译结果完全一致', () => {
  const a = compileShot({ objects: baseline(), camera: camAtDoor, actionLine: '她转身走向门' })
  const b = compileShot({ objects: baseline(), camera: camAtDoor, actionLine: '她转身走向门' })
  assert.deepEqual(a, b)
})

test('禁止编造：出画对象不进站位层；shotSizeOverride 覆盖景别', () => {
  const r = compileShot({
    objects: baseline(),
    camera: camAtDoor,
    diagram: { shotMeta: { shotSizeOverride: '全景' } },
  })
  assert.equal(r.meta.shotSize, '全景')
  assert.ok(r.layers.framing.startsWith('全景'))
})

test('inferShotSize 与 compileShot 同源（标签牌共享）', () => {
  const objects = baseline()
  const s = inferShotSize(objects, camEastOfLead, 'lead')
  const c = compileShot({ objects, camera: camEastOfLead })
  assert.equal(s.label, c.meta.shotSize)
})

// ===== §6 运动层与生成版 =====
import { cameraMotionWord, paceWord, cameraAtFrame, subjectMotionPhrase, poseChangePhrases } from './motion.js'

test('运动规则：固定/推近/拉远/摇镜/横移跟拍/变焦', () => {
  const track = (a, b) => [
    { frame: 0, position: a.position, yaw: a.yaw, focalLength: a.focalLength ?? 42 },
    { frame: 96, position: b.position, yaw: b.yaw, focalLength: b.focalLength ?? 42 },
  ]
  const P = (x, z) => [x, 1.6, z]
  const subject = [0, 0, 0]
  assert.equal(cameraMotionWord(track({ position: P(0, 5), yaw: 0 }, { position: P(0, 5), yaw: 0 }), subject).word, '固定镜头')
  assert.equal(cameraMotionWord(track({ position: P(0, 8), yaw: 0 }, { position: P(0, 4), yaw: 0 }), subject).word, '推近')
  assert.equal(cameraMotionWord(track({ position: P(0, 4), yaw: 0 }, { position: P(0, 8), yaw: 0 }), subject).word, '拉远')
  assert.equal(cameraMotionWord(track({ position: P(0, 5), yaw: 0 }, { position: P(0, 5), yaw: 0.6 }), subject).word, '左摇')
  assert.equal(cameraMotionWord(track({ position: P(-4, 5), yaw: 0 }, { position: P(4, 5), yaw: 0 }), subject).word, '右移跟拍')
  assert.equal(cameraMotionWord(track({ position: P(0, 5), yaw: 0, focalLength: 35 }, { position: P(0, 5), yaw: 0, focalLength: 85 }), subject).word, '变焦推近')
})
test('运动规则：节奏词与帧插值', () => {
  assert.equal(paceWord([{ frame: 0 }, { frame: 24 }], 24), '迅速')
  assert.equal(paceWord([{ frame: 0 }, { frame: 120 }], 24), '缓慢')
  assert.equal(paceWord([{ frame: 0 }, { frame: 72 }], 24), '')
  const mid = cameraAtFrame([
    { frame: 0, position: [0, 1.6, 8], yaw: 0, focalLength: 42 },
    { frame: 48, position: [0, 1.6, 4], yaw: 0, focalLength: 42 },
  ], 24)
  assert.deepEqual(mid.position, [0, 1.6, 6])
})
test('运动层集成：机位推近 + 人物走位 + 时长进入卡片，生成版剔除一致性层', () => {
  const objects = baseline()
  const cameraTrack = [
    { frame: 0, position: [0, 1.6, 6], yaw: 0, focalLength: 42 },
    { frame: 96, position: [0, 1.6, 2.5], yaw: 0, focalLength: 42 },
  ]
  const objectTracks = [{ id: 'lead', name: '男主', points: [
    { frame: 0, x: -0.8, z: 0.2, poseLabel: '行走' },
    { frame: 96, x: -0.8, z: -1.8, poseLabel: '自然站立' },
  ] }]
  const r = compileShot({ objects, camera: { ...camAtDoor, position: [0, 1.6, 6] }, cameraTrack, objectTracks, fps: 24, durationSeconds: 4, actionLine: '他停下回头' })
  assert.equal(r.meta.cameraMotion, '推近')
  assert.ok(r.layers.motion.includes('推近'), r.layers.motion)
  assert.ok(r.layers.motion.includes('本镜 4 秒'), r.layers.motion)
  assert.ok(r.layers.motion.includes('男主'), r.layers.motion)
  assert.ok(r.layers.motion.includes('转为自然站立'), r.layers.motion)
  // 生成版：含动作句、不含一致性层与占位
  assert.ok(r.genText.includes('他停下回头'))
  assert.ok(!r.genText.includes('（待填写）'))
  assert.ok(!r.genText.includes('轴线'))
  // 人读全卡仍含一致性层
  assert.ok(r.text.includes(r.layers.consistency))
})
