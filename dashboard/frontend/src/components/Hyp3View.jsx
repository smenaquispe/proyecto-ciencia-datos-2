import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ScatterChart, Scatter, ZAxis,
  ReferenceLine, Label, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";

/* ── constants ─────────────────────────────────────────────── */
const LINE_META = {
  alta:  { color: "#f85149", label: "Línea Alta",  icon: "⬆️", desc: "Pressing alto, x > Q67" },
  media: { color: "#d29922", label: "Línea Media", icon: "↔️", desc: "Pressing medio, Q33–Q67" },
  baja:  { color: "#58a6ff", label: "Línea Baja",  icon: "⬇️", desc: "Pressing bajo, x < Q33"  },
};
const ORDER = ["alta", "media", "baja"];

/* pitch SVG constants */
const PW = 600, PH = 390, PAD = 16;

/* pitch coordinate helpers */
const sx = (x) => PAD + (x / 120) * (PW - PAD * 2);
const sy = (y) => PAD + ((80 - y) / 80) * (PH - PAD * 2);

/* color scale for heatmap: dark green → yellow → red */
function heatColor(intensity) {
  if (intensity <= 0) return "transparent";
  // Use a multi-stop colour: dark green→teal→yellow→orange→red
  const stops = [
    [0.0,  [0,   50,  20]],
    [0.2,  [20,  80,  40]],
    [0.4,  [90, 160,  50]],
    [0.6,  [220,170,  20]],
    [0.8,  [240, 90,  20]],
    [1.0,  [220,  0,   0]],
  ];
  let lo = stops[0], hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (intensity >= stops[i][0] && intensity <= stops[i + 1][0]) {
      lo = stops[i]; hi = stops[i + 1]; break;
    }
  }
  const t = (intensity - lo[0]) / (hi[0] - lo[0]);
  const r = Math.round(lo[1][0] + t * (hi[1][0] - lo[1][0]));
  const g = Math.round(lo[1][1] + t * (hi[1][1] - lo[1][1]));
  const b = Math.round(lo[1][2] + t * (hi[1][2] - lo[1][2]));
  return `rgb(${r},${g},${b})`;
}

/* ── PressureHeatmap ────────────────────────────────────────── */
function PressureHeatmap({ cells, avgPressureX, maxCount, totalEvents, thresholds, cellSize = 6, loadingHm }) {
  const [hovered, setHovered] = useState(null);
  const svgRef = useRef(null);

  const q33x  = sx(thresholds?.q33 ?? 52.4);
  const q67x  = sx(thresholds?.q67 ?? 57.9);
  const avgXpx = avgPressureX ? sx(avgPressureX) : null;
  const cellW  = (PW - PAD * 2) / (120 / cellSize);
  const cellH  = (PH - PAD * 2) / (80  / cellSize);

  return (
    <div style={{ position: "relative" }}>
      <svg ref={svgRef}
        viewBox={`0 0 ${PW} ${PH}`}
        style={{ width: "100%", height: "auto", display: "block", cursor: "crosshair" }}
      >
        {/* pitch background */}
        <rect x={PAD} y={PAD} width={PW - PAD*2} height={PH - PAD*2}
          fill="#1a3a24" rx={3} />

        {/* heatmap cells */}
        {cells.map((c, i) => {
          const px = PAD + (c.cx * cellSize / 120) * (PW - PAD*2);
          const py = PAD + ((80 - (c.cy + 1) * cellSize) / 80) * (PH - PAD*2);
          return (
            <rect key={i}
              x={px} y={py} width={cellW} height={cellH}
              fill={heatColor(c.intensity)}
              opacity={0.82}
              onMouseEnter={() => setHovered({ ...c, px, py })}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}

        {/* pitch lines overlay */}
        <g stroke="#fff" strokeWidth={1} fill="none" opacity={0.4}>
          <rect x={PAD} y={PAD} width={PW-PAD*2} height={PH-PAD*2} />
          <line x1={PAD+(PW-PAD*2)/2} y1={PAD} x2={PAD+(PW-PAD*2)/2} y2={PH-PAD} />
          <circle cx={PAD+(PW-PAD*2)/2} cy={PAD+(PH-PAD*2)/2} r={(PH-PAD*2)*0.11} />
          <rect x={PAD} y={PAD+(PH-PAD*2)*0.205} width={(PW-PAD*2)*0.15} height={(PH-PAD*2)*0.59} />
          <rect x={PAD} y={PAD+(PH-PAD*2)*0.35}  width={(PW-PAD*2)*0.057} height={(PH-PAD*2)*0.30} />
          <rect x={PW-PAD-(PW-PAD*2)*0.15} y={PAD+(PH-PAD*2)*0.205} width={(PW-PAD*2)*0.15} height={(PH-PAD*2)*0.59} />
          <rect x={PW-PAD-(PW-PAD*2)*0.057} y={PAD+(PH-PAD*2)*0.35}  width={(PW-PAD*2)*0.057} height={(PH-PAD*2)*0.30} />
        </g>

        {/* zone threshold lines */}
        <line x1={q33x} y1={PAD} x2={q33x} y2={PH-PAD}
          stroke="#58a6ff" strokeWidth={1.5} strokeDasharray="5 3" opacity={0.9} />
        <line x1={q67x} y1={PAD} x2={q67x} y2={PH-PAD}
          stroke="#f85149" strokeWidth={1.5} strokeDasharray="5 3" opacity={0.9} />

        {/* avg_pressure_x line */}
        {avgXpx && (
          <g>
            <line x1={avgXpx} y1={PAD} x2={avgXpx} y2={PH-PAD}
              stroke="#fff" strokeWidth={2} opacity={0.85} />
            <rect x={avgXpx-22} y={PAD+4} width={44} height={16} rx={3}
              fill="#1e293b" opacity={0.9} />
            <text x={avgXpx} y={PAD+16} textAnchor="middle"
              fill="#fff" fontSize={9} fontWeight={700}>
              x̄={avgPressureX?.toFixed(1)}
            </text>
          </g>
        )}

        {/* zone labels */}
        <text x={(PAD+q33x)/2}          y={PH-PAD-6} textAnchor="middle" fill="#58a6ff" fontSize={9} opacity={0.8}>Baja &lt;{thresholds?.q33}</text>
        <text x={(q33x+q67x)/2}          y={PH-PAD-6} textAnchor="middle" fill="#d29922" fontSize={9} opacity={0.8}>Media</text>
        <text x={(q67x+(PW-PAD))/2}      y={PH-PAD-6} textAnchor="middle" fill="#f85149" fontSize={9} opacity={0.8}>Alta &gt;{thresholds?.q67}</text>

        {/* axis labels */}
        <text x={PAD+2} y={PAD+12} fill="#fff" opacity={0.25} fontSize={8}>0 (portería)</text>
        <text x={PW-PAD-2} y={PAD+12} textAnchor="end" fill="#fff" opacity={0.25} fontSize={8}>120 (rival)</text>

        {/* tooltip */}
        {hovered && (
          <g>
            <rect x={hovered.px+8} y={hovered.py-30} width={110} height={44} rx={4}
              fill="#1e293b" opacity={0.95} />
            <text x={hovered.px+13} y={hovered.py-14} fill="#fff" fontSize={9}>
              x {hovered.x0}–{hovered.x0+cellSize} · y {hovered.y0}–{hovered.y0+cellSize}
            </text>
            <text x={hovered.px+13} y={hovered.py-3} fill="#fff" fontSize={9}>
              {hovered.count} presiones · {(hovered.intensity*100).toFixed(0)}% intensidad
            </text>
          </g>
        )}
      </svg>

      {/* color scale legend */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0 0",
        fontSize: 10, color: "var(--txt3)" }}>
        <span>Baja</span>
        <svg width={120} height={10}>
          <defs>
            <linearGradient id="hm-grad" x1="0" y1="0" x2="1" y2="0">
              {[0,.2,.4,.6,.8,1].map((t,i) => (
                <stop key={i} offset={`${t*100}%`} stopColor={heatColor(t)} />
              ))}
            </linearGradient>
          </defs>
          <rect x={0} y={0} width={120} height={10} fill="url(#hm-grad)" rx={2} />
        </svg>
        <span>Alta densidad de presión</span>
        {totalEvents > 0 && (
          <span style={{ marginLeft: "auto" }}>
            {totalEvents.toLocaleString("es-ES")} eventos · {cells.length} celdas activas
          </span>
        )}
      </div>

      {loadingHm && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(13,17,23,.75)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          fontSize: 13, color: "var(--txt2)", borderRadius: 8 }}>
          <div className="spinner" />
          Cargando mapa de calor…
        </div>
      )}
    </div>
  );
}

/* ── MatchList ──────────────────────────────────────────────── */
function MatchList({ matches, loading, selectedLine, thresholds }) {
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10,
        padding: "20px 0", color: "var(--txt2)", fontSize: 13 }}>
        <div className="spinner" /> Cargando partidos…
      </div>
    );
  }

  if (!matches.length) {
    return (
      <div style={{ color: "var(--txt3)", padding: "16px 0", fontSize: 13 }}>
        {selectedLine
          ? `No hay partidos con línea "${selectedLine}" para el equipo seleccionado.`
          : "Selecciona un tipo de línea para ver los partidos."}
      </div>
    );
  }

  const meta = selectedLine ? LINE_META[selectedLine] : null;

  /* stats summary */
  const total   = matches.length;
  const wins    = matches.filter(m => m.result === "win").length;
  const draws   = matches.filter(m => m.result === "draw").length;
  const losses  = matches.filter(m => m.result === "loss").length;
  const avgScored   = (matches.reduce((s, m) => s + m.scored,   0) / total).toFixed(2);
  const avgConceded = (matches.reduce((s, m) => s + m.conceded, 0) / total).toFixed(2);
  const avgPx       = (matches.reduce((s, m) => s + m.avg_pressure_x, 0) / total).toFixed(1);

  return (
    <div>
      {/* summary strip */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        {[
          { val: total,          label: "Partidos",     color: "var(--txt0)"   },
          { val: `${((wins/total)*100).toFixed(0)}%`, label: "Win rate", color: "#3fb950" },
          { val: avgScored,      label: "Goles marc./p", color: meta?.color ?? "var(--txt0)" },
          { val: avgConceded,    label: "Goles rec./p",  color: "var(--txt2)"  },
          { val: avgPx,          label: "Avg pres. x",   color: meta?.color ?? "var(--txt0)" },
        ].map(k => (
          <div key={k.label} style={{ background: "var(--bg2)", borderRadius: 7,
            padding: "8px 12px", flex: 1, minWidth: 70 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.val}</div>
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: ".4px",
              color: "var(--txt3)", marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* result bar */}
      <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 12 }}>
        <div style={{ width: `${(wins/total)*100}%`,   background: "#3fb950" }} title={`${wins} victorias`} />
        <div style={{ width: `${(draws/total)*100}%`,  background: "#d29922" }} title={`${draws} empates`} />
        <div style={{ width: `${(losses/total)*100}%`, background: "#f85149" }} title={`${losses} derrotas`} />
      </div>

      {/* scrollable match list */}
      <div style={{ maxHeight: 360, overflowY: "auto", display: "flex",
        flexDirection: "column", gap: 6 }}>
        {matches.map((m, i) => {
          const resultColor = m.result === "win" ? "#3fb950" : m.result === "draw" ? "#d29922" : "#f85149";
          const resultLabel = m.result === "win" ? "V" : m.result === "draw" ? "E" : "D";
          return (
            <div key={m.match_id + "_" + i} style={{
              display: "grid",
              gridTemplateColumns: "24px 1fr 56px 60px 36px",
              alignItems: "center", gap: 8,
              background: "var(--bg2)", borderRadius: 6,
              padding: "8px 10px",
              fontSize: 12,
            }}>
              {/* result badge */}
              <div style={{
                width: 22, height: 22, borderRadius: "50%",
                background: resultColor, display: "flex", alignItems: "center",
                justifyContent: "center", fontWeight: 800, fontSize: 10, color: "#fff", flexShrink: 0
              }}>{resultLabel}</div>

              {/* team + date + competition */}
              <div style={{ overflow: "hidden" }}>
                <div style={{ fontWeight: 600, color: "var(--txt0)", whiteSpace: "nowrap",
                  overflow: "hidden", textOverflow: "ellipsis" }}>{m.team_name}</div>
                <div style={{ fontSize: 10, color: "var(--txt3)" }}>
                  {m.match_date} · {m.competition || "—"}
                </div>
              </div>

              {/* score */}
              <div style={{ textAlign: "center", fontWeight: 800, fontSize: 14,
                color: "var(--txt0)", fontVariantNumeric: "tabular-nums" }}>
                {m.scored}<span style={{ color: "var(--txt3)", margin: "0 2px" }}>–</span>{m.conceded}
              </div>

              {/* pressure x badge */}
              <div style={{ textAlign: "center" }}>
                <div style={{
                  background: `${meta?.color ?? "#58a6ff"}20`,
                  border: `1px solid ${meta?.color ?? "#58a6ff"}50`,
                  borderRadius: 4, padding: "2px 6px", fontSize: 11,
                  color: meta?.color ?? "var(--txt1)", fontWeight: 700,
                }}>
                  x̄ {m.avg_pressure_x}
                </div>
              </div>

              {/* pct att */}
              <div style={{ textAlign: "right", fontSize: 10, color: "var(--txt3)" }}>
                {m.pct_press_att?.toFixed(0)}% atq.
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── sub-components ─────────────────────────────────────────── */
function ChartNote({ source, metric, how }) {
  return (
    <div className="chart-explain">
      {source && <div className="chart-explain-row"><span className="chart-explain-key">Fuente</span><span>{source}</span></div>}
      {metric && <div className="chart-explain-row"><span className="chart-explain-key">Qué mide</span><span>{metric}</span></div>}
      {how    && <div className="chart-explain-row"><span className="chart-explain-key">Cómo</span><span>{how}</span></div>}
    </div>
  );
}

function ScatterTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: "var(--bg1)", border: "1px solid var(--border)",
      borderRadius: 8, padding: "10px 14px", fontSize: 12, minWidth: 180 }}>
      <div style={{ fontWeight: 700, color: LINE_META[d.def_line]?.color ?? "var(--txt0)", marginBottom: 4 }}>
        {d.team_name}
      </div>
      <div>avg_pressure_x: <strong>{Number(d.avg_pressure_x).toFixed(1)}</strong></div>
      <div>Goles marc./partido: <strong>{Number(d.avg_scored).toFixed(2)}</strong></div>
      <div>Goles rec./partido: <strong>{Number(d.avg_conceded).toFixed(2)}</strong></div>
      <div>Win rate: <strong>{d.win_rate}%</strong></div>
      <div>Partidos: <strong>{d.matches}</strong></div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════════════ */
export default function Hyp3View({ data, loading }) {
  /* ── state ── */
  const [selectedTeamId,   setSelectedTeamId]   = useState(null);
  const [selectedTeamName, setSelectedTeamName] = useState("");
  const [selectedLine,     setSelectedLine]     = useState(null);   // "alta"|"media"|"baja"|null
  const [hmData,           setHmData]           = useState(null);
  const [loadingHm,        setLoadingHm]        = useState(false);
  const [matchData,        setMatchData]        = useState([]);
  const [loadingMatches,   setLoadingMatches]   = useState(false);
  const [scatterY,         setScatterY]         = useState("avg_scored");
  const [showSources,      setShowSources]      = useState(false);

  const groupStats   = data?.group_stats   ?? [];
  const teamProfiles = data?.team_profiles ?? [];
  const verdict      = data?.verdict       ?? {};
  const thresholds   = data?.thresholds    ?? {};
  const corrTeam     = data?.corr_team     ?? {};
  const corrMatch    = data?.corr_match    ?? {};

  const gsMap = useMemo(() => {
    const m = {};
    groupStats.forEach(g => { m[g.def_line] = g; });
    return m;
  }, [groupStats]);
  const alta = gsMap["alta"] ?? {};
  const baja = gsMap["baja"] ?? {};

  /* teams sorted by avg_pressure_x desc */
  const teamsSorted = useMemo(() =>
    [...teamProfiles].sort((a, b) => b.avg_pressure_x - a.avg_pressure_x),
    [teamProfiles]
  );

  /* ── fetch heatmap when team changes ── */
  const fetchHeatmap = useCallback((teamId) => {
    setLoadingHm(true);
    const p = teamId ? `?team_id=${teamId}&cell_size=6` : "?cell_size=6";
    fetch(`/api/defensive-line/heatmap${p}`)
      .then(r => r.json())
      .then(d => { setHmData(d); setLoadingHm(false); })
      .catch(() => setLoadingHm(false));
  }, []);

  /* ── fetch match list when line or team changes ── */
  const fetchMatches = useCallback((line, teamId) => {
    if (!line) { setMatchData([]); return; }
    setLoadingMatches(true);
    const p = new URLSearchParams({ def_line: line, limit: "100" });
    if (teamId) p.set("team_id", teamId);
    fetch(`/api/defensive-line/matches?${p}`)
      .then(r => r.json())
      .then(d => { setMatchData(d.matches ?? []); setLoadingMatches(false); })
      .catch(() => setLoadingMatches(false));
  }, []);

  /* initial heatmap: all teams */
  useEffect(() => {
    if (data && !hmData) fetchHeatmap(null);
  }, [data, hmData, fetchHeatmap]);

  /* on team select */
  const handleTeamChange = useCallback((teamId, teamName) => {
    setSelectedTeamId(teamId);
    setSelectedTeamName(teamName);
    fetchHeatmap(teamId || null);
    if (selectedLine) fetchMatches(selectedLine, teamId || null);
  }, [selectedLine, fetchHeatmap, fetchMatches]);

  /* on line button click */
  const handleLineClick = useCallback((line) => {
    const next = selectedLine === line ? null : line;
    setSelectedLine(next);
    fetchMatches(next, selectedTeamId);
  }, [selectedLine, selectedTeamId, fetchMatches]);

  /* scatter */
  const scatterData = useMemo(() =>
    teamProfiles.map(t => ({ ...t, y: t[scatterY] ?? 0 })),
    [teamProfiles, scatterY]
  );

  /* bar data */
  const barData = useMemo(() =>
    ORDER.map(k => {
      const g = gsMap[k] ?? {};
      return { name: LINE_META[k].label, key: k,
        scored: g.scored ?? 0, conceded: g.conceded ?? 0,
        shots_for: g.shots_for ?? 0, win_rate: g.win_rate ?? 0,
        loss_rate: g.loss_rate ?? 0, draw_rate: g.draw_rate ?? 0, n: g.n ?? 0,
        color: LINE_META[k].color };
    }),
    [gsMap]
  );

  const radarData = useMemo(() => {
    const a = gsMap["alta"] ?? {}, m2 = gsMap["media"] ?? {}, b = gsMap["baja"] ?? {};
    return [
      { m: "Goles marc.",  alta: a.scored??0,            media: m2.scored??0,            baja: b.scored??0 },
      { m: "Win rate",     alta: (a.win_rate??0)/2,      media: (m2.win_rate??0)/2,      baja: (b.win_rate??0)/2 },
      { m: "Tiros",        alta: (a.shots_for??0)/5,     media: (m2.shots_for??0)/5,     baja: (b.shots_for??0)/5 },
      { m: "% Pres.Atq.",  alta: (a.pct_press_att??0)/15,media: (m2.pct_press_att??0)/15,baja: (b.pct_press_att??0)/15 },
      { m: "Riesgo",       alta: (a.high_turnovers??0)/20,media: (m2.high_turnovers??0)/20,baja: (b.high_turnovers??0)/20 },
    ];
  }, [gsMap]);

  const hyp1OK = verdict.part1_more_offense_confirmed;
  const hyp2OK = verdict.part2_more_conceded_confirmed;

  if (loading) return (
    <div style={{ display:"flex",flexDirection:"column",alignItems:"center",
      justifyContent:"center",height:"60vh",gap:16 }}>
      <div className="spinner" style={{ width:48,height:48,borderWidth:4 }} />
      <div style={{ color:"var(--txt2)",fontSize:14 }}>
        Calculando análisis de línea defensiva — ~30 s…
      </div>
    </div>
  );
  if (!data) return null;

  return (
    <div style={{ paddingTop: 20 }}>

      {/* ══ HIPÓTESIS + METODOLOGÍA ══════════════════════════════ */}
      <div className="section">
        <div className="section-label">Planteamiento &amp; Metodología</div>
        <div className="hyp-block">
          <div className="hyp-statement">
            <span className="hyp-icon">🛡️</span>
            <span>
              Los equipos con <em style={{ color:"#f85149" }}>línea defensiva alta</em>{" "}
              generan más oportunidades ofensivas, pero también tienen mayor
              probabilidad de recibir goles frente a los de{" "}
              <em style={{ color:"#58a6ff" }}>línea baja</em>.
            </span>
          </div>
          <p className="hyp-desc">
            Proxy: <code className="inline-code-sm">avg_pressure_x</code> — coordenada x media
            de los eventos <em>Pressure</em> por equipo-partido. Campo StatsBomb: x ∈ [0,120].
            Clasificación por tertiles:{" "}
            <span style={{ color:"#58a6ff" }}>Baja</span> (&lt;{thresholds.q33}),{" "}
            <span style={{ color:"#d29922" }}>Media</span> ({thresholds.q33}–{thresholds.q67}),{" "}
            <span style={{ color:"#f85149" }}>Alta</span> (&gt;{thresholds.q67}).
          </p>

          <div className="method-section">
            <button className="method-toggle" onClick={() => setShowSources(v=>!v)}>
              <span>🗄️</span><span>Fuentes de datos y pipeline</span>
              <span className="method-toggle-icon">{showSources?"▲":"▼"}</span>
            </button>
            {showSources && (
              <div className="method-expanded">
                <div className="pipeline-steps">
                  <div className="pipeline-title">Pipeline de cálculo</div>
                  {[
                    {paso:"1",desc:"events_fact → event_type_name='Pressure', x no nulo → agrupar por (match_id, team_id)"},
                    {paso:"2",desc:"avg_pressure_x = AVG(x de Pressure). Alto = equipo presiona lejos de su portería"},
                    {paso:"3",desc:"Clasificar por tertiles Q33/Q67 → Alta, Media, Baja"},
                    {paso:"4",desc:"JOIN con matches_fact por match_id+team_id → scored, conceded, resultado"},
                    {paso:"5",desc:"Agrupar por def_line → medias, win rate, correlaciones"},
                    {paso:"6",desc:"Mapa de calor: grilla 6×6 yds sobre el campo, contar Pressure por celda → intensidad = count/max"},
                  ].map(s=>(
                    <div className="pipeline-step" key={s.paso}>
                      <span className="pipeline-num">{s.paso}</span>
                      <span className="pipeline-desc">{s.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="hyp-kpis">
            {[
              { val: corrTeam.pressure_x_vs_scored?.toFixed(3)??"—",   label:"r línea→goles marc.",  sub:"Pearson por equipo" },
              { val: corrTeam.pressure_x_vs_conceded?.toFixed(3)??"—", label:"r línea→goles rec.",   sub:"Pearson por equipo" },
              { val: corrTeam.pressure_x_vs_shots?.toFixed(3)??"—",    label:"r línea→tiros",        sub:"Pearson por equipo" },
              { val: `${alta.scored?.toFixed(2)??"—"}`,                 label:"Goles/p (Alta)",       sub:`vs ${baja.scored?.toFixed(2)??"—"} de Baja` },
              { val: `${alta.conceded?.toFixed(2)??"—"}`,               label:"Recibidos/p (Alta)",   sub:`vs ${baja.conceded?.toFixed(2)??"—"} de Baja` },
            ].map((k,i)=>(
              <div className="hyp-kpi" key={i}>
                <div className="hyp-kpi-val">{k.val}</div>
                <div className="hyp-kpi-label">{k.label}</div>
                <div className="hyp-kpi-sub">{k.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:16 }}>
            {[
              { ok:hyp1OK,  title:`Parte 1: más oportunidades ofensivas — ${hyp1OK?"CONFIRMADA":"REFUTADA"}`,
                body:`Alta: ${alta.shots_for?.toFixed(1)} tiros/p, ${alta.scored?.toFixed(2)} goles/p · Baja: ${baja.shots_for?.toFixed(1)} tiros/p, ${baja.scored?.toFixed(2)} goles/p. ${hyp1OK?"✓ Confirmada.":"No confirmada."}` },
              { ok:hyp2OK,  title:`Parte 2: más goles recibidos — ${hyp2OK?"CONFIRMADA":"REFUTADA"}`,
                body:`Alta recibe ${alta.conceded?.toFixed(2)}/p vs ${baja.conceded?.toFixed(2)}/p de Baja. ${hyp2OK?"":"La línea alta recibe MENOS goles. Los equipos top que presionan alto también defienden mejor."}` },
            ].map((v,i)=>(
              <div key={i} style={{
                display:"flex",gap:12,padding:"14px 16px",borderRadius:10,
                border:`1px solid ${v.ok?"rgba(63,185,80,.3)":"rgba(248,81,73,.3)"}`,
                background:v.ok?"rgba(63,185,80,.08)":"rgba(248,81,73,.08)",
              }}>
                <span style={{fontSize:22}}>{v.ok?"✅":"❌"}</span>
                <div>
                  <div style={{fontWeight:700,fontSize:13,color:v.ok?"var(--green)":"var(--red)",marginBottom:4}}>{v.title}</div>
                  <p style={{fontSize:12,color:"var(--txt2)",lineHeight:1.5}}>{v.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ HEATMAP INTERACTIVO ══════════════════════════════════ */}
      <div className="section">
        <div className="section-label">Mapa de calor de presión — interactivo por equipo</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 440px", gap:20, alignItems:"start" }}>

          {/* LEFT: heatmap + controls */}
          <div className="card" style={{ padding:0, overflow:"hidden" }}>

            {/* top bar: team selector + line buttons */}
            <div style={{ padding:"12px 14px", borderBottom:"1px solid var(--border)",
              background:"var(--bg0)", display:"flex", alignItems:"center",
              gap:12, flexWrap:"wrap" }}>

              <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                <span style={{ fontSize:9, textTransform:"uppercase", letterSpacing:".5px",
                  color:"var(--txt3)", fontWeight:700 }}>Equipo</span>
                <select
                  value={selectedTeamId ?? ""}
                  onChange={e => {
                    const tid = e.target.value ? +e.target.value : null;
                    const tname = e.target.options[e.target.selectedIndex].text;
                    handleTeamChange(tid, tid ? tname : "");
                  }}
                  style={{ background:"var(--bg2)", color:"var(--txt0)", border:"1px solid var(--border)",
                    borderRadius:6, padding:"5px 8px", fontSize:12, fontFamily:"inherit", minWidth:180 }}>
                  <option value="">Todos los equipos</option>
                  {teamsSorted.map(t => (
                    <option key={t.team_id} value={t.team_id}>
                      {t.team_name} (x̄={t.avg_pressure_x?.toFixed(1)})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ width:1, height:32, background:"var(--border)" }} />

              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                <span style={{ fontSize:9, textTransform:"uppercase", letterSpacing:".5px",
                  color:"var(--txt3)", fontWeight:700 }}>Ver partidos de línea</span>
                <div style={{ display:"flex", gap:6 }}>
                  {ORDER.map(line => {
                    const meta = LINE_META[line];
                    const active = selectedLine === line;
                    return (
                      <button key={line} onClick={() => handleLineClick(line)}
                        style={{
                          padding:"4px 12px", borderRadius:20, fontSize:11,
                          fontFamily:"inherit", cursor:"pointer",
                          border:`1px solid ${active ? meta.color : "var(--border)"}`,
                          background: active ? `${meta.color}25` : "var(--bg2)",
                          color: active ? meta.color : "var(--txt2)",
                          fontWeight: active ? 700 : 400,
                          transition:"all .15s",
                        }}>
                        {meta.icon} {meta.label}
                      </button>
                    );
                  })}
                  {selectedLine && (
                    <button onClick={() => handleLineClick(selectedLine)}
                      style={{ padding:"4px 8px", borderRadius:20, fontSize:11,
                        background:"var(--bg2)", border:"1px solid var(--border)",
                        color:"var(--txt3)", cursor:"pointer", fontFamily:"inherit" }}>
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {selectedTeamId && hmData && (
                <div style={{ marginLeft:"auto", display:"flex", flexDirection:"column",
                  alignItems:"flex-end", gap:2 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:"var(--txt0)" }}>
                    {selectedTeamName}
                  </span>
                  <span style={{
                    fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:10,
                    background: `${LINE_META[
                      hmData.avg_pressure_x > thresholds.q67 ? "alta" :
                      hmData.avg_pressure_x > thresholds.q33 ? "media" : "baja"
                    ]?.color}25`,
                    color: LINE_META[
                      hmData.avg_pressure_x > thresholds.q67 ? "alta" :
                      hmData.avg_pressure_x > thresholds.q33 ? "media" : "baja"
                    ]?.color,
                  }}>
                    {LINE_META[
                      hmData.avg_pressure_x > thresholds.q67 ? "alta" :
                      hmData.avg_pressure_x > thresholds.q33 ? "media" : "baja"
                    ]?.label} · x̄={hmData.avg_pressure_x?.toFixed(1)}
                  </span>
                </div>
              )}
            </div>

            {/* heatmap SVG */}
            <div style={{ padding:"12px 14px 8px" }}>
              <PressureHeatmap
                cells={hmData?.cells ?? []}
                avgPressureX={hmData?.avg_pressure_x}
                maxCount={hmData?.max_count}
                totalEvents={hmData?.total_events}
                thresholds={thresholds}
                cellSize={hmData?.cell_size ?? 6}
                loadingHm={loadingHm}
              />
            </div>

            <div style={{ padding:"0 14px 12px" }}>
              <ChartNote
                source="events_fact — event_type_name = 'Pressure', columnas x e y"
                metric="Densidad de eventos de presión en cada celda 6×6 yds del campo. Rojo = zona de máxima presión del equipo"
                how="Línea blanca = avg_pressure_x del equipo/selección. Líneas discontinuas azul/roja = umbrales Q33/Q67. Hover sobre celdas para ver conteo."
              />
            </div>
          </div>

          {/* RIGHT: match list */}
          <div className="card">
            <div className="card-title" style={{ marginBottom:12 }}>
              <span className="card-title-icon">📋</span>
              {selectedLine
                ? `Partidos — ${LINE_META[selectedLine]?.label}${selectedTeamName ? " · " + selectedTeamName : ""}`
                : "Selecciona un tipo de línea para ver partidos"}
            </div>
            <MatchList
              matches={matchData}
              loading={loadingMatches}
              selectedLine={selectedLine}
              thresholds={thresholds}
            />
            {!selectedLine && (
              <div style={{ color:"var(--txt3)", fontSize:12, lineHeight:1.6 }}>
                Haz clic en <strong>Línea Alta</strong>, <strong>Línea Media</strong> o{" "}
                <strong>Línea Baja</strong> en el panel izquierdo para ver los partidos
                correspondientes con sus resultados y métricas de presión.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══ GRÁFICAS COMPARATIVAS ════════════════════════════════ */}
      <div className="section">
        <div className="section-label">Comparativa estadística por tipo de línea</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 }}>

          {/* win/draw/loss */}
          <div className="card">
            <div className="card-title"><span className="card-title-icon">🏆</span>Resultados por línea</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} margin={{ left:0,right:4,bottom:4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--bg3)" />
                <XAxis dataKey="name" stroke="var(--txt3)" fontSize={10} />
                <YAxis stroke="var(--txt3)" fontSize={10} unit="%" />
                <Tooltip contentStyle={{ background:"var(--bg1)",border:"1px solid var(--border)",fontSize:11 }}
                  formatter={(v,n) => [`${Number(v).toFixed(1)}%`, n]} />
                <Legend wrapperStyle={{ fontSize:10 }} />
                <Bar dataKey="win_rate"  name="Victorias" stackId="r" radius={[0,0,0,0]}>
                  {barData.map(e=><Cell key={e.key} fill="#3fb950"/>)}
                </Bar>
                <Bar dataKey="draw_rate" name="Empates"   stackId="r">
                  {barData.map(e=><Cell key={e.key} fill="#d29922"/>)}
                </Bar>
                <Bar dataKey="loss_rate" name="Derrotas"  stackId="r">
                  {barData.map(e=><Cell key={e.key} fill="#f85149"/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <ChartNote
              source="events_fact ⋈ matches_fact"
              how="n=2286 por grupo. Alta: 50% victorias, Baja: 30% victorias."
            />
          </div>

          {/* scored vs conceded */}
          <div className="card">
            <div className="card-title"><span className="card-title-icon">⚽</span>Goles marcados y recibidos</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} margin={{ left:0,right:4,bottom:4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--bg3)" />
                <XAxis dataKey="name" stroke="var(--txt3)" fontSize={10} />
                <YAxis stroke="var(--txt3)" fontSize={10} domain={[0,2.2]} />
                <Tooltip contentStyle={{ background:"var(--bg1)",border:"1px solid var(--border)",fontSize:11 }}
                  formatter={(v,n) => [Number(v).toFixed(3), n]} />
                <Legend wrapperStyle={{ fontSize:10 }} />
                <Bar dataKey="scored"   name="Marcados"  radius={[3,3,0,0]}>
                  {barData.map(e=><Cell key={e.key} fill={LINE_META[e.key].color}/>)}
                </Bar>
                <Bar dataKey="conceded" name="Recibidos" fill="var(--bg3)" opacity={0.7} radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
            <ChartNote
              how="Alta: 1.77 marc./1.16 rec. · Baja: 1.19 marc./1.66 rec. La línea alta recibe MENOS goles."
            />
          </div>

          {/* radar */}
          <div className="card">
            <div className="card-title"><span className="card-title-icon">📡</span>Perfil multidimensional</div>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData} margin={{ top:10,right:20,bottom:10,left:20 }}>
                <PolarGrid stroke="var(--bg3)" />
                <PolarAngleAxis dataKey="m" tick={{ fill:"var(--txt2)", fontSize:9 }} />
                <PolarRadiusAxis tick={false} axisLine={false} />
                <Radar name="Alta"  dataKey="alta"  stroke="#f85149" fill="#f85149" fillOpacity={0.15} />
                <Radar name="Media" dataKey="media" stroke="#d29922" fill="#d29922" fillOpacity={0.08} />
                <Radar name="Baja"  dataKey="baja"  stroke="#58a6ff" fill="#58a6ff" fillOpacity={0.08} />
                <Legend wrapperStyle={{ fontSize:10 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ══ SCATTER ══════════════════════════════════════════════ */}
      <div className="section">
        <div className="section-label">Perfil por equipo — línea defensiva vs eficacia (≥10 partidos)</div>
        <div className="card">
          <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:12,flexWrap:"wrap" }}>
            <div className="card-title" style={{ margin:0 }}>
              <span className="card-title-icon">🔵</span>avg_pressure_x vs eficacia
            </div>
            <div style={{ marginLeft:"auto",display:"flex",gap:6,alignItems:"center",flexWrap:"wrap" }}>
              {[
                {key:"avg_scored",   label:"Goles marc./p"},
                {key:"avg_conceded", label:"Goles rec./p"},
                {key:"avg_shots",    label:"Tiros/p"},
                {key:"win_rate",     label:"Win rate %"},
              ].map(o=>(
                <button key={o.key} onClick={()=>setScatterY(o.key)}
                  style={{
                    padding:"3px 10px",borderRadius:20,fontSize:11,fontFamily:"inherit",
                    cursor:"pointer",border:"1px solid",
                    background:scatterY===o.key?"var(--blue)":"var(--bg2)",
                    borderColor:scatterY===o.key?"var(--blue)":"var(--border)",
                    color:scatterY===o.key?"#fff":"var(--txt2)",
                  }}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={360}>
            <ScatterChart margin={{ top:10,right:30,bottom:36,left:10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--bg3)" />
              <XAxis type="number" dataKey="avg_pressure_x" stroke="var(--txt3)" fontSize={11}>
                <Label value="avg_pressure_x (posición media de presión, yds)"
                  offset={-14} position="insideBottom" fill="var(--txt3)" fontSize={11} />
              </XAxis>
              <YAxis type="number" dataKey="y" stroke="var(--txt3)" fontSize={11} />
              <ZAxis type="number" dataKey="matches" range={[20,350]} />
              <Tooltip content={<ScatterTip />} />
              <ReferenceLine x={thresholds.q33} stroke="#58a6ff" strokeDasharray="4 4" strokeOpacity={0.5}
                label={{ value:`Q33 (${thresholds.q33})`, fill:"#58a6ff", fontSize:9, position:"top" }} />
              <ReferenceLine x={thresholds.q67} stroke="#f85149" strokeDasharray="4 4" strokeOpacity={0.5}
                label={{ value:`Q67 (${thresholds.q67})`, fill:"#f85149", fontSize:9, position:"top" }} />
              <Scatter data={scatterData}
                shape={({cx,cy,payload}) => {
                  const c = LINE_META[payload.def_line]?.color ?? "#6e7681";
                  return <circle cx={cx} cy={cy} r={5} fill={c} fillOpacity={0.82} />;
                }}
              />
            </ScatterChart>
          </ResponsiveContainer>
          <div style={{ display:"flex",gap:16,justifyContent:"center",margin:"6px 0" }}>
            {ORDER.map(k=>(
              <div key={k} style={{ display:"flex",alignItems:"center",gap:5,fontSize:11,color:"var(--txt2)" }}>
                <span style={{ width:10,height:10,borderRadius:"50%",background:LINE_META[k].color,display:"inline-block" }} />
                {LINE_META[k].label}
              </div>
            ))}
          </div>
          <ChartNote
            source={`events_fact ⋈ matches_fact — por equipo (n=${data?.model?.teams_ge10_matches ?? "—"})`}
            metric="Cada punto = 1 equipo. Tamaño ∝ partidos. Color = clasificación de línea"
            how={`r(pressure_x→goles marc.)=${corrTeam.pressure_x_vs_scored?.toFixed(3)}  r(pressure_x→goles rec.)=${corrTeam.pressure_x_vs_conceded?.toFixed(3)}`}
          />
        </div>
      </div>

      {/* ══ INSIGHTS ═════════════════════════════════════════════ */}
      <div className="section">
        <div className="section-label">Insights clave</div>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16 }}>
          {[
            { icon:"✅", accent:"#3fb950",
              title:"Parte 1 confirmada: más ataque",
              body:`Alta: ${alta.shots_for?.toFixed(1)} tiros/p (+${((alta.shots_for-baja.shots_for)/baja.shots_for*100).toFixed(0)}%). r(línea→tiros)=${corrTeam.pressure_x_vs_shots?.toFixed(3)}. El pressing alto genera más oportunidades claras.` },
            { icon:"❌", accent:"#f85149",
              title:"Parte 2 refutada: reciben MENOS goles",
              body:`Alta recibe ${alta.conceded?.toFixed(2)}/p vs ${baja.conceded?.toFixed(2)}/p de Baja. r(línea→goles rec.)=${corrTeam.pressure_x_vs_conceded?.toFixed(3)} (negativo). Equipos como Arsenal WFC (x̄=63) o Chelsea FCW (x̄=67) tienen win rate del 72-79%.` },
            { icon:"⚠️", accent:"#d29922",
              title:"Riesgo real pero gestionable",
              body:`r(línea→turnovers)=${corrMatch.pressure_x_vs_turnovers?.toFixed(3)}. Los equipos alta tienen más pérdidas en zona alta (${alta.high_turnovers?.toFixed(1)} vs ${baja.high_turnovers?.toFixed(1)}/p). Pero su win rate: ${alta.win_rate?.toFixed(1)}% vs ${baja.win_rate?.toFixed(1)}% de Baja.` },
          ].map(c=>(
            <div key={c.title} style={{
              background:"var(--bg1)", border:"1px solid var(--border)",
              borderLeft:`3px solid ${c.accent}`, borderRadius:10, padding:"16px 20px",
            }}>
              <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:8 }}>
                <span style={{ fontSize:22 }}>{c.icon}</span>
                <span style={{ fontSize:14,fontWeight:700,color:"var(--txt0)" }}>{c.title}</span>
              </div>
              <div style={{ fontSize:13,color:"var(--txt2)",lineHeight:1.7 }}>{c.body}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
