import React, { useState, useEffect, useCallback } from "react";
import Pitch from "./components/Pitch";
import SidePanel from "./components/SidePanel";
import HypothesisBlock from "./components/HypothesisBlock";
import TeamComparison from "./components/TeamComparison";
import Hyp2View from "./components/Hyp2View";
import Hyp3View from "./components/Hyp3View";
import DataWranglingView from "./components/DataWranglingView";
import "./styles.css";

export default function App() {
  const [activeTab, setActiveTab] = useState(1); // 1 or 2

  // ── Hyp 1 state ──────────────────────────────────────────────
  const [teams,       setTeams]       = useState([]);
  const [matches,     setMatches]     = useState([]);
  const [hypothesis,  setHypothesis]  = useState(null);
  const [teamComp,    setTeamComp]    = useState(null);
  const [passes,      setPasses]      = useState([]);
  const [shots,       setShots]       = useState([]);
  const [loadingPitch, setLoadingPitch] = useState(true);
  const [loadingHyp,   setLoadingHyp]  = useState(true);
  const [filters, setFilters] = useState({ teamId: null, matchId: null });

  // ── Hyp 2 state ──────────────────────────────────────────────
  const [hyp2Data,    setHyp2Data]    = useState(null);
  const [loadingHyp2, setLoadingHyp2] = useState(false);
  const [hyp2Fetched, setHyp2Fetched] = useState(false);

  // ── Hyp 3 state ──────────────────────────────────────────────
  const [hyp3Data,    setHyp3Data]    = useState(null);
  const [loadingHyp3, setLoadingHyp3] = useState(false);
  const [hyp3Fetched, setHyp3Fetched] = useState(false);

  // ── Initial loads ─────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/teams").then(r => r.json()).then(d => setTeams(d.teams));
    fetch("/api/matches").then(r => r.json()).then(d => setMatches(d.matches));
    fetch("/api/teams/goal-comparison?top_n=8")
      .then(r => r.json()).then(d => setTeamComp(d));
  }, []);

  // ── Hyp 1 re-fetch on filter change ──────────────────────────
  const fetchHyp = useCallback((f) => {
    setLoadingHyp(true);
    const p = new URLSearchParams();
    if (f.teamId)  p.set("team_id",  f.teamId);
    if (f.matchId) p.set("match_id", f.matchId);
    fetch(`/api/hypothesis/passes?${p}`)
      .then(r => r.json())
      .then(d => { setHypothesis(d); setLoadingHyp(false); });
  }, []);

  const fetchPitch = useCallback((f) => {
    setLoadingPitch(true);
    const pp = new URLSearchParams({ limit: "6000" });
    if (f.teamId)  pp.set("team_id",  f.teamId);
    if (f.matchId) pp.set("match_id", f.matchId);
    const sp = new URLSearchParams({ limit: "2000" });
    if (f.teamId)  sp.set("team_id",  f.teamId);
    if (f.matchId) sp.set("match_id", f.matchId);
    Promise.all([
      fetch(`/api/passes?${pp}`).then(r => r.json()),
      fetch(`/api/shots?${sp}`).then(r => r.json()),
    ]).then(([pd, sd]) => {
      setPasses(pd.passes ?? []);
      setShots(sd.shots ?? []);
      setLoadingPitch(false);
    });
  }, []);

  useEffect(() => { fetchHyp(filters);  }, [filters, fetchHyp]);
  useEffect(() => { fetchPitch(filters); }, [filters, fetchPitch]);

  // ── Hyp 2 lazy load ──────────────────────────────────────────
  useEffect(() => {
    if (activeTab === 2 && !hyp2Fetched) {
      setLoadingHyp2(true);
      setHyp2Fetched(true);
      fetch("/api/hypothesis/counter")
        .then(r => r.json())
        .then(d => { setHyp2Data(d); setLoadingHyp2(false); });
    }
  }, [activeTab, hyp2Fetched]);

  // ── Hyp 3 lazy load ──────────────────────────────────────────
  useEffect(() => {
    if (activeTab === 3 && !hyp3Fetched) {
      setLoadingHyp3(true);
      setHyp3Fetched(true);
      fetch("/api/hypothesis/defensive-line")
        .then(r => r.json())
        .then(d => { setHyp3Data(d); setLoadingHyp3(false); });
    }
  }, [activeTab, hyp3Fetched]);

  const handleFilter = (key, val) =>
    setFilters(f => ({ ...f, [key]: val || null }));
  const resetFilters = () => setFilters({ teamId: null, matchId: null });
  const selectedMatch = matches.find(m => m.match_id === filters.matchId);

  return (
    <div className="app">

      {/* ══ NAV BAR ════════════════════════════════════════════ */}
      <div className="nav-bar">
        <div className="nav-brand">
          <span className="nav-logo">⚽</span>
          <span className="nav-name">StatsBomb · Dashboard</span>
        </div>
        <div className="nav-tabs">
          <button
            className={`nav-tab ${activeTab === 1 ? "active" : ""}`}
            onClick={() => setActiveTab(1)}
          >
            <span className="nav-tab-num">H1</span>
            Pases &amp; Goles
          </button>
          <button
            className={`nav-tab ${activeTab === 2 ? "active" : ""}`}
            onClick={() => setActiveTab(2)}
          >
            <span className="nav-tab-num">H2</span>
            Contragolpe vs Posesión
          </button>
          <button
            className={`nav-tab ${activeTab === 3 ? "active" : ""}`}
            onClick={() => setActiveTab(3)}
          >
            <span className="nav-tab-num">H3</span>
            Línea Defensiva
          </button>
          <button
            className={`nav-tab ${activeTab === 4 ? "active" : ""}`}
            onClick={() => setActiveTab(4)}
          >
            <span className="nav-tab-num">📊</span>
            Data Wrangling
          </button>
        </div>
      </div>

      {/* ══ HYP 1 ═════════════════════════════════════════════ */}
      {activeTab === 1 && (
        <>
          {/* filter strip */}
          <div className="filter-strip">
            <div className="filter-chip">
              <label>Equipo</label>
              <select value={filters.teamId ?? ""}
                onChange={e => handleFilter("teamId", e.target.value ? +e.target.value : null)}>
                <option value="">Todos</option>
                {teams.map(t => (
                  <option key={t.team_id} value={t.team_id}>{t.team_name}</option>
                ))}
              </select>
            </div>
            <div className="filter-chip">
              <label>Partido</label>
              <select value={filters.matchId ?? ""}
                onChange={e => handleFilter("matchId", e.target.value ? +e.target.value : null)}>
                <option value="">Todos</option>
                {matches.slice(0, 150).map(m => (
                  <option key={m.match_id} value={m.match_id}>
                    {m.match_date} · {m.competition_name ?? `#${m.match_id}`}
                  </option>
                ))}
              </select>
            </div>
            {(filters.teamId || filters.matchId) &&
              <button className="filter-reset" onClick={resetFilters}>✕ Limpiar</button>}
            {selectedMatch && (
              <span className="filter-match-info">
                📅 {selectedMatch.match_date} &nbsp;·&nbsp;
                {selectedMatch.competition_name} &nbsp;
                <strong style={{ color: "var(--txt0)" }}>
                  {selectedMatch.home_score} – {selectedMatch.away_score}
                </strong>
              </span>
            )}
          </div>

          {/* hypothesis statement */}
          <div className="section">
            <div className="section-label">Planteamiento &amp; Metodología</div>
            <HypothesisBlock hypothesis={hypothesis} loading={loadingHyp} />
          </div>

          {/* pitch + panel */}
          <div className="section">
            <div className="section-label">Visualización del campo</div>
            <div className="main-grid">
              <Pitch passes={passes} shots={shots} loading={loadingPitch} />
              <SidePanel hypothesis={hypothesis} passes={passes} shots={shots} loading={loadingHyp} />
            </div>
          </div>

          {/* team comparison */}
          <div className="section">
            <div className="section-label">
              Equipos con más vs menos goles — ¿cómo los consiguen?
            </div>
            <TeamComparison data={teamComp} />
          </div>
        </>
      )}

      {/* ══ HYP 2 ═════════════════════════════════════════════ */}
      {activeTab === 2 && (
        <Hyp2View data={hyp2Data} loading={loadingHyp2} />
      )}

      {/* ══ HYP 3 ═════════════════════════════════════════════ */}
      {activeTab === 3 && (
        <Hyp3View data={hyp3Data} loading={loadingHyp3} />
      )}

      {/* ══ DATA WRANGLING ══════════════════════════════════════ */}
      {activeTab === 4 && (
        <DataWranglingView />
      )}

    </div>
  );
}
