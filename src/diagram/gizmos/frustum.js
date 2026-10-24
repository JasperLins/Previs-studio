// 机位视锥的纯函数资产（T03，diagram-symbols「机位」节 + product-spec §2）。
// 纯 ESM、无 React/three 依赖：CameraGizmo 组件、App.jsx、单测三方共用。
// 焦距→角度的唯一公式来源（审查门：组件内禁止另写 atan）。

const FULL_FRAME_HALF_WIDTH_MM = 18   // 全画幅水平半幅（36/2）
const FULL_FRAME_HALF_HEIGHT_MM = 12  // 全画幅垂直半幅（24/2）
const RAD2DEG = 180 / Math.PI

const toDeg = rad => rad * RAD2DEG

// 水平视场角（全画幅口径）：2·arctan(18/f)。f 非法（非有限数 / ≤0）→ 90 兜底。
export function horizontalFovDeg(focalLength) {
  const f = Number(focalLength)
  if (!Number.isFinite(f) || f <= 0) return 90
  return toDeg(2 * Math.atan(FULL_FRAME_HALF_WIDTH_MM / f))
}

// 垂直视场角（全画幅口径）：2·arctan(12/f)。非法同上兜底 90。
export function verticalFovDeg(focalLength) {
  const f = Number(focalLength)
  if (!Number.isFinite(f) || f <= 0) return 90
  return toDeg(2 * Math.atan(FULL_FRAME_HALF_HEIGHT_MM / f))
}

// 机位与目标点的水平（X/Z 平面）几何：无效输入（缺 position / 分量非有限数）→ null。
function planeGeometry(camera, position) {
  const cameraPosition = Array.isArray(camera?.position) ? camera.position : null
  const target = Array.isArray(position) ? position : null
  if (!cameraPosition || !target) return null
  const cx = Number(cameraPosition[0])
  const cz = Number(cameraPosition[2])
  const px = Number(target[0])
  const pz = Number(target[2])
  if (![cx, cz, px, pz].every(Number.isFinite)) return null
  const dx = px - cx
  const dz = pz - cz
  return { dx, dz, distance: Math.hypot(dx, dz) }
}

// 是否入画（v1 简化口径）：只用水平角判定——机位水平前向 = yaw（rotation[1]）旋转后的
// -Z 方向的水平投影；目标与前向夹角 ≤ hfov/2 且水平距离 > 0.1。忽略俯仰，vfovDeg 为
// v2 预留参数（当前不参与判定）。机位/目标缺 position 或分量非法 → false。
export function isInFrame(camera, position, hfovDeg, vfovDeg) {
  const plane = planeGeometry(camera, position)
  if (!plane) return false
  if (plane.distance <= 0.1) return false
  const rotation = Array.isArray(camera?.rotation) ? camera.rotation : []
  const yaw = Number.isFinite(rotation[1]) ? rotation[1] : 0
  const forwardX = -Math.sin(yaw)
  const forwardZ = -Math.cos(yaw)
  const cosAngle = (plane.dx * forwardX + plane.dz * forwardZ) / plane.distance
  const angleDeg = toDeg(Math.acos(Math.min(1, Math.max(-1, cosAngle))))
  const fov = Number(hfovDeg)
  const halfFov = (Number.isFinite(fov) && fov > 0 ? fov : 90) / 2
  return angleDeg <= halfFov
}

// 锥长（product-spec §2）：最远入画对象水平距离 + 1m；无入画对象 → 5m；下限 2m 防退化。
// hfovDeg 缺省时由 camera.focalLength 经 horizontalFovDeg 现算。
export function coneLengthMeters(camera, objects, hfovDeg, vfovDeg) {
  const list = Array.isArray(objects) ? objects : []
  const provided = Number(hfovDeg)
  const hfov = Number.isFinite(provided) && provided > 0 ? provided : horizontalFovDeg(camera?.focalLength)
  let farthest = 0
  for (const object of list) {
    if (!isInFrame(camera, object?.position, hfov, vfovDeg)) continue
    const plane = planeGeometry(camera, object.position)
    if (plane && plane.distance > farthest) farthest = plane.distance
  }
  if (farthest <= 0) return 5
  return Math.max(2, farthest + 1)
}

// 最近入画 person（type === 'person'）的对象引用；无 → null。判定用 camera 自身焦距的视场角。
export function nearestInFramePerson(camera, objects) {
  const list = Array.isArray(objects) ? objects : []
  const hfov = horizontalFovDeg(camera?.focalLength)
  let nearest = null
  let nearestDistance = Infinity
  for (const object of list) {
    if (!object || object.type !== 'person') continue
    if (!isInFrame(camera, object.position, hfov, null)) continue
    const plane = planeGeometry(camera, object.position)
    if (plane && plane.distance < nearestDistance) {
      nearestDistance = plane.distance
      nearest = object
    }
  }
  return nearest
}

// 机位字母：0 起 'A'…'Z'、26 起 'AA'…（双字母进制）。负数 / 非整数 / NaN 兜底 'A'。
export function camLetter(index) {
  let n = Number(index)
  if (!Number.isInteger(n) || n < 0) n = 0
  let result = ''
  n += 1
  while (n > 0) {
    const remainder = (n - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    n = Math.floor((n - 1) / 26)
  }
  return result
}
