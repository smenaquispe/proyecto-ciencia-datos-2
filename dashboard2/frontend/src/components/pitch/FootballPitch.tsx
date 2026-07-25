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
  height?: number
}

const PITCH_W = 120
const PITCH_H = 80

/**
 * Position coordinates (px, py) normalized [0,1].
 * px=0 = own goal line, px=1 = opponent goal.
 * For HOME: px 0..0.5 (left half).
 * For AWAY: we mirror → px_away = 1 - px_home, placed on right half 0.5..1.
 */
const POSITION_COORDS: Record<string, [number, number]> = {
  "Goalkeeper":                [0.06, 0.50],
  "Right Back":                [0.18, 0.82],
  "Right Center Back":         [0.18, 0.65],
  "Center Back":               [0.18, 0.50],
  "Left Center Back":          [0.18, 0.35],
  "Left Back":                 [0.18, 0.18],
  "Right Wing Back":           [0.30, 0.88],
  "Left Wing Back":            [0.30, 0.12],
  "Right Defensive Midfield":  [0.33, 0.70],
  "Center Defensive Midfield": [0.33, 0.50],
  "Left Defensive Midfield":   [0.33, 0.30],
  "Right Midfield":            [0.42, 0.82],
  "Right Center Midfield":     [0.42, 0.67],
  "Center Midfield":           [0.42, 0.50],
  "Left Center Midfield":      [0.42, 0.33],
  "Left Midfield":             [0.42, 0.18],
  "Right Wing":                [0.46, 0.88],
  "Right Attacking Midfield":  [0.46, 0.70],
  "Center Attacking Midfield": [0.46, 0.50],
  "Left Attacking Midfield":   [0.46, 0.30],
  "Left Wing":                 [0.46, 0.12],
  "Right Center Forward":      [0.48, 0.65],
  "Center Forward":            [0.48, 0.50],
  "Left Center Forward":       [0.48, 0.35],
  "Secondary Striker":         [0.45, 0.50],
}

export { POSITION_COORDS }

export default function FootballPitch({
  teams,
  homeTeamId,
  awayTeamId,
  selectedPlayer,
  onPlayerClick,
  width = 700,
  height = 420,
}: Props) {
  const scaleX = width  / PITCH_W
  const scaleY = height / PITCH_H

  const homeTeam = teams.find(t => t.team_id === homeTeamId)
  const awayTeam = teams.find(t => t.team_id === awayTeamId)

  // Away players: mirror px → (1 - px), so they occupy right half
  const awayMirrored = useMemo(
    () => (awayTeam?.players ?? []).map(p => ({ ...p, px: 1 - p.px })),
    [awayTeam]
  )

  const renderPlayer = (p: Player, teamColor: string, isAway = false) => {
    const x = p.px * PITCH_W * scaleX
    const y = p.py * PITCH_H * scaleY
    const isSelected = selectedPlayer?.player_id === p.player_id

    // Short name: last word, max 10 chars
    const shortName = p.player_name.split(" ").slice(-1)[0].slice(0, 10)

    return (
      <g
        key={p.player_id}
        transform={`translate(${x},${y})`}
        className="cursor-pointer"
        onClick={() => onPlayerClick(p)}
      >
        {/* Selection pulse ring */}
        {isSelected && (
          <>
            <circle r={20} fill="none" stroke="#f59e0b" strokeWidth={2.5} opacity={0.9}>
              <animate attributeName="r" from={16} to={24} dur="1s" repeatCount="indefinite" />
              <animate attributeName="opacity" from="0.9" to="0" dur="1s" repeatCount="indefinite" />
            </circle>
            <circle r={16} fill={teamColor} fillOpacity={0.25} stroke="#f59e0b" strokeWidth={2} />
          </>
        )}

        {/* Jersey circle */}
        <circle
          r={13}
          fill={isSelected ? "#f59e0b" : teamColor}
          stroke="white"
          strokeWidth={isSelected ? 0 : 1.5}
          className="transition-all duration-150"
        />

        {/* Jersey number */}
        <text
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={9}
          fontWeight="bold"
          fill={isSelected ? "#000" : "white"}
          style={{ userSelect: "none", pointerEvents: "none" }}
        >
          {p.jersey_number}
        </text>

        {/* Player name below */}
        <text
          y={20}
          textAnchor="middle"
          fontSize={7}
          fill="rgba(255,255,255,0.9)"
          fontWeight="500"
          style={{ userSelect: "none", pointerEvents: "none" }}
        >
          {shortName}
        </text>
      </g>
    )
  }

  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-600">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: "block", background: "#166534" }}
      >
        <PitchMarkings w={width} h={height} sx={scaleX} sy={scaleY} />

        {/* HOME team: left half, blue */}
        {(homeTeam?.players ?? []).map(p => renderPlayer(p, "#1d4ed8"))}

        {/* AWAY team: right half (mirrored), red */}
        {awayMirrored.map(p => renderPlayer(p, "#dc2626", true))}

        {/* Formation label */}
        {homeTeam?.formation && (
          <text x={16} y={14} fontSize={9} fill="rgba(255,255,255,0.5)" fontWeight="600">
            {homeTeam.team_name.split(" ")[0]} {homeTeam.formation}
          </text>
        )}
        {awayTeam?.formation && (
          <text x={width - 16} y={14} fontSize={9} fill="rgba(255,255,255,0.5)" fontWeight="600" textAnchor="end">
            {awayTeam.team_name.split(" ")[0]} {awayTeam.formation}
          </text>
        )}
      </svg>

      {/* Team legend */}
      <div className="absolute bottom-2 left-0 right-0 flex justify-around px-4">
        <span className="flex items-center gap-1.5 text-xs">
          <span className="w-3 h-3 rounded-full bg-blue-600 inline-block border border-white/30" />
          <span className="text-white/80 font-medium">{homeTeam?.team_name ?? "Local"}</span>
        </span>
        <span className="text-slate-500 text-xs">← vs →</span>
        <span className="flex items-center gap-1.5 text-xs">
          <span className="text-white/80 font-medium">{awayTeam?.team_name ?? "Visitante"}</span>
          <span className="w-3 h-3 rounded-full bg-red-600 inline-block border border-white/30" />
        </span>
      </div>
    </div>
  )
}

function PitchMarkings({ w, h, sx, sy }: { w: number; h: number; sx: number; sy: number }) {
  const lp = { stroke: "rgba(255,255,255,0.55)", strokeWidth: 1.5, fill: "none" }
  const lp2 = { stroke: "rgba(255,255,255,0.25)", strokeWidth: 0.8, fill: "none" }

  return (
    <g>
      {/* Grass alternating stripes */}
      {Array.from({ length: 10 }, (_, i) => (
        <rect
          key={i}
          x={i * (w / 10)} y={0}
          width={w / 10} height={h}
          fill={i % 2 === 0 ? "rgba(0,0,0,0.06)" : "transparent"}
        />
      ))}

      {/* Boundary */}
      <rect x={0} y={0} width={w} height={h} {...lp} />

      {/* Halfway line */}
      <line x1={w / 2} y1={0} x2={w / 2} y2={h} {...lp} />

      {/* Centre circle */}
      <circle cx={w / 2} cy={h / 2} r={10 * sx} {...lp} />
      <circle cx={w / 2} cy={h / 2} r={2} fill="rgba(255,255,255,0.6)" />

      {/* LEFT penalty area (home) x:0-18, y:18-62 */}
      <rect x={0} y={18 * sy} width={18 * sx} height={44 * sy} {...lp} />
      {/* Left 6-yard box */}
      <rect x={0} y={30 * sy} width={6 * sx} height={20 * sy} {...lp2} />
      {/* Left penalty spot */}
      <circle cx={12 * sx} cy={40 * sy} r={2} fill="rgba(255,255,255,0.55)" />
      {/* Left penalty arc */}
      <path
        d={`M ${(18) * sx} ${(40 - 8) * sy} A ${10 * sx} ${10 * sy} 0 0 1 ${18 * sx} ${(40 + 8) * sy}`}
        {...lp2}
      />

      {/* RIGHT penalty area (away) x:102-120, y:18-62 */}
      <rect x={102 * sx} y={18 * sy} width={18 * sx} height={44 * sy} {...lp} />
      <rect x={114 * sx} y={30 * sy} width={6 * sx} height={20 * sy} {...lp2} />
      <circle cx={108 * sx} cy={40 * sy} r={2} fill="rgba(255,255,255,0.55)" />
      <path
        d={`M ${102 * sx} ${(40 - 8) * sy} A ${10 * sx} ${10 * sy} 0 0 0 ${102 * sx} ${(40 + 8) * sy}`}
        {...lp2}
      />

      {/* Goals */}
      <rect x={-5} y={36 * sy} width={5} height={8 * sy}
        fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth={1} />
      <rect x={w} y={36 * sy} width={5} height={8 * sy}
        fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth={1} />

      {/* Corner arcs */}
      {([[0, 0, 1, 1], [120, 0, -1, 1], [0, 80, 1, -1], [120, 80, -1, -1]] as [number, number, number, number][])
        .map(([cx, cy, dx, dy], i) => (
          <path
            key={i}
            d={`M ${(cx + dx * 2) * sx} ${cy * sy} A ${2 * sx} ${2 * sy} 0 0 ${dx > 0 ? 1 : 0} ${cx * sx} ${(cy + dy * 2) * sy}`}
            {...lp2}
          />
        ))}

      {/* Direction labels */}
      <text x={w / 4} y={h - 5} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.3)">
        → Ataque local
      </text>
      <text x={3 * w / 4} y={h - 5} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.3)">
        ← Ataque visitante
      </text>
    </g>
  )
}
