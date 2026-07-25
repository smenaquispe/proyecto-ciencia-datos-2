export interface Country {
  country_name: string
  matches: number
  competitions: number
  lat: number
  lng: number
}

export interface Competition {
  competition_id: number
  competition_name: string
  country_name: string
  season_id: number
  season_name: string
  competition_gender: string
}

export interface Match {
  match_id: number
  match_date: string
  kick_off: string
  competition_id: number
  season_id: number
  home_team_id: number
  away_team_id: number
  home_score: number
  away_score: number
  match_week: number | null
  match_status_360: string
  competition_stage_name: string
  competition_name: string
  country_name: string
  season_name: string
  home_team_name: string
  away_team_name: string
  stadium_name: string | null
}

export interface Player {
  player_id: number
  player_name: string
  jersey_number: number
  position_id: number
  position_name: string
  px: number   // normalized 0-1 (0=own goal, 1=opponent goal)
  py: number   // normalized 0-1 (0=top, 1=bottom)
}

export interface TeamLineup {
  team_id: number
  team_name: string
  formation: number | null
  players: Player[]
}

export interface LineupResponse {
  match: {
    match_id: number
    home_team_id: number
    away_team_id: number
    home_team_name: string
    away_team_name: string
    home_score: number
    away_score: number
    match_date: string
    competition_name: string
    season_name: string
  }
  teams: TeamLineup[]
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
  event_id: string
  event_index: number
  possession: number
  minute: number
  second: number
  x: number
  y: number
  end_x: number
  end_y: number
  under_pressure: boolean | null
  counterpress: boolean | null
  duration: number | null
  distance: number
  forward: boolean
  pass_type: string
  completed: boolean
  pass_length: number | null
  pass_angle: number | null
  pass_height: string | null
  pass_body_part: string | null
  pass_outcome: string | null
  pass_switch: boolean | null
  pass_cross: boolean | null
  pass_through_ball: boolean | null
  pass_recipient_name: string | null
  pressure_source_x: number | null
  pressure_source_y: number | null
  presser_name: string | null
  pressure_distance: number | null
}

export interface EventSummary {
  minute: number
  period: number
  event_count: number
  shots: number
  gk_actions: number
  passes: number
}

export interface MatchPlayer {
  player_id: number
  player_name: string
  team_id: number
  team_name: string
  jersey_number: number
}

// ── Ratings (Evers et al. 2024) ───────────────────────────────────────────────

export interface PassRatings {
  total: number
  completed: number
  completion_rate: number
  pressure_rating: number
  direction_score: number
  length_score: number
  special_passes: number
  pass_score: number
}

export interface DuelRatings {
  total: number
  won: number
  win_rate: number
  pressure_rating: number
  area_score: number
  duel_score: number
}

export interface ShotRatings {
  total: number
  on_target: number
  goals: number
  shot_accuracy: number
  xg_score: number
  shot_score: number
}

export interface PlayerRatings {
  passes: PassRatings
  duels:  DuelRatings
  shots:  ShotRatings
  overall: number
}

// ── Player ranking ────────────────────────────────────────────────────────────

export interface PlayerRankingEntry {
  player_id: number
  player_name: string
  team_id: number
  team_name: string
  total_passes: number
  completed_passes: number
  total_duels: number
  won_duels: number
  total_shots: number
  on_target: number
  pass_score: number
  duel_score: number
  shot_score: number
  overall_score: number
}

// ── Position patterns ─────────────────────────────────────────────────────────

export interface PositionPattern {
  position_name: string
  position_group: string
  n_players: number
  player_names: string[]
  total_passes: number
  completed_passes: number
  completion_score: number
  direction_score: number
  length_score: number
  pressure_score: number
  special_passes: number
  pass_score: number
  total_duels: number
  won_duels: number
  duel_score: number
  total_shots: number
  on_target: number
  goals: number
  shot_accuracy: number
  xg_score: number
  shot_score: number
  overall_score: number
}

// ── Shot map ──────────────────────────────────────────────────────────────────

export interface ShotMapItem {
  player_id: number | null
  player_name: string
  team_id: number
  team_name: string
  x: number
  y: number
  minute: number
  second: number
  shot_outcome: string | null
  under_pressure: boolean | null
  dist_to_goal: number
}

// ── FCM clustering ────────────────────────────────────────────────────────────

export interface FcmPlayer {
  player_id: number
  player_name: string
  team_id: number
  team_name: string
  pass_score: number
  duel_score: number
  shot_score: number
  overall_score: number
  x: number   // PCA coord [-1, 1]
  y: number
  cluster: number
  memberships: number[]
}

// ── Selected player info ──────────────────────────────────────────────────────

export interface SelectedPlayer {
  player_id: number
  player_name: string
  team_id: number
  team_name: string
  position_name: string
  jersey_number: number
}
