import { useRef, useState } from 'react'
import { parseSliderDraft } from './sliderNumber.js'

export function SliderNumberInput({ value, min, max, step = 1, digits = 0, unit = '', disabled = false, onChange, ariaLabel }) {
  // draft 为 null 表示非编辑态，直接显示滑块当前值；draftRef 供 blur 时读取最终草稿
  const [draft, setDraft] = useState(null)
  const draftRef = useRef(null)
  // dirty：用户是否实际改过文本。未改动的 focus+blur 必须零写入——否则显示值不在 step
  // 网格上时（比例缩放/插值/拖 gizmo 产生的连续值），仅聚焦再失焦就会被静默吸附改值
  const dirtyRef = useRef(false)
  // Esc 与 blur 会连续触发：置位后 blur 分支据此跳过提交，直接还原原名
  const cancelRef = useRef(false)
  const commit = () => {
    const text = draftRef.current
    draftRef.current = null
    setDraft(null)
    const edited = dirtyRef.current
    dirtyRef.current = false
    if (!edited) return
    const parsed = parseSliderDraft(text, { min, max, step, unit })
    if (parsed !== null && parsed !== Number(value)) onChange(parsed)
  }
  return (
    <input
      className="dg-slider-number-input"
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      disabled={disabled}
      value={draft ?? `${Number(value).toFixed(digits)}${unit}`}
      onFocus={event => {
        const text = Number(value).toFixed(digits)
        draftRef.current = text
        dirtyRef.current = false
        setDraft(text)
        event.target.select()
      }}
      onChange={event => {
        const text = event.target.value
        if (text !== draftRef.current) dirtyRef.current = true
        draftRef.current = text
        setDraft(text)
      }}
      onKeyDown={event => {
        if (event.key === 'Enter') { commit(); event.currentTarget.blur() }
        else if (event.key === 'Escape') { cancelRef.current = true; draftRef.current = null; setDraft(null); event.currentTarget.blur() }
      }}
      onBlur={() => {
        if (cancelRef.current) { cancelRef.current = false; return }
        commit()
      }}
    />
  )
}
