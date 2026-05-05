import { useState, useRef, useEffect } from 'react'
import type { Team, SwimlaneMode, NamedView } from '../types'
import type { LabelGroup } from '../api/linear'
import LabelFilterDropdown from './LabelFilterDropdown'
import ViewsDropdown from './ViewsDropdown'

interface Label { id: string; name: string; color: string }

interface ToolbarProps {
  teams: Team[]
  selectedTeamIds: string[]
  onTeamToggle: (id: string) => void
  onClearTeams: () => void
  swimlaneMode: SwimlaneMode | undefined
  onSwimlaneModeChange: (mode: SwimlaneMode) => void
  currentPpd: number
  onZoomIn: () => void
  onZoomOut: () => void
  allLabels: Label[]
  labelGroups: LabelGroup[]
  hiddenLabelIds: string[]
  onToggleLabel: (id: string) => void
  onToggleGroup: (childIds: string[]) => void
  onShowAllLabels: () => void
  onHideAllLabels: () => void
  allInitiatives: Label[]
  hiddenInitiativeIds: string[]
  onToggleInitiative: (id: string) => void
  onShowAllInitiatives: () => void
  onHideAllInitiatives: () => void
  pendingCount: number
  onSync: () => void
  onAddMilestone: () => void
  onRefresh: () => void
  onLogout: () => void
  loading: boolean
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  views: NamedView[]
  activeViewId: string | null
  isViewDirty: boolean
  onLoadView: (viewId: string) => void
  onSaveView: () => void
  onSaveAsNewView: (name: string) => void
  onRenameView: (viewId: string, name: string) => void
  onDeleteView: (viewId: string) => void
  onOverwriteView: (viewId: string) => void
}

function granularityLabel(ppd: number): string {
  if (ppd >= 18)  return 'Days'
  if (ppd >= 7)   return 'Weeks'
  if (ppd >= 2.5) return 'Months'
  if (ppd >= 1)   return 'Quarters'
  return 'Years'
}

export default function Toolbar({
  teams,
  selectedTeamIds,
  onTeamToggle,
  onClearTeams,
  swimlaneMode,
  onSwimlaneModeChange,
  currentPpd,
  onZoomIn,
  onZoomOut,
  allLabels,
  labelGroups,
  hiddenLabelIds,
  onToggleLabel,
  onToggleGroup,
  onShowAllLabels,
  onHideAllLabels,
  allInitiatives,
  hiddenInitiativeIds,
  onToggleInitiative,
  onShowAllInitiatives,
  onHideAllInitiatives,
  pendingCount,
  onSync,
  onAddMilestone,
  onRefresh,
  onLogout,
  loading,
  theme,
  onToggleTheme,
  views,
  activeViewId,
  isViewDirty,
  onLoadView,
  onSaveView,
  onSaveAsNewView,
  onRenameView,
  onDeleteView,
  onOverwriteView,
}: ToolbarProps) {
  const currentMode = swimlaneMode ?? 'initiative'

  const [teamDropOpen, setTeamDropOpen] = useState(false)
  const teamDropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!teamDropOpen) return
    function handleClick(e: MouseEvent) {
      if (teamDropRef.current && !teamDropRef.current.contains(e.target as Node)) {
        setTeamDropOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [teamDropOpen])

  const teamLabel =
    selectedTeamIds.length === 0 ? 'All Teams'
    : selectedTeamIds.length === 1 ? (teams.find((t) => t.id === selectedTeamIds[0])?.name ?? '1 Team')
    : `${selectedTeamIds.length} Teams`

  return (
    <div className="toolbar">
      <span className="toolbar-title">Linear Roadmap</span>

      <div className="toolbar-divider" />

      <ViewsDropdown
        views={views}
        activeViewId={activeViewId}
        isDirty={isViewDirty}
        onLoad={onLoadView}
        onSave={onSaveView}
        onSaveAsNew={onSaveAsNewView}
        onRename={onRenameView}
        onDelete={onDeleteView}
        onOverwrite={onOverwriteView}
      />

      <div className="toolbar-divider" />

      <div className="swimlane-toggle">
        <button
          className={currentMode === 'initiative' ? 'active' : ''}
          onClick={() => onSwimlaneModeChange('initiative')}
        >
          By Initiative
        </button>
        <button
          className={currentMode === 'label' ? 'active' : ''}
          onClick={() => onSwimlaneModeChange('label')}
        >
          By Label
        </button>
        <button
          className={currentMode === 'team' ? 'active' : ''}
          onClick={() => onSwimlaneModeChange('team')}
        >
          By Team
        </button>
      </div>

      <div className="label-filter-wrap" ref={teamDropRef}>
        <button
          className={selectedTeamIds.length > 0 ? 'primary' : ''}
          onClick={() => setTeamDropOpen((v) => !v)}
          style={{ minWidth: 100 }}
        >
          {teamLabel}
          <span style={{ marginLeft: 4, fontSize: 10 }}>{teamDropOpen ? '▲' : '▼'}</span>
        </button>

        {teamDropOpen && (
          <div className="label-filter-dropdown">
            <div className="label-filter-header">
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Teams
              </span>
              {selectedTeamIds.length > 0 && (
                <button onClick={() => { onClearTeams(); setTeamDropOpen(false) }} style={{ padding: '2px 8px', fontSize: 11 }}>
                  Show all
                </button>
              )}
            </div>
            <div className="label-filter-list">
              {teams.map((t) => {
                const checked = selectedTeamIds.includes(t.id)
                return (
                  <div key={t.id} className="label-filter-item" onClick={() => onTeamToggle(t.id)}>
                    <input type="checkbox" checked={checked} readOnly />
                    <span>{t.name}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {allInitiatives.length > 0 && (
        <LabelFilterDropdown
          labels={allInitiatives}
          labelGroups={[]}
          hiddenLabelIds={hiddenInitiativeIds}
          onToggle={onToggleInitiative}
          onToggleGroup={() => {}}
          onShowAll={onShowAllInitiatives}
          onHideAll={onHideAllInitiatives}
          title="Initiative Swimlanes"
          buttonLabel="Initiatives"
        />
      )}

      <LabelFilterDropdown
        labels={allLabels}
        labelGroups={labelGroups}
        hiddenLabelIds={hiddenLabelIds}
        onToggle={onToggleLabel}
        onToggleGroup={onToggleGroup}
        onShowAll={onShowAllLabels}
        onHideAll={onHideAllLabels}
        title={currentMode === 'label' ? 'Label Swimlanes' : 'Filter by Label'}
        buttonLabel="Labels"
      />

      <div className="toolbar-divider" />

      <div className="zoom-controls">
        <button
          onClick={onZoomOut}
          title="Zoom out"
          style={{ padding: '4px 8px', fontSize: 14, lineHeight: 1 }}
        >
          −
        </button>
        <span className="zoom-label" title="Granularity">
          {granularityLabel(currentPpd)}
        </span>
        <button
          onClick={onZoomIn}
          title="Zoom in"
          style={{ padding: '4px 8px', fontSize: 14, lineHeight: 1 }}
        >
          +
        </button>
      </div>

      {loading && <div className="toolbar-spinner" title="Loading..." />}

      <div className="toolbar-spacer" />

      <button onClick={onAddMilestone} title="Manage deadlines and milestones">
        Deadlines
      </button>

      <button
        onClick={onSync}
        className={pendingCount > 0 ? 'primary' : ''}
        title="Sync pending changes to Linear"
      >
        Sync
        {pendingCount > 0 && (
          <span className="sync-badge">{pendingCount}</span>
        )}
      </button>

      <button onClick={onRefresh} title="Refresh data" style={{ padding: '6px 10px' }}>
        ↻
      </button>

      <button
        onClick={onToggleTheme}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        style={{ padding: '6px 10px', fontSize: 16, lineHeight: 1 }}
      >
        {theme === 'dark' ? '☀' : '🌙'}
      </button>

      <div className="toolbar-divider" />

      <button onClick={onLogout} className="danger" style={{ padding: '6px 10px' }}>
        Logout
      </button>
    </div>
  )
}
