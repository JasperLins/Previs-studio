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

// 水平前向（单位向量）：全量欧拉 [pitch, yaw, roll]（three 'XYZ'）作用到 -Z 后的水平投影。
// roll 不改变 -Z 轴向量；Rx(pitch)·Ry(yaw)·(0,0,-1) 的水平分量为 (-sin yaw, -cos yaw·cos pitch)。
// three 的四元数→欧拉分解在 |yaw|>90° 时会翻支（y 镜像、x/z 各 ±180° 表示同一旋转，
// TransformControls 旋转即走该路径），只取 rotation[1] 会随翻支镜像——所有水平朝向消费
// 一律走本函数（审查门：禁止在别处另写 -sin/-cos(rotation[1])）。俯仰 ±90° 水平前向退化 → 兜底 -Z。
export function horizontalForward(rotation) {
  const r = Array.isArray(rotation) ? rotation : []
  const pitch = Number.isFinite(r[0]) ? r[0] : 0
  const yaw = Number.isFinite(r[1]) ? r[1] : 0
  const x = -Math.sin(yaw)
  const z = -Math.cos(yaw) * Math.cos(pitch)
  const len = Math.hypot(x, z)
  if (len < 1e-9) return { x: 0, z: -1 }
  return { x: x / len, z: z / len }
}

// 水平朝向角（弧度）：符号件（CameraSymbol 系）的 yaw 入参口径——(−sin θ, −cos θ) 对准水平前向。
// 对任意欧拉支（含翻转支）都返回物理真实朝向；rotation 非法 → 0。
export function headingYawRad(rotation) {
  const forward = horizontalForward(rotation)
  return Math.atan2(-forward.x, -forward.z)
}

// 是否入画（v1 简化口径）：只用水平角判定——机位水平前向 = 全量旋转经 horizontalForward
// 的水平投影；目标与前向夹角 ≤ hfov/2 且水平距离 > 0.1。忽略俯仰，vfovDeg 为
// v2 预留参数（当前不参与判定）。机位/目标缺 position 或分量非法 → false。
export function isInFrame(camera, position, hfovDeg, vfovDeg) {
  const plane = planeGeometry(camera, position)
  if (!plane) return false
  if (plane.distance <= 0.1) return false
  const forward = horizontalForward(camera?.rotation)
  const cosAngle = (plane.dx * forward.x + plane.dz * forward.z) / plane.distance
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
