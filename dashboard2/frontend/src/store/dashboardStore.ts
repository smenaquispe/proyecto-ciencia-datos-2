import { create } from "zustand"
import type { Country, Competition, Match, TeamLineup, Player, MatchPlayer, EventSummary } from "@/lib/types"

interface DashboardState {
  // Selection state
  selectedCountry:     Country | null
  selectedCompetition: Competition | null
  selectedMatch:       Match | null
  selectedPlayer:      Player | MatchPlayer | null
  currentMinute:       number
  minuteRange:         [number, number]
  maxMinute:           number

  // Data
  countries:     Country[]
  competitions:  Competition[]
  matches:       Match[]
  teams:         TeamLineup[]
  players:       MatchPlayer[]   // all players in match for side panel
  eventsSummary: EventSummary[]

  // UI state
  isLoadingCountries:    boolean
  isLoadingCompetitions: boolean
  isLoadingMatches:      boolean
  isLoadingLineup:       boolean
  isLoadingHeatmap:      boolean
  isLoadingPasses:       boolean

  // Actions
  setSelectedCountry:     (c: Country | null) => void
  setSelectedCompetition: (c: Competition | null) => void
  setSelectedMatch:       (m: Match | null) => void
  setSelectedPlayer:      (p: Player | MatchPlayer | null) => void
  setCurrentMinute:       (m: number) => void
  setMinuteRange:         (r: [number, number]) => void
  setMaxMinute:           (m: number) => void
  setCountries:           (c: Country[]) => void
  setCompetitions:        (c: Competition[]) => void
  setMatches:             (m: Match[]) => void
  setTeams:               (t: TeamLineup[]) => void
  setPlayers:             (p: MatchPlayer[]) => void
  setEventsSummary:       (e: EventSummary[]) => void
  setLoading:             (key: keyof Pick<DashboardState,
    "isLoadingCountries" | "isLoadingCompetitions" | "isLoadingMatches" |
    "isLoadingLineup" | "isLoadingHeatmap" | "isLoadingPasses"
  >, val: boolean) => void
  reset: () => void
}

export const useDashboardStore = create<DashboardState>((set) => ({
  selectedCountry:     null,
  selectedCompetition: null,
  selectedMatch:       null,
  selectedPlayer:      null,
  currentMinute:       0,
  minuteRange:         [0, 90],
  maxMinute:           90,
  countries:           [],
  competitions:        [],
  matches:             [],
  teams:               [],
  players:             [],
  eventsSummary:       [],
  isLoadingCountries:    false,
  isLoadingCompetitions: false,
  isLoadingMatches:      false,
  isLoadingLineup:       false,
  isLoadingHeatmap:      false,
  isLoadingPasses:       false,

  setSelectedCountry:     (c) => set({ selectedCountry: c, selectedCompetition: null, selectedMatch: null, selectedPlayer: null }),
  setSelectedCompetition: (c) => set({ selectedCompetition: c, selectedMatch: null, selectedPlayer: null }),
  setSelectedMatch:       (m) => set({ selectedMatch: m, selectedPlayer: null, currentMinute: 0, minuteRange: [0, 90] }),
  setSelectedPlayer:      (p) => set({ selectedPlayer: p }),
  setCurrentMinute:       (m) => set({ currentMinute: m }),
  setMinuteRange:         (r) => set({ minuteRange: r }),
  setMaxMinute:           (m) => set({ maxMinute: m, minuteRange: [0, m] }),
  setCountries:           (c) => set({ countries: c }),
  setCompetitions:        (c) => set({ competitions: c }),
  setMatches:             (m) => set({ matches: m }),
  setTeams:               (t) => set({ teams: t }),
  setPlayers:             (p) => set({ players: p }),
  setEventsSummary:       (e) => set({ eventsSummary: e }),
  setLoading: (key, val) => set({ [key]: val } as Partial<DashboardState>),
  reset: () => set({
    selectedCountry: null, selectedCompetition: null,
    selectedMatch: null, selectedPlayer: null,
    currentMinute: 0, minuteRange: [0, 90], maxMinute: 90,
    competitions: [], matches: [], teams: [], players: [], eventsSummary: [],
  }),
}))
