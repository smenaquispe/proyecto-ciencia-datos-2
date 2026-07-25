"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { api } from "@/lib/api"
import { useDashboardStore } from "@/store/dashboardStore"
import { PlayerList } from "@/components/ui/Selectors"
import PassTimeline from "@/components/charts/PassTimeline"
import type { Player, MatchPlayer, Pass, HeatmapCell, PlayerRatings, PlayerRankingEntry } from "@/lib/types"

const WorldMap          = dynamic(() => import("@/components/map/WorldMap"),                  { ssr: false, loading: () => <Sk h={340} /> })
const GraphSelector     = dynamic(() => import("@/components/graph/GraphSelector"),            { ssr: false, loading: () => <Sk h={200} /> })
const DualPitch         = dynamic(() => import("@/components/pitch/DualPitch"),                { ssr: false, loading: () => <Sk h={400} /> })
const PlayerHeatmap     = dynamic(() => import("@/components/pitch/PlayerHeatmap"),            { ssr: false, loading: () => <Sk h={280} /> })
const PassMap           = dynamic(() => import("@/components/charts/PassMap"),                 { ssr: false, loading: () => <Sk h={280} /> })
const ParallelCoords    = dynamic(() => import("@/components/charts/ParallelCoords"),          { ssr: false, loading: () => <Sk h={200} /> })
const RadarRatings      = dynamic(() => import("@/components/charts/RadarRatings"),            { ssr: false, loading: () => <Sk h={320} /> })
const PlayerRanking     = dynamic(() => import("@/components/charts/PlayerRanking"),           { ssr: false, loading: () => <Sk h={300} /> })
const PassDirectionMap  = dynamic(() => import("@/components/charts/PassDirectionMap"),        { ssr: false, loading: () => <Sk h={420} /> })
const PressurePassMap   = dynamic(() => import("@/components/charts/PressurePassMap"),         { ssr: false, loading: () => <Sk h={440} /> })
const FiveAxisRadar     = dynamic(() => import("@/components/charts/FiveAxisRadar"),           { ssr: false, loading: () => <Sk h={320} /> })
const PositionDashboard = dynamic(() => import("@/components/charts/PositionDashboard"),       { ssr: false, loading: () => <Sk h={400} /> })

function Sk({ h }: { h: number }) {
  return <div className="w-full rounded-xl bg-slate-800 animate-pulse" style={{ height: h }} />
}

export default function DashboardPage() {
  const store = useDashboardStore()

  const [allPasses, setAllPasses]           = useState<Pass[]>([])
  const [heatmapCells, setHeatmapCells]     = useState<HeatmapCell[]>([])
  const [hmLoading, setHmLoading]           = useState(false)
  const [matchLabel, setMatchLabel]         = useState<string | null>(null)
  const [playerRatings, setPlayerRatings]       = useState<PlayerRatings | null>(null)
  const [playersRanking, setPlayersRanking]     = useState<PlayerRankingEntry[]>([])
  const [ratingsLoading, setRatingsLoading]     = useState(false)
  const [pressurePasses, setPressurePasses]     = useState<import("@/lib/types").PressurePass[]>([])
  const [positionPatterns, setPositionPatterns] = useState<import("@/lib/types").PositionPattern[]>([])
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<"overview" | "pentagonal" | "pressure" | "passes" | "ranking" | "positions">("overview")

  // ── Countries ─────────────────────────────────────────────────────────────
  useEffect(() => {
    api.countries().then(d => store.setCountries(d.countries))
  }, []) // eslint-disable-line

  // ── Match selected via GraphSelector ─────────────────────────────────────
  const handleMatchSelected = useCallback((matchId: number, label: string) => {
    setMatchLabel(label)
    // Set a minimal match object to unlock UI; lineup call will fill the rest
    store.setSelectedMatch({
      match_id: matchId,
      match_date: "", kick_off: "", match_datetime: "",
      competition_id: 0, season_id: 0,
      home_team_id: 0, away_team_id: 0,
      home_score: 0, away_score: 0,
      match_week: 0, match_status_360: "",
      competition_stage_name: "",
      competition_name: "", country_name: "", season_name: "",
      home_team_name: "", away_team_name: "",
      stadium_name: null,
    } as any)
  }, []) // eslint-disable-line

  // ── Match id changes → reload lineup + summary + ranking ─────────────────
  useEffect(() => {
    if (!store.selectedMatch) {
      store.setTeams([]); store.setPlayers([]); store.setEventsSummary([])
      setAllPasses([]); setHeatmapCells([])
      setPlayersRanking([]); setPlayerRatings(null)
      return
    }
    const mid = store.selectedMatch.match_id
    store.setSelectedPlayer(null); setAllPasses([]); setHeatmapCells([])
    store.setCurrentMinute(0)

    store.setLoading("isLoadingLineup", true)
    api.lineup(mid).then(d => {
      store.setTeams(d.teams)
      if (d.match?.home_team_id) {
        store.setSelectedMatch({ ...store.selectedMatch!, ...d.match })
      }
    }).finally(() => store.setLoading("isLoadingLineup", false))

    api.eventsSummary(mid).then(d => {
      store.setEventsSummary(d.events_by_minute)
      store.setMaxMinute(d.max_minute)
      store.setPlayers(d.players)
    })

    // Load players ranking for this match
    api.playersRanking(mid).then(d => setPlayersRanking(d.players)).catch(() => {})

    // Load position patterns for this match
    api.positionPatterns(mid).then(d => setPositionPatterns(d.positions)).catch(() => {})

  }, [store.selectedMatch?.match_id]) // eslint-disable-line

  // ── Player selected → passes-only + ratings ───────────────────────────────
  useEffect(() => {
    if (!store.selectedPlayer || !store.selectedMatch) {
      setAllPasses([]); setHeatmapCells([]); setPlayerRatings(null); return
    }
    const mid = store.selectedMatch.match_id
    const pid = store.selectedPlayer.player_id
    store.setLoading("isLoadingPasses", true)
    api.passesOnly(mid, pid, 0, store.maxMinute)
      .then(d => setAllPasses(d.passes))
      .finally(() => store.setLoading("isLoadingPasses", false))
    loadHeatmap(mid, pid, store.currentMinute)

    // Load player ratings
    setRatingsLoading(true)
    api.playerRatings(mid, pid)
      .then(d => setPlayerRatings(d))
      .catch(() => setPlayerRatings(null))
      .finally(() => setRatingsLoading(false))

    // Load pressure passes for this player
    api.pressurePasses(mid, pid)
      .then(d => setPressurePasses(d.pressure_passes))
      .catch(() => setPressurePasses([]))

  }, [store.selectedPlayer?.player_id, store.selectedMatch?.match_id]) // eslint-disable-line

  const loadHeatmap = useCallback(async (mid: number, pid: number, upTo: number) => {
    setHmLoading(true)
    try {
      const hm = await api.heatmap(mid, pid, 0, upTo)
      setHeatmapCells(hm.cells)
    } finally {
      setHmLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!store.selectedPlayer || !store.selectedMatch) return
    loadHeatmap(store.selectedMatch.match_id, store.selectedPlayer.player_id, store.currentMinute)
  }, [store.currentMinute]) // eslint-disable-line

  // Passes for the current minute only
  const currentPasses = useMemo(
    () => allPasses.filter(p => p.minute === store.currentMinute),
    [allPasses, store.currentMinute]
  )

  const playerName = store.selectedPlayer?.player_name
  const homeId     = store.selectedMatch?.home_team_id ?? 0
  const awayId     = store.selectedMatch?.away_team_id ?? 0
  const matchReady = !!store.selectedMatch

  const [sidebarExpanded, setSidebarExpanded] = useState(false)

  return (
    <div className="h-screen bg-slate-950 text-white flex flex-col overflow-hidden">

      {/* ── Topbar ── */}
      <header className="flex-shrink-0 bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center gap-3">
        <span className="text-lg">⚽</span>
        <h1 className="font-bold text-sm">StatsBomb Explorer</h1>
        <Link href="/global"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-all text-[11px] font-semibold flex-shrink-0">
          <span>★</span> Dashboard Global
        </Link>

        <div className="flex items-center gap-1.5 text-xs text-slate-500 overflow-hidden flex-1">
          {store.selectedCountry && <span className="text-slate-400">{store.selectedCountry.country_name}</span>}
          {matchLabel && <><span>›</span><span className="text-slate-300 truncate">{matchLabel}</span></>}
        </div>

        {store.selectedMatch?.home_team_name && (
          <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 text-sm flex-shrink-0">
            <span className="text-blue-300 font-medium">{store.selectedMatch.home_team_name}</span>
            <span className="text-lg font-bold text-amber-400">
              {store.selectedMatch.home_score}–{store.selectedMatch.away_score}
            </span>
            <span className="text-red-300 font-medium">{store.selectedMatch.away_team_name}</span>
            <span className="text-slate-500 text-xs">{store.selectedMatch.match_date?.slice(0, 10)}</span>
          </div>
        )}

        {playerName && (
          <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded-lg flex-shrink-0">
            <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
            <span className="text-amber-300 text-xs font-semibold">{playerName}</span>
            <span className="text-slate-500 text-[10px]">· {store.currentMinute}′</span>
          </div>
        )}
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ── */}
        <aside
          className="flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col overflow-hidden transition-all duration-300"
          style={{ width: sidebarExpanded ? "100%" : (matchReady ? 270 : 320) }}
        >
          {/* Sidebar header with expand toggle */}
          <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
              {sidebarExpanded ? "Vista expandida" : "Navegación"}
            </span>
            <button
              onClick={() => setSidebarExpanded(v => !v)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-white transition-all duration-150 text-[11px] font-medium"
              title={sidebarExpanded ? "Contraer panel" : "Expandir panel al ancho completo"}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                {sidebarExpanded
                  ? <><path d="M8 2L4 6l4 4"/><path d="M1 1v10"/></>
                  : <><path d="M4 2l4 4-4 4"/><path d="M11 1v10"/></>
                }
              </svg>
              {sidebarExpanded ? "Contraer" : "Expandir"}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4">

            {/* Map */}
            <section>
              <SideLabel n={1} label="País" done={!!store.selectedCountry} />
              <div className={`transition-all duration-500 overflow-hidden ${
                sidebarExpanded
                  ? "max-h-[600px]"
                  : store.selectedCountry ? "max-h-52" : "max-h-[380px]"
              }`}>
                <WorldMap
                  countries={store.countries}
                  selected={store.selectedCountry}
                  mapHeight={sidebarExpanded ? 500 : 280}
                  onSelect={c => {
                    store.setSelectedCountry(c)
                    store.setSelectedMatch(null)
                    setMatchLabel(null)
                    setAllPasses([]); setHeatmapCells([])
                  }}
                />
              </div>
            </section>

            {/* Graph selector */}
            {store.selectedCountry && (
              <section>
                <SideLabel n={2} label="Liga · Temporada · Equipo · Partido" done={matchReady} />
                <GraphSelector
                  countryName={store.selectedCountry.country_name}
                  onMatchSelected={handleMatchSelected}
                  graphHeight={sidebarExpanded ? 620 : 420}
                  onReset={() => {
                    store.setSelectedMatch(null)
                    setMatchLabel(null)
                    setAllPasses([]); setHeatmapCells([])
                  }}
                />
              </section>
            )}

            {/* Player list */}
            {store.players.length > 0 && (
              <section>
                <SideLabel n={3} label="Jugador" done={!!store.selectedPlayer} />
                <PlayerList
                  players={store.players}
                  selectedId={store.selectedPlayer?.player_id ?? null}
                  onSelect={p => store.setSelectedPlayer(p)}
                />
              </section>
            )}
          </div>
        </aside>

        {/* ── Main canvas ── */}
        <main className={`flex-1 overflow-y-auto p-3 space-y-3 transition-all duration-300 ${sidebarExpanded ? "hidden" : ""}`}>
          {!matchReady ? (
            <EmptyState hasCountry={!!store.selectedCountry} />
          ) : (
            <>
              {/* Row 1: Two pitch columns + pass map */}
              <div className="grid grid-cols-[auto_1fr] gap-3 items-start">

                {/* Left: dual pitch (home above, away below) */}
                <div className="flex-shrink-0">
                  <RowLabel title="Alineaciones" sub="Clic en jugador para analizar" loading={store.isLoadingLineup} />
                  {store.teams.length > 0
                    ? <DualPitch
                        teams={store.teams}
                        homeTeamId={homeId}
                        awayTeamId={awayId}
                        selectedPlayer={store.selectedPlayer}
                        onPlayerClick={p => store.setSelectedPlayer(p)}
                        width={460}
                      />
                    : <Sk h={400} />
                  }
                </div>

                {/* Right: Pass map */}
                <div className="min-w-0">
                  <RowLabel
                    title="Pases del jugador — Minuto actual"
                    sub={playerName
                      ? `${playerName} · ${store.currentMinute}′ · ${currentPasses.length} pases`
                      : "Selecciona un jugador"}
                    loading={store.isLoadingPasses}
                  />
                  <PassMap
                    passes={currentPasses}
                    width={580}
                    height={460}
                    playerName={playerName}
                    currentMinute={store.currentMinute}
                  />
                </div>
              </div>

              {/* Row 2: Timeline slider */}
              <PassTimeline
                passes={allPasses}
                eventsSummary={store.eventsSummary}
                currentMinute={store.currentMinute}
                maxMinute={store.maxMinute}
                onMinuteChange={store.setCurrentMinute}
                playerName={playerName}
              />

              {/* Row 3: Heatmap + Parallel coords */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <RowLabel
                    title="Heatmap de posición"
                    sub={playerName ? `0′ → ${store.currentMinute}′` : "Selecciona un jugador"}
                    loading={hmLoading}
                  />
                  <PlayerHeatmap
                    cells={heatmapCells}
                    width={540}
                    height={320}
                    playerName={playerName}
                    upToMinute={store.currentMinute}
                  />
                </div>

                <div>
                  <RowLabel
                    title="Análisis dimensional de pases"
                    sub={playerName ? `${allPasses.length} pases en el partido` : "Selecciona un jugador"}
                  />
                  {playerName
                    ? <ParallelCoords
                        passes={allPasses}
                        currentMinute={store.currentMinute}
                        playerName={playerName}
                      />
                    : <Sk h={320} />
                  }
                </div>
              </div>

              {/* Row 4: Stats */}
              {playerName && (
                <StatsRow passes={allPasses} currentMinute={store.currentMinute} />
              )}

              {/* ══ ANÁLISIS AVANZADO (Evers et al. 2024) ══════════════════════ */}
              {matchReady && (
                <div className="border-t border-slate-700/60 pt-4 space-y-3">

                  {/* Section header + tab switcher */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-white">Análisis Visual Avanzado</h2>
                      <p className="text-[10px] text-slate-500">
                        Basado en Evers et al. (2024) — <em>Visual analytics of soccer player performance using objective ratings</em>
                      </p>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {([
                        { key: "overview",   label: "Rendimiento" },
                        { key: "pentagonal", label: "Radar 4×" },
                        { key: "pressure",   label: "Presión" },
                        { key: "passes",     label: "Dirección Pases" },
                        { key: "ranking",    label: "Ranking" },
                        { key: "positions",  label: "Posiciones" },
                      ] as const).map(t => (
                        <button key={t.key}
                          onClick={() => setActiveAnalysisTab(t.key)}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all border ${
                            activeAnalysisTab === t.key
                              ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                              : "bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300"
                          }`}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ── Tab: Rendimiento — tabla scores + radar 3 ejes ── */}
                  {activeAnalysisTab === "overview" && (
                    <>
                      {ratingsLoading && <Sk h={320} />}
                      {!ratingsLoading && playerRatings && (
                        <RadarRatings
                          ratings={playerRatings}
                          playerName={playerName}
                          teamName={store.selectedMatch?.home_team_name}
                        />
                      )}
                      {!ratingsLoading && !playerRatings && playerName && (
                        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-center text-slate-500 text-sm">
                          No se pudieron cargar los ratings para este jugador
                        </div>
                      )}
                      {!playerName && (
                        <div className="bg-slate-800 border border-dashed border-slate-700 rounded-xl p-6 text-center text-slate-500 text-sm">
                          Selecciona un jugador para ver su análisis de rendimiento
                        </div>
                      )}
                    </>
                  )}

                  {/* ── Tab: Radar 4× — exactamente como Fig. 8 del paper ── */}
                  {activeAnalysisTab === "pentagonal" && (
                    <>
                      {ratingsLoading && <Sk h={320} />}
                      {!ratingsLoading && playerRatings && (
                        <FiveAxisRadar
                          ratings={playerRatings}
                          playerName={playerName}
                        />
                      )}
                      {!playerName && (
                        <div className="bg-slate-800 border border-dashed border-slate-700 rounded-xl p-6 text-center text-slate-500 text-sm">
                          Selecciona un jugador para ver los radares multidimensionales
                        </div>
                      )}
                    </>
                  )}

                  {/* ── Tab: Presión — pases bajo presión con origen ── */}
                  {activeAnalysisTab === "pressure" && (
                    <PressurePassMap
                      passes={pressurePasses}
                      width={720}
                      height={420}
                      playerName={playerName}
                    />
                  )}

                  {/* ── Tab: Dirección Pases ── */}
                  {activeAnalysisTab === "passes" && (
                    <PassDirectionMap
                      passes={allPasses}
                      width={900}
                      height={480}
                      playerName={playerName}
                    />
                  )}

                  {/* ── Tab: Ranking — comparativa todos los jugadores ── */}
                  {activeAnalysisTab === "ranking" && (
                    <PlayerRanking
                      players={playersRanking}
                      selectedPlayerId={store.selectedPlayer?.player_id}
                      homeTeamId={homeId}
                      onSelectPlayer={p => {
                        const found = store.players.find(sp => sp.player_id === p.player_id)
                        if (found) store.setSelectedPlayer(found)
                      }}
                    />
                  )}

                  {/* ── Tab: Posiciones — dashboard por posición táctica ── */}
                  {activeAnalysisTab === "positions" && (
                    <PositionDashboard positions={positionPatterns} />
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SideLabel({ n, label, done }: { n: number; label: string; done: boolean }) {
  return (
    <div className="flex items-start gap-1.5 mb-2">
      <span className={`w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5 ${
        done ? "bg-green-500 text-white" : "bg-slate-700 text-slate-400"
      }`}>{done ? "✓" : n}</span>
      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold leading-tight">{label}</span>
    </div>
  )
}

function RowLabel({ title, sub, loading }: { title: string; sub?: string; loading?: boolean }) {
  return (
    <div className="flex items-baseline justify-between mb-1.5">
      <h3 className="text-[11px] font-semibold text-slate-300 uppercase tracking-wide">{title}</h3>
      <span className="text-[10px] text-slate-500 truncate max-w-xs pl-2">
        {loading ? <span className="text-amber-400 animate-pulse">Cargando…</span> : sub}
      </span>
    </div>
  )
}

function EmptyState({ hasCountry }: { hasCountry: boolean }) {
  const active = hasCountry ? 2 : 1
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[55vh] gap-5">
      <div className="text-5xl">⚽</div>
      <h2 className="text-base font-bold text-slate-300">Football Analytics Explorer</h2>
      <div className="space-y-2 w-80 text-sm">
        {[
          { n: 1, t: "Haz clic en un país del mapa" },
          { n: 2, t: "Navega el grafo: Liga → Temporada → Equipo" },
          { n: 3, t: "Selecciona el partido" },
          { n: 4, t: "Haz clic en un jugador" },
        ].map(s => (
          <div key={s.n} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border ${
            s.n < active  ? "border-green-500/40 bg-green-500/5 text-green-400"
            : s.n === active ? "border-amber-500/60 bg-amber-500/10 text-amber-300"
            : "border-slate-700 bg-slate-800/40 text-slate-600"
          }`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
              s.n < active ? "bg-green-500 text-white" : s.n === active ? "bg-amber-500 text-black" : "bg-slate-700 text-slate-500"
            }`}>{s.n < active ? "✓" : s.n}</span>
            {s.t}
          </div>
        ))}
      </div>
    </div>
  )
}

function StatsRow({ passes, currentMinute }: { passes: Pass[]; currentMinute: number }) {
  const at  = passes.filter(p => p.minute === currentMinute)
  const fwd = at.filter(p => ["forward_vertical","diagonal_forward"].includes(p.pass_type)).length
  const bck = at.filter(p => ["back_vertical","diagonal_back"].includes(p.pass_type)).length
  const prs = at.filter(p => p.under_pressure).length
  const avg = at.length > 0
    ? (at.reduce((s, p) => s + (p.distance ?? 0), 0) / at.length).toFixed(1)
    : "—"

  return (
    <div className="grid grid-cols-6 gap-2">
      {[
        { l: "Pases (minuto)",    v: at.length,      c: "text-white" },
        { l: "Adelante",          v: fwd,             c: "text-green-400" },
        { l: "Atrás",             v: bck,             c: "text-red-400" },
        { l: "Bajo presión",      v: prs,             c: "text-amber-400" },
        { l: "Dist. media (yd)", v: `${avg}`,        c: "text-blue-400" },
        { l: "Total partido",    v: passes.length,   c: "text-slate-300" },
      ].map(s => (
        <div key={s.l} className="bg-slate-800 rounded-xl border border-slate-700 px-3 py-2.5 text-center">
          <div className={`text-xl font-bold ${s.c}`}>{s.v}</div>
          <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{s.l}</div>
        </div>
      ))}
    </div>
  )
}
