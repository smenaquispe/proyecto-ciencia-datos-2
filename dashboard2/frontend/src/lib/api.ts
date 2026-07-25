const BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://famous-masks-admire.loca.lt"

async function get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(`${BASE}${path}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
    })
  }
  const res = await fetch(url.toString(), { cache: "no-store" })
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`)
  return res.json()
}

export interface GraphCompetition {
  id: string
  competition_id: number
  label: string
  gender: string
  seasons: { id: string; season_id: number; label: string; matches: number }[]
}
export interface GraphTeam {
  team_id: number
  label: string
  matches: number
}
export interface GraphMatch {
  match_id: number
  match_date: string
  opponent_id: number
  opponent_name: string
  is_home: boolean
  my_score: number
  opp_score: number
  result: "W" | "D" | "L"
  has_360: boolean
  stage: string
}

export const api = {
  countries: () => get<{ countries: import("./types").Country[] }>("/api/countries"),

  competitions: (country_name?: string) =>
    get<{ competitions: import("./types").Competition[] }>("/api/competitions", { country_name }),

  matches: (params?: { competition_id?: number; season_id?: number; country_name?: string }) =>
    get<{ matches: import("./types").Match[] }>("/api/matches", params as Record<string, string | number | undefined>),

  lineup: (match_id: number) =>
    get<import("./types").LineupResponse>(`/api/match/${match_id}/lineup`),

  heatmap: (match_id: number, player_id: number, minute_from?: number, minute_to?: number) =>
    get<{ cells: import("./types").HeatmapCell[]; max_count: number; total_events: number; cell_size: number }>(
      `/api/match/${match_id}/player/${player_id}/heatmap`,
      { minute_from, minute_to }
    ),

  passes: (match_id: number, player_id: number, minute_from?: number, minute_to?: number) =>
    get<{ passes: import("./types").Pass[]; total: number }>(
      `/api/match/${match_id}/player/${player_id}/passes`,
      { minute_from, minute_to }
    ),

  eventsSummary: (match_id: number) =>
    get<{
      max_minute: number
      events_by_minute: import("./types").EventSummary[]
      players: import("./types").MatchPlayer[]
    }>(`/api/match/${match_id}/events-summary`),

  positions: (match_id: number, minute_from: number, minute_to: number) =>
    get<{ events: unknown[] }>(`/api/match/${match_id}/positions`, { minute_from, minute_to }),

  graphCountry: (country_name: string) =>
    get<{ competitions: GraphCompetition[] }>("/api/graph/country", { country_name }),

  graphTeams: (competition_id: number, season_id: number) =>
    get<{ teams: GraphTeam[] }>("/api/graph/teams", { competition_id, season_id }),

  graphOpponents: (competition_id: number, season_id: number, team_id: number) =>
    get<{ matches: GraphMatch[] }>("/api/graph/opponents", { competition_id, season_id, team_id }),

  passesOnly: (match_id: number, player_id: number, minute_from?: number, minute_to?: number) =>
    get<{ passes: import("./types").Pass[]; total: number }>(
      `/api/match/${match_id}/player/${player_id}/passes-only`,
      { minute_from, minute_to }
    ),

  playerRatings: (match_id: number, player_id: number) =>
    get<import("./types").PlayerRatings>(
      `/api/match/${match_id}/player/${player_id}/ratings`
    ),

  playersRanking: (match_id: number) =>
    get<{ players: import("./types").PlayerRankingEntry[] }>(
      `/api/match/${match_id}/players-ranking`
    ),

  pressurePasses: (match_id: number, player_id: number) =>
    get<{ pressure_passes: import("./types").PressurePass[]; total: number }>(
      `/api/match/${match_id}/player/${player_id}/pressure-passes`
    ),

  positionPatterns: (match_id: number) =>
    get<{ positions: import("./types").PositionPattern[] }>(
      `/api/match/${match_id}/position-patterns`
    ),

  globalPlayerStats: (params?: { position_group?: string; min_matches?: number; limit?: number }) =>
    get<{ players: import("./types").GlobalPlayerStat[]; position_averages: Record<string, import("./types").PositionAverage> }>(
      `/api/global/player-stats`,
      params as Record<string, string | number | undefined>
    ),

  globalPlayerProfile: (player_name: string) =>
    get<import("./types").GlobalPlayerProfile>(
      `/api/global/player-profile`,
      { player_name }
    ),
}
