import React, { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ScatterChart, Scatter, ZAxis, ReferenceLine, Label,
} from "recharts";

/* ── helpers ──────────────────────────────────────────────── */
const fmt = (n, d = 1) => (n == null ? "—" : Number(n).toFixed(d));

const STYLE_META = {
  contragolpe: { color: "#f85149", label: "Contragolpe", icon: "⚡",
    def: "> 5% de los pases del equipo en ese partido provienen del patrón 'From Counter'" },
  mixto:       { color: "#d29922", label: "Mixto",       icon: "⚖️",
    def: "Entre 1% y 5% de los pases provienen de 'From Counter'" },
  elaborado:   { color: "#58a6ff", label: "Elaborado",   icon: "🏗️",
    def: "< 1% de los pases provienen de 'From Counter' (juego de posesión pura)" },
};

const PATTERN_COLORS = {
  "From Counter":   "#f85149",
  "Regular Play":   "#58a6ff",
  "From Corner":    "#bc8cff",
  "From Free Kick": "#d29922",
  "From Throw In":  "#3fb950",
  "From Goal Kick": "#39d353",
  "From Keeper":    "#79c0ff",
  "From Kick Off":  "#ffa657",
  "Other":          "#6e7681",
};

/* ── data sources & pipeline for H2 ─────────────────────── */
const SOURCES_H2 = [
  {
    tabla: "events_fact.parquet",
    columnas: "match_id, team_id, team_name, event_type_name, play_pattern_name",
    uso: "Contar pases y tiros por equipo-partido, segmentados por play_pattern_name",
  },
  {
    tabla: "matches_fact.parquet",
    columnas: "match_id, home_team_id, away_team_id, home_score, away_score",
    uso: "Obtener resultado (home_score vs away_score) para derivar victoria/empate/derrota por equipo",
  },
];

const PIPELINE_H2 = [
  { paso: "1", desc: "events_fact → filtrar event_type_name IN ('Pass', 'Shot'), agrupar por (match_id, team_id)" },
  { paso: "2", desc: "Contar passes WHERE play_pattern_name = 'From Counter' → passes_counter" },
  { paso: "3", desc: "Calcular counter_pct = passes_counter / total_passes × 100 por equipo-partido" },
  { paso: "4", desc: "Clasificar: counter_pct > 5% → Contragolpe · 1–5% → Mixto · < 1% → Elaborado" },
  { paso: "5", desc: "matches_fact → derivar resultado: home_score > away_score → win (home), loss (away), etc." },
  { paso: "6", desc: "JOIN equipo-partido ↔ resultado usando match_id + team_id → win/draw/loss por fila" },
  { paso: "7", desc: "Agrupar por estilo → win rate, avg_goals, avg_shots. Agrupar por equipo → perfil agregado" },
  { paso: "8", desc: "Correlación Pearson: counter_pct vs win_rate, counter_pct vs avg_goals (a nivel equipo)" },
];

/* ── small components ────────────────────────────────────── */
function ChartNote({ source, metric, how, axes }) {
  return (
    <div className="chart-explain">
      {source && (
        <div className="chart-explain-row">
          <span className="chart-explain-key">Fuente</span>
          <span>{source}</span>
        </div>
      )}
      {metric && (
        <div className="chart-explain-row">
          <span className="chart-explain-key">Qué mide</span>
          <span>{metric}</span>
        </div>
      )}
      {axes && (
        <div className="chart-explain-row">
          <span className="chart-explain-key">Ejes</span>
          <span>{axes}</span>
        </div>
      )}
      {how && (
        <div className="chart-explain-row">
          <span className="chart-explain-key">Cómo</span>
          <span>{how}</span>
        </div>
      )}
    </div>
  );
}

function Callout({ icon, title, children, accent = "var(--blue)" }) {
  return (
    <div style={{
      background: "var(--bg1)", border: `1px solid var(--border)`,
      borderLeft: `3px solid ${accent}`, borderRadius: 10, padding: "16px 20px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--txt0)" }}>{title}</span>
      </div>
      <div style={{ fontSize: 13, color: "var(--txt2)", lineHeight: 1.7 }}>{children}</div>
    </div>
  );
}

function ScatterTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: "var(--bg1)", border: "1px solid var(--border)",
      borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
      <div style={{ fontWeight: 700, color: "var(--txt0)", marginBottom: 4 }}>{d.team_name}</div>
      <div>% contragolpe: <strong>{fmt(d.avg_counter_pct)}%</strong></div>
      <div>Goles/partido: <strong>{fmt(d.avg_goals, 2)}</strong></div>
      <div>Win rate: <strong>{fmt(d.win_rate)}%</strong></div>
      <div>Partidos: <strong>{d.matches}</strong></div>
    </div>
  );
}

function WinRateBar({ style, data }) {
  const meta = STYLE_META[style] ?? { color: "#6e7681", label: style, icon: "?" };
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 18, lineHeight: 1 }}>{meta.icon}</span>
        <div>
          <div style={{ fontWeight: 700, color: meta.color, fontSize: 14 }}>{meta.label}</div>
          <div style={{ fontSize: 11, color: "var(--txt3)", lineHeight: 1.4, marginTop: 1 }}>
            {meta.def}
          </div>
        </div>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--txt2)", flexShrink: 0 }}>
          n = {data.total?.toLocaleString("es-ES")} equipos-partido
        </span>
      </div>
      <div style={{ display: "flex", height: 26, borderRadius: 6, overflow: "hidden" }}>
        {[
          { key: "win_pct",  color: "#3fb950", label: "Victoria" },
          { key: "draw_pct", color: "#d29922", label: "Empate"   },
          { key: "loss_pct", color: "#f85149", label: "Derrota"  },
        ].map(({ key, color, label }) => {
          const val = data[key] ?? 0;
          return (
            <div key={key} title={`${label}: ${fmt(val)}%`}
              style={{ width: `${val}%`, background: color, display: "flex",
                alignItems: "center", justifyContent: "center",
                fontSize: 10, color: "#fff", fontWeight: 700 }}>
              {val > 9 ? `${fmt(val)}%` : ""}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 6, fontSize: 12, color: "var(--txt2)" }}>
        <span style={{ color: "#3fb950", fontWeight: 600 }}>✓ {fmt(data.win_pct)}% victorias</span>
        <span style={{ color: "#d29922" }}>~ {fmt(data.draw_pct)}% empates</span>
        <span style={{ color: "#f85149" }}>✗ {fmt(data.loss_pct)}% derrotas</span>
        <span style={{ marginLeft: "auto" }}>⚽ {fmt(data.avg_goals, 2)} goles/partido</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════════ */
export default function Hyp2View({ data, loading }) {
  const [scatterAxis,  setScatterAxis]  = useState("avg_goals");
  const [showSources,  setShowSources]  = useState(false);

  const chainStats   = data?.chain_stats ?? [];
  const styleBrk     = data?.style_breakdown ?? [];
  const teamProfiles = data?.team_profiles ?? [];
  const verdict      = data?.verdict ?? {};

  const styleMap = useMemo(() => {
    const m = {};
    styleBrk.forEach(s => { m[s.style] = s; });
    return m;
  }, [styleBrk]);

  const chainBar = useMemo(() =>
    [...chainStats]
      .sort((a, b) => b.avg_passes - a.avg_passes)
      .map(c => ({
        name: c.play_pattern_name.replace("From ", "").replace("Regular Play", "Regular"),
        fullName: c.play_pattern_name,
        avg_passes: c.avg_passes,
        shot_rate:  c.shot_rate_pct,
        possessions: c.total_possessions,
      })),
    [chainStats]
  );

  const scatterData = useMemo(() =>
    teamProfiles.map(t => ({ ...t, y: t[scatterAxis] })),
    [teamProfiles, scatterAxis]
  );

  const hypothesisConfirmed = verdict.confirmed ?? false;

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", height: "60vh", gap: 16 }}>
        <div className="spinner" style={{ width: 48, height: 48, borderWidth: 4 }} />
        <div style={{ color: "var(--txt2)", fontSize: 14 }}>
          Calculando análisis de contragolpe — puede tardar ~30 s…
        </div>
      </div>
    );
  }
  if (!data) return null;

  /* ── short axis label ── */
  const scatterYLabel = {
    avg_goals:        "Goles / partido",
    win_rate:         "Win rate (%)",
    avg_total_shots:  "Tiros / partido",
  }[scatterAxis] ?? scatterAxis;

  return (
    <div style={{ paddingTop: 20 }}>

      {/* ══ PLANTEAMIENTO ══════════════════════════════════════ */}
      <div className="section">
        <div className="section-label">Planteamiento &amp; Metodología</div>

        <div className="hyp-block">
          <div className="hyp-statement">
            <span className="hyp-icon">⚡</span>
            <span>
              Los equipos que construyen jugadas con más pases (juego{" "}
              <em style={{ color: "#58a6ff" }}>elaborado</em>) son más eficaces
              y ganan más partidos que los que explotan el{" "}
              <em style={{ color: "#f85149" }}>contragolpe</em> (transiciones rápidas con pocos pases).
            </span>
          </div>

          <p className="hyp-desc">
            StatsBomb etiqueta cada evento con el campo{" "}
            <code className="inline-code-sm">play_pattern_name</code>, que describe
            cómo comenzó esa posesión. El valor{" "}
            <code className="inline-code-sm">"From Counter"</code> indica que la
            posesión comenzó recuperando el balón y atacando de forma rápida y
            directa. Usamos el <strong>porcentaje de pases realizados
            bajo ese patrón</strong> (counter_pct) para clasificar el estilo de juego
            de cada equipo en cada partido.
          </p>

          {/* style definition table */}
          <div className="method-section">
            <div className="method-section-title">
              <span>🎯</span> Definición de estilos de juego
            </div>
            <table className="sources-table" style={{ marginBottom: 0 }}>
              <thead>
                <tr>
                  <th>Estilo</th>
                  <th>Condición (counter_pct)</th>
                  <th>Qué significa</th>
                  <th>Campo usado</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(STYLE_META).map(([k, m]) => (
                  <tr key={k}>
                    <td>
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%",
                          background: m.color, display: "inline-block", flexShrink: 0 }} />
                        <strong style={{ color: m.color }}>{m.label}</strong>
                      </span>
                    </td>
                    <td>
                      <code className="inline-code-sm">
                        {k === "contragolpe" ? "> 5%"
                          : k === "mixto"    ? "1% – 5%"
                          :                   "< 1%"}
                      </code>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--txt2)" }}>{m.def}</td>
                    <td>
                      <code className="inline-code-sm">events_fact.play_pattern_name</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="method-note">
              <strong>counter_pct</strong> = (pases con play_pattern_name = "From Counter") ÷ total_pases_equipo_partido × 100.
              Se calcula para cada combinación (match_id, team_id) y refleja cuán dependiente
              fue el equipo del contragolpe en ese partido específico.
            </p>
          </div>

          {/* sources & pipeline collapsible */}
          <div className="method-section">
            <button className="method-toggle" onClick={() => setShowSources(v => !v)}>
              <span>🗄️</span>
              <span>Fuentes de datos y pipeline de cálculo</span>
              <span className="method-toggle-icon">{showSources ? "▲" : "▼"}</span>
            </button>

            {showSources && (
              <div className="method-expanded">
                <div className="sources-table-wrap">
                  <table className="sources-table">
                    <thead>
                      <tr>
                        <th>Tabla parquet</th>
                        <th>Columnas clave</th>
                        <th>Propósito</th>
                      </tr>
                    </thead>
                    <tbody>
                      {SOURCES_H2.map(s => (
                        <tr key={s.tabla}>
                          <td><code className="inline-code">{s.tabla}</code></td>
                          <td><code className="inline-code small">{s.columnas}</code></td>
                          <td>{s.uso}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="pipeline-steps">
                  <div className="pipeline-title">Pipeline de cálculo</div>
                  {PIPELINE_H2.map(s => (
                    <div className="pipeline-step" key={s.paso}>
                      <span className="pipeline-num">{s.paso}</span>
                      <span className="pipeline-desc">{s.desc}</span>
                    </div>
                  ))}
                </div>
                <p className="method-note" style={{ marginTop: 12 }}>
                  Solo se incluyen equipos con <strong>≥ 5 partidos</strong> en el análisis por equipo
                  para garantizar representatividad estadística.
                  El <strong>resultado por equipo</strong> se deriva comparando
                  home_score vs away_score de matches_fact.
                </p>
              </div>
            )}
          </div>

          {/* KPIs */}
          <div className="hyp-kpis">
            {[
              { val: teamProfiles.length, label: "Equipos analizados", sub: "con ≥ 5 partidos" },
              { val: fmt(verdict.corr_counter_vs_winrate, 3),
                label: "r  contra% → win rate", sub: "Pearson por equipo" },
              { val: fmt(verdict.corr_counter_vs_goals, 3),
                label: "r  contra% → goles", sub: "Pearson por equipo" },
              { val: `${fmt(styleMap.elaborado?.win_pct)}%`,
                label: "Win rate Elaborado", sub: `n=${styleMap.elaborado?.total?.toLocaleString("es-ES")}` },
              { val: `${fmt(styleMap.contragolpe?.win_pct)}%`,
                label: "Win rate Contragolpe", sub: `n=${styleMap.contragolpe?.total?.toLocaleString("es-ES")}` },
            ].map((k, i) => (
              <div className="hyp-kpi" key={i}>
                <div className="hyp-kpi-val">{k.val}</div>
                <div className="hyp-kpi-label">{k.label}</div>
                <div className="hyp-kpi-sub">{k.sub}</div>
              </div>
            ))}
          </div>

          {/* verdict */}
          <div className={`verdict-block${hypothesisConfirmed ? "" : " false"}`}>
            <span className="verdict-emoji">{hypothesisConfirmed ? "✅" : "❌"}</span>
            <div className="verdict-content">
              <div className="verdict-title">
                {hypothesisConfirmed
                  ? "Hipótesis CONFIRMADA — el juego elaborado sí genera más goles"
                  : "Hipótesis REFUTADA — el contragolpe es más efectivo de lo esperado"}
              </div>
              <p className="verdict-body">
                Correlación <strong>counter_pct → goles/partido</strong>:{" "}
                <strong style={{ color: verdict.corr_counter_vs_goals < 0 ? "var(--green)" : "var(--red)" }}>
                  r = {fmt(verdict.corr_counter_vs_goals, 3)}
                </strong>
                {hypothesisConfirmed
                  ? ". Relación negativa: a mayor dependencia del contragolpe, menos goles en promedio. Los equipos más elaborados (Arsenal WFC, Spain Women's, Barcelona) lideran en goles y victorias."
                  : ". Relación positiva inesperada: los equipos con más contragolpe ganan más. Pero el tamaño muestral del grupo Contragolpe es muy pequeño (n = "
                    + (styleMap.contragolpe?.total ?? "?")
                    + " equipos-partido), por lo que las conclusiones deben tomarse con cautela."
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ══ RESULTADOS POR ESTILO ══════════════════════════════ */}
      <div className="section">
        <div className="section-label">Resultados según estilo de juego</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

          {/* win-rate stacked bars */}
          <div className="card">
            <div className="card-title">
              <span className="card-title-icon">🏆</span>Tasa de victoria por estilo
            </div>
            {["contragolpe", "mixto", "elaborado"].map(s =>
              styleMap[s] ? <WinRateBar key={s} style={s} data={styleMap[s]} /> : null
            )}
            <ChartNote
              source="events_fact ⋈ matches_fact — todos los partidos del dataset"
              metric="% de partidos ganados, empatados y perdidos según el estilo clasificado"
              how="Cada barra apilada = distribución porcentual Win/Draw/Loss para el grupo. Ancho = proporción. Los números dentro de la barra son los porcentajes."
            />
          </div>

          {/* chain stats dual-axis bar */}
          <div className="card">
            <div className="card-title">
              <span className="card-title-icon">📊</span>
              Pases/posesión vs tasa de tiro — por patrón de inicio
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chainBar} margin={{ left: 0, right: 20, bottom: 55 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--bg3)" />
                <XAxis dataKey="name" stroke="var(--txt3)" fontSize={10}
                  angle={-40} textAnchor="end" interval={0} />
                <YAxis yAxisId="passes" stroke="#58a6ff" fontSize={10}
                  label={{ value: "Pases/posesión", angle: -90,
                    position: "insideLeft", fill: "#58a6ff", fontSize: 10, dx: 12 }} />
                <YAxis yAxisId="shots" orientation="right" stroke="#f85149" fontSize={10}
                  label={{ value: "Tiros (%)", angle: 90,
                    position: "insideRight", fill: "#f85149", fontSize: 10, dx: -12 }} />
                <Tooltip
                  formatter={(v, n) => [Number(v).toFixed(2), n]}
                  contentStyle={{ background: "var(--bg1)", border: "1px solid var(--border)", fontSize: 12 }}
                />
                <Legend wrapperStyle={{ paddingTop: 52, fontSize: 11 }} />
                <Bar yAxisId="passes" dataKey="avg_passes" name="Pases/posesión" fill="#58a6ff" radius={[3,3,0,0]} />
                <Bar yAxisId="shots"  dataKey="shot_rate"  name="Tiros/posesión %" fill="#f85149" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
            <ChartNote
              source="events_fact — agrupado por (match_id, team_id, possession, play_pattern_name)"
              metric="Promedio de pases por posesión (eje azul/izq.) y % de posesiones que terminan en tiro (eje rojo/der.)"
              axes="Eje X = patrón de inicio de posesión · Eje Y izq. = pases promedio · Eje Y der. = tasa de tiro (%)"
              how="Una posesión se define como el conjunto de eventos con el mismo valor de possession en el mismo partido. La tasa de tiro = posesiones_con_tiro / total_posesiones × 100."
            />
          </div>
        </div>
      </div>

      {/* ══ SCATTER EQUIPOS ════════════════════════════════════ */}
      <div className="section">
        <div className="section-label">Perfil de equipos — % contragolpe vs eficacia</div>
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
            <div className="card-title" style={{ margin: 0 }}>
              <span className="card-title-icon">🔵</span>Dispersión por equipo (≥ 5 partidos)
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "var(--txt3)" }}>Eje Y:</span>
              {[
                { key: "avg_goals",       label: "Goles/partido"  },
                { key: "win_rate",        label: "Win rate %"     },
                { key: "avg_total_shots", label: "Tiros/partido"  },
              ].map(o => (
                <button key={o.key} onClick={() => setScatterAxis(o.key)}
                  style={{
                    padding: "3px 10px", borderRadius: 20, fontSize: 11, fontFamily: "inherit",
                    cursor: "pointer", border: "1px solid",
                    background: scatterAxis === o.key ? "var(--blue)" : "var(--bg2)",
                    borderColor: scatterAxis === o.key ? "var(--blue)" : "var(--border)",
                    color: scatterAxis === o.key ? "#fff" : "var(--txt2)",
                  }}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart margin={{ top: 10, right: 30, bottom: 40, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--bg3)" />
              <XAxis type="number" dataKey="avg_counter_pct" name="% contragolpe"
                stroke="var(--txt3)" fontSize={11}>
                <Label
                  value="% pases desde 'From Counter' (promedio por equipo)"
                  offset={-12} position="insideBottom" fill="var(--txt3)" fontSize={11}
                />
              </XAxis>
              <YAxis type="number" dataKey="y" name={scatterYLabel}
                stroke="var(--txt3)" fontSize={11} />
              <ZAxis type="number" dataKey="matches" range={[25, 350]} />
              <Tooltip content={<ScatterTip />} />
              <ReferenceLine x={1} stroke="var(--border)" strokeDasharray="4 4"
                label={{ value: "↑ Mixto (1%)", fill: "var(--txt3)", fontSize: 9, position: "insideTopRight" }} />
              <ReferenceLine x={5} stroke="#f85149" strokeDasharray="4 4" strokeOpacity={0.5}
                label={{ value: "↑ Contragolpe (5%)", fill: "#f85149", fontSize: 9, position: "insideTopRight" }} />
              <Scatter
                data={scatterData}
                shape={({ cx, cy, payload }) => {
                  const color = payload.avg_counter_pct > 5 ? "#f85149"
                    : payload.avg_counter_pct > 1 ? "#d29922" : "#58a6ff";
                  return <circle cx={cx} cy={cy} r={5} fill={color} fillOpacity={0.82} />;
                }}
              />
            </ScatterChart>
          </ResponsiveContainer>

          <div style={{ display: "flex", gap: 16, justifyContent: "center", margin: "8px 0 4px" }}>
            {Object.entries(STYLE_META).map(([k, m]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 5,
                fontSize: 11, color: "var(--txt2)" }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%",
                  background: m.color, display: "inline-block" }} />
                {m.label}
              </div>
            ))}
          </div>

          <ChartNote
            source="events_fact ⋈ matches_fact — agregado por equipo (≥ 5 partidos)"
            metric={`Eje X = counter_pct promedio del equipo en sus partidos · Eje Y = ${scatterYLabel}`}
            axes="Cada punto = 1 equipo. Tamaño del punto ∝ número de partidos disputados. Color = estilo clasificado según umbral."
            how="Las líneas punteadas marcan los umbrales de clasificación (1% = frontera Elaborado/Mixto; 5% = frontera Mixto/Contragolpe). Hover para ver el equipo."
          />
        </div>
      </div>

      {/* ══ INSIGHTS ═══════════════════════════════════════════ */}
      <div className="section">
        <div className="section-label">Insights clave</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <Callout icon="🏗️" title="Equipos élite = juego elaborado" accent="#58a6ff">
            <strong>Arsenal WFC</strong> (0.35% contra): <strong>78.9%</strong> win rate,
            3.04 goles/partido. <strong>Spain Women's</strong>: 66.7% win rate,
            2.19 goles/partido. Los dominadores del dataset son el equipo elaborado extremo.
          </Callout>
          <Callout icon="⚡" title="Contragolpe: letal por posesión, no por volumen" accent="#f85149">
            "From Counter" tiene <strong>1.03 pases/posesión</strong> pero una tasa de tiro del{" "}
            <strong>18%</strong> — la segunda más alta. Es eficiente por posesión
            pero los equipos que lo usan intensamente tienen peores métricas globales.
          </Callout>
          <Callout icon="📊" title="La correlación existe pero es débil" accent="#d29922">
            r = <strong>{fmt(verdict.corr_counter_vs_goals, 3)}</strong> (counter% → goles).
            El estilo explica solo una parte de los resultados. Calidad de plantilla,
            nivel de competición y otros factores son también determinantes.
          </Callout>
        </div>
      </div>

    </div>
  );
}
