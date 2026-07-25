"use client"

import { useMemo } from "react"
import type { TeamLineup, Player, MatchPlayer } from "@/lib/types"

interface Props {
  teams: TeamLineup[]
  homeTeamId: number
  awayTeamId: number
  selectedPlayer: Player | MatchPlayer | null
  onPlayerClick: (p: Player) => void
  width?: number
}

const PITCH_W = 120
const PITCH_H = 80

/** Canonical position coords [px 0-1, py 0-1] where px=0 = own goal */
const POSITION_COORDS: Record<string, [number, number]> = {
  "Goalkeeper":                [0.06, 0.50],
  "Right Back":                [0.18, 0.80],
  "Right Center Back":         [0.18, 0.64],
  "Center Back":               [0.18, 0.50],
  "Left Center Back":          [0.18, 0.36],
  "Left Back":                 [0.18, 0.20],
  "Right Wing Back":           [0.30, 0.86],
  "Left Wing Back":            [0.30, 0.14],
  "Right Defensive Midfield":  [0.34, 0.70],
  "Center Defensive Midfield": [0.34, 0.50],
  "Left Defensive Midfield":   [0.34, 0.30],
  "Right Midfield":            [0.44, 0.80],
  "Right Center Midfield":     [0.44, 0.65],
  "Center Midfield":           [0.44, 0.50],
  "Left Center Midfield":      [0.44, 0.35],
  "Left Midfield":             [0.44, 0.20],
  "Right Wing":                [0.47, 0.88],
  "Right Attacking Midfield":  [0.47, 0.70],
  "Center Attacking Midfield": [0.47, 0.50],
  "Left Attacking Midfield":   [0.47, 0.30],
  "Left Wing":                 [0.47, 0.12],
  "Right Center Forward":      [0.48, 0.65],
  "Center Forward":            [0.48, 0.50],
  "Left Center Forward":       [0.48, 0.35],
  "Secondary Striker":         [0.46, 0.50],
}

function getCoords(positionName: string): [number, number] {
  return POSITION_COORDS[positionName] ?? [0.3, 0.5]
}

export { POSITION_COORDS }

// ── Single pitch SVG ──────────────────────────────────────────────────────────

interface SinglePitchProps {
  team: TeamLineup
  color: string
  /** if true, mirror players horizontally (attacking right→left) */
  mirror: boolean
  selectedPlayerId?: number
  onPlayerClick: (p: Player) => void
  width: number
  height: number
  label?: string
}

function SinglePitch({ team, color, mirror, selectedPlayerId, onPlayerClick, width, height, label }: SinglePitchProps) {
  const sx = width  / PITCH_W
  const sy = height / PITCH_H

  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-600">
      {/* Team header */}
      <div
        className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-3 py-1.5"
        style={{ background: `linear-gradient(to bottom, ${color}cc, transparent)` }}
      >
        <span className="text-xs font-bold text-white drop-shadow">{team.team_name}</span>
        {team.formation && (
          <span className="text-[10px] text-white/70 font-mono">{team.formation}</span>
        )}
        {label && <span className="text-[10px] text-white/60">{label}</span>}
      </div>

      <svg width={width} height={height} style={{ display: "block", background: "#166534" }}>
        {/* Grass stripes (vertical) */}
        {Array.from({ length: 10 }, (_, i) => (
          <rect key={i} x={i * (width / 10)} y={0}
            width={width / 10} height={height}
            fill={i % 2 === 0 ? "rgba(0,0,0,0.06)" : "transparent"} />
        ))}

        <PitchHalfLines w={width} h={height} sx={sx} sy={sy} mirror={mirror} />

        {team.players.map(p => {
          const [rawPx, py] = getCoords(p.position_name)
          // Mirror: home attacks left→right (px as-is), away attacks right→left
          const px = mirror ? 1 - rawPx : rawPx
          const x  = px * PITCH_W * sx
          const y  = py * PITCH_H * sy
          const isSelected = selectedPlayerId === p.player_id

          return (
            <g key={p.player_id} transform={`translate(${x},${y})`}
              className="cursor-pointer" onClick={() => onPlayerClick(p)}>
              {isSelected && (
                <circle r={20} fill="none" stroke="#f59e0b" strokeWidth={2.5} opacity={0.85}>
                  <animate attributeName="r" from={16} to={26} dur="1s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.85" to="0" dur="1s" repeatCount="indefinite" />
                </circle>
              )}
              <circle
                r={12}
                fill={isSelected ? "#f59e0b" : color}
                stroke={isSelected ? "#fbbf24" : "rgba(255,255,255,0.8)"}
                strokeWidth={isSelected ? 2.5 : 1.5}
              />
              <text textAnchor="middle" dominantBaseline="middle"
                fontSize={8} fontWeight="bold"
                fill={isSelected ? "#000" : "white"}
                style={{ userSelect: "none", pointerEvents: "none" }}>
                {p.jersey_number}
              </text>
              <text y={19} textAnchor="middle" fontSize={6.5}
                fill="rgba(255,255,255,0.9)" fontWeight={500}
                style={{ userSelect: "none", pointerEvents: "none" }}>
                {p.player_name.split(" ").slice(-1)[0].slice(0, 11)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function PitchHalfLines({ w, h, sx, sy, mirror }: { w: number; h: number; sx: number; sy: number; mirror: boolean }) {
  const lp  = { stroke: "rgba(255,255,255,0.5)", strokeWidth: 1.2, fill: "none" }
  const lp2 = { stroke: "rgba(255,255,255,0.22)", strokeWidth: 0.8, fill: "none" }
  // Full pitch boundaries
  return (
    <g>
      <rect x={0} y={0} width={w} height={h} {...lp} />
      {/* Halfway line (right edge for home, left edge for away) */}
      <line x1={mirror ? 0 : w} y1={0} x2={mirror ? 0 : w} y2={h} {...lp} strokeDasharray="6 4" />
      {/* Penalty area */}
      {!mirror ? (
        <>
          <rect x={0} y={18 * sy} width={18 * sx} height={44 * sy} {...lp} />
          <rect x={0} y={30 * sy} width={6 * sx} height={20 * sy} {...lp2} />
          <circle cx={12 * sx} cy={40 * sy} r={2} fill="rgba(255,255,255,0.55)" />
          {/* Penalty arc */}
          <path d={`M ${18 * sx} ${(40 - 9) * sy} A ${10 * sx} ${10 * sy} 0 0 1 ${18 * sx} ${(40 + 9) * sy}`} {...lp2} />
          {/* Goal */}
          <rect x={-5} y={36 * sy} width={5} height={8 * sy}
            fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.5)" strokeWidth={1} />
          {/* Direction */}
          <text x={w - 12} y={h - 6} fontSize={8} fill="rgba(255,255,255,0.3)" textAnchor="end">→ Ataque</text>
        </>
      ) : (
        <>
          <rect x={102 * sx} y={18 * sy} width={18 * sx} height={44 * sy} {...lp} />
          <rect x={114 * sx} y={30 * sy} width={6 * sx} height={20 * sy} {...lp2} />
          <circle cx={108 * sx} cy={40 * sy} r={2} fill="rgba(255,255,255,0.55)" />
          <path d={`M ${102 * sx} ${(40 - 9) * sy} A ${10 * sx} ${10 * sy} 0 0 0 ${102 * sx} ${(40 + 9) * sy}`} {...lp2} />
          <rect x={w} y={36 * sy} width={5} height={8 * sy}
            fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.5)" strokeWidth={1} />
          <text x={12} y={h - 6} fontSize={8} fill="rgba(255,255,255,0.3)">← Ataque</text>
        </>
      )}
      {/* Centre circle (half visible) */}
      <circle cx={mirror ? 0 : w} cy={40 * sy} r={10 * sx} {...lp2} />
    </g>
  )
}

// ── Main export: two pitches stacked ─────────────────────────────────────────

export default function DualPitch({ teams, homeTeamId, awayTeamId, selectedPlayer, onPlayerClick, width = 540 }: Props) {
  const H = Math.round(width * (80 / 120))   // maintain 120:80 aspect

  const homeTeam = teams.find(t => t.team_id === homeTeamId)
  const awayTeam = teams.find(t => t.team_id === awayTeamId)

  const selectedId = selectedPlayer?.player_id

  if (teams.length === 0) return null

  return (
    <div className="space-y-2">
      {homeTeam && (
        <SinglePitch
          team={homeTeam}
          color="#1d4ed8"
          mirror={false}
          selectedPlayerId={selectedId}
          onPlayerClick={onPlayerClick}
          width={width}
          height={H}
          label="Local"
        />
      )}
      {awayTeam && (
        <SinglePitch
          team={awayTeam}
          color="#dc2626"
          mirror={true}
          selectedPlayerId={selectedId}
          onPlayerClick={onPlayerClick}
          width={width}
          height={H}
          label="Visitante"
        />
      )}
    </div>
  )
}
