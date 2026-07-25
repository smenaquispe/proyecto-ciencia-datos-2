import { create } from 'zustand'
import type {
  Country, Competition, Match, LineupResponse,
  Pass, HeatmapCell, PlayerRatings,
  PlayerRankingEntry, PositionPattern, SelectedPlayer, FcmPlayer,
} from '@/lib/types'

export interface Weights { pass: number; duel: number; shot: number }

interface State {
  selectedCountry: string | null
  selectedCompetition: Competition | null
  selectedMatch: Match | null
  selectedPlayer: SelectedPlayer | null
  selectedPlayer2: SelectedPlayer | null
  countries: Country[]
  competitions: Competition[]
  matches: Match[]
  lineupData: LineupResponse | null
  passes: Pass[]
  passes2: Pass[]
  heatmapCells: HeatmapCell[]
  heatmapCells2: HeatmapCell[]
  ratings: PlayerRatings | null
  ratings2: PlayerRatings | null
  playersRanking: PlayerRankingEntry[]
  positionPatterns: PositionPattern[]
  fcmPlayers: FcmPlayer[]
  maxMinute: number
  filteredPassIds: Set<string>
  hoveredPlayerId: number | null
  minuteRange: [number, number]
  weights: Weights
  loading: Record<string, boolean>
  theme: 'dark' | 'light'

  setCountry: (c: string | null) => void
  setCompetition: (c: Competition | null) => void
  setMatch: (m: Match | null) => void
  setPlayer: (p: SelectedPlayer | null) => void
  setPlayer2: (p: SelectedPlayer | null) => void
  setCountries: (c: Country[]) => void
  setCompetitions: (c: Competition[]) => void
  setMatches: (m: Match[]) => void
  setLineupData: (d: LineupResponse | null) => void
  setPasses: (p: Pass[]) => void
  setPasses2: (p: Pass[]) => void
  setHeatmapCells: (h: HeatmapCell[]) => void
  setHeatmapCells2: (h: HeatmapCell[]) => void
  setRatings: (r: PlayerRatings | null) => void
  setRatings2: (r: PlayerRatings | null) => void
  setPlayersRanking: (p: PlayerRankingEntry[]) => void
  setPositionPatterns: (p: PositionPattern[]) => void
  setFcmPlayers: (p: FcmPlayer[]) => void
  setMaxMinute: (m: number) => void
  setMinuteRange: (r: [number, number]) => void
  setWeights: (w: Partial<Weights>) => void
  setLoading: (key: string, value: boolean) => void
  setFilteredPassIds: (ids: Set<string>) => void
  setHoveredPlayerId: (id: number | null) => void
  toggleTheme: () => void
}

export const useDashboard = create<State>((set) => ({
  selectedCountry: null,
  selectedCompetition: null,
  selectedMatch: null,
  selectedPlayer: null,
  selectedPlayer2: null,
  countries: [],
  competitions: [],
  matches: [],
  lineupData: null,
  passes: [],
  passes2: [],
  heatmapCells: [],
  heatmapCells2: [],
  ratings: null,
  ratings2: null,
  playersRanking: [],
  positionPatterns: [],
  fcmPlayers: [],
  maxMinute: 90,
  filteredPassIds: new Set(),
  hoveredPlayerId: null,
  minuteRange: [0, 90],
  weights: { pass: 1, duel: 1, shot: 1 },
  loading: {},
  theme: 'dark',

  setCountry: (c) => set({ selectedCountry: c, selectedCompetition: null, selectedMatch: null, selectedPlayer: null, selectedPlayer2: null, competitions: [], matches: [], lineupData: null, passes: [], passes2: [], heatmapCells: [], heatmapCells2: [], ratings: null, ratings2: null, filteredPassIds: new Set(), fcmPlayers: [] }),
  setCompetition: (c) => set({ selectedCompetition: c, selectedMatch: null, selectedPlayer: null, selectedPlayer2: null, lineupData: null, passes: [], passes2: [], heatmapCells: [], heatmapCells2: [], ratings: null, ratings2: null, filteredPassIds: new Set(), fcmPlayers: [] }),
  setMatch: (m) => set({ selectedMatch: m, selectedPlayer: null, selectedPlayer2: null, lineupData: null, passes: [], passes2: [], heatmapCells: [], heatmapCells2: [], ratings: null, ratings2: null, minuteRange: [0, 90], filteredPassIds: new Set(), fcmPlayers: [] }),
  setPlayer: (p) => set({ selectedPlayer: p, passes: [], heatmapCells: [], ratings: null, filteredPassIds: new Set() }),
  setPlayer2: (p) => set({ selectedPlayer2: p, passes2: [], heatmapCells2: [], ratings2: null }),
  setCountries: (c) => set({ countries: c }),
  setCompetitions: (c) => set({ competitions: c }),
  setMatches: (m) => set({ matches: m }),
  setLineupData: (d) => set({ lineupData: d }),
  setPasses: (p) => set({ passes: p }),
  setPasses2: (p) => set({ passes2: p }),
  setHeatmapCells: (h) => set({ heatmapCells: h }),
  setHeatmapCells2: (h) => set({ heatmapCells2: h }),
  setRatings: (r) => set({ ratings: r }),
  setRatings2: (r) => set({ ratings2: r }),
  setPlayersRanking: (p) => set({ playersRanking: p }),
  setPositionPatterns: (p) => set({ positionPatterns: p }),
  setFcmPlayers: (p) => set({ fcmPlayers: p }),
  setMaxMinute: (m) => set({ maxMinute: m }),
  setMinuteRange: (r) => set({ minuteRange: r }),
  setWeights: (w) => set((s) => ({ weights: { ...s.weights, ...w } })),
  setLoading: (k, v) => set((s) => ({ loading: { ...s.loading, [k]: v } })),
  setFilteredPassIds: (ids) => set({ filteredPassIds: ids }),
  setHoveredPlayerId: (id) => set({ hoveredPlayerId: id }),
  toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
}))
