// 顶视米制网格与图纸底（T02 design §4-4）。经接缝 S3 挂载于 EditorScene，替代上游 Ground。
// 网格世界对齐原点（1m 主格对齐整数坐标），非无限网格（禁透视淡出）；纸张底色不受光照影响。

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

const PAPER_COLOR = '#f4f1ea'
const MAJOR_COLOR = '#b9b3a6'
const MINOR_COLOR = '#d8d4ca'
const AXIS_COLOR = '#a8a294'

// step 间距的十字网格线段组（覆盖 [-extent/2, extent/2]，extent 取偶数保证 1m 线对齐整数）
function buildGridGeometry(extent, step) {
  const half = extent / 2
  const positions = []
  const count = Math.round(extent / step)
  for (let index = 0; index <= count; index += 1) {
    const value = -half + index * step
    positions.push(-half, 0, value, half, 0, value)
    positions.push(value, 0, -half, value, 0, half)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  return geometry
}

function buildAxisGeometry(extent) {
  const half = extent / 2
  const positions = [
    -half, 0, 0, half, 0, 0,
    0, 0, -half, 0, 0, half,
  ]
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  return geometry
}

// 网格边长上限：线段数有界（0.5m 次格 ≤ 2×(MAX/0.5) 条）；覆盖半径 115m，超出按上限截断。
const MAX_GRID_EXTENT = 240

export function TopViewGrid({ radius = 6, showGrid = true, showHalfGrid = true }) {
  // 尺寸 = 场景半径 × 2 + 10m，向上取偶数（1m 主线落在整数世界坐标上），再按上限封顶。
  const extent = Math.min(MAX_GRID_EXTENT, Math.ceil(Math.max(12, radius * 2 + 10) / 2) * 2)
  const majorGeometry = useMemo(() => buildGridGeometry(extent, 1), [extent])
  const minorGeometry = useMemo(() => buildGridGeometry(extent, 0.5), [extent])
  const axisGeometry = useMemo(() => buildAxisGeometry(extent), [extent])
  useEffect(() => () => {
    majorGeometry.dispose()
    minorGeometry.dispose()
    axisGeometry.dispose()
  }, [axisGeometry, majorGeometry, minorGeometry])
  return (
    <group>
      {/* 浅色图纸底（不受光照，正交下即纯色底） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]}>
        <planeGeometry args={[extent + 8, extent + 8]} />
        <meshBasicMaterial color={PAPER_COLOR} />
      </mesh>
      {showGrid && (
        <>
          {showHalfGrid && (
            <lineSegments geometry={minorGeometry} position={[0, 0.001, 0]}>
              <lineBasicMaterial color={MINOR_COLOR} transparent opacity={0.85} />
            </lineSegments>
          )}
          <lineSegments geometry={majorGeometry} position={[0, 0.002, 0]}>
            <lineBasicMaterial color={MAJOR_COLOR} transparent opacity={0.95} />
          </lineSegments>
          <lineSegments geometry={axisGeometry} position={[0, 0.003, 0]}>
            <lineBasicMaterial color={AXIS_COLOR} transparent opacity={0.8} />
          </lineSegments>
        </>
      )}
    </group>
  )
}
