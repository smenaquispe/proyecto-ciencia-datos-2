"use client"

import { useState, useEffect, useCallback } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { api, type GraphCompetition, type GraphTeam, type GraphMatch } from "@/lib/api"

// ── Node types ────────────────────────────────────────────────────────────────

type NodeKind = "root" | "competition" | "season" | "team" | "match"

interface NodeData {
  label: string
  kind: NodeKind
  sub?: string
  result?: "W" | "D" | "L"
  has360?: boolean
  payload?: unknown
  onClick?: () => void
  [key: string]: unknown
}

const KIND_STYLES: Record<NodeKind, { bg: string; border: string; text: string; w: number }> = {
  root:        { bg: "#1e3a5f", border: "#3b82f6", text: "#93c5fd", w: 140 },
  competition: { bg: "#1a3a2a", border: "#22c55e", text: "#86efac", w: 160 },
  season:      { bg: "#2d1b69", border: "#a855f7", text: "#d8b4fe", w: 130 },
  team:        { bg: "#7c2d12", border: "#f97316", text: "#fdba74", w: 150 },
  match:       { bg: "#1c1917", border: "#78716c", text: "#d6d3d1", w: 200 },
}

const RESULT_COLORS: Record<string, string> = {
  W: "#22c55e", D: "#eab308", L: "#ef4444",
}

function CustomNode({ data }: NodeProps) {
  const nd = data as NodeData
  const style = KIND_STYLES[nd.kind]
  const resultColor = nd.result ? RESULT_COLORS[nd.result] : undefined

  return (
    <div
      onClick={nd.onClick as (() => void) | undefined}
      style={{
        background: resultColor ? `${resultColor}18` : style.bg,
        border: `2px solid ${resultColor ?? style.border}`,
        borderRadius: 10,
        padding: "8px 12px",
        width: style.w,
        cursor: nd.onClick ? "pointer" : "default",
        transition: "all 0.15s",
        boxShadow: nd.onClick ? `0 0 12px ${resultColor ?? style.border}44` : "none",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: style.border, width: 8, height: 8 }} />

      {/* Kind badge */}
      <div style={{ fontSize: 8, color: style.text, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3, opacity: 0.7 }}>
        {nd.kind === "match" && nd.result
          ? <span style={{ color: resultColor, fontWeight: 700 }}>{nd.result}</span>
          : nd.kind}
        {nd.has360 && <span style={{ marginLeft: 4, color: "#4ade80" }}>● 360°</span>}
      </div>

      {/* Label */}
      <div style={{ fontSize: 11, fontWeight: 700, color: resultColor ?? style.text, lineHeight: 1.3 }}>
        {nd.label}
      </div>

      {/* Sub label */}
      {nd.sub && (
        <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 2, lineHeight: 1.2 }}>
          {nd.sub}
        </div>
      )}

      <Handle type="source" position={Position.Right} style={{ background: style.border, width: 8, height: 8 }} />
    </div>
  )
}

const nodeTypes = { custom: CustomNode }

// ── Layout helpers ────────────────────────────────────────────────────────────

const COL_X = [0, 230, 470, 710, 980]   // x positions per column
const ROW_H = 60                          // vertical spacing between nodes

function makeNode(
  id: string,
  kind: NodeKind,
  label: string,
  col: number,
  row: number,
  sub?: string,
  extras?: Partial<NodeData>,
): Node {
  return {
    id,
    type: "custom",
    position: { x: COL_X[col], y: row * ROW_H },
    data: { label, kind, sub, ...extras } as NodeData,
    draggable: true,
  }
}

function makeEdge(source: string, target: string, animated = false): Edge {
  return {
    id: `${source}->${target}`,
    source,
    target,
    animated,
    style: { stroke: "#475569", strokeWidth: 1.5 },
    type: "smoothstep",
  }
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  countryName: string
  onMatchSelected: (matchId: number, matchLabel: string) => void
  onReset?: () => void
  graphHeight?: number
}

type Phase = "competitions" | "seasons" | "teams" | "matches"

export default function GraphSelector({ countryName, onMatchSelected, onReset, graphHeight = 420 }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [loading, setLoading]            = useState(false)
  const [phase, setPhase]                = useState<Phase>("competitions")

  // Stored selections
  const [selCompetition, setSelCompetition] = useState<GraphCompetition | null>(null)
  const [selSeasonId, setSelSeasonId]       = useState<number | null>(null)
  const [selSeasonLabel, setSelSeasonLabel] = useState<string | null>(null)
  const [selTeam, setSelTeam]               = useState<GraphTeam | null>(null)

  // ── Load competitions ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!countryName) return
    setLoading(true)
    setPhase("competitions")
    setSelCompetition(null); setSelSeasonId(null); setSelTeam(null)

    api.graphCountry(countryName).then(({ competitions }) => {
      const ns: Node[] = []
      const es: Edge[] = []

      // Root node
      ns.push(makeNode("root", "root", countryName, 0, Math.floor(competitions.length / 2), "País"))

      competitions.forEach((c, i) => {
        const nid = `comp-${c.competition_id}`
        ns.push(makeNode(nid, "competition", c.label, 1, i,
          `${c.seasons.length} temporadas · ${c.gender === "female" ? "♀" : "♂"}`,
          {
            onClick: () => handleCompetitionClick(c, competitions),
            payload: c,
          }
        ))
        es.push(makeEdge("root", nid))
      })

      setNodes(ns); setEdges(es)
      setLoading(false)
    })
  }, [countryName]) // eslint-disable-line

  // ── Click competition → expand seasons ────────────────────────────────────
  const handleCompetitionClick = useCallback((c: GraphCompetition, allComps: GraphCompetition[]) => {
    setSelCompetition(c); setSelSeasonId(null); setSelTeam(null)
    setPhase("seasons")

    const ns: Node[] = []
    const es: Edge[] = []

    ns.push(makeNode("root", "root", countryName, 0, Math.floor(allComps.length / 2)))
    allComps.forEach((cc, i) => {
      const isSelected = cc.competition_id === c.competition_id
      const nid = `comp-${cc.competition_id}`
      ns.push(makeNode(nid, "competition", cc.label, 1, i,
        `${cc.seasons.length} temporadas`,
        {
          onClick: () => handleCompetitionClick(cc, allComps),
          payload: cc,
          style: isSelected ? { opacity: 1 } : { opacity: 0.4 },
        }
      ))
      es.push(makeEdge("root", nid))
    })

    // Add season nodes for selected competition
    c.seasons.forEach((s, i) => {
      const sid = `season-${c.competition_id}-${s.season_id}`
      ns.push(makeNode(sid, "season", s.label, 2, i, `${s.matches} partidos`, {
        onClick: () => handleSeasonClick(c, s.season_id, s.label, c.seasons.length),
        payload: s,
      }))
      es.push(makeEdge(`comp-${c.competition_id}`, sid, true))
    })

    setNodes(ns); setEdges(es)
  }, [countryName]) // eslint-disable-line

  // ── Click season → load teams ─────────────────────────────────────────────
  const handleSeasonClick = useCallback(async (
    comp: GraphCompetition, seasonId: number, seasonLabel: string, totalSeasons: number
  ) => {
    setSelSeasonId(seasonId); setSelSeasonLabel(seasonLabel); setSelTeam(null)
    setPhase("teams"); setLoading(true)

    const { teams } = await api.graphTeams(comp.competition_id, seasonId)
    setLoading(false)

    setNodes(prev => {
      // Remove old team/match nodes, keep root+comp+season
      const keep = prev.filter(n => !n.id.startsWith("team-") && !n.id.startsWith("match-"))
      // Dim non-selected seasons
      const updated = keep.map(n =>
        n.id.startsWith("season-")
          ? { ...n, data: { ...n.data, style: n.id === `season-${comp.competition_id}-${seasonId}` ? {} : { opacity: 0.3 } } }
          : n
      )
      // Add team nodes
      const teamNodes = teams.map((t, i) =>
        makeNode(`team-${t.team_id}`, "team", t.label, 3, i, `${t.matches} partidos`, {
          onClick: () => handleTeamClick(comp, seasonId, seasonLabel, t, teams.length),
          payload: t,
        })
      )
      return [...updated, ...teamNodes]
    })

    setEdges(prev => {
      const keep = prev.filter(e => !e.id.includes("team-") && !e.id.includes("match-"))
      const teamEdges = teams.map(t =>
        makeEdge(`season-${comp.competition_id}-${seasonId}`, `team-${t.team_id}`, true)
      )
      return [...keep, ...teamEdges]
    })

    setSelCompetition(comp)
  }, []) // eslint-disable-line

  // ── Click team → load matches ─────────────────────────────────────────────
  const handleTeamClick = useCallback(async (
    comp: GraphCompetition, seasonId: number, seasonLabel: string,
    team: GraphTeam, totalTeams: number
  ) => {
    setSelTeam(team); setPhase("matches"); setLoading(true)

    const { matches } = await api.graphOpponents(comp.competition_id, seasonId, team.team_id)
    setLoading(false)

    setNodes(prev => {
      const keep = prev.filter(n => !n.id.startsWith("match-"))
      const dimmed = keep.map(n =>
        n.id.startsWith("team-")
          ? { ...n, data: { ...n.data, style: n.id === `team-${team.team_id}` ? {} : { opacity: 0.25 } } }
          : n
      )
      const matchNodes = matches.map((m, i) => {
        const label = m.is_home
          ? `${team.label} ${m.my_score}–${m.opp_score} ${m.opponent_name}`
          : `${m.opponent_name} ${m.opp_score}–${m.my_score} ${team.label}`
        return makeNode(`match-${m.match_id}`, "match", label, 4, i,
          m.match_date,
          {
            result: m.result,
            has360: m.has_360,
            payload: m,
            onClick: () => {
              onMatchSelected(m.match_id, label)
            },
          }
        )
      })
      return [...dimmed, ...matchNodes]
    })

    setEdges(prev => {
      const keep = prev.filter(e => !e.id.includes("->match-"))
      const matchEdges = matches.map(m =>
        makeEdge(`team-${team.team_id}`, `match-${m.match_id}`, true)
      )
      return [...keep, ...matchEdges]
    })
  }, [onMatchSelected]) // eslint-disable-line

  const onConnect = useCallback(
    (params: Connection) => setEdges(eds => addEdge(params, eds)),
    [setEdges]
  )

  // Phase legend
  const phaseLabel: Record<Phase, string> = {
    competitions: "Selecciona una liga",
    seasons:      "Selecciona una temporada",
    teams:        "Selecciona un equipo",
    matches:      "Selecciona un partido",
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">
          {phaseLabel[phase]}
        </span>
        {loading && <span className="text-[10px] text-slate-500 animate-pulse">Cargando…</span>}
        <button
          onClick={() => {
            setPhase("competitions")
            setSelCompetition(null); setSelSeasonId(null); setSelTeam(null)
            onReset?.()
            // Reload competitions
            setLoading(true)
            api.graphCountry(countryName).then(({ competitions }) => {
              const ns: Node[] = []
              const es: Edge[] = []
              ns.push(makeNode("root", "root", countryName, 0, Math.floor(competitions.length / 2), "País"))
              competitions.forEach((c, i) => {
                const nid = `comp-${c.competition_id}`
                ns.push(makeNode(nid, "competition", c.label, 1, i,
                  `${c.seasons.length} temporadas`,
                  { onClick: () => handleCompetitionClick(c, competitions), payload: c }
                ))
                es.push(makeEdge("root", nid))
              })
              setNodes(ns); setEdges(es); setLoading(false)
            })
          }}
          className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
        >
          ↺ Reiniciar
        </button>
      </div>

      {/* Graph canvas */}
      <div
        className="rounded-xl border border-slate-700 overflow-hidden"
        style={{ height: graphHeight }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          style={{ background: "#0f172a" }}
        >
          <Background color="#1e293b" gap={20} size={1} />
          <Controls
            style={{ background: "#1e293b", border: "1px solid #334155" }}
            showInteractive={false}
          />
          <MiniMap
            style={{ background: "#0f172a", border: "1px solid #334155" }}
            nodeColor={(n) => {
              const kind = (n.data as NodeData).kind
              return KIND_STYLES[kind]?.border ?? "#475569"
            }}
            maskColor="rgba(0,0,0,0.6)"
          />
        </ReactFlow>
      </div>

      {/* Legend */}
      <div className="flex gap-3 flex-wrap text-[9px]">
        {Object.entries(KIND_STYLES).filter(([k]) => k !== "root").map(([kind, s]) => (
          <span key={kind} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: s.border }} />
            <span style={{ color: s.text }}>{kind}</span>
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
          <span className="text-green-400">W</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />
          <span className="text-yellow-400">D</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
          <span className="text-red-400">L</span>
        </span>
      </div>
    </div>
  )
}
