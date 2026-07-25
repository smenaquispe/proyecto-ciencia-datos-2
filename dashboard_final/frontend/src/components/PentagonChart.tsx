'use client'

import { useState, useMemo } from 'react'
import { useDashboard } from '@/store/store'
import type { ComparePlayer, FcmPlayer } from '@/lib/types'

interface PentMetric {
  id: string
  label: string
  short: string
  color: string
  get: (p: ComparePlayer) => number
}

const ALL_METRICS: PentMetric[] = [
  { id: 'passes_per90',      label: 'Pases/90',     short: 'Pases',  color: '#00d68f', get: p => typeof p.passes_per90 === 'number' ? p.passes_per90 as number : 0 },
  { id: 'progressive_passes_per90', label: 'Progresivos/90', short: 'Prog',   color: '#4d9eff', get: p => typeof p.progressive_passes_per90 === 'number' ? p.progressive_passes_per90 as number : 0 },
  { id: 'pass_completion_rate',     label: '% Precisión',   short: 'Prec',   color: '#4d9eff', get: p => (typeof p.pass_completion_rate === 'number' ? (p.pass_completion_rate as number) : 0) * 10 },
  { id: 'goals_per90',       label: 'Goles/90',    short: 'Goles',  color: '#ff6b35', get: p => typeof p.goals_per90 === 'number' ? (p.goals_per90 as number) * 10 : 0 },
  { id: 'shots_per90',       label: 'Tiros/90',    short: 'Tiros',  color: '#ff6b35', get: p => typeof p.shots_per90 === 'number' ? Math.min((p.shots_per90 as number) * 2, 10) : 0 },
  { id: 'duels_per90',       label: 'Duelos/90',   short: 'Duelos', color: '#9b59ff', get: p => typeof p.duels_per90 === 'number' ? Math.min((p.duels_per90 as number) * 2, 10) : 0 },
  { id: 'duel_win_rate',     label: '% Duelos',     short: '%Duel',  color: '#9b59ff', get: p => (typeof p.duel_win_rate === 'number' ? (p.duel_win_rate as number) : 0) * 10 },
  { id: 'pressures_per90',   label: 'Presiones/90', short: 'Pres',   color: '#f5c842', get: p => typeof p.pressures_per90 === 'number' ? Math.min((p.pressures_per90 as number) * 1.5, 10) : 0 },
  { id: 'dribbles_per90',    label: 'Regates/90',  short: 'Reg',    color: '#ff4757', get: p => typeof p.dribbles_per90 === 'number' ? Math.min((p.dribbles_per90 as number) * 3, 10) : 0 },
  { id: 'carries_per90',     label: 'Conduc/90',   short: 'Cond',   color: '#00bcd4', get: p => typeof p.carries_per90 === 'number' ? Math.min((p.carries_per90 as number) * 0.5, 10) : 0 },
  { id: 'clearances_per90',  label: 'Despejes/90', short: 'Desp',   color: '#56b6c2', get: p => typeof p.clearances_per90 === 'number' ? Math.min((p.clearances_per90 as number) * 3, 10) : 0 },
  { id: 'ball_recoveries_per90', label: 'Recup/90', short: 'Recup', color: '#e5c07b', get: p => typeof p.ball_recoveries_per90 === 'number' ? Math.min((p.ball_recoveries_per90 as number) * 1.5, 10) : 0 },
]

const DEFAULT_IDS = ['passes_per90', 'progressive_passes_per90', 'goals_per90', 'duels_per90', 'pressures_per90']
const PLAYER_COLORS = ['#00d68f', '#9b59ff', '#f5c842', '#ff6b35', '#4d9eff', '#ff4757', '#00bcd4', '#e5c07b']

function sc(s: number): string {
  if (s >= 7) return '#00d68f'
  if (s >= 5) return '#f5c842'
  if (s >= 3) return '#ff6b35'
  return '#ff4757'
}

/** Intersección fuzzy tipo Venn entre jugadores seleccionados usando memberships DEC. */
function VennOverlap() {
  const { scatterPlayers, selectedPlayerIds } = useDashboard()
  const players = (scatterPlayers as FcmPlayer[])
    .filter(p => selectedPlayerIds.includes(p.player_id) && p.memberships) as FcmPlayer[]
  const n = Math.min(players.length, 4)

  // Jaccard fuzzy promedio sobre todos los pares
  const avgJ = useMemo(() => {
    if (n < 2) return 0
    let sMin = 0, sMax = 0, pairs = 0
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const mA = players[i].memberships!, mB = players[j].memberships!
        const k = Math.min(mA.length, mB.length)
        for (let t = 0; t < k; t++) { sMin += Math.min(mA[t], mB[t]); sMax += Math.max(mA[t], mB[t]) }
        pairs++
      }
    }
    return sMax > 0 ? sMin / sMax : 0
  }, [players, n])

  if (n < 2) {
    return <div style={{ fontSize: 9, color: 'var(--c-t5)', textAlign: 'center', padding: 20 }}>
      Selecciona 2+ jugadores para ver la intersección
    </div>
  }

  // Coordenadas de N círculos en arreglo Venn estándar. Separación inversa a Jaccard:
  //   J=0  → totalmente separados;  J=1  → alineados en el mismo centro.
  //   Ponytail: hecho simple para 2-4 círculos; upgrade:trueVenn polynomial layout si N>4.
  const CX = 75, CY = 75, R = 25
  const sep = R * 1.6 * (1 - avgJ)  // 0 → sólido; J=1 → coinciden
  const centers: Array<{ x: number; y: number }> = []
  if (n === 2) {
    centers.push({ x: CX - sep / 2, y: CY }, { x: CX + sep / 2, y: CY })
  } else {
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2
      centers.push({ x: CX + sep * 0.5 * Math.cos(angle), y: CY + sep * 0.5 * Math.sin(angle) })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 6 }}>
      <div style={{ fontSize: 8, color: 'var(--c-t4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
        Intersección de perfiles
      </div>
      <svg viewBox="0 0 150 130" style={{ width: '100%', maxWidth: 170, height: 120 }}>
        {centers.map((c, i) => {
          const pc = PLAYER_COLORS[i % PLAYER_COLORS.length]
          const rgb = hexToRgb(pc)
          return (
            <circle key={i} cx={c.x} cy={c.y} r={R}
              fill={`rgba(${rgb},0.28)`} stroke={pc} strokeWidth={1.2} />
          )
        })}
        {players.slice(0, n).map((pl, i) => {
          const c = centers[i]
          const pc = PLAYER_COLORS[i % PLAYER_COLORS.length]
          return (
            <text key={i} x={c.x + (i === 0 ? -8 : i === 1 ? 8 : (i - (n - 1) / 2) * 14)}
              y={c.y + 33} textAnchor="middle"
              fontSize={7} fill={pc} fontWeight={600}>
              {pl.player_name.split(' ').slice(-1)[0]}
            </text>
          )
        })}
        <text x={CX} y={CY + 2} textAnchor="middle" fontSize={9}
          fill="var(--c-t1)" fontWeight={600} fontFamily="monospace">
          {(avgJ * 100).toFixed(0)}%
        </text>
      </svg>
      <div style={{ fontSize: 7, color: 'var(--c-t5)' }}>Jaccard promedio</div>
    </div>
  )
}

function hexToRgb(hex: string) {
  const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) return '128,128,128'
  return `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}`
}

export function PentagonChart({ players }: { players: ComparePlayer[] }) {
  const [selectedIds, setSelectedIds] = useState<string[]>(DEFAULT_IDS)

  const toggleMetric = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.length > 3 ? prev.filter(x => x !== id) : prev
        : [...prev, id]
    )
  }

  const axes = selectedIds.map(id => ALL_METRICS.find(m => m.id === id)!).filter(Boolean)
  const N = Math.max(axes.length, 3)
  const R = 90
  const CX = 110
  const CY = 110
  const angles = Array.from({ length: N }, (_, i) => (i / N) * Math.PI * 2 - Math.PI / 2)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--c-bg)' }}>
      {/* Metric selector */}
      <div style={{
        padding: '5px 10px', borderBottom: '1px solid var(--c-bdr)', flexShrink: 0,
        background: 'var(--c-sur1)',
      }}>
        <div style={{ fontSize: 8, color: 'var(--c-t4)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500, marginBottom: 4 }}>
          Ejes del pentágono
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {ALL_METRICS.map(m => {
            const active = selectedIds.includes(m.id)
            return (
              <button key={m.id} onClick={() => toggleMetric(m.id)} title={m.label} style={{
                padding: '2px 5px', fontSize: 7, letterSpacing: '0.03em',
                color: active ? '#e8e8e8' : 'var(--c-t5)',
                border: `1px solid ${active ? m.color : 'var(--c-bdr)'}`,
                borderRadius: 2, background: active ? `${m.color}18` : 'transparent',
                cursor: 'pointer', fontWeight: active ? 500 : 400,
              }}>
                {m.short}
              </button>
            )
          })}
        </div>
      </div>

      {/* Pentagon + Venn side by side */}
      {players.length > 0 && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left: Pentagon SVG */}
          <div style={{ flex: '0 0 60%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '4px 0' }}>
            <svg viewBox="0 0 220 220" style={{ width: '100%', height: '100%', maxWidth: 260, maxHeight: 260 }} preserveAspectRatio="xMidYMid meet">
              {[0.25, 0.5, 0.75, 1].map(t => {
                const gPts = angles.map(a => `${(CX + R * t * Math.cos(a)).toFixed(1)},${(CY + R * t * Math.sin(a)).toFixed(1)}`).join(' ')
                return <polygon key={t} points={gPts} fill="none" stroke={t === 1 ? 'var(--c-bdr2)' : 'var(--c-bdr)'} strokeWidth={t === 1 ? 0.8 : 0.5} />
              })}
              {angles.map((a, i) => (
                <line key={i} x1={CX} y1={CY} x2={CX + R * Math.cos(a)} y2={CY + R * Math.sin(a)}
                  stroke="var(--c-bdr)" strokeWidth={0.5} />
              ))}

              {players.map((player, pi) => {
                const vals = axes.map(a => {
                  const raw = a.get(player)
                  return Math.max(0, Math.min(10, raw))
                })
                const pts = vals.map((v, i) => ({
                  x: CX + (v / 10) * R * Math.cos(angles[i]),
                  y: CY + (v / 10) * R * Math.sin(angles[i]),
                }))
                const polygon = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
                const pc = PLAYER_COLORS[pi % PLAYER_COLORS.length]
                const rgb = hexToRgb(pc)

                return (
                  <g key={player.player_id}>
                    <polygon points={polygon} fill={`rgba(${rgb},0.12)`} stroke={pc} strokeWidth={1.2}
                      strokeDasharray={pi > 0 ? '3 2' : undefined} />
                    {pts.map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r={2.2} fill={pc} opacity={0.85} />
                    ))}
                  </g>
                )
              })}

              {angles.map((a, i) => {
                const lx = CX + (R + 15) * Math.cos(a)
                const ly = CY + (R + 15) * Math.sin(a)
                return (
                  <g key={i}>
                    <text x={lx} y={ly - 2} textAnchor="middle" fontSize={7.5} fill="var(--c-t2)" fontFamily="system-ui" fontWeight="500">
                      {axes[i]?.short ?? ''}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>

          {/* Right: Venn overlap (sustituye "Parámetros") */}
          <div style={{ flex: '0 0 40%', overflow: 'auto', borderLeft: '1px solid var(--c-bdr)', padding: '6px 6px', display: 'flex', flexDirection: 'column' }}>
            <VennOverlap />
            {/* valores por eje y jugador */}
            <div style={{ marginTop: 8, padding: '4px 6px' }}>
              <div style={{ fontSize: 7, color: 'var(--c-t5)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                Valores por eje
              </div>
              {axes.map(a => (
                <div key={a.id} style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 7, color: a.color, minWidth: 28, fontWeight: 500 }}>{a.short}</span>
                  {players.map((pl, pi) => {
                    const v = Math.max(0, Math.min(10, a.get(pl)))
                    return (
                      <span key={pl.player_id} style={{
                        fontSize: 7, fontFamily: 'monospace', color: sc(v), fontWeight: 600,
                        background: 'var(--c-sur2)', padding: '1px 4px', borderRadius: 2, marginRight: 2,
                      }}>
                        {pl.player_name?.split(' ').slice(-1)[0]?.substring(0, 4)}={v.toFixed(1)}
                      </span>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!players.length && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--c-t5)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Selecciona jugadores
          </span>
        </div>
      )}
    </div>
  )
}
