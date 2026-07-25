'use client'

import type { HeatmapCell } from '@/lib/types'

const W = 120, H = 80, CELL = 5
const DEFAULT_RGB = '0, 214, 143'

function PitchLines() {
  return (
    <g style={{ stroke: 'var(--c-pln)', fill: 'none' }} strokeWidth={0.4}>
      <rect x={0} y={0} width={W} height={H} style={{ stroke: 'var(--c-pln2)' }} />
      <line x1={W/2} y1={0} x2={W/2} y2={H} style={{ stroke: 'var(--c-pln2)' }} strokeWidth={0.5} />
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

function SingleHeatmap({ cells, rgb, label }: { cells: HeatmapCell[]; rgb: string; label?: string }) {
  const maxI = Math.max(...cells.map(c => c.intensity), 0.01)
  let cx = 0, cy = 0, tw = 0
  cells.forEach(c => {
    cx += (c.x0 + CELL / 2) * c.intensity
    cy += (c.y0 + CELL / 2) * c.intensity
    tw += c.intensity
  })
  if (tw > 0) { cx /= tw; cy /= tw }
  const pad = 4

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {label && (
        <div style={{ padding: '2px 8px', fontSize: 8, color: `rgb(${rgb})`, letterSpacing: '0.08em', background: 'var(--c-sur1)', borderBottom: '1px solid var(--c-bdr)' }}>
          {label}
        </div>
      )}
      <div style={{ flex: 1, padding: '6px 8px', overflow: 'hidden' }}>
        <svg viewBox={`${-pad} ${-pad} ${W + pad * 2} ${H + pad * 2}`} style={{ width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid meet">
          <rect x={-pad} y={-pad} width={W + pad * 2} height={H + pad * 2} style={{ fill: 'var(--c-pit)' }} />
          {cells.map(c => (
            <rect key={`${c.cx}-${c.cy}`} x={c.x0} y={c.y0} width={CELL} height={CELL}
              fill={`rgba(${rgb}, ${(c.intensity / maxI) * 0.75})`} />
          ))}
          <PitchLines />
          {tw > 0 && (
            <g>
              <circle cx={cx} cy={cy} r={1.8} fill={`rgba(${rgb}, 0.95)`} />
              <circle cx={cx} cy={cy} r={4.5} fill="none" stroke={`rgba(${rgb}, 0.3)`} strokeWidth={0.5} strokeDasharray="1.5 1.5" />
            </g>
          )}
        </svg>
      </div>
    </div>
  )
}

interface HeatmapEntry {
  playerName: string
  cells: HeatmapCell[]
  totalEvents: number
}

const PLAYER_COLORS = ['0, 214, 143', '155, 89, 255', '245, 200, 66', '255, 107, 53', '77, 158, 255']

export function HeatmapPanel({ entries }: { entries: HeatmapEntry[] }) {
  if (!entries.length) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <span style={{ fontSize: 10, color: 'var(--c-t5)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Sin datos — selecciona jugador(es)
        </span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--c-bg)' }}>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {entries.map((e, i) => (
          <SingleHeatmap
            key={i}
            cells={e.cells}
            rgb={PLAYER_COLORS[i % PLAYER_COLORS.length]}
            label={entries.length > 1 ? e.playerName.split(' ').slice(-1)[0] : undefined}
          />
        ))}
      </div>
      <div style={{
        padding: '3px 12px', borderTop: '1px solid var(--c-bdr)', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 8, background: 'var(--c-sur1)',
      }}>
        <span style={{ fontSize: 8, color: 'var(--c-t4)' }}>BAJA</span>
        <div style={{ flex: 1, maxWidth: 80, height: 2, borderRadius: 1,
          background: `linear-gradient(to right, rgba(${PLAYER_COLORS[0]},0.05), rgba(${PLAYER_COLORS[0]},0.85))` }} />
        <span style={{ fontSize: 8, color: 'var(--c-t3)' }}>ALTA actividad</span>
      </div>
    </div>
  )
}
