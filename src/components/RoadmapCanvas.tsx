import { useMemo, useRef, useState, useEffect, useLayoutEffect, forwardRef, useImperativeHandle } from 'react'
import type {
  LinearProject,
  Initiative,
  ProjectLabel,
  SwimlaneMode,
  Milestone,
  PendingChange,
  TimelineRange,
  Team,
} from '../types'
import { buildSwimlanes } from '../utils/swimlanes'
import {
  calcTimelineRange,
  getQuartersInRange,
  getMonthsInRange,
  getWeeksInRange,
  getYearsInRange,
  getDaysInRange,
  addQuarters,
  dateToX,
  daysBetween,
  parseDate,
  formatDate,
} from '../utils/timeline'
import SwimlaneComponent from './SwimlaneComponent'
import MilestoneMarker from './MilestoneMarker'

type HeaderMode = 'year' | 'quarter' | 'month' | 'week' | 'day'

interface RoadmapCanvasProps {
  projects: LinearProject[]
  initiatives: Initiative[]
  teams: Team[]
  swimlaneMode: SwimlaneMode
  milestones: Milestone[]
  pendingChanges: PendingChange[]
  onProjectChange: (change: PendingChange) => void
  initialZoomFactor?: number
  onZoomChange?: (ppd: number) => void
  viewStartDate?: string
  viewEndDate?: string
  hiddenLabelIds?: string[]
  hiddenInitiativeIds?: string[]
  swimlaneOrder?: Partial<Record<SwimlaneMode, string[]>>
  onSwimlaneReorder?: (mode: SwimlaneMode, ids: string[]) => void
}

export interface RoadmapCanvasHandle {
  zoomIn: () => void
  zoomOut: () => void
}

function applyPendingChanges(
  projects: LinearProject[],
  pendingChanges: PendingChange[],
  initiatives: Initiative[]
): LinearProject[] {
  if (pendingChanges.length === 0) return projects
  const labelById = new Map<string, ProjectLabel>()
  for (const p of projects) {
    for (const l of p.labels) {
      if (!labelById.has(l.id)) labelById.set(l.id, l)
    }
  }
  return projects.map((project) => {
    const changes = pendingChanges.filter((c) => c.projectId === project.id)
    if (changes.length === 0) return project
    let updated = { ...project }
    for (const change of changes) {
      if (change.field === 'startDate') {
        updated = { ...updated, startDate: change.newValue }
      } else if (change.field === 'targetDate') {
        updated = { ...updated, targetDate: change.newValue }
      } else if (change.field === 'initiativeIds') {
        const ids = change.newValue ? change.newValue.split(',').filter(Boolean) : []
        const inits = ids.map((id) => initiatives.find((i) => i.id === id)).filter((i): i is Initiative => !!i)
        updated = { ...updated, initiatives: inits }
      } else if (change.field === 'teamIds') {
        const ids = change.newValue ? change.newValue.split(',').filter(Boolean) : []
        updated = { ...updated, teamIds: ids }
      } else if (change.field === 'labelIds') {
        const ids = change.newValue ? change.newValue.split(',').filter(Boolean) : []
        const labels = ids.map((id) => labelById.get(id)).filter((l): l is ProjectLabel => !!l)
        updated = { ...updated, labels }
      }
    }
    return updated
  })
}

const RoadmapCanvas = forwardRef<RoadmapCanvasHandle, RoadmapCanvasProps>(
  function RoadmapCanvas(
    {
      projects,
      initiatives,
      teams,
      swimlaneMode,
      milestones,
      pendingChanges,
      onProjectChange,
      initialZoomFactor,
      onZoomChange,
      viewStartDate,
      viewEndDate,
      hiddenLabelIds = [],
      hiddenInitiativeIds = [],
      swimlaneOrder,
      onSwimlaneReorder,
    },
    ref
  ) {
    const [ppd, setPpd] = useState<number>(() => (320 / 91) * (initialZoomFactor ?? 1))
    const scrollRef = useRef<HTMLDivElement>(null)
    const bodyRef = useRef<HTMLDivElement>(null)
    const pendingZoom = useRef<{ scrollLeft: number; ratio: number; anchorX: number } | null>(null)

    const [draggingId, setDraggingId] = useState<string | null>(null)
    const [dragOverId, setDragOverId] = useState<string | null>(null)

    useImperativeHandle(ref, () => ({
      zoomIn: () => setPpd((p) => Math.min(200, p * 2)),
      zoomOut: () => setPpd((p) => Math.max(0.15, p / 2)),
    }), [])

    useEffect(() => {
      onZoomChange?.(ppd)
    }, [ppd, onZoomChange])

    useLayoutEffect(() => {
      if (pendingZoom.current && scrollRef.current) {
        const { scrollLeft, ratio, anchorX } = pendingZoom.current
        scrollRef.current.scrollLeft = scrollLeft * ratio - anchorX
        pendingZoom.current = null
      }
    }, [ppd])

    useEffect(() => {
      const el = scrollRef.current
      if (!el) return
      function handleWheel(e: WheelEvent) {
        if (!e.ctrlKey && !e.metaKey) return
        e.preventDefault()
        e.stopPropagation()
        const factor = e.deltaY < 0 ? 1.06 : 1 / 1.06
        const rect = el!.getBoundingClientRect()
        const anchorX = e.clientX - rect.left
        const absX = el!.scrollLeft + anchorX
        setPpd((prev) => {
          const next = Math.max(0.15, Math.min(200, prev * factor))
          pendingZoom.current = { scrollLeft: absX, ratio: next / prev, anchorX }
          return next
        })
      }
      el.addEventListener('wheel', handleWheel, { passive: false })
      return () => el.removeEventListener('wheel', handleWheel)
    }, [])

    const headerMode: HeaderMode =
      ppd >= 18  ? 'day'
      : ppd >= 7  ? 'week'
      : ppd >= 2.5 ? 'month'
      : ppd >= 1  ? 'quarter'
      : 'year'

    const displayProjects = useMemo(
      () => applyPendingChanges(projects, pendingChanges, initiatives),
      [projects, pendingChanges, initiatives]
    )

    const filteredProjects = useMemo(
      () => displayProjects.filter((p) => p.name !== 'Roadmap Config'),
      [displayProjects]
    )

    const timelineRange: TimelineRange = useMemo(() => {
      const natural = calcTimelineRange(filteredProjects)
      return {
        startDate: viewStartDate ? parseDate(viewStartDate) : natural.startDate,
        endDate: viewEndDate ? parseDate(viewEndDate) : natural.endDate,
      }
    }, [filteredProjects, viewStartDate, viewEndDate])

    const quarters = useMemo(() => getQuartersInRange(timelineRange), [timelineRange])
    const months = useMemo(() => getMonthsInRange(timelineRange), [timelineRange])
    const weeks = useMemo(() => getWeeksInRange(timelineRange), [timelineRange])
    const years = useMemo(() => getYearsInRange(timelineRange), [timelineRange])
    const days = useMemo(() => getDaysInRange(timelineRange), [timelineRange])

    const projectedProjects = useMemo(() => {
      const d = new Date()
      const shift = (months: number) =>
        formatDate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate(), 12)))
      const backlogStart = shift(3)
      const backlogEnd   = shift(6)
      const ongoingStart = shift(-1)
      const ongoingEnd   = shift(3)
      return filteredProjects.map((p) => {
        if (p.startDate && p.targetDate) return p
        const isBacklog = p.state.type === 'backlog'
        if (isBacklog) {
          const shiftDate = (base: string, months: number) => {
            const d2 = parseDate(base)
            return formatDate(new Date(Date.UTC(d2.getUTCFullYear(), d2.getUTCMonth() + months, d2.getUTCDate(), 12)))
          }
          const estStart = p.startDate ?? (p.targetDate ? shiftDate(p.targetDate, -2) : backlogStart)
          const estEnd   = p.targetDate ?? (p.startDate ? shiftDate(p.startDate, 2) : backlogEnd)
          return {
            ...p,
            startDate: estStart,
            targetDate: estEnd,
            estimatedDates: true,
            estimatedStart: !p.startDate,
            estimatedEnd: !p.targetDate,
          }
        }
        return {
          ...p,
          startDate: p.startDate ?? ongoingStart,
          targetDate: p.targetDate ?? ongoingEnd,
          estimatedDates: false,
          estimatedStart: !p.startDate,
          estimatedEnd: !p.targetDate,
        }
      })
    }, [filteredProjects])

    const swimlanes = useMemo(
      () => buildSwimlanes(
        projectedProjects,
        swimlaneMode,
        initiatives,
        hiddenLabelIds,
        teams,
        hiddenInitiativeIds,
        swimlaneOrder
      ),
      [projectedProjects, swimlaneMode, initiatives, hiddenLabelIds, teams, hiddenInitiativeIds, swimlaneOrder]
    )

    function handleDragStart(id: string) {
      setDraggingId(id)
    }

    function handleDragOver(id: string) {
      if (id !== draggingId) setDragOverId(id)
    }

    function handleDragLeave() {
      setDragOverId(null)
    }

    function handleDrop(targetId: string) {
      if (!draggingId || draggingId === targetId) {
        setDraggingId(null)
        setDragOverId(null)
        return
      }
      const ids = swimlanes.map((s) => s.id)
      const fromIdx = ids.indexOf(draggingId)
      const toIdx = ids.indexOf(targetId)
      if (fromIdx < 0 || toIdx < 0) return
      const newIds = [...ids]
      newIds.splice(fromIdx, 1)
      newIds.splice(toIdx, 0, draggingId)
      onSwimlaneReorder?.(swimlaneMode, newIds)
      setDraggingId(null)
      setDragOverId(null)
    }

    function handleDragEnd() {
      setDraggingId(null)
      setDragOverId(null)
    }

    const totalDays = daysBetween(timelineRange.startDate, timelineRange.endDate)
    const timelineWidth = totalDays * ppd
    const LABEL_WIDTH = 180
    const canvasWidth = timelineWidth + LABEL_WIDTH

    const estimatedBodyHeight = swimlanes.reduce((total, sw) => {
      return total + Math.max(1, sw.projects.length) * 40 + 1
    }, 0)

    if (filteredProjects.length === 0) {
      return (
        <div className="canvas-wrapper">
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">No projects found</div>
            <div className="empty-state-desc">
              No active or in-progress projects were found for the selected team.
              Try selecting a different team or refreshing.
            </div>
          </div>
        </div>
      )
    }

    // ── Header rows ───────────────────────────────────────────────
    const renderMajorRow = () => {
      if (headerMode === 'year') {
        return years.map((y, i) => {
          const cellStart = y.startDate < timelineRange.startDate ? timelineRange.startDate : y.startDate
          const nextYearStart = years[i + 1]?.startDate ?? new Date(Date.UTC(y.year + 1, 0, 1, 12))
          const cellEnd = nextYearStart > timelineRange.endDate ? timelineRange.endDate : nextYearStart
          const w = daysBetween(cellStart, cellEnd) * ppd
          return (
            <div key={y.year} className="header-cell header-cell-major" style={{ width: w, minWidth: w }}>
              {y.label}
            </div>
          )
        })
      }
      if (headerMode === 'quarter') {
        return quarters.map((q, i) => {
          const cellEnd = quarters[i + 1]?.startDate ?? addQuarters(q.startDate, 1)
          const w = daysBetween(q.startDate, cellEnd) * ppd
          return (
            <div key={`${q.year}-${q.quarter}`} className="header-cell header-cell-major" style={{ width: w, minWidth: w }}>
              {q.label}
            </div>
          )
        })
      }
      return months.map((m, i) => {
        const cellEnd = months[i + 1]?.startDate ?? new Date(Date.UTC(m.year, m.month, 1, 12))
        const w = daysBetween(m.startDate, cellEnd) * ppd
        const label = w > 50 ? m.label : m.shortLabel
        return (
          <div key={`${m.year}-${m.month}`} className="header-cell header-cell-major" style={{ width: w, minWidth: w }}>
            {label}
          </div>
        )
      })
    }

    const renderMinorRow = () => {
      if (headerMode === 'year') {
        return quarters.map((q, i) => {
          const cellEnd = quarters[i + 1]?.startDate ?? addQuarters(q.startDate, 1)
          const w = daysBetween(q.startDate, cellEnd) * ppd
          return (
            <div key={`${q.year}-${q.quarter}`} className="header-cell header-cell-minor" style={{ width: w, minWidth: w }}>
              Q{q.quarter}
            </div>
          )
        })
      }
      if (headerMode === 'quarter') {
        return months.map((m, i) => {
          const cellEnd = months[i + 1]?.startDate ?? new Date(Date.UTC(m.year, m.month, 1, 12))
          const w = daysBetween(m.startDate, cellEnd) * ppd
          return (
            <div key={`${m.year}-${m.month}`} className="header-cell header-cell-minor" style={{ width: w, minWidth: w }}>
              {w > 28 ? m.shortLabel : ''}
            </div>
          )
        })
      }
      if (headerMode === 'week') {
        const msPerDay = 86400000
        return weeks.map((w, i) => {
          const cellStart = w.startDate < timelineRange.startDate ? timelineRange.startDate : w.startDate
          const nextStart = weeks[i + 1]?.startDate ?? new Date(w.startDate.getTime() + 7 * msPerDay)
          const w_px = daysBetween(cellStart, nextStart) * ppd
          return (
            <div key={i} className="header-cell header-cell-minor" style={{ width: w_px, minWidth: w_px }}>
              {w_px >= 30 ? w.label : ''}
            </div>
          )
        })
      }
      if (headerMode === 'month') {
        return null
      }
      return days.map((d, i) => (
        <div
          key={i}
          className={`header-cell header-cell-minor${d.isWeekend ? ' header-cell-weekend' : ''}`}
          style={{ width: ppd, minWidth: ppd }}
        >
          {ppd >= 12 ? d.label : ''}
        </div>
      ))
    }

    // ── Grid lines in body ────────────────────────────────────────
    const majorGridDates =
      headerMode === 'year' ? quarters.map((q) => q.startDate)
      : headerMode === 'quarter' ? quarters.map((q) => q.startDate)
      : months.map((m) => m.startDate)

    const minorGridDates =
      headerMode === 'quarter' ? months.map((m) => m.startDate)
      : headerMode === 'month' ? months.map((m) => m.startDate)
      : []

    const weekGridDates =
      headerMode !== 'day' && ppd >= 3.5 ? weeks.map((w) => w.startDate) : []

    const dayGridDates =
      headerMode === 'day' ? days.map((d) => d.date) : []

    const visibleMilestones = milestones.filter((m) => {
      if (m.hidden) return false
      const d = parseDate(m.date)
      return d >= timelineRange.startDate && d <= timelineRange.endDate
    })

    return (
      <div className="canvas-wrapper">
        <div className="canvas-scroll-container" ref={scrollRef}>
          <div className="canvas-inner" style={{ width: canvasWidth, minWidth: canvasWidth }}>
            {/* Sticky two-row timeline header */}
            <div className="timeline-header timeline-header-two-row">
              {/* Major row */}
              <div className="timeline-header-row timeline-header-row-major">
                <div className="swimlane-label-spacer" />
                <div className="header-track">
                  {renderMajorRow()}
                </div>
              </div>
              {/* Minor row — milestone flag labels live here so they never overlap project bars */}
              <div className="timeline-header-row timeline-header-row-minor">
                <div className="swimlane-label-spacer" />
                <div className="header-track">
                  {renderMinorRow()}
                </div>
                {visibleMilestones.map((m) => {
                  const x = dateToX(parseDate(m.date), timelineRange.startDate, ppd) + LABEL_WIDTH + 4
                  return (
                    <div
                      key={m.id}
                      className="milestone-flag milestone-flag-header"
                      style={{ backgroundColor: m.color, left: x }}
                    >
                      {m.label}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Canvas body */}
            <div className="canvas-body" ref={bodyRef}>
              {majorGridDates.map((d, i) => {
                const x = dateToX(d, timelineRange.startDate, ppd) + LABEL_WIDTH - 1
                return <div key={`major-${i}`} className="quarter-gridline" style={{ left: x }} />
              })}

              {minorGridDates.map((d, i) => {
                const x = dateToX(d, timelineRange.startDate, ppd) + LABEL_WIDTH - 1
                return <div key={`minor-${i}`} className="month-gridline" style={{ left: x }} />
              })}

              {weekGridDates.map((d, i) => {
                const x = dateToX(d, timelineRange.startDate, ppd) + LABEL_WIDTH - 1
                return <div key={`week-${i}`} className="week-gridline" style={{ left: x }} />
              })}

              {dayGridDates.map((d, i) => {
                const x = dateToX(d, timelineRange.startDate, ppd) + LABEL_WIDTH - 1
                return <div key={`day-${i}`} className="day-gridline" style={{ left: x }} />
              })}

              {/* Milestone lines only (flags rendered in header above) */}
              {visibleMilestones.map((m) => (
                <MilestoneMarker
                  key={m.id}
                  milestone={m}
                  timelineRange={timelineRange}
                  pixelsPerDay={ppd}
                  canvasHeight={estimatedBodyHeight}
                  labelOffset={LABEL_WIDTH}
                  showFlag={false}
                />
              ))}

              {swimlanes.map((sw) => (
                <SwimlaneComponent
                  key={sw.id}
                  swimlane={sw}
                  timelineRange={timelineRange}
                  pixelsPerDay={ppd}
                  teams={teams}
                  swimlaneMode={swimlaneMode}
                  onProjectChange={onProjectChange}
                  isDragging={sw.id === draggingId}
                  isDragOver={sw.id === dragOverId}
                  onDragStart={onSwimlaneReorder ? handleDragStart : undefined}
                  onDragOver={onSwimlaneReorder ? handleDragOver : undefined}
                  onDragLeave={onSwimlaneReorder ? handleDragLeave : undefined}
                  onDrop={onSwimlaneReorder ? handleDrop : undefined}
                  onDragEnd={onSwimlaneReorder ? handleDragEnd : undefined}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }
)

export default RoadmapCanvas
