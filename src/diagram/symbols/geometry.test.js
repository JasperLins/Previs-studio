// geometry.js 契约测试（T04 design §3）。Node 原生 test runner，无 DOM/three 依赖。
// pose 映射与 src/rig.js 预设全集对照（implement.md 步骤 2）：RIG_PRESET_OPTIONS import 防漂移，
// 旧姿势清单为 rig.js LEGACY_PRESET_MAP 的抄录（该表未导出，无法 import，变更时须同步这里）。

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CHAIR_BACK_SIGN,
  DOOR_SWING_SIGN,
  PERSON_FORWARD,
  SWAP_TYPES,
  doorHingeArc,
  footprintOf,
  isThinWall,
  poseVariant,
} from './geometry.js'
import { RIG_PRESET_OPTIONS } from '../../rig.js'

test('SWAP_TYPES 恰为 person/door/window（墙走 box 薄高子集判定）', () => {
  assert.equal(SWAP_TYPES.size, 3)
  for (const type of ['person', 'door', 'window']) assert.ok(SWAP_TYPES.has(type))
  assert.ok(!SWAP_TYPES.has('box'))
  assert.ok(!SWAP_TYPES.has('chair'))
})

test('isThinWall 边界：厚恰 0.35 / 高恰 1.8 均为墙；非法输入 false', () => {
  assert.equal(isThinWall([0.35, 2, 5]), true)   // 厚恰等于 0.35（≤ 含）
  assert.equal(isThinWall([5, 1.8, 0.35]), true) // 高恰等于 1.8（≥ 含），厚取 X/Z 中小者
  assert.equal(isThinWall([0.36, 2, 1]), false)
  assert.equal(isThinWall([0.3, 1.79, 1]), false)
  assert.equal(isThinWall([0.2, 1.0, 3]), false) // 不够高 → 普通 box
  assert.equal(isThinWall(undefined), false)
  assert.equal(isThinWall(null), false)
  assert.equal(isThinWall([0.2, 2, 'x']), false)
  assert.equal(isThinWall([0.2, 2]), false)
})

test('footprintOf：box/sphere/cylinder 等按 scale X/Z', () => {
  assert.deepEqual(footprintOf({ type: 'box', scale: [2, 1, 3] }), { w: 2, d: 3 })
  assert.deepEqual(footprintOf({ type: 'sphere', scale: [1, 2, 3] }), { w: 1, d: 3 })
  assert.deepEqual(footprintOf({ type: 'table', scale: [1.2, 1, 0.8] }), { w: 1.2, d: 0.8 })
})

test('footprintOf：person 固定 0.6×0.6，忽略 scale', () => {
  assert.deepEqual(footprintOf({ type: 'person', scale: [1, 1, 1] }), { w: 0.6, d: 0.6 })
  assert.deepEqual(footprintOf({ type: 'person', scale: [2, 2, 2] }), { w: 0.6, d: 0.6 })
  assert.deepEqual(footprintOf({ type: 'person' }), { w: 0.6, d: 0.6 })
})

test('footprintOf：door 0.92/0.16、window 1/0.14 基型乘 scale', () => {
  assert.deepEqual(footprintOf({ type: 'door', scale: [1, 1, 1] }), { w: 0.92, d: 0.16 })
  assert.deepEqual(footprintOf({ type: 'door', scale: [2, 1, 0.5] }), { w: 1.84, d: 0.08 })
  assert.deepEqual(footprintOf({ type: 'window', scale: [1, 1, 1] }), { w: 1, d: 0.14 })
  assert.deepEqual(footprintOf({ type: 'window', scale: [1.5, 1, 2] }), { w: 1.5, d: 0.28 })
})

test('footprintOf：assembly 取 parts 包围盒（含旋转保守外接）', () => {
  assert.deepEqual(
    footprintOf({ type: 'assembly', parts: [{ position: [0, 0, 0], scale: [2, 1, 1] }] }),
    { w: 2, d: 1 },
  )
  assert.deepEqual(
    footprintOf({
      type: 'assembly',
      parts: [
        { position: [-1, 0, 0], scale: [1, 1, 1] },
        { position: [1, 0, 0], scale: [1, 1, 2] },
      ],
    }),
    { w: 3, d: 2 },
  )
  // yaw 90°：2×1 部件旋转后 X/Z 半宽互换（三角函数留 1e-9 级浮点噪，用容差比较）
  const rotated = footprintOf({ type: 'assembly', parts: [{ position: [0, 0, 0], rotationDegrees: [0, 90, 0], scale: [2, 1, 1] }] })
  assert.ok(Math.abs(rotated.w - 1) < 1e-9, `w 实得 ${rotated.w}`)
  assert.ok(Math.abs(rotated.d - 2) < 1e-9, `d 实得 ${rotated.d}`)
})

test('footprintOf：model/depthMesh/缺 scale/空 assembly → null（组件层代理框）', () => {
  assert.equal(footprintOf({ type: 'model', url: 'x.glb', scale: [1, 1, 1] }), null)
  assert.equal(footprintOf({ type: 'depthMesh', scale: [1, 1, 1] }), null)
  assert.equal(footprintOf({ type: 'assembly', parts: [] }), null)
  assert.equal(footprintOf({ type: 'box' }), null)
  assert.equal(footprintOf(null), null)
  assert.equal(footprintOf('junk'), null)
})

test('poseVariant：RIG_PRESET_OPTIONS 全集逐 id 映射到四变体且无 other', () => {
  const known = new Set(['stand', 'sit', 'crouch', 'walk'])
  const seen = new Set()
  for (const [id] of RIG_PRESET_OPTIONS) {
    const variant = poseVariant(id)
    assert.ok(known.has(variant), `预设 ${id} 应映射四变体之一，实得 ${variant}`)
    assert.notEqual(variant, 'other')
    seen.add(variant)
  }
  // 四个变体都被至少一个预设覆盖（含蹲/坐/行走各自的代表）
  for (const variant of known) assert.ok(seen.has(variant), `变体 ${variant} 无预设覆盖`)
  assert.equal(poseVariant('sit'), 'sit')
  assert.equal(poseVariant('crouch'), 'crouch')
  assert.equal(poseVariant('squat_full'), 'crouch')
  assert.equal(poseVariant('walk_contact_a'), 'walk')
  assert.equal(poseVariant('run_air_b'), 'walk')
  assert.equal(poseVariant('idle'), 'stand')
  assert.equal(poseVariant('tpose'), 'stand')
})

// 抄录自 src/rig.js LEGACY_PRESET_MAP（该表未导出）：旧 id 的变体须与新预设等价。
const LEGACY_POSE_IDS = [
  'crouch_half', 'wave_raise', 'wave_hold', 'thumbs_up', 'relax', 'sit', 'kneel', 'stretch',
  'lie', 'sneak_pose', 'fight', 'punch', 'kick', 'pull', 'push', 'crouch', 'sprint', 'jump',
  'jumpAir', 'lunge', 'balance', 'landing', 'vault', 'handstand', 'onehand', 'roll', 'crawl',
  'plank', 'hang', 'reach', 'wave', 'custom',
]

test('poseVariant：旧姿势 id 不落入 other（与 rig.js 归一化语义一致）', () => {
  for (const id of LEGACY_POSE_IDS) {
    assert.notEqual(poseVariant(id), 'other', `旧姿势 ${id} 不应落入 other`)
  }
  assert.equal(poseVariant('kneel'), 'crouch')
  assert.equal(poseVariant('sprint'), 'walk')
  assert.equal(poseVariant('handstand'), 'stand')
})

test('poseVariant：未识别字符串 other，空值按站立', () => {
  assert.equal(poseVariant('backflip99'), 'other')
  assert.equal(poseVariant(''), 'stand')
  assert.equal(poseVariant(undefined), 'stand')
  assert.equal(poseVariant(null), 'stand')
})

test('doorHingeArc：铰链 -X 端、半径 = 足迹宽、90° 弧', () => {
  const arc = doorHingeArc(0.92, 0.16)
  assert.deepEqual(arc.hinge, [-0.46, 0])
  assert.equal(arc.radius, 0.92)
  assert.equal(arc.thetaLength, Math.PI / 2)
  // 张开侧由 DOOR_SWING_SIGN 决定：+1 自 +X 扫向 -Z（thetaStart 0），-1 自 -Z 扫回（thetaStart -π/2）
  assert.equal(arc.thetaStart, DOOR_SWING_SIGN >= 0 ? 0 : -Math.PI / 2)
})

test('doorHingeArc：非法输入 null', () => {
  assert.equal(doorHingeArc(0, 0.16), null)
  assert.equal(doorHingeArc(-1, 0.16), null)
  assert.equal(doorHingeArc(0.92, 0), null)
  assert.equal(doorHingeArc(NaN, 0.16), null)
  assert.equal(doorHingeArc('wide', 0.16), null)
  assert.equal(doorHingeArc(undefined, undefined), null)
})

test('朝向常量形态（校准闭环的翻改点）', () => {
  assert.deepEqual(PERSON_FORWARD, [0, 0, 1])
  assert.ok(Object.isFrozen(PERSON_FORWARD))
  assert.ok(DOOR_SWING_SIGN === 1 || DOOR_SWING_SIGN === -1)
  assert.ok(CHAIR_BACK_SIGN === 1 || CHAIR_BACK_SIGN === -1)
})
