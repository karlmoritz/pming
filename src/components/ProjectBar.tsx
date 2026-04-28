import { useState, useRef, useEffect } from 'react'
import type { LinearProject, TimelineRange, PendingChange, Team, SwimlaneMode } from '../types'
import { dateToX, xToDate, formatDate, parseDate } from '../utils/timeline'

interface ProjectBarProps {
  project: LinearProject
  timelineRange: TimelineRange
  pixelsPerDay: number
  teams: Team[]
  swimlaneMode: SwimlaneMode
  swimlaneId: string
  onProjectChange: (change: PendingChange) => void
}

interface DragState {
  type: 'move' | 'resize-start' | 'resize-end'
  startX: number
  startY: number
  originalStartDate: Date
  originalEndDate: Date
  directionLocked: boolean
}

interface TooltipPos {
  x: number
  y: number
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1]!, 16),
        g: parseInt(result[2]!, 16),
        b: parseInt(result[3]!, 16),
      }
    : null
}

function darken(hex: string, amount: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  const r = Math.max(0, Math.round(rgb.r * (1 - amount)))
  const g = Math.max(0, Math.round(rgb.g * (1 - amount)))
  const b = Math.max(0, Math.round(rgb.b * (1 - amount)))
  return `rgb(${r},${g},${b})`
}

export default function ProjectBar({
  project,
  timelineRange,
  pixelsPerDay,
  teams,
  swimlaneMode,
  swimlaneId,
  onProjectChange,
}: ProjectBarProps) {
  const dragRef = useRef<DragState | null>(null)
  const barRef = useRef<HTMLDivElement>(null)
  // dragOffsetPx drives left-edge movement (move + resize-start)
  // resizeOffsetPx drives right-edge movement (resize-end only)
  const [dragOffsetPx, setDragOffsetPx] = useState(0)
  const [resizeOffsetPx, setResizeOffsetPx] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isSwimlaneDragging, setIsSwimlaneDragging] = useState(false)
  const swimlaneDragTargetRef = useRef<string | null>(null)
  const swimlaneDragStartYRef = useRef<number>(0)
  const [swimlaneDragOffsetY, setSwimlaneOffsetY] = useState(0)
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipPos, setTooltipPos] = useState<TooltipPos>({ x: 0, y: 0 })

  const startDate = parseDate(project.startDate!)
  const endDate = parseDate(project.targetDate!)

  const startX = dateToX(startDate, timelineRange.startDate, pixelsPerDay)
  const endX = dateToX(endDate, timelineRange.startDate, pixelsPerDay)
  const barWidth = Math.max(endX - startX, 8)

  const barColor = project.initiatives[0]?.color ?? project.state.color ?? '#6366f1'
  const isPaused = project.state.type === 'paused'
  const isCancelledOrCompleted =
    project.state.type === 'cancelled' || project.state.type === 'completed'

  useEffect(() => {
    if (!isDragging) return

    function handleMouseMove(e: MouseEvent) {
      if (!dragRef.current) return
      const deltaX = e.clientX - dragRef.current.startX
      const { type, directionLocked } = dragRef.current

      if (!directionLocked) {
        const deltaY = e.clientY - dragRef.current.startY
        const THRESHOLD = 8
        if (Math.abs(deltaY) > THRESHOLD && Math.abs(deltaY) > Math.abs(deltaX)) {
          swimlaneDragStartYRef.current = dragRef.current.startY
          dragRef.current = null
          setDragOffsetPx(0)
          setResizeOffsetPx(0)
          setIsDragging(false)
          setIsSwimlaneDragging(true)
          return
        }
        if (Math.abs(deltaX) <= THRESHOLD) return
        dragRef.current.directionLocked = true
      }

      if (type === 'move') {
        setDragOffsetPx(deltaX)
      } else if (type === 'resize-end') {
        setResizeOffsetPx(Math.max(deltaX, -(barWidth - 8)))
      } else {
        // resize-start: clamp right so bar can't collapse below 8 px
        setDragOffsetPx(Math.min(deltaX, barWidth - 8))
      }
    }

    function handleMouseUp(e: MouseEvent) {
      if (!dragRef.current) return
      if (!dragRef.current.directionLocked) {
        dragRef.current = null
        setDragOffsetPx(0)
        setResizeOffsetPx(0)
        setIsDragging(false)
        window.open(project.url, '_blank', 'noopener,noreferrer')
        return
      }
      const delta = e.clientX - dragRef.current.startX
      const { type, originalStartDate, originalEndDate } = dragRef.current

      if (type === 'move') {
        const snappedDelta = Math.round(delta / pixelsPerDay) * pixelsPerDay
        const newStartDate = xToDate(
          dateToX(originalStartDate, timelineRange.startDate, pixelsPerDay) + snappedDelta,
          timelineRange.startDate,
          pixelsPerDay
        )
        const newEndDate = xToDate(
          dateToX(originalEndDate, timelineRange.startDate, pixelsPerDay) + snappedDelta,
          timelineRange.startDate,
          pixelsPerDay
        )
        if (!project.estimatedStart) {
          onProjectChange({
            projectId: project.id,
            projectName: project.name,
            field: 'startDate',
            oldValue: project.startDate,
            newValue: formatDate(newStartDate),
          })
        }
        if (!project.estimatedEnd) {
          onProjectChange({
            projectId: project.id,
            projectName: project.name,
            field: 'targetDate',
            oldValue: project.targetDate,
            newValue: formatDate(newEndDate),
          })
        }
      } else if (type === 'resize-start') {
        const snappedDelta = Math.round(delta / pixelsPerDay) * pixelsPerDay
        const newStartDate = xToDate(
          dateToX(originalStartDate, timelineRange.startDate, pixelsPerDay) + snappedDelta,
          timelineRange.startDate,
          pixelsPerDay
        )
        onProjectChange({
          projectId: project.id,
          projectName: project.name,
          field: 'startDate',
          oldValue: project.startDate,
          newValue: formatDate(newStartDate),
        })
      } else {
        // resize-end
        const snappedDelta = Math.round(delta / pixelsPerDay) * pixelsPerDay
        const newEndDate = xToDate(
          dateToX(originalEndDate, timelineRange.startDate, pixelsPerDay) + snappedDelta,
          timelineRange.startDate,
          pixelsPerDay
        )
        onProjectChange({
          projectId: project.id,
          projectName: project.name,
          field: 'targetDate',
          oldValue: project.targetDate,
          newValue: formatDate(newEndDate),
        })
      }

      dragRef.current = null
      setDragOffsetPx(0)
      setResizeOffsetPx(0)
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, project, timelineRange, pixelsPerDay, onProjectChange, barWidth])

  useEffect(() => {
    if (!isSwimlaneDragging) return

    function getSwimlaneAtPoint(x: number, y: number): { id: string; label: string } | null {
      const bar = barRef.current
      const els = document.elementsFromPoint(x, y)
      for (const el of els) {
        // Skip the dragged bar (visually translated, but still in source swimlane's DOM)
        if (bar && (el === bar || bar.contains(el as Node))) continue
        const swimlaneEl = el.closest('[data-swimlane-id]') as HTMLElement | null
        if (swimlaneEl) {
          return {
            id: swimlaneEl.dataset.swimlaneId ?? '',
            label: swimlaneEl.dataset.swimlaneLabel ?? '',
          }
        }
      }
      return null
    }

    const startY = swimlaneDragStartYRef.current

    function handleMouseMove(e: MouseEvent) {
      setSwimlaneOffsetY(e.clientY - startY)
      const target = getSwimlaneAtPoint(e.clientX, e.clientY)
      const targetId = target?.id ?? null

      if (targetId !== swimlaneDragTargetRef.current) {
        // Remove previous highlight
        if (swimlaneDragTargetRef.current) {
          document.querySelector(`[data-swimlane-id="${swimlaneDragTargetRef.current}"]`)
            ?.classList.remove('swimlane-drag-target')
        }
        swimlaneDragTargetRef.current = targetId
        // Add new highlight (only if different from current swimlane)
        if (targetId && targetId !== swimlaneId) {
          document.querySelector(`[data-swimlane-id="${targetId}"]`)
            ?.classList.add('swimlane-drag-target')
        }
      }
    }

    function handleMouseUp(e: MouseEvent) {
      const target = getSwimlaneAtPoint(e.clientX, e.clientY)

      // Clean up highlights
      if (swimlaneDragTargetRef.current) {
        document.querySelector(`[data-swimlane-id="${swimlaneDragTargetRef.current}"]`)
          ?.classList.remove('swimlane-drag-target')
        swimlaneDragTargetRef.current = null
      }

      setIsSwimlaneDragging(false)

      if (!target || target.id === swimlaneId) return

      if (swimlaneMode === 'initiative') {
        const shiftHeld = e.shiftKey
        const currentIds = project.initiatives.map((i) => i.id)
        let newIds: string[]
        if (target.id === '__no_initiative__') {
          newIds = []
        } else if (shiftHeld) {
          newIds = [...new Set([...currentIds, target.id])]
        } else {
          newIds = [target.id]
        }
        onProjectChange({
          projectId: project.id,
          projectName: project.name,
          field: 'initiativeIds',
          oldValue: project.initiatives.map((i) => i.name).join(', ') || '(none)',
          newValue: newIds.join(','),
          displayValue: target.label,
        })
      } else if (swimlaneMode === 'label') {
        const shiftHeld = e.shiftKey
        const currentLabelIds = project.labels.map((l) => l.id)
        let newLabelIds: string[]
        if (target.id === '__no_label__') {
          newLabelIds = []
        } else if (shiftHeld) {
          newLabelIds = [...new Set([...currentLabelIds, target.id])]
        } else {
          newLabelIds = [target.id]
        }
        onProjectChange({
          projectId: project.id,
          projectName: project.name,
          field: 'labelIds',
          oldValue: project.labels.map((l) => l.name).join(', ') || '(none)',
          newValue: newLabelIds.join(','),
          displayValue: target.label,
        })
      } else if (swimlaneMode === 'team') {
        const shiftHeld = e.shiftKey
        const currentTeamIds = project.teamIds
        let newTeamIds: string[]
        if (shiftHeld) {
          newTeamIds = [...new Set([...currentTeamIds, target.id])]
        } else {
          // Move: remove source team, add target team, keep others
          newTeamIds = [...new Set([...currentTeamIds.filter((id) => id !== swimlaneId), target.id])]
        }
        const targetTeam = teams.find((t) => t.id === target.id)
        onProjectChange({
          projectId: project.id,
          projectName: project.name,
          field: 'teamIds',
          oldValue: currentTeamIds.map((id) => teams.find((t) => t.id === id)?.name ?? id).join(', ') || '(none)',
          newValue: newTeamIds.join(','),
          displayValue: targetTeam?.name ?? target.label,
        })
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isSwimlaneDragging, swimlaneMode, swimlaneId, project, onProjectChange])

  function handleBodyMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setShowTooltip(false)
    dragRef.current = { type: 'move', startX: e.clientX, startY: e.clientY, originalStartDate: startDate, originalEndDate: endDate, directionLocked: false }
    setIsDragging(true)
  }

  function handleResizeStartMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setShowTooltip(false)
    dragRef.current = { type: 'resize-start', startX: e.clientX, startY: e.clientY, originalStartDate: startDate, originalEndDate: endDate, directionLocked: true }
    setIsDragging(true)
  }

  function handleResizeEndMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setShowTooltip(false)
    dragRef.current = { type: 'resize-end', startX: e.clientX, startY: e.clientY, originalStartDate: startDate, originalEndDate: endDate, directionLocked: true }
    setIsDragging(true)
  }

  function handleMouseEnter(e: React.MouseEvent) {
    if (!isDragging) {
      setShowTooltip(true)
      setTooltipPos({ x: e.clientX, y: e.clientY })
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (showTooltip && !isDragging) {
      setTooltipPos({ x: e.clientX + 12, y: e.clientY + 12 })
    }
  }

  function handleMouseLeave() {
    setShowTooltip(false)
  }

  // resize-start moves the left edge; resize-end moves the right edge
  const isResizingStart = dragRef.current?.type === 'resize-start'
  const currentLeft = startX + dragOffsetPx
  const currentWidth = isResizingStart
    ? Math.max(barWidth - dragOffsetPx, 8)
    : Math.max(barWidth + resizeOffsetPx, 8)

  const bgColor = isPaused ? `${barColor}88` : barColor
  const resizeHandleColor = darken(barColor, 0.25)
  const isBacklogEstimated = project.estimatedDates === true

  // Gradient mask for ongoing projects with one or both edges estimated
  let edgeMask: string | undefined
  if (!isBacklogEstimated && (project.estimatedStart || project.estimatedEnd)) {
    const f = '28px'
    if (project.estimatedStart && project.estimatedEnd) {
      edgeMask = `linear-gradient(to right, transparent, black ${f}, black calc(100% - ${f}), transparent)`
    } else if (project.estimatedStart) {
      edgeMask = `linear-gradient(to right, transparent, black ${f})`
    } else {
      edgeMask = `linear-gradient(to left, transparent, black ${f})`
    }
  }

  return (
    <>
      <div
        ref={barRef}
        className={`project-bar${isDragging ? ' dragging' : ''}${isSwimlaneDragging ? ' swimlane-dragging' : ''}${isBacklogEstimated ? ' estimated' : ''}`}
        style={{
          left: currentLeft,
          width: currentWidth,
          backgroundColor: bgColor,
          opacity: isCancelledOrCompleted ? 0.5 : isBacklogEstimated ? 0.55 : 1,
          WebkitMaskImage: edgeMask,
          maskImage: edgeMask,
          transform: isSwimlaneDragging ? `translateY(${swimlaneDragOffsetY}px)` : undefined,
          zIndex: isSwimlaneDragging ? 100 : undefined,
        }}
        onMouseDown={handleBodyMouseDown}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div
          className="project-bar-resize project-bar-resize--start"
          style={{
            backgroundColor: resizeHandleColor,
            cursor: undefined,
          }}
          onMouseDown={handleResizeStartMouseDown}
        />
        <span className={`project-bar-name${isCancelledOrCompleted ? ' cancelled' : ''}`}>
          {project.name}
        </span>
        <div
          className="project-bar-resize project-bar-resize--end"
          style={{
            backgroundColor: resizeHandleColor,
            cursor: undefined,
          }}
          onMouseDown={handleResizeEndMouseDown}
        />
      </div>

      {showTooltip && (
        <div
          className="project-tooltip"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          <div className="project-tooltip-title">{project.name}</div>
          {project.initiatives.length > 0 && (
            <div className="project-tooltip-row">
              <span className="project-tooltip-label">{project.initiatives.length === 1 ? 'Initiative:' : 'Initiatives:'}</span>
              <span className="project-tooltip-value">{project.initiatives.map((i) => i.name).join(', ')}</span>
            </div>
          )}
          {project.teamIds.length > 0 && (
            <div className="project-tooltip-row">
              <span className="project-tooltip-label">{project.teamIds.length === 1 ? 'Team:' : 'Teams:'}</span>
              <span className="project-tooltip-value">
                {project.teamIds
                  .map((id) => teams.find((t) => t.id === id)?.name ?? id)
                  .join(', ')}
              </span>
            </div>
          )}
          <div className="project-tooltip-row">
            <span className="project-tooltip-label">Start:</span>
            <span className="project-tooltip-value">
              {project.estimatedStart ? 'n/a' : (project.startDate ?? '—')}
            </span>
          </div>
          <div className="project-tooltip-row">
            <span className="project-tooltip-label">End:</span>
            <span className="project-tooltip-value">
              {project.estimatedEnd ? 'n/a' : (project.targetDate ?? '—')}
            </span>
          </div>
          <div className="project-tooltip-row">
            <span className="project-tooltip-label">State:</span>
            <span className="project-tooltip-value">{project.state.name}</span>
          </div>
        </div>
      )}
    </>
  )
}
