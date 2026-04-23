import type { Swimlane, TimelineRange, PendingChange, Team, SwimlaneMode } from '../types'
import { packProjects } from '../utils/packing'
import ProjectBar from './ProjectBar'

interface SwimlaneProps {
  swimlane: Swimlane
  timelineRange: TimelineRange
  pixelsPerDay: number
  teams: Team[]
  swimlaneMode: SwimlaneMode
  onProjectChange: (change: PendingChange) => void
  isDragging?: boolean
  isDragOver?: boolean
  onDragStart?: (id: string) => void
  onDragOver?: (id: string) => void
  onDragLeave?: () => void
  onDrop?: (id: string) => void
  onDragEnd?: () => void
}

export default function SwimlaneComponent({
  swimlane,
  timelineRange,
  pixelsPerDay,
  teams,
  swimlaneMode,
  onProjectChange,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: SwimlaneProps) {
  const rows = packProjects(swimlane.projects)

  const classNames = [
    'swimlane',
    isDragging ? 'swimlane-dragging-row' : '',
    isDragOver ? 'swimlane-drag-over' : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={classNames}
      data-swimlane-id={swimlane.id}
      data-swimlane-label={swimlane.label}
      onDragOver={(e) => { e.preventDefault(); onDragOver?.(swimlane.id) }}
      onDragLeave={onDragLeave}
      onDrop={(e) => { e.preventDefault(); onDrop?.(swimlane.id) }}
    >
      <div
        className="swimlane-label"
        draggable={!!(onDragStart)}
        onDragStart={() => onDragStart?.(swimlane.id)}
        onDragEnd={onDragEnd}
        style={onDragStart ? { cursor: 'grab' } : undefined}
      >
        <span className="swimlane-drag-handle" title="Drag to reorder">⠿</span>
        <span
          className="swimlane-color-dot"
          style={swimlane.color ? { backgroundColor: swimlane.color } : {}}
        />
        <span className="swimlane-label-text">{swimlane.label}</span>
        <span className="swimlane-count">{swimlane.projects.length}</span>
      </div>
      <div className="swimlane-rows">
        {rows.map((row, i) => (
          <div className="swimlane-row" key={i}>
            {row.map((project) => (
              <ProjectBar
                key={project.id}
                project={project}
                timelineRange={timelineRange}
                pixelsPerDay={pixelsPerDay}
                teams={teams}
                swimlaneMode={swimlaneMode}
                swimlaneId={swimlane.id}
                onProjectChange={onProjectChange}
              />
            ))}
          </div>
        ))}
        {rows.length === 0 && <div className="swimlane-row" />}
      </div>
    </div>
  )
}
