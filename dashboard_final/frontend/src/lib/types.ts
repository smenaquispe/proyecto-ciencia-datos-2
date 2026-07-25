export interface ProjectionPlayer {
  player_id: number
  player_name: string
  dominant_position: string
  pos_group: string
  total_minutes: number
  matches_played: number
  x: number
  y: number
  shots_per90: number
  passes_per90: number
  pass_completion_rate: number
  progressive_passes_per90: number
  pressures_per90: number
  duels_per90: number
  duel_win_rate: number
  goals_per90: number
  dribbles_per90: number
  carries_per90: number
  clearances_per90: number
  blocks_per90: number
  ball_recoveries_per90: number
  [key: string]: number | string
}

export interface FcmPlayer {
  player_id: number
  player_name: string
  dominant_position: string
  pos_group: string
  total_minutes: number
  matches_played: number
  x: number
  y: number
  z?: number  // DEC v2 — 3er PCA comp, profundidad para vista 3D
  cluster: number
  memberships: number[]
}

export interface PlayerInfo {
  player_id: number
  player_name: string
  dominant_position: string
  pos_group: string
  total_minutes: number
  matches_played: number
}

export interface PlayerMatch {
  match_id: number
  match_date: string
  team_id: number
  team_name: string
  opponent_name: string
  team_score: number
  opponent_score: number
  competition_name: string
  season_name: string
}

export interface PlayerProfile {
  player_id: number
  player_name: string
  matches_played: number
  total_events: number
  passes: { total: number; completed: number; completion_rate: number }
  shots: { total: number; on_target: number; goals: number }
  duels: { total: number; won: number; win_rate: number }
  pressures: number
  carries: number
  avg_pass_length: number
}

export interface HeatmapCell {
  cx: number
  cy: number
  x0: number
  y0: number
  count: number
  intensity: number
}

export interface Pass {
  x: number
  y: number
  end_x: number
  end_y: number
  pass_length: number | null
  pass_outcome: string | null
  pass_switch: boolean | null
  pass_cross: boolean | null
  pass_through_ball: boolean | null
  under_pressure: boolean | null
  pass_angle: number | null
  pass_height: string | null
  pass_body_part: string | null
  pass_recipient_name: string | null
  minute: number
  second: number
  event_id: string | null
  distance: number
  forward: boolean
  pass_type: string
  completed: boolean
}

export interface ComparePlayer {
  player_id: number
  player_name: string
  dominant_position?: string
  pos_group?: string
  matches_played: number
  [key: string]: number | string | undefined
}

export interface GoalEvent {
  x: number
  y: number
  end_x: number | null
  end_y: number | null
  minute: number
  second: number
  match_id: number
  shot_outcome: string
  match_date?: string
  competition_name?: string
}

export interface AssistEvent {
  x: number
  y: number
  end_x: number | null
  end_y: number | null
  minute: number
  second: number
  match_id: number
  pass_recipient_name: string | null
  shot_x: number
  shot_y: number
}

export interface PressureEvent {
  x: number
  y: number
  minute: number
  second: number
  match_id: number
  counterpress: boolean | null
}

export interface KeyAction {
  weight: number
  match_id: number
  ev_index: number
  minute: number
  second: number
  event_type_name: string
  shot_outcome: string | null
  x: number | null
  y: number | null
  end_x: number | null
  end_y: number | null
  pass_recipient_name: string | null
  pass_through_ball: boolean | null
  pass_cross: boolean | null
  pass_switch: boolean | null
  counterpress: boolean | null
  pteam: string
  match_date: string
  home_team: string
  away_team: string
  home_score: number
  away_score: number
  score: string
  opponent: string
  competition_name: string | null
  season_name: string | null
}

export interface PlayerWeights {
  [playerId: number]: {
    pass: number
    duel: number
    shot: number
    defense: number
    overall: number
  }
}

export type Algorithm = 'umap' | 'pca' | 'tsne' | 'mds' | 'fcm' | 'aefcm' | 'dec' | 'decv2'
export type TimeLimit = number | 'all'
