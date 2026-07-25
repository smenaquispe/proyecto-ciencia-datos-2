'use client'

import type { GoalEvent } from '@/lib/types'

const W = 120, H = 80
const PLAYER_COLORS = [
  { main: 'rgba(0,214,143,0.85)', ring: 'rgba(0,214,143,0.3)' },
  { main: 'rgba(155,89,255,0.85)', ring: 'rgba(155,89,255,0.3)' },
  { main: 'rgba(245,200,66,0.85)', ring: 'rgba(245,200,66,0.3)' },
  { main: 'rgba(255,107,53,0.85)', ring: 'rgba(255,107,53,0.3)' },
]

function PitchLines() {
  return (
    <g stroke="var(--c-pln)" strokeWidth={0.4} fill="none">
      <rect x={0} y={0} width={W} height={H} stroke="var(--c-pln2)" />
      <line x1={W/2} y1={0} x2={W/2} y2={H} stroke="var(--c-pln2)" strokeWidth={0.5} />
      <circle cx={W/2} cy={H/2} r={9.15} />
      <rect x={0} y={18} width={18} height={44} />
      <rect x={0} y={30} width={6} height={20} />
      <rect x={102} y={18} width={18} height={44} />
      <rect x={114} y={30} width={6} height={20} />
      <rect x={-2} y={36} width={2} height={8} />
      <rect x={120} y={36} width={2} height={8} />
    </g>
  )
}

function GoalPost() {
  return (
    <g>
      <rect x={119} y={36} width={1.5} height={8} fill="rgba(255,255,255,0.15)" rx={0.3} />
      <line x1={120} y1={36} x2={120} y2={44} stroke="rgba(255,255,255,0.3)" strokeWidth={0.4} />
    </g>
  )
}

interface GoalsEntry {
  playerName: string
  goals: GoalEvent[]
}

export function GoalsPanel({ entries }: { entries: GoalsEntry[] }) {
  if (!entries.length || !entries.some(e => e.goals.length > 0)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <span style={{ fontSize: 10, color: 'var(--c-t5)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Sin datos de goles — selecciona jugador(es)
        </span>
      </div>
    )
  }

  const pad = 4
  const totalGoals = entries.reduce((s, e) => s + e.goals.length, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--c-bg)' }}>
      <div style={{
        display: 'flex', gap: 12, padding: '4px 12px',
        borderBottom: '1px solid var(--c-bdr)', flexShrink: 0, background: 'var(--c-sur1)',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 7, color: 'var(--c-t5)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>Total goles</span>
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#ff6b35', fontWeight: 500 }}>{totalGoals}</span>
        </div>
        {entries.map((e, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: PLAYER_COLORS[i % PLAYER_COLORS.length].main }} />
            <span style={{ fontSize: 9, color: 'var(--c-t3)' }}>
              {e.playerName.split(' ').slice(-1)[0]} ({e.goals.length})
            </span>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, padding: '4px 8px', overflow: 'hidden' }}>
        <svg viewBox={`${-pad} ${-pad} ${W + pad * 2} ${H + pad * 2}`} style={{ width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid meet">
          <rect x={-pad} y={-pad} width={W + pad * 2} height={H + pad * 2} fill="var(--c-pit)" />
          <PitchLines />
          <GoalPost />

          {entries.map((entry, pi) => {
            const color = PLAYER_COLORS[pi % PLAYER_COLORS.length]
            return entry.goals.map((g, i) => (
              <g key={`${pi}-${i}`}>
                <circle cx={g.x} cy={g.y} r={3.5} fill={color.ring} />
                <circle cx={g.x} cy={g.y} r={2} fill={color.main} />
                {g.end_x != null && g.end_y != null && (
                  <line x1={g.x} y1={g.y} x2={g.end_x} y2={g.end_y}
                    stroke={color.main} strokeWidth={0.5} opacity={0.5} strokeDasharray="1 1" />
                )}
                <text x={g.x} y={g.y - 4} textAnchor="middle" fontSize={4} fill={color.main} opacity={0.7}>
                  {g.minute}'
                </text>
              </g>
            ))
          })}
        </svg>
      </div>

      <div style={{
        padding: '3px 12px', borderTop: '1px solid var(--c-bdr)', flexShrink: 0,
        fontSize: 7, color: 'var(--c-t5)', background: 'var(--c-sur1)',
      }}>
        Puntos = ubicación del tiro · Línea punteada = dirección del balón al gol
      </div>
    </div>
  )
}
