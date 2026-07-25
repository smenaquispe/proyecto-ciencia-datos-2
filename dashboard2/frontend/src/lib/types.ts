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
  /** normalized 0-1: 0=own goal, 1=opponent goal */
  px: number
  /** normalized 0-1: 0=top, 1=bottom */
  py: number
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
  duration: number
  distance: number
  forward: boolean
  pass_type: string
  completed: boolean
  play_pattern_name: string
  team_name: string
  player_name: string
  position_name: string
  // enriched pass fields
  pass_length: number | null
  pass_angle: number | null
  pass_height: string | null
  pass_body_part: string | null
  pass_outcome: string | null    // null = Complete
  pass_switch: boolean | null
  pass_cross: boolean | null
  pass_through_ball: boolean | null
  pass_recipient_id: number | null
  pass_recipient_name: string | null
  // pressure source
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
  completion_rate: number      // 0-10
  pressure_rating: number      // 0-10: presión recibida al pasar
  direction_score: number      // 0-10: tendencia ofensiva
  length_score: number         // 0-10: longitud media normalizada
  special_passes: number       // conteo switches + crosses + through balls
  pass_score: number           // 0-10: score general de pases
}

export interface DuelRatings {
  total: number
  won: number
  win_rate: number             // 0-10
  pressure_rating: number      // 0-10
  area_score: number           // 0-10: zona en el campo (cerca del arco rival = +)
  duel_score: number           // 0-10
}

export interface ShotRatings {
  total: number
  on_target: number
  goals: number
  shot_accuracy: number        // 0-10
  xg_score: number             // 0-10: xG promedio normalizado
  shot_score: number           // 0-10
}

export interface PlayerRatings {
  passes: PassRatings
  duels:  DuelRatings
  shots:  ShotRatings
  overall: number              // 0-10
}

// ── Pressure passes ──────────────────────────────────────────────────────────

export interface Pressuror {
  presser_id:   number | null
  presser_name: string
  press_x:      number
  press_y:      number
  distance:     number
}

export interface PressurePass {
  event_id:          string
  minute:            number
  second:            number
  x:                 number
  y:                 number
  end_x:             number | null
  end_y:             number | null
  completed:         boolean
  pass_length:       number | null
  pass_body_part:    string | null
  pass_height:       string | null
  recipient_name:    string | null
  pressurors:        Pressuror[]
  pressure_count:    number
  min_pressure_dist: number | null
  closest_presser:   string | null
}

// ── Position patterns ─────────────────────────────────────────────────────────

export interface PositionPattern {
  position_name:    string
  position_group:   string
  n_players:        number
  player_names:     string[]
  total_passes:     number
  completed_passes: number
  completion_score: number
  direction_score:  number
  length_score:     number
  pressure_score:   number
  special_passes:   number
  pass_score:       number
  total_duels:      number
  won_duels:        number
  duel_score:       number
  total_shots:      number
  on_target:        number
  goals:            number
  shot_accuracy:    number
  xg_score:         number
  shot_score:       number
  overall_score:    number
}

// ── Global stats ─────────────────────────────────────────────────────────────

export interface GlobalPlayerStat {
  player_id:       number | null
  player_name:     string
  position_name:   string
  position_group:  string
  matches:         number
  total_passes:    number
  completed_passes: number
  total_shots:     number
  goals:           number
  on_target:       number
  dribbles:        number
  switches:        number
  crosses:         number
  through_balls:   number
  passes_pm:       number
  goals_pm:        number
  shots_pm:        number
  dribbles_pm:     number
  completion_pct:  number
  shot_acc_pct:    number
  fwd_pass_pct:    number
  xg_proxy:        number
  passes_pm_score:      number
  goals_pm_score:       number
  shots_pm_score:       number
  dribbles_pm_score:    number
  completion_pct_score: number
  shot_acc_pct_score:   number
}

export interface PositionAverage {
  passes_pm:            number
  goals_pm:             number
  shots_pm:             number
  dribbles_pm:          number
  completion_pct:       number
  shot_acc_pct:         number
  fwd_pass_pct:         number
  xg_proxy:             number
  passes_pm_score:      number
  goals_pm_score:       number
  shots_pm_score:       number
  dribbles_pm_score:    number
  completion_pct_score: number
  shot_acc_pct_score:   number
}

export interface GlobalHeatmapCell {
  cx:        number
  cy:        number
  count:     number
  intensity: number
}

export interface GlobalShot {
  x:           number
  y:           number
  outcome:     string
  dist_to_goal: number
  minute:      number
}

export interface GlobalPlayerProfile {
  player: {
    player_name:     string
    position_name:   string
    matches:         number
    total_passes:    number
    completed_passes: number
    completion_pct:  number
    avg_pass_length: number
    fwd_passes:      number
    fwd_pass_pct:    number
    crosses:         number
    through_balls:   number
    total_shots:     number
    goals:           number
    on_target:       number
    dribbles:        number
    under_pressure_events: number
    passes_pm:       number
    goals_pm:        number
    shots_pm:        number
    dribbles_pm:     number
    shot_acc_pct:    number
  }
  heatmap:         GlobalHeatmapCell[]
  shots:           GlobalShot[]
  assist_passes:   Record<string, unknown>[]
  position_average: {
    completion_pct: number
    goals_pm:       number
    shots_pm:       number
    passes_pm:      number
    dribbles_pm:    number
  }
  error?: string
}

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
