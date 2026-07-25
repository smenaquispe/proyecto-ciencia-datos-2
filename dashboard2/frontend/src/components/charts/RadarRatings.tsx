"use client"

/**
 * RadarRatings — Soccersight-style overview (Evers et al. 2024, Fig. 3)
 *
 * Muestra tres secciones:
 *   1. Tabla de scores detallados (Pases / Duelos / Tiros)
 *   2. Radar chart interactivo para ajustar los PESOS de cada categoría
 *   3. Score general ponderado (0-10)
 *
 * El usuario puede arrastrar los vértices del radar para cambiar los pesos
 * y el score general se recalcula en tiempo real.
 */

import { useState, useMemo, useRef, useCallback } from "react"
import type { PlayerRatings } from "@/lib/types"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  ratings: PlayerRatings
  playerName?: string
  homeTeamName?: string
  awayTeamName?: string
  teamName?: string
}

interface RadarWeight {
  key: "pass" | "duel" | "shot"
  label: string
  color: string
  weight: number      // 0-10
  score: number       // 0-10
  angle: number       // radians
}

// ── Constants ─────────────────────────────────────────────────────────────────

const R_MAX    = 80    // outer radius of radar (px)
const CX       = 110   // center X of radar SVG
const CY       = 100   // center Y of radar SVG
const SVG_W    = 220
const SVG_H    = 200
const RINGS    = [2, 4, 6, 8, 10]

// ── Helpers ───────────────────────────────────────────────────────────────────

function polar(cx: number, cy: number, angle: number, r: number) {
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  }
}

function pts(cx: number, cy: number, axes: RadarWeight[], rMax: number, useWeight: boolean) {
  return axes
    .map(ax => {
      const raw  = useWeight ? ax.weight : ax.score
      const val  = Math.max(0, Math.min(10, raw ?? 0))   // clamp [0,10]
      const frac = val / 10
      const p    = polar(cx, cy, ax.angle, frac * rMax)
      return `${p.x},${p.y}`
    })
    .join(" ")
}

// ── Score row component ───────────────────────────────────────────────────────

function ScoreBar({ label, value, max = 10, color }: { label: string; value: number; max?: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-400 w-36 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] font-bold w-6 text-right" style={{ color }}>{value.toFixed(1)}</span>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function RadarRatings({ ratings, playerName, teamName }: Props) {

  // Initial axes — weight start at 5 (neutral), scores from API
  const [axes, setAxes] = useState<RadarWeight[]>([
    {
      key: "pass", label: "Pases", color: "#3b82f6",
      weight: 5, score: ratings.passes.pass_score,
      angle: -Math.PI / 2,                    // top
    },
    {
      key: "duel", label: "Duelos", color: "#f97316",
      weight: 5, score: ratings.duels.duel_score,
      angle: -Math.PI / 2 + (2 * Math.PI) / 3,
    },
    {
      key: "shot", label: "Tiros", color: "#ef4444",
      weight: 5, score: ratings.shots.shot_score,
      angle: -Math.PI / 2 + (4 * Math.PI) / 3,
    },
  ])

  // Keep scores in sync when ratings prop changes
  const latestRatings = useRef(ratings)
  latestRatings.current = ratings

  // Weighted overall score
  const overallScore = useMemo(() => {
    const totalW = axes.reduce((s, a) => s + a.weight, 0)
    if (totalW === 0) return 0
    return axes.reduce((s, a) => s + a.weight * a.score, 0) / totalW
  }, [axes])

  // ── Drag interaction on weight radar ─────────────────────────────────────────
  const svgRef = useRef<SVGSVGElement>(null)
  const dragging = useRef<string | null>(null)

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragging.current || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const mx   = e.clientX - rect.left
    const my   = e.clientY - rect.top
    const dx   = mx - CX
    const dy   = my - CY
    const dist = Math.sqrt(dx * dx + dy * dy)
    const raw  = Math.min(dist / R_MAX * 10, 10)
    const val  = Math.round(raw * 2) / 2   // snap to 0.5

    setAxes(prev =>
      prev.map(ax => ax.key === dragging.current ? { ...ax, weight: val } : ax)
    )
  }, [])

  const stopDrag = useCallback(() => { dragging.current = null }, [])

  // ── Render ────────────────────────────────────────────────────────────────────

  const { passes, duels, shots } = ratings

  const scoreColor = (v: number) =>
    v >= 7 ? "#22c55e" : v >= 4 ? "#f59e0b" : "#ef4444"

  const overallColor = scoreColor(overallScore)

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-4">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">
            Análisis de Rendimiento
            {playerName && <span className="text-amber-400 ml-2 font-normal">· {playerName}</span>}
          </h3>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Scores objetivos basados en Evers et al. (2024) · Arrastra el radar de pesos para personalizar
          </p>
        </div>
        {/* Overall badge */}
        <div className="flex flex-col items-center bg-slate-900 border border-slate-600 rounded-xl px-4 py-2 flex-shrink-0">
          <span className="text-[9px] text-slate-500 uppercase tracking-widest">Score global</span>
          <span className="text-3xl font-black" style={{ color: overallColor }}>
            {overallScore.toFixed(1)}
          </span>
          <span className="text-[9px] text-slate-500">/ 10</span>
        </div>
      </div>

      {/* ── Three score blocks ── */}
      <div className="grid grid-cols-3 gap-3">

        {/* PASES */}
        <div className="bg-slate-900 border border-blue-900/60 rounded-xl p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wide">Pases</span>
            <span className="ml-auto text-lg font-black" style={{ color: scoreColor(passes.pass_score) }}>
              {passes.pass_score.toFixed(1)}
            </span>
          </div>
          <ScoreBar label="Precisión" value={passes.completion_rate} color="#3b82f6" />
          <ScoreBar label="Bajo presión" value={passes.pressure_rating} color="#60a5fa" />
          <ScoreBar label="Dirección ofensiva" value={passes.direction_score} color="#93c5fd" />
          <ScoreBar label="Longitud media" value={passes.length_score} color="#bfdbfe" />
          <div className="pt-1.5 border-t border-slate-700 grid grid-cols-3 text-center text-[9px] text-slate-500">
            <div><div className="font-bold text-white text-sm">{passes.total}</div>total</div>
            <div><div className="font-bold text-green-400 text-sm">{passes.completed}</div>complet.</div>
            <div><div className="font-bold text-purple-400 text-sm">{passes.special_passes}</div>especial.</div>
          </div>
        </div>

        {/* DUELOS */}
        <div className="bg-slate-900 border border-orange-900/60 rounded-xl p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            <span className="text-[11px] font-bold text-orange-400 uppercase tracking-wide">Duelos</span>
            <span className="ml-auto text-lg font-black" style={{ color: scoreColor(duels.duel_score) }}>
              {duels.duel_score.toFixed(1)}
            </span>
          </div>
          <ScoreBar label="% Ganados" value={duels.win_rate} color="#f97316" />
          <ScoreBar label="Presión recibida" value={duels.pressure_rating} color="#fb923c" />
          <ScoreBar label="Zona del campo" value={duels.area_score} color="#fdba74" />
          <div className="pt-1.5 border-t border-slate-700 grid grid-cols-3 text-center text-[9px] text-slate-500">
            <div><div className="font-bold text-white text-sm">{duels.total}</div>total</div>
            <div><div className="font-bold text-green-400 text-sm">{duels.won}</div>ganados</div>
            <div><div className="font-bold text-red-400 text-sm">{duels.total - duels.won}</div>perdidos</div>
          </div>
        </div>

        {/* TIROS */}
        <div className="bg-slate-900 border border-red-900/60 rounded-xl p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-[11px] font-bold text-red-400 uppercase tracking-wide">Tiros</span>
            <span className="ml-auto text-lg font-black" style={{ color: scoreColor(shots.shot_score) }}>
              {shots.shot_score.toFixed(1)}
            </span>
          </div>
          <ScoreBar label="Precisión (en puerta)" value={shots.shot_accuracy} color="#ef4444" />
          <ScoreBar label="xG promedio" value={shots.xg_score} color="#f87171" />
          <div className="pt-1.5 border-t border-slate-700 grid grid-cols-3 text-center text-[9px] text-slate-500">
            <div><div className="font-bold text-white text-sm">{shots.total}</div>total</div>
            <div><div className="font-bold text-amber-400 text-sm">{shots.on_target}</div>en puerta</div>
            <div><div className="font-bold text-green-400 text-sm">{shots.goals}</div>goles</div>
          </div>
        </div>
      </div>

      {/* ── Radar chart (weights) + explanation ── */}
      <div className="flex gap-4 items-start border-t border-slate-700 pt-4">

        {/* Weight radar */}
        <div className="flex-shrink-0">
          <p className="text-[9px] text-slate-500 text-center mb-1 uppercase tracking-widest">
            Ajusta los pesos (arrastra)
          </p>
          <svg
            ref={svgRef}
            width={SVG_W}
            height={SVG_H}
            className="cursor-crosshair"
            onMouseMove={handleMouseMove}
            onMouseUp={stopDrag}
            onMouseLeave={stopDrag}
          >
            {/* Background rings */}
            {RINGS.map(v => (
              <polygon
                key={v}
                points={axes.map(ax => {
                  const p = polar(CX, CY, ax.angle, (v / 10) * R_MAX)
                  return `${p.x},${p.y}`
                }).join(" ")}
                fill="none"
                stroke="#334155"
                strokeWidth={v === 10 ? 1.5 : 0.8}
              />
            ))}

            {/* Spokes */}
            {axes.map(ax => {
              const outer = polar(CX, CY, ax.angle, R_MAX)
              return (
                <line key={ax.key}
                  x1={CX} y1={CY} x2={outer.x} y2={outer.y}
                  stroke="#334155" strokeWidth={1} />
              )
            })}

            {/* Score polygon (semi-transparent fill) */}
            <polygon
              points={pts(CX, CY, axes, R_MAX, false)}
              fill="rgba(100,116,139,0.15)"
              stroke="#64748b"
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />

            {/* Weight polygon (interactive) */}
            <polygon
              points={pts(CX, CY, axes, R_MAX, true)}
              fill="rgba(251,191,36,0.12)"
              stroke="#f59e0b"
              strokeWidth={2}
            />

            {/* Draggable weight nodes */}
            {axes.map(ax => {
              const p = polar(CX, CY, ax.angle, (ax.weight / 10) * R_MAX)
              return (
                <circle
                  key={ax.key}
                  cx={p.x} cy={p.y} r={7}
                  fill={ax.color}
                  stroke="#fff"
                  strokeWidth={1.5}
                  className="cursor-grab active:cursor-grabbing"
                  onMouseDown={() => { dragging.current = ax.key }}
                />
              )
            })}

            {/* Score dots */}
            {axes.map(ax => {
              const p = polar(CX, CY, ax.angle, (ax.score / 10) * R_MAX)
              return (
                <circle key={`score-${ax.key}`}
                  cx={p.x} cy={p.y} r={4}
                  fill={ax.color} fillOpacity={0.4}
                  stroke={ax.color} strokeWidth={1}
                />
              )
            })}

            {/* Axis labels */}
            {axes.map(ax => {
              const labelR = R_MAX + 14
              const p = polar(CX, CY, ax.angle, labelR)
              return (
                <g key={`lbl-${ax.key}`}>
                  <text
                    x={p.x} y={p.y + 4}
                    textAnchor="middle"
                    fontSize={9} fontWeight={700}
                    fill={ax.color}
                  >
                    {ax.label}
                  </text>
                  <text
                    x={p.x} y={p.y + 13}
                    textAnchor="middle"
                    fontSize={8}
                    fill="#94a3b8"
                  >
                    w={ax.weight.toFixed(1)} s={ax.score.toFixed(1)}
                  </text>
                </g>
              )
            })}

            {/* Ring value labels (right side) */}
            {RINGS.map(v => {
              const p = polar(CX, CY, 0, (v / 10) * R_MAX)
              return (
                <text key={`rv-${v}`} x={p.x + 3} y={p.y + 3}
                  fontSize={7} fill="#475569">{v}</text>
              )
            })}
          </svg>
        </div>

        {/* Explanation */}
        <div className="flex-1 space-y-2 text-[10px] text-slate-400">
          <p className="font-semibold text-slate-300 text-[11px]">
            ¿Cómo interpretar?
          </p>
          <p>
            <span className="text-amber-400 font-medium">Polígono dorado</span> = pesos que tú asignas
            (arrastra los puntos del radar). Permite adaptar la importancia según la posición del jugador.
          </p>
          <p>
            <span className="text-slate-500 font-medium">Polígono gris punteado</span> = scores reales
            del jugador basados en datos del partido.
          </p>
          <p>
            El <span className="text-white font-medium">score global</span> se recalcula como la media
            ponderada: <code className="text-amber-300 bg-slate-900 px-1 rounded">
              (w_p·S_p + w_d·S_d + w_s·S_s) / (w_p+w_d+w_s)
            </code>
          </p>
          <div className="mt-2 space-y-1 border-t border-slate-700 pt-2">
            {axes.map(ax => (
              <div key={ax.key} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ax.color }} />
                <span style={{ color: ax.color }} className="font-medium w-14">{ax.label}</span>
                <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${ax.score * 10}%`, background: ax.color }} />
                </div>
                <span className="font-bold w-5 text-right" style={{ color: scoreColor(ax.score) }}>
                  {ax.score.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
          {/* Reset button */}
          <button
            onClick={() => setAxes(prev => prev.map(ax => ({ ...ax, weight: 5 })))}
            className="mt-2 text-[10px] text-slate-500 hover:text-slate-300 transition-colors underline"
          >
            Restablecer pesos a 5
          </button>
        </div>
      </div>
    </div>
  )
}
