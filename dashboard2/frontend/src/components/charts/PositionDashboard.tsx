"use client"

/**
 * PositionDashboard — Resumen de patrones por posición táctica
 *
 * Muestra para cada posición del partido:
 *   - Mini radar pentagonal (5 ejes: Precisión Pases · Dirección · Duelos ganados · Tiros en puerta · Presión)
 *   - Barras de score
 *   - Jugadores en esa posición
 *   - Comparativa entre grupos posicionales (Portero / Defensa / Centrocampista / Delantero)
 *
 * Permite identificar patrones tácticos: ¿quiénes reciben más presión?
 * ¿quiénes hacen más pases ofensivos? ¿quiénes ganan más duelos?
 */

import { useState, useMemo } from "react"
import type { PositionPattern } from "@/lib/types"

interface Props {
  positions: PositionPattern[]
}

// ── Geometry ──────────────────────────────────────────────────────────────────

const R_MINI  = 38
const CX_MINI = 50
const CY_MINI = 50
const W_MINI  = 100
const H_MINI  = 100

function polarMini(angle: number, r: number) {
  return { x: CX_MINI + r * Math.cos(angle), y: CY_MINI + r * Math.sin(angle) }
}

const PENTAGON_ANGLES = Array.from({ length: 5 }, (_, i) =>
  -Math.PI / 2 + (2 * Math.PI / 5) * i
)

const PENTAGON_LABELS = [
  "Precisión",
  "Dirección",
  "Duelos",
  "Tiros",
  "Bajo presión",
]

// Group colours
const GROUP_COLORS: Record<string, string> = {
  "Portero":         "#8b5cf6",
  "Defensa":         "#3b82f6",
  "Centrocampista":  "#22c55e",
  "Delantero":       "#ef4444",
  "Otro":            "#64748b",
}

function MiniRadar({ pos, selected }: { pos: PositionPattern; selected: boolean }) {
  const values = [
    pos.completion_score,
    pos.direction_score,
    pos.duel_score,
    pos.shot_score,
    pos.pressure_score,
  ]
  const color = GROUP_COLORS[pos.position_group] ?? "#64748b"

  const polyPoints = PENTAGON_ANGLES.map((angle, i) => {
    const v = (values[i] ?? 0) / 10
    const p = polarMini(angle, v * R_MINI)
    return `${p.x},${p.y}`
  }).join(" ")

  const ringPoints = (v: number) => PENTAGON_ANGLES.map(angle => {
    const p = polarMini(angle, (v / 10) * R_MINI)
    return `${p.x},${p.y}`
  }).join(" ")

  return (
    <svg width={W_MINI} height={H_MINI} className="overflow-visible">
      {/* Rings */}
      {[2, 4, 6, 8, 10].map(v => (
        <polygon key={v} points={ringPoints(v)}
          fill="none"
          stroke={v === 10 ? "#334155" : "#1e293b"}
          strokeWidth={v === 10 ? 1 : 0.6}
        />
      ))}
      {/* Spokes */}
      {PENTAGON_ANGLES.map((angle, i) => {
        const outer = polarMini(angle, R_MINI)
        return <line key={i} x1={CX_MINI} y1={CY_MINI} x2={outer.x} y2={outer.y}
          stroke="#1e293b" strokeWidth={0.8} />
      })}
      {/* Score polygon */}
      <polygon points={polyPoints}
        fill={`${color}25`}
        stroke={color}
        strokeWidth={selected ? 2 : 1.5}
      />
      {/* Dots */}
      {PENTAGON_ANGLES.map((angle, i) => {
        const v = (values[i] ?? 0) / 10
        const p = polarMini(angle, v * R_MINI)
        return <circle key={i} cx={p.x} cy={p.y} r={2.5}
          fill={color} />
      })}
      {/* Center score */}
      <text x={CX_MINI} y={CY_MINI + 4}
        textAnchor="middle" fontSize={9} fontWeight={700}
        fill={color}>
        {pos.overall_score.toFixed(1)}
      </text>
    </svg>
  )
}

// ── Group summary card ────────────────────────────────────────────────────────

function GroupCard({ group, positions }: { group: string; positions: PositionPattern[] }) {
  const color = GROUP_COLORS[group] ?? "#64748b"
  if (positions.length === 0) return null

  const avg = (key: keyof PositionPattern) => {
    const vals = positions.map(p => p[key] as number).filter(v => typeof v === "number")
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  }

  const scores = [
    { label: "Precisión pases", v: avg("completion_score") },
    { label: "Dirección ofensiva", v: avg("direction_score") },
    { label: "Duelos ganados",  v: avg("duel_score") },
    { label: "Tiros en puerta", v: avg("shot_score") },
    { label: "Bajo presión",    v: avg("pressure_score") },
  ]

  const overallAvg = avg("overall_score")
  const overallColor = overallAvg >= 7 ? "#22c55e" : overallAvg >= 4 ? "#f59e0b" : "#ef4444"

  return (
    <div className="bg-slate-900 border rounded-xl p-3 space-y-2"
      style={{ borderColor: `${color}40` }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
          <span className="font-bold text-[11px]" style={{ color }}>{group}</span>
          <span className="text-[9px] text-slate-500">({positions.length} pos.)</span>
        </div>
        <span className="text-lg font-black" style={{ color: overallColor }}>
          {overallAvg.toFixed(1)}
        </span>
      </div>

      {scores.map(s => (
        <div key={s.label} className="flex items-center gap-2">
          <span className="text-[9px] text-slate-500 w-28 flex-shrink-0">{s.label}</span>
          <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${s.v*10}%`, background: color }} />
          </div>
          <span className="text-[9px] font-bold w-5 text-right" style={{ color }}>
            {s.v.toFixed(1)}
          </span>
        </div>
      ))}

      <div className="text-[9px] text-slate-600 pt-1 border-t border-slate-800">
        Posiciones: {positions.map(p => p.position_name).join(" · ")}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function PositionDashboard({ positions }: Props) {
  const [selectedPos, setSelectedPos] = useState<string | null>(null)
  const [groupFilter, setGroupFilter] = useState<string>("Todos")

  const groups = useMemo(() => {
    const g = new Set(positions.map(p => p.position_group))
    return ["Todos", ...Array.from(g)]
  }, [positions])

  const filtered = useMemo(() => {
    if (groupFilter === "Todos") return positions
    return positions.filter(p => p.position_group === groupFilter)
  }, [positions, groupFilter])

  // Group aggregates
  const byGroup = useMemo(() => {
    const m: Record<string, PositionPattern[]> = {}
    for (const p of positions) {
      if (!m[p.position_group]) m[p.position_group] = []
      m[p.position_group].push(p)
    }
    return m
  }, [positions])

  const selected = positions.find(p => p.position_name === selectedPos)

  if (positions.length === 0) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center text-slate-500 text-sm">
        No hay datos de posiciones disponibles para este partido
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-white">Patrones por Posición</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {positions.length} posiciones · Radar pentagonal: Precisión · Dirección · Duelos · Tiros · Presión
            </p>
          </div>

          {/* Group filter */}
          <div className="flex gap-1">
            {groups.map(g => (
              <button key={g}
                onClick={() => setGroupFilter(g)}
                className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all border ${
                  groupFilter === g
                    ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                    : "bg-slate-700 border-slate-600 text-slate-500 hover:text-slate-300"
                }`}>
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Axis legend */}
        <div className="flex gap-3 text-[9px] text-slate-500">
          {PENTAGON_LABELS.map((l, i) => (
            <span key={l} className="flex items-center gap-1">
              <span className="font-bold text-slate-400">{i+1}</span>
              {l}
            </span>
          ))}
        </div>
      </div>

      {/* ── Grid of position mini-radars ── */}
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
        {filtered
          .sort((a, b) => b.overall_score - a.overall_score)
          .map(pos => {
            const isSel = selectedPos === pos.position_name
            const color = GROUP_COLORS[pos.position_group] ?? "#64748b"

            return (
              <button
                key={pos.position_name}
                onClick={() => setSelectedPos(isSel ? null : pos.position_name)}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all text-left ${
                  isSel
                    ? "border-amber-500/60 bg-amber-500/10"
                    : "border-slate-700 bg-slate-900 hover:border-slate-600"
                }`}
              >
                {/* Group color dot */}
                <div className="flex items-center gap-1.5 w-full">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                  <span className="text-[9px] text-slate-500 truncate flex-1">{pos.position_group}</span>
                  <span className="text-[9px] font-bold" style={{
                    color: pos.overall_score >= 7 ? "#22c55e" : pos.overall_score >= 4 ? "#f59e0b" : "#ef4444"
                  }}>{pos.overall_score.toFixed(1)}</span>
                </div>

                <MiniRadar pos={pos} selected={isSel} />

                <span className="text-[9px] font-semibold text-center leading-tight" style={{ color }}>
                  {pos.position_name}
                </span>
                <span className="text-[8px] text-slate-600 text-center">
                  {pos.n_players} jugador{pos.n_players !== 1 ? "es" : ""}
                </span>
              </button>
            )
          })}
      </div>

      {/* ── Selected position detail ── */}
      {selected && (
        <div className="bg-slate-800 border border-amber-500/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-white text-sm">{selected.position_name}</h4>
              <p className="text-[10px] text-slate-500">
                {selected.n_players} jugador{selected.n_players !== 1 ? "es" : ""} ·
                {selected.player_names.join(", ")}
                {selected.n_players > 3 ? "…" : ""}
              </p>
            </div>
            <button onClick={() => setSelectedPos(null)}
              className="text-slate-500 hover:text-white text-xs">✕</button>
          </div>

          <div className="grid grid-cols-3 gap-3 text-[10px]">
            {/* Pases */}
            <div className="bg-slate-900 border border-blue-900/50 rounded-xl p-3 space-y-1.5">
              <div className="font-bold text-blue-400 text-[11px] mb-2">Pases</div>
              <Metric label="Total"        value={String(selected.total_passes)} />
              <Metric label="Completados"  value={`${selected.completed_passes} (${selected.total_passes ? ((selected.completed_passes/selected.total_passes)*100).toFixed(0) : 0}%)`} />
              <Metric label="Precisión"    value={selected.completion_score.toFixed(1)} unit="/10" color="#3b82f6" />
              <Metric label="Dirección of." value={selected.direction_score.toFixed(1)} unit="/10" color="#60a5fa" />
              <Metric label="Longitud"     value={selected.length_score.toFixed(1)} unit="/10" />
              <Metric label="Especiales"   value={String(selected.special_passes)} />
            </div>

            {/* Duelos */}
            <div className="bg-slate-900 border border-orange-900/50 rounded-xl p-3 space-y-1.5">
              <div className="font-bold text-orange-400 text-[11px] mb-2">Duelos</div>
              <Metric label="Total"       value={String(selected.total_duels)} />
              <Metric label="Ganados"     value={`${selected.won_duels} (${selected.total_duels ? ((selected.won_duels/selected.total_duels)*100).toFixed(0) : 0}%)`} />
              <Metric label="Score"       value={selected.duel_score.toFixed(1)} unit="/10" color="#f97316" />
              <Metric label="Bajo presión" value={`${selected.pressure_score.toFixed(1)}/10`} color="#fb923c" />
            </div>

            {/* Tiros */}
            <div className="bg-slate-900 border border-red-900/50 rounded-xl p-3 space-y-1.5">
              <div className="font-bold text-red-400 text-[11px] mb-2">Tiros</div>
              <Metric label="Total"       value={String(selected.total_shots)} />
              <Metric label="En puerta"   value={String(selected.on_target)} />
              <Metric label="Goles"       value={String(selected.goals)} color="#22c55e" />
              <Metric label="Precisión"   value={selected.shot_accuracy.toFixed(1)} unit="/10" color="#ef4444" />
              <Metric label="xG score"    value={selected.xg_score.toFixed(1)} unit="/10" />
            </div>
          </div>
        </div>
      )}

      {/* ── Group summary cards ── */}
      <div className="grid grid-cols-2 gap-3">
        {Object.entries(byGroup).map(([group, pos]) => (
          <GroupCard key={group} group={group} positions={pos} />
        ))}
      </div>
    </div>
  )
}

function Metric({ label, value, unit, color }: { label: string; value: string; unit?: string; color?: string }) {
  return (
    <div className="flex justify-between gap-1">
      <span className="text-slate-500">{label}</span>
      <span style={{ color: color ?? "#e2e8f0" }} className="font-semibold">
        {value}{unit && <span className="text-slate-600 text-[9px]">{unit}</span>}
      </span>
    </div>
  )
}
