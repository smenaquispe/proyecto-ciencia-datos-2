'use client'

import { useDashboard } from '@/store/store'
import type { HeatmapCell } from '@/lib/types'

const W = 120, H = 80, CELL = 5

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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: label ? '1px solid var(--c-bdr)' : undefined }}>
      {label && (
        <div style={{ padding: '2px 8px', fontSize: 8, color: `rgb(${rgb})`, letterSpacing: '0.08em', background: 'var(--c-sur1)', borderBottom: '1px solid var(--c-bdr)' }}>
          {label}
        </div>
      )}
      <div style={{ flex: 1, padding: '6px 8px', overflow: 'hidden' }}>
        <svg viewBox={`${-pad} ${-pad} ${W + pad*2} ${H + pad*2}`} style={{ width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid meet">
          <rect x={-pad} y={-pad} width={W + pad*2} height={H + pad*2} style={{ fill: 'var(--c-pit)' }} />
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

export function ActivityHeatmap() {
  const { heatmapCells, heatmapCells2, selectedPlayer, selectedPlayer2, loading, lineupData } = useDashboard()
  const isLoading = loading['player'] || loading['player2']
  const isHome1 = lineupData?.match.home_team_id === selectedPlayer?.team_id
  const isHome2 = lineupData?.match.home_team_id === selectedPlayer2?.team_id
  const rgb1 = isHome1 ? '0, 214, 143' : '255, 107, 53'
  const rgb2 = '155, 89, 255'  // always purple for P2
  const compareMode = !!selectedPlayer2 && heatmapCells2.length > 0

  const totalEvents = heatmapCells.reduce((s, c) => s + c.count, 0)
  const hotCells = heatmapCells.filter(c => c.intensity > 0.6).length
  const total2 = heatmapCells2.reduce((s, c) => s + c.count, 0)

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--c-bg)' }}>
      {/* Stats bar */}
      <div style={{
        display: 'flex', gap: 16, padding: '5px 14px',
        borderBottom: '1px solid var(--c-bdr)', flexShrink: 0, alignItems: 'center',
        background: 'var(--c-sur1)',
      }}>
        <Chip label="Eventos J1" val={totalEvents} />
        {compareMode && <Chip label="Eventos J2" val={total2} />}
        <Chip label="Celdas activas" val={heatmapCells.length} />
        <Chip label="Zonas calientes" val={hotCells} />
        {isLoading && <span style={{ fontSize: 9, color: 'var(--c-t5)', marginLeft: 'auto' }}>Calculando...</span>}
      </div>

      {/* Pitch(es) */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <SingleHeatmap cells={heatmapCells} rgb={rgb1} label={compareMode ? selectedPlayer?.player_name.split(' ').slice(-1)[0] : undefined} />
        {compareMode && (
          <SingleHeatmap cells={heatmapCells2} rgb={rgb2} label={selectedPlayer2?.player_name.split(' ').slice(-1)[0]} />
        )}
      </div>

      {/* Legend */}
      <div style={{
        padding: '5px 14px', borderTop: '1px solid var(--c-bdr)',
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
        background: 'var(--c-sur1)',
      }}>
        <span style={{ fontSize: 8, color: 'var(--c-t4)' }}>BAJA</span>
        <div style={{ flex: 1, maxWidth: 80, height: 2, borderRadius: 1, background: `linear-gradient(to right, rgba(${rgb1},0.05), rgba(${rgb1},0.85))` }} />
        {compareMode && <div style={{ width: 60, height: 2, borderRadius: 1, background: `linear-gradient(to right, rgba(${rgb2},0.05), rgba(${rgb2},0.85))` }} />}
        <span style={{ fontSize: 8, color: 'var(--c-t3)' }}>ALTA actividad</span>
      </div>
    </div>
  )
}

function Chip({ label, val }: { label: string; val: string | number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ fontSize: 8, color: 'var(--c-t5)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--c-t2)', fontWeight: 500 }}>{val}</span>
    </div>
  )
}
