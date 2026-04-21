import { useState, useRef, useEffect } from 'react'
import type { LinearProject, TimelineRange, PendingChange, Team } from '../types'
import { dateToX, xToDate, formatDate, parseDate } from '../utils/timeline'

interface ProjectBarProps {
  project: LinearProject
  timelineRange: TimelineRange
  pixelsPerDay: number
  teams: Team[]
  onProjectChange: (change: PendingChange) => void
}

interface DragState {
  type: 'move' | 'resize-start' | 'resize-end'
  startX: number
  originalStartDate: Date
  originalEndDate: Date
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
  onProjectChange,
}: ProjectBarProps) {
  const dragRef = useRef<DragState | null>(null)
  // dragOffsetPx drives left-edge movement (move + resize-start)
  // resizeOffsetPx drives right-edge movement (resize-end only)
  const [dragOffsetPx, setDragOffsetPx] = useState(0)
  const [resizeOffsetPx, setResizeOffsetPx] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipPos, setTooltipPos] = useState<TooltipPos>({ x: 0, y: 0 })

  const startDate = parseDate(project.startDate!)
  const endDate = parseDate(project.targetDate!)

  const startX = dateToX(startDate, timelineRange.startDate, pixelsPerDay)
  const endX = dateToX(endDate, timelineRange.startDate, pixelsPerDay)
  const barWidth = Math.max(endX - startX, 8)

  const barColor = project.initiative?.color ?? project.state.color ?? '#6366f1'
  const isPaused = project.state.type === 'paused'
  const isCancelledOrCompleted =
    project.state.type === 'cancelled' || project.state.type === 'completed'

  useEffect(() => {
    if (!isDragging) return

    function handleMouseMove(e: MouseEvent) {
      if (!dragRef.current) return
      const delta = e.clientX - dragRef.current.startX
      const { type } = dragRef.current
      if (type === 'move') {
        setDragOffsetPx(delta)
      } else if (type === 'resize-end') {
        setResizeOffsetPx(Math.max(delta, -(barWidth - 8)))
      } else {
        // resize-start: clamp right so bar can't collapse below 8 px
        setDragOffsetPx(Math.min(delta, barWidth - 8))
      }
    }

    function handleMouseUp(e: MouseEvent) {
      if (!dragRef.current) return
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
        if (!project.estimatedStart) {
          onProjectChange({
            projectId: project.id,
            projectName: project.name,
            field: 'startDate',
            oldValue: project.startDate,
            newValue: formatDate(newStartDate),
          })
        }
      } else {
        // resize-end
        const snappedDelta = Math.round(delta / pixelsPerDay) * pixelsPerDay
        const newEndDate = xToDate(
          dateToX(originalEndDate, timelineRange.startDate, pixelsPerDay) + snappedDelta,
          timelineRange.startDate,
          pixelsPerDay
        )
        if (!project.estimatedEnd) {
          onProjectChange({
            projectId: project.id,
            projectName: project.name,
            field: 'targetDate',
            oldValue: project.targetDate,
            newValue: formatDate(newEndDate),
          })
        }
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

  function handleBodyMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setShowTooltip(false)
    dragRef.current = { type: 'move', startX: e.clientX, originalStartDate: startDate, originalEndDate: endDate }
    setIsDragging(true)
  }

  function handleResizeStartMouseDown(e: React.MouseEvent) {
    if (project.estimatedStart) return
    e.preventDefault()
    e.stopPropagation()
    setShowTooltip(false)
    dragRef.current = { type: 'resize-start', startX: e.clientX, originalStartDate: startDate, originalEndDate: endDate }
    setIsDragging(true)
  }

  function handleResizeEndMouseDown(e: React.MouseEvent) {
    if (project.estimatedEnd) return
    e.preventDefault()
    e.stopPropagation()
    setShowTooltip(false)
    dragRef.current = { type: 'resize-end', startX: e.clientX, originalStartDate: startDate, originalEndDate: endDate }
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
        className={`project-bar${isDragging ? ' dragging' : ''}${isBacklogEstimated ? ' estimated' : ''}`}
        style={{
          left: currentLeft,
          width: currentWidth,
          backgroundColor: bgColor,
          opacity: isCancelledOrCompleted ? 0.5 : isBacklogEstimated ? 0.55 : 1,
          WebkitMaskImage: edgeMask,
          maskImage: edgeMask,
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
            cursor: project.estimatedStart ? 'default' : undefined,
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
            cursor: project.estimatedEnd ? 'default' : undefined,
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
          {project.initiative && (
            <div className="project-tooltip-row">
              <span className="project-tooltip-label">Initiative:</span>
              <span className="project-tooltip-value">{project.initiative.name}</span>
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
