// 解析滑块输入草稿：去单位、判空、判有限数、判边界；返回对齐 step 网格的数值，非法返回 null
export function parseSliderDraft(text, { min, max, step = 1, unit = '' }) {
  let raw = String(text ?? '').trim()
  if (unit) raw = raw.replaceAll(unit, '').trim()
  if (!raw) return null
  const value = Number(raw)
  if (!Number.isFinite(value)) return null
  if (value < min || value > max) return null
  return snapToStep(value, step)
}

export function snapToStep(value, step) {
  const s = Number.isFinite(step) && step > 0 ? step : 1
  return Number((Math.round(value / s) * s).toFixed(6))
}
