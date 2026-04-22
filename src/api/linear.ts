import type { Team, Initiative, LinearProject, RoadmapConfig, PendingChange } from '../types'

const LINEAR_API = 'https://api.linear.app/graphql'

let apiKey = ''

export function setApiKey(key: string): void {
  apiKey = key
}

export function getApiKey(): string {
  return apiKey
}

async function gql<T>(query: string, variables?: object): Promise<T> {
  const response = await fetch(LINEAR_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': apiKey,
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`HTTP ${response.status}: ${text}`)
  }

  const json = await response.json() as { data?: T; errors?: Array<{ message: string }> }

  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors.map((e) => e.message).join('; '))
  }

  if (!json.data) {
    throw new Error('No data returned from API')
  }

  return json.data
}

export async function testConnection(): Promise<string> {
  const data = await gql<{ viewer: { name: string } }>(`
    query {
      viewer {
        name
      }
    }
  `)
  return data.viewer.name
}

export async function fetchTeams(): Promise<Team[]> {
  const data = await gql<{ teams: { nodes: Array<{ id: string; name: string; key: string }> } }>(`
    query {
      teams(first: 250) {
        nodes {
          id
          name
          key
        }
      }
    }
  `)
  return data.teams.nodes
}

type InitiativeNode = {
  id: string
  name: string
  color?: string
  projects: { nodes: Array<{ id: string }> }
}

type InitiativesResponse = {
  initiatives: {
    nodes: Array<InitiativeNode>
    pageInfo: { hasNextPage: boolean; endCursor: string }
  }
}

export async function fetchInitiatives(): Promise<Initiative[]> {
  const allInitiatives: Initiative[] = []
  let hasNextPage = true
  let cursor: string | undefined = undefined

  while (hasNextPage) {
    const data: InitiativesResponse = await gql<InitiativesResponse>(`
      query Initiatives($after: String) {
        initiatives(first: 250, after: $after) {
          nodes {
            id
            name
            color
            projects(first: 50) {
              nodes { id }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `, { after: cursor })

    allInitiatives.push(
      ...data.initiatives.nodes.map((n) => ({
        id: n.id,
        name: n.name,
        color: n.color,
        projectIds: n.projects.nodes.map((p) => p.id),
      }))
    )
    hasNextPage = data.initiatives.pageInfo.hasNextPage
    cursor = data.initiatives.pageInfo.endCursor
  }

  return allInitiatives
}

// Linear's Project.state is a plain string enum (e.g. "planned", "started", "paused", "completed", "cancelled")
// Linear's Project.initiatives is a connection (not a singular "initiative" field)
const STATE_COLORS: Record<string, string> = {
  backlog: '#95a2b3',
  unstarted: '#95a2b3',
  planned: '#95a2b3',
  started: '#6d82e3',
  paused: '#f2c94c',
  completed: '#5cb85c',
  cancelled: '#b0b7c3',
}

function mapState(stateStr: string): { name: string; color: string; type: string } {
  return {
    name: stateStr.charAt(0).toUpperCase() + stateStr.slice(1),
    color: STATE_COLORS[stateStr] ?? '#95a2b3',
    type: stateStr,
  }
}

type ProjectNode = {
  id: string
  name: string
  slugId: string
  url: string
  startDate?: string
  targetDate?: string
  color?: string
  state: string
  labels: { nodes: Array<{ id: string; name: string; color: string }> }
}

type ProjectsResponse = {
  projects: {
    nodes: Array<ProjectNode>
    pageInfo: { hasNextPage: boolean; endCursor: string }
  }
}

export async function fetchProjects(teamIds: string[] = []): Promise<LinearProject[]> {
  const allProjects: LinearProject[] = []
  let hasNextPage = true
  let cursor: string | undefined = undefined

  // Avoid nested connections in this query — initiatives are joined client-side
  const filter =
    teamIds.length === 0 ? undefined
    : teamIds.length === 1 ? { accessibleTeams: { id: { eq: teamIds[0] } } }
    : { accessibleTeams: { id: { in: teamIds } } }

  while (hasNextPage && allProjects.length < 500) {
    const data: ProjectsResponse = await gql<ProjectsResponse>(`
      query Projects($filter: ProjectFilter, $after: String) {
        projects(filter: $filter, first: 100, after: $after) {
          nodes {
            id
            name
            slugId
            url
            startDate
            targetDate
            color
            state
            labels(first: 10) {
              nodes { id name color }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `, { filter, after: cursor })

    const mapped = data.projects.nodes
      .filter((p: ProjectNode) => p.state !== 'completed' && p.state !== 'canceled')
      .map((p: ProjectNode) => ({
        id: p.id,
        name: p.name,
        slugId: p.slugId,
        url: p.url,
        startDate: p.startDate,
        targetDate: p.targetDate,
        color: p.color,
        state: mapState(p.state),
        initiative: undefined as LinearProject['initiative'],
        labels: p.labels.nodes.map((l) => ({ id: l.id, name: l.name, color: l.color })),
        teamIds: teamIds,
      }))

    allProjects.push(...mapped)
    hasNextPage = data.projects.pageInfo.hasNextPage
    cursor = data.projects.pageInfo.endCursor
  }

  return allProjects
}

export async function findOrCreateConfigProject(teamId: string): Promise<string | null> {
  try {
    // Search for existing "Roadmap Config" project
    const data = await gql<{
      projects: { nodes: Array<{ id: string; name: string }> }
    }>(`
      query {
        projects(filter: { name: { eq: "Roadmap Config" } }, first: 10) {
          nodes { id name }
        }
      }
    `)

    const existing = data.projects.nodes.find((p) => p.name === 'Roadmap Config')
    if (existing) return existing.id

    // Create the project
    const createData = await gql<{
      projectCreate: { success: boolean; project: { id: string } }
    }>(`
      mutation CreateProject($input: ProjectCreateInput!) {
        projectCreate(input: $input) {
          success
          project { id }
        }
      }
    `, {
      input: {
        name: 'Roadmap Config',
        teamIds: [teamId],
        description: 'Internal project for storing roadmap view configuration. Do not delete.',
      },
    })

    if (createData.projectCreate.success) {
      return createData.projectCreate.project.id
    }
    return null
  } catch (e) {
    console.error('findOrCreateConfigProject error:', e)
    return null
  }
}

export async function findOrCreateConfigIssue(configProjectId: string): Promise<string | null> {
  try {
    // Search for existing issue
    const data = await gql<{
      issues: { nodes: Array<{ id: string; title: string }> }
    }>(`
      query {
        issues(filter: { title: { eq: "roadmap-view-state" }, project: { id: { eq: "${configProjectId}" } } }, first: 10) {
          nodes { id title }
        }
      }
    `)

    const existing = data.issues.nodes.find((i) => i.title === 'roadmap-view-state')
    if (existing) return existing.id

    // Use a team that is actually linked to the config project (issues must match project team)
    const projectData = await gql<{
      project: { teams: { nodes: Array<{ id: string }> } }
    }>(`
      query {
        project(id: "${configProjectId}") {
          teams { nodes { id } }
        }
      }
    `)

    const projectTeamId = projectData.project.teams.nodes[0]?.id
    if (!projectTeamId) return null
    const teamId = projectTeamId

    const defaultConfig: RoadmapConfig = {
      version: 1,
      swimlaneMode: 'initiative',
      milestones: [],
    }

    const description = buildConfigDescription(defaultConfig)

    const createData = await gql<{
      issueCreate: { success: boolean; issue: { id: string } }
    }>(`
      mutation CreateIssue($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue { id }
        }
      }
    `, {
      input: {
        title: 'roadmap-view-state',
        description,
        teamId,
        projectId: configProjectId,
      },
    })

    if (createData.issueCreate.success) {
      return createData.issueCreate.issue.id
    }
    return null
  } catch (e) {
    console.error('findOrCreateConfigIssue error:', e)
    return null
  }
}

function buildConfigDescription(config: RoadmapConfig): string {
  const json = JSON.stringify(config)
  return `Roadmap view configuration — do not edit manually.\n\n\`\`\`roadmap-config\n${json}\n\`\`\``
}

export async function readConfigIssue(issueId: string): Promise<RoadmapConfig | null> {
  try {
    const data = await gql<{
      issue: { id: string; description?: string }
    }>(`
      query {
        issue(id: "${issueId}") {
          id
          description
        }
      }
    `)

    const desc = data.issue.description
    if (!desc) return null

    // Primary format: code fence (preserved by Linear's Prosemirror editor).
    // Fallback: legacy HTML comment format (Linear strips these, so this only
    // helps if somehow the old format survived).
    const match =
      desc.match(/```roadmap-config\n([\s\S]*?)\n```/) ??
      desc.match(/<!--\s*ROADMAP_CONFIG\s*\n([\s\S]*?)\nROADMAP_CONFIG\s*-->/)
    if (!match || !match[1]) return null

    const parsed = JSON.parse(match[1].trim()) as RoadmapConfig
    return parsed
  } catch (e) {
    console.error('readConfigIssue error:', e)
    return null
  }
}

export async function writeConfigIssue(issueId: string, config: RoadmapConfig): Promise<void> {
  const description = buildConfigDescription(config)

  await gql<{ issueUpdate: { success: boolean } }>(`
    mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) {
        success
      }
    }
  `, {
    id: issueId,
    input: { description },
  })
}

export interface LabelGroup {
  id: string
  name: string
  color?: string
  children: Array<{ id: string; name: string; color: string }>
}

export async function fetchLabelGroups(): Promise<LabelGroup[]> {
  const data = await gql<{
    projectLabels: {
      nodes: Array<{
        id: string; name: string; color?: string; isGroup: boolean;
        children: { nodes: Array<{ id: string; name: string; color: string }> }
      }>
    }
  }>(`
    query {
      projectLabels(first: 100) {
        nodes {
          id name color isGroup
          children { nodes { id name color } }
        }
      }
    }
  `)
  return data.projectLabels.nodes
    .filter(n => n.isGroup)
    .map(n => ({
      id: n.id,
      name: n.name,
      color: n.color,
      children: n.children.nodes,
    }))
}

export async function applyChanges(
  changes: PendingChange[]
): Promise<{ applied: number; errors: string[] }> {
  let applied = 0
  const errors: string[] = []

  for (const change of changes) {
    try {
      if (change.field === 'startDate' || change.field === 'targetDate') {
        await gql<{ projectUpdate: { success: boolean } }>(`
          mutation UpdateProject($id: String!, $input: ProjectUpdateInput!) {
            projectUpdate(id: $id, input: $input) {
              success
              project { id startDate targetDate }
            }
          }
        `, {
          id: change.projectId,
          input: {
            [change.field]: change.newValue ?? null,
          },
        })
        applied++
      } else if (change.field === 'initiativeId') {
        try {
          await gql<{ projectUpdate: { success: boolean } }>(`
            mutation UpdateProject($id: String!, $input: ProjectUpdateInput!) {
              projectUpdate(id: $id, input: $input) {
                success
                project { id }
              }
            }
          `, {
            id: change.projectId,
            input: {
              initiativeId: change.newValue ?? null,
            },
          })
          applied++
        } catch (initiativeErr) {
          console.warn('Initiative update not supported or failed:', initiativeErr)
          // Silently skip initiative errors
          applied++
        }
      } else if (change.field === 'labelIds') {
        const labelIds = change.newValue ? change.newValue.split(',').filter(Boolean) : []
        await gql<{ projectUpdate: { success: boolean } }>(`
          mutation UpdateProject($id: String!, $input: ProjectUpdateInput!) {
            projectUpdate(id: $id, input: $input) {
              success
              project { id }
            }
          }
        `, {
          id: change.projectId,
          input: { labelIds },
        })
        applied++
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`${change.projectName} (${change.field}): ${msg}`)
    }
  }

  return { applied, errors }
}
