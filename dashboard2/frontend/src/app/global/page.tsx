"use client"

/**
 * GlobalPlayerDashboard — /global
 *
 * Dashboard completo de análisis histórico de jugadores en toda la base de datos.
 *
 * Funcionalidades:
 *   1. Selector de posición + buscador de jugadores
 *   2. Ranking de los mejores jugadores por posición (goles/partido, pases, etc.)
 *   3. Perfil detallado de un jugador seleccionado:
 *      - Radar pentagonal vs media de posición
 *      - Heatmap de presencia en el campo (todos los partidos)
 *      - Mapa de tiros (origen + outcome)
 *      - Mapa de pases que llevan a gol
 *      - Estadísticas comparativas vs media de posición
 */

import { useState, useEffect, useCallback, useMemo } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { api } from "@/lib/api"
import type { GlobalPlayerStat, PositionAverage, GlobalPlayerProfile } from "@/lib/types"

// Dynamic imports to avoid SSR issues with SVG
const PlayerRadarVsAvg   = dynamic(() => import("@/components/charts/PlayerRadarVsAvg"),  { ssr: false, loading: () => <Sk h={300} /> })
const GlobalHeatmap      = dynamic(() => import("@/components/charts/GlobalHeatmap"),     { ssr: false, loading: () => <Sk h={280} /> })
const GlobalShotMap      = dynamic(() => import("@/components/charts/GlobalShotMap"),     { ssr: false, loading: () => <Sk h={280} /> })
const GlobalAssistMap    = dynamic(() => import("@/components/charts/GlobalAssistMap"),   { ssr: false, loading: () => <Sk h={280} /> })

function Sk({ h }: { h: number }) {
  return <div className="w-full rounded-xl bg-slate-800 animate-pulse" style={{ height: h }} />
}

// 9 grupos tácticos granulares que mapean las 25 subposiciones de StatsBomb
const POSITION_GROUPS = [
  "Todos",
  "Delantero",
  "Extremo",
  "MF Atacante",
  "MF Central",
  "MF Defensivo",
  "Lateral",
  "Defensa Central",
  "Portero",
]

const GROUP_COLORS: Record<string, string> = {
  "Delantero":      "#ef4444",   // rojo
  "Extremo":        "#f97316",   // naranja
  "MF Atacante":    "#eab308",   // amarillo
  "MF Central":     "#22c55e",   // verde
  "MF Defensivo":   "#14b8a6",   // teal
  "Lateral":        "#3b82f6",   // azul
  "Defensa Central":"#6366f1",   // indigo
  "Portero":        "#8b5cf6",   // violeta
  "Todos":          "#f59e0b",
}

// Subposiciones que pertenecen a cada grupo (para mostrar en UI)
const GROUP_SUBPOSITIONS: Record<string, string[]> = {
  "Portero":         ["Goalkeeper"],
  "Defensa Central": ["Center Back", "Left Center Back", "Right Center Back"],
  "Lateral":         ["Left Back", "Right Back", "Left Wing Back", "Right Wing Back"],
  "MF Defensivo":    ["Center Defensive Midfield", "Left Defensive Midfield", "Right Defensive Midfield"],
  "MF Central":      ["Center Midfield", "Left Center Midfield", "Right Center Midfield"],
  "MF Atacante":     ["Center Attacking Midfield", "Left Attacking Midfield", "Right Attacking Midfield"],
  "Extremo":         ["Left Wing", "Right Wing", "Left Midfield", "Right Midfield"],
  "Delantero":       ["Center Forward", "Left Center Forward", "Right Center Forward", "Secondary Striker"],
}

// Qué métrica es más relevante por grupo (para mostrar en el ranking)
const GROUP_SORT_LABEL: Record<string, string> = {
  "Portero":         "Pases/partido",
  "Defensa Central": "Precisión pases",
  "Lateral":         "Pases/partido",
  "MF Defensivo":    "Pases/partido",
  "MF Central":      "Pases/partido",
  "MF Atacante":     "Goles/partido",
  "Extremo":         "Regates/partido",
  "Delantero":       "Goles/partido",
  "Todos":           "Goles/partido",
}

// ── Comparison bar ─────────────────────────────────────────────────────────────
function CompareBar({
  label, playerVal, avgVal, unit = "", color,
}: { label: string; playerVal: number; avgVal: number; unit?: string; color: string }) {
  const maxVal  = Math.max(playerVal, avgVal, 0.001)
  const pPct    = Math.min((playerVal / maxVal) * 100, 100)
  const aPct    = Math.min((avgVal    / maxVal) * 100, 100)
  const better  = playerVal >= avgVal

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-slate-400">{label}</span>
        <div className="flex items-center gap-2">
          <span style={{ color }} className="font-bold">{playerVal.toFixed(2)}{unit}</span>
          <span className="text-slate-600">vs</span>
          <span className="text-slate-500">{avgVal.toFixed(2)}{unit}</span>
          <span className={better ? "text-green-400 text-[9px]" : "text-red-400 text-[9px]"}>
            {better ? "▲" : "▼"}
          </span>
        </div>
      </div>
      <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
        {/* Average line */}
        <div className="absolute h-full bg-slate-600/50 rounded-full" style={{ width: `${aPct}%` }} />
        {/* Player bar */}
        <div className="absolute h-full rounded-full transition-all duration-500"
          style={{ width: `${pPct}%`, background: color, opacity: 0.85 }} />
      </div>
    </div>
  )
}

// ── Mini stat card ─────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 text-center">
      <div className="text-xl font-black" style={{ color }}>{value}</div>
      <div className="text-[10px] text-slate-400 mt-0.5">{label}</div>
      {sub && <div className="text-[9px] text-slate-600">{sub}</div>}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function GlobalDashboard() {
  const [posGroup, setPosGroup]   = useState("Delantero")
  const [search, setSearch]       = useState("")
  const [players, setPlayers]     = useState<GlobalPlayerStat[]>([])
  const [posAvg, setPosAvg]       = useState<Record<string, PositionAverage>>({})
  const [loading, setLoading]     = useState(false)
  const [selected, setSelected]   = useState<GlobalPlayerStat | null>(null)
  const [profile, setProfile]     = useState<GlobalPlayerProfile | null>(null)
  const [profLoading, setProfLoad] = useState(false)

  // Default sort changes with position group
  const defaultSort: Record<string, "goals_pm"|"passes_pm"|"shots_pm"|"dribbles_pm"|"completion_pct"> = {
    "Portero":         "completion_pct",
    "Defensa Central": "completion_pct",
    "Lateral":         "passes_pm",
    "MF Defensivo":    "passes_pm",
    "MF Central":      "passes_pm",
    "MF Atacante":     "goals_pm",
    "Extremo":         "dribbles_pm",
    "Delantero":       "goals_pm",
    "Todos":           "goals_pm",
  }
  const [sortBy, setSortBy] = useState<"goals_pm"|"passes_pm"|"shots_pm"|"dribbles_pm"|"completion_pct">("goals_pm")

  // Reset sort when group changes
  useEffect(() => {
    setSortBy(defaultSort[posGroup] ?? "goals_pm")
  }, [posGroup]) // eslint-disable-line

  // Load ranking
  useEffect(() => {
    setLoading(true)
    api.globalPlayerStats({
      position_group: posGroup === "Todos" ? undefined : posGroup,
      min_matches: 3,
      limit: 50,
    })
      .then(d => { setPlayers(d.players); setPosAvg(d.position_averages) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [posGroup])

  // Load profile when player selected
  useEffect(() => {
    if (!selected) { setProfile(null); return }
    setProfLoad(true)
    api.globalPlayerProfile(selected.player_name)
      .then(d => setProfile(d.error ? null : d))
      .catch(() => setProfile(null))
      .finally(() => setProfLoad(false))
  }, [selected?.player_name])

  const filtered = useMemo(() => {
    let list = players
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p => p.player_name.toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => (b[sortBy] as number) - (a[sortBy] as number))
  }, [players, search, sortBy])

  const avgForGroup = posAvg[posGroup] ?? posAvg["Delantero"]
  const color = GROUP_COLORS[posGroup] ?? "#f59e0b"

  return (
    <div className="h-screen bg-slate-950 text-white flex flex-col overflow-hidden">

      {/* ── Topbar ── */}
      <header className="flex-shrink-0 bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center gap-4">
        <Link href="/" className="text-slate-500 hover:text-white transition-colors text-sm">
          ← Volver al Dashboard
        </Link>
        <div className="w-px h-4 bg-slate-700" />
        <h1 className="font-bold text-sm text-white">Análisis Global de Jugadores</h1>
        <span className="text-slate-500 text-[11px]">Toda la base de datos StatsBomb</span>
      </header>

      <div className="flex flex-1 min-h-0">

        {/* ── Left panel: ranking ── */}
        <aside className="w-80 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col min-h-0 overflow-hidden">

          {/* Position filter */}
          <div className="p-3 border-b border-slate-800 space-y-2.5">

            {/* Group buttons — 2 column grid for compactness */}
            <div className="grid grid-cols-2 gap-1">
              {POSITION_GROUPS.map(g => {
                const col = GROUP_COLORS[g] ?? "#64748b"
                return (
                  <button key={g} onClick={() => { setPosGroup(g); setSelected(null) }}
                    className={`px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-all border text-left flex items-center gap-1.5 ${
                      posGroup === g
                        ? "border-amber-500/60 bg-amber-500/10 text-amber-300"
                        : "border-slate-700 bg-slate-800/60 text-slate-500 hover:text-slate-300 hover:border-slate-600"
                    }`}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: posGroup === g ? "#f59e0b" : col }} />
                    {g}
                  </button>
                )
              })}
            </div>

            {/* Subpositions chip list for selected group */}
            {posGroup !== "Todos" && GROUP_SUBPOSITIONS[posGroup] && (
              <div className="flex flex-wrap gap-1">
                {GROUP_SUBPOSITIONS[posGroup].map(sub => (
                  <span key={sub}
                    className="px-1.5 py-0.5 rounded text-[9px] border border-slate-700 text-slate-500 bg-slate-900">
                    {sub}
                  </span>
                ))}
              </div>
            )}

            {/* Sort — auto-selected by group */}
            <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-[10px] rounded-md px-2 py-1.5">
              <option value="goals_pm">↓ Goles/partido</option>
              <option value="passes_pm">↓ Pases/partido</option>
              <option value="shots_pm">↓ Tiros/partido</option>
              <option value="dribbles_pm">↓ Regates/partido</option>
              <option value="completion_pct">↓ % Precisión pases</option>
            </select>

            {/* Search */}
            <input
              type="text"
              placeholder="Buscar jugador…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-[11px] rounded-md px-2.5 py-1.5 placeholder-slate-600 outline-none focus:border-amber-500/50"
            />
          </div>

          {/* Count label */}
          {!loading && filtered.length > 0 && (
            <div className="px-3 py-1.5 border-b border-slate-800 flex items-center justify-between">
              <span className="text-[9px] text-slate-600">{filtered.length} jugadores</span>
              <span className="text-[9px]" style={{ color }}>
                {GROUP_SORT_LABEL[posGroup] ?? "Goles/partido"}
              </span>
            </div>
          )}

          {/* Player list */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {loading && (
              <div className="p-4 text-center text-slate-500 text-xs animate-pulse">Cargando jugadores…</div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="p-6 text-center text-slate-600 text-xs">
                No se encontraron jugadores para esta posición / búsqueda.
              </div>
            )}
            {!loading && filtered.map((p, i) => {
              const isSel    = selected?.player_name === p.player_name
              const dotColor = GROUP_COLORS[p.position_group] ?? "#64748b"
              const metricVal =
                sortBy === "goals_pm"     ? `${p.goals_pm.toFixed(2)} goles/p`
                : sortBy === "passes_pm"  ? `${p.passes_pm.toFixed(0)} pases/p`
                : sortBy === "shots_pm"   ? `${p.shots_pm.toFixed(1)} tiros/p`
                : sortBy === "dribbles_pm"? `${p.dribbles_pm.toFixed(1)} reg/p`
                : `${p.completion_pct.toFixed(0)}%`
              return (
                <button key={`${p.player_name}-${p.position_name}`}
                  onClick={() => setSelected(isSel ? null : p)}
                  className={`w-full text-left px-3 py-2 border-b border-slate-800/40 transition-all flex items-center gap-2 ${
                    isSel
                      ? "bg-amber-500/10 border-l-2 border-l-amber-500"
                      : "hover:bg-slate-800/50"
                  }`}>
                  {/* Rank */}
                  <span className="text-[9px] text-slate-700 w-4 flex-shrink-0 text-right font-mono">{i + 1}</span>
                  {/* Group dot */}
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotColor }} />
                  {/* Name + subposition */}
                  <div className="flex-1 min-w-0">
                    <div className={`text-[11px] font-semibold truncate leading-tight ${isSel ? "text-amber-300" : "text-slate-200"}`}>
                      {p.player_name}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {/* Group badge */}
                      <span className="text-[8px] px-1 py-0 rounded" style={{
                        background: `${dotColor}20`, color: dotColor,
                        border: `1px solid ${dotColor}40`
                      }}>
                        {p.position_group}
                      </span>
                      {/* Exact subposition */}
                      <span className="text-[9px] text-slate-600 truncate">{p.position_name}</span>
                    </div>
                    <div className="text-[9px] text-slate-600">{p.matches} partidos</div>
                  </div>
                  {/* Key metric value */}
                  <span className="text-[10px] font-bold flex-shrink-0 text-right" style={{ color }}>
                    {metricVal}
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        {/* ── Main: player profile ── */}
        <main className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">

          {!selected && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-500">
              <div className="text-4xl">⚽</div>
              <p className="text-sm">Selecciona un jugador del panel izquierdo para ver su análisis completo</p>
              <div className="grid grid-cols-4 gap-3 mt-4 w-full max-w-2xl">
                {Object.entries(posAvg).map(([grp, avg]) => (
                  <div key={grp} className="bg-slate-900 border border-slate-700 rounded-xl p-3 text-center">
                    <div className="w-3 h-3 rounded-full mx-auto mb-1" style={{ background: GROUP_COLORS[grp] }} />
                    <div className="text-[10px] font-bold" style={{ color: GROUP_COLORS[grp] }}>{grp}</div>
                    <div className="text-[9px] text-slate-500 mt-1">
                      {avg.goals_pm.toFixed(2)} goles/p<br/>
                      {avg.passes_pm.toFixed(0)} pases/p
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selected && (
            <>
              {/* ── Player header ── */}
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-black text-white truncate">{selected.player_name}</h2>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {/* Tactical group badge */}
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border"
                      style={{
                        background: `${GROUP_COLORS[selected.position_group] ?? "#64748b"}20`,
                        color:       GROUP_COLORS[selected.position_group] ?? "#64748b",
                        borderColor: `${GROUP_COLORS[selected.position_group] ?? "#64748b"}40`,
                      }}>
                      {selected.position_group}
                    </span>
                    {/* Exact subposition */}
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 border border-slate-700 text-slate-400">
                      {selected.position_name}
                    </span>
                    <span className="text-[10px] text-slate-600">{selected.matches} partidos</span>
                    {/* Comparison note */}
                    <span className="text-[10px] text-slate-600 ml-auto">
                      Comparado vs {selected.position_name} en toda la BD
                    </span>
                  </div>
                </div>
                <button onClick={() => setSelected(null)}
                  className="text-slate-600 hover:text-white text-sm transition-colors flex-shrink-0">✕</button>
              </div>

              {/* ── Key stats grid ── */}
              <div className="grid grid-cols-6 gap-2">
                <StatCard label="Goles"          value={selected.goals}              color="#22c55e" />
                <StatCard label="Goles/partido"   value={selected.goals_pm.toFixed(2)} color="#22c55e" sub={`vs ${avgForGroup?.goals_pm?.toFixed(2) ?? "—"} avg`} />
                <StatCard label="Tiros/partido"   value={selected.shots_pm.toFixed(1)} color="#ef4444" sub={`vs ${avgForGroup?.shots_pm?.toFixed(1) ?? "—"} avg`} />
                <StatCard label="Pases/partido"   value={selected.passes_pm.toFixed(0)} color="#3b82f6" sub={`vs ${avgForGroup?.passes_pm?.toFixed(0) ?? "—"} avg`} />
                <StatCard label="% Precisión"     value={`${selected.completion_pct}%`} color="#60a5fa" sub={`vs ${avgForGroup?.completion_pct?.toFixed(0) ?? "—"}% avg`} />
                <StatCard label="Regates/partido" value={selected.dribbles_pm.toFixed(1)} color="#f97316" sub={`vs ${avgForGroup?.dribbles_pm?.toFixed(1) ?? "—"} avg`} />
              </div>

              {profLoading && (
                <div className="grid grid-cols-2 gap-4">
                  <Sk h={300} /><Sk h={300} /><Sk h={280} /><Sk h={280} />
                </div>
              )}

              {profile && !profLoading && (
                <>
                  {/* ── Row 1: Radar + Comparison bars ── */}
                  <div className="grid grid-cols-[380px_1fr] gap-4">
                    <PlayerRadarVsAvg
                      player={selected}
                      positionAvg={avgForGroup}
                      color={color}
                    />

                    {/* Comparison bars */}
                    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3">
                      <h3 className="text-[11px] font-bold text-white uppercase tracking-wide">
                        Comparativa vs Media de Posición
                        <span className="ml-2 text-[10px] font-normal text-slate-500">
                          ({selected.position_group})
                        </span>
                      </h3>
                      <p className="text-[10px] text-slate-600">
                        Barra coloreada = jugador · Barra gris = media de <span className="text-slate-400 font-medium">{selected.position_name}</span>
                      </p>
                      <CompareBar label="Goles/partido"    playerVal={selected.goals_pm}      avgVal={avgForGroup?.goals_pm ?? 0}      color={color} unit="" />
                      <CompareBar label="Pases/partido"    playerVal={selected.passes_pm}     avgVal={avgForGroup?.passes_pm ?? 0}     color="#3b82f6" />
                      <CompareBar label="Tiros/partido"    playerVal={selected.shots_pm}      avgVal={avgForGroup?.shots_pm ?? 0}      color="#ef4444" />
                      <CompareBar label="Regates/partido"  playerVal={selected.dribbles_pm}   avgVal={avgForGroup?.dribbles_pm ?? 0}   color="#f97316" />
                      <CompareBar label="% Precisión pases" playerVal={selected.completion_pct} avgVal={avgForGroup?.completion_pct ?? 0} color="#60a5fa" unit="%" />
                      <CompareBar label="% Tiros en puerta" playerVal={selected.shot_acc_pct} avgVal={avgForGroup?.shot_acc_pct ?? 0}  color="#fbbf24" unit="%" />
                      <CompareBar label="xG proxy (distancia gol)" playerVal={selected.xg_proxy}   avgVal={avgForGroup?.xg_proxy ?? 0}   color="#a78bfa" />

                      {/* Extra stats */}
                      <div className="pt-2 border-t border-slate-800 grid grid-cols-3 gap-2 text-center text-[10px]">
                        <div className="bg-slate-800 rounded-lg p-2">
                          <div className="font-bold text-purple-400">{selected.crosses}</div>
                          <div className="text-slate-600">Centros</div>
                        </div>
                        <div className="bg-slate-800 rounded-lg p-2">
                          <div className="font-bold text-cyan-400">{selected.through_balls}</div>
                          <div className="text-slate-600">Pases filtrado</div>
                        </div>
                        <div className="bg-slate-800 rounded-lg p-2">
                          <div className="font-bold text-amber-400">{selected.fwd_pass_pct.toFixed(0)}%</div>
                          <div className="text-slate-600">Pases adelante</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Row 2: Heatmap + Shot map ── */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-[11px] font-bold text-slate-300 uppercase tracking-wide mb-2">
                        Heatmap de Presencia — Toda la carrera
                      </h3>
                      <GlobalHeatmap
                        cells={profile.heatmap}
                        color={color}
                        playerName={selected.player_name}
                      />
                    </div>
                    <div>
                      <h3 className="text-[11px] font-bold text-slate-300 uppercase tracking-wide mb-2">
                        Mapa de Tiros — Origen y resultado
                        <span className="text-slate-600 font-normal ml-2">
                          ({profile.shots.length} tiros · {profile.player.goals} goles)
                        </span>
                      </h3>
                      <GlobalShotMap
                        shots={profile.shots}
                        color={color}
                        playerName={selected.player_name}
                      />
                    </div>
                  </div>

                  {/* ── Row 3: Assist passes ── */}
                  {profile.assist_passes.length > 0 && (
                    <div>
                      <h3 className="text-[11px] font-bold text-slate-300 uppercase tracking-wide mb-2">
                        Pases que llevan a Gol — Origen de las jugadas de gol
                        <span className="text-slate-600 font-normal ml-2">
                          ({profile.assist_passes.length} pases encontrados)
                        </span>
                      </h3>
                      <GlobalAssistMap
                        passes={profile.assist_passes}
                        color={color}
                        playerName={selected.player_name}
                      />
                    </div>
                  )}

                  {/* ── Row 4: Career summary ── */}
                  <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                    <h3 className="text-[11px] font-bold text-white uppercase tracking-wide mb-3">
                      Resumen de Carrera — {selected.player_name}
                    </h3>
                    <div className="grid grid-cols-4 gap-3 text-[10px]">
                      {[
                        { section: "Pases", items: [
                          { l: "Total pases",    v: profile.player.total_passes.toLocaleString() },
                          { l: "Completados",    v: `${profile.player.completed_passes.toLocaleString()} (${profile.player.completion_pct}%)` },
                          { l: "Longitud media", v: `${profile.player.avg_pass_length} yd` },
                          { l: "Pases adelante", v: `${profile.player.fwd_pass_pct}%` },
                          { l: "Centros",        v: profile.player.crosses },
                          { l: "Entre líneas",   v: profile.player.through_balls },
                        ]},
                        { section: "Tiros", items: [
                          { l: "Total tiros",   v: profile.player.total_shots },
                          { l: "Goles",         v: profile.player.goals },
                          { l: "En puerta",     v: `${profile.player.on_target} (${profile.player.shot_acc_pct}%)` },
                          { l: "Goles/partido", v: selected.goals_pm.toFixed(3) },
                          { l: "Tiros/partido", v: selected.shots_pm.toFixed(2) },
                          { l: "Conversión",    v: `${profile.player.total_shots ? ((profile.player.goals/profile.player.total_shots)*100).toFixed(1) : 0}%` },
                        ]},
                        { section: "Duelos", items: [
                          { l: "Regates exitosos", v: profile.player.dribbles },
                          { l: "Regates/partido",  v: selected.dribbles_pm.toFixed(2) },
                          { l: "Bajo presión",     v: profile.player.under_pressure_events.toLocaleString() },
                        ]},
                        { section: "General", items: [
                          { l: "Partidos",    v: profile.player.matches },
                          { l: "Posición",    v: profile.player.position_name },
                          { l: "Grupo",       v: selected.position_group },
                          { l: "Pases/pdo",   v: selected.passes_pm.toFixed(0) },
                        ]},
                      ].map(sec => (
                        <div key={sec.section} className="bg-slate-800 rounded-xl p-3 space-y-1.5">
                          <div className="font-bold text-[11px] text-white border-b border-slate-700 pb-1 mb-2">{sec.section}</div>
                          {sec.items.map(item => (
                            <div key={item.l} className="flex justify-between gap-2">
                              <span className="text-slate-500">{item.l}</span>
                              <span className="text-slate-200 font-medium">{item.v}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
