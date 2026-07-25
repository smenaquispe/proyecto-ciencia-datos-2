"use client"

/**
 * PlayerRadarVsAvg — Radar pentagonal: jugador vs media de posición
 *
 * 5 ejes (normalizados 0-10):
 *   1. Goles/partido
 *   2. Tiros/partido
 *   3. Precisión pases
 *   4. Pases/partido
 *   5. Regates/partido
 *
 * Polígono coloreado = jugador
 * Polígono gris = media de posición
 */

import { useMemo } from "react"
import type { GlobalPlayerStat, PositionAverage } from "@/lib/types"

interface Props {
  player:      GlobalPlayerStat
  positionAvg: PositionAverage | undefined
  color:       string
}

const R   = 80
const CX  = 110
const CY  = 110
const W   = 220
const H   = 220
const RINGS = [2, 4, 6, 8, 10]
const N_AXES = 5

const AXES_DEF = [
  { label: "Goles/pdo",   maxVal: 1.0,  playerKey: "goals_pm",      avgKey: "goals_pm"      },
  { label: "Tiros/pdo",   maxVal: 8,    playerKey: "shots_pm",      avgKey: "shots_pm"      },
  { label: "Precisión%",  maxVal: 100,  playerKey: "completion_pct", avgKey: "completion_pct" },
  { label: "Pases/pdo",   maxVal: 120,  playerKey: "passes_pm",      avgKey: "passes_pm"      },
  { label: "Regates/pdo", maxVal: 10,   playerKey: "dribbles_pm",    avgKey: "dribbles_pm"    },
] as const

function polar(angle: number, r: number) {
  return { x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) }
}

const ANGLES = Array.from({ length: N_AXES }, (_, i) =>
  -Math.PI / 2 + (2 * Math.PI / N_AXES) * i
)

function polyPts(values: number[]): string {
  return values.map((v, i) => {
    const clamped = Math.max(0, Math.min(10, v))
    const p = polar(ANGLES[i], (clamped / 10) * R)
    return `${p.x},${p.y}`
  }).join(" ")
}

export default function PlayerRadarVsAvg({ player, positionAvg, color }: Props) {

  const playerVals = useMemo(() =>
    AXES_DEF.map(ax => {
      const raw = (player as unknown as Record<string, number>)[ax.playerKey] ?? 0
      return Math.min((raw / ax.maxVal) * 10, 10)
    }),
  [player])

  const avgVals = useMemo(() =>
    AXES_DEF.map(ax => {
      const raw = positionAvg ? (positionAvg as unknown as Record<string, number>)[ax.avgKey] ?? 0 : 0
      return Math.min((raw / ax.maxVal) * 10, 10)
    }),
  [positionAvg])

  const ringPts = (v: number) =>
    ANGLES.map(a => {
      const p = polar(a, (v / 10) * R)
      return `${p.x},${p.y}`
    }).join(" ")

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex flex-col items-center gap-3">
      <h3 className="text-[11px] font-bold text-white text-center">
        Radar Pentagonal vs Media de Posición
      </h3>

      <svg width={W} height={H} style={{ overflow: "visible" }}>
        {/* Rings */}
        {RINGS.map(v => (
          <polygon key={v} points={ringPts(v)}
            fill="none"
            stroke={v === 10 ? "#475569" : "#1e293b"}
            strokeWidth={v === 10 ? 1.2 : 0.7}
          />
        ))}

        {/* Spokes */}
        {ANGLES.map((a, i) => {
          const outer = polar(a, R)
          return <line key={i} x1={CX} y1={CY} x2={outer.x} y2={outer.y}
            stroke="#1e293b" strokeWidth={0.8} />
        })}

        {/* Ring labels */}
        {RINGS.map(v => {
          const p = polar(ANGLES[1], (v / 10) * R)
          return <text key={v} x={p.x + 3} y={p.y} fontSize={6} fill="#475569">{v}</text>
        })}

        {/* Average polygon */}
        <polygon points={polyPts(avgVals)}
          fill="rgba(100,116,139,0.15)"
          stroke="#64748b"
          strokeWidth={1.5}
          strokeDasharray="4 2"
        />

        {/* Player polygon */}
        <polygon points={polyPts(playerVals)}
          fill={`${color}20`}
          stroke={color}
          strokeWidth={2.5}
        />

        {/* Player dots */}
        {playerVals.map((v, i) => {
          const clamped = Math.max(0, Math.min(10, v))
          const p = polar(ANGLES[i], (clamped / 10) * R)
          return <circle key={i} cx={p.x} cy={p.y} r={4} fill={color} stroke="#fff" strokeWidth={1} />
        })}

        {/* Axis labels */}
        {AXES_DEF.map((ax, i) => {
          const labelR = R + 16
          const p = polar(ANGLES[i], labelR)
          const pv = playerVals[i]
          const av = avgVals[i]
          const better = pv >= av
          return (
            <g key={ax.label}>
              <text x={p.x} y={p.y + 3} textAnchor="middle"
                fontSize={8} fontWeight={700} fill="#94a3b8">
                {ax.label}
              </text>
              <text x={p.x} y={p.y + 12} textAnchor="middle"
                fontSize={7} fill={better ? "#22c55e" : "#f87171"}>
                {pv.toFixed(1)} {better ? "▲" : "▼"}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Legend */}
      <div className="flex gap-4 text-[10px]">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-1 rounded" style={{ background: color, display: "inline-block" }} />
          <span style={{ color }}>Jugador</span>
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="16" height="4"><line x1="0" y1="2" x2="16" y2="2" stroke="#64748b" strokeWidth="1.5" strokeDasharray="3 2"/></svg>
          <span className="text-slate-500">Media posición</span>
        </span>
      </div>

      {/* Score summary */}
      <div className="w-full grid grid-cols-5 gap-1 text-[9px] text-center">
        {AXES_DEF.map((ax, i) => {
          const pv = playerVals[i]
          const av = avgVals[i]
          const diff = pv - av
          return (
            <div key={ax.label} className="bg-slate-800 rounded-lg py-1 px-0.5">
              <div className="text-slate-500 leading-tight">{ax.label}</div>
              <div className="font-bold" style={{ color }}>{pv.toFixed(1)}</div>
              <div className={diff >= 0 ? "text-green-400" : "text-red-400"}>
                {diff >= 0 ? "+" : ""}{diff.toFixed(1)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
