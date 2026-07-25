const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001"

// const BASE = "https://major-camels-type.loca.lt"


async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`)
  return res.json()
}

export const api = {
  countries: () =>
    get<{ countries: import('./types').Country[] }>('/api/countries'),

  competitions: (country_name?: string) =>
    get<{ competitions: import('./types').Competition[] }>(
      `/api/competitions${country_name ? `?country_name=${encodeURIComponent(country_name)}` : ''}`
    ),

  matches: (competition_id: number, season_id: number) =>
    get<{ matches: import('./types').Match[] }>(
      `/api/matches?competition_id=${competition_id}&season_id=${season_id}`
    ),

  lineup: (match_id: number) =>
    get<import('./types').LineupResponse>(`/api/match/${match_id}/lineup`),

  eventsSummary: (match_id: number) =>
    get<{ max_minute: number; events_by_minute: import('./types').EventSummary[]; players: import('./types').MatchPlayer[] }>(
      `/api/match/${match_id}/events-summary`
    ),

  heatmap: (match_id: number, player_id: number, minute_from = 0, minute_to = 999) =>
    get<{ cells: import('./types').HeatmapCell[]; max_count: number; total_events: number; cell_size: number }>(
      `/api/match/${match_id}/player/${player_id}/heatmap?minute_from=${minute_from}&minute_to=${minute_to}&cell_size=5`
    ),

  passes: (match_id: number, player_id: number, minute_from = 0, minute_to = 999) =>
    get<{ passes: import('./types').Pass[]; total: number }>(
      `/api/match/${match_id}/player/${player_id}/passes?minute_from=${minute_from}&minute_to=${minute_to}`
    ),

  playerRatings: (match_id: number, player_id: number) =>
    get<import('./types').PlayerRatings>(`/api/match/${match_id}/player/${player_id}/ratings`),

  playersRanking: (match_id: number) =>
    get<{ players: import('./types').PlayerRankingEntry[] }>(`/api/match/${match_id}/players-ranking`),

  positionPatterns: (match_id: number) =>
    get<{ positions: import('./types').PositionPattern[] }>(`/api/match/${match_id}/position-patterns`),

  shotMap: (match_id: number) =>
    get<{ shots: import('./types').ShotMapItem[] }>(`/api/match/${match_id}/shot-map`),

  pressurePasses: (match_id: number, player_id: number) =>
    get<{ pressure_passes: unknown[]; total: number }>(`/api/match/${match_id}/player/${player_id}/pressure-passes`),

  fcm: (match_id: number, n_clusters = 4) =>
    get<{ players: import('./types').FcmPlayer[]; n_clusters: number }>(
      `/api/match/${match_id}/fcm?n_clusters=${n_clusters}`
    ),
}
