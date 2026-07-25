"use client"

/**
 * PressurePassMap — Pases bajo presión con visualización del origen de presión
 *
 * Por cada pase bajo presión muestra:
 *   • Posición del jugador al pasar (círculo ámbar)
 *   • Destino del pase (flecha verde/roja según completado)
 *   • Posición de cada presionador (X roja) con radio de influencia (halo)
 *   • Línea de presión: del presionador al pasador
 *   • Tooltip al hover: quién presionó, distancia, outcome
 *
 * Inspirado en la Fig. 6(b) del paper: Evers et al. (2024)
 */

import { useState, useMemo } from "react"
import type { PressurePass, Pressuror } from "@/lib/types"

const PITCH_W = 120
const PITCH_H = 80

interface Props {
  passes:     PressurePass[]
  width?:     number
  height?:    number
  playerName?: string
}

type SortMode = "minute" | "dist" | "count"

export default function PressurePassMap({
  passes,
  width  = 760,
  height = 440,
  playerName,
}: Props) {
  const [selected, setSelected] = useState<PressurePass | null>(null)
  const [hovered,  setHovered]  = useState<PressurePass | null>(null)
  const [hovXY,    setHovXY]    = useState<{ x: number; y: number } | null>(null)
  const [sortBy,   setSortBy]   = useState<SortMode>("minute")
  const [showOnly, setShowOnly] = useState<"all" | "completed" | "failed">("all")

  const sx = width  / PITCH_W
  const sy = height / PITCH_H

  const filtered = useMemo(() => {
    let list = passes
    if (showOnly === "completed") list = list.filter(p => p.completed)
    if (showOnly === "failed")    list = list.filter(p => !p.completed)
    const sorted = [...list]
    if (sortBy === "dist")  sorted.sort((a, b) => (a.min_pressure_dist ?? 99) - (b.min_pressure_dist ?? 99))
    if (sortBy === "count") sorted.sort((a, b) => b.pressure_count - a.pressure_count)
    return sorted
  }, [passes, sortBy, showOnly])

  const stats = useMemo(() => ({
    total:     passes.length,
    completed: passes.filter(p => p.completed).length,
    avgDist:   passes.length
      ? (passes.reduce((s, p) => s + (p.min_pressure_dist ?? 0), 0) / passes.length).toFixed(1)
      : "—",
    maxPressors: passes.length
      ? Math.max(...passes.map(p => p.pressure_count))
      : 0,
  }), [passes])

  const active = hovered ?? selected

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700 flex-wrap gap-2">
        <div>
          <span className="text-[11px] font-bold text-white">Pases Bajo Presión</span>
          {playerName && <span className="text-amber-400 text-[10px] ml-2">· {playerName}</span>}
        </div>

        <div className="flex gap-2 items-center">
          {/* Filter */}
          <div className="flex gap-1">
            {([
              { key: "all",       label: `Todos (${passes.length})` },
              { key: "completed", label: `✓ Completados (${stats.completed})` },
              { key: "failed",    label: `✗ Fallidos (${passes.length - stats.completed})` },
            ] as { key: typeof showOnly; label: string }[]).map(f => (
              <button key={f.key} onClick={() => setShowOnly(f.key)}
                className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all border ${
                  showOnly === f.key
                    ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                    : "bg-slate-700 border-slate-600 text-slate-500 hover:text-slate-300"
                }`}>
                {f.label}
              </button>
            ))}
          </div>
          {/* Sort */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortMode)}
            className="bg-slate-700 border border-slate-600 text-slate-300 text-[10px] rounded-md px-2 py-1"
          >
            <option value="minute">Orden: Minuto</option>
            <option value="dist">Orden: Distancia presión ↑</option>
            <option value="count">Orden: N° presionadores ↓</option>
          </select>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div className="flex gap-4 px-4 py-2 border-b border-slate-700/50 text-[10px]">
        <span className="text-slate-400">Total bajo presión: <b className="text-amber-400">{stats.total}</b></span>
        <span className="text-slate-400">Completados: <b className="text-green-400">{stats.completed}</b></span>
        <span className="text-slate-400">% éxito: <b className="text-white">{passes.length ? ((stats.completed/passes.length)*100).toFixed(0) : 0}%</b></span>
        <span className="text-slate-400">Dist. presión media: <b className="text-orange-400">{stats.avgDist} yd</b></span>
        <span className="text-slate-400">Máx presionadores: <b className="text-red-400">{stats.maxPressors}</b></span>
      </div>

      <div className="flex gap-0">

        {/* ── Pitch ── */}
        <div className="relative flex-shrink-0"
          onMouseLeave={() => { setHovered(null); setHovXY(null) }}>
          <svg
            width={width}
            height={height}
            style={{ display: "block", background: "#14532d" }}
          >
            {/* Grass stripes */}
            {Array.from({ length: 12 }, (_, i) => (
              <rect key={i} x={i*(width/12)} y={0} width={width/12} height={height}
                fill={i%2===0 ? "rgba(0,0,0,0.06)" : "transparent"} />
            ))}

            <PitchLines w={width} h={height} sx={sx} sy={sy} />

            {/* Arrow defs */}
            <defs>
              <marker id="pp-arr-ok" markerWidth={7} markerHeight={7} refX={6} refY={3.5} orient="auto">
                <polygon points="0 0,7 3.5,0 7" fill="#22c55e" opacity={0.9} />
              </marker>
              <marker id="pp-arr-fail" markerWidth={7} markerHeight={7} refX={6} refY={3.5} orient="auto">
                <polygon points="0 0,7 3.5,0 7" fill="#ef4444" opacity={0.9} />
              </marker>
            </defs>

            {/* Render all passes */}
            {filtered.map((p) => {
              const isSel  = selected?.event_id === p.event_id
              const isHov  = hovered?.event_id  === p.event_id
              const isAct  = isSel || isHov
              const px1    = p.x    * sx
              const py1    = p.y    * sy
              const px2    = (p.end_x ?? p.x + 5) * sx
              const py2    = (p.end_y ?? p.y)      * sy
              const dist   = Math.hypot(px2-px1, py2-py1)
              const ratio  = dist > 8 ? (dist-7)/dist : 1
              const ex     = px1 + (px2-px1)*ratio
              const ey     = py1 + (py2-py1)*ratio
              const passOk = p.completed

              return (
                <g key={p.event_id}
                  onClick={() => setSelected(isSel ? null : p)}
                  onMouseEnter={e => { setHovered(p); setHovXY({ x: e.clientX, y: e.clientY }) }}
                  onMouseMove={e  => setHovXY({ x: e.clientX, y: e.clientY })}
                  style={{ cursor: "pointer" }}
                >
                  {/* Pressure halos — one per pressuror */}
                  {isAct && p.pressurors.map((pr, pi) => (
                    <g key={`halo-${pi}`}>
                      {/* Halo círculo de influencia */}
                      <circle
                        cx={pr.press_x * sx} cy={pr.press_y * sy}
                        r={Math.max(12, (10 - pr.distance) * sx * 0.9)}
                        fill="rgba(239,68,68,0.12)"
                        stroke="#ef4444"
                        strokeWidth={0.8}
                        strokeDasharray="3 2"
                      />
                      {/* Línea presionador → pasador */}
                      <line
                        x1={pr.press_x * sx} y1={pr.press_y * sy}
                        x2={px1}             y2={py1}
                        stroke="#ef4444"
                        strokeWidth={1.2}
                        strokeOpacity={0.5}
                        strokeDasharray="4 3"
                      />
                      {/* X del presionador */}
                      <text
                        x={pr.press_x * sx} y={pr.press_y * sy + 4}
                        textAnchor="middle" fontSize={10}
                        fill="#ef4444" fontWeight={700}
                        style={{ pointerEvents: "none" }}
                      >✕</text>
                      {/* Nombre del presionador */}
                      <text
                        x={pr.press_x * sx} y={pr.press_y * sy - 8}
                        textAnchor="middle" fontSize={7}
                        fill="#fca5a5"
                        style={{ pointerEvents: "none" }}
                      >
                        {pr.presser_name.split(" ").slice(-1)[0]}
                      </text>
                    </g>
                  ))}

                  {/* Glow for active */}
                  {isAct && (
                    <line x1={px1} y1={py1} x2={ex} y2={ey}
                      stroke={passOk ? "#22c55e" : "#ef4444"}
                      strokeWidth={12} strokeOpacity={0.2} strokeLinecap="round" />
                  )}

                  {/* Pass line */}
                  <line x1={px1} y1={py1} x2={ex} y2={ey}
                    stroke={passOk ? "#22c55e" : "#ef4444"}
                    strokeWidth={isAct ? 3.5 : 2}
                    strokeOpacity={isAct ? 1 : (isSel ? 0.9 : 0.6)}
                    strokeDasharray={passOk ? undefined : "5 3"}
                    strokeLinecap="round"
                    markerEnd={`url(#pp-arr-${passOk ? "ok" : "fail"})`}
                  />

                  {/* Pasador circle */}
                  <circle cx={px1} cy={py1} r={isAct ? 7 : 5}
                    fill="#f59e0b"
                    stroke={isSel ? "#fff" : "#000"}
                    strokeWidth={isSel ? 2 : 0.8}
                    fillOpacity={isAct ? 1 : 0.7}
                  />

                  {/* Pressure count badge */}
                  {p.pressure_count > 1 && (
                    <text x={px1+6} y={py1-5} fontSize={7} fill="#fca5a5" fontWeight={700}>
                      {p.pressure_count}×
                    </text>
                  )}

                  {/* Destino */}
                  <circle cx={px2} cy={py2} r={3}
                    fill={passOk ? "#22c55e" : "#ef4444"}
                    opacity={0.6} />

                  {/* Minuto label on hover */}
                  {isAct && (
                    <text x={px1} y={py1-10} textAnchor="middle"
                      fontSize={8} fill="#f59e0b" fontWeight={700}
                      style={{ pointerEvents: "none" }}>
                      {p.minute}′
                    </text>
                  )}
                </g>
              )
            })}
          </svg>

          {/* Floating tooltip */}
          {hovered && hovXY && (
            <div
              className="fixed z-50 bg-slate-900/95 border border-slate-600 rounded-xl p-3 text-xs shadow-2xl pointer-events-none min-w-[220px]"
              style={{ left: hovXY.x + 14, top: hovXY.y - 10 }}
            >
              <div className="font-bold text-white border-b border-slate-700 pb-1 mb-1 flex items-center justify-between">
                <span>Min {hovered.minute}′{String(hovered.second).padStart(2,"0")}″</span>
                <span className={hovered.completed ? "text-green-400 text-[10px]" : "text-red-400 text-[10px]"}>
                  {hovered.completed ? "✓ Completado" : "✗ Fallido"}
                </span>
              </div>
              <div className="space-y-0.5 text-[10px]">
                <Row label="Longitud"   value={hovered.pass_length ? `${hovered.pass_length.toFixed(1)} yd` : "—"} />
                <Row label="Receptor"   value={hovered.recipient_name ?? "—"} />
                <Row label="Pie"        value={hovered.pass_body_part ?? "—"} />
                <div className="border-t border-orange-900/50 pt-1 mt-1">
                  <span className="text-orange-400 font-bold">
                    ⚡ {hovered.pressure_count} presionador{hovered.pressure_count !== 1 ? "es" : ""}
                  </span>
                </div>
                {hovered.pressurors.slice(0, 3).map((pr, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="text-red-400">✕</span>
                    <span className="text-slate-300">{pr.presser_name}</span>
                    <span className="text-slate-500 ml-auto">{pr.distance.toFixed(1)} yd</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Sidebar list ── */}
        <div className="flex-1 overflow-y-auto border-l border-slate-700" style={{ maxHeight: height }}>
          <div className="p-2 space-y-1">
            {filtered.map(p => {
              const isSel = selected?.event_id === p.event_id
              return (
                <button key={p.event_id}
                  onClick={() => setSelected(isSel ? null : p)}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-[10px] transition-all border ${
                    isSel
                      ? "bg-amber-500/15 border-amber-500/50"
                      : "bg-slate-900/50 border-slate-700/50 hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-bold text-slate-300">{p.minute}′{String(p.second).padStart(2,"0")}″</span>
                    <span className={p.completed ? "text-green-400" : "text-red-400"}>
                      {p.completed ? "✓" : "✗"}
                    </span>
                  </div>
                  <div className="text-slate-500 flex items-center gap-1.5">
                    <span className="text-orange-400">⚡{p.pressure_count}</span>
                    {p.closest_presser && (
                      <span className="truncate">{p.closest_presser.split(" ").slice(-1)[0]}</span>
                    )}
                    {p.min_pressure_dist && (
                      <span className="ml-auto text-slate-600">{p.min_pressure_dist.toFixed(0)} yd</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Selected pass detail */}
      {selected && (
        <div className="border-t border-slate-700 p-4">
          <h4 className="text-[11px] font-bold text-white mb-2">
            Detalle — Min {selected.minute}′{String(selected.second).padStart(2,"0")}″
            <span className={`ml-2 text-[10px] font-normal ${selected.completed ? "text-green-400" : "text-red-400"}`}>
              {selected.completed ? "Pase completado" : "Pase fallido"}
            </span>
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 text-[10px]">
              <Row label="Longitud"  value={selected.pass_length ? `${selected.pass_length.toFixed(1)} yd` : "—"} />
              <Row label="Altura"    value={selected.pass_height ?? "—"} />
              <Row label="Pie"       value={selected.pass_body_part ?? "—"} />
              <Row label="Receptor"  value={selected.recipient_name ?? "—"} />
            </div>
            <div className="space-y-1 text-[10px]">
              <div className="text-orange-400 font-bold mb-1">
                ⚡ {selected.pressure_count} presionador{selected.pressure_count !== 1 ? "es" : ""}
              </div>
              {selected.pressurors.map((pr, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-900 rounded px-2 py-1">
                  <span className="text-red-400 text-xs">✕</span>
                  <span className="text-slate-300 flex-1">{pr.presser_name}</span>
                  <span className="text-orange-400 font-bold">{pr.distance.toFixed(1)} yd</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {passes.length === 0 && (
        <div className="p-8 text-center text-slate-500 text-sm">
          {playerName
            ? `${playerName} no tuvo pases bajo presión`
            : "Selecciona un jugador"}
        </div>
      )}
    </div>
  )
}

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
      <rect x={-4} y={36*sy} width={4} height={8*sy}
        fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.4)" strokeWidth={1} />
      <rect x={w} y={36*sy} width={4} height={8*sy}
        fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.4)" strokeWidth={1} />
    </g>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200 font-medium">{value}</span>
    </div>
  )
}
