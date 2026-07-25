"use client"

/**
 * PassDirectionMap — Vista completa de todos los pases del jugador (Evers et al. 2024, Fig. 5 y 10)
 *
 * Codificación de colores inspirada en el paper:
 *   - Naranja  : pase ofensivo (dx > 0, hacia portería rival)
 *   - Amarillo : pase neutro   (±10° del centro)
 *   - Azul     : pase defensivo (dx < 0, hacia portería propia)
 *
 * Mejoras respecto al paper:
 *   - Tooltip completo al hacer hover sobre cada pase
 *   - Filtros: todos / sólo completados / bajo presión / especiales
 *   - Indicador de zona dinámica (defensiva / neutral / ofensiva)
 *   - Botón para centrar la vista
 *
 * Fuente de datos: allPasses (todo el partido, no solo el minuto actual)
 */

import { useMemo, useState } from "react"
import type { Pass } from "@/lib/types"

const PITCH_W = 120
const PITCH_H = 80

type FilterMode = "all" | "completed" | "pressure" | "special"

interface Props {
  passes: Pass[]
  width?: number
  height?: number
  playerName?: string
}

// ── Classify direction following the paper ────────────────────────────────────
function classifyDir(p: Pass): "offensive" | "neutral" | "defensive" {
  const dx = p.end_x - p.x
  const dy = p.end_y - p.y
  const angle = Math.atan2(dy, dx) * (180 / Math.PI)   // degrees
  // Paper: if angle < 10° or > 170° from midline → neutral
  const absAngle = Math.abs(angle)
  if (absAngle < 10 || absAngle > 170)  return "neutral"
  if (dx > 0)                           return "offensive"
  return "defensive"
}

const DIR_COLORS = {
  offensive: "#f97316",   // orange  (paper: orange)
  neutral:   "#eab308",   // yellow  (paper: yellow)
  defensive: "#3b82f6",   // blue    (paper: blue)
}

const DIR_LABELS = {
  offensive: "Ofensivo",
  neutral:   "Neutro",
  defensive: "Defensivo",
}

export default function PassDirectionMap({ passes, width = 680, height = 420, playerName }: Props) {
  const [filter, setFilter]     = useState<FilterMode>("all")
  const [hovered, setHovered]   = useState<Pass | null>(null)
  const [hovXY, setHovXY]       = useState<{ x: number; y: number } | null>(null)

  const sx = width  / PITCH_W
  const sy = height / PITCH_H

  const filtered = useMemo(() => {
    switch (filter) {
      case "completed": return passes.filter(p => p.completed)
      case "pressure":  return passes.filter(p => p.under_pressure)
      case "special":   return passes.filter(p => p.pass_switch || p.pass_cross || p.pass_through_ball)
      default:          return passes
    }
  }, [passes, filter])

  // Count by direction
  const counts = useMemo(() => {
    const c = { offensive: 0, neutral: 0, defensive: 0 }
    for (const p of filtered) c[classifyDir(p)]++
    return c
  }, [filtered])

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700 flex-wrap gap-2">
        <div>
          <span className="text-[11px] font-bold text-white">Mapa de Pases — Partido completo</span>
          {playerName && <span className="text-amber-400 text-[10px] ml-2">· {playerName}</span>}
          <span className="text-slate-500 text-[10px] ml-2">({filtered.length} pases)</span>
        </div>

        {/* Filter buttons */}
        <div className="flex gap-1">
          {([
            { key: "all",       label: "Todos" },
            { key: "completed", label: "Completados" },
            { key: "pressure",  label: "Bajo presión" },
            { key: "special",   label: "Especiales" },
          ] as { key: FilterMode; label: string }[]).map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all border ${
                filter === f.key
                  ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                  : "bg-slate-700 border-slate-600 text-slate-500 hover:text-slate-300"
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Direction count badges ── */}
      <div className="flex gap-2 px-4 py-1.5 border-b border-slate-700/50">
        {(["offensive", "neutral", "defensive"] as const).map(d => (
          <span key={d} className="flex items-center gap-1.5 text-[10px]">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: DIR_COLORS[d] }} />
            <span className="text-slate-300">{DIR_LABELS[d]}</span>
            <span className="font-bold" style={{ color: DIR_COLORS[d] }}>{counts[d]}</span>
          </span>
        ))}
        <span className="ml-auto text-[9px] text-slate-600 italic">
          Naranja=ofensivo · Amarillo=neutro · Azul=defensivo
        </span>
      </div>

      {/* ── Pitch SVG ── */}
      <div className="relative">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ display: "block", background: "#14532d" }}
          onMouseLeave={() => { setHovered(null); setHovXY(null) }}
        >
          {/* Grass stripes */}
          {Array.from({ length: 12 }, (_, i) => (
            <rect key={i} x={i * (width / 12)} y={0}
              width={width / 12} height={height}
              fill={i % 2 === 0 ? "rgba(0,0,0,0.06)" : "transparent"} />
          ))}

          {/* Zone boundaries (dynamic zones per pass origin) */}
          <PitchLines w={width} h={height} sx={sx} sy={sy} />

          {/* Arrow defs */}
          <defs>
            {(["offensive", "neutral", "defensive"] as const).map(d => (
              <marker key={d} id={`dir-arr-${d}`}
                markerWidth={6} markerHeight={6} refX={5} refY={3} orient="auto">
                <polygon points="0 0, 6 3, 0 6" fill={DIR_COLORS[d]} opacity={0.9} />
              </marker>
            ))}
            <marker id="dir-arr-incomplete"
              markerWidth={6} markerHeight={6} refX={5} refY={3} orient="auto">
              <polygon points="0 0, 6 3, 0 6" fill="#ef4444" opacity={0.9} />
            </marker>
          </defs>

          {/* Render passes — incomplete first (below), complete on top */}
          {[...filtered].reverse().map((p, i) => {
            const dir      = classifyDir(p)
            const color    = p.completed ? DIR_COLORS[dir] : "#ef4444"
            const markerId = p.completed ? `dir-arr-${dir}` : "dir-arr-incomplete"
            const x1 = p.x    * sx
            const y1 = p.y    * sy
            const x2 = p.end_x * sx
            const y2 = p.end_y * sy
            const dist = Math.hypot(x2 - x1, y2 - y1)
            const ratio = dist > 8 ? (dist - 7) / dist : 1
            const ex = x1 + (x2 - x1) * ratio
            const ey = y1 + (y2 - y1) * ratio
            const isHov = hovered?.event_id === p.event_id
            const opacity = isHov ? 1 : (p.completed ? 0.72 : 0.45)

            return (
              <g key={p.event_id ?? i}
                onMouseEnter={e => {
                  setHovered(p)
                  setHovXY({ x: e.clientX, y: e.clientY })
                }}
                onMouseMove={e => setHovXY({ x: e.clientX, y: e.clientY })}
                style={{ cursor: "pointer" }}
              >
                {/* Glow for hovered */}
                {isHov && (
                  <line x1={x1} y1={y1} x2={ex} y2={ey}
                    stroke={color} strokeWidth={10} strokeOpacity={0.25} strokeLinecap="round" />
                )}
                {/* Line */}
                <line x1={x1} y1={y1} x2={ex} y2={ey}
                  stroke={color}
                  strokeWidth={isHov ? 3.5 : (p.under_pressure ? 2.5 : 1.8)}
                  strokeOpacity={opacity}
                  strokeDasharray={p.completed ? undefined : "4 3"}
                  strokeLinecap="round"
                  markerEnd={`url(#${markerId})`}
                />
                {/* Start dot (ball icon equivalent) */}
                <circle cx={x1} cy={y1} r={isHov ? 5.5 : 4}
                  fill={color} stroke="#000" strokeWidth={0.8} opacity={opacity} />
                {/* Under-pressure ring */}
                {p.under_pressure && (
                  <circle cx={x1} cy={y1} r={isHov ? 9 : 7.5}
                    fill="none" stroke="#f59e0b" strokeWidth={1.2}
                    strokeDasharray="3 2" opacity={0.7} />
                )}
                {/* End dot */}
                <circle cx={x2} cy={y2} r={2.5}
                  fill="white" opacity={opacity * 0.6} />
              </g>
            )
          })}
        </svg>

        {/* Floating tooltip */}
        {hovered && hovXY && (
          <div
            className="fixed z-50 bg-slate-900/95 border border-slate-600 rounded-xl p-3 text-xs shadow-2xl pointer-events-none min-w-[200px]"
            style={{ left: hovXY.x + 14, top: hovXY.y - 10 }}
          >
            <div className="font-bold text-white border-b border-slate-700 pb-1 mb-1">
              Min {hovered.minute}′{String(hovered.second).padStart(2,"0")}″
              <span className={`ml-2 text-[10px] font-normal ${hovered.completed ? "text-green-400" : "text-red-400"}`}>
                {hovered.completed ? "✓ Completado" : "✗ Incompleto"}
              </span>
            </div>
            <div className="space-y-0.5 text-[10px]">
              <Row label="Dirección"  value={DIR_LABELS[classifyDir(hovered)]}
                color={DIR_COLORS[classifyDir(hovered)]} />
              <Row label="Longitud"   value={hovered.pass_length ? `${hovered.pass_length.toFixed(1)} yd` : "—"} />
              <Row label="Altura"     value={hovered.pass_height ?? "—"} />
              <Row label="Pie"        value={hovered.pass_body_part ?? "—"} />
              <Row label="Receptor"   value={hovered.pass_recipient_name ?? "—"} />
              {hovered.under_pressure && (
                <div className="text-amber-400 font-medium pt-0.5">⚡ Bajo presión · {hovered.presser_name ?? ""}</div>
              )}
              {hovered.pass_switch     && <div className="text-purple-400">↔ Cambio de orientación</div>}
              {hovered.pass_cross      && <div className="text-cyan-400">⤴ Centro</div>}
              {hovered.pass_through_ball && <div className="text-green-400">→ Pase entre líneas</div>}
            </div>
          </div>
        )}
      </div>

      {/* Empty state */}
      {passes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-white/40 text-sm">
          Selecciona un jugador para ver su mapa de pases completo
        </div>
      )}
    </div>
  )
}

// ── Pitch lines helper ─────────────────────────────────────────────────────────

function PitchLines({ w, h, sx, sy }: { w: number; h: number; sx: number; sy: number }) {
  const lp  = { stroke: "rgba(255,255,255,0.45)", strokeWidth: 1.2, fill: "none" } as const
  const lp2 = { stroke: "rgba(255,255,255,0.2)",  strokeWidth: 0.8, fill: "none" } as const
  return (
    <g>
      <rect x={0} y={0} width={w} height={h} {...lp} />
      <line x1={w/2} y1={0} x2={w/2} y2={h} {...lp} />
      <circle cx={w/2} cy={h/2} r={10*sx} {...lp} />
      <rect x={0} y={18*sy} width={18*sx} height={44*sy} {...lp} />
      <rect x={102*sx} y={18*sy} width={18*sx} height={44*sy} {...lp} />
      <rect x={0} y={30*sy} width={6*sx} height={20*sy} {...lp2} />
      <rect x={114*sx} y={30*sy} width={6*sx} height={20*sy} {...lp2} />
      <circle cx={12*sx} cy={40*sy} r={2} fill="rgba(255,255,255,0.5)" />
      <circle cx={108*sx} cy={40*sy} r={2} fill="rgba(255,255,255,0.5)" />
      <circle cx={w/2} cy={h/2} r={2} fill="rgba(255,255,255,0.5)" />
      {/* Goals */}
      <rect x={-4} y={36*sy} width={4} height={8*sy}
        fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.4)" strokeWidth={1} />
      <rect x={w} y={36*sy} width={4} height={8*sy}
        fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.4)" strokeWidth={1} />
    </g>
  )
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span style={{ color: color ?? "#e2e8f0" }} className="font-medium">{value}</span>
    </div>
  )
}
