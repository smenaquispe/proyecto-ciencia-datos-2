"use client"

import type { GlobalHeatmapCell } from "@/lib/types"

// Grid: x∈[0,120] → 6 cols of 20, y∈[0,80] → 5 rows of 16
const COLS = 6
const ROWS = 5
const PITCH_W = 120
const PITCH_H = 80
const CELL_W  = PITCH_W / COLS
const CELL_H  = PITCH_H / ROWS

interface Props {
  cells:      GlobalHeatmapCell[]
  color:      string
  playerName?: string
  width?:     number
  height?:    number
}

export default function GlobalHeatmap({ cells, color, playerName, width = 520, height = 320 }: Props) {
  const sx = width  / PITCH_W
  const sy = height / PITCH_H
  const maxCount = Math.max(...cells.map(c => c.count), 1)

  // Hex color to RGB
  function hexToRgb(hex: string) {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `${r},${g},${b}`
  }
  const rgb = color.startsWith("#") ? hexToRgb(color) : "59,130,246"

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
      <svg width={width} height={height} style={{ display: "block", background: "#14532d" }}>
        {/* Grass stripes */}
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x={i*(width/12)} y={0} width={width/12} height={height}
            fill={i%2===0 ? "rgba(0,0,0,0.06)" : "transparent"} />
        ))}

        {/* Heatmap cells */}
        {cells.map((c, i) => {
          const x0 = c.cx * CELL_W * sx
          const y0 = c.cy * CELL_H * sy
          const cw = CELL_W * sx
          const ch = CELL_H * sy
          const alpha = c.intensity * 0.85
          return (
            <rect key={i} x={x0} y={y0} width={cw} height={ch}
              fill={`rgba(${rgb},${alpha})`}
            >
              <title>{c.count} eventos</title>
            </rect>
          )
        })}

        {/* Pitch lines */}
        <PitchLines w={width} h={height} sx={sx} sy={sy} />

        {/* Zone labels — show count for highest cells */}
        {cells.filter(c => c.count > maxCount * 0.5).map((c, i) => (
          <text key={`lbl-${i}`}
            x={(c.cx * CELL_W + CELL_W/2) * sx}
            y={(c.cy * CELL_H + CELL_H/2) * sy + 4}
            textAnchor="middle" fontSize={9} fill="white" fontWeight={700}
            style={{ pointerEvents: "none" }}>
            {c.count.toLocaleString()}
          </text>
        ))}
      </svg>
    </div>
  )
}

function PitchLines({ w, h, sx, sy }: { w: number; h: number; sx: number; sy: number }) {
  const lp  = { stroke: "rgba(255,255,255,0.4)", strokeWidth: 1.2, fill: "none" } as const
  const lp2 = { stroke: "rgba(255,255,255,0.18)", strokeWidth: 0.8, fill: "none" } as const
  return (
    <g>
      <rect x={0} y={0} width={w} height={h} {...lp} />
      <line x1={w/2} y1={0} x2={w/2} y2={h} {...lp} />
      <circle cx={w/2} cy={h/2} r={10*sx} {...lp} />
      <rect x={0} y={18*sy} width={18*sx} height={44*sy} {...lp} />
      <rect x={102*sx} y={18*sy} width={18*sx} height={44*sy} {...lp} />
      <rect x={0} y={30*sy} width={6*sx} height={20*sy} {...lp2} />
      <rect x={114*sx} y={30*sy} width={6*sx} height={20*sy} {...lp2} />
      <rect x={-4} y={36*sy} width={4} height={8*sy}
        fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
      <rect x={w} y={36*sy} width={4} height={8*sy}
        fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
    </g>
  )
}
