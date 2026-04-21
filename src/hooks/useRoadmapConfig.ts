import { useState, useEffect, useCallback } from 'react'
import type { RoadmapConfig } from '../types'
import {
  fetchTeams,
  findOrCreateConfigProject,
  findOrCreateConfigIssue,
  readConfigIssue,
  writeConfigIssue,
} from '../api/linear'

interface UseRoadmapConfigResult {
  config: RoadmapConfig | null
  configLoading: boolean
  configError: string | null
  saveConfig: (config: RoadmapConfig) => Promise<void>
  configIssueId: string | null
}

export function useRoadmapConfig(apiKey: string, teamId: string | undefined): UseRoadmapConfigResult {
  const [config, setConfig] = useState<RoadmapConfig | null>(null)
  const [configLoading, setConfigLoading] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)
  const [configIssueId, setConfigIssueId] = useState<string | null>(null)

  useEffect(() => {
    if (!apiKey) return

    let cancelled = false

    async function loadConfig() {
      setConfigLoading(true)
      setConfigError(null)

      try {
        // Determine the team to use for the config project
        let resolvedTeamId = teamId
        if (!resolvedTeamId) {
          const teams = await fetchTeams()
          const sorted = [...teams].sort((a, b) => a.name.localeCompare(b.name))
          resolvedTeamId = sorted[0]?.id
        }

        if (!resolvedTeamId) {
          if (!cancelled) {
            setConfigError('No teams found — cannot load config')
            setConfigLoading(false)
          }
          return
        }

        const projectId = await findOrCreateConfigProject(resolvedTeamId)
        if (!projectId) {
          if (!cancelled) {
            setConfigError('Could not find or create config project')
            setConfigLoading(false)
          }
          return
        }

        const issueId = await findOrCreateConfigIssue(projectId)
        if (!issueId) {
          if (!cancelled) {
            setConfigError('Could not find or create config issue')
            setConfigLoading(false)
          }
          return
        }

        if (!cancelled) {
          setConfigIssueId(issueId)
        }

        const savedConfig = await readConfigIssue(issueId)
        if (!cancelled) {
          setConfig(
            savedConfig ?? {
              version: 1,
              teamId,
              swimlaneMode: 'initiative',
              milestones: [],
            }
          )
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e)
          setConfigError(`Config load failed: ${msg}`)
          // Still provide a default config so the app is usable
          setConfig({
            version: 1,
            teamId,
            swimlaneMode: 'initiative',
            milestones: [],
          })
        }
      } finally {
        if (!cancelled) {
          setConfigLoading(false)
        }
      }
    }

    void loadConfig()
    return () => { cancelled = true }
  }, [apiKey, teamId])

  const saveConfig = useCallback(
    async (newConfig: RoadmapConfig) => {
      setConfig(newConfig)
      if (!configIssueId) return
      try {
        await writeConfigIssue(configIssueId, newConfig)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setConfigError(`Failed to save config: ${msg}`)
      }
    },
    [configIssueId]
  )

  return { config, configLoading, configError, saveConfig, configIssueId }
}
