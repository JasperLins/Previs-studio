// 投影计算（prompt-compiler §1 管线 1–4 步）。纯函数、无 three 依赖（node --test 可跑）。
//
// 相机基：rotation 为欧拉 [pitch, yaw, roll]（three 'XYZ' 口径，本应用 roll 恒 0）。
// forward = Rx(pitch)·Ry(yaw)·(0,0,-1) = (-sin(yaw)·cos(pitch), sin(pitch), -cos(yaw)·cos(pitch))
// right   = normalize(forward × worldUp)，upCam = right × forward。
//
// 画幅裁切（统一口径，写入单测）：全画幅传感器 36×24mm。
// aspect ≥ 3/2 → 宽边保持 36mm（halfW=18），高 = 36/aspect；
// aspect < 3/2 → 高边保持 24mm（halfH=12），宽 = 24·aspect。
// 半视场角 = atan(half / f)。

const SENSOR_HALF_W = 18
const SENSOR_HALF_H = 12
const SENSOR_ASPECT = SENSOR_HALF_W / SENSOR_HALF_H // 1.5

export function parseAspect(aspectRatio) {
  if (typeof aspectRatio === 'number' && Number.isFinite(aspectRatio) && aspectRatio > 0) return aspectRatio
  const m = String(aspectRatio || '').match(/^(\d+(?:\.\d+)?)\s*[:：/]\s*(\d+(?:\.\d+)?)$/)
  if (m) {
    const b = Number(m[2])
    return b > 0 ? Number(m[1]) / b : 16 / 9
  }
  return 16 / 9
}

export function sensorHalfAngles(focalLength, aspectRatio) {
  const f = Number(focalLength)
  const safeF = Number.isFinite(f) && f > 0 ? f : 42
  const aspect = parseAspect(aspectRatio)
  const halfW = aspect >= SENSOR_ASPECT ? SENSOR_HALF_W : SENSOR_HALF_H * aspect
  const halfH = aspect >= SENSOR_ASPECT ? SENSOR_HALF_W / aspect : SENSOR_HALF_H
  return { halfHfov: Math.atan(halfW / safeF), halfVfov: Math.atan(halfH / safeF), halfW, halfH }
}

export function cameraBasis(camera) {
  const rotation = Array.isArray(camera?.rotation) ? camera.rotation : [0, 0, 0]
  const pitch = Number.isFinite(rotation[0]) ? rotation[0] : 0
  const yaw = Number.isFinite(rotation[1]) ? rotation[1] : 0
  const cp = Math.cos(pitch)
  const forward = [-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp]
  const norm = Math.hypot(forward[0], forward[1], forward[2]) || 1
  const f = forward.map(v => v / norm)
  // right = normalize(f × worldUp) = normalize((−f.z, 0, f.x))；upCam = right × forward
  const rightRaw = [-f[2], 0, f[0]]
  const rn = Math.hypot(rightRaw[0], rightRaw[2]) || 1
  const r = [rightRaw[0] / rn, 0, rightRaw[2] / rn]
  const upCam = [
    r[1] * f[2] - r[2] * f[1],
    r[2] * f[0] - r[0] * f[2],
    r[0] * f[1] - r[1] * f[0],
  ]
  return { forward: f, right: r, up: upCam, yaw, pitch }
}

function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] }

// 投影一个世界点到相机平面。position 为被投点（Y 分量参与竖向投影）；height 为该点代表的
// 竖向高度（人物取身高，家具取包围盒高；0 表示点测）。返回 { inFrame, screenX, depth, heightRatio }。
export function projectPoint(basis, camera, focalLength, aspectRatio, position, height = 0) {
  const camPos = Array.isArray(camera?.position) ? camera.position : [0, 0, 0]
  const vx = (Number(position[0]) || 0) - (Number(camPos[0]) || 0)
  const vy = ((Number(position[1]) || 0) + height / 2) - (Number(camPos[1]) || 0)
  const vz = (Number(position[2]) || 0) - (Number(camPos[2]) || 0)
  const depth = dot([vx, vy, vz], basis.forward)
  if (depth <= 0.01) return { inFrame: false, screenX: null, depth: null, heightRatio: 0, behind: true }
  const { halfHfov, halfVfov } = sensorHalfAngles(focalLength, aspectRatio)
  const cx = dot([vx, vy, vz], basis.right)
  const cy = dot([vx, vy, vz], basis.up)
  const tanX = (cx / depth) / Math.tan(halfHfov)
  const tanY = (cy / depth) / Math.tan(halfVfov)
  let heightRatio = 0
  let verticalIn = Math.abs(tanY) <= 1
  if (height > 0) {
    const halfH = height / 2
    const tBottom = ((cy - halfH) / depth) / Math.tan(halfVfov)
    const tTop = ((cy + halfH) / depth) / Math.tan(halfVfov)
    heightRatio = Math.abs(tTop - tBottom)
    // 高对象（人物/家具）任一部分在竖向画内即算入画（近距溢出=特写仍属入画）
    verticalIn = verticalIn || Math.abs(tBottom) <= 1 || Math.abs(tTop) <= 1
  }
  return {
    inFrame: Math.abs(tanX) <= 1 && verticalIn,
    screenX: 0.5 * (1 + tanX),
    depth,
    heightRatio,
  }
}

// 人物朝向与「人物→机位」方向的水平夹角（度）。personYaw 为人物 rotation[1]。
export function orientationAngleDeg(personYaw, personPos, camPos) {
  const yaw = Number.isFinite(personYaw) ? personYaw : 0
  const pf = [-Math.sin(yaw), -Math.cos(yaw)] // 人物水平前向（与符号约定同 frustum.js）
  const dx = (Number(camPos?.[0]) || 0) - (Number(personPos?.[0]) || 0)
  const dz = (Number(camPos?.[2]) || 0) - (Number(personPos?.[2]) || 0)
  const len = Math.hypot(dx, dz)
  if (len < 1e-6) return 90
  const cos = Math.max(-1, Math.min(1, (pf[0] * dx + pf[1] * dz) / len))
  return Math.acos(cos) * 180 / Math.PI
}

export function horizontalDistance(a, b) {
  const dx = (Number(a?.[0]) || 0) - (Number(b?.[0]) || 0)
  const dz = (Number(a?.[2]) || 0) - (Number(b?.[2]) || 0)
  return Math.hypot(dx, dz)
}
