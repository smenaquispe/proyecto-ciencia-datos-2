'use client'

import { useDashboard } from '@/store/store'
import type { ProjectionPlayer } from '@/lib/types'

const FEAT_KEYS = [
  'shots_per90', 'goals_per90', 'shots_on_target_per90',
  'passes_per90', 'progressive_passes_per90', 'pass_completion_rate',
  'pressures_per90', 'duels_per90', 'duel_win_rate',
  'dribbles_per90', 'carries_per90', 'clearances_per90',
]

const FEAT_LABELS: Record<string, string> = {
  shots_per90: 'Tiros/90', goals_per90: 'Goles/90', shots_on_target_per90: 'A puerta/90',
  passes_per90: 'Pases/90', progressive_passes_per90: 'Progresivos/90', pass_completion_rate: '% Precisión',
  pressures_per90: 'Presiones/90', duels_per90: 'Duelos/90', duel_win_rate: '% Duelos',
  dribbles_per90: 'Regates/90', carries_per90: 'Conducciones/90', clearances_per90: 'Despejes/90',
}

export function GroupComparison() {
  const { comparePlayers, scatterPlayers, selectedPlayerIds } = useDashboard()

  if (!selectedPlayerIds.length || !scatterPlayers.length) {
    return <Placeholder text="Selecciona jugadores en el scatter plot" />
  }

  const selected = scatterPlayers.filter(p => selectedPlayerIds.includes(p.player_id as number)) as ProjectionPlayer[]

  if (!selected.length) {
    return <Placeholder text="Jugadores no encontrados en datos actuales" />
  }

  const avg: Record<string, number> = {}
  const maxVals: Record<string, number> = {}
  FEAT_KEYS.forEach(key => {
    const vals = selected.map(p => typeof p[key] === 'number' ? p[key] as number : 0)
    avg[key] = vals.reduce((a, b) => a + b, 0) / vals.length
    maxVals[key] = Math.max(...vals, 0.01)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto', background: 'var(--c-bg)' }}>
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid var(--c-bdr)', flexShrink: 0,
        background: 'var(--c-sur1)',
      }}>
        <div style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--c-t4)', fontWeight: 500, marginBottom: 8 }}>
          Grupo — {selected.length} jugadores
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {selected.slice(0, 15).map(p => (
            <span key={p.player_id} style={{
              fontSize: 9, color: 'var(--c-t2)', padding: '2px 6px',
              background: 'var(--c-sur2)', borderRadius: 2,
            }}>
              {p.player_name?.split(' ').slice(-1)[0]}
            </span>
          ))}
          {selected.length > 15 && (
            <span style={{ fontSize: 9, color: 'var(--c-t5)' }}>+{selected.length - 15}</span>
          )}
        </div>
      </div>

      <div style={{ padding: '10px 14px' }}>
        <div style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--c-t4)', fontWeight: 500, marginBottom: 10 }}>
          Promedios del grupo
        </div>
        {FEAT_KEYS.map(key => {
          const val = avg[key]
          const pct = (val / maxVals[key]) * 100
          return (
            <div key={key} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: 9, color: 'var(--c-t3)' }}>{FEAT_LABELS[key]}</span>
                <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--c-t2)', fontWeight: 500 }}>
                  {val.toFixed(2)}
                </span>
              </div>
              <div style={{ height: 2, background: 'var(--c-bdr)', borderRadius: 1, position: 'relative' }}>
                <div style={{
                  position: 'absolute', left: 0, top: 0, height: '100%',
                  width: `${Math.min(pct, 100)}%`,
                  background: 'var(--c-acc)', borderRadius: 1,
                  opacity: 0.7,
                }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Placeholder({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ textAlign: 'center' }}>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="12" r="5" stroke="var(--c-bdr2)" strokeWidth="1.5" />
          <path d="M6 28c0-5.523 4.477-10 10-10s10 4.477 10 10" stroke="var(--c-bdr2)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <div style={{ fontSize: 10, color: 'var(--c-t5)', marginTop: 8, letterSpacing: '0.08em' }}>
          {text}
        </div>
      </div>
    </div>
  )
}
