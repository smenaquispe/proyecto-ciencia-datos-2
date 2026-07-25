"use client"

/**
 * PlayerRanking — Comparativa de todos los jugadores del partido (Evers et al. 2024, Fig. 4)
 *
 * Barra chart horizontal ordenado de menor a mayor overall_score.
 * - Color azul: equipo local
 * - Color rojo: equipo visitante
 * - Color ámbar: jugador seleccionado
 *
 * Tooltip al hover muestra breakdown de pases/duelos/tiros.
 */

import { useState, useMemo } from "react"
import type { PlayerRankingEntry } from "@/lib/types"

interface Props {
  players: PlayerRankingEntry[]
  selectedPlayerId?: number | null
  homeTeamId?: number
  /** Callback al hacer clic en un jugador de la lista */
  onSelectPlayer?: (p: PlayerRankingEntry) => void
}

const BAR_H    = 16    // height of each bar row (px)
const LABEL_W  = 130   // width reserved for player name
const VALUE_W  = 36    // width for score number on right
const MAX_BAR  = 340   // max bar width (px)
const SCORE_MAX = 10

export default function PlayerRanking({ players, selectedPlayerId, homeTeamId, onSelectPlayer }: Props) {
  const [hovered, setHovered] = useState<PlayerRankingEntry | null>(null)
  const [showType, setShowType] = useState<"overall" | "pass" | "duel" | "shot">("overall")

  // Ordenar de mayor a menor para mostrar el mejor arriba
  const sorted = useMemo(
    () => [...players].sort((a, b) => {
      const va = showType === "overall" ? a.overall_score
        : showType === "pass" ? a.pass_score
        : showType === "duel" ? a.duel_score
        : a.shot_score
      const vb = showType === "overall" ? b.overall_score
        : showType === "pass" ? b.pass_score
        : showType === "duel" ? b.duel_score
        : b.shot_score
      return vb - va
    }),
    [players, showType]
  )

  if (players.length === 0) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center justify-center h-40 text-slate-500 text-sm">
        Cargando ranking del partido…
      </div>
    )
  }

  const getScore = (p: PlayerRankingEntry) =>
    showType === "overall" ? p.overall_score
    : showType === "pass" ? p.pass_score
    : showType === "duel" ? p.duel_score
    : p.shot_score

  const getBarColor = (p: PlayerRankingEntry) => {
    if (p.player_id === selectedPlayerId) return "#f59e0b"   // amber: seleccionado
    if (p.team_id === homeTeamId)         return "#3b82f6"   // blue: local
    return                                       "#f87171"   // red: visitante
  }

  const totalW = LABEL_W + MAX_BAR + VALUE_W + 24
  const svgH   = sorted.length * (BAR_H + 4) + 10

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-bold text-white">Ranking de Jugadores</h3>
          <p className="text-[10px] text-slate-500">
            {players.length} jugadores · Partido completo · Haz clic para seleccionar
          </p>
        </div>

        {/* Score type selector */}
        <div className="flex gap-1">
          {(["overall", "pass", "duel", "shot"] as const).map(t => (
            <button key={t}
              onClick={() => setShowType(t)}
              className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-all border ${
                showType === t
                  ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                  : "bg-slate-700 border-slate-600 text-slate-500 hover:text-slate-300"
              }`}>
              {{ overall: "Global", pass: "Pases", duel: "Duelos", shot: "Tiros" }[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-3 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 rounded-sm bg-blue-500 inline-block" />Equipo local
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 rounded-sm bg-red-400 inline-block" />Equipo visitante
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 rounded-sm bg-amber-400 inline-block" />Jugador seleccionado
        </span>
      </div>

      {/* Chart — scrollable */}
      <div className="overflow-y-auto" style={{ maxHeight: 420 }}>
        <svg width={totalW} height={svgH} style={{ overflow: "visible", minWidth: totalW }}>
          {sorted.map((p, i) => {
            const score    = getScore(p)
            const barW     = (score / SCORE_MAX) * MAX_BAR
            const y        = i * (BAR_H + 4) + 2
            const barColor = getBarColor(p)
            const isSel    = p.player_id === selectedPlayerId
            const isHov    = hovered?.player_id === p.player_id

            return (
              <g key={p.player_id}
                onClick={() => onSelectPlayer?.(p)}
                onMouseEnter={() => setHovered(p)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: onSelectPlayer ? "pointer" : "default" }}
              >
                {/* Row background on hover */}
                {(isHov || isSel) && (
                  <rect x={0} y={y - 1} width={totalW} height={BAR_H + 2}
                    fill={isSel ? "rgba(251,191,36,0.08)" : "rgba(255,255,255,0.04)"}
                    rx={3} />
                )}

                {/* Player name */}
                <text
                  x={LABEL_W - 4} y={y + BAR_H * 0.72}
                  textAnchor="end"
                  fontSize={isSel ? 10 : 9}
                  fontWeight={isSel ? 700 : 400}
                  fill={isSel ? "#f59e0b" : isHov ? "#e2e8f0" : "#94a3b8"}
                >
                  {p.player_name.length > 18 ? p.player_name.slice(0, 17) + "…" : p.player_name}
                </text>

                {/* Bar track */}
                <rect x={LABEL_W} y={y + 3} width={MAX_BAR} height={BAR_H - 6}
                  fill="#1e293b" rx={3} />

                {/* Bar fill */}
                <rect x={LABEL_W} y={y + 3} width={barW} height={BAR_H - 6}
                  fill={barColor}
                  fillOpacity={isSel ? 1 : isHov ? 0.85 : 0.65}
                  rx={3}
                />

                {/* Score value */}
                <text
                  x={LABEL_W + MAX_BAR + 6} y={y + BAR_H * 0.72}
                  fontSize={isSel ? 10 : 9}
                  fontWeight={isSel ? 700 : 500}
                  fill={isSel ? "#f59e0b" : "#64748b"}
                >
                  {score.toFixed(1)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Tooltip */}
      {hovered && (
        <div className="bg-slate-900 border border-slate-600 rounded-xl p-3 text-xs space-y-1.5">
          <div className="font-bold text-white border-b border-slate-700 pb-1">
            {hovered.player_name}
            <span className="text-slate-500 font-normal ml-2 text-[10px]">{hovered.team_name}</span>
          </div>
          <div className="grid grid-cols-4 gap-3 text-center">
            {[
              { l: "Global",  v: hovered.overall_score, c: "#f59e0b" },
              { l: "Pases",   v: hovered.pass_score,    c: "#3b82f6" },
              { l: "Duelos",  v: hovered.duel_score,    c: "#f97316" },
              { l: "Tiros",   v: hovered.shot_score,    c: "#ef4444" },
            ].map(s => (
              <div key={s.l} className="bg-slate-800 rounded-lg p-1.5">
                <div className="font-bold text-base" style={{ color: s.c }}>{s.v.toFixed(1)}</div>
                <div className="text-[9px] text-slate-500">{s.l}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-400">
            <span>Pases: <b className="text-white">{hovered.completed_passes}/{hovered.total_passes}</b></span>
            <span>Duelos: <b className="text-white">{hovered.won_duels}/{hovered.total_duels}</b></span>
            <span>Tiros: <b className="text-white">{hovered.on_target}/{hovered.total_shots}</b></span>
          </div>
        </div>
      )}
    </div>
  )
}
