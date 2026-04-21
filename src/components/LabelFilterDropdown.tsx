import { useState, useRef, useEffect } from 'react'
import type { LabelGroup } from '../api/linear'

interface Label {
  id: string
  name: string
  color: string
}

interface LabelFilterDropdownProps {
  labels: Label[]
  labelGroups: LabelGroup[]
  hiddenLabelIds: string[]
  onToggle: (id: string) => void
  onToggleGroup: (childIds: string[]) => void
  onShowAll: () => void
  onHideAll: () => void
}

export default function LabelFilterDropdown({
  labels,
  labelGroups,
  hiddenLabelIds,
  onToggle,
  onToggleGroup,
  onShowAll,
  onHideAll,
}: LabelFilterDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const hiddenCount = hiddenLabelIds.length
  const hasLabels = labels.length > 0

  // Determine which label IDs are in any group
  const groupedLabelIds = new Set(
    labelGroups.flatMap((g) => g.children.map((c) => c.id))
  )

  // Labels not belonging to any group
  const ungroupedLabels = labels.filter((l) => !groupedLabelIds.has(l.id))

  return (
    <div className="label-filter-wrap" ref={ref}>
      <button
        className={hiddenCount > 0 ? 'primary' : ''}
        onClick={() => setOpen((v) => !v)}
        title="Show/hide label swimlanes"
      >
        Labels {hiddenCount > 0 && <span className="sync-badge">{hiddenCount} hidden</span>}
        <span style={{ marginLeft: 4, fontSize: 10 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="label-filter-dropdown">
          <div className="label-filter-header">
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Label Swimlanes
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={onShowAll} style={{ padding: '2px 8px', fontSize: 11 }}>Show all</button>
              <button onClick={onHideAll} style={{ padding: '2px 8px', fontSize: 11 }}>Hide all</button>
            </div>
          </div>

          {!hasLabels && (
            <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
              No labels found on current projects.
            </div>
          )}

          <div className="label-filter-list">
            {/* Grouped labels */}
            {labelGroups.map((group) => {
              const childIds = group.children.map((c) => c.id)
              const allHidden = childIds.length > 0 && childIds.every((id) => hiddenLabelIds.includes(id))
              return (
                <div key={group.id}>
                  <div className="label-group-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {group.color && (
                        <span className="label-color-dot" style={{ background: group.color }} />
                      )}
                      <span>{group.name}</span>
                    </div>
                    <button
                      onClick={() => onToggleGroup(childIds)}
                      style={{ padding: '1px 6px', fontSize: 10 }}
                      title={allHidden ? 'Show group' : 'Hide group'}
                    >
                      {allHidden ? 'Show' : 'Hide'}
                    </button>
                  </div>
                  <div className="label-group-children">
                    {group.children.map((child) => {
                      const visible = !hiddenLabelIds.includes(child.id)
                      return (
                        <div
                          key={child.id}
                          className="label-filter-item"
                          onClick={() => onToggle(child.id)}
                        >
                          <input
                            type="checkbox"
                            checked={visible}
                            readOnly
                          />
                          <span className="label-color-dot" style={{ background: child.color }} />
                          <span>{child.name}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {/* Ungrouped labels */}
            {ungroupedLabels.map((label) => {
              const visible = !hiddenLabelIds.includes(label.id)
              return (
                <div
                  key={label.id}
                  className="label-filter-item"
                  onClick={() => onToggle(label.id)}
                >
                  <input
                    type="checkbox"
                    checked={visible}
                    readOnly
                  />
                  <span className="label-color-dot" style={{ background: label.color }} />
                  <span>{label.name}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
