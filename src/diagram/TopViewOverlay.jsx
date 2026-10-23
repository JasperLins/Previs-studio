// 顶视 HUD 覆盖层（T02 design §5）：纯 HTML/SVG，经接缝 S1 挂载于 viewport-canvas-layer。
// 方向标（N = -Z）、比例尺（pickScaleBar 换算）、网格开关、退出顶视快捷钮。

import { pickScaleBar } from './topView.js'

export function TopViewOverlay({ worldPerPx = 0, onExit, gridOn = true, onToggleGrid, halfGridOn = true, onToggleHalfGrid }) {
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
        <button type="button" className={gridOn ? 'is-active' : ''} onClick={onToggleGrid} title="顶视米制网格（随工程保存）">网格</button>
        <button type="button" className={halfGridOn ? 'is-active' : ''} onClick={onToggleHalfGrid} disabled={!gridOn} title="0.5m 次格（本次会话）">0.5m</button>
        <button type="button" className="dg-topview-exit" onClick={onExit}>退出顶视</button>
      </div>
    </div>
  )
}
