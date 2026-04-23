import type { Milestone, TimelineRange } from '../types'
import { dateToX, parseDate } from '../utils/timeline'

interface MilestoneMarkerProps {
  milestone: Milestone
  timelineRange: TimelineRange
  pixelsPerDay: number
  canvasHeight: number
  labelOffset?: number
  showFlag?: boolean
}

export default function MilestoneMarker({
  milestone,
  timelineRange,
  pixelsPerDay,
  canvasHeight,
  labelOffset = 0,
  showFlag = true,
}: MilestoneMarkerProps) {
  const date = parseDate(milestone.date)
  const x = dateToX(date, timelineRange.startDate, pixelsPerDay) + labelOffset

  return (
    <div
      className="milestone-marker"
      style={{ left: x, height: canvasHeight }}
    >
      <div
        className="milestone-line"
        style={{ borderColor: milestone.color, height: canvasHeight }}
      />
      {showFlag && (
        <div
          className="milestone-flag"
          style={{ backgroundColor: milestone.color }}
        >
          {milestone.label}
        </div>
      )}
    </div>
  )
}
