import { useState, useEffect, useCallback } from 'react'
import type { Team, Initiative, LinearProject } from '../types'
import { fetchTeams, fetchInitiatives, fetchProjects, fetchTeamProjects, fetchLabelGroups } from '../api/linear'
import type { LabelGroup } from '../api/linear'

interface UseLinearDataResult {
  teams: Team[]
  initiatives: Initiative[]
  projects: LinearProject[]
  labelGroups: LabelGroup[]
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useLinearData(apiKey: string, selectedTeamIds: string[]): UseLinearDataResult {
  const [teams, setTeams] = useState<Team[]>([])
  const [initiatives, setInitiatives] = useState<Initiative[]>([])
  const [projects, setProjects] = useState<LinearProject[]>([])
  const [labelGroups, setLabelGroups] = useState<LabelGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  // Fetch teams on mount
  useEffect(() => {
    if (!apiKey) return

    let cancelled = false

    async function loadTeams() {
      try {
        const teamsData = await fetchTeams()
        if (!cancelled) setTeams(teamsData)
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e)
          setError(`Failed to load teams: ${msg}`)
        }
      }
    }

    void loadTeams()
    return () => { cancelled = true }
  }, [apiKey])

  // Fetch projects when selectedTeamId changes or refresh is triggered, then join initiatives
  useEffect(() => {
    if (!apiKey) return

    let cancelled = false

    async function loadProjects() {
      setLoading(true)
      setError(null)
      try {
        const [projectsData, initiativesData, labelGroupsData, projectTeamsMap] = await Promise.all([
          fetchProjects(selectedTeamIds),
          fetchInitiatives(),
          fetchLabelGroups(),
          fetchTeamProjects(selectedTeamIds),
        ])

        if (!cancelled) {
          // Build projectId → Initiative[] map (a project can belong to multiple initiatives)
          const projectInitiativesMap = new Map<string, Initiative[]>()
          for (const initiative of initiativesData) {
            for (const pid of initiative.projectIds ?? []) {
              if (!projectInitiativesMap.has(pid)) projectInitiativesMap.set(pid, [])
              projectInitiativesMap.get(pid)!.push(initiative)
            }
          }

          const joined = projectsData.map((p) => ({
            ...p,
            initiatives: projectInitiativesMap.get(p.id) ?? [],
            teamIds: (projectTeamsMap.get(p.id) ?? []).filter(
              (id) => selectedTeamIds.length === 0 || selectedTeamIds.includes(id)
            ),
          }))

          setInitiatives(initiativesData)
          setProjects(joined)
          setLabelGroups(labelGroupsData)
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e)
          setError(`Failed to load projects: ${msg}`)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadProjects()
    return () => { cancelled = true }
  // Use joined string as stable dependency key (array ref changes on every render)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, selectedTeamIds.join(','), refreshToken])

  const refresh = useCallback(() => {
    setRefreshToken((n) => n + 1)
  }, [])

  return { teams, initiatives, projects, labelGroups, loading, error, refresh }
}
