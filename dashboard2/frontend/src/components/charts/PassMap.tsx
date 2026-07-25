"use client"

import { useMemo } from "react"
import type { Pass } from "@/lib/types"

interface Props {
  passes: Pass[]        // ONLY passes for currentMinute of the selected player
  width?: number
  height?: number
  playerName?: string
  currentMinute?: number
}

const PASS_COLORS: Record<string, string> = {
  forward_vertical:  "#22c55e",
  diagonal_forward:  "#86efac",
  lateral:           "#60a5fa",
  lateral_short:     "#93c5fd",
  short:             "#e2e8f0",
  diagonal_back:     "#fbbf24",
  back_vertical:     "#f87171",
}

const PASS_LABELS: Record<string, string> = {
  forward_vertical:  "Vertical adelante",
  diagonal_forward:  "Diagonal adelante",
  lateral:           "Lateral",
  lateral_short:     "Lateral corto",
  short:             "Corto",
  diagonal_back:     "Diagonal atrás",
  back_vertical:     "Vertical atrás",
}

const PITCH_W = 120
const PITCH_H = 80

export default function PassMap({ passes, width = 700, height = 320, playerName, currentMinute }: Props) {
  const scaleX = width  / PITCH_W
  const scaleY = height / PITCH_H

  const typeCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const p of passes) c[p.pass_type] = (c[p.pass_type] ?? 0) + 1
    return c
  }, [passes])

  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-600">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: "block", background: "#166534" }}
      >
        {/* Grass stripes */}
        {Array.from({ length: 10 }, (_, i) => (
          <rect key={i} x={i * (width / 10)} y={0}
            width={width / 10} height={height}
            fill={i % 2 === 0 ? "rgba(0,0,0,0.07)" : "transparent"} />
        ))}

        <PitchLines w={width} h={height} sx={scaleX} sy={scaleY} />

        {/* Arrowhead markers */}
        <defs>
          {Object.entries(PASS_COLORS).map(([type, color]) => (
            <marker key={type} id={`arr-${type}`}
              markerWidth={7} markerHeight={7} refX={6} refY={3.5} orient="auto">
              <polygon points="0 0, 7 3.5, 0 7" fill={color} opacity={0.95} />
            </marker>
          ))}
        </defs>

        {/* Pass arrows — only current player, current minute */}
        {passes.map((p, i) => {
          const x1 = p.x    * scaleX
          const y1 = p.y    * scaleY
          const x2 = p.end_x * scaleX
          const y2 = p.end_y * scaleY
          const color = PASS_COLORS[p.pass_type] ?? "#94a3b8"
          const dist  = Math.hypot(x2 - x1, y2 - y1)
          // Shorten line so arrowhead doesn't overlap end circle
          const ratio = dist > 1 ? (dist - 8) / dist : 1
          const ex = x1 + (x2 - x1) * ratio
          const ey = y1 + (y2 - y1) * ratio

          return (
            <g key={p.event_id ?? i}>
              {/* Glow */}
              <line x1={x1} y1={y1} x2={ex} y2={ey}
                stroke={color} strokeWidth={7} strokeOpacity={0.18} strokeLinecap="round" />
              {/* Main line */}
              <line x1={x1} y1={y1} x2={ex} y2={ey}
                stroke={color} strokeWidth={2.8} strokeOpacity={0.95}
                strokeLinecap="round"
                markerEnd={`url(#arr-${p.pass_type})`} />
              {/* Origin dot */}
              <circle cx={x1} cy={y1} r={5} fill={color} stroke="#000" strokeWidth={1} opacity={0.95} />
              {/* Destination dot */}
              <circle cx={x2} cy={y2} r={3} fill="white" opacity={0.6} />
              {/* Under-pressure indicator */}
              {p.under_pressure && (
                <circle cx={x1} cy={y1} r={9} fill="none"
                  stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="3 2" opacity={0.8} />
              )}
            </g>
          )
        })}
      </svg>

      {/* Header overlay */}
      <div className="absolute top-2 left-2 flex flex-col gap-1 pointer-events-none">
        {playerName && (
          <div className="bg-black/70 rounded-lg px-2 py-1 text-xs text-amber-400 font-semibold">
            {playerName}
          </div>
        )}
        <div className="bg-black/70 rounded-lg px-2 py-1 text-xs font-mono text-white">
          {currentMinute !== undefined && <span>Minuto <span className="text-amber-400 font-bold">{currentMinute}′</span></span>}
          {" · "}
          <span className="text-green-400 font-bold">{passes.length}</span>
          <span className="text-slate-400"> pases</span>
        </div>
      </div>

      {/* Type legend */}
      {Object.keys(typeCounts).length > 0 && (
        <div className="absolute top-2 right-2 bg-black/75 rounded-lg p-2 space-y-0.5 pointer-events-none">
          {Object.entries(typeCounts).map(([type, cnt]) => (
            <div key={type} className="flex items-center gap-1.5 text-[10px]">
              <span className="w-3 h-1.5 rounded-full flex-shrink-0"
                style={{ background: PASS_COLORS[type] ?? "#94a3b8" }} />
              <span className="text-slate-300">{PASS_LABELS[type] ?? type}</span>
              <span className="text-slate-500 ml-auto pl-2">{cnt}</span>
            </div>
          ))}
          {passes.some(p => p.under_pressure) && (
            <div className="flex items-center gap-1.5 text-[10px] border-t border-white/10 pt-0.5 mt-0.5">
              <span className="w-3 h-3 rounded-full border border-amber-400 border-dashed flex-shrink-0" />
              <span className="text-amber-400">Bajo presión</span>
            </div>
          )}
        </div>
      )}

      {!playerName && (
        <div className="absolute inset-0 flex items-center justify-center text-white/40 text-sm">
          Selecciona un jugador para ver sus pases
        </div>
      )}
      {playerName && passes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-white/40 text-sm">
          Sin pases en el minuto {currentMinute}′
        </div>
      )}
    </div>
  )
}

function PitchLines({ w, h, sx, sy }: { w: number; h: number; sx: number; sy: number }) {
  const lp  = { stroke: "rgba(255,255,255,0.5)", strokeWidth: 1.2, fill: "none" }
  const lp2 = { stroke: "rgba(255,255,255,0.25)", strokeWidth: 0.8, fill: "none" }
  return (
    <g>
      <rect x={0} y={0} width={w} height={h} {...lp} />
      <line x1={w / 2} y1={0} x2={w / 2} y2={h} {...lp} />
      <circle cx={w / 2} cy={h / 2} r={10 * sx} {...lp} />
      <rect x={0} y={18 * sy} width={18 * sx} height={44 * sy} {...lp} />
      <rect x={102 * sx} y={18 * sy} width={18 * sx} height={44 * sy} {...lp} />
      <rect x={0} y={30 * sy} width={6 * sx} height={20 * sy} {...lp2} />
      <rect x={114 * sx} y={30 * sy} width={6 * sx} height={20 * sy} {...lp2} />
      <circle cx={12 * sx} cy={40 * sy} r={2} fill="rgba(255,255,255,0.55)" />
      <circle cx={108 * sx} cy={40 * sy} r={2} fill="rgba(255,255,255,0.55)" />
      <circle cx={w / 2} cy={h / 2} r={2} fill="rgba(255,255,255,0.55)" />
      <rect x={-4} y={36 * sy} width={4} height={8 * sy}
        fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.4)" strokeWidth={1} />
      <rect x={w} y={36 * sy} width={4} height={8 * sy}
        fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.4)" strokeWidth={1} />
    </g>
  )
}
