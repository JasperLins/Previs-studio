// 顶视正交编辑视图的纯函数资产（T02，product-spec §1/§2）。
// 纯 ESM、无 React/three 依赖：组件与单测共用；方向约定唯一来源见 TOP_VIEW_UP。

// 方向约定：顶视相机 up = [0,0,-1]，即「图面上方 = 场景北 = -Z」（TopViewControls / T03 / T04 统一引用）。
export const TOP_VIEW_UP = Object.freeze([0, 0, -1])

// 顶视总开关（T04 符号替换的唯一判定来源）：顶视模式开且不在摄像机视角。
// 入参缺省 / 值为任意 truthy 表达式时按布尔语义归一。
export function isTopView({ topView = false, cameraView = false } = {}) {
  return Boolean(topView) && !cameraView
}

// 地面约束夹紧：next 只保留 X/Z 平移与水平角 yaw；Y 高度与俯仰/翻滚从已提交状态 data 原样保留。
// data 缺 position/rotation（或对应分量非有限数）时，该组字段原样放行；返回新对象，不改入参。
export function applyPlaneLock(data, next) {
  const result = { ...next }
  const sourcePosition = Array.isArray(data?.position) ? data.position : null
  if (sourcePosition && Number.isFinite(sourcePosition[1]) && Array.isArray(result.position)) {
    result.position = [...result.position]
    result.position[1] = sourcePosition[1]
  }
  const sourceRotation = Array.isArray(data?.rotation) ? data.rotation : null
  if (sourceRotation && Array.isArray(result.rotation)) {
    result.rotation = [...result.rotation]
    if (Number.isFinite(sourceRotation[0])) result.rotation[0] = sourceRotation[0]
    if (Number.isFinite(sourceRotation[2])) result.rotation[2] = sourceRotation[2]
  }
  return result
}

// 场景 X/Z 包围盒 → 顶视初始取景参数。
// 空/无效输入回退 {center:[0,0], radius:6}；radius = max(2, 对角线/2 + 2)（含余量，供初始 zoom 适配）。
export function computeTopViewBounds(objects) {
  const list = Array.isArray(objects) ? objects : []
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const object of list) {
    const position = object?.position
    if (!Array.isArray(position)) continue
    const x = Number(position[0])
    const z = Number(position[2])
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (z < minZ) minZ = z
    if (z > maxZ) maxZ = z
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minZ)) return { center: [0, 0], radius: 6 }
  const center = [(minX + maxX) / 2, (minZ + maxZ) / 2]
  const diagonal = Math.hypot(maxX - minX, maxZ - minZ)
  return { center, radius: Math.max(2, diagonal / 2 + 2) }
}

// 比例尺选档：0.5/1/2/5 m 档位，目标线长 60–160px，向下取档（理想档长 = 160px × worldPerPx 向下取档位）。
// 档位都无法 ≤160px（极度放大）时取最小档；所有档位都 <60px（极度缩小）时取最大档——均退化为可用值。
// 非法 worldPerPx（≤0 / 非有限数）回退 {meters:1, px:0}（UI 隐藏比例尺）。
const SCALE_BAR_TIERS = [5, 2, 1, 0.5]
const SCALE_BAR_MAX_PX = 160

export function pickScaleBar(worldPerPx) {
  const value = Number(worldPerPx)
  if (!Number.isFinite(value) || value <= 0) return { meters: 1, px: 0 }
  for (const meters of SCALE_BAR_TIERS) {
    const px = Math.round(meters / value)
    if (px <= SCALE_BAR_MAX_PX) return { meters, px }
  }
  const smallest = SCALE_BAR_TIERS[SCALE_BAR_TIERS.length - 1]
  return { meters: smallest, px: Math.round(smallest / value) }
}

// R3F 正交相机默认口径（left=-w/2…zoom）：1 世界单位 = zoom 像素 → 每像素世界数 = 1/zoom。
// 非法 zoom（≤0 / 非有限数）回退 0（比例尺隐藏）。
export function worldPerPixel(zoom) {
  const value = Number(zoom)
  if (!Number.isFinite(value) || value <= 0) return 0
  return 1 / value
}
