import { useState } from 'react'
import type { Milestone } from '../types'

interface MilestonePanelProps {
  milestones: Milestone[]
  viewStartDate?: string
  viewEndDate?: string
  onSave: (milestones: Milestone[], viewStartDate?: string, viewEndDate?: string) => void
  onClose: () => void
}

const PRESET_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#6366f1',
  '#a855f7',
  '#ec4899',
  '#64748b',
  '#ffffff',
]

function generateId() {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export default function MilestonePanel({
  milestones,
  viewStartDate,
  viewEndDate,
  onSave,
  onClose,
}: MilestonePanelProps) {
  const [items, setItems] = useState<Milestone[]>(() =>
    milestones.map((m) => ({ ...m }))
  )
  const [rangeStart, setRangeStart] = useState(viewStartDate ?? '')
  const [rangeEnd, setRangeEnd] = useState(viewEndDate ?? '')

  function addMilestone() {
    setItems((prev) => [
      ...prev,
      {
        id: generateId(),
        label: 'New Deadline',
        date: new Date().toISOString().split('T')[0]!,
        color: '#6366f1',
        hidden: false,
      },
    ])
  }

  function updateField(id: string, field: keyof Milestone, value: string | boolean) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    )
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  function handleSave() {
    onSave(items, rangeStart || undefined, rangeEnd || undefined)
    onClose()
  }

  return (
    <div className="panel-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="milestone-panel">
        <div className="panel-header">
          <span className="panel-title">Deadlines &amp; View Range</span>
          <button onClick={onClose} style={{ padding: '4px 8px', fontSize: 16 }}>✕</button>
        </div>

        <div className="panel-body">
          {/* Timeline cutoffs */}
          <div className="panel-section-title">Timeline Range</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 120 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Start cutoff</span>
              <input
                type="date"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                placeholder="Auto"
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 120 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>End cutoff</span>
              <input
                type="date"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                placeholder="Auto"
              />
            </label>
            {(rangeStart || rangeEnd) && (
              <button
                style={{ alignSelf: 'flex-end', padding: '6px 10px', fontSize: 12 }}
                onClick={() => { setRangeStart(''); setRangeEnd('') }}
              >
                Clear
              </button>
            )}
          </div>

          <div className="panel-section-title">Deadline Flags</div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            Deadlines are global and persist across all team views.
            Use the eye icon to show/hide individual flags on the roadmap.
          </p>

          {items.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 16 }}>
              No deadlines yet.
            </div>
          )}

          {items.map((item) => (
            <div key={item.id} className={`milestone-item${item.hidden ? ' milestone-hidden' : ''}`}>
              <div className="milestone-item-row">
                <button
                  className="milestone-visibility-btn"
                  onClick={() => updateField(item.id, 'hidden', !item.hidden)}
                  title={item.hidden ? 'Show on roadmap' : 'Hide from roadmap'}
                >
                  {item.hidden ? '🙈' : '👁'}
                </button>
                <input
                  type="text"
                  value={item.label}
                  onChange={(e) => updateField(item.id, 'label', e.target.value)}
                  placeholder="Deadline name"
                  style={{ flex: 1 }}
                />
                <input
                  type="date"
                  value={item.date}
                  onChange={(e) => updateField(item.id, 'date', e.target.value)}
                  style={{ width: 130 }}
                />
                <button
                  className="danger"
                  onClick={() => removeItem(item.id)}
                  style={{ padding: '4px 8px', fontSize: 12, flexShrink: 0 }}
                >
                  ✕
                </button>
              </div>

              <div className="milestone-item-row" style={{ paddingLeft: 36 }}>
                <div className="color-swatches">
                  {PRESET_COLORS.map((color) => (
                    <div
                      key={color}
                      className={`color-swatch${item.color === color ? ' selected' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => updateField(item.id, 'color', color)}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}

          <button className="add-milestone-btn" onClick={addMilestone}>
            + Add Deadline
          </button>
        </div>

        <div className="panel-footer">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}
