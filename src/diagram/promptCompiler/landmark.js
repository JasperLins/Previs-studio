// 地标锚点（prompt-compiler §2「距离措辞」）：人物 1.5m 内（真实水平距离）最近的建筑/家具 + 方位词。
// 方位词口径：与站位措辞同以「镜头画面」为参照（人物在画面左半 = 位于地标左侧）。
// 拿不准（横向差 < 0.04 归一化单位）只说「旁」、不编方位。

const LANDMARK_RADIUS = 1.5
const AMBIGUOUS_DX = 0.04

// candidates: [{ name, screenX, distance }]（distance = 人物↔对象真实水平距离，米）
export function nearestLandmark(candidates) {
  const list = Array.isArray(candidates) ? candidates : []
  let best = null
  for (const item of list) {
    if (!item || typeof item.name !== 'string' || !item.name) continue
    if (!Number.isFinite(item.distance) || item.distance > LANDMARK_RADIUS) continue
    if (!best || item.distance < best.distance) best = item
  }
  return best
}

// 「在{地标}左侧/右侧/旁」；personScreenX 为该人物归一化横向落点。
export function landmarkPhrase(landmark, personScreenX) {
  if (!landmark) return ''
  if (!Number.isFinite(landmark.screenX) || !Number.isFinite(personScreenX)) return `在${landmark.name}旁`
  const dx = personScreenX - landmark.screenX
  if (Math.abs(dx) < AMBIGUOUS_DX) return `在${landmark.name}旁`
  return `在${landmark.name}${dx < 0 ? '左' : '右'}侧`
}
