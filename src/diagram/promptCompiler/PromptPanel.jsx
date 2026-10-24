// 「机位词」面板（T06 接缝 S4 的 UI 本体）。纯展示 + 动作层输入：
// 五层分层展示 + 镜头描述卡 + 复制全文 + 导出 TXT + 动作层草稿（经 onActionChange 持久化到 diagram.promptDrafts）。

import { useMemo, useState } from 'react'

function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text)
  return new Promise(resolve => {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    resolve()
  })
}

export function PromptPanel({ layers, text, actionLine, onActionChange, shotName, projectName, onToast }) {
  const [toastLocal, setToastLocal] = useState('')
  const fileName = useMemo(() => {
    const safe = value => String(value || '').replace(/[\\/:*?"<>|]+/g, '-').trim()
    return `${safe(projectName) || '工程'}_${safe(shotName) || '镜头'}_机位词.txt`
  }, [projectName, shotName])

  const handleCopy = () => {
    copyText(text).then(() => {
      setToastLocal('已复制全文')
      onToast?.('机位词已复制到剪贴板')
      setTimeout(() => setToastLocal(''), 1600)
    })
  }
  const handleExport = () => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = fileName
    link.click()
    URL.revokeObjectURL(link.href)
    onToast?.(`已导出 ${fileName}`)
  }

  const LAYER_TITLES = [['framing', '取景'], ['blocking', '人物站位'], ['scene', '场景'], ['action', '动作层'], ['consistency', '一致性']]

  return (
    <div className="dg-prompt-panel">
      <div className="dg-prompt-head">
        <strong>机位词 · {shotName || '当前镜'}</strong>
        <div className="dg-prompt-actions">
          <button type="button" onClick={handleCopy}>复制全文</button>
          <button type="button" onClick={handleExport}>导出 TXT</button>
        </div>
      </div>
      <div className="dg-prompt-layers">
        {LAYER_TITLES.map(([key, title]) => (
          <div key={key} className={`dg-prompt-layer ${key === 'action' ? 'is-action' : ''}`}>
            <span>{title}</span>
            {key === 'action' ? (
              <textarea
                value={actionLine}
                placeholder="一句话动作（人工填写，随工程保存）"
                onChange={event => onActionChange?.(event.target.value)}
                rows={2}
              />
            ) : (
              <p>{layers?.[key] || '—'}</p>
            )}
          </div>
        ))}
      </div>
      <div className="dg-prompt-card">
        <span>镜头描述卡</span>
        <pre>{text}</pre>
      </div>
      {toastLocal && <div className="dg-prompt-toast">{toastLocal}</div>}
    </div>
  )
}
