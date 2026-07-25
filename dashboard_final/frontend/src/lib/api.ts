const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8005"

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`)
  return res.json()
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`)
  return res.json()
}

export const api = {
  projections: (method: string) =>
    get<import('./types').ProjectionPlayer[]>(`/api/projections?method=${method}`),

  fcmClusters: (n_clusters = 5) =>
    get<{ players: import('./types').FcmPlayer[]; n_clusters: number }>(
      `/api/cluster/fcm?n_clusters=${n_clusters}`
    ),

  aefcmClusters: (n_clusters = 5) =>
    get<{ players: import('./types').FcmPlayer[]; n_clusters: number }>(
      `/api/cluster/aefcm?n_clusters=${n_clusters}`
    ),

  decClusters: () =>
    get<{ players: import('./types').FcmPlayer[]; n_clusters: number }>(
      `/api/cluster/dec`
    ),

  decV2Clusters: () =>
    get<{ players: import('./types').FcmPlayer[]; n_clusters: number }>(
      `/api/cluster/decv2`
    ),

  players: (search?: string, pos_group?: string) => {
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    if (pos_group) p.set('pos_group', pos_group)
    return get<import('./types').PlayerInfo[]>(`/api/players?${p}`)
  },

  playerMatches: (player_id: number) =>
    get<{ matches: import('./types').PlayerMatch[] }>(`/api/players/${player_id}/matches`),

  playerProfile: (player_id: number, limit: number | 'all' = 'all') =>
    get<{ player: import('./types').PlayerProfile | null }>(
      `/api/players/${player_id}/profile?limit=${limit}`
    ),

  playerHeatmap: (player_id: number, limit: number | 'all' = 'all', cell_size = 5) =>
    get<{ cells: import('./types').HeatmapCell[]; max_count: number; total_events: number; cell_size: number }>(
      `/api/players/${player_id}/heatmap?limit=${limit}&cell_size=${cell_size}`
    ),

  playerPassNetwork: (player_id: number, limit: number | 'all' = 'all') =>
    get<{ passes: import('./types').Pass[]; total: number }>(
      `/api/players/${player_id}/pass-network?limit=${limit}`
    ),

  comparePlayers: (player_ids: number[], limit: number | 'all' = 'all') =>
    post<{ players: import('./types').ComparePlayer[] }>('/api/players/compare', { player_ids, limit }),

  playerGoals: (player_id: number, limit: number | 'all' = 'all') =>
    get<{ goals: import('./types').GoalEvent[]; total: number }>(
      `/api/players/${player_id}/goals?limit=${limit}`
    ),

  playerAssists: (player_id: number, limit: number | 'all' = 'all') =>
    get<{ assists: import('./types').AssistEvent[]; total: number }>(
      `/api/players/${player_id}/assists?limit=${limit}`
    ),

  playerDefensivePressure: (player_id: number, limit: number | 'all' = 'all') =>
    get<{ pressures: import('./types').PressureEvent[]; total: number }>(
      `/api/players/${player_id}/defensive-pressure?limit=${limit}`
    ),

  playerKeyActions: (player_id: number, n = 20) =>
    get<{ actions: import('./types').KeyAction[]; total: number }>(
      `/api/players/${player_id}/key-actions?n=${n}`
    ),
}
