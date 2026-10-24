// 顶视 HUD 覆盖层（T02 design §5；T05 扩展图层面板）：纯 HTML/SVG，经接缝 S1 挂载于 viewport-canvas-layer。
// 方向标（N = -Z）、比例尺（pickScaleBar 换算）、网格开关（保留 T02 双入口之一，状态 = diagram.layers.grid）、
// 退出顶视快捷钮。T05 追加右侧可折叠竖排面板（design §4）：图层七开关（写 diagram.layers）、
// 轴线人物双下拉（写 diagram.axisPair）、视线目标下拉（写 diagram.gazeTargets，含清除）、
// 锁定画布（运行时态，经 onToggleLock 回调 App，不落盘）。全部经 onPatchDiagram 走 patchDiagram 合并。

import { useState } from 'react'
import { pickScaleBar } from './topView.js'
import { personOptions, targetOptions } from './annotations/data.js'

const LAYER_ITEMS = [
  { key: 'grid', label: '网格' },
  { key: 'labels', label: '标签' },
  { key: 'frustum', label: '视锥' },
  { key: 'axis', label: '轴线' },
  { key: 'sight', label: '视线' },
  { key: 'paths', label: '路径' },
  { key: 'ghosts', label: '幽灵机位' },
]

const AXIS_AUTO = ''

// 图层面板（全部我们的 DOM/类名；diagram/objects 由 App 接缝透传，面板内经 data.js 纯函数取下拉数据）
function LayerPanel({ diagram, objects, onPatchDiagram, canvasLocked, onToggleLock }) {
  const layers = diagram?.layers || {}
  const persons = personOptions(objects)
  const targets = targetOptions(objects)
  const axisPair = diagram?.axisPair || null
  const gazeTargets = diagram?.gazeTargets || {}
  const [gazeActor, setGazeActor] = useState('')
  const actorId = gazeActor || persons[0]?.id || ''
  const actorTarget = gazeTargets[actorId]?.objectId || ''

  const patchLayer = key => onPatchDiagram({ layers: { [key]: layers[key] === false } })

  // 轴线双下拉：任一端选「自动」→ 整体回 null（默认前两名）；对端为空时自动补首个不同人物，写值恒为合法 pair
  const patchAxis = (slot, value) => {
    if (!value) {
      onPatchDiagram({ axisPair: null })
      return
    }
    const current = [axisPair?.[0] ?? AXIS_AUTO, axisPair?.[1] ?? AXIS_AUTO]
    current[slot] = value
    const otherSlot = slot === 0 ? 1 : 0
    if (current[otherSlot] === AXIS_AUTO) {
      current[otherSlot] = persons.find(person => person.id !== value)?.id || AXIS_AUTO
    }
    if (current[0] === AXIS_AUTO || current[1] === AXIS_AUTO || current[0] === current[1]) {
      onPatchDiagram({ axisPair: null })
      return
    }
    onPatchDiagram({ axisPair: [current[0], current[1]] })
  }

  // 视线目标：清除 → 删键；选对象 → 写 {objectId}（地面点数据结构支持、点选 UI 本期不做——design §4 偏离项）
  const patchGazeTarget = objectId => {
    const next = { ...gazeTargets }
    if (!objectId) delete next[actorId]
    else next[actorId] = { objectId }
    onPatchDiagram({ gazeTargets: next })
  }

  const axisSlotOptions = slot => {
    const other = axisPair?.[slot === 0 ? 1 : 0]
    return persons.filter(person => person.id !== other)
  }

  return (
    <div className="dg-layer-panel" role="group" aria-label="标注图层与锁定">
      <div className="dg-layer-group">
        <span className="dg-layer-title">图层</span>
        <div className="dg-layer-toggles">
          {LAYER_ITEMS.map(item => (
            <label key={item.key} className={layers[item.key] === false ? '' : 'is-on'}>
              <input type="checkbox" checked={layers[item.key] !== false} onChange={() => patchLayer(item.key)} />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="dg-layer-group">
        <span className="dg-layer-title">轴线人物</span>
        {[0, 1].map(slot => (
          <label key={slot} className="dg-layer-select">
            <span>{slot === 0 ? 'A' : 'B'}</span>
            <select value={axisPair?.[slot] ?? AXIS_AUTO} onChange={event => autoFill(slot, event.target.value)} disabled={persons.length === 0}>
              <option value={AXIS_AUTO}>自动（前两名）</option>
              {axisSlotOptions(slot).map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
          </label>
        ))}
      </div>
      <div className="dg-layer-group">
        <span className="dg-layer-title">视线目标</span>
        <label className="dg-layer-select">
          <span>人</span>
          <select value={actorId} onChange={event => setGazeActor(event.target.value)} disabled={persons.length === 0}>
            {persons.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
        </label>
        <label className="dg-layer-select">
          <span>看</span>
          <select value={actorTarget} onChange={event => patchGazeTarget(event.target.value)} disabled={!actorId}>
            <option value="">（清除 · 定长虚线）</option>
            {targets.filter(target => target.id !== actorId).map(target => <option key={target.id} value={target.id}>{target.name}</option>)}
          </select>
        </label>
      </div>
      <button type="button" className={`dg-layer-lock ${canvasLocked ? 'is-active' : ''}`} onClick={onToggleLock} title="锁定画布为只读（教师演示用，不随工程保存）">
        {canvasLocked ? '已锁定画布' : '锁定画布'}
      </button>
    </div>
  )
}

export function TopViewOverlay({ worldPerPx = 0, onExit, onExportDiagram, gridOn = true, onToggleGrid, halfGridOn = true, onToggleHalfGrid, diagram = null, objects = [], onPatchDiagram, canvasLocked = false, onToggleLock }) {
  const [panelOpen, setPanelOpen] = useState(true)
  const bar = pickScaleBar(worldPerPx)
  return (
    <div className="dg-topview-overlay">
      <div className="dg-topview-compass" aria-label="方向标：上为北（-Z）">
        <svg viewBox="0 0 44 48" width="44" height="48" aria-hidden="true">
          <circle cx="22" cy="20" r="15" fill="rgba(244,241,234,.85)" stroke="#8f897c" strokeWidth="1" />
          <path d="M22 7.5 L26 23 L22 19.8 L18 23 Z" fill="#4b6a8f" />
          <text x="22" y="45" textAnchor="middle" className="dg-compass-north">N</text>
        </svg>
        <span className="dg-compass-note">北 · −Z</span>
      </div>
      <div className="dg-topview-scale" aria-label="比例尺">
        {bar.px > 0 ? (
          <>
            <span className="dg-scale-line" style={{ width: `${bar.px}px` }} />
            <span className="dg-scale-read">{bar.meters} m</span>
          </>
        ) : <span className="dg-scale-read dg-scale-pending">比例尺待缩放上报</span>}
      </div>
      <div className="dg-topview-actions">
        {onExportDiagram && <button type="button" onClick={onExportDiagram} title="导出白底机位图 PNG（含符号/标签/图例/比例尺）">导出机位图</button>}
        <button type="button" className={gridOn ? 'is-active' : ''} onClick={onToggleGrid} title="顶视米制网格（随工程保存）">网格</button>
        <button type="button" className={halfGridOn ? 'is-active' : ''} onClick={onToggleHalfGrid} disabled={!gridOn} title="0.5m 次格（本次会话）">0.5m</button>
        <button type="button" className="dg-topview-exit" onClick={onExit}>退出顶视</button>
        <button type="button" className={panelOpen ? 'is-active' : ''} onClick={() => setPanelOpen(value => !value)} title="标注图层面板">图层</button>
      </div>
      {panelOpen && <LayerPanel diagram={diagram} objects={objects} onPatchDiagram={onPatchDiagram} canvasLocked={canvasLocked} onToggleLock={onToggleLock} />}
    </div>
  )
}
