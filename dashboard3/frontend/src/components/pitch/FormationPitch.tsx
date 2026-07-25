'use client'

import { useState, useCallback } from 'react'
import { useDashboard } from '@/store/store'

const W = 120, H = 80

const HOME_X = (px: number) => 5 + px * 49
const AWAY_X = (px: number) => 115 - px * 49

function PitchMarkings() {
  return (
    <g style={{ stroke: 'var(--c-pln)', fill: 'none' }} strokeWidth={0.5}>
      <rect x={0} y={0} width={W} height={H} style={{ stroke: 'var(--c-pln2)' }} />
      <line x1={W/2} y1={0} x2={W/2} y2={H} style={{ stroke: 'var(--c-pln2)' }} strokeWidth={0.6} />
      <circle cx={W/2} cy={H/2} r={9.15} />
      <circle cx={W/2} cy={H/2} r={0.5} style={{ fill: 'var(--c-pln)', stroke: 'none' }} />
      <rect x={0} y={18} width={18} height={44} />
      <rect x={0} y={30} width={6} height={20} />
      <circle cx={12} cy={H/2} r={0.5} style={{ fill: 'var(--c-pln)', stroke: 'none' }} />
      <rect x={102} y={18} width={18} height={44} />
      <rect x={114} y={30} width={6} height={20} />
      <circle cx={108} cy={H/2} r={0.5} style={{ fill: 'var(--c-pln)', stroke: 'none' }} />
      <rect x={-2} y={36} width={2} height={8} />
      <rect x={120} y={36} width={2} height={8} />
    </g>
  )
}

interface DotProps {
  x: number; y: number; jersey: number; name: string; color: string
  isSelected: boolean; isHovered: boolean; onClick: () => void
}

function PlayerDot({ x, y, jersey, name, color, isSelected, isHovered, onClick }: DotProps) {
  const r = 3.2
  const show = isSelected || isHovered
  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      {isSelected && <circle cx={x} cy={y} r={r + 2} fill="none" stroke={color} strokeWidth={0.7} opacity={0.5} />}
      {isHovered && !isSelected && <circle cx={x} cy={y} r={r + 1.2} fill="none" stroke={color} strokeWidth={0.5} opacity={0.3} />}
      <circle cx={x} cy={y} r={r}
        style={{ fill: isSelected ? color : `${color}22` }}
        stroke={color} strokeWidth={isSelected ? 0 : 0.7} />
      <text x={x} y={y + 1} textAnchor="middle" fontSize={2.1}
        fontFamily="'SF Mono', monospace" fontWeight="600"
        style={{ fill: isSelected ? 'var(--c-bg)' : color }}>
        {jersey}
      </text>
      {show && (
        <g>
          <rect x={x - 13} y={y + r + 1} width={26} height={4.5} rx={0.6}
            style={{ fill: 'var(--c-sur1)', stroke: 'var(--c-bdr)' }} strokeWidth={0.3} />
          <text x={x} y={y + r + 4} textAnchor="middle" fontSize={1.9}
            fontFamily="system-ui" fontWeight="400"
            style={{ fill: 'var(--c-t2)' }}>
            {name.split(' ').slice(-1)[0]}
          </text>
        </g>
      )}
    </g>
  )
}

export function FormationPitch() {
  const { lineupData, selectedPlayer, selectedMatch, setPlayer, hoveredPlayerId } = useDashboard()
  const [localHover, setLocalHover] = useState<number | null>(null)

  const handleClick = useCallback((player_id: number, player_name: string, team_id: number, team_name: string, position_name: string, jersey_number: number) => {
    setPlayer(selectedPlayer?.player_id === player_id ? null : { player_id, player_name, team_id, team_name, position_name, jersey_number })
  }, [selectedPlayer, setPlayer])

  const homeTeamId = lineupData?.match.home_team_id
  const awayTeamId = lineupData?.match.away_team_id
  const homeTeam = lineupData?.teams.find(t => t.team_id === homeTeamId)
  const awayTeam  = lineupData?.teams.find(t => t.team_id === awayTeamId)

  const pad = 5
  const viewBox = `${-pad} ${-pad} ${W + pad * 2} ${H + pad * 2}`

  if (!selectedMatch) {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--c-t5)', letterSpacing: '0.08em' }}>Selecciona un partido</span>
      </div>
    )
  }

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--c-bg)' }}>
      {/* Legend */}
      {lineupData && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', padding: '6px 14px',
          borderBottom: '1px solid var(--c-bdr)', flexShrink: 0, alignItems: 'center',
          background: 'var(--c-sur1)',
        }}>
          <TeamBadge name={homeTeam?.team_name ?? ''} formation={homeTeam?.formation} color="var(--c-acc)" />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 300, color: 'var(--c-t1)' }}>
              {lineupData.match.home_score}
            </span>
            <span style={{ fontSize: 10, color: 'var(--c-t5)' }}>—</span>
            <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 300, color: 'var(--c-t1)' }}>
              {lineupData.match.away_score}
            </span>
          </div>
          <TeamBadge name={awayTeam?.team_name ?? ''} formation={awayTeam?.formation} color="var(--c-org)" side="right" />
        </div>
      )}

      {/* SVG Pitch */}
      <div style={{ flex: 1, padding: '6px 10px', overflow: 'hidden' }}>
        <svg viewBox={viewBox} style={{ width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid meet">
          {/* Pitch background */}
          <rect x={-pad} y={-pad} width={W + pad * 2} height={H + pad * 2}
            style={{ fill: 'var(--c-pit)' }} />
          {/* Alternating stripes */}
          {Array.from({ length: 12 }).map((_, i) => (
            <rect key={i} x={i * 10} y={0} width={10} height={H}
              style={{ fill: i % 2 === 0 ? 'var(--c-pit)' : 'var(--c-pit2)' }} />
          ))}

          <PitchMarkings />

          {/* Half labels */}
          <text x={W * 0.25} y={-1} textAnchor="middle" fontSize={2.5}
            style={{ fill: 'var(--c-pln2)' }} letterSpacing="0.1em">LOCAL</text>
          <text x={W * 0.75} y={-1} textAnchor="middle" fontSize={2.5}
            style={{ fill: 'var(--c-pln2)' }} letterSpacing="0.1em">VISITANTE</text>

          {/* HOME TEAM */}
          {homeTeam?.players.map(p => (
            <PlayerDot key={p.player_id}
              x={HOME_X(p.px)} y={p.py * H}
              jersey={p.jersey_number} name={p.player_name}
              color="#00d68f"
              isSelected={selectedPlayer?.player_id === p.player_id}
              isHovered={localHover === p.player_id || hoveredPlayerId === p.player_id}
              onClick={() => handleClick(p.player_id, p.player_name, homeTeamId!, homeTeam!.team_name, p.position_name, p.jersey_number)}
            />
          ))}

          {/* AWAY TEAM */}
          {awayTeam?.players.map(p => (
            <PlayerDot key={p.player_id}
              x={AWAY_X(p.px)} y={p.py * H}
              jersey={p.jersey_number} name={p.player_name}
              color="#ff6b35"
              isSelected={selectedPlayer?.player_id === p.player_id}
              isHovered={localHover === p.player_id || hoveredPlayerId === p.player_id}
              onClick={() => handleClick(p.player_id, p.player_name, awayTeamId!, awayTeam!.team_name, p.position_name, p.jersey_number)}
            />
          ))}
        </svg>
      </div>

      {/* Bottom hint */}
      {lineupData && (
        <div style={{ padding: '4px 14px', borderTop: '1px solid var(--c-bdr)', flexShrink: 0, background: 'var(--c-sur1)' }}>
          <span style={{ fontSize: 9, color: 'var(--c-t5)', letterSpacing: '0.06em' }}>
            {selectedPlayer
              ? `${selectedPlayer.player_name} — ${selectedPlayer.position_name}`
              : 'Haz clic sobre un jugador para activar todos los análisis'}
          </span>
        </div>
      )}
    </div>
  )
}

function TeamBadge({ name, formation, color, side = 'left' }: {
  name: string; formation?: number | null; color: string; side?: 'left' | 'right'
}) {
  const fmt = formation ? String(formation).split('').join('-') : null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexDirection: side === 'right' ? 'row-reverse' : 'row' }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, opacity: 0.8 }} />
      <div style={{ textAlign: side === 'right' ? 'right' : 'left' }}>
        <div style={{ fontSize: 11, color: 'var(--c-t1)', fontWeight: 400 }}>{name}</div>
        {fmt && <div style={{ fontSize: 9, color, opacity: 0.5, fontFamily: 'monospace' }}>{fmt}</div>}
      </div>
    </div>
  )
}
