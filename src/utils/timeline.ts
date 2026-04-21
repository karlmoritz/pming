import type { Quarter, TimelineRange } from '../types'
import type { LinearProject } from '../types'

export const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const

export interface Month {
  label: string       // "Jan 2026"
  shortLabel: string  // "Jan"
  year: number
  month: number       // 1–12
  startDate: Date
  endDate: Date
}

export interface Year {
  label: string
  year: number
  startDate: Date
  endDate: Date
}

export function getMonthsInRange(range: TimelineRange): Month[] {
  const months: Month[] = []
  let y = range.startDate.getUTCFullYear()
  let m = range.startDate.getUTCMonth()
  while (true) {
    const start = new Date(Date.UTC(y, m, 1, 12))
    if (start > range.endDate) break
    const end = new Date(Date.UTC(y, m + 1, 0, 12))
    months.push({
      label: `${MONTH_SHORT[m]} ${y}`,
      shortLabel: MONTH_SHORT[m]!,
      year: y,
      month: m + 1,
      startDate: start,
      endDate: end,
    })
    m++
    if (m === 12) { m = 0; y++ }
  }
  return months
}

export function getYearsInRange(range: TimelineRange): Year[] {
  const years: Year[] = []
  for (let y = range.startDate.getUTCFullYear(); y <= range.endDate.getUTCFullYear(); y++) {
    years.push({
      label: String(y),
      year: y,
      startDate: new Date(Date.UTC(y, 0, 1, 12)),
      endDate: new Date(Date.UTC(y, 11, 31, 12)),
    })
  }
  return years
}

export function startOfQuarter(date: Date): Date {
  const month = date.getUTCMonth()
  const quarterStartMonth = Math.floor(month / 3) * 3
  return new Date(Date.UTC(date.getUTCFullYear(), quarterStartMonth, 1, 12, 0, 0))
}

export function endOfQuarter(date: Date): Date {
  const month = date.getUTCMonth()
  const quarterEndMonth = Math.floor(month / 3) * 3 + 3
  // Last day of the quarter's last month
  return new Date(Date.UTC(date.getUTCFullYear(), quarterEndMonth, 0, 12, 0, 0))
}

export function addQuarters(date: Date, n: number): Date {
  const month = date.getUTCMonth() + n * 3
  return new Date(Date.UTC(date.getUTCFullYear() + Math.floor(month / 12), ((month % 12) + 12) % 12, date.getUTCDate(), 12, 0, 0))
}

export function getQuartersInRange(range: TimelineRange): Quarter[] {
  const quarters: Quarter[] = []
  let current = startOfQuarter(range.startDate)

  while (current <= range.endDate) {
    const qEnd = endOfQuarter(current)
    const month = current.getUTCMonth()
    const q = Math.floor(month / 3) + 1
    const year = current.getUTCFullYear()

    quarters.push({
      label: `Q${q} ${year}`,
      year,
      quarter: q,
      startDate: new Date(current),
      endDate: qEnd,
    })

    current = addQuarters(current, 1)
  }

  return quarters
}

export function dateToX(date: Date, rangeStart: Date, pixelsPerDay: number): number {
  const days = daysBetween(rangeStart, date)
  return days * pixelsPerDay
}

export function xToDate(x: number, rangeStart: Date, pixelsPerDay: number): Date {
  const days = x / pixelsPerDay
  const ms = rangeStart.getTime() + days * 24 * 60 * 60 * 1000
  return new Date(ms)
}

export function calcTimelineRange(projects: LinearProject[]): TimelineRange {
  const datedProjects = projects.filter((p) => p.startDate || p.targetDate)

  if (datedProjects.length === 0) {
    // Fallback: current year
    const now = new Date()
    const year = now.getUTCFullYear()
    return {
      startDate: startOfQuarter(new Date(Date.UTC(year, 0, 1, 12))),
      endDate: endOfQuarter(new Date(Date.UTC(year, 9, 1, 12))),
    }
  }

  let minDate: Date | null = null
  let maxDate: Date | null = null

  for (const p of datedProjects) {
    if (p.startDate) {
      const d = parseDate(p.startDate)
      if (!minDate || d < minDate) minDate = d
    }
    if (p.targetDate) {
      const d = parseDate(p.targetDate)
      if (!maxDate || d > maxDate) maxDate = d
    }
  }

  if (!minDate) minDate = maxDate!
  if (!maxDate) maxDate = minDate

  // Extend to quarter boundaries
  const start = startOfQuarter(minDate)
  const end = endOfQuarter(maxDate)

  // Add 1 quarter padding on each side
  const paddedStart = addQuarters(start, -1)
  const paddedEnd = addQuarters(end, 1)

  return {
    startDate: startOfQuarter(paddedStart),
    endDate: endOfQuarter(paddedEnd),
  }
}

export function formatDate(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDate(s: string): Date {
  return new Date(`${s}T12:00:00Z`)
}

export function daysBetween(a: Date, b: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000
  return (b.getTime() - a.getTime()) / msPerDay
}

export interface Week {
  label: string      // "W23"
  startDate: Date    // Monday
  endDate: Date      // Sunday
}

export interface Day {
  label: string      // "15" (day of month)
  date: Date
  isWeekend: boolean
}

/** Returns ISO weeks that overlap the given range. Weeks start on Monday. */
export function getWeeksInRange(range: TimelineRange): Week[] {
  const weeks: Week[] = []
  // Find the Monday on or before range.startDate
  const startDow = range.startDate.getUTCDay() // 0=Sun,1=Mon,...
  const daysToMonday = (startDow + 6) % 7      // days back to Monday
  const msPerDay = 24 * 60 * 60 * 1000

  let weekStart = new Date(range.startDate.getTime() - daysToMonday * msPerDay)
  // Normalize to noon UTC to avoid DST issues
  weekStart = new Date(Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate(), 12))

  while (weekStart <= range.endDate) {
    const weekEnd = new Date(weekStart.getTime() + 6 * msPerDay)
    // ISO week number
    const jan4 = new Date(Date.UTC(weekStart.getUTCFullYear(), 0, 4, 12))
    const jan4Dow = jan4.getUTCDay() || 7 // make Sunday = 7
    const jan4Monday = new Date(jan4.getTime() - (jan4Dow - 1) * msPerDay)
    const weekNum = Math.round((weekStart.getTime() - jan4Monday.getTime()) / (7 * msPerDay)) + 1

    weeks.push({
      label: `W${weekNum}`,
      startDate: new Date(weekStart),
      endDate: new Date(weekEnd),
    })
    weekStart = new Date(weekStart.getTime() + 7 * msPerDay)
  }
  return weeks
}

/** Returns each calendar day in the range (inclusive). */
export function getDaysInRange(range: TimelineRange): Day[] {
  const days: Day[] = []
  const msPerDay = 24 * 60 * 60 * 1000
  let current = new Date(Date.UTC(
    range.startDate.getUTCFullYear(),
    range.startDate.getUTCMonth(),
    range.startDate.getUTCDate(),
    12
  ))
  const end = new Date(Date.UTC(
    range.endDate.getUTCFullYear(),
    range.endDate.getUTCMonth(),
    range.endDate.getUTCDate(),
    12
  ))
  while (current <= end) {
    const dow = current.getUTCDay() // 0=Sun, 6=Sat
    days.push({
      label: String(current.getUTCDate()),
      date: new Date(current),
      isWeekend: dow === 0 || dow === 6,
    })
    current = new Date(current.getTime() + msPerDay)
  }
  return days
}
