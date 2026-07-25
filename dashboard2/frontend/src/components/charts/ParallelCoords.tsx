"use client"

import { useMemo, useState, useRef, useCallback } from "react"
import type { Pass } from "@/lib/types"

interface Props {
  passes: Pass[]        // ALL passes of the selected player (full match)
  currentMinute: number
  playerName?: string
}

// ── Axes definition ───────────────────────────────────────────────────────────

interface AxisDef {
  key: string
  label: string
  unit?: string
  active: boolean
  getValue: (p: Pass) => number | null
}

const AXES: AxisDef[] = [
  { key: "minute",     label: "Minuto",      unit: "′",   active: true,  getValue: p => p.minute },
  { key: "x",         label: "X inicio",     unit: "yd",  active: true,  getValue: p => p.x },
  { key: "y",         label: "Y inicio",     unit: "yd",  active: true,  getValue: p => p.y },
  { key: "end_x",     label: "X destino",    unit: "yd",  active: true,  getValue: p => p.end_x },
  { key: "end_y",     label: "Y destino",    unit: "yd",  active: false, getValue: p => p.end_y },
  { key: "length",    label: "Longitud",     unit: "yd",  active: true,  getValue: p => p.pass_length },
  { key: "angle",     label: "Ángulo",       unit: "rad", active: false, getValue: p => p.pass_angle },
  { key: "duration",  label: "Duración",     unit: "s",   active: false, getValue: p => p.duration },
  { key: "press_dist",label: "Dist. presión",unit: "yd",  active: true,  getValue: p => p.pressure_distance },
]

// ── Color helpers ─────────────────────────────────────────────────────────────

const PASS_COLORS: Record<string, string> = {
  forward_vertical:  "#22c55e",
  diagonal_forward:  "#86efac",
  lateral:           "#60a5fa",
  lateral_short:     "#93c5fd",
  short:             "#e2e8f0",
  diagonal_back:     "#fbbf24",
  back_vertical:     "#f87171",
}

function passColor(p: Pass, isCurrentMinute: boolean): string {
  if (!p.completed) return "#ef4444"          // incomplete → red
  if (p.under_pressure) return "#f97316"      // under pressure → orange
  if (isCurrentMinute) return PASS_COLORS[p.pass_type] ?? "#94a3b8"
  return PASS_COLORS[p.pass_type] ?? "#94a3b8"
}

// ── Chart dimensions ──────────────────────────────────────────────────────────

const MARGIN = { top: 50, bottom: 30, left: 20, right: 20 }
const H = 240

export default function ParallelCoords({ passes, currentMinute, playerName }: Props) {
  const [axes, setAxes] = useState<AxisDef[]>(AXES)
  const [hovered, setHovered] = useState<Pass | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const activeAxes = axes.filter(a => a.active)

  // Toggle axis
  const toggle = (key: string) =>
    setAxes(prev => prev.map(a => a.key === key ? { ...a, active: !a.active } : a))

  // Compute min/max per active axis
  const scales = useMemo(() => {
    const s: Record<string, { min: number; max: number }> = {}
    for (const ax of activeAxes) {
      const vals = passes.map(p => ax.getValue(p)).filter((v): v is number => v != null && isFinite(v))
      if (vals.length === 0) { s[ax.key] = { min: 0, max: 1 }; continue }
      s[ax.key] = { min: Math.min(...vals), max: Math.max(...vals) }
    }
    return s
  }, [passes, activeAxes])

  // Responsive width from container
  const containerRef = useRef<HTMLDivElement>(null)
  const [svgWidth, setSvgWidth] = useState(700)
  const resizeObs = useCallback(() => {
    if (containerRef.current) setSvgWidth(containerRef.current.clientWidth || 700)
  }, [])

  // Compute axis X positions
  const innerW = svgWidth - MARGIN.left - MARGIN.right
  const innerH = H - MARGIN.top - MARGIN.bottom
  const axisX = (i: number) =>
    activeAxes.length > 1
      ? MARGIN.left + (i / (activeAxes.length - 1)) * innerW
      : MARGIN.left + innerW / 2

  // Normalize value → Y pixel
  const toY = (key: string, val: number | null) => {
    if (val == null || !isFinite(val)) return MARGIN.top + innerH / 2
    const sc = scales[key]
    if (!sc || sc.max === sc.min) return MARGIN.top + innerH / 2
    return MARGIN.top + (1 - (val - sc.min) / (sc.max - sc.min)) * innerH
  }

  // Build polyline points string for a pass
  const buildPoints = (p: Pass) =>
    activeAxes
      .map((ax, i) => `${axisX(i)},${toY(ax.key, ax.getValue(p))}`)
      .join(" ")

  const currentPasses = passes.filter(p => p.minute === currentMinute)
  const otherPasses   = passes.filter(p => p.minute !== currentMinute)

  // Stats
  const underPressureCount = passes.filter(p => p.under_pressure).length
  const incompleteCount    = passes.filter(p => !p.completed).length
  const pressuredAndFailed = passes.filter(p => p.under_pressure && !p.completed).length

  if (passes.length === 0) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex items-center justify-center h-40 text-slate-500 text-sm">
        Selecciona un jugador para ver el análisis de pases
      </div>
    )
  }

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-3" ref={containerRef}>

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-white">
            Análisis Dimensional de Pases
            {playerName && <span className="text-amber-400 ml-2">· {playerName}</span>}
          </h3>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {passes.length} pases totales · Minuto actual:{" "}
            <span className="text-amber-400 font-bold">{currentMinute}′</span>
            {" "}({currentPasses.length} pases resaltados)
          </p>
        </div>

        {/* Quick stats */}
        <div className="flex gap-3 text-[10px]">
          <span className="flex flex-col items-center bg-slate-900 px-2 py-1.5 rounded-lg border border-slate-700">
            <span className="text-orange-400 font-bold text-sm">{underPressureCount}</span>
            <span className="text-slate-500">bajo presión</span>
          </span>
          <span className="flex flex-col items-center bg-slate-900 px-2 py-1.5 rounded-lg border border-slate-700">
            <span className="text-red-400 font-bold text-sm">{incompleteCount}</span>
            <span className="text-slate-500">incompletos</span>
          </span>
          <span className="flex flex-col items-center bg-slate-900 px-2 py-1.5 rounded-lg border border-slate-700">
            <span className="text-rose-400 font-bold text-sm">{pressuredAndFailed}</span>
            <span className="text-slate-500">presión+fallo</span>
          </span>
        </div>
      </div>

      {/* ── Axis toggles ── */}
      <div className="flex flex-wrap gap-1.5">
        {axes.map(ax => (
          <button key={ax.key} onClick={() => toggle(ax.key)}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition-all border ${
              ax.active
                ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                : "bg-slate-700/50 border-slate-600 text-slate-500 hover:border-slate-500"
            }`}>
            <span className={`w-2 h-2 rounded-full ${ax.active ? "bg-amber-400" : "bg-slate-600"}`} />
            {ax.label}
          </button>
        ))}
      </div>

      {/* ── SVG Chart ── */}
      <div className="relative">
        <svg
          ref={svgRef}
          width="100%"
          height={H}
          viewBox={`0 0 ${svgWidth} ${H}`}
          style={{ overflow: "visible" }}
        >
          <rect x={0} y={0} width={svgWidth} height={H} fill="#0f172a" rx={6} />

          {/* ── Past passes (all, colored by type, semi-transparent) ── */}
          {otherPasses.map((p, i) => (
            <polyline
              key={`past-${i}`}
              points={buildPoints(p)}
              fill="none"
              stroke={passColor(p, false)}
              strokeWidth={p.under_pressure ? 1.8 : 1}
              strokeOpacity={p.under_pressure ? 0.55 : 0.28}
              strokeLinecap="round"
              className="cursor-pointer"
              onMouseEnter={() => setHovered(p)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}

          {/* ── Current minute passes (bright, on top) ── */}
          {currentPasses.map((p, i) => (
            <polyline
              key={`cur-${i}`}
              points={buildPoints(p)}
              fill="none"
              stroke={passColor(p, true)}
              strokeWidth={p.under_pressure ? 3.5 : 2.5}
              strokeOpacity={1}
              strokeLinecap="round"
              className="cursor-pointer"
              onMouseEnter={() => setHovered(p)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}

          {/* ── Axes ── */}
          {activeAxes.map((ax, i) => {
            const x   = axisX(i)
            const sc  = scales[ax.key]
            if (!sc) return null
            const mid2 = (sc.min + sc.max) / 2
            const fmt  = (v: number) => Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(1)

            return (
              <g key={ax.key}>
                {/* Axis line */}
                <line x1={x} y1={MARGIN.top} x2={x} y2={MARGIN.top + innerH}
                  stroke="#334155" strokeWidth={1.5} />

                {/* Label */}
                <text x={x} y={MARGIN.top - 20} textAnchor="middle"
                  fontSize={9} fill="#94a3b8" fontWeight={600}>
                  {ax.label}
                </text>
                {ax.unit && (
                  <text x={x} y={MARGIN.top - 9} textAnchor="middle" fontSize={7} fill="#475569">
                    ({ax.unit})
                  </text>
                )}

                {/* Ticks: top, mid, bottom */}
                {[
                  { v: sc.max,  y: MARGIN.top },
                  { v: mid2,    y: MARGIN.top + innerH / 2 },
                  { v: sc.min,  y: MARGIN.top + innerH },
                ].map(({ v, y }) => (
                  <g key={y}>
                    <line x1={x - 4} y1={y} x2={x + 4} y2={y} stroke="#475569" strokeWidth={1} />
                    <text x={x} y={y + (y === MARGIN.top + innerH ? 12 : -4)}
                      textAnchor="middle" fontSize={7} fill="#64748b">
                      {fmt(v)}
                    </text>
                  </g>
                ))}
              </g>
            )
          })}

          {/* ── Hovered pass highlight ── */}
          {hovered && (
            <polyline
              points={buildPoints(hovered)}
              fill="none"
              stroke="white"
              strokeWidth={2.5}
              strokeOpacity={0.9}
              strokeDasharray="4 2"
              style={{ pointerEvents: "none" }}
            />
          )}
        </svg>

        {/* ── Tooltip for hovered pass ── */}
        {hovered && (
          <div className="absolute top-2 right-2 bg-slate-900 border border-slate-600 rounded-xl p-3 text-xs space-y-1 shadow-2xl z-20 min-w-[180px]">
            <div className="font-bold text-white border-b border-slate-700 pb-1 mb-1">
              Minuto {hovered.minute}′{String(hovered.second).padStart(2,"0")}″
            </div>
            <Row label="Tipo"       value={hovered.pass_type.replace(/_/g," ")} />
            <Row label="Resultado"  value={hovered.pass_outcome ?? "Complete"} color={hovered.completed ? "#22c55e" : "#ef4444"} />
            <Row label="Longitud"   value={hovered.pass_length ? `${hovered.pass_length.toFixed(1)} yd` : "—"} />
            <Row label="Altura"     value={hovered.pass_height ?? "—"} />
            <Row label="Pie"        value={hovered.pass_body_part ?? "—"} />
            <Row label="Receptor"   value={hovered.pass_recipient_name ?? "—"} />
            {hovered.under_pressure && (
              <>
                <div className="border-t border-orange-800/50 pt-1 mt-1">
                  <span className="text-orange-400 font-bold">⚡ Bajo presión</span>
                </div>
                <Row label="Presionado por" value={hovered.presser_name ?? "—"} color="#f97316" />
                <Row label="Dist. presión"  value={hovered.pressure_distance ? `${hovered.pressure_distance} yd` : "—"} />
              </>
            )}
            {hovered.pass_switch && <div className="text-purple-400 font-medium">↔ Cambio de orientación</div>}
            {hovered.pass_cross  && <div className="text-cyan-400 font-medium">⤴ Centro</div>}
            {hovered.pass_through_ball && <div className="text-green-400 font-medium">→ Pase entre líneas</div>}
          </div>
        )}
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] border-t border-slate-700 pt-2">
        <span className="text-slate-500 font-medium">Leyenda:</span>
        {Object.entries(PASS_COLORS).map(([type, color]) => (
          <span key={type} className="flex items-center gap-1">
            <span className="w-5 h-0.5 rounded" style={{ background: color, display: "inline-block" }} />
            <span className="text-slate-400">{type.replace(/_/g," ")}</span>
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="w-5 h-0.5 rounded bg-orange-400 inline-block" style={{ borderTop: "2px solid #f97316" }} />
          <span className="text-orange-400">bajo presión (grueso)</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-5 h-0.5 rounded bg-red-400 inline-block" />
          <span className="text-red-400">incompleto</span>
        </span>
        <span className="flex items-center gap-1 ml-auto text-slate-600 italic">pasa el cursor sobre una línea para ver detalles</span>
      </div>
    </div>
  )
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span style={{ color: color ?? "#e2e8f0" }} className="font-medium truncate max-w-[100px]">{value}</span>
    </div>
  )
}
