// 顶视符号替换的纯函数资产（T04，diagram-symbols「人物 / door / window / 家具与建筑」节 + 任务 design §3 契约）。
// 纯 ESM、无 React/three 依赖：SymbolLayer 组件与 `node --test` 单测共用。
// 朝向常量是「待校准」口径：浏览器验收（design §5 鼻向 / 门开向各 2 例）不符则只翻常量，不改画法。

// 人物面朝的本地前向（Mixamo X-Bot 约定 +Z；T04 浏览器验收「鼻向 2 例」定号，不符翻为 [0,0,-1]）。
export const PERSON_FORWARD = Object.freeze([0, 0, 1])

// 门 90° 开启弧的张开侧：+1 = 本地 -Z 侧（弧自门板线 +X 端扫向 -Z；验收「门开向 2 例」定号，不符翻 -1）。
export const DOOR_SWING_SIGN = 1

// 椅子靠背所在本地侧：+1 = +Z（源码证据：Viewport.jsx ChairModel 靠背组 position z=+0.34；
// diagram-symbols 原文写 -Z，以模型实测为准，验收复核，不符翻 -1）。
export const CHAIR_BACK_SIGN = 1

// 符号替换全集（人物/门/窗为整型替换）；墙不是类型，而是 box 的薄高子集（isThinWall 判定）。
export const SWAP_TYPES = new Set(['person', 'door', 'window'])

const THIN_WALL_MAX_THICKNESS = 0.35  // 厚 ≤ 0.35m（含）
const THIN_WALL_MIN_HEIGHT = 1.8      // 高 ≥ 1.8m（含）

// Viewport.jsx 各 Model 的基型足迹（门框 0.92 宽 / 0.16 厚；窗框 1×1 / 0.14 厚），乘对象 scale。
const DOOR_BASE = Object.freeze({ w: 0.92, d: 0.16 })
const WINDOW_BASE = Object.freeze({ w: 1, d: 0.14 })
const PERSON_FOOTPRINT = Object.freeze({ w: 0.6, d: 0.6 })  // 人物小圆足迹，忽略 scale

// scale → [sx, sy, sz] 有限数数组；缺数组 / 长度不足 / 分量非有限数 → null。
function scale3(scale) {
  if (!Array.isArray(scale) || scale.length < 3) return null
  const values = [Number(scale[0]), Number(scale[1]), Number(scale[2])]
  if (!values.every(Number.isFinite)) return null
  return values
}

// 薄高 box 判定（diagram-symbols「box」行）：厚 min(|sx|,|sz|) ≤ 0.35 且高 |sy| ≥ 1.8 → 按墙画。
// 非法输入（缺 scale / 分量非有限数）一律 false。
export function isThinWall(scale) {
  const values = scale3(scale)
  if (!values) return false
  const [sx, sy, sz] = values
  const thickness = Math.min(Math.abs(sx), Math.abs(sz))
  return thickness <= THIN_WALL_MAX_THICKNESS && Math.abs(sy) >= THIN_WALL_MIN_HEIGHT
}

// assembly parts 的 X/Z 包围盒（纯算，不加载模型）：逐 part 取 position ± 旋转 AABB 半宽。
// part 缺 position/scale 用默认值；yaw（rotationDegrees[1]）旋转的包围盒取保守外接：
// ex = |sx/2·cos| + |sz/2·sin|、ez = |sx/2·sin| + |sz/2·cos|。空 parts / 全非法 → null。
function partsBounds(parts) {
  const list = Array.isArray(parts) ? parts : []
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const part of list) {
    const position = Array.isArray(part?.position) ? part.position : [0, 0, 0]
    const scale = Array.isArray(part?.scale) ? part.scale : [1, 1, 1]
    const rotation = Array.isArray(part?.rotationDegrees) ? part.rotationDegrees : [0, 0, 0]
    const px = Number(position[0])
    const pz = Number(position[2])
    const sx = Number(scale[0])
    const sz = Number(scale[2])
    const yawDeg = Number(rotation[1])
    if (![px, pz, sx, sz, yawDeg].every(Number.isFinite)) continue
    const hx = Math.abs(sx) / 2
    const hz = Math.abs(sz) / 2
    const cos = Math.abs(Math.cos((yawDeg * Math.PI) / 180))
    const sin = Math.abs(Math.sin((yawDeg * Math.PI) / 180))
    const ex = hx * cos + hz * sin
    const ez = hx * sin + hz * cos
    minX = Math.min(minX, px - ex)
    maxX = Math.max(maxX, px + ex)
    minZ = Math.min(minZ, pz - ez)
    maxZ = Math.max(maxZ, pz + ez)
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minZ)) return null
  return { w: maxX - minX, d: maxZ - minZ }
}

// 对象足迹 { w, d }（米，本地 X/Z，未含 rotation）：
// - person → 固定 0.6×0.6（图面符号的占地圆，忽略 scale）；
// - door / window → 基型 0.92/0.16、1/0.14 乘 scale[0]/scale[2]；
// - assembly → parts 包围盒；model / depthMesh → null（真实包围盒需加载模型，组件层用 1×1 代理框）；
// - 其余类型（box/sphere/cylinder/plane/table/chair/…）→ 按 scale 的 X/Z。
// scale 非法的非人物对象 → null（组件层回退代理框）。
export function footprintOf(object) {
  if (!object || typeof object !== 'object') return null
  const type = object.type
  if (type === 'person') return { ...PERSON_FOOTPRINT }
  if (type === 'door' || type === 'window') {
    const scale = scale3(object.scale)
    if (!scale) return null
    const base = type === 'door' ? DOOR_BASE : WINDOW_BASE
    return { w: base.w * Math.abs(scale[0]), d: base.d * Math.abs(scale[2]) }
  }
  if (type === 'assembly') return partsBounds(object.parts)
  if (type === 'model' || type === 'depthMesh') return null
  const scale = scale3(object.scale)
  if (!scale) return null
  return { w: Math.abs(scale[0]), d: Math.abs(scale[2]) }
}

// rig.js RIG_PRESET_OPTIONS 全集 → 符号姿势变体（diagram-symbols「人物」节）：
// stand=标准圆、sit=朝向侧短弧、crouch=圆缩至 26px、walk=身后虚线尾迹（奔跑同款）、other=标准圆+姿势名标签。
const POSE_VARIANTS = {
  idle: 'stand', stand_relaxed: 'stand', idle_shift: 'stand', sad_pose: 'stand',
  agree: 'stand', nod_down: 'stand', nod_up: 'stand', headShake: 'stand',
  shake_left: 'stand', shake_right: 'stand', wave: 'stand', tpose: 'stand',
  crouch: 'crouch', squat_full: 'crouch',
  sit_prepare: 'sit', sit_low: 'sit', sit: 'sit',
  walk: 'walk', walk_contact_a: 'walk', walk_pass_a: 'walk', walk_contact_b: 'walk', walk_pass_b: 'walk',
  run: 'walk', run_push_a: 'walk', run_air_a: 'walk', run_push_b: 'walk', run_air_b: 'walk',
}

// 旧姿势 id → 新预设（抄录自 src/rig.js LEGACY_PRESET_MAP；单测对照 rig.js 预设全集防漂移）。
const POSE_ALIASES = {
  crouch_half: 'crouch',
  wave_raise: 'wave', wave_hold: 'wave', thumbs_up: 'idle',
  relax: 'stand_relaxed', sit: 'sit', kneel: 'crouch', stretch: 'idle', lie: 'idle', sneak_pose: 'crouch',
  fight: 'idle', punch: 'run', kick: 'run', pull: 'idle', push: 'idle', crouch: 'crouch',
  sprint: 'run', jump: 'run', jumpAir: 'run', lunge: 'idle', balance: 'idle', landing: 'idle',
  vault: 'run', handstand: 'tpose', onehand: 'tpose', roll: 'idle', crawl: 'idle',
  plank: 'tpose', hang: 'tpose', reach: 'idle', wave: 'wave', custom: 'idle',
}

// 姿势 id → 'stand' | 'sit' | 'crouch' | 'walk' | 'other'。空/缺省按 idle（站立）；
// 未识别字符串 → 'other'（标准圆 + 姿势名并入标签，由组件层处理）。
export function poseVariant(pose) {
  const raw = typeof pose === 'string' && pose ? pose : 'idle'
  const id = POSE_ALIASES[raw] || raw
  return POSE_VARIANTS[id] || 'other'
}

// 门符号几何（diagram-symbols「door」行）：门板线沿本地 X 长 w；铰链在本地 -X 端；开启弧半径 = w。
// theta 为地面形状空间口径：形状 +X = 0°，形状 +Y 经 rotateX(-90°) 映射到本地 -Z。
// DOOR_SWING_SIGN=+1 时弧自门板线（+X）张开向 -Z（thetaStart 0 → π/2）；翻 -1 则张开向 +Z（-π/2 → 0）。
// w/d 非法（非有限数 / ≤0）→ null。
export function doorHingeArc(w, d) {
  const width = Number(w)
  const depth = Number(d)
  if (!Number.isFinite(width) || !Number.isFinite(depth) || width <= 0 || depth <= 0) return null
  const swing = DOOR_SWING_SIGN >= 0 ? 1 : -1
  return {
    hinge: [-width / 2, 0],
    radius: width,
    thetaStart: swing > 0 ? 0 : -Math.PI / 2,
    thetaLength: Math.PI / 2,
  }
}
