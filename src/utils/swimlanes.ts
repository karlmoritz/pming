import type { LinearProject, Swimlane, SwimlaneMode, Initiative, Team } from '../types'

export function buildSwimlanes(
  projects: LinearProject[],
  mode: SwimlaneMode,
  initiatives: Initiative[],
  hiddenLabelIds: string[] = [],
  teams: Team[] = [],
  hiddenInitiativeIds: string[] = [],
  swimlaneOrder?: Partial<Record<SwimlaneMode, string[]>>
): Swimlane[] {
  let swimlanes: Swimlane[]
  if (mode === 'initiative') {
    swimlanes = buildByInitiative(projects, initiatives, hiddenInitiativeIds)
  } else if (mode === 'label') {
    swimlanes = buildByLabel(projects, hiddenLabelIds)
  } else {
    swimlanes = buildByTeam(projects, teams)
  }

  const order = swimlaneOrder?.[mode]
  if (order && order.length > 0) {
    swimlanes = applyOrder(swimlanes, order)
  }
  return swimlanes
}

function applyOrder(swimlanes: Swimlane[], order: string[]): Swimlane[] {
  const map = new Map(swimlanes.map((s) => [s.id, s]))
  const result: Swimlane[] = []
  for (const id of order) {
    const sw = map.get(id)
    if (sw) result.push(sw)
  }
  for (const sw of swimlanes) {
    if (!order.includes(sw.id)) result.push(sw)
  }
  return result
}

function buildByInitiative(
  projects: LinearProject[],
  _initiatives: Initiative[],
  hiddenInitiativeIds: string[] = []
): Swimlane[] {
  const map = new Map<string, Swimlane>()

  for (const project of projects) {
    if (project.initiatives.length === 0) {
      if (!map.has('__no_initiative__')) {
        map.set('__no_initiative__', { id: '__no_initiative__', label: 'No Initiative', color: undefined, projects: [] })
      }
      map.get('__no_initiative__')!.projects.push(project)
    } else {
      for (const init of project.initiatives) {
        if (!map.has(init.id)) {
          map.set(init.id, { id: init.id, label: init.name, color: init.color, projects: [] })
        }
        map.get(init.id)!.projects.push(project)
      }
    }
  }

  const named: Swimlane[] = []
  const fallback: Swimlane[] = []
  for (const [id, sw] of map) {
    if (hiddenInitiativeIds.includes(id)) continue
    ;(id === '__no_initiative__' ? fallback : named).push(sw)
  }
  named.sort((a, b) => a.label.localeCompare(b.label))
  return [...named, ...fallback]
}

// Each project appears in a swimlane for EVERY label it carries.
// Projects with no labels go into "No Labels".
function buildByLabel(projects: LinearProject[], hiddenLabelIds: string[]): Swimlane[] {
  const map = new Map<string, Swimlane>()

  for (const project of projects) {
    if (project.labels.length === 0) {
      if (!map.has('__no_label__')) {
        map.set('__no_label__', { id: '__no_label__', label: 'No Labels', color: undefined, projects: [] })
      }
      map.get('__no_label__')!.projects.push(project)
    } else {
      for (const label of project.labels) {
        if (!map.has(label.id)) {
          map.set(label.id, { id: label.id, label: label.name, color: label.color, projects: [] })
        }
        map.get(label.id)!.projects.push(project)
      }
    }
  }

  const named: Swimlane[] = []
  const fallback: Swimlane[] = []
  for (const [id, sw] of map) {
    if (hiddenLabelIds.includes(id)) continue
    ;(id === '__no_label__' ? fallback : named).push(sw)
  }
  named.sort((a, b) => a.label.localeCompare(b.label))
  return [...named, ...fallback]
}

// Each project appears once per team it belongs to.
function buildByTeam(projects: LinearProject[], teams: Team[]): Swimlane[] {
  const map = new Map<string, Swimlane>()

  for (const project of projects) {
    for (const teamId of project.teamIds) {
      if (!map.has(teamId)) {
        const team = teams.find((t) => t.id === teamId)
        map.set(teamId, {
          id: teamId,
          label: team?.name ?? teamId,
          projects: [],
        })
      }
      map.get(teamId)!.projects.push(project)
    }
  }

  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label))
}

// Collect all unique labels across a project list (for the filter UI)
export function collectLabels(projects: LinearProject[]): Array<{ id: string; name: string; color: string }> {
  const seen = new Map<string, { id: string; name: string; color: string }>()
  for (const p of projects) {
    for (const l of p.labels) {
      if (!seen.has(l.id)) seen.set(l.id, l)
    }
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
}
