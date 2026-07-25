'use client'

import type { PressureEvent } from '@/lib/types'

const W = 120, H = 80
const PLAYER_COLORS = [
  { main: 'rgba(0,214,143,0.7)', ring: 'rgba(0,214,143,0.2)' },
  { main: 'rgba(155,89,255,0.7)', ring: 'rgba(155,89,255,0.2)' },
  { main: 'rgba(245,200,66,0.7)', ring: 'rgba(245,200,66,0.2)' },
  { main: 'rgba(255,107,53,0.7)', ring: 'rgba(255,107,53,0.2)' },
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

interface PressureEntry {
  playerName: string
  pressures: PressureEvent[]
}

export function DefensivePressurePanel({ entries }: { entries: PressureEntry[] }) {
  if (!entries.length || !entries.some(e => e.pressures.length > 0)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <span style={{ fontSize: 10, color: 'var(--c-t5)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Sin datos de presión — selecciona jugador(es)
        </span>
      </div>
    )
  }

  const pad = 4
  const totalPressures = entries.reduce((s, e) => s + e.pressures.length, 0)
  const totalCounterpress = entries.reduce((s, e) => s + e.pressures.filter(p => p.counterpress).length, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--c-bg)' }}>
      <div style={{
        display: 'flex', gap: 12, padding: '4px 12px',
        borderBottom: '1px solid var(--c-bdr)', flexShrink: 0, background: 'var(--c-sur1)',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 7, color: 'var(--c-t5)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>Presiones</span>
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#f5c842', fontWeight: 500 }}>{totalPressures}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 7, color: 'var(--c-t5)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>Counterpress</span>
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#ff4757', fontWeight: 500 }}>{totalCounterpress}</span>
        </div>
        {entries.map((e, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: PLAYER_COLORS[i % PLAYER_COLORS.length].main }} />
            <span style={{ fontSize: 9, color: 'var(--c-t3)' }}>
              {e.playerName.split(' ').slice(-1)[0]} ({e.pressures.length})
            </span>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, padding: '4px 8px', overflow: 'hidden' }}>
        <svg viewBox={`${-pad} ${-pad} ${W + pad * 2} ${H + pad * 2}`} style={{ width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid meet">
          <rect x={-pad} y={-pad} width={W + pad * 2} height={H + pad * 2} fill="var(--c-pit)" />
          <PitchLines />

          {entries.map((entry, pi) => {
            const color = PLAYER_COLORS[pi % PLAYER_COLORS.length]
            return entry.pressures.map((p, i) => (
              <g key={`${pi}-${i}`}>
                <circle cx={p.x} cy={p.y} r={p.counterpress ? 3 : 2}
                  fill={p.counterpress ? 'rgba(255,71,87,0.4)' : color.ring} />
                <circle cx={p.x} cy={p.y} r={p.counterpress ? 1.8 : 1.2}
                  fill={p.counterpress ? 'rgba(255,71,87,0.9)' : color.main} />
              </g>
            ))
          })}
        </svg>
      </div>

      <div style={{
        padding: '3px 12px', borderTop: '1px solid var(--c-bdr)', flexShrink: 0,
        display: 'flex', gap: 10, fontSize: 7, color: 'var(--c-t5)', background: 'var(--c-sur1)',
      }}>
        <span>Puntos pequeños = presión · Puntos rojos grandes = counterpress</span>
      </div>
    </div>
  )
}
