// 「项目」面板（S8 的 UI 本体）。纯展示哑组件：不碰 IndexedDB、不含工程数据逻辑，
// 全部操作经回调由 App 接缝执行；行内重命名交互与场景层级（S6）同模式。
// 「课堂预设」分组（T11 · S8 延伸）：只消费 builtinPresets props 做展示，
// 不依赖工程库（unavailable 时仍可见），载入动作经 onLoadBuiltinPreset 回调交 App。
import { useRef, useState } from 'react'
import { Film, Pencil, Plus, Trash2 } from 'lucide-react'
import { relativeTime } from './projectStore.js'

export function ProjectsPanel({ entries, activeProjectId, busy = false, unavailable = false, builtinPresets = [], onLoadBuiltinPreset, onOpen, onNew, onDuplicate, onRename, onDelete, onExport }) {
  const [editingId, setEditingId] = useState(null)
  const [draftName, setDraftName] = useState('')
  // Esc 与 blur 会连续触发：置位后 blur 分支据此跳过提交，直接还原原名
  const cancelRef = useRef(false)
  const beginRename = (id, name) => { setEditingId(id); setDraftName(name || '') }
  const now = Date.now()
  return (
    <div className="dg-projects-panel">
      <div className="dg-projects-head">
        <div><strong>项目库</strong><small>{entries.length} {entries.length === 1 ? 'PROJECT' : 'PROJECTS'}</small></div>
        <button type="button" onClick={onNew} disabled={busy || unavailable}><Plus size={13} /> 新建</button>
      </div>
      <div className="dg-projects-head">
        <div><strong>课堂预设</strong><small>{builtinPresets.length} {builtinPresets.length === 1 ? 'PRESET' : 'PRESETS'}</small></div>
      </div>
      <div className="dg-projects-list">
        {builtinPresets.map(preset => (
          <article className="dg-projects-row" key={preset.id}>
            <span className="dg-projects-cover"><Film size={16} /></span>
            <div className="dg-projects-copy">
              <span className="dg-projects-name">{preset.data?.settings?.name || preset.label}</span>
              <small>{preset.data?.shots?.length ?? 0} 镜头 · 内置母版</small>
            </div>
            <div className="dg-projects-actions">
              <button type="button" onClick={() => onLoadBuiltinPreset(preset)}>载入</button>
            </div>
          </article>
        ))}
      </div>
      {unavailable ? (
        <p className="dg-projects-unavailable">项目库不可用（浏览器隐私模式或存储被禁用？）。工程仍会自动保存到本浏览器单槽，可继续正常编辑，但无法管理多个项目。</p>
      ) : (
        <div className="dg-projects-list">
          {entries.map(entry => {
            const active = entry.id === activeProjectId
            return (
              <article className={`dg-projects-row ${active ? 'is-active' : ''}`} key={entry.id}>
                <span className="dg-projects-cover">{entry.cover ? <img src={entry.cover} alt="" /> : <Film size={16} />}</span>
                <div className="dg-projects-copy">
                  {editingId === entry.id ? (
                    <input
                      className="dg-projects-rename-input"
                      value={draftName}
                      maxLength="40"
                      autoFocus
                      aria-label={`${entry.name} 重命名`}
                      onFocus={event => event.target.select()}
                      onClick={event => event.stopPropagation()}
                      onChange={event => setDraftName(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === 'Enter') event.currentTarget.blur()
                        else if (event.key === 'Escape') { cancelRef.current = true; event.currentTarget.blur() }
                      }}
                      onBlur={() => {
                        if (cancelRef.current) { cancelRef.current = false; setEditingId(null); return }
                        const trimmed = draftName.trim()
                        if (trimmed && trimmed !== entry.name) onRename(entry.id, trimmed)
                        setEditingId(null)
                      }}
                    />
                  ) : (
                    <span className="dg-projects-name" onDoubleClick={() => beginRename(entry.id, entry.name)} title="双击重命名">{entry.name}</span>
                  )}
                  <small>{entry.shotCount} 镜头 · {relativeTime(now, entry.updatedAt) || '—'}</small>
                </div>
                {active && <em className="dg-projects-active">ACTIVE</em>}
                <div className="dg-projects-actions">
                  <button type="button" onClick={() => onOpen(entry.id)} disabled={active || busy}>打开</button>
                  <button type="button" onClick={() => onDuplicate(entry.id)} disabled={busy}><Plus size={11} /> 复制</button>
                  <button type="button" onClick={() => beginRename(entry.id, entry.name)} disabled={busy}><Pencil size={11} /> 更名</button>
                  <button type="button" onClick={() => onExport(entry.id)} disabled={busy}>导出</button>
                  <button type="button" className="dg-projects-delete" title={`删除“${entry.name}”`} aria-label={`删除“${entry.name}”`} onClick={() => onDelete(entry.id)} disabled={active || busy}><Trash2 size={12} /></button>
                </div>
              </article>
            )
          })}
          {!entries.length && <p className="dg-projects-empty">项目库为空。点击「新建」创建第一个项目，或用顶栏「打开」导入 JSON 工程。</p>}
        </div>
      )}
      {busy && <div className="dg-projects-busy">项目库处理中…</div>}
      <p className="dg-projects-note">项目保存在本浏览器（IndexedDB）：按 电脑+浏览器+域名 隔离。双击名称可重命名；导出的 JSON 与原版 MONOFORM 兼容。</p>
    </div>
  )
}
