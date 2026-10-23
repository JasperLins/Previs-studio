// diagram 扩展字段的数据契约（product-spec §3 定版）。
// 纯 ESM、无 React/three 依赖：可被 App.jsx/Vite 引用，也可被 `node --test` 直接跑。
// 顶层键是封闭集合——新增字段必须先改 product-spec.md 再改这里（fork-discipline 纪律 2）。

export const DEFAULT_DIAGRAM = {
  axisPair: null,        // null | [actorIdA, actorIdB]
  gazeTargets: {},       // { actorId: {objectId} | {point:[x,z]} }
  layers: { grid: true, labels: true, frustum: true, axis: true, sight: true, paths: true, ghosts: true },
  shotMeta: {},          // { shotId: {camLetter, shotSizeOverride, subjectId} }
  promptDrafts: {},      // { shotId: {actionLine} }
}

const LAYER_KEYS = ['grid', 'labels', 'frustum', 'axis', 'sight', 'paths', 'ghosts']

const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)

// axisPair 只接受 null 或二元非空字符串数组，其余一律回退 null
function normalizeAxisPair(value) {
  if (value === null) return null
  if (Array.isArray(value) && value.length === 2 && value.every(item => typeof item === 'string' && item.length > 0)) {
    return [value[0], value[1]]
  }
  return null
}

// 单个注视目标：{objectId}（非空字符串）或 {point:[x,z]}（二元有限数），两者皆有优先 objectId；否则整键丢弃
function normalizeGazeTarget(value) {
  if (!isPlainObject(value)) return null
  if (typeof value.objectId === 'string' && value.objectId.length > 0) return { objectId: value.objectId }
  if (Array.isArray(value.point) && value.point.length === 2 && value.point.every(Number.isFinite)) {
    return { point: [value.point[0], value.point[1]] }
  }
  return null
}

function normalizeGazeTargets(value) {
  if (!isPlainObject(value)) return {}
  const result = {}
  for (const [actorId, target] of Object.entries(value)) {
    const normalized = normalizeGazeTarget(target)
    if (normalized) result[actorId] = normalized
  }
  return result
}

// 图层开关是封闭键集合：逐键合并，只接受布尔值，未知图层键忽略
function normalizeLayers(value) {
  const result = { ...DEFAULT_DIAGRAM.layers }
  if (!isPlainObject(value)) return result
  for (const key of LAYER_KEYS) {
    if (typeof value[key] === 'boolean') result[key] = value[key]
  }
  return result
}

// shotMeta.*：逐字段校验，类型不符丢弃该字段；条目本身不是对象则丢弃该 shot 键
function normalizeShotMeta(value) {
  if (!isPlainObject(value)) return {}
  const result = {}
  for (const [shotId, meta] of Object.entries(value)) {
    if (!isPlainObject(meta)) continue
    const entry = {}
    if (typeof meta.camLetter === 'string') entry.camLetter = meta.camLetter // 允许空串（表自动）
    if (meta.shotSizeOverride === null || typeof meta.shotSizeOverride === 'string') entry.shotSizeOverride = meta.shotSizeOverride
    if (typeof meta.subjectId === 'string' && meta.subjectId.length > 0) entry.subjectId = meta.subjectId
    result[shotId] = entry
  }
  return result
}

// promptDrafts.*：只保留 actionLine，非字符串一律回退空串
function normalizePromptDrafts(value) {
  if (!isPlainObject(value)) return {}
  const result = {}
  for (const [shotId, draft] of Object.entries(value)) {
    const actionLine = isPlainObject(draft) && typeof draft.actionLine === 'string' ? draft.actionLine : ''
    result[shotId] = { actionLine }
  }
  return result
}

// 合并内核：默认值打底，逐顶层键浅合并（layers 键级合并），垃圾值回退默认，未知顶层键忽略。
// 任何输入（含 undefined/null/数组）都返回带全部默认键的新对象，不与输入或 DEFAULT_DIAGRAM 共享引用。
export function normalizeDiagram(raw) {
  const result = {
    axisPair: DEFAULT_DIAGRAM.axisPair,
    gazeTargets: {},
    layers: { ...DEFAULT_DIAGRAM.layers },
    shotMeta: {},
    promptDrafts: {},
  }
  if (!isPlainObject(raw)) return result
  if ('axisPair' in raw) result.axisPair = normalizeAxisPair(raw.axisPair)
  result.gazeTargets = normalizeGazeTargets(raw.gazeTargets)
  result.layers = normalizeLayers(raw.layers)
  result.shotMeta = normalizeShotMeta(raw.shotMeta)
  result.promptDrafts = normalizePromptDrafts(raw.promptDrafts)
  return result
}

// diagram 局部补丁：浅合并顶层键 + layers 键级合并，垃圾值由 normalizeDiagram 回退。
// stateAdapter.patchDiagram（T01）与 App 顶视网格开关（T02）共用的唯一合并入口。
export function patchDiagram(prev, patch) {
  const base = prev && typeof prev === 'object' ? prev : {}
  if (!isPlainObject(patch)) return normalizeDiagram(base)
  return normalizeDiagram({
    ...base,
    ...patch,
    layers: { ...(isPlainObject(base.layers) ? base.layers : {}), ...(patch.layers || {}) },
  })
}
