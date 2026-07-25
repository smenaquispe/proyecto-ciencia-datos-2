'use client'

/**
 * KeyActionsPanel — Vista coordinada de "Jugadas importantes" (T1+T3).
 *
 * Munzner: dos vistas coordinadas bajo el mantra Shneiderman
 *  · OVERVIEW: pitch 2D mostrando todas las acciones pesadas (color por jugador
 *    canal de identidad, radio por peso canal de magnitud). Ubicación = posición.
 *  · DETAILS-ON-DEMAND: lista lateral; hover fila resalta el punto en el pitch
 *    (Linked Highlighting).
 *
 * Datos: api.playerKeyActions por cada jugador seleccionado.
 */
import { useEffect, useState } from 'react'
import { useDashboard } from '@/store/store'
import { api } from '@/lib/api'
import type { KeyAction } from '@/lib/types'

const W = 120, H = 80
const PALETTE = [
  { main: 'rgba(0,214,143,0.9)', ring: 'rgba(0,214,143,0.3)' },
  { main: 'rgba(155,89,255,0.9)', ring: 'rgba(155,89,255,0.3)' },
  { main: 'rgba(245,200,66,0.9)', ring: 'rgba(245,200,66,0.3)' },
  { main: 'rgba(255,107,53,0.9)', ring: 'rgba(255,107,53,0.3)' },
]
const WEIGHT_COLORS = ['#5b6473', '#62b6c5', '#9b8cff', '#f5c842', '#ff6b35']
const TYPE_LABELS: Record<string, string> = {
  Shot: 'Tiro', Pass: 'Pase', 'Ball Recovery': 'Recuperación', Interception: 'Intercepción',
  Pressure: 'Presión', Clearance: 'Despeje', Block: 'Bloqueo',
}

interface Entry { playerName: string; actions: KeyAction[] }

export function KeyActionsPanel() {
  const { selectedPlayerIds, scatterPlayers, timeLimit } = useDashboard()
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(false)
  const [hoverIdx, setHoverIdx] = useState<string | null>(null)  // `${pi}_${ai}`

  useEffect(() => {
    if (!selectedPlayerIds.length) { setEntries([]); return }
    setLoading(true)
    Promise.all(selectedPlayerIds.map(async (id) => {
      const sp = (scatterPlayers as any[]).find(p => p.player_id === id)
      const r = await api.playerKeyActions(id)
      return { playerName: sp?.player_name ?? `Player ${id}`, actions: r.actions }
    }))
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [selectedPlayerIds.join(','), timeLimit])

  const allActions = entries.flatMap((e, pi) =>
    e.actions.map((a, ai) => ({ ...a, __pi: pi, __ai: ai, __player: e.playerName })) as any[])

  if (!selectedPlayerIds.length || (!loading && !allActions.length)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <span style={{ fontSize: 10, color: 'var(--c-t5)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Selecciona jugadores para ver sus jugadas importantes
        </span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--c-bg)' }}>
      {/* LEFT — overview pitch */}
      <div style={{ flex: 1, padding: 8, position: 'relative', overflow: 'hidden' }}>
        <div style={{ fontSize: 8, color: 'var(--c-t5)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {allActions.length} jugadas por peso táctico
        </div>
        <svg viewBox={`-4 -4 ${W + 8} ${H + 8}`} style={{ width: '100%', height: 'calc(100% - 20px)' }} preserveAspectRatio="xMidYMid meet">
          <rect x={-4} y={-4} width={W + 8} height={H + 8} fill="var(--c-pit)" />
          <g stroke="var(--c-pln)" strokeWidth={0.4} fill="none">
            <rect x={0} y={0} width={W} height={H} stroke="var(--c-pln2)" />
            <line x1={W / 2} y1={0} x2={W / 2} y2={H} stroke="var(--c-pln2)" strokeWidth={0.5} />
            <circle cx={W / 2} cy={H / 2} r={9.15} />
            <rect x={102} y={18} width={18} height={44} />
          </g>
          {allActions.map((a: any) => {
            if (a.x == null) return null
            const c = PALETTE[a.__pi % PALETTE.length]
            const r = 1.5 + (a.weight / 5) * 2.5
            const key = `${a.__pi}_${a.__ai}`
            const isHover = hoverIdx === key
            // peso -> base color override
            const wc = WEIGHT_COLORS[Math.min(a.weight - 1, 4)] ?? '#aaa'
            return (
              <g key={key}
                onMouseEnter={() => setHoverIdx(key)} onMouseLeave={() => setHoverIdx(null)}>
                <circle cx={a.x} cy={a.y} r={r + 1.5} fill={c.ring} opacity={isHover ? 1 : 0.5} />
                <circle cx={a.x} cy={a.y} r={r} fill={c.main}
                  stroke={isHover ? wc : 'none'} strokeWidth={isHover ? 0.8 : 0} />
                {a.end_x != null && a.end_y != null && (
                  <line x1={a.x} y1={a.y} x2={a.end_x} y2={a.end_y}
                    stroke={c.main} strokeWidth={0.5} opacity={isHover ? 0.9 : 0.35} strokeDasharray="1 1" />
                )}
              </g>
            )
          })}
        </svg>
        <div style={{ position: 'absolute', bottom: 6, left: 12, display: 'flex', gap: 6, pointerEvents: 'none' }}>
          {entries.map((e, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: PALETTE[i % PALETTE.length].main }} />
              <span style={{ fontSize: 7, color: 'var(--c-t5)' }}>{e.playerName.split(' ').slice(-1)[0]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT — details list (decode details on demand) */}
      <div style={{ width: 280, flexShrink: 0, borderLeft: '1px solid var(--c-bdr)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--c-bdr)', background: 'var(--c-sur1)', flexShrink: 0 }}>
          <span style={{ fontSize: 8, color: 'var(--c-t5)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Detalle · Jaspea para resaltar
          </span>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {allActions.map((a: any) => {
            const key = `${a.__pi}_${a.__ai}`
            const isHover = hoverIdx === key
            const c = PALETTE[a.__pi % PALETTE.length]
            return (
              <div key={key}
                onMouseEnter={() => setHoverIdx(key)} onMouseLeave={() => setHoverIdx(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
                  borderBottom: '1px solid var(--c-bdr)', cursor: 'pointer',
                  background: isHover ? 'var(--c-sur2)' : 'transparent',
                }}>
                {/* Peso indicador lateral */}
                <div style={{
                  width: 3, height: 22, borderRadius: 1,
                  background: WEIGHT_COLORS[Math.min(a.weight - 1, 4)],
                  opacity: isHover ? 1 : 0.7,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 9, fontWeight: 500, color: c.main }}>
                      {a.__player.split(' ').slice(-1)[0]}
                    </span>
                    <span style={{ fontSize: 8, color: 'var(--c-t3)' }}>
                      {TYPE_LABELS[a.event_type_name] ?? a.event_type_name}
                      {a.shot_outcome ? `·${a.shot_outcome}` : ''}
                      {a.counterpress ? '·counterpress' : ''}
                      {a.pass_through_ball ? '·through' : ''}
                      {a.pass_cross ? '·cross' : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, fontSize: 7, color: 'var(--c-t5)', marginTop: 1 }}>
                    <span>{a.minute}'</span>
                    <span>{a.opponent}</span>
                    <span style={{ color: 'var(--c-t4)' }}>{a.score}</span>
                    <span>{(a.competition_name ?? '').split(' ').slice(-1)[0]}</span>
                  </div>
                </div>
                {/* Peso dígito */}
                <span style={{ fontSize: 11, color: WEIGHT_COLORS[Math.min(a.weight - 1, 4)], fontWeight: 700, fontFamily: 'monospace' }}>
                  {a.weight}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}