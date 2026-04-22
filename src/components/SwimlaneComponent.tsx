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
}

export default function SwimlaneComponent({
  swimlane,
  timelineRange,
  pixelsPerDay,
  teams,
  swimlaneMode,
  onProjectChange,
}: SwimlaneProps) {
  const rows = packProjects(swimlane.projects)

  return (
    <div className="swimlane" data-swimlane-id={swimlane.id} data-swimlane-label={swimlane.label}>
      <div className="swimlane-label">
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
