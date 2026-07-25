import React, { useState } from "react";

const PASS_ORDER = [
  "vertical_ofensiva","diagonal_ofensiva","horizontal",
  "vertical_defensiva","diagonal_defensiva","horizontal_corta","corta",
];

function StackBar({ breakdown }) {
  const segs = PASS_ORDER
    .filter(k => breakdown[k] && breakdown[k].pct > 0)
    .map(k => ({ key: k, pct: breakdown[k].pct, color: breakdown[k].color, label: breakdown[k].label }));
  return (
    <div className="stack-bar">
      {segs.map(s => (
        <div key={s.key} className="stack-seg"
          title={`${s.label}: ${s.pct}%`}
          style={{ width: `${s.pct}%`, background: s.color }} />
      ))}
    </div>
  );
}

function TeamRow({ team, rank, accent }) {
  const [open, setOpen] = useState(false);
  const bd  = team.pass_breakdown ?? {};
  const gpm = team.goals_per_match;
  const vPct = bd.vertical_ofensiva?.pct ?? 0;
  const hPct = bd.horizontal?.pct ?? 0;

  return (
    <div className="team-row" style={{ cursor: "pointer" }} onClick={() => setOpen(o => !o)}>
      <div className="team-row-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* rank badge */}
          <span style={{
            width: 24, height: 24, borderRadius: "50%",
            background: rank <= 3 ? accent : "var(--bg3)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 800,
            color: rank <= 3 ? "#fff" : "var(--txt2)",
          }}>
            {rank}
          </span>
          <span className="team-name">{team.team_name}</span>
        </div>

        {/* primary metric: goals/match */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: accent, lineHeight: 1 }}>
              {gpm}
            </span>
            <span style={{ fontSize: 11, color: "var(--txt3)" }}>goles/partido</span>
          </div>
          <span style={{ fontSize: 10, color: "var(--txt3)", marginTop: 1 }}>
            {team.total_goals} totales · {team.matches} partidos
          </span>
        </div>
      </div>

      {/* stacked pass-type bar */}
      <StackBar breakdown={bd} />

      {/* summary line */}
      <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--txt2)", marginTop: 4 }}>
        <span style={{ color: "#f85149", fontWeight: 600 }}>▲ {vPct}% vertical of.</span>
        <span style={{ color: "#58a6ff" }}>↔ {hPct}% horizontal</span>
        <span style={{ marginLeft: "auto", color: "var(--txt3)" }}>
          {team.total_passes.toLocaleString("es-ES")} pases · {open ? "▲ menos" : "▼ detalle"}
        </span>
      </div>

      {/* expanded breakdown */}
      {open && (
        <div style={{
          marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 10,
        }}>
          <div className="stack-legend">
            {PASS_ORDER.filter(k => bd[k]).map(k => (
              <div key={k} className="stack-leg-item">
                <span className="stack-dot" style={{ background: bd[k].color }} />
                <span>{bd[k].label}</span>
                <strong style={{ marginLeft: 2 }}>{bd[k].pct}%</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TeamComparison({ data }) {
  if (!data) {
    return (
      <div className="loading-placeholder">
        <div className="spinner" />
        Cargando comparación de equipos…
      </div>
    );
  }

  const { top_scorers = [], bottom_scorers = [], pass_types = [] } = data;

  /* avg vertical% */
  const avgVert = (list) => {
    if (!list.length) return 0;
    return (list.reduce((a, t) => a + (t.pass_breakdown?.vertical_ofensiva?.pct ?? 0), 0) / list.length).toFixed(1);
  };
  const topVert = avgVert(top_scorers);
  const botVert = avgVert(bottom_scorers);

  /* avg gpm */
  const avgGpm = (list) => {
    if (!list.length) return 0;
    return (list.reduce((a, t) => a + t.goals_per_match, 0) / list.length).toFixed(2);
  };

  return (
    <div>
      {/* insight banner */}
      <div style={{
        background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 10,
        padding: "16px 20px", marginBottom: 20,
        display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
      }}>
        <span style={{ fontSize: 28 }}>🔍</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--txt0)", marginBottom: 4 }}>
            Top goleadores promedian{" "}
            <span style={{ color: "#3fb950" }}>{avgGpm(top_scorers)} goles/partido</span>
            {" "}usando{" "}
            <span style={{ color: "#f85149" }}>{topVert}%</span> de pases verticales ofensivos.
            Los menos goleadores ({" "}
            <span style={{ color: "#f85149" }}>{avgGpm(bottom_scorers)} goles/partido</span>)
            {" "}solo usan{" "}
            <span style={{ color: "#58a6ff" }}>{botVert}%</span>.
          </div>
          <div style={{ fontSize: 12, color: "var(--txt2)", lineHeight: 1.6 }}>
            Ordenados por <strong>promedio de goles por partido</strong> (no por total acumulado).
            La barra de colores muestra la distribución porcentual de tipos de pase de cada equipo.
            Haz clic en cualquier equipo para ver el desglose completo.
          </div>
        </div>

        {/* mini legend */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {pass_types.slice(0, 4).map(pt => (
            <div key={pt.key} style={{ display: "flex", alignItems: "center", gap: 6,
              fontSize: 11, color: "var(--txt2)" }}>
              <span style={{ width: 10, height: 10, borderRadius: 2,
                background: pt.color, display: "inline-block" }} />
              {pt.label}
            </div>
          ))}
        </div>
      </div>

      <div className="team-comp-grid">
        {/* TOP scorers */}
        <div className="team-comp-col">
          <div className="team-comp-header">
            <span className="team-comp-badge badge-top">🏆 Más goleadores</span>
            <span style={{ fontSize: 11, color: "var(--txt3)" }}>
              ordenados por goles/partido · {topVert}% vertical of. promedio
            </span>
          </div>
          {top_scorers.map((t, i) => (
            <TeamRow key={t.team_id} team={t} rank={i + 1} accent="#3fb950" />
          ))}
        </div>

        {/* BOTTOM scorers */}
        <div className="team-comp-col">
          <div className="team-comp-header">
            <span className="team-comp-badge badge-bot">📉 Menos goleadores</span>
            <span style={{ fontSize: 11, color: "var(--txt3)" }}>
              ordenados por goles/partido · {botVert}% vertical of. promedio
            </span>
          </div>
          {bottom_scorers.map((t, i) => (
            <TeamRow key={t.team_id} team={t} rank={i + 1} accent="#f85149" />
          ))}
        </div>
      </div>
    </div>
  );
}
