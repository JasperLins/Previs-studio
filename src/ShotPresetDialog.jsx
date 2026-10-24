// 「添加机位」预设面板（S9 的 UI 本体）。受控哑组件：零业务、无本地状态，
// 预设表由 App 传入（SHOT_CAMERA_PRESETS），选择/取消经回调由 App 接缝执行。
import { useEffect } from 'react'
import { Camera, X } from 'lucide-react'

export default function ShotPresetDialog({ object, presets, onPick, onCancel }) {
  useEffect(() => {
    const onKeyDown = event => { if (event.key === 'Escape') onCancel?.() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])
  return (
    <div className="dg-shot-preset-overlay" onPointerDown={event => { if (event.target === event.currentTarget) onCancel?.() }}>
      <div className="dg-shot-preset-dialog" role="dialog" aria-modal="true" aria-label="添加机位">
        <div className="dg-shot-preset-head">
          <div className="dg-shot-preset-head-copy">
            <strong><Camera size={13} /> 添加机位</strong>
            <small>镜头将对准：{object?.name}</small>
          </div>
          <button type="button" className="dg-shot-preset-close" onClick={onCancel} aria-label="关闭添加机位面板"><X size={13} /></button>
        </div>
        <div className="dg-shot-preset-grid">
          {presets.map(preset => (
            <button type="button" key={preset.id} className="dg-shot-preset-option" onClick={() => onPick?.(preset.id)}>
              <strong>{preset.label}</strong>
              <small>{preset.hint}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
