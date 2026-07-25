"use client"

import type { Competition, Match } from "@/lib/types"

// ── Competition selector ──────────────────────────────────────────────────────

interface CompetitionSelectorProps {
  competitions: Competition[]
  selected: Competition | null
  onSelect: (c: Competition) => void
  disabled?: boolean
}

export function CompetitionSelector({ competitions, selected, onSelect, disabled }: CompetitionSelectorProps) {
  // Group by competition name
  const groups: Record<string, Competition[]> = {}
  for (const c of competitions) {
    if (!groups[c.competition_name]) groups[c.competition_name] = []
    groups[c.competition_name].push(c)
  }

  return (
    <div>
      <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">
        Liga / Competición
      </label>
      <select
        disabled={disabled || competitions.length === 0}
        value={selected ? `${selected.competition_id}-${selected.season_id}` : ""}
        onChange={(e) => {
          const [cid, sid] = e.target.value.split("-").map(Number)
          const found = competitions.find(c => c.competition_id === cid && c.season_id === sid)
          if (found) onSelect(found)
        }}
        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white
                   focus:outline-none focus:border-amber-400 disabled:opacity-40 disabled:cursor-not-allowed
                   transition-colors"
      >
        <option value="">
          {competitions.length === 0 ? "— Selecciona un país primero —" : "— Selecciona una liga —"}
        </option>
        {Object.entries(groups).map(([name, comps]) => (
          <optgroup key={name} label={name}>
            {comps.map((c) => (
              <option key={`${c.competition_id}-${c.season_id}`} value={`${c.competition_id}-${c.season_id}`}>
                {c.season_name} {c.competition_gender === "female" ? "♀" : "♂"}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  )
}

// ── Match selector ────────────────────────────────────────────────────────────

interface MatchSelectorProps {
  matches: Match[]
  selected: Match | null
  onSelect: (m: Match) => void
  disabled?: boolean
}

export function MatchSelector({ matches, selected, onSelect, disabled }: MatchSelectorProps) {
  return (
    <div>
      <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">
        Partido
      </label>
      <select
        disabled={disabled || matches.length === 0}
        value={selected?.match_id ?? ""}
        onChange={(e) => {
          const found = matches.find(m => m.match_id === parseInt(e.target.value))
          if (found) onSelect(found)
        }}
        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white
                   focus:outline-none focus:border-amber-400 disabled:opacity-40 disabled:cursor-not-allowed
                   transition-colors"
      >
        <option value="">
          {matches.length === 0 ? "— Selecciona una competición —" : "— Selecciona un partido —"}
        </option>
        {matches.map((m) => (
          <option key={m.match_id} value={m.match_id}>
            {m.match_date?.slice(0, 10)} · {m.home_team_name} {m.home_score}–{m.away_score} {m.away_team_name}
            {m.match_status_360 === "available" ? " 📡" : ""}
          </option>
        ))}
      </select>
      {selected && (
        <div className="mt-1.5 px-2 py-1 bg-slate-900 rounded-md text-xs text-slate-400">
          <span className="text-white font-medium">{selected.home_team_name}</span>
          <span className="mx-1 text-amber-400">
            {selected.home_score}–{selected.away_score}
          </span>
          <span className="text-white font-medium">{selected.away_team_name}</span>
          {selected.stadium_name && (
            <span className="ml-2 text-slate-500">· {selected.stadium_name}</span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Player list panel ─────────────────────────────────────────────────────────

interface PlayerListProps {
  players: import("@/lib/types").MatchPlayer[]
  selectedId: number | null
  onSelect: (p: import("@/lib/types").MatchPlayer) => void
}

export function PlayerList({ players, selectedId, onSelect }: PlayerListProps) {
  const teams: Record<number, import("@/lib/types").MatchPlayer[]> = {}
  for (const p of players) {
    if (!teams[p.team_id]) teams[p.team_id] = []
    teams[p.team_id].push(p)
  }

  return (
    <div className="space-y-3 overflow-y-auto max-h-[400px] pr-1">
      {Object.entries(teams).map(([tid, ps]) => (
        <div key={tid}>
          <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1.5 px-1">
            {ps[0].team_name}
          </div>
          <div className="space-y-0.5">
            {ps.sort((a, b) => a.jersey_number - b.jersey_number).map((p) => (
              <button
                key={p.player_id}
                onClick={() => onSelect(p)}
                className={`w-full text-left px-2 py-1.5 rounded-md text-xs flex items-center gap-2 transition-colors ${
                  selectedId === p.player_id
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : "hover:bg-slate-700 text-slate-300"
                }`}
              >
                <span className="w-5 text-center font-mono text-[10px] text-slate-500">
                  {p.jersey_number}
                </span>
                <span className="truncate">{p.player_name}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
