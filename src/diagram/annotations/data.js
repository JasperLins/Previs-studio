// 标注层（轴线/视线/路径/幽灵机位）的纯函数资产（T05，design §2 契约 + product-spec §2）。
// 纯 ESM、无 React/three 依赖：stateAdapter 组装、AnnotationLayer 渲染、单测三方共用。
// 入参全部是中性形状（objectToView 输出或其子集：{id,type,name,x,z,yaw}；
// shot 视图 = shotToView 输出：{id,name,objects:[{id}],camera:{x,z,yaw,focalLength}}）——
// 上游工程字段（关键帧轨道等）止于 stateAdapter.js，本文件禁止出现（审查门 grep）。

const SIDE_EPSILON = 1e-9 // 叉积绝对值小于该值视为共线（机位正压在轴线上）

const finite = value => Number.isFinite(value)

const finiteOr = (value, fallback) => (finite(value) ? value : fallback)

// X/Z 有限数对 → {x,z}；缺数组 / 分量非有限数 → null。
function finiteXZ(object) {
  if (!object || typeof object !== 'object') return null
  const x = Number(object.x)
  const z = Number(object.z)
  if (!finite(x) || !finite(z)) return null
  return { x, z }
}

// ===== 轴线侧别（product-spec §2：机位与轴线两端点的位置关系，叉积符号） =====
// a/b 为轴线两端 {x,z}，cam 为机位 {x,z}。以 a→b 为正方向，2D 叉积
// cross = (b.x-a.x)·(cam.z-a.z) - (b.z-a.z)·(cam.x-a.x)（(x,z) 平面按 (x,y) 口径）。
// 顶视图面（上=−Z）下 cross>0（'+1'）= 轴线屏幕下侧/右侧、cross<0（'-1'）= 上侧/左侧；
// |cross| ≤ ε 或输入非法 → '0'（共线/无法判定）。
export function axisSide(a, b, cam) {
  const pa = finiteXZ(a)
  const pb = finiteXZ(b)
  const pc = finiteXZ(cam)
  if (!pa || !pb || !pc) return '0'
  const cross = (pb.x - pa.x) * (pc.z - pa.z) - (pb.z - pa.z) * (pc.x - pa.x)
  if (cross > SIDE_EPSILON) return '+1'
  if (cross < -SIDE_EPSILON) return '-1'
  return '0'
}

// 侧别翻转判定：两侧均非 '0' 且不同 → true（跨过轴线）；任一为 '0'（共线/未知）→ false，
// 避免压线瞬间抖动。非法输入（undefined 等）按 '0' 处理 → false。
export function isCrossing(prevSide, currentSide) {
  if (prevSide !== '+1' && prevSide !== '-1') return false
  if (currentSide !== '+1' && currentSide !== '-1') return false
  return prevSide !== currentSide
}

// ===== 幽灵机位（product-spec §2：同场 = 对象 id 集合有交集） =====
// shots 为镜头视图数组（shotToView 形状），activeShotId 为当前镜 id。
// 输出其余同场镜头的中性 ghost 列表 [{shotId,shotName,x,z,yaw,focalLength}]：
// - 无 activeShotId / 找不到当前镜 → []；当前镜对象集为空 → 无同场 → []；
// - 相机缺 x/z（非有限数）的镜头跳过（无处可画）；yaw 缺省 0、focalLength 缺省 42。
export function pickGhostShots(shots, activeShotId) {
  const list = Array.isArray(shots) ? shots : []
  if (typeof activeShotId !== 'string' || !activeShotId) return []
  const active = list.find(shot => shot && shot.id === activeShotId)
  if (!active) return []
  const activeIds = new Set(
    (Array.isArray(active.objects) ? active.objects : [])
      .map(object => (object && typeof object.id === 'string' ? object.id : null))
      .filter(Boolean),
  )
  const ghosts = []
  for (const shot of list) {
    if (!shot || typeof shot !== 'object' || shot.id === activeShotId) continue
    const objects = Array.isArray(shot.objects) ? shot.objects : []
    const sameScene = objects.some(object => object && activeIds.has(object.id))
    if (!sameScene) continue
    const camera = shot.camera && typeof shot.camera === 'object' ? shot.camera : {}
    const coords = finiteXZ(camera)
    if (!coords) continue
    ghosts.push({
      shotId: shot.id,
      shotName: typeof shot.name === 'string' && shot.name ? shot.name : shot.id,
      x: coords.x,
      z: coords.z,
      yaw: finiteOr(Number(camera.yaw), 0),
      focalLength: finiteOr(Number(camera.focalLength), 42),
    })
  }
  return ghosts
}

// ===== 轴线解析（product-spec §2：axisPair 指定两人；null → 默认前两名人物） =====
// axisPairIds：diagram.axisPair（null | [idA,idB]）；objects：对象视图数组。
// 返回 {a:{id,x,z}, b:{id,x,z}} 或 null：显式 pair 任一人不在场/坐标非法 → null（自动降级）；
// null/非法输入 → 取数组序前两名 type==='person' 的对象；不足两人 → null。
export function resolveAxisPair(axisPairIds, objects) {
  const list = Array.isArray(objects) ? objects : []

  const entryOf = id => {
    const object = list.find(item => item && item.id === id)
    const coords = finiteXZ(object)
    if (!object || !coords) return null
    return { id: object.id, name: object.name || object.id, x: coords.x, z: coords.z }
  }

  if (Array.isArray(axisPairIds) && axisPairIds.length === 2 && axisPairIds.every(id => typeof id === 'string' && id)) {
    const a = entryOf(axisPairIds[0])
    const b = entryOf(axisPairIds[1])
    if (!a || !b || a.id === b.id) return null
    return { a, b }
  }

  const persons = []
  for (const object of list) {
    if (persons.length >= 2) break
    if (!object || object.type !== 'person') continue
    const coords = finiteXZ(object)
    if (!coords) continue
    persons.push({ id: object.id, name: object.name || object.id, x: coords.x, z: coords.z })
  }
  if (persons.length < 2) return null
  return { a: persons[0], b: persons[1] }
}

// ===== 视线解析（diagram-symbols「标注层符号」：无目标 = 定长 1.2m 标记） =====
// gazeTargets：diagram.gazeTargets（{actorId:{objectId}|{point:[x,z]}}）；objects：对象视图数组。
// 输出 [{actorId, actorName, x, z, yaw, target:{x,z}|null}]：target=null 表示「沿人物前向定长 1.2m」
// （前向 = yaw 旋转后的本地 +Z，同 geometry.PERSON_FORWARD 口径，由渲染层绘制）。
// 人物不在场 → 跳过该条；目标对象缺场 / point 非法 → target=null（降级为定长）。
export function resolveGazes(gazeTargets, objects) {
  const list = Array.isArray(objects) ? objects : []
  if (!gazeTargets || typeof gazeTargets !== 'object' || Array.isArray(gazeTargets)) return []
  const gazes = []
  for (const [actorId, target] of Object.entries(gazeTargets)) {
    const actor = list.find(item => item && item.id === actorId)
    const coords = finiteXZ(actor)
    if (!actor || !coords) continue
    let resolved = null
    if (target && typeof target === 'object') {
      if (typeof target.objectId === 'string' && target.objectId) {
        const targetObject = list.find(item => item && item.id === target.objectId)
        resolved = finiteXZ(targetObject)
      } else if (Array.isArray(target.point) && finite(Number(target.point[0])) && finite(Number(target.point[1]))) {
        resolved = { x: Number(target.point[0]), z: Number(target.point[1]) }
      }
    }
    gazes.push({
      actorId,
      actorName: actor.name || actorId,
      x: coords.x,
      z: coords.z,
      yaw: finiteOr(Number(actor.yaw), 0),
      target: resolved,
    })
  }
  return gazes
}

// ===== 路径点（product-spec §2：同一对象跨关键帧的位置序列） =====
// track：[{frame,x,z}]（帧序可乱、同帧可重复）。过滤非法项 → 按帧升序 → 同帧去重留后。
// 输出新数组（不改入参）；空/全非法 → []。
export function pathPoints(track) {
  const list = Array.isArray(track) ? track : []
  const valid = []
  for (const key of list) {
    if (!key || typeof key !== 'object') continue
    const frame = Number(key.frame)
    const coords = finiteXZ(key)
    if (!finite(frame) || !coords) continue
    valid.push({ frame, x: coords.x, z: coords.z })
  }
  valid.sort((left, right) => left.frame - right.frame)
  const byFrame = new Map()
  for (const point of valid) byFrame.set(point.frame, point)
  return [...byFrame.values()]
}

// ===== 图层面板的下拉数据 =====
// 人物选项（轴线两端 / 视线主体）：按场景序返回 [{id,name}]。
export function personOptions(objects) {
  const list = Array.isArray(objects) ? objects : []
  return list
    .filter(object => object && object.type === 'person')
    .map(object => ({ id: object.id, name: object.name || object.id }))
}

// 注视目标选项（对象目标全集，含人物与道具；地面点数据结构支持、点选 UI 本期不做——任务 design §4 偏离项）。
export function targetOptions(objects) {
  const list = Array.isArray(objects) ? objects : []
  return list.map(object => (object ? { id: object.id, name: object.name || object.id } : null)).filter(Boolean)
}
