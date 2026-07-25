'use client'

import type { AssistEvent } from '@/lib/types'

const W = 120, H = 80
const PLAYER_COLORS = [
  { main: 'rgba(0,214,143,0.85)', ring: 'rgba(0,214,143,0.3)', line: 'rgba(0,214,143,0.5)' },
  { main: 'rgba(155,89,255,0.85)', ring: 'rgba(155,89,255,0.3)', line: 'rgba(155,89,255,0.5)' },
  { main: 'rgba(245,200,66,0.85)', ring: 'rgba(245,200,66,0.3)', line: 'rgba(245,200,66,0.5)' },
  { main: 'rgba(255,107,53,0.85)', ring: 'rgba(255,107,53,0.3)', line: 'rgba(255,107,53,0.5)' },
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

interface AssistsEntry {
  playerName: string
  assists: AssistEvent[]
}

export function AssistsPanel({ entries }: { entries: AssistsEntry[] }) {
  if (!entries.length || !entries.some(e => e.assists.length > 0)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <span style={{ fontSize: 10, color: 'var(--c-t5)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Sin datos de asistencias — selecciona jugador(es)
        </span>
      </div>
    )
  }

  const pad = 4
  const totalAssists = entries.reduce((s, e) => s + e.assists.length, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--c-bg)' }}>
      <div style={{
        display: 'flex', gap: 12, padding: '4px 12px',
        borderBottom: '1px solid var(--c-bdr)', flexShrink: 0, background: 'var(--c-sur1)',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 7, color: 'var(--c-t5)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>Total asist.</span>
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#4d9eff', fontWeight: 500 }}>{totalAssists}</span>
        </div>
        {entries.map((e, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: PLAYER_COLORS[i % PLAYER_COLORS.length].main }} />
            <span style={{ fontSize: 9, color: 'var(--c-t3)' }}>
              {e.playerName.split(' ').slice(-1)[0]} ({e.assists.length})
            </span>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, padding: '4px 8px', overflow: 'hidden' }}>
        <svg viewBox={`${-pad} ${-pad} ${W + pad * 2} ${H + pad * 2}`} style={{ width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid meet">
          <defs>
            <marker id="assistArrow" markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto">
              <path d="M0,0 L4,2 L0,4" fill="rgba(255,255,255,0.3)" />
            </marker>
          </defs>
          <rect x={-pad} y={-pad} width={W + pad * 2} height={H + pad * 2} fill="var(--c-pit)" />
          <PitchLines />

          {entries.map((entry, pi) => {
            const color = PLAYER_COLORS[pi % PLAYER_COLORS.length]
            return entry.assists.map((a, i) => (
              <g key={`${pi}-${i}`}>
                <line x1={a.x} y1={a.y} x2={a.shot_x} y2={a.shot_y}
                  stroke={color.line} strokeWidth={0.8} markerEnd="url(#assistArrow)" />
                <circle cx={a.x} cy={a.y} r={2.5} fill={color.ring} />
                <circle cx={a.x} cy={a.y} r={1.5} fill={color.main} />
                <circle cx={a.shot_x} cy={a.shot_y} r={1.2} fill="rgba(255,107,53,0.7)" />
                <text x={a.x} y={a.y - 3.5} textAnchor="middle" fontSize={4} fill={color.main} opacity={0.7}>
                  {a.minute}'
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
        Punto = origen del pase · Flecha = dirección al remate · Naranja = ubicación del gol
      </div>
    </div>
  )
}
