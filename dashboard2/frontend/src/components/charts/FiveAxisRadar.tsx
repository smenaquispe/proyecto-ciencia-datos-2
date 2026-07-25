"use client"

/**
 * FiveAxisRadar — 4 radares simultáneos estilo Evers et al. (2024), Fig. 8
 *
 * Exactamente como en la imagen del paper:
 *   1. General Rating Weights      (Pases · Duelos · Tiros)        — triángulo
 *   2. Pass Rating Weights         (5 ejes: Pressure·Packing·Passes until shot·Expected pass·Area·Overplayed pressure)
 *   3. Duels Rating Weights        (4 ejes: Passes until shot·Pressure·Area·Expected duel)
 *   4. Shots Rating Weights        (3 ejes: Pressure·Expected goals·Accuracy)
 *
 * Cada radar es INTERACTIVO: el usuario arrastra los vértices para cambiar
 * los pesos y ver cómo cambia el score ponderado en tiempo real.
 *
 * Las métricas reales del jugador se muestran como polígono de fondo gris.
 */

import { useState, useRef, useCallback, useMemo } from "react"
import type { PlayerRatings } from "@/lib/types"

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface AxisDef {
  key:   string
  label: string
  value: number   // 0-10  (score real del jugador)
  weight: number  // 0-10  (peso ajustable por el usuario)
  angle: number   // radians
}

interface RadarConfig {
  title:    string
  subtitle: string
  color:    string
  axes:     AxisDef[]
}

// ── Geometría ─────────────────────────────────────────────────────────────────

const R   = 70   // radio máximo
const CX  = 95
const CY  = 95
const W   = 190
const H   = 190
const RINGS = [2, 4, 6, 8, 10]

function polar(cx: number, cy: number, angle: number, r: number) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
}

function buildAngles(n: number): number[] {
  return Array.from({ length: n }, (_, i) => -Math.PI / 2 + (2 * Math.PI / n) * i)
}

function polygonPoints(cx: number, cy: number, axes: AxisDef[], useWeight: boolean): string {
  return axes
    .map(ax => {
      const raw  = useWeight ? ax.weight : ax.value
      const v    = Math.max(0, Math.min(10, raw ?? 0))   // clamp [0,10]
      const frac = v / 10
      const p    = polar(cx, cy, ax.angle, frac * R)
      return `${p.x},${p.y}`
    })
    .join(" ")
}

// ── Weighted score ─────────────────────────────────────────────────────────────

function weightedScore(axes: AxisDef[]): number {
  const tw = axes.reduce((s, a) => s + a.weight, 0)
  if (tw === 0) return 0
  return axes.reduce((s, a) => s + a.weight * a.value, 0) / tw
}

// ── Single Radar ──────────────────────────────────────────────────────────────

function SingleRadar({
  config,
  onAxesChange,
}: {
  config: RadarConfig
  onAxesChange: (axes: AxisDef[]) => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const dragging = useRef<string | null>(null)

  const score = useMemo(() => weightedScore(config.axes), [config.axes])
  const scoreColor = score >= 7 ? "#22c55e" : score >= 4 ? "#f59e0b" : "#ef4444"

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragging.current || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const dx = (e.clientX - rect.left) - CX
    const dy = (e.clientY - rect.top)  - CY
    const dist = Math.sqrt(dx*dx + dy*dy)
    const val  = Math.round(Math.min(dist / R * 10, 10) * 2) / 2

    onAxesChange(
      config.axes.map(ax => ax.key === dragging.current ? { ...ax, weight: val } : ax)
    )
  }, [config.axes, onAxesChange])

  return (
    <div className="flex flex-col items-center gap-1">

      {/* Title */}
      <div className="text-center">
        <div className="text-[10px] font-bold text-slate-300 uppercase tracking-wide">{config.title}</div>
        <div className="text-[9px] text-slate-500">{config.subtitle}</div>
      </div>

      {/* SVG Radar */}
      <svg
        ref={svgRef}
        width={W} height={H}
        className="cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseUp={() => { dragging.current = null }}
        onMouseLeave={() => { dragging.current = null }}
      >
        {/* Background rings */}
        {RINGS.map(v => (
          <polygon
            key={v}
            points={polygonPoints(CX, CY, config.axes.map(ax => ({
              ...ax, value: v, weight: v
            })), true)}
            fill="none"
            stroke={v === 10 ? "#475569" : "#1e293b"}
            strokeWidth={v === 10 ? 1.5 : 1}
          />
        ))}

        {/* Spokes */}
        {config.axes.map(ax => {
          const outer = polar(CX, CY, ax.angle, R)
          return (
            <line key={`spoke-${ax.key}`}
              x1={CX} y1={CY} x2={outer.x} y2={outer.y}
              stroke="#2d3d50" strokeWidth={1} />
          )
        })}

        {/* Ring value labels (only rightmost spoke) */}
        {RINGS.map(v => {
          const firstAngle = config.axes[0]?.angle ?? 0
          const p = polar(CX, CY, firstAngle, (v/10)*R)
          return (
            <text key={`rl-${v}`}
              x={p.x + 3} y={p.y + 3}
              fontSize={6} fill="#475569" textAnchor="start">
              {v}
            </text>
          )
        })}

        {/* Score polygon (real values — gray dashed) */}
        <polygon
          points={polygonPoints(CX, CY, config.axes, false)}
          fill="rgba(100,116,139,0.12)"
          stroke="#64748b"
          strokeWidth={1.2}
          strokeDasharray="3 2"
        />

        {/* Weight polygon (interactive — colored fill) */}
        <polygon
          points={polygonPoints(CX, CY, config.axes, true)}
          fill={`${config.color}18`}
          stroke={config.color}
          strokeWidth={2}
        />

        {/* Axis labels */}
        {config.axes.map(ax => {
          const labelR = R + 16
          const p = polar(CX, CY, ax.angle, labelR)
          return (
            <text key={`lbl-${ax.key}`}
              x={p.x} y={p.y + 3}
              textAnchor="middle"
              fontSize={7.5}
              fontWeight={600}
              fill="#94a3b8"
            >
              {ax.label}
            </text>
          )
        })}

        {/* Draggable weight nodes */}
        {config.axes.map(ax => {
          const p = polar(CX, CY, ax.angle, (ax.weight/10)*R)
          return (
            <circle key={`node-${ax.key}`}
              cx={p.x} cy={p.y} r={6}
              fill={config.color}
              stroke="#fff" strokeWidth={1.5}
              className="cursor-grab active:cursor-grabbing"
              onMouseDown={() => { dragging.current = ax.key }}
            />
          )
        })}

        {/* Score value dots (real scores) */}
        {config.axes.map(ax => {
          const p = polar(CX, CY, ax.angle, (ax.value/10)*R)
          return (
            <circle key={`val-${ax.key}`}
              cx={p.x} cy={p.y} r={3}
              fill={config.color} fillOpacity={0.35}
              stroke={config.color} strokeWidth={1}
            />
          )
        })}
      </svg>

      {/* Weighted score badge */}
      <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5">
        <span className="text-[9px] text-slate-500 uppercase tracking-wide">Score</span>
        <span className="text-base font-black" style={{ color: scoreColor }}>
          {score.toFixed(1)}
        </span>
        <span className="text-[9px] text-slate-600">/10</span>
      </div>

      {/* Reset weights */}
      <button
        onClick={() => onAxesChange(config.axes.map(ax => ({ ...ax, weight: 5 })))}
        className="text-[9px] text-slate-600 hover:text-slate-400 transition-colors"
      >
        reset pesos
      </button>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  ratings:    PlayerRatings
  playerName?: string
}

export default function FiveAxisRadar({ ratings, playerName }: Props) {
  const { passes, duels, shots } = ratings

  // ── General (3 ejes: Pases · Duelos · Tiros) ─────────────────────────────
  const generalAngles = buildAngles(3)
  const [generalAxes, setGeneralAxes] = useState<AxisDef[]>([
    { key: "pass",  label: "Pases",  value: passes.pass_score, weight: 5, angle: generalAngles[0] },
    { key: "duel",  label: "Duelos", value: duels.duel_score,  weight: 5, angle: generalAngles[1] },
    { key: "shot",  label: "Tiros",  value: shots.shot_score,  weight: 5, angle: generalAngles[2] },
  ])

  // ── Pass Rating (6 ejes como en el paper) ────────────────────────────────
  const passAngles = buildAngles(6)
  const [passAxes, setPassAxes] = useState<AxisDef[]>([
    { key: "p_pressure",  label: "Pressure",          value: passes.pressure_rating,  weight: 5, angle: passAngles[0] },
    { key: "p_packing",   label: "Packing",            value: Math.min(passes.special_passes, 10), weight: 5, angle: passAngles[1] },
    { key: "p_until",     label: "Passes until shot",  value: passes.direction_score,  weight: 5, angle: passAngles[2] },
    { key: "p_xp",        label: "Expected pass",      value: passes.completion_rate,  weight: 5, angle: passAngles[3] },
    { key: "p_area",      label: "Area",               value: passes.length_score,     weight: 5, angle: passAngles[4] },
    { key: "p_ovp",       label: "Overplayed pressure",value: Math.min(passes.pressure_rating * 0.8, 10), weight: 5, angle: passAngles[5] },
  ])

  // ── Duels Rating (4 ejes como en el paper) ────────────────────────────────
  const duelAngles = buildAngles(4)
  const [duelAxes, setDuelAxes] = useState<AxisDef[]>([
    { key: "d_until",    label: "Passes until shot", value: duels.duel_score * 0.7, weight: 5, angle: duelAngles[0] },
    { key: "d_pressure", label: "Pressure",          value: duels.pressure_rating, weight: 5, angle: duelAngles[1] },
    { key: "d_area",     label: "Area",              value: duels.area_score,      weight: 5, angle: duelAngles[2] },
    { key: "d_xd",       label: "Expected duel",     value: duels.win_rate,        weight: 5, angle: duelAngles[3] },
  ])

  // ── Shots Rating (3 ejes como en el paper) ────────────────────────────────
  const shotAngles = buildAngles(3)
  const [shotAxes, setShotAxes] = useState<AxisDef[]>([
    { key: "s_pressure", label: "Pressure",        value: shots.shot_score * 0.6, weight: 5, angle: shotAngles[0] },
    { key: "s_xg",       label: "Expected goals",  value: shots.xg_score,        weight: 5, angle: shotAngles[1] },
    { key: "s_acc",      label: "Accuracy",        value: shots.shot_accuracy,   weight: 5, angle: shotAngles[2] },
  ])

  // ── Overall (pondera los 4 radares) ──────────────────────────────────────
  const overallScore = useMemo(() => {
    const s = [
      weightedScore(generalAxes),
      weightedScore(passAxes),
      weightedScore(duelAxes),
      weightedScore(shotAxes),
    ]
    return (s.reduce((a, b) => a + b, 0) / s.length)
  }, [generalAxes, passAxes, duelAxes, shotAxes])

  const overallColor = overallScore >= 7 ? "#22c55e" : overallScore >= 4 ? "#f59e0b" : "#ef4444"

  const radars: { config: RadarConfig; onChange: (axes: AxisDef[]) => void }[] = [
    {
      config: { title: "General Rating Weights", subtitle: "Pases · Duelos · Tiros", color: "#a3a844", axes: generalAxes },
      onChange: setGeneralAxes,
    },
    {
      config: { title: "Pass Rating Weights", subtitle: "6 dimensiones", color: "#a3a844", axes: passAxes },
      onChange: setPassAxes,
    },
    {
      config: { title: "Duels Rating Weights", subtitle: "4 dimensiones", color: "#a3a844", axes: duelAxes },
      onChange: setDuelAxes,
    },
    {
      config: { title: "Shots Rating Weights", subtitle: "3 dimensiones", color: "#a3a844", axes: shotAxes },
      onChange: setShotAxes,
    },
  ]

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">
            Ratings Multidimensionales
            {playerName && <span className="text-amber-400 ml-2 font-normal">· {playerName}</span>}
          </h3>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Arrastra los vértices dorados para ajustar pesos · Polígono gris = scores reales
          </p>
        </div>

        {/* Overall score badge */}
        <div className="flex flex-col items-center bg-slate-900 border border-slate-600 rounded-xl px-5 py-2 flex-shrink-0 gap-0.5">
          <span className="text-[9px] text-slate-500 uppercase tracking-widest">Score Global</span>
          <span className="text-3xl font-black" style={{ color: overallColor }}>
            {overallScore.toFixed(1)}
          </span>
          <span className="text-[9px] text-slate-500">promedio 4 radares</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-[10px] text-slate-500 border-b border-slate-700 pb-3">
        <span className="flex items-center gap-1.5">
          <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#a3a844" strokeWidth="2"/><circle cx="10" cy="4" r="4" fill="#a3a844"/></svg>
          Pesos (ajustables con drag)
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#64748b" strokeWidth="1.5" strokeDasharray="3 2"/></svg>
          Scores reales del jugador
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-[9px]">Escala:</span>
          <span className="text-slate-400">0 → 10 (anillos cada 2 puntos)</span>
        </span>
      </div>

      {/* 4 Radars grid — matching the paper layout */}
      <div
        className="grid gap-6 justify-items-center"
        style={{ gridTemplateColumns: "repeat(4, 1fr)" }}
      >
        {radars.map(({ config, onChange }) => (
          <SingleRadar
            key={config.title}
            config={config}
            onAxesChange={onChange}
          />
        ))}
      </div>

      {/* Score breakdown table */}
      <div className="border-t border-slate-700 pt-3 grid grid-cols-4 gap-3 text-center text-[10px]">
        {[
          { label: "General",  score: weightedScore(generalAxes), color: "#f59e0b" },
          { label: "Pases",    score: weightedScore(passAxes),    color: "#3b82f6" },
          { label: "Duelos",   score: weightedScore(duelAxes),    color: "#f97316" },
          { label: "Tiros",    score: weightedScore(shotAxes),    color: "#ef4444" },
        ].map(s => {
          const c = s.score >= 7 ? "#22c55e" : s.score >= 4 ? "#f59e0b" : "#ef4444"
          return (
            <div key={s.label} className="bg-slate-900 border border-slate-700 rounded-xl p-2">
              <div className="text-slate-500 mb-1">{s.label}</div>
              <div className="text-xl font-black" style={{ color: c }}>{s.score.toFixed(1)}</div>
              <div className="w-full h-1.5 bg-slate-700 rounded-full mt-1.5 overflow-hidden">
                <div className="h-full rounded-full"
                  style={{ width: `${s.score*10}%`, background: s.color }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
