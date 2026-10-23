// 顶视正交编辑相机控制（T02 design §2）。经接缝 S3 挂载于 EditorScene：
// topView 时不渲染上游 OrbitControls，改渲染本组件（平移/缩放、禁旋转）。
// 纯视图态组件：不读写任何场景数据；zoom 变化经节流上报供比例尺换算。

import { useEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { TOP_VIEW_UP } from './topView.js'

const TOP_VIEW_HEIGHT = 100

export function TopViewControls({ center = [0, 0], radius = 6, onViewportReport }) {
  const camera = useThree(state => state.camera)
  const size = useThree(state => state.size)
  const controls = useThree(state => state.controls)
  const reportRef = useRef(onViewportReport)
  reportRef.current = onViewportReport
  const fittedRef = useRef(false)

  const cx = Number(center[0]) || 0
  const cz = Number(center[1]) || 0
  const target = useMemo(() => [cx, 0, cz], [cx, cz])

  // 挂载时把默认相机摆成顶视正交姿态：up = 场景北（-Z）、高处俯视场景中心、
  // 初始 zoom 按 min(画布宽高) / (2 × 观察半径 × 1.2 边距) 适配（只执行一次，缩放画布不重置用户视图）。
  useEffect(() => {
    if (!controls || fittedRef.current) return
    fittedRef.current = true
    const safeRadius = Number.isFinite(radius) && radius > 0 ? radius : 6
    camera.up.set(...TOP_VIEW_UP)
    camera.position.set(cx, TOP_VIEW_HEIGHT, cz)
    const fitPixels = Math.max(1, Math.min(size.width, size.height))
    camera.zoom = Math.max(1, fitPixels / (safeRadius * 2 * 1.2))
    camera.near = 0.1
    camera.far = 400
    camera.updateProjectionMatrix()
    controls.target.set(cx, 0, cz)
    controls.mouseButtons.LEFT = THREE.MOUSE.PAN
    controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY
    controls.mouseButtons.RIGHT = THREE.MOUSE.PAN
    controls.touches.ONE = THREE.TOUCH.PAN
    controls.update()
  }, [camera, controls, cx, cz, radius, size.height, size.width])

  // 低频上报 {zoom, heightPx}（design 审查门：不得每帧触发 React 渲染）：
  // change 事件 ~150ms 节流，pointerup / wheel 立即 flush，挂载后先报一次初始值。
  useEffect(() => {
    if (!controls) return undefined
    let timer = null
    const flush = () => {
      timer = null
      reportRef.current?.({ zoom: camera.zoom, heightPx: size.height })
    }
    const flushNow = () => {
      if (timer !== null) clearTimeout(timer)
      flush()
    }
    const schedule = () => {
      if (timer === null) timer = setTimeout(flush, 150)
    }
    const domElement = controls.domElement
    controls.addEventListener('change', schedule)
    domElement.addEventListener('pointerup', flushNow)
    domElement.addEventListener('wheel', flushNow, { passive: true })
    flush()
    return () => {
      controls.removeEventListener('change', schedule)
      domElement.removeEventListener('pointerup', flushNow)
      domElement.removeEventListener('wheel', flushNow)
      if (timer !== null) clearTimeout(timer)
    }
  }, [camera, controls, size.height])

  return (
    <OrbitControls
      makeDefault
      enableRotate={false}
      enableDamping={false}
      target={target}
    />
  )
}
