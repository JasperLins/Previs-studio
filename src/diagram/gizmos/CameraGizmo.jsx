// 机位视锥 Gizmo（T03 design §3；T05 重构抽展示件；T10 移除视口标签牌）。经接缝 S3 挂载于
// EditorScene：!cameraView 且 diagram.layers.frustum 开时渲染（摄像机视角的监看画面本就是机位
// 所见，不叠符号）。T05 重构：机身符号 + 视锥扇形 + 边线抽为展示件 CameraSymbol（颜色/透明度
// 参数化，导出供 AnnotationLayer 画幽灵机位）。
// 只读组件：不写任何场景数据；useFrame 仅改自身 transform，不触发 React 渲染。
// 焦距→角度的唯一公式来源是 ./frustum.js（审查门：组件内禁止另写 atan）。
// T10：蓝底标签牌（dg-cam-label）按用户口径不再展示，DOM 标签相关逻辑整体移除；
// 字母/主体/景别仍由 App 侧机位词与导出图消费。边线用平面细长盒替代 drei Line（浏览器实测）。

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { coneLengthMeters, headingYawRad, horizontalFovDeg, verticalFovDeg } from './frustum.js'

export const GIZMO_COLOR = '#22c55e'
export const WARN_COLOR = '#f97316'
const GROUND_Y = 0.02        // 地面层高度（避开 ContactShadows 与网格线）
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

// ===== 机位 Gizmo 本体：CameraSymbol（扇形 + 机身符号 + 越轴橙色警示） =====
// 用户口径：蓝底标签牌（Cam 字母/主体/景别/焦距）不再展示——字母与景别仍进机位词面板
// 与导出图标签牌；越轴警示经扇形整体切橙呈现（不再依赖标签 dg-warn 态）。
export function CameraGizmo({ cameraData, objects, warned = false }) {
  // 视锥参数（角度/锥长全部经 frustum.js）
  const hfovDeg = horizontalFovDeg(cameraData?.focalLength)
  const vfovDeg = verticalFovDeg(cameraData?.focalLength)
  const coneLength = coneLengthMeters(cameraData, objects, hfovDeg, vfovDeg)
  const hfovRad = (hfovDeg * Math.PI) / 180

  const position = Array.isArray(cameraData?.position) ? cameraData.position : []
  const x = Number.isFinite(position[0]) ? position[0] : 0
  const z = Number.isFinite(position[2]) ? position[2] : 0
  // 朝向走全量欧拉口径：TransformControls 旋转跨 ±90° 后 three 分解翻支（y 镜像），
  // 直接取 rotation[1] 扇形会指反（回归红线：翻支后扇形仍须跟随镜头）。
  const yaw = headingYawRad(cameraData?.rotation)

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
