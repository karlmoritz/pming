import { useState } from 'react'
import type { PendingChange } from '../types'

interface SyncPanelProps {
  changes: PendingChange[]
  onConfirm: () => Promise<{ applied: number; errors: string[] }>
  onCancel: () => void
  onDiscard: () => void
}

type SyncStatus = 'idle' | 'syncing' | 'done' | 'error'

function groupByProject(changes: PendingChange[]): Map<string, PendingChange[]> {
  const map = new Map<string, PendingChange[]>()
  for (const c of changes) {
    if (!map.has(c.projectId)) {
      map.set(c.projectId, [])
    }
    map.get(c.projectId)!.push(c)
  }
  return map
}

function fieldLabel(field: PendingChange['field']): string {
  switch (field) {
    case 'startDate': return 'Start Date'
    case 'targetDate': return 'Target Date'
    case 'initiativeId': return 'Initiative'
    default: return field
  }
}

export default function SyncPanel({ changes, onConfirm, onCancel, onDiscard }: SyncPanelProps) {
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [result, setResult] = useState<{ applied: number; errors: string[] } | null>(null)

  const grouped = groupByProject(changes)

  async function handleSync() {
    setStatus('syncing')
    try {
      const res = await onConfirm()
      setResult(res)
      setStatus(res.errors.length === 0 ? 'done' : 'error')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setResult({ applied: 0, errors: [msg] })
      setStatus('error')
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="sync-modal">
        <div className="sync-modal-header">
          <span className="sync-modal-title">Sync Changes to Linear</span>
          <button onClick={onCancel} style={{ padding: '4px 8px', fontSize: 16 }}>
            ✕
          </button>
        </div>

        <div className="sync-modal-body">
          {status === 'idle' && (
            <>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                The following {changes.length} change{changes.length !== 1 ? 's' : ''} will be
                synced to Linear:
              </p>

              {Array.from(grouped.entries()).map(([, projectChanges]) => {
                const projectName = projectChanges[0]!.projectName
                return (
                  <div key={projectChanges[0]!.projectId} className="sync-project-group">
                    <div className="sync-project-name">{projectName}</div>
                    {projectChanges.map((c, i) => (
                      <div key={i} className="sync-change-item">
                        <span className="sync-change-field">{fieldLabel(c.field)}</span>
                        <span className="sync-change-arrow">
                          {c.oldValue ?? '(none)'}
                        </span>
                        <span className="sync-change-arrow">→</span>
                        <span className="sync-change-value">
                          {c.newValue ?? '(none)'}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </>
          )}

          {status === 'syncing' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 0' }}>
              <div className="loading-spinner-lg" />
              <span style={{ color: 'var(--text-muted)' }}>Syncing {changes.length} changes...</span>
            </div>
          )}

          {(status === 'done' || status === 'error') && result && (
            <div className={`sync-result ${status === 'done' ? 'success' : 'error'}`}>
              {status === 'done' ? (
                <span>Successfully synced {result.applied} change{result.applied !== 1 ? 's' : ''} to Linear.</span>
              ) : (
                <div>
                  <div style={{ marginBottom: 8 }}>
                    Synced {result.applied} of {changes.length} changes. {result.errors.length} error{result.errors.length !== 1 ? 's' : ''}:
                  </div>
                  {result.errors.map((err, i) => (
                    <div key={i} style={{ fontSize: 12, marginTop: 4 }}>
                      • {err}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="sync-modal-footer">
          {status === 'idle' && (
            <>
              <button onClick={onDiscard} className="danger">
                Discard Changes
              </button>
              <button onClick={onCancel}>
                Cancel
              </button>
              <button className="primary" onClick={handleSync} disabled={changes.length === 0}>
                Sync to Linear
              </button>
            </>
          )}

          {status === 'syncing' && (
            <button disabled>Syncing...</button>
          )}

          {(status === 'done' || status === 'error') && (
            <button className="primary" onClick={onCancel}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
