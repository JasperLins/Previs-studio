// node --test "src/diagram/**/*.test.js" 直接可跑（node 22 内置 runner，零依赖）。
// 覆盖：axisSide 四象限/共线/非法、isCrossing 翻转矩阵、pickGhostShots 同场/异场/交集边界、
// resolveAxisPair 显式/缺人降级/默认前两名、resolveGazes 目标缺失定长标记、pathPoints 排序去重、
// personOptions/targetOptions、空输入全家。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  axisSide,
  isCrossing,
  pathPoints,
  personOptions,
  pickGhostShots,
  resolveAxisPair,
  resolveGazes,
  targetOptions,
} from './data.js'

// ===== axisSide：轴线 a=(0,0)→b=(1,0)（+X 方向），四象限 + 共线 =====
test('axisSide 四象限：cross>0 → +1、cross<0 → -1（含轴向后侧象限）', () => {
  const a = { x: 0, z: 0 }
  const b = { x: 1, z: 0 }
  assert.equal(axisSide(a, b, { x: 0.5, z: 1 }), '+1')   // 轴线左前上方（+Z 侧）
  assert.equal(axisSide(a, b, { x: 0.5, z: -1 }), '-1')  // -Z 侧
  assert.equal(axisSide(a, b, { x: -2, z: 0.5 }), '+1')  // 延长线后侧仍按符号判定
  assert.equal(axisSide(a, b, { x: -2, z: -0.5 }), '-1')
  assert.equal(axisSide(a, b, { x: 3, z: 2 }), '+1')     // 前方延伸侧
  assert.equal(axisSide(a, b, { x: 3, z: -2 }), '-1')
})

test('axisSide 共线：机位在轴线（含两端延长线）或极近轴线 → 0', () => {
  const a = { x: 0, z: 0 }
  const b = { x: 1, z: 0 }
  assert.equal(axisSide(a, b, { x: 0.5, z: 0 }), '0')    // 线段中点
  assert.equal(axisSide(a, b, { x: -5, z: 0 }), '0')     // 反向延长线
  assert.equal(axisSide(a, b, { x: 9, z: 0 }), '0')      // 正向延长线
  assert.equal(axisSide(a, b, { x: 0.5, z: 1e-12 }), '0') // ε 内
  assert.equal(axisSide(a, b, { x: 0, z: 0 }), '0')      // 压在端点 a
})

test('axisSide 斜向轴线与手算一致（arctan 场景）', () => {
  // a=(0,0)→b=(1,1)：cam=(2,0) 时 cross = 1·0 - 1·2 = -2 → -1；cam=(0,2) 时 cross = 1·2 - 1·0 = 2 → +1
  const a = { x: 0, z: 0 }
  const b = { x: 1, z: 1 }
  assert.equal(axisSide(a, b, { x: 2, z: 0 }), '-1')
  assert.equal(axisSide(a, b, { x: 0, z: 2 }), '+1')
})

test('axisSide 非法输入（缺对象/分量非有限数）→ 0', () => {
  const a = { x: 0, z: 0 }
  const b = { x: 1, z: 0 }
  assert.equal(axisSide(null, b, { x: 0, z: 1 }), '0')
  assert.equal(axisSide(a, undefined, { x: 0, z: 1 }), '0')
  assert.equal(axisSide(a, b, { x: NaN, z: 1 }), '0')
  assert.equal(axisSide(a, b, { x: 0, z: Infinity }), '0')
  assert.equal(axisSide({ x: 'x', z: 0 }, b, { x: 0, z: 1 }), '0')
  assert.equal(axisSide(), '0')
})

// ===== isCrossing：翻转矩阵 =====
test('isCrossing：两侧非 0 且不同才 true', () => {
  assert.equal(isCrossing('+1', '-1'), true)
  assert.equal(isCrossing('-1', '+1'), true)
  assert.equal(isCrossing('+1', '+1'), false)
  assert.equal(isCrossing('-1', '-1'), false)
  assert.equal(isCrossing('0', '+1'), false)
  assert.equal(isCrossing('+1', '0'), false)
  assert.equal(isCrossing('0', '0'), false)
  assert.equal(isCrossing('0', '-1'), false)
})

test('isCrossing 非法输入按 0 处理 → false', () => {
  assert.equal(isCrossing(undefined, '+1'), false)
  assert.equal(isCrossing('+1', undefined), false)
  assert.equal(isCrossing('left', 'right'), false)
  assert.equal(isCrossing(), false)
})

// ===== pickGhostShots =====
const shotView = (id, objectIds, camera = { x: 1, z: 2, yaw: 0.5, focalLength: 35 }) => ({
  id,
  name: `镜头 ${id}`,
  objects: objectIds.map(objectId => ({ id: objectId })),
  camera,
})

test('pickGhostShots：同场（对象 id 有交集）的其余镜头全部入选，当前镜排除', () => {
  const shots = [
    shotView('s1', ['a', 'b', 'c']),
    shotView('s2', ['a', 'd']),        // 交集 {a} → 同场
    shotView('s3', ['x', 'y']),        // 无交集 → 异场
    shotView('s4', ['b']),             // 交集 {b} → 同场
  ]
  const ghosts = pickGhostShots(shots, 's1')
  assert.deepEqual(ghosts.map(ghost => ghost.shotId), ['s2', 's4'])
  assert.deepEqual(ghosts[0], { shotId: 's2', shotName: '镜头 s2', x: 1, z: 2, yaw: 0.5, focalLength: 35 })
})

test('pickGhostShots 交集边界：单 id 交集、当前镜对象为空 → 空结果', () => {
  assert.equal(pickGhostShots([shotView('s1', ['a']), shotView('s2', ['a'])], 's1').length, 1)
  // 当前镜 objects 为空 → 无任何交集
  assert.deepEqual(pickGhostShots([shotView('s1', []), shotView('s2', ['a'])], 's1'), [])
})

test('pickGhostShots 异场与非法：无共同对象、activeShotId 缺失/不在列表 → []', () => {
  const shots = [shotView('s1', ['a']), shotView('s2', ['z'])]
  assert.deepEqual(pickGhostShots(shots, 's1'), [])
  assert.deepEqual(pickGhostShots(shots, ''), [])
  assert.deepEqual(pickGhostShots(shots, undefined), [])
  assert.deepEqual(pickGhostShots(shots, 'sX'), [])
  assert.deepEqual(pickGhostShots(null, 's1'), [])
})

test('pickGhostShots 相机兜底：缺 x/z 跳过该 ghost；yaw/focalLength 缺省 0/42', () => {
  const shots = [
    shotView('s1', ['a']),
    shotView('s2', ['a'], { x: 3, z: 4 }),
    shotView('s3', ['a'], { x: NaN, z: 4 }),
    shotView('s4', ['a'], { x: 1, z: 2, yaw: NaN, focalLength: undefined }),
    shotView('s5', ['a'], null),
  ]
  const ghosts = pickGhostShots(shots, 's1')
  assert.deepEqual(ghosts.map(ghost => ghost.shotId), ['s2', 's4'])
  assert.deepEqual(ghosts[0], { shotId: 's2', shotName: '镜头 s2', x: 3, z: 4, yaw: 0, focalLength: 42 })
  assert.equal(ghosts[1].yaw, 0)
  assert.equal(ghosts[1].focalLength, 42)
})

// ===== resolveAxisPair =====
const person = (id, x, z, name = id) => ({ id, type: 'person', name, x, z, yaw: 0 })
const prop = (id, x, z) => ({ id, type: 'box', name: id, x, z, yaw: 0 })

test('resolveAxisPair 显式 pair：按 id 解析两人现值（含 name）', () => {
  const objects = [person('p1', 0, 0, '奶奶'), person('p2', 3, 1, '孙女'), prop('t1', 5, 5)]
  const pair = resolveAxisPair(['p2', 'p1'], objects)
  assert.deepEqual(pair.a, { id: 'p2', name: '孙女', x: 3, z: 1 })
  assert.deepEqual(pair.b, { id: 'p1', name: '奶奶', x: 0, z: 0 })
})

test('resolveAxisPair 显式 pair 人不在场 → null（不回退默认，自动降级）', () => {
  const objects = [person('p1', 0, 0), person('p2', 3, 1), person('p3', 6, 6)]
  assert.equal(resolveAxisPair(['p1', 'gone'], objects), null)
  assert.equal(resolveAxisPair(['gone', 'p2'], objects), null)
  // 同一 id 两端 → 退化线 → null
  assert.equal(resolveAxisPair(['p1', 'p1'], objects), null)
  // 坐标非法 → null
  assert.equal(resolveAxisPair(['p1', 'p2'], [person('p1', 0, 0), person('p2', NaN, 1)]), null)
})

test('resolveAxisPair null/非法输入 → 默认前两名人物（按场景序，跳过道具）', () => {
  const objects = [prop('t1', 0, 0), person('p1', 1, 1), person('p2', 2, 2), person('p3', 3, 3)]
  for (const empty of [null, undefined, 'x', [], ['only-one'], ['a', 'b', 'c'], 42]) {
    const pair = resolveAxisPair(empty, objects)
    assert.equal(pair.a.id, 'p1', `${JSON.stringify(empty)} 应默认前两名`)
    assert.equal(pair.b.id, 'p2')
  }
})

test('resolveAxisPair 人物不足两名 / 空输入 → null', () => {
  assert.equal(resolveAxisPair(null, [person('p1', 0, 0)]), null)
  assert.equal(resolveAxisPair(null, []), null)
  assert.equal(resolveAxisPair(null, undefined), null)
  assert.equal(resolveAxisPair(['p1', 'p2'], null), null)
})

// ===== resolveGazes =====
test('resolveGazes：对象目标与地面点目标解析为坐标，人物缺场跳过', () => {
  const objects = [person('p1', 0, 0, '奶奶'), person('p2', 4, 2, '孙女'), prop('door1', 1, 3)]
  const gazes = resolveGazes({ p1: { objectId: 'door1' }, p2: { point: [2.5, -1] }, ghost: { objectId: 'door1' } }, objects)
  assert.equal(gazes.length, 2)
  assert.deepEqual(gazes[0], { actorId: 'p1', actorName: '奶奶', x: 0, z: 0, yaw: 0, target: { x: 1, z: 3 } })
  assert.deepEqual(gazes[1], { actorId: 'p2', actorName: '孙女', x: 4, z: 2, yaw: 0, target: { x: 2.5, z: -1 } })
})

test('resolveGazes：目标缺场 / 非法目标 → target=null（渲染层画定长 1.2m）', () => {
  const objects = [person('p1', 0, 0, '奶奶', 1.2)]
  const gazes = resolveGazes({
    p1: { objectId: 'gone' },
  }, objects)
  assert.deepEqual(gazes[0].target, null)
  // point 非法 / 目标值整体垃圾 → 同样定长
  const more = resolveGazes({ p1: { point: [NaN, 1] }, p2: { objectId: 'gone' } }, [person('p1', 0, 0), person('p2', 1, 1)])
  assert.equal(more.length, 2)
  assert.equal(more[0].target, null)
  assert.equal(more[1].target, null)
})

test('resolveGazes：yaw 缺省 0 / 空输入 → []', () => {
  assert.deepEqual(resolveGazes({}, [person('p1', 0, 0)]), [])
  assert.deepEqual(resolveGazes(null, [person('p1', 0, 0)]), [])
  assert.deepEqual(resolveGazes({ p1: { objectId: 'p1' } }, null), [])
  assert.deepEqual(resolveGazes('junk', [person('p1', 0, 0)]), [])
})

// ===== pathPoints =====
test('pathPoints：按帧升序排序，同帧去重留后', () => {
  const points = pathPoints([
    { frame: 24, x: 3, z: 3 },
    { frame: 0, x: 0, z: 0 },
    { frame: 12, x: 1, z: 1 },
    { frame: 12, x: 2, z: 2 },   // 同帧后写覆盖
    { frame: 36, x: 4, z: 4 },
  ])
  assert.deepEqual(points, [
    { frame: 0, x: 0, z: 0 },
    { frame: 12, x: 2, z: 2 },
    { frame: 24, x: 3, z: 3 },
    { frame: 36, x: 4, z: 4 },
  ])
})

test('pathPoints：过滤非法项；空/全非法 → []（不改入参）', () => {
  const input = [
    { frame: 0, x: 0, z: 0 },
    null,
    { frame: NaN, x: 1, z: 1 },
    { frame: 5, x: Infinity, z: 1 },
    { frame: 5, x: 1 },
    'junk',
  ]
  assert.deepEqual(pathPoints(input), [{ frame: 0, x: 0, z: 0 }])
  assert.equal(input.length, 6)
  assert.deepEqual(pathPoints([]), [])
  assert.deepEqual(pathPoints(undefined), [])
  assert.deepEqual(pathPoints('junk'), [])
})

// ===== 下拉数据 =====
test('personOptions：只取 person，按场景序，name 缺省用 id', () => {
  const objects = [prop('t1', 0, 0), person('p1', 1, 1, '奶奶'), person('p2', 2, 2)]
  assert.deepEqual(personOptions(objects), [{ id: 'p1', name: '奶奶' }, { id: 'p2', name: 'p2' }])
  assert.deepEqual(personOptions([]), [])
  assert.deepEqual(personOptions(null), [])
})

test('targetOptions：全部对象（人物与道具）', () => {
  const objects = [person('p1', 0, 0, '奶奶'), prop('door1', 1, 1)]
  assert.deepEqual(targetOptions(objects), [{ id: 'p1', name: '奶奶' }, { id: 'door1', name: 'door1' }])
  assert.deepEqual(targetOptions(null), [])
})
