import React, { useState } from "react";

/* ── Reusable Notion-style blocks ──────────────────────────── */

function PageTitle({ children }) {
  return (
    <h1 style={{
      fontSize: 30, fontWeight: 800, color: "var(--txt0)",
      lineHeight: 1.2, marginBottom: 8, letterSpacing: "-0.5px",
    }}>{children}</h1>
  );
}

function PageSubtitle({ children }) {
  return (
    <p style={{ fontSize: 15, color: "var(--txt2)", marginBottom: 32, lineHeight: 1.6 }}>
      {children}
    </p>
  );
}

function SectionH2({ children }) {
  return (
    <h2 style={{
      fontSize: 20, fontWeight: 700, color: "var(--txt0)",
      marginTop: 40, marginBottom: 12,
      paddingBottom: 8,
      borderBottom: "1px solid var(--border)",
    }}>{children}</h2>
  );
}

function SectionH3({ children }) {
  return (
    <h3 style={{
      fontSize: 15, fontWeight: 700, color: "var(--txt0)",
      marginTop: 24, marginBottom: 8,
    }}>{children}</h3>
  );
}

function Paragraph({ children }) {
  return (
    <p style={{ fontSize: 14, color: "var(--txt1)", lineHeight: 1.75, marginBottom: 12 }}>
      {children}
    </p>
  );
}

function Callout({ icon = "💡", color = "var(--blue)", children }) {
  return (
    <div style={{
      display: "flex", gap: 12, padding: "14px 16px",
      background: `${color}12`, borderLeft: `3px solid ${color}`,
      borderRadius: 8, marginBottom: 16, fontSize: 13,
      color: "var(--txt1)", lineHeight: 1.65,
    }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
      <div>{children}</div>
    </div>
  );
}

function Code({ children }) {
  return (
    <code style={{
      fontFamily: "'Fira Code','Courier New',monospace",
      fontSize: 12, background: "var(--bg2)", color: "var(--blue)",
      padding: "1px 6px", borderRadius: 4,
    }}>{children}</code>
  );
}

function Formula({ children }) {
  return (
    <div style={{
      background: "var(--bg2)", border: "1px solid var(--border)",
      borderRadius: 8, padding: "12px 20px", marginBottom: 12,
      fontFamily: "'Fira Code','Courier New',monospace",
      fontSize: 13, color: "var(--txt0)", textAlign: "center",
    }}>{children}</div>
  );
}

function BulletList({ items }) {
  return (
    <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
      {items.map((item, i) => (
        <li key={i} style={{ fontSize: 13, color: "var(--txt1)", lineHeight: 1.7, marginBottom: 4 }}>
          {item}
        </li>
      ))}
    </ul>
  );
}

/* table stats row */
function TableSchema({ rows }) {
  return (
    <div style={{
      overflowX: "auto", marginBottom: 20,
      border: "1px solid var(--border)", borderRadius: 8,
    }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: "var(--bg2)" }}>
            {["Columna","Tipo","Nulos","Descripción / Estadísticas"].map(h => (
              <th key={h} style={{
                padding: "8px 12px", textAlign: "left",
                fontWeight: 700, fontSize: 10,
                textTransform: "uppercase", letterSpacing: ".5px",
                color: "var(--txt3)", borderBottom: "1px solid var(--border)",
                whiteSpace: "nowrap",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? "var(--bg1)" : "var(--bg0)" }}>
              <td style={{ padding: "8px 12px", fontFamily: "'Fira Code',monospace", color: "var(--blue)", fontSize: 11, whiteSpace: "nowrap", borderBottom: "1px solid var(--border-subtle)" }}>
                {r.col}
              </td>
              <td style={{ padding: "8px 12px", color: "var(--txt2)", fontSize: 11, whiteSpace: "nowrap", borderBottom: "1px solid var(--border-subtle)" }}>
                {r.type}
              </td>
              <td style={{ padding: "8px 12px", fontWeight: 700, fontSize: 11, whiteSpace: "nowrap", borderBottom: "1px solid var(--border-subtle)",
                color: parseFloat(r.nulls) > 20 ? "#f85149" : parseFloat(r.nulls) > 0 ? "#d29922" : "#3fb950",
              }}>
                {r.nulls}
              </td>
              <td style={{ padding: "8px 12px", color: "var(--txt2)", fontSize: 12, lineHeight: 1.5, borderBottom: "1px solid var(--border-subtle)" }}>
                {r.desc}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* data volume summary table */
function VolumeTable({ rows }) {
  return (
    <div style={{ overflowX: "auto", marginBottom: 20, border: "1px solid var(--border)", borderRadius: 8 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: "var(--bg2)" }}>
            {["Tabla","Registros","Tamaño","Descripción del registro"].map(h => (
              <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, fontSize: 10,
                textTransform: "uppercase", letterSpacing: ".5px", color: "var(--txt3)",
                borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? "var(--bg1)" : "var(--bg0)" }}>
              <td style={{ padding: "8px 12px", fontFamily: "'Fira Code',monospace", color: "var(--blue)", fontSize: 11, borderBottom: "1px solid var(--border-subtle)" }}>{r.name}</td>
              <td style={{ padding: "8px 12px", fontWeight: 700, color: "var(--txt0)", fontSize: 12, borderBottom: "1px solid var(--border-subtle)", whiteSpace: "nowrap" }}>{r.rows}</td>
              <td style={{ padding: "8px 12px", color: "var(--txt2)", fontSize: 11, borderBottom: "1px solid var(--border-subtle)", whiteSpace: "nowrap" }}>{r.size}</td>
              <td style={{ padding: "8px 12px", color: "var(--txt2)", fontSize: 12, lineHeight: 1.5, borderBottom: "1px solid var(--border-subtle)" }}>{r.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* collapsible section */
function CollapseSection({ title, icon, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 8, border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
      <button onClick={() => setOpen(v => !v)} style={{
        width: "100%", display: "flex", alignItems: "center", gap: 10,
        padding: "12px 16px", background: "var(--bg2)", border: "none",
        cursor: "pointer", fontFamily: "inherit", color: "var(--txt0)",
        fontSize: 14, fontWeight: 600, textAlign: "left", transition: "background .15s",
      }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        {title}
        <span style={{ marginLeft: "auto", color: "var(--txt3)", fontSize: 12 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ padding: "16px 20px", background: "var(--bg1)" }}>
          {children}
        </div>
      )}
    </div>
  );
}

/* ── TOC nav ────────────────────────────────────────────────── */
const SECTIONS = [
  { id: "intro",       label: "Introducción" },
  { id: "arquitectura",label: "Arquitectura" },
  { id: "tablas",      label: "Tablas del Modelo" },
  { id: "estadistica", label: "Metodología Estadística" },
  { id: "calidad",     label: "Calidad y Volumen" },
  { id: "ml",          label: "Análisis ML" },
  { id: "conclusiones",label: "Conclusiones" },
];

/* ══════════════════════════════════════════════════════════════
   MAIN VIEW
══════════════════════════════════════════════════════════════ */
export default function DataWranglingView() {
  const [activeSection, setActiveSection] = useState("intro");

  const scrollTo = (id) => {
    document.getElementById(`dw-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveSection(id);
  };

  return (
    <div style={{ paddingTop: 20, display: "flex", gap: 24, alignItems: "flex-start" }}>

      {/* ── sticky TOC ── */}
      <div style={{
        width: 180, flexShrink: 0, position: "sticky", top: 80,
        background: "var(--bg1)", border: "1px solid var(--border)",
        borderRadius: 10, padding: "14px 0", fontSize: 12,
      }}>
        <div style={{ padding: "0 14px 10px", fontSize: 10, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: ".6px", color: "var(--txt3)" }}>
          Contenido
        </div>
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => scrollTo(s.id)}
            style={{
              display: "block", width: "100%", padding: "6px 14px",
              background: activeSection === s.id ? "rgba(88,166,255,.12)" : "transparent",
              border: "none", cursor: "pointer", textAlign: "left",
              fontFamily: "inherit", fontSize: 12,
              color: activeSection === s.id ? "var(--blue)" : "var(--txt2)",
              fontWeight: activeSection === s.id ? 600 : 400,
              borderLeft: activeSection === s.id ? "2px solid var(--blue)" : "2px solid transparent",
              transition: "all .15s",
            }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ── main content ── */}
      <div style={{ flex: 1, minWidth: 0 }}>

        <PageTitle>📊 Reporte de Data Wrangling</PageTitle>
        <PageSubtitle>
          Auditoría descriptiva del modelo dimensional derivado de StatsBomb Open Data.
          Autor: Sergio Sebastian Santos Mena Quispe · Docente: Ana María Cuadros Valdivia
        </PageSubtitle>

        {/* ── INTRO ── */}
        <div id="dw-intro">
          <SectionH2>1. Introducción</SectionH2>
          <Paragraph>
            Este documento presenta una auditoría descriptiva paso a paso de todas las tablas que
            componen el <strong>Modelo Dimensional</strong> derivado de los datos crudos de StatsBomb.
            El ecosistema ha sido diseñado en una arquitectura de <strong>Esquema Estrella</strong>,
            separando claramente:
          </Paragraph>
          <BulletList items={[
            "Dimensiones (Maestros): Catálogos únicos descriptivos — Equipos, Mánagers, Competiciones.",
            "Tablas Puente (Bridges): Tablas para resolver cardinalidades de muchos a muchos.",
            "Tablas de Hechos (Facts): El registro histórico y transaccional masivo de partidos, alineaciones, movimientos espaciales y eventos milimétricos.",
          ]} />
          <Paragraph>
            Para cada tabla se exploran en detalle sus columnas, los tipos de datos en Pandas (<Code>dtype</Code>),
            la clase original en Python, porcentajes de nulidad y estadísticas de distribución con ejemplos
            reales extraídos directamente de los datos.
          </Paragraph>
        </div>

        {/* ── ARQUITECTURA ── */}
        <div id="dw-arquitectura">
          <SectionH2>2. Arquitectura del Modelo</SectionH2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
            {[
              { icon:"⭐", color:"#58a6ff", title:"Tablas de Hechos", items:["events_fact (12.2M filas)","matches_fact (3,464 filas)","match_lineup_players","player_match_position_fact","three_sixty_freeze_frame (15.6M)","three_sixty_events (1M)"] },
              { icon:"📦", color:"#3fb950", title:"Dimensiones", items:["competition_dim","season_dim","team_dim","stadium_dim","manager_dim","competition_team_group"] },
              { icon:"🌉", color:"#d29922", title:"Tablas Puente", items:["manager_team_match_bridge","event_tactics_lineup"] },
            ].map(g => (
              <div key={g.title} style={{
                background: "var(--bg1)", border: `1px solid ${g.color}40`,
                borderTop: `3px solid ${g.color}`, borderRadius: 8, padding: "14px 16px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 20 }}>{g.icon}</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: g.color }}>{g.title}</span>
                </div>
                {g.items.map(item => (
                  <div key={item} style={{ fontSize: 11, color: "var(--txt2)", marginBottom: 4,
                    display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ color: g.color, fontSize: 8 }}>●</span> <Code>{item}</Code>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <Callout icon="⭐" color="var(--blue)">
            <strong>Esquema Estrella:</strong> La tabla central es <Code>events_fact</Code> con 12.2M de registros.
            Las dimensiones actúan como catálogos de referencia. Las tablas puente resuelven relaciones
            muchos-a-muchos (ej. varios managers por partido, varios jugadores por formación táctica).
          </Callout>
        </div>

        {/* ── TABLAS ── */}
        <div id="dw-tablas">
          <SectionH2>3. Tablas del Modelo</SectionH2>

          <CollapseSection title="competition — 21 registros" icon="🏆" defaultOpen>
            <Paragraph>
              Catálogo único de ligas y torneos internacionales. Sin duplicados ni nulos.
            </Paragraph>
            <TableSchema rows={[
              { col:"competition_id", type:"int64", nulls:"0%",  desc:"Identificador único. Min: 2, Max: 1470. Ej: 9, 1267, 16" },
              { col:"country_name",   type:"str",   nulls:"0%",  desc:"Región/país de la competición. 13 valores únicos. Ej: Germany, Africa, Europe" },
              { col:"competition_name",type:"str",  nulls:"0%",  desc:"Nombre oficial del torneo. 21 únicos. Ej: Copa America, Copa del Rey, La Liga (18 entradas), Champions League (18)" },
            ]} />
            <Callout icon="🌍" color="var(--green)">
              Distribución geográfica: <strong>International (11), Spain (21), Europe (23), England (5)</strong>.
              Las competiciones europeas dominan. La Liga (18) y Champions League (18) concentran el mayor volumen.
            </Callout>
          </CollapseSection>

          <CollapseSection title="season — 48 registros" icon="📅">
            <TableSchema rows={[
              { col:"season_id",   type:"int64", nulls:"0%", desc:"Identificador único. Min: 1, Max: 315. Ej: 281, 27, 107" },
              { col:"season_name", type:"str",   nulls:"0%", desc:"Nombre descriptivo. 48 únicos. Ej: 2023/2024, 2015/2016, 2023" },
            ]} />
            <Paragraph>
              32 temporadas de dos años (YYYY/YYYY) y 16 de un solo año (YYYY). La mayoría de competiciones abarcan dos años calendario.
            </Paragraph>
          </CollapseSection>

          <CollapseSection title="team — 312 registros" icon="⚽">
            <TableSchema rows={[
              { col:"team_id",      type:"int64", nulls:"0%", desc:"Identificador único. Min: 1, Max: 29167. Ej: 904, 190, 184" },
              { col:"team_name",    type:"str",   nulls:"0%", desc:"Nombre oficial. 308 únicos (4 homonimias). Ej: Bayer Leverkusen, Union Berlin" },
              { col:"gender",       type:"str",   nulls:"0%", desc:"Rama deportiva. 2 únicos: male (246), female (66)" },
              { col:"country_id",   type:"int64", nulls:"0%", desc:"País de origen. Min: 3, Max: 255" },
              { col:"country_name", type:"str",   nulls:"0%", desc:"89 países distintos. Ej: Germany, Spain" },
            ]} />
            <Callout icon="⚠️" color="#d29922">
              312 <Code>team_id</Code> únicos pero 308 <Code>team_name</Code> únicos →
              4 nombres duplicados con IDs distintos (filiales u homonimias en distintas ligas).
              La rama masculina domina: 246 vs 66 equipos femeninos.
            </Callout>
          </CollapseSection>

          <CollapseSection title="stadium — 278 registros" icon="🏟️">
            <TableSchema rows={[
              { col:"id",           type:"float64", nulls:"0.36%", desc:"Identificador único. 1 nulo. Min: 2.0, Max: 1001990.0" },
              { col:"name",         type:"str",     nulls:"0.36%", desc:"Nombre del estadio. 1 nulo. Ej: BayArena, Deutsche Bank Park" },
              { col:"country_id",   type:"float64", nulls:"0.36%", desc:"País del estadio. 1 nulo. Min: 11.0, Max: 249.0" },
              { col:"country_name", type:"str",     nulls:"0.36%", desc:"País. Predominan Europa y Norteamérica. Top: England (60), Spain (46), France (29), Germany (28), USA (27)" },
            ]} />
          </CollapseSection>

          <CollapseSection title="manager — 557 registros" icon="🧑‍💼">
            <TableSchema rows={[
              { col:"manager_id",   type:"int64", nulls:"0%",    desc:"Identificador único. Min: 2, Max: 1007078" },
              { col:"manager_name", type:"str",   nulls:"0%",    desc:"Nombre completo. 557 únicos. Ej: Xabier Alonso Olano, Ole Werner" },
              { col:"dob",          type:"str",   nulls:"1.26%", desc:"Fecha de nacimiento ISO (YYYY-MM-DD). 7 nulos. Ej: 1981-11-25" },
              { col:"country_id",   type:"int64", nulls:"0%",    desc:"País de origen. Min: 4, Max: 253" },
              { col:"country_name", type:"str",   nulls:"0%",    desc:"70 nacionalidades. Ej: Spain, Germany, Croatia" },
            ]} />
          </CollapseSection>

          <CollapseSection title="manager_team_match_bridge — 6,774 filas" icon="🌉">
            <Paragraph>
              Relaciona cada entrenador con un equipo en el contexto exacto de un partido, capturando su rol (home/away).
            </Paragraph>
            <TableSchema rows={[
              { col:"match_id",    type:"int64", nulls:"0%", desc:"Partido asociado. Min: 7298, Max: 4020846" },
              { col:"team_id",     type:"int64", nulls:"0%", desc:"Equipo dirigido. Min: 1, Max: 29167" },
              { col:"manager_id",  type:"int64", nulls:"0%", desc:"Entrenador. Min: 2, Max: 1007078" },
              { col:"role",        type:"str",   nulls:"0%", desc:"Condición local/visitante. 2 únicos: home (3387), away (3387) — distribución perfectamente balanceada" },
            ]} />
          </CollapseSection>

          <CollapseSection title="matches_fact — 3,464 filas" icon="⚽">
            <TableSchema rows={[
              { col:"match_id",               type:"int64",     nulls:"0%",    desc:"Llave primaria. Min: 7298, Max: 4020846" },
              { col:"match_date",             type:"datetime64",nulls:"0%",    desc:"Fecha del partido. Min: 1958-06-24, Max: 2025-07-27" },
              { col:"kick_off",               type:"object",    nulls:"0.14%", desc:"Hora de inicio. 5 nulos. Ej: 17:30:00, 15:30:00" },
              { col:"competition_id",         type:"int64",     nulls:"0%",    desc:"Competición. Min: 2, Max: 1470" },
              { col:"season_id",              type:"int64",     nulls:"0%",    desc:"Temporada. Min: 1, Max: 315" },
              { col:"home_team_id",           type:"int64",     nulls:"0%",    desc:"Equipo local. Min: 1, Max: 29167" },
              { col:"away_team_id",           type:"int64",     nulls:"0%",    desc:"Equipo visitante. Min: 1, Max: 29167" },
              { col:"stadium_id",             type:"float64",   nulls:"0.29%", desc:"Estadio. 10 nulos. Min: 2.0, Max: 1001990.0" },
              { col:"home_score",             type:"int64",     nulls:"0%",    desc:"Goles local. Mean: 1.60. Ceros: 847 partidos" },
              { col:"away_score",             type:"int64",     nulls:"0%",    desc:"Goles visitante. Mean: 1.26. Ceros: 1104 partidos" },
              { col:"match_week",             type:"int64",     nulls:"0%",    desc:"Jornada. Min: 0, Max: 38, Mean: 15.49" },
              { col:"match_status",           type:"str",       nulls:"0%",    desc:"Estado del partido. Único valor: available" },
              { col:"match_status_360",       type:"str",       nulls:"0%",    desc:"Estado de tracking 360: unscheduled, scheduled, available, processing" },
              { col:"competition_stage_id",   type:"int64",     nulls:"0%",    desc:"Fase del torneo. Min: 1, Max: 158, Mean: 3.26" },
              { col:"competition_stage_name", type:"str",       nulls:"0%",    desc:"12 únicos. Ej: Regular Season (2961), Group Stage (328), Final (36)" },
            ]} />
          </CollapseSection>

          <CollapseSection title="match_lineup_players — 131,901 filas" icon="👥">
            <Paragraph>Convocatoria y alineación de jugadores por partido.</Paragraph>
            <TableSchema rows={[
              { col:"match_id",        type:"int64", nulls:"0%",     desc:"Partido. Min: 7298, Max: 4020846" },
              { col:"team_id",         type:"int64", nulls:"0%",     desc:"Equipo. Min: 1, Max: 29167" },
              { col:"player_id",       type:"int64", nulls:"0%",     desc:"Jugador. Min: 2935, Max: 482216" },
              { col:"player_name",     type:"str",   nulls:"0%",     desc:"Nombre completo. 10808 únicos. Ej: Magdalena Lilly Eriksson" },
              { col:"player_nickname", type:"str",   nulls:"61.94%", desc:"⚠ ALTA NULIDAD. 81703 nulos. Top: Lionel Messi (604), Xavi (267)" },
              { col:"jersey_number",   type:"int64", nulls:"0%",     desc:"Dorsal. Min: 0, Max: 1000, Mean: 16.15. Ceros: 186 (anomalía)" },
              { col:"country_id",      type:"float64",nulls:"0.01%", desc:"País del jugador. 13 nulos. Min: 3.0, Max: 255.0" },
              { col:"country_name",    type:"str",   nulls:"0.01%", desc:"Top: Spain (19805), England (11853)" },
            ]} />
            <Callout icon="⚠️" color="#f85149">
              <strong>player_nickname tiene 61.94% de nulos</strong> — no debe usarse como clave de unión.
              Usar <Code>player_id</Code> como identificador confiable en todos los cruces.
            </Callout>
          </CollapseSection>

          <CollapseSection title="player_match_position_fact — 130,889 filas" icon="🗺️">
            <Paragraph>Evolución táctica de cada jugador: posiciones, cambios y transiciones temporales.</Paragraph>
            <TableSchema rows={[
              { col:"match_id",     type:"int64", nulls:"0%",     desc:"Partido. Min: 7298, Max: 4020846" },
              { col:"team_id",      type:"int64", nulls:"0%",     desc:"Equipo. Min: 1, Max: 29167" },
              { col:"player_id",    type:"int64", nulls:"0%",     desc:"Jugador. Min: 2935, Max: 482216" },
              { col:"position_id",  type:"int64", nulls:"0%",     desc:"Posición táctica. Min: 1, Max: 25, Mean: 12.04" },
              { col:"position",     type:"str",   nulls:"0%",     desc:"25 roles únicos: Center Forward, Left Wing, Goalkeeper, etc." },
              { col:"from_time",    type:"str",   nulls:"0%",     desc:"Inicio de posición. Top: 00:00 (76227), 45:00 (4332)" },
              { col:"to_time",      type:"str",   nulls:"58.33%", desc:"⚠ ALTA NULIDAD. 76354 nulos — jugadores activos sin cierre" },
              { col:"from_period",  type:"int64", nulls:"0%",     desc:"Período de inicio. Valores 1–5 (tiempo regular, prórroga, penales)" },
              { col:"to_period",    type:"float64",nulls:"58.33%",desc:"⚠ Coincide con to_time. Min: 1.0, Max: 5.0" },
              { col:"start_reason", type:"str",   nulls:"0%",     desc:"Motivo de inicio. Top: Starting XI (76161), Tactical Shift (30101)" },
              { col:"end_reason",   type:"str",   nulls:"0%",     desc:"Motivo de finalización. Top: Final Whistle (76354), Tactical Shift (28822)" },
            ]} />
          </CollapseSection>

          <CollapseSection title="events_fact — 12,185,465 filas" icon="⚡" defaultOpen>
            <Callout icon="🔥" color="var(--red)">
              La tabla más grande e importante del dataset. Rastrea cada acción del partido —
              pases, regates, presiones, tiros — milisegundo a milisegundo.
            </Callout>
            <TableSchema rows={[
              { col:"event_id",        type:"str",     nulls:"0%",     desc:"UUID único por evento. 12185465 únicos (llave primaria absoluta)" },
              { col:"match_id",        type:"int64",   nulls:"0%",     desc:"Partido. Min: 7298, Max: 4020846" },
              { col:"index",           type:"int64",   nulls:"0%",     desc:"Orden secuencial en el partido. Min: 1, Max: 5190, Mean: 1781.46" },
              { col:"period",          type:"int64",   nulls:"0%",     desc:"Período (1–5: tiempo regular, prórroga, penales)" },
              { col:"timestamp",       type:"str",     nulls:"0%",     desc:"Marca temporal exacta. 2777705 únicos" },
              { col:"minute",          type:"int64",   nulls:"0%",     desc:"Minuto. Min: 0, Max: 139, Mean: 45.10" },
              { col:"second",          type:"int64",   nulls:"0%",     desc:"Segundo. Min: 0, Max: 59, Mean: 29.28" },
              { col:"event_type_name", type:"str",     nulls:"0%",     desc:"35 tipos. Top: Pass (3.39M), Ball Receipt (3.17M), Carry (2.63M), Pressure (1.11M)" },
              { col:"team_name",       type:"str",     nulls:"0%",     desc:"308 equipos únicos" },
              { col:"possession",      type:"int64",   nulls:"0%",     desc:"ID de secuencia de posesión. Min: 1, Max: 302, Mean: 95.38" },
              { col:"play_pattern_name",type:"str",    nulls:"0%",     desc:"9 patrones. Top: Regular Play (5.39M), From Throw In, From Free Kick, From Counter" },
              { col:"duration",        type:"float64", nulls:"26.26%", desc:"⚠ Duración en seg. 26.26% nulos (eventos instantáneos). Min: -2660.41 (anomalías), Max: 1746.58" },
              { col:"x",              type:"float64",  nulls:"0.75%",  desc:"Coordenada longitudinal. Min: 0.1, Max: 120.9, Mean: 58.93" },
              { col:"y",              type:"float64",  nulls:"0.75%",  desc:"Coordenada lateral. Min: 0.1, Max: 80.8, Mean: 40.00" },
              { col:"end_x",          type:"float64",  nulls:"49.89%", desc:"X destino del evento (pases, tiros). Alto % nulos en eventos sin desplazamiento" },
              { col:"end_y",          type:"float64",  nulls:"49.89%", desc:"Y destino del evento. Alto % nulos en eventos sin desplazamiento" },
            ]} />
            <SectionH3>Top event_type_name</SectionH3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 16 }}>
              {[
                ["Pass",          "3,386,808"],["Ball Receipt*","3,166,415"],["Carry",        "2,631,852"],
                ["Pressure",      "1,113,488"],["Ball Recovery","366,560"],  ["Duel",          "257,785"],
                ["Shot",          "88,000"],   ["Block",         "132,309"], ["Interception",  "79,623"],
                ["Goal Keeper",   "106,546"],  ["Foul Committed","100,481"], ["Dribble",       "122,013"],
              ].map(([name, count]) => (
                <div key={name} style={{ display: "flex", justifyContent: "space-between",
                  background: "var(--bg2)", borderRadius: 6, padding: "6px 10px", fontSize: 12 }}>
                  <Code>{name}</Code>
                  <span style={{ color: "var(--txt0)", fontWeight: 700 }}>{count}</span>
                </div>
              ))}
            </div>
            <Callout icon="📊" color="var(--blue)">
              El 26.26% de nulos en <Code>duration</Code> es completamente normal: eventos instantáneos
              (un tiro bloqueado, una recepción estática) no tienen lapso de tiempo medible.
              Los valores negativos (mínimo -2660.41) sí son anomalías y deben filtrarse.
            </Callout>
          </CollapseSection>

          <CollapseSection title="event_tactics_lineup — 171,622 filas" icon="🧩">
            <Paragraph>Formaciones numéricas y asignación de jugadores a vértices de la formación.</Paragraph>
            <TableSchema rows={[
              { col:"event_id",      type:"str",   nulls:"0%", desc:"UUID del evento táctico. 15602 únicos" },
              { col:"match_id",      type:"int64", nulls:"0%", desc:"Partido. Min: 7298, Max: 4020846" },
              { col:"team_id",       type:"int64", nulls:"0%", desc:"Equipo. Min: 1, Max: 29167" },
              { col:"formation",     type:"int64", nulls:"0%", desc:"Formación codificada. Min: 343, Max: 312112. Top: 4231 (49225), 433 (34419), 442 (28721)" },
              { col:"player_id",     type:"int64", nulls:"0%", desc:"Jugador. Min: 2935, Max: 482216" },
              { col:"position_name", type:"str",   nulls:"0%", desc:"Posición táctica. Ej: Goalkeeper, Left Center Back" },
              { col:"jersey_number", type:"int64", nulls:"0%", desc:"Dorsal. Min: 0, Max: 1000. Ceros: 484" },
            ]} />
            <Callout icon="🏆" color="var(--purple)">
              Formación más usada: <strong>4-2-3-1</strong> (49,225 registros, 28.7%), seguida de
              <strong> 4-3-3</strong> (34,419) y <strong>4-4-2</strong> (28,721).
              El fútbol moderno muestra fuerte estandarización táctica con pocas formaciones dominantes.
            </Callout>
          </CollapseSection>

          <CollapseSection title="three_sixty_events — 1,027,908 filas" icon="🌐">
            <TableSchema rows={[
              { col:"event_uuid",   type:"str",   nulls:"0%", desc:"UUID del evento 360. 1027908 únicos" },
              { col:"match_id",     type:"int64", nulls:"0%", desc:"Partido. Min: 3788741, Max: 4020846" },
              { col:"visible_area", type:"str",   nulls:"0%", desc:"Polígono del área visible — coordenadas de reconstrucción por visión computacional. 701023 únicos" },
            ]} />
          </CollapseSection>

          <CollapseSection title="three_sixty_freeze_frame — 15,583,891 filas" icon="📸">
            <Callout icon="🔥" color="var(--red)">
              La tabla de mayor volumen del dataset. Cada fila = posición de 1 jugador en 1 instante congelado.
            </Callout>
            <TableSchema rows={[
              { col:"event_uuid", type:"str",     nulls:"0%", desc:"UUID del evento. 1027908 únicos" },
              { col:"match_id",   type:"int64",   nulls:"0%", desc:"Partido. Min: 3788741, Max: 4020846" },
              { col:"x",         type:"float64",  nulls:"0%", desc:"Posición X del jugador. Min: -8.28, Max: 129.42, Mean: 64.14" },
              { col:"y",         type:"float64",  nulls:"0%", desc:"Posición Y del jugador. Min: -36.00, Max: 117.53, Mean: 40.01" },
              { col:"teammate",  type:"bool",     nulls:"0%", desc:"True si es compañero del actor del evento. Balanceado True/False" },
              { col:"actor",     type:"bool",     nulls:"0%", desc:"True si es el jugador que ejecuta la acción. Baja proporción (rol protagonista)" },
              { col:"keeper",    type:"bool",     nulls:"0%", desc:"True si es portero. Baja proporción (rol especializado)" },
            ]} />
          </CollapseSection>
        </div>

        {/* ── ESTADÍSTICA ── */}
        <div id="dw-estadistica">
          <SectionH2>4. Metodología Estadística</SectionH2>

          <SectionH3>4.1 Medidas de Tendencia Central</SectionH3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {[
              { name:"Media aritmética", formula:"x̄ = (1/n) Σ xᵢ", desc:"Resume el centro global. Sensible a outliers." },
              { name:"Mediana",          formula:"x̃ = mediana(x)",  desc:"Robusta ante asimetría y valores extremos." },
              { name:"Media geométrica", formula:"G = (∏ xᵢ)^(1/n), xᵢ > 0", desc:"Útil para escalas multiplicativas." },
              { name:"Media armónica",   formula:"H = n / Σ(1/xᵢ), xᵢ > 0", desc:"Penaliza valores altos, resalta magnitudes pequeñas." },
            ].map(m => (
              <div key={m.name} style={{ background: "var(--bg1)", border: "1px solid var(--border)",
                borderRadius: 8, padding: "12px 14px" }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--txt0)", marginBottom: 6 }}>{m.name}</div>
                <Formula>{m.formula}</Formula>
                <div style={{ fontSize: 12, color: "var(--txt2)" }}>{m.desc}</div>
              </div>
            ))}
          </div>

          <SectionH3>4.2 Dispersión</SectionH3>
          <Formula>s = √[ (1/(n-1)) · Σ(xᵢ − x̄)² ]</Formula>
          <Paragraph>
            Se acompaña con cuartiles, rango intercuartil (IQR) y boxplots para identificar asimetría y outliers.
          </Paragraph>

          <SectionH3>4.3 Correlación y Covarianza</SectionH3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--txt3)", marginBottom: 4 }}>Covarianza</div>
              <Formula>cov(X,Y) = (1/(n-1)) · Σ(xᵢ − x̄)(yᵢ − ȳ)</Formula>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--txt3)", marginBottom: 4 }}>Correlación de Pearson</div>
              <Formula>r_XY = cov(X,Y) / (s_X · s_Y) ∈ [−1, 1]</Formula>
            </div>
          </div>
          <Callout icon="📐" color="var(--blue)">
            En este proyecto la <strong>correlación es más interpretable que la covarianza</strong>,
            porque la covarianza depende de la escala de las variables. La correlación permite
            comparar la fuerza de la relación entre pares de features independientemente de sus unidades.
          </Callout>

          <SectionH3>4.4 Familias de Gráficos Utilizadas</SectionH3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
            {[
              { icon:"📊", title:"Histogramas", desc:"Ver sesgo, concentración y colas de la distribución" },
              { icon:"📦", title:"Boxplots", desc:"Detectar outliers y medir simetría" },
              { icon:"📈", title:"Barras", desc:"Variables categóricas y cardinalidad" },
              { icon:"🌡️", title:"Heatmaps", desc:"Correlaciones lineales entre features numéricas" },
            ].map(g => (
              <div key={g.title} style={{ background: "var(--bg2)", borderRadius: 8, padding: "12px", textAlign: "center" }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>{g.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 12, color: "var(--txt0)", marginBottom: 4 }}>{g.title}</div>
                <div style={{ fontSize: 11, color: "var(--txt2)" }}>{g.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── CALIDAD ── */}
        <div id="dw-calidad">
          <SectionH2>5. Calidad y Volumen de Datos</SectionH2>

          <SectionH3>5.1 Resumen de Volumen</SectionH3>
          <VolumeTable rows={[
            { name:"events_fact",              rows:"12,185,465", size:"623 MB", desc:"1 evento individual de partido (pase, tiro, presión, etc.)" },
            { name:"three_sixty_freeze_frame", rows:"15,583,891", size:"238 MB", desc:"Posición de 1 jugador en 1 frame de evento 360°" },
            { name:"three_sixty_events",       rows:"1,027,908",  size:"107 MB", desc:"Reconstrucción espacial 360° de un evento" },
            { name:"event_tactics_lineup",     rows:"171,622",    size:"1.5 MB", desc:"Jugador en bloque táctico de un evento" },
            { name:"match_lineup_players",     rows:"131,901",    size:"1.0 MB", desc:"Jugador en alineación de un partido" },
            { name:"player_match_position_fact",rows:"130,889",   size:"0.9 MB", desc:"Intervalo posicional de jugador en partido" },
            { name:"manager_team_match_bridge",rows:"6,774",      size:"46 KB",  desc:"Relación entrenador-equipo-partido" },
            { name:"matches_fact",             rows:"3,464",      size:"90 KB",  desc:"Partido completo con contexto" },
            { name:"team_dim",                 rows:"312",        size:"10 KB",  desc:"Equipo único participante" },
            { name:"manager_dim",              rows:"557",        size:"22 KB",  desc:"Entrenador único identificado" },
            { name:"stadium_dim",              rows:"278",        size:"10 KB",  desc:"Estadio único" },
            { name:"competition_dim",          rows:"21",         size:"3 KB",   desc:"Competición oficial" },
            { name:"season_dim",               rows:"48",         size:"2.3 KB", desc:"Temporada específica" },
          ]} />

          <Callout icon="💾" color="var(--green)">
            <strong>Tamaño total aproximado: ~1.1 GB.</strong> Completamente manejable con
            CPU multicore y 8–16 GB RAM. El formato Parquet columnar y el motor DuckDB permiten
            procesar events_fact (12M filas) en segundos con SQL analítico.
          </Callout>

          <SectionH3>5.2 Problemas de Calidad Detectados</SectionH3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { severity:"alta",   col:"player_nickname",     pct:"61.94%", table:"match_lineup_players", issue:"No usar como clave de unión. Usar player_id." },
              { severity:"alta",   col:"to_time / to_period", pct:"58.33%", table:"player_match_position_fact", issue:"Jugadores activos sin cierre. Normal en fútbol: permanecen en posición hasta el final." },
              { severity:"media",  col:"duration",            pct:"26.26%", table:"events_fact", issue:"Eventos instantáneos sin lapso medible. Filtrar valores negativos (min -2660.41 seg → anomalía)." },
              { severity:"baja",   col:"group",               pct:"5.56%",  table:"competition_team_group", issue:"Competiciones sin fase de grupos (ligas todos-contra-todos)." },
              { severity:"baja",   col:"end_x / end_y",       pct:"49.89%", table:"events_fact", issue:"Normal en eventos sin desplazamiento (presión, recuperación, etc.)." },
              { severity:"baja",   col:"stadium_id",          pct:"0.29%",  table:"matches_fact", issue:"Registros históricos incompletos." },
            ].map(p => (
              <div key={p.col} style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                background: "var(--bg1)", border: "1px solid var(--border)",
                borderLeft: `3px solid ${p.severity==="alta"?"#f85149":p.severity==="media"?"#d29922":"#3fb950"}`,
                borderRadius: 8, padding: "10px 14px",
              }}>
                <div style={{ minWidth: 48, textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 800,
                    color: p.severity==="alta"?"#f85149":p.severity==="media"?"#d29922":"#3fb950" }}>
                    {p.pct}
                  </div>
                  <div style={{ fontSize: 9, color: "var(--txt3)", textTransform: "uppercase" }}>nulos</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, marginBottom: 2 }}>
                    <Code>{p.col}</Code>
                    <span style={{ color: "var(--txt3)", fontSize: 11, marginLeft: 6 }}>en {p.table}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--txt2)" }}>{p.issue}</div>
                </div>
              </div>
            ))}
          </div>

          <SectionH3>5.3 Duplicidad</SectionH3>
          <Callout icon="✅" color="var(--green)">
            <strong>No se identifican registros duplicados</strong> a nivel estructural en ninguna tabla.
            Cada tabla define granularidad clara y usa identificadores únicos (<Code>event_id</Code>,
            <Code>match_id</Code>, <Code>player_id</Code>, etc.).
            El dataset está <strong>normalizado a nivel lógico</strong>, sin redundancia evidente.
            Excepción: 4 nombres de equipos homónimos con <Code>team_id</Code> distintos (filiales).
          </Callout>
        </div>

        {/* ── ML ── */}
        <div id="dw-ml">
          <SectionH2>6. Análisis del Problema de Machine Learning</SectionH2>

          <CollapseSection title="¿Es un problema supervisado? ¿Cuál es la columna de salida?" icon="🎯" defaultOpen>
            <Paragraph>
              El dataset permite plantear múltiples problemas supervisados según el objetivo:
            </Paragraph>
            <BulletList items={[
              "Regresión: predecir home_score o away_score en matches_fact.",
              "Clasificación multiclase: predecir event_type_name (35 categorías: pase, tiro, recuperación, etc.).",
              "Clasificación binaria: predecir si un evento pertenece a una categoría específica.",
              "Clasificación ternaria: predecir resultado del partido (victoria local, empate, victoria visitante).",
            ]} />
            <Callout icon="⚠️" color="#d29922">
              El reporte no etiqueta ninguna columna como <em>target</em> predefinido.
              El analista debe definir la variable de salida según el caso de uso.
            </Callout>
          </CollapseSection>

          <CollapseSection title="¿Está balanceado el conjunto de salida?" icon="⚖️">
            <BulletList items={[
              "event_type_name: MUY DESBALANCEADO. Pass (3.39M) vs Own Goal Against (337). Requiere técnicas de remuestreo.",
              "home_score / away_score: Desbalanceado. 847 partidos con 0 goles locales. No es error — es la naturaleza del dominio.",
              "competition_stage_name: Fuerte desbalance. Regular Season (2961) vs Championship Final (1).",
            ]} />
            <Paragraph>
              En general se requerirán <strong>F1-score, AUC-ROC o técnicas de remuestreo</strong>
              (SMOTE, undersampling) para manejar el desbalance en las variables de salida.
            </Paragraph>
          </CollapseSection>

          <CollapseSection title="Features importantes vs descartables" icon="🔑">
            <SectionH3>Features importantes</SectionH3>
            <BulletList items={[
              "Temporales: minute, second, period, index, possession (r > 0.80 entre sí → correlación estructural).",
              "Espaciales: x, y (independientes de otras variables, aportan info única sobre posicionamiento).",
              "Contextuales: team_id, competition_id, season_id, match_week.",
              "Tácticas: formation, position_name, play_pattern_name.",
            ]} />
            <SectionH3>Variables a descartar o tratar con precaución</SectionH3>
            <BulletList items={[
              "player_nickname (61.94% nulos) — no fiable como clave.",
              "Identificadores puros (event_id, match_id, etc.) — no aportan poder predictivo.",
              "duration (26.26% nulos + valores negativos hasta -2660 seg) — requiere limpieza.",
              "match_status (siempre 'available') — varianza cero, no aporta información.",
            ]} />
          </CollapseSection>

          <CollapseSection title="¿Es un problema dependiente del tiempo? (Time Series)" icon="📅">
            <Callout icon="⏱️" color="var(--blue)">
              <strong>Sí, completamente.</strong> La tabla <Code>events</Code> está ordenada
              secuencialmente por <Code>index</Code>. Cada evento tiene timestamp, minute, second y period.
              Cualquier modelo debe <strong>respetar el orden temporal</strong> y no mezclar eventos
              de distintos partidos. Se recomienda validación con ventana deslizante o split cronológico
              por <Code>match_date</Code>.
            </Callout>
          </CollapseSection>

          <CollapseSection title="¿Hay relaciones sorprendentes entre variables?" icon="🔍">
            <BulletList items={[
              "Alta correlación temporal: index, minute, period, possession tienen r > 0.80 (hasta 0.97). Redundancia estructural, no causalidad táctica.",
              "Independencia espacial: x e y tienen correlación ~0 con el resto. La posición en el campo es una dimensión ortogonal al flujo temporal.",
              "Correlación moderada event_type_id ↔ duration: ciertos eventos tienen duraciones características.",
              "Formación táctica dominante: 4-2-3-1 (28.7% de los registros) refleja estandarización global del fútbol moderno.",
            ]} />
          </CollapseSection>
        </div>

        {/* ── CONCLUSIONES ── */}
        <div id="dw-conclusiones">
          <SectionH2>7. Conclusiones</SectionH2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            {[
              { icon:"⚡", color:"var(--blue)",   title:"events_fact",             desc:"Tabla central para análisis de comportamiento de juego. Alta cardinalidad, estructura secuencial temporal, coordenadas espaciales independientes." },
              { icon:"📋", color:"var(--green)",  title:"matches_fact",            desc:"Contexto competitivo: resultados, temporadas, estadios. Variables discretas concentradas en rangos pequeños (goles)." },
              { icon:"👥", color:"var(--purple)", title:"Tablas de alineaciones",  desc:"Estructura de jugadores por partido. Atención a player_nickname (62% nulos) y jersey_number (ceros atípicos)." },
              { icon:"🌐", color:"var(--orange)", title:"Tablas 360°",             desc:"Análisis espacial avanzado. 15.6M filas sin nulos, pero cobertura limitada (mayoría de partidos sin tracking disponible)." },
            ].map(c => (
              <div key={c.title} style={{
                background: "var(--bg1)", border: "1px solid var(--border)",
                borderLeft: `3px solid ${c.color}`, borderRadius: 10, padding: "16px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 20 }}>{c.icon}</span>
                  <strong style={{ color: "var(--txt0)", fontSize: 14 }}>{c.title}</strong>
                </div>
                <p style={{ fontSize: 13, color: "var(--txt2)", lineHeight: 1.6, margin: 0 }}>{c.desc}</p>
              </div>
            ))}
          </div>

          <Callout icon="📐" color="var(--green)">
            Las medidas de tendencia central, dispersión, correlación y covarianza son útiles
            <strong> siempre que se interpreten según el tipo de variable</strong> y no se mezclen
            llaves numéricas (IDs) con magnitudes reales. El dataset está normalizado, sin redundancia
            estructural y es completamente manejable (~1.1 GB) con herramientas modernas como
            DuckDB y Parquet.
          </Callout>
        </div>

      </div>
    </div>
  );
}
