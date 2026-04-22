import { useState, useRef, useEffect } from 'react'
import type { NamedView } from '../types'

interface ViewsDropdownProps {
  views: NamedView[]
  activeViewId: string | null
  isDirty: boolean
  onLoad: (viewId: string) => void
  onSave: () => void
  onSaveAsNew: (name: string) => void
  onRename: (viewId: string, name: string) => void
  onDelete: (viewId: string) => void
  onOverwrite: (viewId: string) => void
}

export default function ViewsDropdown({
  views,
  activeViewId,
  isDirty,
  onLoad,
  onSave,
  onSaveAsNew,
  onRename,
  onDelete,
  onOverwrite,
}: ViewsDropdownProps) {
  const [open, setOpen] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [savingNew, setSavingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const newNameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
        setRenamingId(null)
        setSavingNew(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingId])

  useEffect(() => {
    if (savingNew && newNameInputRef.current) {
      newNameInputRef.current.focus()
    }
  }, [savingNew])

  const activeView = views.find((v) => v.id === activeViewId)

  const buttonLabel = activeView
    ? (isDirty ? `● ${activeView.name}` : activeView.name)
    : (isDirty ? '● Unsaved view' : 'Views')

  function commitRename() {
    if (renamingId && renameValue.trim()) {
      onRename(renamingId, renameValue.trim())
    }
    setRenamingId(null)
  }

  function commitSaveAsNew() {
    const name = newName.trim()
    if (name) onSaveAsNew(name)
    setNewName('')
    setSavingNew(false)
    setOpen(false)
  }

  function startRename(view: NamedView, e: React.MouseEvent) {
    e.stopPropagation()
    setRenamingId(view.id)
    setRenameValue(view.name)
  }

  function handleDeleteClick(viewId: string, e: React.MouseEvent) {
    e.stopPropagation()
    onDelete(viewId)
  }

  return (
    <div className="views-dropdown-wrap" ref={wrapRef}>
      <button
        className={activeViewId ? (isDirty ? 'primary' : '') : (isDirty ? 'primary' : '')}
        onClick={() => setOpen((v) => !v)}
        title="Manage saved views"
        style={{ minWidth: 100 }}
      >
        {buttonLabel}
        <span style={{ marginLeft: 4, fontSize: 10 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="views-dropdown">
          <div className="views-dropdown-header">
            <span>Saved Views</span>
            {activeViewId && isDirty && (
              <button
                style={{ padding: '2px 8px', fontSize: 11 }}
                onClick={() => { onSave(); setOpen(false) }}
                title="Save changes to current view"
              >
                Save
              </button>
            )}
          </div>

          <div className="views-dropdown-list">
            {views.length === 0 && (
              <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                No saved views yet.
              </div>
            )}
            {views.map((view) => (
              <div
                key={view.id}
                className={`views-dropdown-item${view.id === activeViewId ? ' active' : ''}`}
                onClick={() => { onLoad(view.id); setOpen(false) }}
              >
                {renamingId === view.id ? (
                  <input
                    ref={renameInputRef}
                    className="views-dropdown-item-name-input"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename()
                      if (e.key === 'Escape') setRenamingId(null)
                      e.stopPropagation()
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="views-dropdown-item-name">{view.name}</span>
                )}
                <div className="views-dropdown-item-actions">
                  <button
                    className="views-dropdown-item-btn"
                    title="Overwrite with current state"
                    onClick={(e) => { e.stopPropagation(); onOverwrite(view.id); setOpen(false) }}
                  >
                    ↑
                  </button>
                  <button
                    className="views-dropdown-item-btn"
                    title="Rename"
                    onClick={(e) => startRename(view, e)}
                  >
                    ✎
                  </button>
                  <button
                    className="views-dropdown-item-btn danger"
                    title="Delete"
                    onClick={(e) => handleDeleteClick(view.id, e)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="views-dropdown-footer">
            {savingNew ? (
              <input
                ref={newNameInputRef}
                style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--accent)', borderRadius: 4, color: 'var(--text)', fontSize: 12, padding: '3px 7px', outline: 'none' }}
                placeholder="View name…"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={() => { if (!newName.trim()) { setSavingNew(false) } }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitSaveAsNew()
                  if (e.key === 'Escape') { setSavingNew(false); setNewName('') }
                }}
              />
            ) : (
              <button
                style={{ flex: 1, fontSize: 12 }}
                onClick={() => setSavingNew(true)}
              >
                + Save current as new view
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
