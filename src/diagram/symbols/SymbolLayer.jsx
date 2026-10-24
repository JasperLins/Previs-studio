// 顶视符号替换层（T04，diagram-symbols「人物/门/窗/家具与建筑」节 + 任务 design §1/§2）。
// 经接缝 S3 挂载于 EditorScene：仅 topView 时渲染（product-spec §2：符号替换判定集中在本层挂载开关）。
// 只读组件：不写场景数据，onSelect 为透传回调；useFrame 只改自身 transform 与标签 DOM，不触发 React 渲染。
// T03 实测结论沿用：禁 drei Html / drei Line——标签用自管 DOM（effect 建删 + useFrame 投影定位），
// 线用细长盒、圆/弧用 ringGeometry（rotateX(-90°) 平铺，形状 +Y 映射本地 -Z）。
// 比例口径（design §1）：门/窗/墙/椅/足迹框为米制真实比例（不随 zoom 缩放）；人物 34px 系为固定图面
// 尺寸，在内层组按 1/zoom 每帧缩放。真实比例类的线宽为固定米制小值（同 T03 EDGE_WIDTH 口径）。

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  CHAIR_BACK_SIGN,
  PERSON_FORWARD,
  SWAP_TYPES,
  doorHingeArc,
  footprintOf,
  isThinWall,
  poseVariant,
} from './geometry.js'

const GROUND_Y = 0.03        // 符号层高度（避开 ContactShadows 0.01 与网格）
const SELECT_COLOR = '#f3dba5'  // 选中态描边（同上游选中材质 / T03）
const LINE_COLOR = '#3f3b33'    // 中性墨线（同顶视指南针/比例尺色系）
const LINE_W = 0.02             // 真实比例类的墨线宽度（米；典型 zoom 下 ≈1–2px，T03 EDGE_WIDTH 同口径）
const HEAD_COLOR = '#333333'
const PERSON_COLOR_FALLBACK = '#3d4d63'
const NO_RAYCAST = () => null

// 人物符号的 px 几何（diagram-symbols「人物」节，固定图面尺寸 ±20% 容差）
const PERSON_RING_R = 17     // 圆环外径 34px / 2
const PERSON_STROKE = 2
const PERSON_TICK = 8        // 朝向刻度长
const CROUCH_RING_R = 13     // 蹲姿圆缩至 26px / 2
const HEAD_R = 5             // 头点直径 10px / 2
const SIT_ARC_SPAN = Math.PI / 3   // 坐姿朝向侧短弧 60°
const TRAIL_SEG = 4          // 行走尾迹虚线段长

// 需要名称标签的类型（design §1：人物默认开；model/assembly/depthMesh 代理框必带名；家具默认关）
const LABEL_TYPES = new Set(['person', 'model', 'assembly', 'depthMesh'])

const flatProps = {
  rotation: [-Math.PI / 2, 0, 0],
}

// 顶视 1px = 1/zoom；3D 兜底同 CameraGizmo 的透视口径（本层仅顶视挂载，兜底只为防御性）。
function pxTo3DWorld(camera, distance, viewportHeight) {
  const fovRad = ((camera.fov || 42) * Math.PI) / 180
  return (2 * Math.tan(fovRad / 2) * distance) / Math.max(1, viewportHeight)
}

function objectXZ(object) {
  const position = Array.isArray(object?.position) ? object.position : []
  const rotation = Array.isArray(object?.rotation) ? object.rotation : []
  const x = Number(position[0])
  const z = Number(position[2])
  const yaw = Number(rotation[1])
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null
  return { x, z, yaw: Number.isFinite(yaw) ? yaw : 0 }
}

// ===== 人物符号（整型替换：原模型由接缝 hideModel 隐藏） =====
function PersonSymbol({ object, selected, onSelect }) {
  const variant = poseVariant(object.pose)
  const fwd = PERSON_FORWARD[2] >= 0 ? 1 : -1  // 前向在本地 Z 上的符号（校准只翻 PERSON_FORWARD 常量）
  const color = selected ? SELECT_COLOR : (object.color || PERSON_COLOR_FALLBACK)
  const ringR = variant === 'crouch' ? CROUCH_RING_R : PERSON_RING_R
  const pxRef = useRef(null)
  const size = useThree(state => state.size)
  const worldPosition = useMemo(() => new THREE.Vector3(), [])
  const { x, z, yaw } = objectXZ(object)

  // 固定图面尺寸：内层组每帧按 1/zoom 缩放（只改 transform，不 setState、不分配）
  useFrame(({ camera }) => {
    const group = pxRef.current
    if (!group) return
    group.getWorldPosition(worldPosition)
    const scale = camera.isOrthographicCamera && camera.zoom > 0
      ? 1 / camera.zoom
      : pxTo3DWorld(camera, camera.position.distanceTo(worldPosition), size.height)
    group.scale.setScalar(scale)
  })

  // 坐姿短弧：形状空间里前向 = -Y（+Z 经 rotateX(-90°) 的镜像），弧居中于前向
  const sitArcStart = -Math.PI / 2 - SIT_ARC_SPAN / 2
  // 尾迹 3 段虚线（段长 4 / 缝 1），末段外缘恰在 ringR+14（spec：身后 14px 虚线尾迹）
  const trailCenters = [ringR + 2, ringR + 7, ringR + 12]

  return (
    <group
      position={[x, GROUND_Y, z]}
      rotation={[0, yaw, 0]}
      onPointerDown={event => { event.stopPropagation(); onSelect?.(object.id) }}
    >
      {/* 小圆足迹：0.6m 真实比例（不进 px 组） */}
      <mesh {...flatProps} raycast={NO_RAYCAST} renderOrder={5}>
        <ringGeometry args={[0.28, 0.31, 36]} />
        <meshBasicMaterial color={LINE_COLOR} transparent opacity={0.45} depthTest={false} depthWrite={false} />
      </mesh>
      {/* 点选热区（模型已隐藏；上游 JointSegment 同款透明热区模式，其余符号 mesh 全部不参与 raycast） */}
      <mesh {...flatProps} renderOrder={1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial transparent opacity={0} depthTest={false} depthWrite={false} />
      </mesh>
      <group ref={pxRef}>
        {/* 圆环：描边 2px，色 = 对象 color / 选中态 */}
        <mesh {...flatProps} raycast={NO_RAYCAST} renderOrder={6}>
          <ringGeometry args={[ringR - PERSON_STROKE, ringR, 40]} />
          <meshBasicMaterial color={color} depthTest={false} depthWrite={false} />
        </mesh>
        {/* 圆心头点（实心 10px，深灰；蹲姿的内点同此） */}
        <mesh {...flatProps} raycast={NO_RAYCAST} renderOrder={7}>
          <circleGeometry args={[HEAD_R, 20]} />
          <meshBasicMaterial color={HEAD_COLOR} depthTest={false} depthWrite={false} />
        </mesh>
        {/* 朝向刻度：圆周沿前向向外 8px 短线 */}
        <mesh position={[0, 0, fwd * (ringR + PERSON_TICK / 2)]} raycast={NO_RAYCAST} renderOrder={7}>
          <boxGeometry args={[1.2, 0.001, PERSON_TICK]} />
          <meshBasicMaterial color={color} depthTest={false} depthWrite={false} />
        </mesh>
        {/* 坐姿变体：朝向侧一道短弧（表示座面） */}
        {variant === 'sit' && (
          <mesh {...flatProps} raycast={NO_RAYCAST} renderOrder={7}>
            <ringGeometry args={[ringR - 1, ringR + 1, 24, 1, sitArcStart, SIT_ARC_SPAN]} />
            <meshBasicMaterial color={color} depthTest={false} depthWrite={false} />
          </mesh>
        )}
        {/* 行走/奔跑变体：身后 14px 虚线尾迹（3 短段） */}
        {variant === 'walk' && trailCenters.map(center => (
          <mesh key={center} position={[0, 0, -fwd * center]} raycast={NO_RAYCAST} renderOrder={7}>
            <boxGeometry args={[1.2, 0.001, TRAIL_SEG]} />
            <meshBasicMaterial color={color} transparent opacity={0.85} depthTest={false} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

// ===== 门符号（整型替换）：门板线 + 铰链 + 90° 开启弧 + 框柱两点 =====
function DoorSymbol({ object, selected, footprint: { w, d }, onSelect }) {
  const color = selected ? SELECT_COLOR : LINE_COLOR
  const arc = doorHingeArc(w, d)
  const postSize = Math.min(0.1, w * 0.2)
  const { x, z, yaw } = objectXZ(object)
  return (
    <group
      position={[x, GROUND_Y, z]}
      rotation={[0, yaw, 0]}
      onPointerDown={event => { event.stopPropagation(); onSelect?.(object.id) }}
    >
      {/* 门板线：长 = 足迹宽，沿本地 X */}
      <mesh raycast={NO_RAYCAST} renderOrder={5}>
        <boxGeometry args={[w, 0.001, LINE_W]} />
        <meshBasicMaterial color={color} depthTest={false} depthWrite={false} />
      </mesh>
      {/* 90° 开启弧：铰链在本地 -X 端，张开侧由 DOOR_SWING_SIGN 决定 */}
      {arc && (
        <mesh {...flatProps} position={[arc.hinge[0], 0, arc.hinge[1]]} raycast={NO_RAYCAST} renderOrder={5}>
          <ringGeometry args={[arc.radius - 0.01, arc.radius + 0.01, 48, 1, arc.thetaStart, arc.thetaLength]} />
          <meshBasicMaterial color={color} depthTest={false} depthWrite={false} />
        </mesh>
      )}
      {/* 框柱两点 */}
      {[-w / 2, w / 2].map(px => (
        <mesh key={px} position={[px, 0, 0]} raycast={NO_RAYCAST} renderOrder={6}>
          <boxGeometry args={[postSize, 0.001, postSize]} />
          <meshBasicMaterial color={color} depthTest={false} depthWrite={false} />
        </mesh>
      ))}
      {/* 点选热区（覆盖厚度加余量，原模型已隐藏） */}
      <mesh {...flatProps} renderOrder={1}>
        <planeGeometry args={[w, Math.max(d, 0.3)]} />
        <meshBasicMaterial transparent opacity={0} depthTest={false} depthWrite={false} />
      </mesh>
    </group>
  )
}

// ===== 窗符号（整型替换）：三线（两条外框 + 中线） =====
function WindowSymbol({ object, selected, footprint: { w, d }, onSelect }) {
  const color = selected ? SELECT_COLOR : LINE_COLOR
  const t = Math.min(LINE_W, d / 4)
  const { x, z, yaw } = objectXZ(object)
  return (
    <group
      position={[x, GROUND_Y, z]}
      rotation={[0, yaw, 0]}
      onPointerDown={event => { event.stopPropagation(); onSelect?.(object.id) }}
    >
      {[-d / 2, 0, d / 2].map(pz => (
        <mesh key={`z${pz}`} position={[0, 0, pz]} raycast={NO_RAYCAST} renderOrder={5}>
          <boxGeometry args={[w, 0.001, t]} />
          <meshBasicMaterial color={color} depthTest={false} depthWrite={false} />
        </mesh>
      ))}
      <mesh {...flatProps} renderOrder={1}>
        <planeGeometry args={[w, Math.max(d, 0.3)]} />
        <meshBasicMaterial transparent opacity={0} depthTest={false} depthWrite={false} />
      </mesh>
    </group>
  )
}

// ===== 墙符号（薄高 box 整型替换）：双线 + 两端收口 =====
function WallSymbol({ object, selected, footprint: { w, d }, onSelect }) {
  const color = selected ? SELECT_COLOR : LINE_COLOR
  const t = Math.min(LINE_W, d / 3)
  const { x, z, yaw } = objectXZ(object)
  return (
    <group
      position={[x, GROUND_Y, z]}
      rotation={[0, yaw, 0]}
      onPointerDown={event => { event.stopPropagation(); onSelect?.(object.id) }}
    >
      {[-(d / 2 - t / 2), d / 2 - t / 2].map(pz => (
        <mesh key={`z${pz}`} position={[0, 0, pz]} raycast={NO_RAYCAST} renderOrder={5}>
          <boxGeometry args={[w, 0.001, t]} />
          <meshBasicMaterial color={color} depthTest={false} depthWrite={false} />
        </mesh>
      ))}
      {[-(w / 2 - t / 2), w / 2 - t / 2].map(px => (
        <mesh key={`x${px}`} position={[px, 0, 0]} raycast={NO_RAYCAST} renderOrder={5}>
          <boxGeometry args={[t, 0.001, d]} />
          <meshBasicMaterial color={color} depthTest={false} depthWrite={false} />
        </mesh>
      ))}
      <mesh {...flatProps} renderOrder={1}>
        <planeGeometry args={[w, Math.max(d, 0.3)]} />
        <meshBasicMaterial transparent opacity={0} depthTest={false} depthWrite={false} />
      </mesh>
    </group>
  )
}

// 足迹矩形描边（中性细线；emphasisZ ≠ 0 时靠背侧边加粗 = 椅背线，本地侧由 CHAIR_BACK_SIGN 决定）
function RectOutline({ w, d, color, emphasisZ = 0 }) {
  const lw = Math.min(LINE_W, Math.min(w, d) / 6)
  const backLw = Math.min(lw * 1.5, d / 3)  // 靠背侧加粗线（design §2：1.5× 线宽，防小件吃满厚度）
  const backSide = CHAIR_BACK_SIGN >= 0 ? 's' : 'n'  // 本地 +Z = 南边（平铺后图面下方）
  const edges = [
    { key: 'n', len: lw, position: [0, 0, -(d / 2 - lw / 2)] },
    { key: 's', len: lw, position: [0, 0, d / 2 - lw / 2] },
    { key: 'w', len: lw, position: [-(w / 2 - lw / 2), 0, 0] },
    { key: 'e', len: lw, position: [w / 2 - lw / 2, 0, 0] },
  ]
  return (
    <>
      {edges.map(edge => {
        const isBack = emphasisZ && edge.key === backSide
        const thickness = isBack ? backLw : edge.len
        const alongZ = edge.key === 'w' || edge.key === 'e'
        const args = alongZ ? [thickness, 0.001, d - 2 * thickness] : [w, 0.001, thickness]
        const position = alongZ
          ? [edge.position[0], 0, 0]
          : [0, 0, (edge.position[2] > 0 ? 1 : -1) * (d / 2 - thickness / 2)]
        return (
          <mesh key={edge.key} position={position} raycast={NO_RAYCAST} renderOrder={5}>
            <boxGeometry args={args} />
            <meshBasicMaterial color={color} depthTest={false} depthWrite={false} />
          </mesh>
        )
      })}
    </>
  )
}

// 足迹圆描边（sphere / cylinder / tree）
function CircleOutline({ w, color }) {
  const r = Math.max(0.05, w / 2)
  const t = Math.min(0.012, r / 8)
  return (
    <mesh {...flatProps} raycast={NO_RAYCAST} renderOrder={5}>
      <ringGeometry args={[r - t, r + t, 40]} />
      <meshBasicMaterial color={color} depthTest={false} depthWrite={false} />
    </mesh>
  )
}

// 代理框（model / depthMesh / 无 parts 的 assembly）：1×1 框 + 对角线 + 名称标签（通用标记）
function ProxySymbol({ color }) {
  const lw = Math.min(LINE_W, 1 / 8)
  return (
    <>
      <RectOutline w={1} d={1} color={color} />
      <mesh rotation={[0, Math.PI / 4, 0]} raycast={NO_RAYCAST} renderOrder={5}>
        <boxGeometry args={[Math.SQRT2 - 2 * lw, 0.001, lw * 0.8]} />
        <meshBasicMaterial color={color} depthTest={false} depthWrite={false} />
      </mesh>
    </>
  )
}

const CIRCLE_TYPES = new Set(['sphere', 'cylinder', 'tree'])

// ===== 名称标签宿主：单个组件统一管理全部 dg-obj-label DOM（避免每对象一份监听） =====
// DOM 建删只在 id/文本集合变化时发生（effect 依赖 key）；位置随 useFrame 投影更新（改 transform，不 setState）。
function LabelsHost({ entries }) {
  const gl = useThree(state => state.gl)
  const size = useThree(state => state.size)
  const divsRef = useRef(new Map())
  const entriesRef = useRef(entries)
  entriesRef.current = entries
  const worldPosition = useMemo(() => new THREE.Vector3(), [])
  const key = entries.map(entry => `${entry.id}|${entry.text}`).join('\n')

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
        el.className = 'dg-obj-label'
        host.appendChild(el)
        divs.set(entry.id, el)
      }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 位置逐帧更新不走 effect，key 只含 id/文本
  }, [gl, key])

  // 锚点 = 对象真实足迹下缘（+Z 屏幕下侧），人物（d=0）锚圆心、padPx 含符号半径，
  // 保证「圆的下方 4px」在任意 zoom 下恒定；再按屏幕 px 下移。
  useFrame(({ camera }) => {
    for (const entry of entriesRef.current) {
      const el = divsRef.current.get(entry.id)
      if (!el) continue
      worldPosition.set(entry.x, GROUND_Y, entry.z + entry.d / 2).project(camera)
      const sx = (worldPosition.x * 0.5 + 0.5) * size.width
      const sy = (-worldPosition.y * 0.5 + 0.5) * size.height
      const next = `translate3d(${Math.round(sx)}px, ${Math.round(sy + entry.padPx)}px, 0) translateX(-50%)`
      if (el.style.transform !== next) el.style.transform = next
    }
  })

  return null
}

// ===== 符号层本体（仅 topView 时由接缝挂载） =====
export function SymbolLayer({ objects, selectedId, labelsOn = true, onSelect }) {
  const list = Array.isArray(objects) ? objects : []
  const nodes = []
  const entries = []
  for (const object of list) {
    if (!object || typeof object !== 'object' || object.visible === false) continue
    const coords = objectXZ(object)
    if (!coords) continue
    const selected = selectedId === object.id
    const footprint = footprintOf(object)
    const swap = SWAP_TYPES.has(object.type) || (object.type === 'box' && isThinWall(object.scale))
    const baseColor = selected ? SELECT_COLOR : LINE_COLOR

    if (object.type === 'person') {
      nodes.push(<PersonSymbol key={object.id} object={object} selected={selected} onSelect={onSelect} />)
    } else if (object.type === 'door' && footprint) {
      nodes.push(<DoorSymbol key={object.id} object={object} selected={selected} footprint={footprint} onSelect={onSelect} />)
    } else if (object.type === 'window' && footprint) {
      nodes.push(<WindowSymbol key={object.id} object={object} selected={selected} footprint={footprint} onSelect={onSelect} />)
    } else if (swap && footprint) {
      nodes.push(<WallSymbol key={object.id} object={object} selected={selected} footprint={footprint} onSelect={onSelect} />)
    } else if (footprint) {
      // 其余对象：模型保留，足迹描边强调（椅类叠加靠背侧加粗线）
      nodes.push((
        <group key={object.id} position={[coords.x, GROUND_Y, coords.z]} rotation={[0, coords.yaw, 0]}>
          {CIRCLE_TYPES.has(object.type)
            ? <CircleOutline w={footprint.w} color={baseColor} />
            : (
              <RectOutline
                w={footprint.w}
                d={footprint.d}
                color={baseColor}
                emphasisZ={object.type === 'chair' ? CHAIR_BACK_SIGN : 0}
              />
            )}
        </group>
      ))
    } else {
      // 足迹未知（GLB / depthMesh / 空 assembly）：1×1 代理框 + 对角线 + 名称标签
      nodes.push((
        <group key={object.id} position={[coords.x, GROUND_Y, coords.z]} rotation={[0, coords.yaw, 0]}>
          <ProxySymbol color={baseColor} />
        </group>
      ))
    }

    // 名称标签：labelsOn 总闸 + 类型白名单（人物默认开、家具默认关；代理框必带名）
    if (labelsOn && LABEL_TYPES.has(object.type)) {
      const isPerson = object.type === 'person'
      const variant = poseVariant(object.pose)
      const name = object.name || object.type
      const text = isPerson && variant === 'other' && object.pose
        ? `${name} · ${object.pose}`
        : name
      entries.push({
        id: object.id,
        text,
        x: coords.x,
        z: coords.z,
        // 锚点取真实足迹下缘（+Z 屏幕下侧）；人物符号是固定图面尺寸（34px 圆不随 zoom 变世界半径），
        // 锚圆心 + px 半径偏移，间距才恒为 spec 的「圆的下方 4px」（缩放无关）。
        d: isPerson ? 0 : (footprint ? footprint.d : 1),
        padPx: isPerson ? (variant === 'crouch' ? CROUCH_RING_R : PERSON_RING_R) + 4 : 5,
      })
    }
  }
  return (
    <>
      {nodes}
      <LabelsHost entries={entries} />
    </>
  )
}
