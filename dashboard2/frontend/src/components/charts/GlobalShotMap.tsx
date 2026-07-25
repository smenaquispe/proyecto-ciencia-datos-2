"use client"

import { useState } from "react"
import type { GlobalShot } from "@/lib/types"

interface Props {
  shots:       GlobalShot[]
  color:       string
  playerName?: string
  width?:      number
  height?:     number
}

const OUTCOME_COLORS: Record<string, string> = {
  "Goal":          "#22c55e",
  "Saved":         "#f59e0b",
  "Saved To Post": "#f97316",
  "Off T":         "#ef4444",
  "Blocked":       "#94a3b8",
  "Post":          "#a78bfa",
  "Wayward":       "#64748b",
}

export default function GlobalShotMap({ shots, color, width = 520, height = 320 }: Props) {
  const [hov, setHov] = useState<{ s: GlobalShot; x: number; y: number } | null>(null)
  const [filter, setFilter] = useState<"all" | "goals" | "on_target">("all")

  const sx = width  / 120
  const sy = height / 80

  const filtered = shots.filter(s => {
    if (filter === "goals")     return s.outcome === "Goal"
    if (filter === "on_target") return ["Goal","Saved","Saved To Post"].includes(s.outcome)
    return true
  })

  const counts: Record<string, number> = {}
  for (const s of filtered) counts[s.outcome] = (counts[s.outcome] ?? 0) + 1

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700">
        <span className="text-[10px] text-slate-400">{filtered.length} tiros mostrados</span>
        <div className="flex gap-1">
          {([
            { k: "all",       l: `Todos (${shots.length})` },
            { k: "on_target", l: "En puerta" },
            { k: "goals",     l: `Goles (${shots.filter(s=>s.outcome==="Goal").length})` },
          ] as const).map(f => (
            <button key={f.k} onClick={() => setFilter(f.k)}
              className={`px-2 py-0.5 rounded text-[10px] border transition-all ${
                filter === f.k
                  ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                  : "border-slate-700 text-slate-500 hover:text-slate-300"
              }`}>
              {f.l}
            </button>
          ))}
        </div>
      </div>

      <div className="relative" onMouseLeave={() => setHov(null)}>
        <svg width={width} height={height} style={{ display: "block", background: "#14532d" }}>
          {Array.from({ length: 12 }, (_, i) => (
            <rect key={i} x={i*(width/12)} y={0} width={width/12} height={height}
              fill={i%2===0 ? "rgba(0,0,0,0.06)" : "transparent"} />
          ))}

          <PitchLines w={width} h={height} sx={sx} sy={sy} />

          {/* Shot dots — goals on top */}
          {[...filtered].sort(s => s.outcome === "Goal" ? 1 : -1).map((s, i) => {
            const cx = s.x * sx
            const cy = s.y * sy
            const isGoal = s.outcome === "Goal"
            const dotColor = OUTCOME_COLORS[s.outcome] ?? "#94a3b8"
            return (
              <g key={i}
                onMouseEnter={e => setHov({ s, x: e.clientX, y: e.clientY })}
                style={{ cursor: "pointer" }}>
                {isGoal && (
                  <circle cx={cx} cy={cy} r={10}
                    fill="rgba(34,197,94,0.15)" stroke="#22c55e" strokeWidth={1} />
                )}
                <circle cx={cx} cy={cy} r={isGoal ? 5 : 3.5}
                  fill={dotColor}
                  fillOpacity={isGoal ? 1 : 0.7}
                  stroke={isGoal ? "#fff" : "none"}
                  strokeWidth={1}
                />
              </g>
            )
          })}
        </svg>

        {hov && (
          <div className="fixed z-50 bg-slate-900/95 border border-slate-600 rounded-xl p-2.5 text-xs shadow-xl pointer-events-none"
            style={{ left: hov.x + 12, top: hov.y - 10 }}>
            <div className="font-bold" style={{ color: OUTCOME_COLORS[hov.s.outcome] ?? "#fff" }}>
              {hov.s.outcome}
            </div>
            <div className="text-slate-400 text-[10px]">
              Distancia: {hov.s.dist_to_goal.toFixed(1)} yd · Min {hov.s.minute}′
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 px-3 py-2 border-t border-slate-800">
        {Object.entries(counts).map(([outcome, cnt]) => (
          <span key={outcome} className="flex items-center gap-1 text-[9px]">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: OUTCOME_COLORS[outcome] ?? "#94a3b8", display: "inline-block" }} />
            <span className="text-slate-400">{outcome}</span>
            <span className="font-bold text-slate-300">{cnt}</span>
          </span>
        ))}
      </div>
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
