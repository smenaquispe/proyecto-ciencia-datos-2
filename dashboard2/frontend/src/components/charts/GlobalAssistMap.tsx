"use client"

import { useState } from "react"

interface AssistPass {
  x: number; y: number; end_x: number; end_y: number
  player_name?: string; minute?: number; match_id?: number
}

interface Props {
  passes:      Record<string, unknown>[]
  color:       string
  playerName?: string
  width?:      number
  height?:     number
}

export default function GlobalAssistMap({ passes, color, width = 520, height = 320 }: Props) {
  const [hov, setHov] = useState<{ p: AssistPass; x: number; y: number } | null>(null)
  const sx = width  / 120
  const sy = height / 80

  const typedPasses = passes as unknown as AssistPass[]

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
      <div className="relative" onMouseLeave={() => setHov(null)}>
        <svg width={width} height={height} style={{ display: "block", background: "#14532d" }}>
          {Array.from({ length: 12 }, (_, i) => (
            <rect key={i} x={i*(width/12)} y={0} width={width/12} height={height}
              fill={i%2===0 ? "rgba(0,0,0,0.06)" : "transparent"} />
          ))}
          <PitchLines w={width} h={height} sx={sx} sy={sy} />

          <defs>
            <marker id="ga-arr" markerWidth={7} markerHeight={7} refX={6} refY={3.5} orient="auto">
              <polygon points="0 0,7 3.5,0 7" fill={color} opacity={0.9} />
            </marker>
          </defs>

          {typedPasses.map((p, i) => {
            if (!p.x || !p.end_x) return null
            const x1 = p.x    * sx, y1 = p.y    * sy
            const x2 = p.end_x * sx, y2 = p.end_y * sy
            const dist = Math.hypot(x2-x1, y2-y1)
            const ratio = dist > 8 ? (dist-7)/dist : 1
            const ex = x1 + (x2-x1)*ratio
            const ey = y1 + (y2-y1)*ratio
            return (
              <g key={i}
                onMouseEnter={e => setHov({ p, x: e.clientX, y: e.clientY })}
                style={{ cursor: "pointer" }}>
                <line x1={x1} y1={y1} x2={ex} y2={ey}
                  stroke={color} strokeWidth={2} strokeOpacity={0.7}
                  strokeLinecap="round" markerEnd="url(#ga-arr)" />
                <circle cx={x1} cy={y1} r={4} fill={color} stroke="#fff" strokeWidth={0.8} fillOpacity={0.85} />
                <circle cx={x2} cy={y2} r={5} fill="none" stroke="#22c55e" strokeWidth={1.5} />
              </g>
            )
          })}
        </svg>

        {hov && (
          <div className="fixed z-50 bg-slate-900/95 border border-slate-600 rounded-xl p-2.5 text-xs shadow-xl pointer-events-none"
            style={{ left: hov.x + 12, top: hov.y - 10 }}>
            <div className="font-bold" style={{ color }}>Pase hacia gol</div>
            {hov.p.minute && <div className="text-slate-400 text-[10px]">Minuto {hov.p.minute}′</div>}
            {hov.p.player_name && hov.p.player_name !== "" &&
              <div className="text-slate-400 text-[10px]">Por: {hov.p.player_name}</div>
            }
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-slate-800 flex items-center gap-3 text-[10px]">
        <span className="flex items-center gap-1">
          <span className="w-3 h-1 rounded inline-block" style={{ background: color }} />
          <span className="text-slate-400">Pase previo al gol</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full border border-green-500 inline-block" />
          <span className="text-slate-400">Destino (zona del gol)</span>
        </span>
        <span className="text-slate-600 ml-auto">{passes.length} pases encontrados</span>
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
