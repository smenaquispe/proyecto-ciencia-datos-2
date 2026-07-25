import React, { useMemo, useState, useCallback } from "react";

/* ── Field dimensions (StatsBomb) ── */
const SB_W = 120, SB_H = 80;
/* ── SVG canvas ── */
const VW = 840, VH = 540, PAD = 24;
const PW = VW - PAD * 2, PH = VH - PAD * 2;
const sx = (x) => PAD + (x / SB_W) * PW;
const sy = (y) => PAD + ((SB_H - y) / SB_H) * PH;

const PASS_CFG = {
  vertical_ofensiva:  { color: "#f85149", label: "Vertical Ofensiva",  stroke: 1.8, opacity: 0.70 },
  vertical_defensiva: { color: "#d29922", label: "Vertical Defensiva", stroke: 1.4, opacity: 0.55 },
  horizontal:         { color: "#58a6ff", label: "Horizontal",         stroke: 1.4, opacity: 0.45 },
  diagonal_ofensiva:  { color: "#bc8cff", label: "Diagonal Ofensiva",  stroke: 1.6, opacity: 0.60 },
  diagonal_defensiva: { color: "#484f58", label: "Diagonal Defensiva", stroke: 1.2, opacity: 0.40 },
  horizontal_corta:   { color: "#6e7681", label: "Horiz. Corta",       stroke: 1.0, opacity: 0.30 },
  corta:              { color: "#30363d", label: "Corta",              stroke: 0.9, opacity: 0.25 },
};

const ALL_TYPES = Object.keys(PASS_CFG);

/* arrow marker id → per type */
const markerId = (type) => `arr-${type.replace(/_/g, "-")}`;

function PassArrow({ pass, cfg }) {
  const x1 = sx(pass.x),  y1 = sy(pass.y);
  const x2 = sx(pass.end_x), y2 = sy(pass.end_y);
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx*dx + dy*dy);
  if (len < 2) return null;
  /* shorten line so arrowhead doesn't overdraw */
  const factor = Math.max(0, (len - 6) / len);
  const ex = x1 + dx * factor, ey = y1 + dy * factor;
  return (
    <line
      x1={x1} y1={y1} x2={ex} y2={ey}
      stroke={cfg.color}
      strokeWidth={cfg.stroke}
      opacity={cfg.opacity}
      markerEnd={`url(#${markerId(pass.pass_type)})`}
    />
  );
}

export default function Pitch({ passes, shots, loading }) {
  const [activeTypes, setActiveTypes] = useState(new Set(ALL_TYPES));
  const [showShots,   setShowShots]   = useState(true);

  const toggleType = useCallback((t) => {
    setActiveTypes(prev => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setActiveTypes(prev => prev.size === ALL_TYPES.length ? new Set() : new Set(ALL_TYPES));
  }, []);

  /* count per type from actual passes */
  const typeCounts = useMemo(() => {
    const c = {};
    passes.forEach(p => { c[p.pass_type] = (c[p.pass_type] || 0) + 1; });
    return c;
  }, [passes]);

  const visible = useMemo(() =>
    passes.filter(p => activeTypes.has(p.pass_type)).slice(0, 5000),
    [passes, activeTypes]
  );

  return (
    <div className="pitch-card">
      {/* toolbar */}
      <div className="pitch-toolbar">
        <span className="toolbar-label">Pases</span>
        <button
          className={`type-btn ${activeTypes.size === ALL_TYPES.length ? "active" : ""}`}
          style={{ "--c": "var(--txt2)" }}
          onClick={toggleAll}
        >
          Todos
        </button>
        <div className="toolbar-sep" />
        {ALL_TYPES.map(t => {
          const cfg = PASS_CFG[t];
          const on  = activeTypes.has(t);
          return (
            <button
              key={t}
              className={`type-btn ${on ? "active" : ""}`}
              style={{ color: on ? cfg.color : "var(--txt3)", borderColor: on ? cfg.color : "transparent" }}
              onClick={() => toggleType(t)}
            >
              <span className="type-btn-dot" style={{ background: on ? cfg.color : "var(--bg3)" }} />
              {cfg.label}
              {typeCounts[t] ? <span style={{ color: "var(--txt3)", fontWeight: 400 }}>·{typeCounts[t].toLocaleString()}</span> : null}
            </button>
          );
        })}
        <div className="toolbar-sep" />
        <label className="pitch-toggle">
          <input type="checkbox" checked={showShots} onChange={() => setShowShots(v => !v)} />
          Tiros ({shots?.length ?? 0})
        </label>
        <span className="pitch-count-badge">{visible.length.toLocaleString()} pases visibles</span>
      </div>

      {/* SVG field */}
      <div className="pitch-svg-wrap">
        <svg viewBox={`0 0 ${VW} ${VH}`} className="pitch-svg">
          <defs>
            {ALL_TYPES.map(t => {
              const cfg = PASS_CFG[t];
              return (
                <marker
                  key={t}
                  id={markerId(t)}
                  markerWidth="5" markerHeight="5"
                  refX="4" refY="2.5"
                  orient="auto"
                >
                  <polygon points="0 0, 5 2.5, 0 5" fill={cfg.color} opacity={cfg.opacity + 0.2} />
                </marker>
              );
            })}
          </defs>

          {/* ── pitch background with subtle stripes ── */}
          <defs>
            <pattern id="stripe" x="0" y="0" width={PW/12} height={PH} patternUnits="userSpaceOnUse">
              <rect width={PW/24} height={PH} fill="#1a3a24"/>
              <rect x={PW/24} width={PW/24} height={PH} fill="#1c3e27"/>
            </pattern>
          </defs>
          <rect x={PAD} y={PAD} width={PW} height={PH} fill="url(#stripe)" rx={3}/>

          {/* ── lines ── */}
          <g stroke="#fff" strokeWidth={1.2} fill="none" opacity={0.55}>
            {/* outline */}
            <rect x={PAD} y={PAD} width={PW} height={PH}/>
            {/* halfway */}
            <line x1={PAD+PW/2} y1={PAD} x2={PAD+PW/2} y2={PAD+PH}/>
            {/* centre circle */}
            <circle cx={PAD+PW/2} cy={PAD+PH/2} r={PH*0.115}/>
            <circle cx={PAD+PW/2} cy={PAD+PH/2} r={2} fill="#fff" stroke="none"/>
            {/* left penalty area */}
            <rect x={PAD} y={PAD+PH*0.21} width={PW*0.153} height={PH*0.58}/>
            {/* left 6-yard box */}
            <rect x={PAD} y={PAD+PH*0.35} width={PW*0.057} height={PH*0.30}/>
            {/* right penalty area */}
            <rect x={PAD+PW*0.847} y={PAD+PH*0.21} width={PW*0.153} height={PH*0.58}/>
            {/* right 6-yard box */}
            <rect x={PAD+PW*0.943} y={PAD+PH*0.35} width={PW*0.057} height={PH*0.30}/>
            {/* penalty spots */}
            <circle cx={PAD+PW*0.092} cy={PAD+PH/2} r={1.8} fill="#fff" stroke="none"/>
            <circle cx={PAD+PW*0.908} cy={PAD+PH/2} r={1.8} fill="#fff" stroke="none"/>
          </g>

          {/* goals */}
          <g fill="none" stroke="#fff" strokeWidth={2} opacity={0.8}>
            <rect x={PAD-8}       y={PAD+PH*0.364} width={8}  height={PH*0.272}/>
            <rect x={PAD+PW}      y={PAD+PH*0.364} width={8}  height={PH*0.272}/>
          </g>

          {/* zone labels */}
          {[
            { x: PAD+PW*0.17, label: "⬛ Def" },
            { x: PAD+PW*0.50, label: "Medio" },
            { x: PAD+PW*0.83, label: "Ofensivo ⬛" },
          ].map(({ x, label }) => (
            <text key={label} x={x} y={PAD+PH-6} textAnchor="middle"
              fill="#fff" opacity={0.18} fontSize={11} fontWeight={500}>
              {label}
            </text>
          ))}

          {/* ── passes ── */}
          <g>{visible.map((p, i) => {
            const cfg = PASS_CFG[p.pass_type];
            if (!cfg) return null;
            return <PassArrow key={p.event_id ?? i} pass={p} cfg={cfg} />;
          })}</g>

          {/* ── shots ── */}
          {showShots && shots?.map((s, i) => {
            const cx = sx(s.x), cy = sy(s.y);
            return (
              <g key={s.event_id ?? i}>
                <circle cx={cx} cy={cy} r={5} fill="none" stroke="#fbbf24" strokeWidth={1.8} opacity={0.75}/>
                <circle cx={cx} cy={cy} r={2.2} fill="#fbbf24" opacity={0.90}/>
              </g>
            );
          })}
        </svg>

        {loading && (
          <div className="pitch-loading">
            <div className="spinner"/>
            <span>Cargando datos…</span>
          </div>
        )}
      </div>

      {/* legend */}
      <div className="pitch-legend">
        {ALL_TYPES.map(t => {
          const cfg = PASS_CFG[t];
          const on  = activeTypes.has(t);
          return (
            <div key={t} className="leg-item" style={{ opacity: on ? 1 : 0.3, cursor: "pointer" }} onClick={() => toggleType(t)}>
              <div className="leg-line" style={{ background: cfg.color }}/>
              <span>{cfg.label}</span>
            </div>
          );
        })}
        <div className="leg-item">
          <div className="leg-circle" style={{ borderColor: "#fbbf24", background: "#fbbf2440" }}/>
          <span>Tiro</span>
        </div>
      </div>
    </div>
  );
}
