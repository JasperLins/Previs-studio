// 机位视锥 Gizmo 与标签牌（T03 design §3；T05 重构抽展示件）。经接缝 S3 挂载于 EditorScene：
// !cameraView 且 diagram.layers.frustum 开时渲染（摄像机视角的监看画面本就是机位所见，不叠符号）。
// T05 重构：机身符号 + 视锥扇形 + 边线抽为展示件 CameraSymbol（颜色/透明度参数化，导出供
// AnnotationLayer 画幽灵机位）；CameraGizmo 保留标签牌 DOM 与投影定位，新增 warned 橙色板（#f97316 系）。
// 只读组件：不写任何场景数据；useFrame 仅改自身 transform 与标签 DOM（class/位置），不触发 React 渲染。
// 焦距→角度的唯一公式来源是 ./frustum.js（审查门：组件内禁止另写 atan）。
// 标签牌为自管 DOM：drei Html 的桥接在本项目 R3F v9 多 Canvas 环境下不产出 DOM（浏览器实测，
// 见任务自检记录）；边线用平面细长盒替代 drei Line（同为浏览器实测的稳妥化，少一条 drei 依赖路径）。

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { coneLengthMeters, horizontalFovDeg, verticalFovDeg } from './frustum.js'

export const GIZMO_COLOR = '#22c55e'
export const WARN_COLOR = '#f97316'
const GROUND_Y = 0.02        // 地面层高度（避开 ContactShadows 与网格线）
const EDGE_MARGIN_PX = 160   // 标签牌距画布右/上边缘小于该值时翻到对侧
const LABEL_OFFSET_PX = 12   // 标签与机位锚点的间距
const EDGE_WIDTH = 0.02      // 边线宽度（米，图面口径下足够细）
const NO_RAYCAST = () => null

// 3D 编辑视图：1px 的世界尺寸 = 2·tan(fov/2)·机距/视口高（透视投影口径，同 Viewport.jsx 既有换算）。
function pxTo3DWorld(camera, distance, viewportHeight) {
  const fovRad = ((camera.fov || 42) * Math.PI) / 180
  return (2 * Math.tan(fovRad / 2) * distance) / Math.max(1, viewportHeight)
}

// 机身符号的 px 几何（diagram-symbols「机位」节）：22×14 矩形 + 朝向侧 10px 等腰梯形楔形。
// 形状 +Y 经 rotateX(-90°) 映射到本地 -Z（前向），与扇形/边线同向。
function buildBodyGeometry() {
  const halfWidth = 11
  const halfDepth = 7
  const halfTip = 5
  const wedgeLength = 10
  const shape = new THREE.Shape()
  shape.moveTo(-halfWidth, -halfDepth)
  shape.lineTo(halfWidth, -halfDepth)
  shape.lineTo(halfWidth, halfDepth)
  shape.lineTo(halfTip, halfDepth + wedgeLength)
  shape.lineTo(-halfTip, halfDepth + wedgeLength)
  shape.lineTo(-halfWidth, halfDepth)
  shape.closePath()
  const geometry = new THREE.ShapeGeometry(shape)
  geometry.rotateX(-Math.PI / 2)
  return geometry
}

// ===== 展示件（T05）：机位符号 + 视锥扇形 + 边线，颜色/透明度/锥长参数化 =====
// 当前镜（CameraGizmo）用绿系/越轴橙系；AnnotationLayer 的幽灵机位用 40% 透明灰。
// 机身符号为 px 几何，内层组每帧按视图口径换算图面尺寸（顶视 1px=1/zoom；3D 距离等比）；
// 扇形/边线为米制世界尺寸（不随机身符号缩放）。全部 NO_RAYCAST（幽灵不可点、当前镜点选走 CameraModel）。
export function CameraSymbol({
  x = 0,
  z = 0,
  y = GROUND_Y,
  yaw = 0,
  color = GIZMO_COLOR,
  hfovRad = Math.PI / 2,
  coneLength = 5,
  frustumOpacity = 0.12,
  edgeOpacity = 0.5,
  bodyOpacity = 1,
}) {
  const symbolRef = useRef(null)
  const size = useThree(state => state.size)
  const worldPosition = useMemo(() => new THREE.Vector3(), [])

  const bodyGeometry = useMemo(buildBodyGeometry, [])
  useEffect(() => () => bodyGeometry.dispose(), [bodyGeometry])

  const halfFov = hfovRad / 2
  // 边线：从机位沿 ±半角到锥端。细长盒沿本地 -Z 放置，绕 Y 转 ±halfFov 即对准两侧边线。
  const edges = useMemo(() => [-1, 1].map(side => ({
    key: side,
    rotY: side * halfFov,
    pos: [-Math.sin(side * halfFov) * coneLength / 2, 0, -Math.cos(side * halfFov) * coneLength / 2],
  })), [halfFov, coneLength])

  useFrame(({ camera }) => {
    const group = symbolRef.current
    if (!group) return
    group.getWorldPosition(worldPosition)
    const scale = camera.isOrthographicCamera && camera.zoom > 0
      ? 1 / camera.zoom
      : pxTo3DWorld(camera, camera.position.distanceTo(worldPosition), size.height)
    group.scale.setScalar(scale)
  })

  return (
    <group position={[x, y, z]} rotation={[0, yaw, 0]}>
      {/* 视锥扇形：半透明，锥长为米制世界尺寸 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={NO_RAYCAST} renderOrder={2}>
        <circleGeometry args={[coneLength, 48, Math.PI / 2 - halfFov, hfovRad]} />
        <meshBasicMaterial color={color} transparent opacity={frustumOpacity} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {/* 边线两条：机位 → 扇形两端点 */}
      {edges.map(edge => (
        <mesh key={edge.key} rotation={[0, edge.rotY, 0]} position={edge.pos} raycast={NO_RAYCAST} renderOrder={3}>
          <boxGeometry args={[EDGE_WIDTH, 0.001, coneLength]} />
          <meshBasicMaterial color={color} transparent opacity={edgeOpacity} depthWrite={false} />
        </mesh>
      ))}
      {/* 机身符号：px 几何在内层组，每帧定图面尺寸（顶视精确 / 3D 近似） */}
      <group ref={symbolRef}>
        <mesh geometry={bodyGeometry} raycast={NO_RAYCAST} renderOrder={4}>
          <meshBasicMaterial color={color} transparent opacity={bodyOpacity} depthWrite={false} />
        </mesh>
      </group>
    </group>
  )
}

// ===== 机位 Gizmo 本体：CameraSymbol + 标签牌（T03 行为零回退：内容/翻转/焦距联动） =====
export function CameraGizmo({ cameraData, objects, letter = 'A', subjectName = '', warned = false }) {
  const labelRef = useRef(null)   // 标签 DOM：每帧投影定位 + 边缘翻转 class
  const size = useThree(state => state.size)
  const gl = useThree(state => state.gl)
  const anchor = useMemo(() => new THREE.Vector3(), [])

  // 标签牌 DOM：内容随 letter/对象名/焦距变化重建；越轴时橙底经 dg-warn class 切换（useFrame 维护）。
  useEffect(() => {
    const host = gl.domElement.parentNode
    if (!host) return undefined
    const el = document.createElement('div')
    el.className = 'dg-cam-label'
    const strong = document.createElement('strong')
    strong.textContent = `Cam ${letter}${subjectName ? ` · ${subjectName}` : ''}`
    el.appendChild(strong)
    const focal = Math.round(Number(cameraData?.focalLength) || 0)
    for (const text of ['景别待 T06', `${focal}mm`]) {
      const span = document.createElement('span')
      span.textContent = text
      el.appendChild(span)
    }
    host.appendChild(el)
    labelRef.current = el
    return () => {
      labelRef.current = null
      if (el.parentNode === host) host.removeChild(el)
    }
  }, [gl, letter, subjectName, cameraData?.focalLength])

  // 视锥参数（角度/锥长全部经 frustum.js）
  const hfovDeg = horizontalFovDeg(cameraData?.focalLength)
  const vfovDeg = verticalFovDeg(cameraData?.focalLength)
  const coneLength = coneLengthMeters(cameraData, objects, hfovDeg, vfovDeg)
  const hfovRad = (hfovDeg * Math.PI) / 180

  const position = Array.isArray(cameraData?.position) ? cameraData.position : []
  const rotation = Array.isArray(cameraData?.rotation) ? cameraData.rotation : []
  const x = Number.isFinite(position[0]) ? position[0] : 0
  const z = Number.isFinite(position[2]) ? position[2] : 0
  const yaw = Number.isFinite(rotation[1]) ? rotation[1] : 0

  // 每帧：标签牌投影屏幕坐标定位并做边缘翻转——只改自身 transform/DOM。
  useFrame(({ camera }) => {
    const label = labelRef.current
    if (!label) return
    anchor.set(x, GROUND_Y, z).project(camera)
    const sx = (anchor.x * 0.5 + 0.5) * size.width
    const sy = (-anchor.y * 0.5 + 0.5) * size.height
    // 默认锚在机位右上（diagram-symbols），靠右/上边缘时翻到对侧
    const flipX = sx > size.width - EDGE_MARGIN_PX
    const flipY = sy < EDGE_MARGIN_PX
    const lx = flipX ? sx - label.offsetWidth - LABEL_OFFSET_PX : sx + LABEL_OFFSET_PX
    const ly = flipY ? sy + LABEL_OFFSET_PX : sy - label.offsetHeight - LABEL_OFFSET_PX
    const nextTransform = `translate3d(${Math.round(lx)}px, ${Math.round(ly)}px, 0)`
    if (label.style.transform !== nextTransform) label.style.transform = nextTransform
    const nextClass = `dg-cam-label${warned ? ' dg-warn' : ''}${flipX ? ' dg-flip-x' : ''}${flipY ? ' dg-flip-y' : ''}`
    if (label.className !== nextClass) label.className = nextClass
  })

  // 越轴（warned）：符号/锥/边线切 #f97316 系，锥填充加深一档（diagram-symbols「警告态」）
  return (
    <CameraSymbol
      x={x}
      z={z}
      yaw={yaw}
      color={warned ? WARN_COLOR : GIZMO_COLOR}
      hfovRad={hfovRad}
      coneLength={coneLength}
      frustumOpacity={warned ? 0.18 : 0.12}
    />
  )
}
