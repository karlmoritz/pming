export interface Team {
  id: string
  name: string
  key: string
}

export interface Initiative {
  id: string
  name: string
  color?: string
  projectIds?: string[]
}

export interface ProjectLabel {
  id: string
  name: string
  color: string
}

export interface ProjectState {
  name: string
  color: string
  type: string
}

export interface LinearProject {
  id: string
  name: string
  slugId: string
  url: string
  startDate?: string
  targetDate?: string
  estimatedDates?: boolean
  estimatedStart?: boolean
  estimatedEnd?: boolean
  initiative?: Initiative
  labels: ProjectLabel[]
  state: ProjectState
  teamIds: string[]
  color?: string
}

export type SwimlaneMode = 'initiative' | 'label' | 'label+initiative'

export interface Milestone {
  id: string
  label: string
  date: string  // ISO date string
  color: string
  hidden?: boolean
}

export interface PendingChange {
  projectId: string
  projectName: string
  field: 'startDate' | 'targetDate' | 'initiativeId'
  oldValue?: string
  newValue?: string
}

export interface RoadmapConfig {
  version: number
  teamId?: string
  swimlaneMode: SwimlaneMode
  milestones: Milestone[]
  zoomFactor?: number
  viewStartDate?: string
  viewEndDate?: string
  hiddenLabelIds?: string[]
}

export interface Swimlane {
  id: string
  label: string
  color?: string
  projects: LinearProject[]
}

export interface TimelineRange {
  startDate: Date
  endDate: Date
}

export interface Quarter {
  label: string
  year: number
  quarter: number
  startDate: Date
  endDate: Date
}
