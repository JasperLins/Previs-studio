// 标注层（T05，design §3 + diagram-symbols「标注层符号」节 + product-spec §2）。
// 经接缝 S3 挂载于 EditorScene：!cameraView 且传入 annotations 时渲染（顶视与 3D 编辑视图通用；
// 摄像机视角的监看画面不叠标注）。只读组件：零写状态，onSelect 不存在——点选一律走既有对象层。
// 数据为 App 侧经 stateAdapter.buildAnnotations 组装的中性 annotationData（上游形状止于适配层）。
// 画法沿用 T03/T04 实测结论：禁 drei Line/Html——线用细长盒拼装（虚线 = 短盒序列），
// 文字（路径序号、幽灵镜头名）用自管 DOM（effect 建删 + useFrame 投影定位），不触发 React 渲染。
// 虚线/线长的图面口径：本层在两视图通用，虚线段长取固定米制（轴线 0.35/0.25、视线 0.2/0.2，
// 线宽 0.02m≈图面 1.5–2px），非 spec 的 px 精确值（px 值仅顶视有意义，米制在两视图一致——任务偏离记录）。

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { CameraSymbol } from '../gizmos/CameraGizmo.jsx'
import { horizontalFovDeg } from '../gizmos/frustum.js'

const GHOST_COLOR = '#8a8f98'  // 幽灵机位灰（diagram-symbols：幽灵对象 40% 透明灰）
const ANN_Y = 0.04           // 标注层高度（图面层序：网格 < 阴影 0.01 < 机位 0.02 < 符号 0.03 < 标注）
const NO_RAYCAST = () => null

// 轴线（diagram-symbols：灰虚线 6/4、两端各延长 1m；crossing 时整体橙 #f97316）
const AXIS_COLOR = '#8f8a7f'
const AXIS_DASH = 0.35
const AXIS_GAP = 0.25
const AXIS_EXTEND = 1
// 视线（蓝虚线 4/4；有目标止于目标边缘，无目标沿人物前向定长 1.2m）
const SIGHT_COLOR = '#3b82f6'
const SIGHT_DASH = 0.2
const SIGHT_GAP = 0.2
const SIGHT_FIXED_LEN = 1.2
const SIGHT_START_MARGIN = 0.34  // 人物符号边缘（足迹圆 r0.3 + 余量）
const SIGHT_END_MARGIN = 0.3     // 目标边缘留白
// 路径（黑细线 1.5px 折线 + 编号节点 + 末端实心箭头）
const PATH_COLOR = '#26221c'
const PATH_W = 0.02
// 幽灵机位（40% 透明灰 + 镜头名小标签；锥长固定 3m——幽灵无「入画主体」可算，取从属短锥）
const GHOST_CONE = 3

const lineMaterial = { depthTest: false, depthWrite: false }

// 直线 (x1,z1)→(x2,z2) 的虚线段序列：dash/gap 沿方向交替，末段不足 dash 取剩余长度。
// rotY = atan2(dx, dz) 使本地 +Z 对准方向（细长盒长轴 = Z）。
function dashSegments(x1, z1, x2, z2, dash, gap, width) {
  const dx = x2 - x1
  const dz = z2 - z1
  const length = Math.hypot(dx, dz)
  if (length < 1e-6) return []
  const ux = dx / length
  const uz = dz / length
  const rotY = Math.atan2(dx, dz)
  const segments = []
  for (let t = 0; t < length; t += dash + gap) {
    const len = Math.min(dash, length - t)
    if (len < 0.02) break
    segments.push({ cx: x1 + ux * (t + len / 2), cz: z1 + uz * (t + len / 2), len, rotY, width })
  }
  return segments
}

// 末端实心箭头几何：形状 +Y 经 rotateX(-90°) 映射本地 -Z（前进方向），底边宽/箭长 = size。
function buildArrowGeometry(size) {
  const shape = new THREE.Shape()
  shape.moveTo(0, size * 0.6)
  shape.lineTo(-size * 0.5, -size * 0.4)
  shape.lineTo(size * 0.5, -size * 0.4)
  shape.closePath()
  const geometry = new THREE.ShapeGeometry(shape)
  geometry.rotateX(-Math.PI / 2)
  return geometry
}

// 单段实线（路径折线段）
function SolidSegment({ x, z, rotY, len, width, color, renderOrder }) {
  return (
    <mesh position={[x, ANN_Y, z]} rotation={[0, rotY, 0]} raycast={NO_RAYCAST} renderOrder={renderOrder}>
      <boxGeometry args={[width, 0.001, len]} />
      <meshBasicMaterial color={color} transparent opacity={0.9} {...lineMaterial} />
    </mesh>
  )
}

// ===== 文字标签宿主：路径序号徽章 + 幽灵镜头名（自管 DOM，建删随 key，位置随 useFrame 投影） =====
function AnnotationLabelsHost({ entries }) {
  const gl = useThree(state => state.gl)
  const size = useThree(state => state.size)
  const divsRef = useRef(new Map())
  const entriesRef = useRef(entries)
  entriesRef.current = entries
  const worldPosition = useMemo(() => new THREE.Vector3(), [])
  const key = entries.map(entry => `${entry.id}|${entry.cls}|${entry.text}`).join('\n')

  useEffect(() => {
    const host = gl.domElement.parentNode
    if (!host) return undefined
    const divs = divsRef.current
    const seen = new Set()
    for (const entry of entries) {
      seen.add(entry.id)
      let el = divs.get(entry.id)
      if (!el) {
        el = document.createElement('div')
        host.appendChild(el)
        divs.set(entry.id, el)
      }
      if (el.className !== entry.cls) el.className = entry.cls
      if (el.textContent !== entry.text) el.textContent = entry.text
    }
    for (const [id, el] of divs) {
      if (seen.has(id)) continue
      if (el.parentNode === host) host.removeChild(el)
      divs.delete(id)
    }
    return () => {
      for (const [, el] of divs) {
        if (el.parentNode === host) host.removeChild(el)
      }
      divs.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 位置逐帧更新不走 effect，key 只含 id/类名/文本
  }, [gl, key])

  useFrame(({ camera }) => {
    for (const entry of entriesRef.current) {
      const el = divsRef.current.get(entry.id)
      if (!el) continue
      worldPosition.set(entry.x, ANN_Y, entry.z).project(camera)
      const sx = (worldPosition.x * 0.5 + 0.5) * size.width
      const sy = (-worldPosition.y * 0.5 + 0.5) * size.height
      const next = `translate3d(${Math.round(sx + entry.dx)}px, ${Math.round(sy + entry.dy)}px, 0)${entry.center ? ' translate(-50%, -50%)' : ''}`
      if (el.style.transform !== next) el.style.transform = next
    }
  })

  return null
}

// ===== 标注层本体（!cameraView 时由接缝挂载） =====
export function AnnotationLayer({ annotations = null }) {
  const { axis, crossing = false, gazes, cameraTrack, objectTracks, ghosts, layers } = annotations || {}
  const axisOn = layers?.axis !== false
  const sightOn = layers?.sight !== false
  const pathsOn = layers?.paths !== false
  const ghostsOn = layers?.ghosts !== false
  const arrowGeometry = useMemo(() => buildArrowGeometry(0.24), [])
  useEffect(() => () => arrowGeometry.dispose(), [arrowGeometry])

  // 轴线：a–b 虚线 + 两端延长 1m；crossing 整体橙（useFrame 零 setState，颜色经重挂由 React 换）
  const axisSegments = useMemo(() => {
    if (!axisOn || !axis) return []
    const dx = axis.b.x - axis.a.x
    const dz = axis.b.z - axis.a.z
    const length = Math.hypot(dx, dz)
    if (length < 1e-6) return []
    const ux = dx / length
    const uz = dz / length
    return dashSegments(
      axis.a.x - ux * AXIS_EXTEND, axis.a.z - uz * AXIS_EXTEND,
      axis.b.x + ux * AXIS_EXTEND, axis.b.z + uz * AXIS_EXTEND,
      AXIS_DASH, AXIS_GAP, 0.02,
    )
  }, [axis, axisOn])
  const axisColor = crossing ? '#f97316' : AXIS_COLOR

  // 视线：人物符号边缘发出；有目标止于目标边缘，无目标沿前向（本地 +Z 旋 yaw）定长 1.2m
  const sightSegments = useMemo(() => {
    if (!sightOn) return []
    const list = Array.isArray(gazes) ? gazes : []
    const segments = []
    for (const gaze of list) {
      if (!gaze || !Number.isFinite(gaze.x) || !Number.isFinite(gaze.z)) continue
      const yaw = Number.isFinite(gaze.yaw) ? gaze.yaw : 0
      if (gaze.target && Number.isFinite(gaze.target.x) && Number.isFinite(gaze.target.z)) {
        const dx = gaze.target.x - gaze.x
        const dz = gaze.target.z - gaze.z
        const distance = Math.hypot(dx, dz)
        if (distance < SIGHT_START_MARGIN + SIGHT_END_MARGIN + 0.15) continue
        const ux = dx / distance
        const uz = dz / distance
        segments.push(...dashSegments(
          gaze.x + ux * SIGHT_START_MARGIN, gaze.z + uz * SIGHT_START_MARGIN,
          gaze.target.x - ux * SIGHT_END_MARGIN, gaze.target.z - uz * SIGHT_END_MARGIN,
          SIGHT_DASH, SIGHT_GAP, 0.018,
        ))
      } else {
        const fx = Math.sin(yaw)
        const fz = Math.cos(yaw)
        segments.push(...dashSegments(
          gaze.x + fx * SIGHT_START_MARGIN, gaze.z + fz * SIGHT_START_MARGIN,
          gaze.x + fx * (SIGHT_START_MARGIN + SIGHT_FIXED_LEN), gaze.z + fz * (SIGHT_START_MARGIN + SIGHT_FIXED_LEN),
          SIGHT_DASH, SIGHT_GAP, 0.018,
        ))
      }
    }
    return segments
  }, [gazes, sightOn])

  // 路径：相机轨 + 对象轨，各一条折线（≥2 点才画）；节点序号 = 关键帧序（1 起）
  const pathTracks = useMemo(() => {
    if (!pathsOn) return []
    const tracks = []
    if (Array.isArray(cameraTrack) && cameraTrack.length > 1) tracks.push({ key: 'camera', points: cameraTrack })
    for (const track of Array.isArray(objectTracks) ? objectTracks : []) {
      if (track && Array.isArray(track.points) && track.points.length > 1) tracks.push({ key: track.id, points: track.points })
    }
    return tracks.map(track => ({
      key: track.key,
      segments: track.points.slice(1).map((point, index) => {
        const prev = track.points[index]
        return { x: (prev.x + point.x) / 2, z: (prev.z + point.z) / 2, len: Math.hypot(point.x - prev.x, point.z - prev.z), rotY: Math.atan2(point.x - prev.x, point.z - prev.z) }
      }),
      nodes: track.points.map((point, index) => ({ id: `${track.key}:${point.frame}`, index, x: point.x, z: point.z })),
      arrow: (() => {
        const points = track.points
        const last = points[points.length - 1]
        const prev = points[points.length - 2]
        return { x: last.x, z: last.z, rotY: Math.atan2(-(last.x - prev.x), -(last.z - prev.z)) }
      })(),
    }))
  }, [cameraTrack, objectTracks, pathsOn])

  // 幽灵机位：CameraSymbol 灰 40%（符号+扇形+边线同参数化件，全 NO_RAYCAST）
  const ghostList = useMemo(() => (ghostsOn ? (Array.isArray(ghosts) ? ghosts : []) : []), [ghosts, ghostsOn])

  // DOM 文字：路径序号徽章（居中于节点）+ 幽灵镜头名（符号右侧）
  const labelEntries = useMemo(() => {
    const entries = []
    if (pathsOn) {
      for (const track of pathTracks) {
        for (const node of track.nodes) {
          entries.push({ id: `node:${node.id}`, cls: 'dg-annotation-node', text: String(node.index + 1), x: node.x, z: node.z, dx: 0, dy: 0, center: true })
        }
      }
    }
    if (ghostsOn) {
      for (const ghost of ghostList) {
        entries.push({ id: `ghost:${ghost.shotId}`, cls: 'dg-ghost-label', text: ghost.shotName, x: ghost.x, z: ghost.z, dx: 12, dy: -9, center: false })
      }
    }
    return entries
  }, [pathTracks, ghostList, ghostsOn, pathsOn])

  return (
    <>
      {axisSegments.map((segment, index) => (
        <SolidSegment key={`axis${index}`} x={segment.cx} z={segment.cz} rotY={segment.rotY} len={segment.len} width={segment.width} color={axisColor} renderOrder={10} />
      ))}
      {sightSegments.map((segment, index) => (
        <SolidSegment key={`sight${index}`} x={segment.cx} z={segment.cz} rotY={segment.rotY} len={segment.len} width={segment.width} color={SIGHT_COLOR} renderOrder={11} />
      ))}
      {pathTracks.map(track => (
        <group key={track.key}>
          {track.segments.map((segment, index) => (
            <SolidSegment key={index} x={segment.x} z={segment.z} rotY={segment.rotY} len={segment.len} width={PATH_W} color={PATH_COLOR} renderOrder={12} />
          ))}
          <mesh geometry={arrowGeometry} position={[track.arrow.x, ANN_Y, track.arrow.z]} rotation={[0, track.arrow.rotY, 0]} raycast={NO_RAYCAST} renderOrder={12}>
            <meshBasicMaterial color={PATH_COLOR} {...lineMaterial} />
          </mesh>
        </group>
      ))}
      {ghostList.map(ghost => (
        <CameraSymbol
          key={ghost.shotId}
          x={ghost.x}
          z={ghost.z}
          yaw={ghost.yaw}
          color={GHOST_COLOR}
          hfovRad={(horizontalFovDeg(ghost.focalLength) * Math.PI) / 180}
          coneLength={GHOST_CONE}
          frustumOpacity={0.06}
          edgeOpacity={0.22}
          bodyOpacity={0.4}
        />
      ))}
      <AnnotationLabelsHost entries={labelEntries} />
    </>
  )
}
