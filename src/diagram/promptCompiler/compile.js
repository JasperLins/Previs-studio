// 提示词编译主管线（prompt-compiler §1/§3）。纯函数：同输入同输出，禁止 Date/random/AI 润色。
//
// 输入（全部中性视图形状，App 接缝组装）：
//   compileShot({
//     objects:  [{ id, type, name, x, z, yaw, poseLabel, scale:[sx,sy,sz], position, rotation }],
//     camera:   { position:[3], rotation:[3], focalLength, aspectRatio },
//     diagram:  { gazeTargets, shotMeta }（可空）,
//     prevSummary: 上一镜一致性摘要（可空，{ sideOfAxis, subjectName, screenXOfSubject }）,
//     actionLine: 动作层草稿（可空）
//   })
// 输出 { layers: { framing, blocking, scene, action, consistency }, text, meta }
//   meta 供标签牌/测试断言：{ shotSize, subjectName, inFrameCount, projections }

import { cameraBasis, projectPoint, orientationAngleDeg, horizontalDistance } from './projection.js'
import { horizontalTier, depthTier, orientationTier, shotSizeTier, distanceWording, gazeRelation } from './mapping.js'
import { nearestLandmark, landmarkPhrase } from './landmark.js'
import { axisSide, resolveAxisPair } from '../annotations/data.js'
import { cameraAtFrame, cameraMotionWord, paceWord, subjectMotionPhrase, poseChangePhrases } from './motion.js'

const PERSON_HEIGHT = 1.7

function objectHeight(object) {
  if (object.type === 'person') return PERSON_HEIGHT
  const scale = Array.isArray(object.scale) ? object.scale : [1, 1, 1]
  const sy = Number.isFinite(scale[1]) ? scale[1] : 1
  return Math.max(0.05, sy)
}

function objectPosition(object) {
  return Array.isArray(object.position) ? object.position : [Number(object.x) || 0, 0, Number(object.z) || 0]
}

// 景别推断（共享给 T03 标签牌——同函数同值）。
export function inferShotSize(objects, camera, subjectId = null) {
  const persons = (objects || []).filter(o => o && o.type === 'person')
  const subject = (subjectId && (objects || []).find(o => o && o.id === subjectId)) || persons[0]
  if (!subject || !camera) return { key: 'unknown', label: '', subject: null }
  const basis = cameraBasis(camera)
  const p = projectPoint(basis, camera, camera.focalLength, camera.aspectRatio, objectPosition(subject), objectHeight(subject))
  return { ...shotSizeTier(p.heightRatio), subject }
}

export function compileShot(input) {
  const objects = Array.isArray(input?.objects) ? input.objects : []
  const camera = input?.camera || {}
  const diagram = input?.diagram || {}
  const prevSummary = input?.prevSummary || null
  const actionLine = typeof input?.actionLine === 'string' ? input.actionLine.trim() : ''

  const basis = cameraBasis(camera)

  // 1) 全对象投影
  const projections = objects.map(object => {
    const pos = objectPosition(object)
    const p = projectPoint(basis, camera, camera.focalLength, camera.aspectRatio, pos, objectHeight(object), 0)
    return {
      object, pos,
      inFrame: p.inFrame,
      screenX: p.screenX,
      depth: p.depth,
      heightRatio: p.heightRatio,
      outSide: p.inFrame ? null : (p.screenX === null ? 'behind' : (p.screenX < 0.5 ? 'left' : 'right')),
    }
  })

  // 2) 主体：shotMeta.subjectId 指定 → 否则最近入画人物；全出画 → 无主体（景别空）
  const meta = diagram.shotMeta || {}
  const persons = projections.filter(p => p.object.type === 'person' && p.inFrame)
  const subject = (meta.subjectId && projections.find(p => p.object.id === meta.subjectId)) || persons.slice().sort((a, b) => a.depth - b.depth)[0] || null
  const subjectDistance = subject ? subject.depth : null

  // 3) 景别（shotSizeOverride 优先）
  const override = meta.shotSizeOverride
  const shotSize = override && ['特写', '近景', '中近景', '中景', '全景', '远景'].includes(override)
    ? { key: 'override', label: override }
    : (subject ? shotSizeTier(subject.heightRatio) : { key: 'unknown', label: '' })

  // 4) 人物站位层
  const camPos = camera.position || [0, 0, 0]
  const blockingParts = []
  for (const p of persons) {
    const o = p.object
    const h = horizontalTier(p.screenX)
    const d = depthTier(p.depth, subjectDistance)
    const orient = orientationTier(orientationAngleDeg(Array.isArray(o.rotation) ? o.rotation[1] : o.yaw, objectPosition(o), camPos))
    // 地标：真实水平距离 1.5m 内最近的建筑/家具（非人物、可投影）
    const landmark = nearestLandmark(
      projections
        .filter(x => x.object.type !== 'person' && x.object.id !== o.id && Number.isFinite(x.screenX))
        .map(x => ({ name: x.object.name, screenX: x.screenX, distance: horizontalDistance(objectPosition(o), objectPosition(x.object)) })),
      o.name,
    )
    const anchor = landmarkPhrase(landmark, p.screenX)
    const pose = o.poseLabel || '站立'
    // 语句化模板（§6.5，确定性展开）：行走/奔跑类 → 正在X；其余直接用姿势词
    const poseText = /行|走|跑/.test(pose) ? `正在${pose}` : pose
    blockingParts.push(`${o.name}在画面${h.label}、${d.label ? d.label + '距离、' : ''}${orient.label || '朝向未知'}朝向镜头，${poseText}${anchor ? `，${anchor}` : ''}`)
  }

  // 5) 两人关系（取入画前两人）：相对左右、距离、视线（gazeTargets 优先，任一方有目标即按目标描述）
  let relationText = null
  if (persons.length >= 2) {
    const [a, b] = persons
    const dist = horizontalDistance(objectPosition(a.object), objectPosition(b.object))
    const leftFirst = a.screenX <= b.screenX
    const relSide = `${leftFirst ? a.object.name : b.object.name}在${leftFirst ? b.object.name : a.object.name}的左侧`
    const gazeA = diagram.gazeTargets?.[a.object.id]
    const gazeB = diagram.gazeTargets?.[b.object.id]
    let gazeText = null
    for (const [gazer, gaze] of [[a.object, gazeA], [b.object, gazeB]]) {
      if (gaze?.objectId) {
        const t = projections.find(x => x.object.id === gaze.objectId)
        if (t) { gazeText = `${gazer.name}看向${t.object.name}`; break }
      }
      if (!gazeText && gaze?.point) { gazeText = `${gazer.name}看向指定方向`; break }
    }
    if (!gazeText) {
      const angA = angleBetweenFacing(a.object, b.object)
      const angB = angleBetweenFacing(b.object, a.object)
      gazeText = gazeRelation(angA < 25 && angB < 25, angA < 25, angB < 25, a.object.name, b.object.name, false, false)
    }
    relationText = `${relSide}，相距${distanceWording(dist)}${gazeText ? '，' + gazeText : ''}`
  }

  // 6) 场景层：入画非人物按深度由近及远
  const sceneItems = projections
    .filter(p => p.inFrame && p.object.type !== 'person')
    .sort((x, y) => x.depth - y.depth)
    .map(p => p.object.name)

  // 7) 一致性层：出画提示 + 轴线侧别 + 与上一镜差异
  const outPersons = projections.filter(p => p.object.type === 'person' && !p.inFrame)
  const consistencyParts = []
  for (const p of outPersons) {
    const side = p.outSide === 'left' ? '左侧' : p.outSide === 'right' ? '右侧' : '机后'
    consistencyParts.push(`${p.object.name} 在画外${p.outSide === 'behind' ? '' : side}`)
  }
  const axis = resolveAxisPair(diagram.axisPair || null, objects.map(o => ({
    id: o?.id, type: o?.type, name: o?.name, x: objectPosition(o)[0], z: objectPosition(o)[2],
  })))
  let axisPhrase = null
  if (axis) {
    const side = axisSide(axis.a, axis.b, { x: Number(camPos[0]) || 0, z: Number(camPos[2]) || 0 })
    if (side === '+1' || side === '-1') {
      const nameOf = id => objects.find(o => o && o.id === id)?.name || id
      axisPhrase = `机位在${nameOf(axis.a.id)}与${nameOf(axis.b.id)}轴线的${side === '+1' ? 'A' : 'B'}侧，不越轴`
    }
  }
  if (prevSummary && subject) {
    if (prevSummary.subjectName && prevSummary.subjectName !== subject.object.name) consistencyParts.push(`主体由 ${prevSummary.subjectName} 换为 ${subject.object.name}`)
    if (Number.isFinite(prevSummary.screenXOfSubject) && Math.abs(prevSummary.screenXOfSubject - subject.screenX) > 0.25) consistencyParts.push('主体画面位置明显变化')
  }
  if (axisPhrase) consistencyParts.unshift(axisPhrase)

  // 8) 运动层（§6）：录制内容——机位运动 + 人物走位/动作切换 + 时长
  const cameraTrack = Array.isArray(input?.cameraTrack) ? input.cameraTrack : []
  const objectTracks = Array.isArray(input?.objectTracks) ? input.objectTracks : []
  const fps = Number(input?.fps) || 24
  const durationSeconds = Number(input?.durationSeconds) || 0
  // 推拉判定配对主体首末帧位置：主体有轨用轨点（跟拍），否则同点（静止）
  let subjectStart = subject ? [objectPosition(subject.object)[0], objectPosition(subject.object)[2]] : null
  let subjectEnd = subjectStart
  if (subject) {
    const track = objectTracks.find(t => t && t.id === subject.object.id)
    const points = Array.isArray(track?.points) ? track.points.filter(p => Number.isFinite(p.x) && Number.isFinite(p.z)) : []
    if (points.length >= 2) {
      const sorted = points.slice().sort((a, b) => a.frame - b.frame)
      subjectStart = [sorted[0].x, sorted[0].z]
      subjectEnd = [sorted[sorted.length - 1].x, sorted[sorted.length - 1].z]
    }
  }
  const motion = cameraMotionWord(cameraTrack, subjectStart, subjectEnd)
  const pace = paceWord(cameraTrack, fps)
  const motionParts = []
  motionParts.push(`${pace ? pace : ''}${motion.word}${motion.detail ? `（${motion.detail}）` : ''}`.trim())
  // 人物走位/动作切换：按轨投影（用对应帧机位插值）
  const basisOf = cam => ({ basis: cameraBasis(cam), cam })
  for (const track of objectTracks) {
    const owner = objects.find(o => o && o.id === track.id)
    if (!owner || owner.type !== 'person') continue
    const points = Array.isArray(track.points) ? track.points : []
    const projectAt = frame => {
      const cam = cameraAtFrame(cameraTrack.length ? cameraTrack : [{ frame: 0, position: camera.position, yaw: (camera.rotation || [])[1] || 0, focalLength: camera.focalLength }], frame)
      if (!cam) return null
      const { basis } = basisOf({ position: cam.position, rotation: [0, cam.yaw || 0, 0], focalLength: cam.focalLength || camera.focalLength, aspectRatio: camera.aspectRatio })
      const kf = points.filter(p => p.frame <= frame).pop() || points[0]
      if (!kf) return null
      const p = projectPoint(basis, { position: cam.position }, cam.focalLength || camera.focalLength, camera.aspectRatio, [kf.x, 0, kf.z], 1.7)
      return p.inFrame || p.screenX !== null ? p.screenX : null
    }
    const move = subjectMotionPhrase(points, fps, projectAt)
    if (move) motionParts.push(`${owner.name}${move}`)
    for (const phrase of poseChangePhrases(points, fps)) motionParts.push(`${owner.name}${phrase}`)
  }
  if (durationSeconds > 0) motionParts.push(`本镜 ${Math.round(durationSeconds)} 秒`)
  const motionLayer = motionParts.join('，')

  const layers = {
    framing: [
      shotSize.label ? `${shotSize.label}` : '景别待定',
      `${Math.round(Number(camera.focalLength) || 42)}mm`,
      `朝${subject ? subject.object.name : '场景'}拍摄`,
      `${aspectText(camera.aspectRatio)}画幅`,
    ].join('，'),
    motion: motionLayer,
    blocking: [blockingParts.join('；'), relationText].filter(Boolean).join('；') || '画面中无入画人物',
    scene: sceneItems.length ? sceneItems.join('、') : '（无入画布景）',
    action: actionLine || '（待填写）',
    consistency: consistencyParts.length ? consistencyParts.join('；') : '（无差异提示）',
  }
  const text = [
    `${layers.framing}。`,
    layers.motion ? `${layers.motion}。` : '',
    `${layers.blocking}。`,
    `${layers.scene}。`,
    layers.action,
    layers.consistency,
  ].filter(s => s && s !== '').join('\n')
  // 生成版（§6.4）：取景 + 运动 + 站位 + 场景 + 动作（剔一致性层与占位行），供直接粘贴视频提示词
  const genText = [
    `${layers.framing}。`,
    layers.motion ? `${layers.motion}。` : '',
    `${layers.blocking}。`,
    `${layers.scene}。`,
    actionLine || '',
  ].filter(s => s && s.trim() !== '').join('\n')

  return {
    layers,
    text,
    genText,
    meta: {
      shotSize: shotSize.label,
      subjectName: subject ? subject.object.name : null,
      inFrameCount: projections.filter(p => p.inFrame).length,
      subjectScreenX: subject ? subject.screenX : null,
      subjectDistance,
      cameraMotion: motion.word,
    },
  }
}

function angleBetweenFacing(person, target) {
  const yaw = Array.isArray(person.rotation) ? person.rotation[1] : person.yaw
  return orientationAngleDeg(Number(yaw) || 0, objectPosition(person), objectPosition(target))
}

function aspectText(aspectRatio) {
  const m = String(aspectRatio || '').match(/^[\d.]+[:：/][\d.]+$/)
  return m ? String(aspectRatio) : String(aspectRatio || '16:9')
}
