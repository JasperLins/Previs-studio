// diagram 层与上游 MONOFORM 状态的唯一耦合点（fork-discipline 纪律 1）。
// src/diagram/ 内除本文件外，禁止出现上游专有字段名（关键帧轨道、人物体型/相位/骨骼等结构，见审查门 grep）。
// 依赖注入：适配器不自持状态，全部读写经 deps 走 App.jsx 既有状态更新与历史栈。

import { patchDiagram as mergeDiagramPatch } from './diagramData.js'
import { headingYawRad } from './gizmos/frustum.js'

const isFiniteNumber = value => Number.isFinite(value)

// 上游对象 → diagram 视图模型。position[1] 为高度（只读）；yaw 为全量欧拉反推的水平朝向
// （headingYawRad——rotation[1] 在 three 分解翻支后会镜像，见 frustum.js）。
export function objectToView(object) {
  if (!object) return null
  const position = Array.isArray(object.position) ? object.position : [0, 0, 0]
  const rotation = Array.isArray(object.rotation) ? object.rotation : [0, 0, 0]
  return {
    id: object.id,
    type: object.type,
    name: object.name,
    color: object.color,
    x: position[0],
    y: position[1],
    z: position[2],
    yaw: headingYawRad(rotation),
    scale: Array.isArray(object.scale) ? [...object.scale] : [1, 1, 1],
    pose: object.type === 'person' ? object.pose ?? null : null,
    locked: Boolean(object.locked),
  }
}

// 上摄像机 → 机位视图模型。focalLength/aspectRatio 供视锥角与画幅计算（T04）。
export function cameraToView(camera) {
  if (!camera) return null
  const position = Array.isArray(camera.position) ? camera.position : [0, 0, 0]
  const rotation = Array.isArray(camera.rotation) ? camera.rotation : [0, 0, 0]
  return {
    x: position[0],
    y: position[1],
    z: position[2],
    yaw: headingYawRad(rotation),
    focalLength: camera.focalLength,
    aspectRatio: camera.aspectRatio,
  }
}

// 单镜头快照 → 镜头视图模型（幽灵机位等 T03+ 消费）。
export function shotToView(shot) {
  if (!shot) return null
  return {
    id: shot.id,
    name: shot.name,
    objects: (Array.isArray(shot.objects) ? shot.objects : []).map(objectToView),
    camera: cameraToView(shot.camera),
  }
}

// layers 键级合并的合并内核统一在 diagramData.patchDiagram（T02 起与 App 网格开关共用）。

// deps:
//   getSnapshot    () => ({ objects, camera, shots, activeShotId, selectedId, diagram })
//   updateObject   (id, patch) => void   —— App.jsx 的 updateObjectById（内部走既有历史栈）
//   updateDiagram  (updater) => void     —— setDiagram(prev => ...)
export function createStateAdapter({ getSnapshot, updateObject, updateDiagram }) {
  const readSnapshot = () => {
    const snapshot = typeof getSnapshot === 'function' ? getSnapshot() : null
    return snapshot || {}
  }

  return {
    getScene() {
      const { objects, camera, selectedId } = readSnapshot()
      return {
        objects: (Array.isArray(objects) ? objects : []).map(objectToView),
        camera: cameraToView(camera),
        selectedId: selectedId ?? null,
      }
    },

    getActiveShot() {
      const { shots, activeShotId } = readSnapshot()
      const active = (Array.isArray(shots) ? shots : []).find(shot => shot.id === activeShotId) || null
      return shotToView(active)
    },

    // 除当前镜外的全部镜头视图（幽灵机位数据从 shots 现算，不落盘；渲染是 T05）
    getGhostShots() {
      const { shots, activeShotId } = readSnapshot()
      return (Array.isArray(shots) ? shots : [])
        .filter(shot => shot.id !== activeShotId)
        .map(shotToView)
    },

    // 顶视地面约束写回：只改 X/Z/yaw；Y 高度与其余两轴 rotation（俯仰/翻滚）原样保留。
    // 数值非法（非有限数）则忽略该字段；对象不存在或无可写字段时不调用 updateObject。
    setObjectPlane(id, { x, z, yaw } = {}) {
      const object = (readSnapshot().objects || []).find(item => item && item.id === id)
      if (!object) return
      const patch = {}
      if (isFiniteNumber(x) || isFiniteNumber(z)) {
        const position = [...(Array.isArray(object.position) ? object.position : [0, 0, 0])]
        if (isFiniteNumber(x)) position[0] = x
        if (isFiniteNumber(z)) position[2] = z
        patch.position = position
      }
      if (isFiniteNumber(yaw)) {
        const rotation = [...(Array.isArray(object.rotation) ? object.rotation : [0, 0, 0])]
        rotation[1] = yaw
        patch.rotation = rotation
      }
      if (!patch.position && !patch.rotation) return
      updateObject(id, patch)
    },

    // diagram 局部更新：浅合并顶层键、layers 键级合并，垃圾值由 normalizeDiagram 回退。
    patchDiagram(patch) {
      if (!patch || typeof patch !== 'object') return
      updateDiagram(prev => mergeDiagramPatch(prev, patch))
    },
  }
}
