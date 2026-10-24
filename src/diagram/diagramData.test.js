// node --test "src/diagram/**/*.test.js" 直接可跑（node 22 内置 runner，零依赖；裸目录形式不匹配）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_DIAGRAM, normalizeDiagram, patchDiagram } from './diagramData.js'

test('DEFAULT_DIAGRAM 是规格定义的默认形态', () => {
  assert.deepEqual(DEFAULT_DIAGRAM, {
    axisPair: null,
    gazeTargets: {},
    layers: { grid: true, labels: true, frustum: true, axis: true, sight: true, paths: true, ghosts: true },
    shotMeta: {},
    promptDrafts: {},
  })
})

test('默认值深拷贝：改返回值不影响 DEFAULT_DIAGRAM 与下一次调用', () => {
  const a = normalizeDiagram(undefined)
  a.layers.grid = false
  a.gazeTargets.actor1 = { objectId: 'x' }
  a.shotMeta['shot-01'] = { camLetter: 'A' }
  a.promptDrafts['shot-01'] = { actionLine: '走' }
  a.axisPair = ['p1', 'p2']

  assert.equal(DEFAULT_DIAGRAM.layers.grid, true)
  assert.deepEqual(DEFAULT_DIAGRAM.gazeTargets, {})
  assert.deepEqual(DEFAULT_DIAGRAM.shotMeta, {})
  assert.deepEqual(DEFAULT_DIAGRAM.promptDrafts, {})
  assert.equal(DEFAULT_DIAGRAM.axisPair, null)

  const b = normalizeDiagram(undefined)
  assert.deepEqual(b, DEFAULT_DIAGRAM)
  assert.notEqual(a, b)
})

test('老工程：undefined / null / 非对象输入 → 全默认且是新对象', () => {
  for (const input of [undefined, null, 123, 'text', [], () => {}]) {
    const normalized = normalizeDiagram(input)
    assert.deepEqual(normalized, DEFAULT_DIAGRAM, `输入 ${String(input)} 应补齐默认值`)
  }
})

test('老工程：部分字段缺失 → 只补缺失键，已有合法值保留', () => {
  const normalized = normalizeDiagram({ layers: { grid: false } })
  assert.equal(normalized.layers.grid, false)
  assert.equal(normalized.layers.labels, true)
  assert.equal(normalized.layers.ghosts, true)
  assert.equal(normalized.axisPair, null)
  assert.deepEqual(normalized.gazeTargets, {})
  assert.deepEqual(normalized.shotMeta, {})
  assert.deepEqual(normalized.promptDrafts, {})
})

test('合法值原样透传（字符串/数组/点目标/图层/草稿）', () => {
  const normalized = normalizeDiagram({
    axisPair: ['actor-lead', 'actor-b'],
    gazeTargets: { actorA: { objectId: 'prop-x' }, actorB: { point: [1.5, -2] } },
    layers: { axis: false, ghosts: false },
    shotMeta: { 'shot-01': { camLetter: 'A', shotSizeOverride: '全景', subjectId: 'actor-lead' } },
    promptDrafts: { 'shot-01': { actionLine: '主角走向门口' } },
  })
  assert.deepEqual(normalized.axisPair, ['actor-lead', 'actor-b'])
  assert.deepEqual(normalized.gazeTargets.actorA, { objectId: 'prop-x' })
  assert.deepEqual(normalized.gazeTargets.actorB, { point: [1.5, -2] })
  assert.equal(normalized.layers.axis, false)
  assert.equal(normalized.layers.grid, true)
  assert.deepEqual(normalized.shotMeta['shot-01'], { camLetter: 'A', shotSizeOverride: '全景', subjectId: 'actor-lead' })
  assert.deepEqual(normalized.promptDrafts['shot-01'], { actionLine: '主角走向门口' })
})

test('非法值回退：axisPair 非「null 或二元字符串数组」→ null', () => {
  for (const bad of ['a-b', ['a'], ['a', 'b', 'c'], ['a', 2], [null, 'b'], [''], ['a', ''], 42, {}]) {
    assert.equal(normalizeDiagram({ axisPair: bad }).axisPair, null, `axisPair=${JSON.stringify(bad)} 应回退 null`)
  }
})

test('非法值回退：gazeTargets 无有效 objectId/point → 丢弃该键，其余键保留', () => {
  const normalized = normalizeDiagram({
    gazeTargets: {
      ok: { objectId: 'door-1' },
      okPoint: { point: [0, 3.5] },
      emptyObject: {},
      badObjectId: { objectId: '' },
      objectIdType: { objectId: 7 },
      badPoint: { point: [1, NaN] },
      shortPoint: { point: [1] },
      nullTarget: null,
    },
  })
  assert.deepEqual(Object.keys(normalized.gazeTargets).sort(), ['ok', 'okPoint'])
  assert.deepEqual(normalized.gazeTargets.ok, { objectId: 'door-1' })
  assert.deepEqual(normalized.gazeTargets.okPoint, { point: [0, 3.5] })
})

test('非法值回退：gazeTargets 同时给 objectId 与 point 时优先 objectId', () => {
  const normalized = normalizeDiagram({ gazeTargets: { a: { objectId: 'x', point: [1, 2] } } })
  assert.deepEqual(normalized.gazeTargets.a, { objectId: 'x' })
})

test('非法值回退：layers 非对象 → 全默认；非布尔值忽略；未知图层键忽略', () => {
  assert.deepEqual(normalizeDiagram({ layers: 'all' }).layers, DEFAULT_DIAGRAM.layers)
  assert.deepEqual(normalizeDiagram({ layers: null }).layers, DEFAULT_DIAGRAM.layers)
  const normalized = normalizeDiagram({ layers: { grid: 0, frustum: 'no', paths: false, hologram: true } })
  assert.equal(normalized.layers.grid, true, '非布尔值回默认')
  assert.equal(normalized.layers.frustum, true, '非布尔值回默认')
  assert.equal(normalized.layers.paths, false)
  assert.equal('hologram' in normalized.layers, false, '未知图层键忽略')
})

test('非法值回退：shotMeta 逐字段丢弃，条目非对象丢弃整键', () => {
  const normalized = normalizeDiagram({
    shotMeta: {
      'shot-01': { camLetter: 9, shotSizeOverride: '近景', subjectId: '' },
      'shot-02': { camLetter: '' },
      'shot-03': 42,
      'shot-04': null,
    },
  })
  assert.deepEqual(normalized.shotMeta['shot-01'], { shotSizeOverride: '近景' }, 'camLetter 非字符串丢弃、subjectId 空串丢弃')
  assert.deepEqual(normalized.shotMeta['shot-02'], { camLetter: '' }, 'camLetter 允许空串（表自动）')
  assert.equal('shot-03' in normalized.shotMeta, false, '条目非对象 → 丢弃整键')
  assert.equal('shot-04' in normalized.shotMeta, false, '条目 null → 丢弃整键')
})

test('非法值回退：shotMeta.shotSizeOverride 只接受 null 或字符串', () => {
  const normalized = normalizeDiagram({ shotMeta: { a: { shotSizeOverride: 3 }, b: { shotSizeOverride: null }, c: { shotSizeOverride: '特写' } } })
  assert.deepEqual(normalized.shotMeta.a, {})
  assert.deepEqual(normalized.shotMeta.b, { shotSizeOverride: null })
  assert.deepEqual(normalized.shotMeta.c, { shotSizeOverride: '特写' })
})

test('非法值回退：promptDrafts.actionLine 非字符串 → 空串；条目非对象 → 空串', () => {
  const normalized = normalizeDiagram({
    promptDrafts: { 'shot-01': { actionLine: '入画' }, 'shot-02': { actionLine: 7 }, 'shot-03': 'walk-in' },
  })
  assert.deepEqual(normalized.promptDrafts['shot-01'], { actionLine: '入画' })
  assert.deepEqual(normalized.promptDrafts['shot-02'], { actionLine: '' })
  assert.deepEqual(normalized.promptDrafts['shot-03'], { actionLine: '' })
})

test('未知顶层键忽略（封闭字段集合）', () => {
  const normalized = normalizeDiagram({
    axisPair: null,
    extraFeature: { on: true },
    version: 99,
    ghostCameras: [],
  })
  assert.deepEqual(Object.keys(normalized).sort(), ['axisPair', 'gazeTargets', 'layers', 'promptDrafts', 'shotMeta'])
})

test('幂等：normalizeDiagram(normalizeDiagram(x)) 稳定', () => {
  const raw = { axisPair: ['a', 'b'], layers: { grid: false }, shotMeta: { s: { camLetter: 'B' } } }
  const once = normalizeDiagram(raw)
  const twice = normalizeDiagram(once)
  assert.deepEqual(twice, once)
})

test('不与输入共享引用（写入结果不影响 raw）', () => {
  const raw = { gazeTargets: { a: { point: [1, 2] } }, layers: { grid: false } }
  const normalized = normalizeDiagram(raw)
  normalized.gazeTargets.a.point[0] = 99
  normalized.layers.grid = true
  assert.equal(raw.gazeTargets.a.point[0], 1)
  assert.equal(raw.layers.grid, false)
})

test('patchDiagram：layers/shotMeta/promptDrafts 键级合并（未提键保留），其余顶层键浅合并', () => {
  const prev = normalizeDiagram({ layers: { grid: false } })
  const next = patchDiagram(prev, { layers: { ghosts: false } })
  assert.equal(next.layers.grid, false)
  assert.equal(next.layers.ghosts, false)
  assert.equal(next.layers.labels, true)
  assert.deepEqual(next.axisPair, null)
  assert.notEqual(next, prev)
  assert.notEqual(next.layers, prev.layers)
})

test('patchDiagram：promptDrafts 单镜补丁不清掉他镜草稿（机位词面板逐字写入路径）', () => {
  const prev = normalizeDiagram({ promptDrafts: { 'shot-01': { actionLine: '走向门口' } } })
  const next = patchDiagram(prev, { promptDrafts: { 'shot-02': { actionLine: '转身' } } })
  assert.deepEqual(next.promptDrafts['shot-01'], { actionLine: '走向门口' }, '他镜草稿必须保留')
  assert.deepEqual(next.promptDrafts['shot-02'], { actionLine: '转身' })
  // 同镜覆写生效
  const again = patchDiagram(next, { promptDrafts: { 'shot-02': { actionLine: '转身停留' } } })
  assert.deepEqual(again.promptDrafts['shot-02'], { actionLine: '转身停留' })
})

test('patchDiagram：shotMeta 单镜补丁键级合并', () => {
  const prev = normalizeDiagram({ shotMeta: { 'shot-01': { camLetter: 'A' } } })
  const next = patchDiagram(prev, { shotMeta: { 'shot-02': { shotSizeOverride: '全景' } } })
  assert.deepEqual(next.shotMeta['shot-01'], { camLetter: 'A' })
  assert.deepEqual(next.shotMeta['shot-02'], { shotSizeOverride: '全景' })
})

test('patchDiagram：prev 非法时按默认打底，patch 非法时回退 prev 的规范化形态', () => {
  const fromNothing = patchDiagram(null, { layers: { grid: false } })
  assert.equal(fromNothing.layers.grid, false)
  assert.deepEqual(fromNothing.axisPair, DEFAULT_DIAGRAM.axisPair)
  const noop = patchDiagram(undefined, undefined)
  assert.deepEqual(noop, DEFAULT_DIAGRAM)
  const kept = patchDiagram({ layers: { grid: false } }, 'garbage')
  assert.equal(kept.layers.grid, false)
})
