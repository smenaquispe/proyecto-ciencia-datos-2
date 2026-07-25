import React, { useMemo } from "react";

const PASS_ORDER = [
  "vertical_ofensiva","diagonal_ofensiva","horizontal",
  "vertical_defensiva","diagonal_defensiva","horizontal_corta","corta",
];

function fmt(n, decimals = 0) {
  if (n == null) return "—";
  return typeof n === "number"
    ? n.toLocaleString("es-ES", { maximumFractionDigits: decimals })
    : n;
}

/* ── Chart note component ────────────────────────────────────── */
function ChartNote({ source, metric, how }) {
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
      {how && (
        <div className="chart-explain-row">
          <span className="chart-explain-key">Cómo</span>
          <span>{how}</span>
        </div>
      )}
    </div>
  );
}

export default function SidePanel({ hypothesis, passes, shots, loading }) {

  /* local pass distribution from the active filter */
  const localDist = useMemo(() => {
    if (!passes.length) return {};
    const c = {};
    passes.forEach(p => { c[p.pass_type] = (c[p.pass_type] || 0) + 1; });
    const total = passes.length;
    return Object.fromEntries(
      Object.entries(c).map(([k, v]) => [k, { count: v, pct: (v / total * 100).toFixed(1) }])
    );
  }, [passes]);

  const localPassTotal = passes.length;
  const localShotTotal = shots?.length ?? 0;
  const localDanger    = passes.filter(p => p.end_x > 80 && p.end_y > 18 && p.end_y < 62).length;
  const vertPct = localPassTotal
    ? ((localDist.vertical_ofensiva?.count || 0) / localPassTotal * 100).toFixed(1)
    : "—";

  const eff = hypothesis?.pass_efficiency ?? {};
  const tc  = hypothesis?.pass_type_counts ?? {};

  const effRows = PASS_ORDER
    .filter(k => eff[k])
    .map(k => ({ key: k, ...eff[k] }))
    .sort((a, b) => b.goals_per_pass - a.goals_per_pass);

  return (
    <div className="side-panel">

      {/* ── KPIs de la vista actual ── */}
      <div className="card">
        <div className="card-title">
          <span className="card-title-icon">📊</span>Resumen — filtro activo
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          {[
            { val: fmt(localPassTotal), label: "Pases visibles",  color: "var(--blue)"   },
            { val: fmt(localShotTotal), label: "Tiros visibles",  color: "var(--orange)" },
            { val: fmt(localDanger),    label: "Pases al área",   color: "var(--red)"    },
            { val: `${vertPct}%`,       label: "Vert. ofensivos", color: "#f85149"       },
          ].map(k => (
            <div key={k.label}
              style={{ background: "var(--bg2)", borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: k.color, lineHeight: 1 }}>
                {k.val}
              </div>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".5px",
                color: "var(--txt3)", marginTop: 3 }}>
                {k.label}
              </div>
            </div>
          ))}
        </div>
        <ChartNote
          source="events_fact.parquet — filtrado por equipo y/o partido seleccionado"
          metric="Conteos directos de eventos según el filtro activo en el mapa"
          how='"Pases al área" = pases con end_x > 80 y end_y ∈ [18, 62] (zona de penalti rival)'
        />
      </div>

      {/* ── distribución de tipos de pase ── */}
      <div className="card">
        <div className="card-title">
          <span className="card-title-icon">📈</span>Distribución de pases — filtro activo
        </div>
        {PASS_ORDER.map(k => {
          const d   = localDist[k];
          if (!d) return null;
          const cfg   = hypothesis?.pass_type_counts?.[k];
          const color = cfg?.color ?? "#6e7681";
          return (
            <div className="dist-row" key={k}>
              <span className="dist-label">{cfg?.label ?? k}</span>
              <div className="dist-track">
                <div className="dist-fill" style={{ width: `${d.pct}%`, background: color }} />
              </div>
              <span className="dist-pct">{d.pct}%</span>
            </div>
          );
        })}
        <ChartNote
          source="events_fact — pases del filtro activo (muestra ≤ 6 000 eventos)"
          metric="Porcentaje de cada tipo de pase sobre el total visible en el mapa"
          how="Cada pase clasificado por reglas dx/dy. Barra = % del total del filtro activo"
        />
      </div>

      {/* ── tabla de eficiencia ── */}
      <div className="card">
        <div className="card-title">
          <span className="card-title-icon">🎯</span>Eficiencia goles/pase — dataset global
        </div>
        {loading ? (
          <div style={{ color: "var(--txt3)", fontSize: 12, padding: "8px 0" }}>
            Calculando…
          </div>
        ) : (
          <table className="eff-table">
            <thead>
              <tr>
                <th>Tipo de pase</th>
                <th>Goles/pase</th>
                <th>vs Horiz.</th>
                <th>Total pases</th>
              </tr>
            </thead>
            <tbody>
              {effRows.map(r => {
                const color = tc[r.key]?.color ?? "#6e7681";
                const vs    = r.vs_horizontal ?? 1;
                return (
                  <tr key={r.key}>
                    <td>
                      <span className="eff-type-pill">
                        <span className="eff-dot" style={{ background: color }} />
                        {r.label ?? r.key}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color }}>
                      {r.goals_per_pass.toFixed(5)}
                    </td>
                    <td>
                      <span className={`eff-vs ${vs >= 1 ? "positive" : "negative"}`}>
                        {vs >= 1 ? "+" : ""}{((vs - 1) * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td style={{ color: "var(--txt3)" }}>{fmt(r.pases)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <ChartNote
          source="events_fact ⋈ matches_fact — todos los partidos del dataset"
          metric="Goles anotados por cada pase realizado de ese tipo (a nivel partido-equipo)"
          how="goles_asociados ÷ total_pases_tipo. 'vs Horiz.' = ratio respecto al pase horizontal como baseline. No implica causalidad directa pase→gol; mide correlación de segundo orden."
        />
      </div>

      {/* ── tiros por zona ── */}
      <div className="card">
        <div className="card-title">
          <span className="card-title-icon">📍</span>Tiros por zona de campo
        </div>
        {["ofensivo", "medio", "defensivo"].map(z => {
          const cnt   = hypothesis?.shots_by_zone?.[z] ?? 0;
          const total = Object.values(hypothesis?.shots_by_zone ?? {})
            .reduce((a, b) => a + b, 0) || 1;
          const pct   = (cnt / total * 100).toFixed(1);
          const color = z === "ofensivo" ? "var(--red)"
            : z === "medio" ? "var(--orange)"
            : "var(--txt3)";
          const zoneLabel = z === "ofensivo" ? "Ofensivo (x > 80)"
            : z === "medio"    ? "Medio (40 < x ≤ 80)"
            : "Defensivo (x ≤ 40)";
          return (
            <div className="dist-row" key={z}>
              <span className="dist-label">{zoneLabel}</span>
              <div className="dist-track">
                <div className="dist-fill" style={{ width: `${pct}%`, background: color }} />
              </div>
              <span className="dist-pct">{pct}%</span>
            </div>
          );
        })}
        <ChartNote
          source="events_fact — columna x de eventos tipo 'Shot'"
          metric="En qué tercio del campo (según x de origen) se efectúan los tiros"
          how="Tercio ofensivo: x > 80 · Medio: 40 < x ≤ 80 · Defensivo: x ≤ 40. Campo StatsBomb: x ∈ [0, 120]"
        />
      </div>

    </div>
  );
}
