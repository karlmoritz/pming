import type { LinearProject, Swimlane, SwimlaneMode, Initiative } from '../types'

export function buildSwimlanes(
  projects: LinearProject[],
  mode: SwimlaneMode,
  initiatives: Initiative[],
  hiddenLabelIds: string[] = []
): Swimlane[] {
  if (mode === 'initiative') {
    return buildByInitiative(projects, initiatives)
  } else if (mode === 'label') {
    return buildByLabel(projects, hiddenLabelIds)
  } else {
    return buildByLabelAndInitiative(projects, initiatives, hiddenLabelIds)
  }
}

function buildByInitiative(projects: LinearProject[], _initiatives: Initiative[]): Swimlane[] {
  const map = new Map<string, Swimlane>()

  for (const project of projects) {
    const init = project.initiative
    const key = init ? init.id : '__no_initiative__'
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        label: init ? init.name : 'No Initiative',
        color: init?.color,
        projects: [],
      })
    }
    map.get(key)!.projects.push(project)
  }

  const named: Swimlane[] = []
  const fallback: Swimlane[] = []
  for (const [id, sw] of map) {
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

// Each project appears once per (label × initiative) combination it belongs to.
function buildByLabelAndInitiative(
  projects: LinearProject[],
  _initiatives: Initiative[],
  hiddenLabelIds: string[]
): Swimlane[] {
  const map = new Map<string, Swimlane>()

  for (const project of projects) {
    const labels = project.labels.length > 0 ? project.labels : [null]
    const init = project.initiative ?? null

    for (const label of labels) {
      const labelId = label ? label.id : '__no_label__'
      if (hiddenLabelIds.includes(labelId)) continue

      const labelName = label ? label.name : 'No Label'
      const initName = init ? init.name : 'No Initiative'
      const initId = init ? init.id : '__no_init__'
      const key = `${labelId}|${initId}`

      if (!map.has(key)) {
        map.set(key, {
          id: key,
          label: `${labelName} · ${initName}`,
          color: init?.color ?? label?.color,
          projects: [],
        })
      }
      map.get(key)!.projects.push(project)
    }
  }

  const named: Swimlane[] = []
  const fallback: Swimlane[] = []
  for (const [key, sw] of map) {
    ;(key.startsWith('__no_label__|__no_init__') ? fallback : named).push(sw)
  }
  named.sort((a, b) => a.label.localeCompare(b.label))
  return [...named, ...fallback]
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
