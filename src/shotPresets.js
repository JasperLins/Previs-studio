// 「添加机位」预设（任务 10-24-shot-camera-presets）：纯函数模块，无 React / three 依赖。
// node --test src/shotPresets.test.js 直接可跑。
// 参数表与机位公式以任务 design.md 为唯一权威；朝向公式与 App.jsx cameraRotationToward 同语义。
//
// 参数语义（全部相对物体）：
// - azimuth：绕物体朝向（rotation.y）的水平偏角，0 = 物体正前方（朝向 +Z 旋转后的方向）
// - framing：取景留白系数，越小越近（1 ≈ 表观高恰好撑满垂直视场；表观高 = height·cos|pitch| + 体厚·sin|pitch|）
// - focal：焦距 mm（clamp 18–120，与 normalizeCamera 一致）
// - eye：相机高度系数（非 null 时 cameraY = center.y + (eye − 0.5) × 身高，水平距 = 取景距离；pitch 仅作文档语义）
// - pitch：eye 为 null（俯拍类）时取景距离为沿视线斜距：水平距 = d·cos(pitch)，cameraY = center.y + d·sin(pitch)
// - roll：绕视线滚转，写入 rotation[2]（荷兰角）
// - shoulder：过肩横向偏移系数（× 物体宽），相机沿右向平移、目标点沿前向偏移 0.8 × 身高

// 体型身高系数（与 Viewport.jsx PersonModel proportions.height 同表：tall 1.14 / broad 1.03 / female 0.98 / male 1.06 / 其余 1）
const BODY_HEIGHT_FACTORS = { tall: 1.14, broad: 1.03, female: 0.98, male: 1.06 }
const PERSON_BASE_HEIGHT = 1.8 // 基准身高（米）
const PERSON_BASE_WIDTH = 0.55 // 基准肩宽（米）
const PERSON_BASE_DEPTH = 0.3 // 基准体厚（米，俯视平面轮廓的短边）
const FOCAL_MIN = 18
const FOCAL_MAX = 120
const FRAMING_ASPECT = 16 / 9 // 水平取景复核基准画幅
const MIN_CAMERA_Y = 0.05 // 相机不钻地

export const SHOT_CAMERA_PRESETS = [
  { id: 'current', label: '当前视角', hint: '沿用当前摄像机' },
  { id: 'front_close', label: '正面特写', hint: '物体正前方 · 近景特写', azimuth: 0, pitch: 0.08, framing: 0.62, focal: 50, eye: 0.72 },
  { id: 'front_medium', label: '正面中景', hint: '物体正前方 · 中景', azimuth: 0, pitch: 0.10, framing: 1.15, focal: 42, eye: 0.62 },
  { id: 'front_full', label: '正面全景', hint: '物体正前方 · 全景', azimuth: 0, pitch: 0.16, framing: 2.20, focal: 35, eye: 0.55 },
  { id: 'side_track', label: '侧面跟拍', hint: '物体正侧方 · 跟拍景别', azimuth: Math.PI / 2, pitch: 0.06, framing: 1.10, focal: 42, eye: 0.62 },
  { id: 'side_close', label: '侧面近景', hint: '物体正侧方 · 近景', azimuth: Math.PI / 2, pitch: 0.08, framing: 0.68, focal: 50, eye: 0.72 },
  { id: 'back_medium', label: '背面中景', hint: '物体正后方 · 中景', azimuth: Math.PI, pitch: 0.10, framing: 1.15, focal: 42, eye: 0.62 },
  { id: 'high_45', label: '45°俯拍', hint: '前方 45° 俯角俯拍', azimuth: Math.PI / 4, pitch: 0.785, framing: 1.35, focal: 42, eye: null },
  { id: 'top_down', label: '俯拍全景', hint: '高角度俯拍 · 全景', azimuth: Math.PI / 4, pitch: 1.35, framing: 2.0, focal: 35, eye: null },
  { id: 'birdseye', label: '鸟瞰', hint: '近垂直向下 · 鸟瞰', azimuth: 0, pitch: 1.52, framing: 3.2, focal: 28, eye: null },
  { id: 'low_angle', label: '低角度仰拍', hint: '低机位仰拍', azimuth: Math.PI * 0.08, pitch: -0.30, framing: 1.05, focal: 32, eye: 0.18 },
  { id: 'low_wide', label: '低角度广角', hint: '低机位仰拍 · 广角夸张', azimuth: Math.PI * 0.16, pitch: -0.42, framing: 1.35, focal: 20, eye: 0.10 },
  { id: 'dutch', label: '荷兰角', hint: '前侧方 · 画面倾斜', azimuth: Math.PI * 0.12, pitch: 0.06, framing: 1.10, focal: 40, eye: 0.62, roll: 0.22 },
  { id: 'over_shoulder', label: '过肩镜头', hint: '越过左肩看向前方', azimuth: Math.PI * 0.82, pitch: 0.02, framing: 1.45, focal: 42, eye: 0.92, shoulder: -0.45 },
  { id: 'over_shoulder_right', label: '过肩镜头（右）', hint: '越过右肩看向前方', azimuth: Math.PI * 0.18, pitch: 0.02, framing: 1.45, focal: 42, eye: 0.92, shoulder: 0.45 },
]

// 与 App.jsx rotateVectorXYZ 同语义的欧拉旋转（XYZ 序：先 X、再 Y、后 Z 作用）
function rotateVectorXYZ(vector, rotation = [0, 0, 0]) {
  let [x, y, z] = vector
  const [rx, ry, rz] = rotation
  const cosX = Math.cos(rx); const sinX = Math.sin(rx)
  const cosY = Math.cos(ry); const sinY = Math.sin(ry)
  const cosZ = Math.cos(rz); const sinZ = Math.sin(rz)
  ;[y, z] = [y * cosX - z * sinX, y * sinX + z * cosX]
  ;[x, z] = [x * cosY + z * sinY, -x * sinY + z * cosY]
  ;[x, y] = [x * cosZ - y * sinZ, x * sinZ + y * cosZ]
  return [x, y, z]
}

// 与 App.jsx cameraRotationToward 同语义：相机看向 target 的 rotation（不含 fallback；
// 视线方向归一化后 [asin(dy), atan2(-dx, -dz), 0]）
function cameraRotationBetween(position, target) {
  let dx = target[0] - position[0]
  let dy = target[1] - position[1]
  let dz = target[2] - position[2]
  const length = Math.hypot(dx, dy, dz)
  if (length < 1e-8) return [0, 0, 0]
  dx /= length; dy /= length; dz /= length
  return [Math.asin(Math.min(1, Math.max(-1, dy))), Math.atan2(-dx, -dz), 0]
}

// 物体的取景包围：{ center:[x,y,z], height, width, depth, yaw }
// - person：身高 = 1.8 × 体型系数 × scale[1]；宽 = 0.55 × scale[0]；center = position +
//   rotate([rigRoot.x×scaleX, rigRoot.y×scaleY + height/2, rigRoot.z×scaleZ])（身高中点）
// - 其他（几何体，scale 即米制包围尺寸）：height/width/depth = scale 三轴；
//   center = position + rotate([0, height/2, 0])（position 为几何中心）
// - yaw = rotation[1]；「前方」= yaw 旋转后的 +Z
export function objectFramingBounds(object) {
  const position = object?.position || [0, 0, 0]
  const scale = object?.scale || [1, 1, 1]
  const rotation = object?.rotation || [0, 0, 0]
  const yaw = rotation[1] || 0
  if (object?.type === 'person') {
    const factor = BODY_HEIGHT_FACTORS[object.bodyType] || 1
    const height = PERSON_BASE_HEIGHT * factor * scale[1]
    const width = PERSON_BASE_WIDTH * scale[0]
    const depth = PERSON_BASE_DEPTH * scale[2]
    const root = object.rigRoot || [0, 0, 0]
    const localCenter = [root[0] * scale[0], root[1] * scale[1] + height / 2, root[2] * scale[2]]
    const offset = rotateVectorXYZ(localCenter, rotation)
    return { center: position.map((value, index) => value + offset[index]), height, width, depth, yaw }
  }
  const height = scale[1]
  const width = scale[0]
  const depth = scale[2]
  const offset = rotateVectorXYZ([0, height / 2, 0], rotation)
  return { center: position.map((value, index) => value + offset[index]), height, width, depth, yaw }
}

// 按预设对物体计算机位 → { position:[x,y,z], rotation:[rx,ry,rz], focalLength }
// current / 未知预设 / 物体缺失 → null（表示沿用 currentCamera）。
// aspectRatio 不在返回值中，App 侧保持当前镜头值；只读 object，不产生副作用。
export function presetCameraForObject(presetId, object, currentCamera) {
  const preset = SHOT_CAMERA_PRESETS.find(option => option.id === presetId)
  if (!preset || presetId === 'current' || !object) return null
  const { center, height, width, depth, yaw } = objectFramingBounds(object)
  const focalLength = Math.min(FOCAL_MAX, Math.max(FOCAL_MIN, preset.focal))
  // 垂直视场（全画幅 24mm 高对应 three.js 垂直 fov 口径）：fovV = 2·atan(12/focal)
  const tanHalfFovV = 12 / focalLength
  // 表观高度：俯角 θ 越大，物体身高轴越贴近视线方向，画面里的竖向占幅是
  // height·cosθ + 体厚·sinθ（近垂直俯视只看到平面轮廓），按它预留画面才不缩成小点
  const theta = Math.abs(preset.pitch || 0)
  const apparentHeight = height * Math.cos(theta) + depth * Math.sin(theta)
  // 垂直取景距离（半表观高入画 × 留白）与水平复核（16:9、半宽入画，宽物体不出画）取大
  const verticalDistance = (apparentHeight / 2) / tanHalfFovV * preset.framing
  const horizontalCheck = (width / 2) / (tanHalfFovV * FRAMING_ASPECT) * preset.framing
  const distance = Math.max(verticalDistance, horizontalCheck)
  // 水平方位：yaw + azimuth 那一侧的反向看向（0 = 物体正前方 +Z 侧）
  const bearing = yaw + (preset.azimuth || 0)
  const dir = [Math.sin(bearing), 0, Math.cos(bearing)]
  const fwd = [Math.sin(yaw), 0, Math.cos(yaw)]
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)]
  // 取景距离是沿视线的斜距：eye 类 Δy 小、水平距≈斜距；俯拍类按 pitch 分解，构图不随俯角缩水
  const horizontalDistance = preset.eye != null
    ? distance
    : distance * Math.cos(preset.pitch || 0)
  const eyeHeight = preset.eye != null
    ? center[1] + (preset.eye - 0.5) * height
    : center[1] + distance * Math.sin(preset.pitch || 0)
  const position = [
    center[0] + dir[0] * horizontalDistance,
    Math.max(eyeHeight, MIN_CAMERA_Y),
    center[2] + dir[2] * horizontalDistance,
  ]
  const target = [...center]
  if (preset.shoulder != null) {
    // 过肩：位置沿右向平移出肩部，目标点沿前向偏移（越过肩看向前方）
    position[0] += right[0] * preset.shoulder * width
    position[2] += right[2] * preset.shoulder * width
    target[0] += fwd[0] * 0.8 * height
    target[2] += fwd[2] * 0.8 * height
  }
  const rotation = cameraRotationBetween(position, target)
  if (preset.roll != null) rotation[2] = preset.roll
  return { position, rotation, focalLength }
}
