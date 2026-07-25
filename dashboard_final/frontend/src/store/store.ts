import { create } from 'zustand'
import type {
  ProjectionPlayer, FcmPlayer, PlayerInfo, PlayerMatch,
  PlayerProfile, HeatmapCell, Pass, ComparePlayer, Algorithm, TimeLimit,
  GoalEvent, AssistEvent, PressureEvent,
} from '@/lib/types'

export interface PlayerData {
  playerId: number
  playerName: string
  heatmapCells: HeatmapCell[]
  heatmapTotal: number
  passes: Pass[]
  passTotal: number
  goals: GoalEvent[]
  assists: AssistEvent[]
  pressures: PressureEvent[]
}

export interface PlayerWeight {
  pass: number
  duel: number
  shot: number
  defense: number
}

interface State {
  algorithm: Algorithm
  nClusters: number
  timeLimit: TimeLimit
  sidebarView: 'cluster' | 'players'
  scatterPlayers: (ProjectionPlayer | FcmPlayer)[]
  selectedPlayerIds: number[]
  hoveredPlayerId: number | null
  playersData: PlayerData[]
  passFocusPlayerId: number | null
  comparePlayers: ComparePlayer[]
  playerWeights: Record<number, PlayerWeight>  // por-jugador (legacy)
  globalWeights: PlayerWeight                   // un solo set para todos
  loading: Record<string, boolean>
  error: string | null

  setAlgorithm: (a: Algorithm) => void
  setNClusters: (n: number) => void
  setTimeLimit: (t: TimeLimit) => void
  setSidebarView: (v: 'cluster' | 'players') => void
  setScatterPlayers: (p: (ProjectionPlayer | FcmPlayer)[]) => void
  setSelectedPlayerIds: (ids: number[]) => void
  togglePlayerId: (id: number) => void
  setHoveredPlayerId: (id: number | null) => void
  setPlayersData: (d: PlayerData[]) => void
  updatePlayerData: (d: PlayerData) => void
  setPassFocusPlayerId: (id: number | null) => void
  setComparePlayers: (p: ComparePlayer[]) => void
  setPlayerWeight: (playerId: number, w: Partial<PlayerWeight>) => void
  setGlobalWeight: (w: Partial<PlayerWeight>) => void
  findSimilar: (playerId: number, n: number) => void
  setLoading: (key: string, v: boolean) => void
  setError: (e: string | null) => void
  clearSelection: () => void
}

const DEFAULT_WEIGHT: PlayerWeight = { pass: 1, duel: 1, shot: 1, defense: 1 }

export const useDashboard = create<State>((set) => ({
  algorithm: 'umap',
  nClusters: 5,
  timeLimit: 'all',
  sidebarView: 'cluster',
  scatterPlayers: [],
  selectedPlayerIds: [],
  hoveredPlayerId: null,
  playersData: [],
  passFocusPlayerId: null,
  comparePlayers: [],
  playerWeights: {},
  globalWeights: { pass: 1, duel: 1, shot: 1, defense: 1 },
  loading: {},
  error: null,

  setAlgorithm: (a) => set({ algorithm: a, selectedPlayerIds: [], scatterPlayers: [], playersData: [], comparePlayers: [], playerWeights: {} }),
  setNClusters: (n) => set({ nClusters: n }),
  setTimeLimit: (t) => set({ timeLimit: t, playersData: [], comparePlayers: [] }),
  setSidebarView: (v) => set({ sidebarView: v }),
  setScatterPlayers: (p) => set({ scatterPlayers: p }),
  setSelectedPlayerIds: (ids) => set({ selectedPlayerIds: ids }),
  togglePlayerId: (id) => set((s) => ({
    selectedPlayerIds: s.selectedPlayerIds.includes(id)
      ? s.selectedPlayerIds.filter(i => i !== id)
      : [...s.selectedPlayerIds, id],
  })),
  setHoveredPlayerId: (id) => set({ hoveredPlayerId: id }),
  setPlayersData: (d) => set({ playersData: d }),
  updatePlayerData: (d) => set((s) => ({
    playersData: s.playersData.map(p => p.playerId === d.playerId ? d : p),
  })),
  setPassFocusPlayerId: (id) => set({ passFocusPlayerId: id }),
  setComparePlayers: (p) => set({ comparePlayers: p }),
  setPlayerWeight: (playerId, w) => set((s) => ({
    playerWeights: {
      ...s.playerWeights,
      [playerId]: { ...(s.playerWeights[playerId] ?? DEFAULT_WEIGHT), ...w },
    },
  })),
  setGlobalWeight: (w) => set((s) => ({ globalWeights: { ...s.globalWeights, ...w } })),
  // N jugadores más parecidos a playerId según distancia L1 sobre memberships DEC.
  findSimilar: (playerId, n) => set((s) => {
    const players = s.scatterPlayers as any[]
    const ref = players.find(p => p.player_id === playerId)
    if (!ref || !ref.memberships) return s
    const mRef: number[] = ref.memberships
    const k = mRef.length
    const scored = players
      .filter((p: any) => p.player_id !== playerId && p.memberships && p.memberships.length === k)
      .map((p: any) => {
        let d = 0
        for (let i = 0; i < k; i++) d += Math.abs(p.memberships[i] - mRef[i])
        return { id: p.player_id, d }
      })
      .sort((a, b) => a.d - b.d)
      .slice(0, n)
      .map(s2 => s2.id)
    return { selectedPlayerIds: [playerId, ...scored], playersData: [], comparePlayers: [] }
  }),
  setLoading: (k, v) => set((s) => ({ loading: { ...s.loading, [k]: v } })),
  setError: (e) => set({ error: e }),
  clearSelection: () => set({
    selectedPlayerIds: [], playersData: [], comparePlayers: [], playerWeights: {},
  }),
}))
