import { useState, useEffect, useMemo, useRef } from 'react'
import type { PendingChange, RoadmapConfig, SwimlaneMode, NamedView } from '../types'
import { useLinearData } from '../hooks/useLinearData'
import { useRoadmapConfig } from '../hooks/useRoadmapConfig'
import { applyChanges } from '../api/linear'
import { collectLabels } from '../utils/swimlanes'
import Toolbar from './Toolbar'
import RoadmapCanvas from './RoadmapCanvas'
import type { RoadmapCanvasHandle } from './RoadmapCanvas'
import MilestonePanel from './MilestonePanel'
import SyncPanel from './SyncPanel'

interface RoadmapPageProps {
  apiKey: string
  onLogout: () => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}

function readUrlTeamIds(): string[] {
  const params = new URLSearchParams(window.location.search)
  const raw = params.get('teams')
  return raw ? raw.split(',').filter(Boolean) : []
}

function readUrlSwimlaneMode(): SwimlaneMode | null {
  const params = new URLSearchParams(window.location.search)
  const raw = params.get('mode')
  if (raw === 'initiative' || raw === 'label' || raw === 'team') return raw
  return null
}

export default function RoadmapPage({ apiKey, onLogout, theme, onToggleTheme }: RoadmapPageProps) {
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>(readUrlTeamIds)
  const [localSwimlaneMode, setLocalSwimlaneMode] = useState<SwimlaneMode | null>(readUrlSwimlaneMode)
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([])
  const [showMilestonePanel, setShowMilestonePanel] = useState(false)
  const [showSyncPanel, setShowSyncPanel] = useState(false)
  const [bannerError, setBannerError] = useState<string | null>(null)
  const [displayPpd, setDisplayPpd] = useState(320 / 91)
  const [activeViewId, setActiveViewId] = useState<string | null>(null)

  const canvasRef = useRef<RoadmapCanvasHandle>(null)

  const { teams, initiatives, projects, labelGroups, loading, error, refresh } = useLinearData(
    apiKey,
    selectedTeamIds
  )

  const { config, configLoading: _configLoading, configError, saveConfig } = useRoadmapConfig(
    apiKey,
    selectedTeamIds[0]
  )

  const effectiveConfig: RoadmapConfig = config ?? {
    version: 1,
    swimlaneMode: 'initiative',
    milestones: [],
  }

  const effectiveSwimlaneMode: SwimlaneMode = localSwimlaneMode ?? 'initiative'
  const views: NamedView[] = effectiveConfig.views ?? []

  useEffect(() => {
    if (config && localSwimlaneMode === null) {
      setLocalSwimlaneMode(config.swimlaneMode)
    }
  }, [config, localSwimlaneMode])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (selectedTeamIds.length > 0) {
      params.set('teams', selectedTeamIds.join(','))
    } else {
      params.delete('teams')
    }
    if (effectiveSwimlaneMode !== 'initiative') {
      params.set('mode', effectiveSwimlaneMode)
    } else {
      params.delete('mode')
    }
    const search = params.toString()
    window.history.replaceState(
      null,
      '',
      search ? `${window.location.pathname}?${search}` : window.location.pathname
    )
  }, [selectedTeamIds, effectiveSwimlaneMode])

  useEffect(() => {
    if (error) setBannerError(error)
  }, [error])

  useEffect(() => {
    if (configError) setBannerError(configError)
  }, [configError])

  const isViewDirty = useMemo(() => {
    if (!activeViewId) return false
    const view = views.find((v) => v.id === activeViewId)
    if (!view) return true
    const teamsSame =
      view.selectedTeamIds.length === selectedTeamIds.length &&
      view.selectedTeamIds.every((id) => selectedTeamIds.includes(id))
    const modeSame = view.swimlaneMode === effectiveSwimlaneMode
    const labelsSame =
      (view.hiddenLabelIds ?? []).length === (effectiveConfig.hiddenLabelIds ?? []).length &&
      (view.hiddenLabelIds ?? []).every((id) => (effectiveConfig.hiddenLabelIds ?? []).includes(id))
    return !teamsSame || !modeSame || !labelsSame
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeViewId, views, selectedTeamIds, effectiveSwimlaneMode, effectiveConfig.hiddenLabelIds])

  function handleProjectChange(change: PendingChange) {
    setPendingChanges((prev) => {
      const existing = prev.findIndex(
        (c) => c.projectId === change.projectId && c.field === change.field
      )
      if (existing >= 0) {
        const next = [...prev]
        next[existing] = change
        return next
      }
      return [...prev, change]
    })
  }

  function handleSwimlaneModeChange(mode: SwimlaneMode) {
    setLocalSwimlaneMode(mode)
    if (config) {
      void saveConfig({ ...config, swimlaneMode: mode })
    }
  }

  function handleTeamToggle(id: string) {
    setSelectedTeamIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
    setPendingChanges([])
  }

  function handleClearTeams() {
    setSelectedTeamIds([])
    setPendingChanges([])
  }

  function handleLoadView(viewId: string) {
    const view = views.find((v) => v.id === viewId)
    if (!view) return
    setSelectedTeamIds(view.selectedTeamIds)
    setLocalSwimlaneMode(view.swimlaneMode)
    void saveConfig({ ...effectiveConfig, hiddenLabelIds: view.hiddenLabelIds ?? [] })
    setActiveViewId(viewId)
    setPendingChanges([])
  }

  function handleSaveView() {
    if (!activeViewId) return
    handleOverwriteView(activeViewId)
  }

  function handleOverwriteView(viewId: string) {
    const view = views.find((v) => v.id === viewId)
    if (!view) return
    const updated: NamedView = {
      id: viewId,
      name: view.name,
      selectedTeamIds,
      swimlaneMode: effectiveSwimlaneMode,
      hiddenLabelIds: effectiveConfig.hiddenLabelIds ?? [],
    }
    const nextViews = views.map((v) => (v.id === viewId ? updated : v))
    void saveConfig({ ...effectiveConfig, views: nextViews })
    setActiveViewId(viewId)
  }

  function handleSaveAsNewView(name: string) {
    const id = `view-${Date.now()}`
    const newView: NamedView = {
      id,
      name,
      selectedTeamIds,
      swimlaneMode: effectiveSwimlaneMode,
      hiddenLabelIds: effectiveConfig.hiddenLabelIds ?? [],
    }
    const nextViews = [...views, newView]
    void saveConfig({ ...effectiveConfig, views: nextViews })
    setActiveViewId(id)
  }

  function handleRenameView(viewId: string, name: string) {
    const nextViews = views.map((v) => (v.id === viewId ? { ...v, name } : v))
    void saveConfig({ ...effectiveConfig, views: nextViews })
  }

  function handleDeleteView(viewId: string) {
    const nextViews = views.filter((v) => v.id !== viewId)
    void saveConfig({ ...effectiveConfig, views: nextViews })
    if (activeViewId === viewId) setActiveViewId(null)
  }

  function handleToggleLabel(id: string) {
    const current = effectiveConfig.hiddenLabelIds ?? []
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    void saveConfig({ ...effectiveConfig, hiddenLabelIds: next })
  }

  function handleShowAllLabels() {
    void saveConfig({ ...effectiveConfig, hiddenLabelIds: [] })
  }

  function handleHideAllLabels() {
    void saveConfig({ ...effectiveConfig, hiddenLabelIds: allLabels.map((l) => l.id) })
  }

  function handleToggleGroup(childIds: string[]) {
    const current = effectiveConfig.hiddenLabelIds ?? []
    const allHidden = childIds.every((id) => current.includes(id))
    const next = allHidden
      ? current.filter((id) => !childIds.includes(id))
      : [...new Set([...current, ...childIds])]
    void saveConfig({ ...effectiveConfig, hiddenLabelIds: next })
  }

  function handleToggleInitiative(id: string) {
    const current = effectiveConfig.hiddenInitiativeIds ?? []
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    void saveConfig({ ...effectiveConfig, hiddenInitiativeIds: next })
  }

  function handleShowAllInitiatives() {
    void saveConfig({ ...effectiveConfig, hiddenInitiativeIds: [] })
  }

  function handleHideAllInitiatives() {
    void saveConfig({ ...effectiveConfig, hiddenInitiativeIds: allInitiatives.map((i) => i.id) })
  }

  function handleSwimlaneReorder(mode: SwimlaneMode, ids: string[]) {
    const current = effectiveConfig.swimlaneOrder ?? {}
    void saveConfig({ ...effectiveConfig, swimlaneOrder: { ...current, [mode]: ids } })
  }

  const allLabels = useMemo(() => {
    const labels = collectLabels(projects)
    if (projects.some((p) => p.labels.length === 0)) {
      labels.push({ id: '__no_label__', name: 'No Labels', color: '#888888' })
    }
    return labels
  }, [projects])

  const allInitiatives = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; color: string }>()
    for (const p of projects) {
      for (const init of p.initiatives) {
        if (!seen.has(init.id)) {
          seen.set(init.id, { id: init.id, name: init.name, color: init.color ?? '#888888' })
        }
      }
    }
    const list = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
    if (projects.some((p) => p.initiatives.length === 0)) {
      list.push({ id: '__no_initiative__', name: 'No Initiative', color: '#888888' })
    }
    return list
  }, [projects])

  return (
    <>
      <Toolbar
        teams={teams}
        selectedTeamIds={selectedTeamIds}
        onTeamToggle={handleTeamToggle}
        onClearTeams={handleClearTeams}
        swimlaneMode={effectiveSwimlaneMode}
        onSwimlaneModeChange={handleSwimlaneModeChange}
        currentPpd={displayPpd}
        onZoomIn={() => canvasRef.current?.zoomIn()}
        onZoomOut={() => canvasRef.current?.zoomOut()}
        allLabels={allLabels}
        labelGroups={labelGroups}
        hiddenLabelIds={effectiveConfig.hiddenLabelIds ?? []}
        onToggleLabel={handleToggleLabel}
        onToggleGroup={handleToggleGroup}
        onShowAllLabels={handleShowAllLabels}
        onHideAllLabels={handleHideAllLabels}
        allInitiatives={allInitiatives}
        hiddenInitiativeIds={effectiveConfig.hiddenInitiativeIds ?? []}
        onToggleInitiative={handleToggleInitiative}
        onShowAllInitiatives={handleShowAllInitiatives}
        onHideAllInitiatives={handleHideAllInitiatives}
        pendingCount={pendingChanges.length}
        onSync={() => setShowSyncPanel(true)}
        onAddMilestone={() => setShowMilestonePanel(true)}
        onRefresh={refresh}
        onLogout={onLogout}
        loading={loading}
        theme={theme}
        onToggleTheme={onToggleTheme}
        views={views}
        activeViewId={activeViewId}
        isViewDirty={isViewDirty}
        onLoadView={handleLoadView}
        onSaveView={handleSaveView}
        onSaveAsNewView={handleSaveAsNewView}
        onRenameView={handleRenameView}
        onDeleteView={handleDeleteView}
        onOverwriteView={handleOverwriteView}
      />

      {bannerError && (
        <div className="error-banner">
          <span className="error-banner-text">{bannerError}</span>
          <button className="error-banner-close" onClick={() => setBannerError(null)}>
            ✕
          </button>
        </div>
      )}

      {loading && projects.length === 0 ? (
        <div className="loading-overlay">
          <div className="loading-spinner-lg" />
          <span>Loading projects...</span>
        </div>
      ) : (
        <RoadmapCanvas
          ref={canvasRef}
          projects={projects}
          initiatives={initiatives}
          teams={teams}
          swimlaneMode={effectiveSwimlaneMode}
          milestones={effectiveConfig.milestones}
          pendingChanges={pendingChanges}
          onProjectChange={handleProjectChange}
          initialZoomFactor={effectiveConfig.zoomFactor ?? 1}
          onZoomChange={setDisplayPpd}
          viewStartDate={effectiveConfig.viewStartDate}
          viewEndDate={effectiveConfig.viewEndDate}
          hiddenLabelIds={effectiveConfig.hiddenLabelIds ?? []}
          hiddenInitiativeIds={effectiveConfig.hiddenInitiativeIds ?? []}
          swimlaneOrder={effectiveConfig.swimlaneOrder}
          onSwimlaneReorder={handleSwimlaneReorder}
        />
      )}

      {showMilestonePanel && (
        <MilestonePanel
          milestones={effectiveConfig.milestones}
          viewStartDate={effectiveConfig.viewStartDate}
          viewEndDate={effectiveConfig.viewEndDate}
          onSave={(milestones, viewStartDate, viewEndDate) => {
            void saveConfig({ ...effectiveConfig, milestones, viewStartDate, viewEndDate })
          }}
          onClose={() => setShowMilestonePanel(false)}
        />
      )}

      {showSyncPanel && (
        <SyncPanel
          changes={pendingChanges}
          onConfirm={async () => {
            const result = await applyChanges(pendingChanges)
            if (result.errors.length === 0) {
              setPendingChanges([])
              refresh()
            }
            return result
          }}
          onCancel={() => setShowSyncPanel(false)}
          onDiscard={() => {
            setPendingChanges([])
            setShowSyncPanel(false)
          }}
        />
      )}
    </>
  )
}
