import type { LinearProject } from '../types'
import { parseDate } from './timeline'

function overlaps(a: LinearProject, b: LinearProject): boolean {
  const aStart = a.startDate ? parseDate(a.startDate) : new Date('1900-01-01T12:00:00Z')
  const aEnd   = a.targetDate ? parseDate(a.targetDate) : new Date('2100-01-01T12:00:00Z')
  const bStart = b.startDate ? parseDate(b.startDate) : new Date('1900-01-01T12:00:00Z')
  const bEnd   = b.targetDate ? parseDate(b.targetDate) : new Date('2100-01-01T12:00:00Z')
  return aStart < bEnd && bStart < aEnd
}

// First-fit in input order — no sorting. This keeps row assignments stable:
// a project only changes rows when an overlap forces it, not because a sort
// reordered the input array.
export function packProjects(projects: LinearProject[]): LinearProject[][] {
  const rows: LinearProject[][] = []

  for (const project of projects) {
    let placed = false
    for (const row of rows) {
      if (!row.some((existing) => overlaps(project, existing))) {
        row.push(project)
        placed = true
        break
      }
    }
    if (!placed) {
      rows.push([project])
    }
  }

  return rows
}
