'use client'

/**
 * PlayerScoring — un solo set de 4 sliders (pass/duel/shot/defense) que afecta
 * a todos los jugadores seleccionados simultáneamente.
 * Ponytail: el store `globalWeights` se aplica uniformemente; per-jugador weights
 * ya no se usan.
 */
import { useDashboard } from '@/store/store'
import type { ComparePlayer } from '@/lib/types'

const PLAYER_COLORS = ['#00d68f', '#9b59ff', '#f5c842', '#ff6b35', '#4d9eff', '#ff4757', '#00bcd4', '#e5c07b']

function sc(s: number): string {
  if (s >= 7) return '#00d68f'
  if (s >= 5) return '#f5c842'
  if (s >= 3) return '#ff6b35'
  return '#ff4757'
}

function getMetricValue(player: ComparePlayer, key: string): number {
  const v = player[key]
  if (typeof v !== 'number') return 0
  if (key.includes('rate')) return v * 10
  if (key === 'goals_per90') return v * 10
  if (key === 'shots_per90') return Math.min(v * 2, 10)
  if (key === 'pressures_per90') return Math.min(v * 1.5, 10)
  if (key === 'duels_per90') return Math.min(v * 2, 10)
  if (key === 'dribbles_per90') return Math.min(v * 3, 10)
  if (key === 'carries_per90') return Math.min(v * 0.5, 10)
  if (key === 'clearances_per90') return Math.min(v * 3, 10)
  if (key === 'ball_recoveries_per90') return Math.min(v * 1.5, 10)
  return Math.min(v, 10)
}

export function PlayerScoring() {
  const { comparePlayers, selectedPlayerIds, globalWeights, setGlobalWeight } = useDashboard()

  if (!comparePlayers.length) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ textAlign: 'center' }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="12" r="5" stroke="var(--c-bdr2)" strokeWidth="1.5" />
            <path d="M6 28c0-5.523 4.477-10 10-10s10 4.477 10 10" stroke="var(--c-bdr2)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <div style={{ fontSize: 10, color: 'var(--c-t5)', marginTop: 8, letterSpacing: '0.08em' }}>
            Selecciona jugadores
          </div>
        </div>
      </div>
    )
  }

  const w = globalWeights
  const wSum = w.pass + w.duel + w.shot + w.defense

  const compute = (player: ComparePlayer) => {
    const passScore = getMetricValue(player, 'passes_per90') * 0.3
      + getMetricValue(player, 'pass_completion_rate') * 0.4
      + getMetricValue(player, 'progressive_passes_per90') * 0.3
    const duelScore = getMetricValue(player, 'duels_per90') * 0.4 + getMetricValue(player, 'duel_win_rate') * 0.6
    const shotScore = getMetricValue(player, 'goals_per90') * 0.5 + getMetricValue(player, 'shots_per90') * 0.5
    const defenseScore = getMetricValue(player, 'pressures_per90') * 0.35
      + getMetricValue(player, 'ball_recoveries_per90') * 0.3
      + getMetricValue(player, 'clearances_per90') * 0.2
      + getMetricValue(player, 'blocks_per90') * 0.15
    return wSum > 0
      ? (passScore * w.pass + duelScore * w.duel + shotScore * w.shot + defenseScore * w.defense) / wSum
      : 0
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto', background: 'var(--c-bg)' }}>
      {/* Sliders globales */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--c-bdr)' }}>
        <div style={{ fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--c-t4)', marginBottom: 8, fontWeight: 500 }}>
          Pesos globales · {comparePlayers.length} jugadores
        </div>
        <Slider label="Pases"  c="#00d68f" v={w.pass}    onChange={v => setGlobalWeight({ pass: v })} />
        <Slider label="Duelos" c="#4d9eff" v={w.duel}    onChange={v => setGlobalWeight({ duel: v })} />
        <Slider label="Tiros"  c="#ff6b35" v={w.shot}    onChange={v => setGlobalWeight({ shot: v })} />
        <Slider label="Defensa" c="#f5c842" v={w.defense} onChange={v => setGlobalWeight({ defense: v })} />
      </div>

      {/* Lista de scores recalculados */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
        {comparePlayers.map((player, pi) => {
          const overall = compute(player)
          const color = PLAYER_COLORS[pi % PLAYER_COLORS.length]
          return (
            <div key={player.player_id} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 9px', marginBottom: 4, borderRadius: 3,
              background: 'var(--c-sur2)', border: '1px solid var(--c-bdr)',
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 10, color: 'var(--c-t1)', fontWeight: 500,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {player.player_name?.split(' ').slice(-1)[0] ?? `P${pi + 1}`}
              </span>
              <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 400, color: sc(overall) }}>
                {overall.toFixed(1)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Slider({ label, c, v, onChange }: {
  label: string; c: string; v: number; onChange: (x: number) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
      <span style={{ fontSize: 9, color: 'var(--c-t4)', minWidth: 45 }}>{label}</span>
      <input type="range" min={0} max={2} step={0.1} value={v}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ flex: 1, accentColor: c }} />
      <span style={{ fontFamily: 'monospace', fontSize: 8, color: c, minWidth: 28, textAlign: 'right', fontWeight: 600 }}>
        {v.toFixed(1)}x
      </span>
    </div>
  )
}