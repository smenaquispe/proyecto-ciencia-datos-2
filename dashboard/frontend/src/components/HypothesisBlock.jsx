import React, { useState } from "react";

/* ── pass classification rules ─────────────────────────────── */
const RULES = [
  {
    key: "vertical_ofensiva",
    color: "#f85149",
    label: "Vertical Ofensiva",
    code: "|dx| > 10  y  |dx| ≥ |dy|·1.2  y  dx > 0",
    desc: "Avanza > 10 yardas hacia portería rival",
    example: "Centro desde banda → delantero",
  },
  {
    key: "vertical_defensiva",
    color: "#d29922",
    label: "Vertical Defensiva",
    code: "|dx| > 10  y  |dx| ≥ |dy|·1.2  y  dx < 0",
    desc: "Pase largo hacia atrás (descompresión)",
    example: "Portero → defensa central en profundidad",
  },
  {
    key: "horizontal",
    color: "#58a6ff",
    label: "Horizontal",
    code: "|dy| > 8  y  |dy| > |dx|",
    desc: "Movimiento principalmente lateral",
    example: "Cambio de orientación de banda a banda",
  },
  {
    key: "diagonal_ofensiva",
    color: "#bc8cff",
    label: "Diagonal Ofensiva",
    code: "dx > 0  y  |dx| ≥ |dy|  (no cumple vertical)",
    desc: "Avance diagonal moderado hacia portería",
    example: "Mediocampista → extremo en profundidad",
  },
  {
    key: "diagonal_defensiva",
    color: "#64748b",
    label: "Diagonal Defensiva",
    code: "dx < 0  y  |dx| ≥ |dy|  (no cumple vertical)",
    desc: "Retroceso diagonal para conservar",
    example: "Extremo → lateral retrasado",
  },
  {
    key: "horizontal_corta",
    color: "#6e7681",
    label: "Horizontal Corta",
    code: "|dy| ≤ 8  y  resto de casos",
    desc: "Pase lateral de corto recorrido",
    example: "Circulación entre centrales",
  },
  {
    key: "corta",
    color: "#30363d",
    label: "Corta",
    code: "|dx| < 3  y  |dy| < 3",
    desc: "Pase de < 3 yardas en cualquier dirección",
    example: "Toque entre pies / apoyo en presión",
  },
];

/* ── data sources table ─────────────────────────────────────── */
const SOURCES = [
  {
    tabla: "events_fact.parquet",
    columnas: "event_type_name, x, y, end_x, end_y, match_id, team_id, play_pattern_name",
    uso: "Extraer todos los eventos tipo 'Pass' y 'Shot' con sus coordenadas de inicio y fin",
  },
  {
    tabla: "matches_fact.parquet",
    columnas: "match_id, home_team_id, away_team_id, home_score, away_score",
    uso: "Obtener goles marcados por cada equipo en cada partido (home_score / away_score)",
  },
];

const MERGE_STEPS = [
  { paso: "1", desc: "Filtrar events_fact → solo event_type_name = 'Pass' con x, end_x no nulos" },
  { paso: "2", desc: "Calcular dx = end_x − x  y  dy = end_y − y  para cada pase" },
  { paso: "3", desc: "Aplicar reglas de clasificación sobre dx/dy → columna pass_type" },
  { paso: "4", desc: "Agrupar por (match_id, team_id, pass_type) → conteo de pases por tipo" },
  { paso: "5", desc: "Unir con matches_fact usando match_id + team_id → añadir columna 'goals'" },
  { paso: "6", desc: "Calcular goles_asociados / total_pases_de_ese_tipo = goals_per_pass" },
];

export default function HypothesisBlock({ hypothesis, loading }) {
  const [showMethod, setShowMethod] = useState(false);

  const eff   = hypothesis?.pass_efficiency ?? {};
  const vEff  = eff.vertical_ofensiva;
  const hEff  = eff.horizontal;
  const total = hypothesis?.total_passes ?? 0;
  const shots = hypothesis?.total_shots  ?? 0;
  const tc    = hypothesis?.pass_type_counts ?? {};

  const confirmed = vEff && hEff && vEff.goals_per_pass > hEff.goals_per_pass;
  const fmt = (n) => n ? n.toLocaleString("es-ES") : "—";

  return (
    <div className="hyp-block">

      {/* ── enunciado ── */}
      <div className="hyp-statement">
        <span className="hyp-icon">📐</span>
        <span>
          Los equipos que realizan más pases{" "}
          <em style={{ color: "#f85149" }}>verticales ofensivos</em> generan más
          tiros y convierten más goles que los que priorizan pases{" "}
          <em style={{ color: "#58a6ff" }}>horizontales</em>.
        </span>
      </div>

      <p className="hyp-desc">
        Se analizaron <strong>{fmt(total)}</strong> pases de{" "}
        <strong>
          {hypothesis?.filters_applied?.team_id ? "1 equipo" : "todos los equipos"}
        </strong>
        . Cada pase se clasifica según la dirección del vector{" "}
        <code style={{ background: "var(--bg2)", padding: "1px 5px", borderRadius: 3, fontSize: 12 }}>
          (dx, dy)
        </code>{" "}
        —diferencia de coordenadas entre el origen y el destino— sobre el campo
        StatsBomb de <strong>120 × 80 yardas</strong>. La eficiencia se mide como
        <strong> goles anotados por cada pase</strong> de ese tipo, calculada a
        nivel partido-equipo y cruzada con la tabla de resultados.
      </p>

      {/* ── reglas de clasificación ── */}
      <div className="method-section">
        <div className="method-section-title">
          <span>📏</span> Reglas de clasificación de pases
        </div>
        <div className="rules-grid">
          {RULES.map(r => (
            <div className="rule-card" key={r.key}>
              <div className="rule-card-header">
                <span className="rule-dot-lg" style={{ background: r.color }} />
                <span className="rule-card-name">{r.label}</span>
              </div>
              <code className="rule-card-code">{r.code}</code>
              <div className="rule-card-desc">{r.desc}</div>
              <div className="rule-card-example">ej: {r.example}</div>
            </div>
          ))}
        </div>
        <p className="method-note">
          <strong>dx</strong> = end_x − x (positivo = hacia portería rival) ·{" "}
          <strong>dy</strong> = end_y − y · Campo: x ∈ [0, 120], y ∈ [0, 80] yardas ·
          Las reglas se aplican en orden: primero corta, luego vertical, horizontal, diagonal.
        </p>
      </div>

      {/* ── fuentes de datos ── */}
      <div className="method-section">
        <button
          className="method-toggle"
          onClick={() => setShowMethod(v => !v)}
        >
          <span>🗄️</span>
          <span>Fuentes de datos y construcción del dataset</span>
          <span className="method-toggle-icon">{showMethod ? "▲" : "▼"}</span>
        </button>

        {showMethod && (
          <div className="method-expanded">
            <div className="sources-table-wrap">
              <table className="sources-table">
                <thead>
                  <tr>
                    <th>Tabla parquet</th>
                    <th>Columnas usadas</th>
                    <th>Propósito</th>
                  </tr>
                </thead>
                <tbody>
                  {SOURCES.map(s => (
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
              {MERGE_STEPS.map(s => (
                <div className="pipeline-step" key={s.paso}>
                  <span className="pipeline-num">{s.paso}</span>
                  <span className="pipeline-desc">{s.desc}</span>
                </div>
              ))}
            </div>

            <p className="method-note" style={{ marginTop: 12 }}>
              <strong>Nota sobre eficiencia:</strong> La métrica{" "}
              <em>goles_por_pase</em> se calcula sumando todos los goles anotados
              en partidos-equipo donde se realizó al menos un pase de ese tipo,
              dividido entre el total de pases de ese tipo en todo el dataset.
              Es una correlación de segundo orden, no causalidad directa pase → gol.
            </p>
          </div>
        )}
      </div>

      {/* ── KPIs ── */}
      <div className="hyp-kpis">
        {[
          { val: fmt(total),  label: "Pases analizados", sub: "events_fact WHERE type='Pass'" },
          { val: fmt(shots),  label: "Tiros generados",  sub: "events_fact WHERE type='Shot'" },
          { val: vEff ? `${vEff.vs_horizontal}×` : "—", label: "Eficiencia vert. vs horiz.", sub: "goals_per_pass ratio" },
          { val: tc.vertical_ofensiva ? `${tc.vertical_ofensiva.pct}%` : "—", label: "% pases verticales of.", sub: "del total de pases" },
          { val: tc.horizontal ? `${tc.horizontal.pct}%` : "—", label: "% pases horizontales", sub: "tipo más frecuente" },
        ].map((k, i) => (
          <div className="hyp-kpi" key={i}>
            <div className="hyp-kpi-val">{k.val}</div>
            <div className="hyp-kpi-label">{k.label}</div>
            <div className="hyp-kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── veredicto ── */}
      {vEff && hEff && (
        <div className={`verdict-block${confirmed ? "" : " false"}`}>
          <span className="verdict-emoji">{confirmed ? "✅" : "❌"}</span>
          <div className="verdict-content">
            <div className="verdict-title">
              {confirmed
                ? "Hipótesis CONFIRMADA"
                : "Hipótesis NO CONFIRMADA con los filtros actuales"}
            </div>
            <p className="verdict-body">
              Los pases <strong>verticales ofensivos</strong> generan{" "}
              <strong>{vEff.goals_per_pass.toFixed(5)}</strong> goles/pase frente
              a <strong>{hEff.goals_per_pass.toFixed(5)}</strong> de los horizontales
              → <strong>{vEff.vs_horizontal}× más eficientes</strong>. Los
              horizontales dominan en volumen (
              <strong>{tc.horizontal?.pct ?? "?"}%</strong> del total), pero
              la verticalidad es el diferencial de efectividad de los equipos top.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
