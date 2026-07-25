'use client'

import { useEffect, useRef, useState } from 'react'
import { useDashboard } from '@/store/store'
import { api } from '@/lib/api'
import { AlgorithmSelector } from '@/components/AlgorithmSelector'
import { TimeRangeSlider } from '@/components/TimeRangeSlider'
import { ProjectionScatter } from '@/components/ProjectionScatter'
import { ProjectionScatter3D } from '@/components/ProjectionScatter3D'
import { SimilarPlayers } from '@/components/SimilarPlayers'
import { PlayerList } from '@/components/PlayerList'
import { HeatmapPanel } from '@/components/HeatmapPanel'
import { PassNetworkPanel, type PassFocus } from '@/components/PassNetworkPanel'
import { PentagonChart } from '@/components/PentagonChart'
import { GoalsPanel } from '@/components/GoalsPanel'
import { AssistsPanel } from '@/components/AssistsPanel'
import { DefensivePressurePanel } from '@/components/DefensivePressurePanel'
import { PlayerScoring } from '@/components/PlayerScoring'
import { KeyActionsPanel } from '@/components/KeyActionsPanel'
import { MembershipOverlap } from '@/components/MembershipOverlap'
import type { HeatmapCell, Pass } from '@/lib/types'

interface Grid { h1: number; v1: number }
const HANDLE = 5

type TabId = 'heatmap' | 'passes' | 'goals' | 'assists' | 'pressure' | 'jugadas'

const TABS: { id: TabId; label: string }[] = [
  { id: 'heatmap',  label: 'Heatmap' },
  { id: 'passes',   label: 'Pases' },
  { id: 'goals',    label: 'Goles' },
  { id: 'assists',  label: 'Asistencias' },
  { id: 'pressure', label: 'Presión Def.' },
  { id: 'jugadas',  label: 'Jugadas' },
]

export default function DashboardPage() {
  const {
    algorithm, setAlgorithm, nClusters, timeLimit, selectedPlayerIds,
    sidebarView, setSidebarView,
    scatterPlayers, setScatterPlayers,
    playersData, setPlayersData, passFocusPlayerId, setPassFocusPlayerId,
    comparePlayers, setComparePlayers, setLoading, setError,
    togglePlayerId,
  } = useDashboard()

  const [grid, setGrid] = useState<Grid>({ h1: 0.5, v1: 0.5 })
  const [activeTab, setActiveTab] = useState<TabId>('heatmap')
  const [rightTab, setRightTab] = useState<'scoring' | 'conjuntos'>('scoring')
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)

  const CASE_PLAYERS = ['Messi', 'Busquets', 'Piqué', 'Fàbregas', 'Salah']

  const selectPlayer = (id: number) => {
    togglePlayerId(id)
    setSearchQuery('')
    setShowSearch(false)
    setSidebarView('players')
  }

  const filteredPlayers = searchQuery
    ? (scatterPlayers as any[]).filter((p: any) =>
        p.player_name?.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 10)
    : []

  const dragRef = useRef<string | null>(null)
  const mainRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragRef.current || !mainRef.current) return
      const rect = mainRef.current.getBoundingClientRect()
      const t = dragRef.current
      if (t === 'h1') {
        setGrid(g => ({ ...g, h1: Math.max(0.2, Math.min(0.8, (e.clientY - rect.top) / rect.height)) }))
      } else if (t === 'v1') {
        setGrid(g => ({ ...g, v1: Math.max(0.2, Math.min(0.8, (e.clientX - rect.left) / rect.width)) }))
      }
    }
    const up = () => { dragRef.current = null; document.body.style.cursor = ''; document.body.style.userSelect = '' }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
    return () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up) }
  }, [])

  const startDrag = (t: string) => {
    dragRef.current = t
    document.body.style.userSelect = 'none'
    document.body.style.cursor = t === 'v1' ? 'col-resize' : 'row-resize'
  }

  // ── Load scatter data ───────────────────────────────────────────
  useEffect(() => {
    setLoading('scatter', true)
    setError(null)
    const load = algorithm === 'fcm'
      ? api.fcmClusters(nClusters).then(d => setScatterPlayers(d.players))
      : algorithm === 'aefcm'
        ? api.aefcmClusters(nClusters).then(d => setScatterPlayers(d.players))
        : algorithm === 'dec'
          ? api.decClusters().then(d => setScatterPlayers(d.players))
          : algorithm === 'decv2'
            ? api.decV2Clusters().then(d => setScatterPlayers(d.players))
            : api.projections(algorithm).then(d => setScatterPlayers(d))
    load.catch(e => setError(e.message)).finally(() => setLoading('scatter', false))
  }, [algorithm, nClusters])

  // ── Load per-player data on selection / time change ──────────────
  useEffect(() => {
    if (!selectedPlayerIds.length) {
      setPlayersData([])
      setComparePlayers([])
      return
    }
    const ids = selectedPlayerIds
    setLoading('players', true)

    Promise.all([
      Promise.all(ids.map(id =>
        Promise.all([
          api.playerHeatmap(id, timeLimit),
          api.playerPassNetwork(id, timeLimit),
          api.playerGoals(id, timeLimit),
          api.playerAssists(id, timeLimit),
          api.playerDefensivePressure(id, timeLimit),
        ])
      )),
      api.comparePlayers(ids, timeLimit),
    ]).then(([playerResults, comparison]) => {
      const data = playerResults.map(([hm, pn, gl, as, pr], i) => {
        const pid = ids[i]
        const sp = (scatterPlayers as any[]).find(p => p.player_id === pid)
        return {
          playerId: pid,
          playerName: sp?.player_name ?? `Jugador ${i + 1}`,
          heatmapCells: hm.cells,
          heatmapTotal: hm.total_events,
          passes: pn.passes,
          passTotal: pn.total,
          goals: gl.goals,
          assists: as.assists,
          pressures: pr.pressures,
        }
      })
      setPlayersData(data)
      setComparePlayers(comparison.players)
      if (data.length > 0 && passFocusPlayerId === null) {
        setPassFocusPlayerId(data[0].playerId)
      }
    }).catch(console.error).finally(() => setLoading('players', false))
  }, [selectedPlayerIds.join(','), timeLimit])

  const h2 = 1 - grid.h1
  const noSelection = !selectedPlayerIds.length
  const passGroups = playersData.map((d, i) => ({
    passes: d.passes,
    playerIdx: i,
    playerName: d.playerName,
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{
        height: 44, display: 'flex', alignItems: 'center',
        borderBottom: '1px solid var(--c-bdr)', flexShrink: 0,
        background: 'var(--c-sur1)',
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-t1)', padding: '0 16px', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
          Scout<span style={{ color: 'var(--c-acc)' }}>Pro</span>
        </div>

        {/* Quick search */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ position: 'relative' }}>
            <input
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setShowSearch(true) }}
              onFocus={() => setShowSearch(true)}
              onBlur={() => setTimeout(() => setShowSearch(false), 200)}
              placeholder="Buscar jugador…"
              style={{
                width: 160, padding: '4px 20px 4px 8px', fontSize: 10, borderRadius: 4,
                border: '1px solid var(--c-bdr)', background: 'var(--c-bg)',
                color: 'var(--c-t1)', outline: 'none',
              }}
            />
            {searchQuery && (
              <span onClick={() => { setSearchQuery(''); setShowSearch(false) }}
                style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', fontSize: 10, color: 'var(--c-t4)' }}>
                ×
              </span>
            )}
            {showSearch && searchQuery && filteredPlayers.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                background: 'var(--c-sur1)', border: '1px solid var(--c-bdr)',
                borderRadius: 4, maxHeight: 200, overflow: 'auto',
              }}>
                {filteredPlayers.map((p: any) => (
                  <div key={p.player_id} onMouseDown={() => selectPlayer(p.player_id)}
                    style={{ padding: '4px 8px', fontSize: 10, cursor: 'pointer', color: 'var(--c-t1)' }}>
                    {p.player_name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Case study presets */}
          {CASE_PLAYERS.map(name => {
            const match = (scatterPlayers as any[]).find((p: any) =>
              p.player_name && p.player_name.toLowerCase().includes(name.toLowerCase())
            )
            if (!match) return null
            const active = selectedPlayerIds.includes(match.player_id)
            return (
              <button key={name} onClick={() => selectPlayer(match.player_id)}
                style={{
                  padding: '3px 7px', fontSize: 9, borderRadius: 4, whiteSpace: 'nowrap',
                  border: `1px solid ${active ? 'var(--c-acc)' : 'var(--c-bdr)'}`,
                  background: active ? 'color-mix(in srgb, var(--c-acc) 15%, transparent)' : 'var(--c-bg)',
                  color: active ? 'var(--c-acc)' : 'var(--c-t3)',
                  cursor: 'pointer', fontWeight: active ? 600 : 400,
                }}>
                {name}
              </button>
            )
          })}
        </div>

        <AlgorithmSelector />
        <div style={{ flex: 1 }} />
        <TimeRangeSlider />
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Left sidebar: toggle cluster / players */}
        <div style={{
          width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column',
          borderRight: '1px solid var(--c-bdr)', overflow: 'hidden',
        }}>
          {/* Toggle tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--c-bdr)', flexShrink: 0 }}>
            <button onClick={() => setSidebarView('cluster')} style={{
              flex: 1, padding: '6px 0', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: sidebarView === 'cluster' ? 'var(--c-acc)' : 'var(--c-t4)',
              borderBottom: `2px solid ${sidebarView === 'cluster' ? 'var(--c-acc)' : 'transparent'}`,
              background: sidebarView === 'cluster' ? 'var(--c-sur2)' : 'transparent',
              fontWeight: 500, cursor: 'pointer', transition: 'all 0.1s',
            }}>
              Cluster ({scatterPlayers.length})
            </button>
            <button onClick={() => setSidebarView('players')} style={{
              flex: 1, padding: '6px 0', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: sidebarView === 'players' ? 'var(--c-acc)' : 'var(--c-t4)',
              borderBottom: `2px solid ${sidebarView === 'players' ? 'var(--c-acc)' : 'transparent'}`,
              background: sidebarView === 'players' ? 'var(--c-sur2)' : 'transparent',
              fontWeight: 500, cursor: 'pointer', transition: 'all 0.1s',
            }}>
              Jugadores ({selectedPlayerIds.length})
            </button>
          </div>

          {/* Content: cuando algorithm=decv2 incrustar el Scatter3D en lugar del 2D */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {sidebarView === 'cluster'
              ? (algorithm === 'decv2' ? <ProjectionScatter3D onExit={() => setAlgorithm('dec')} /> : <ProjectionScatter />)
              : <PlayerList />}
          </div>

          {/* Control "N similares" aparece cuando hay 1 jugador seleccionado */}
          {selectedPlayerIds.length === 1 && (
            <div style={{ padding: '6px 10px', borderTop: '1px solid var(--c-bdr)', background: 'var(--c-sur1)', flexShrink: 0 }}>
              <SimilarPlayers playerId={selectedPlayerIds[0]} />
            </div>
          )}
        </div>

        {/* Center: Comparative fields + Pentagon */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div ref={mainRef} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Top row: Comparative fields with tabs */}
            <div style={{ height: `calc(${grid.h1 * 100}% - ${HANDLE}px)`, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {/* Tabs */}
              <div style={{
                display: 'flex', borderBottom: '1px solid var(--c-bdr)', flexShrink: 0,
                background: 'var(--c-sur1)',
              }}>
                {TABS.map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                    padding: '6px 12px', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: activeTab === tab.id ? 'var(--c-acc)' : 'var(--c-t4)',
                    borderBottom: `2px solid ${activeTab === tab.id ? 'var(--c-acc)' : 'transparent'}`,
                    background: activeTab === tab.id ? 'var(--c-sur2)' : 'transparent',
                    fontWeight: 500, cursor: 'pointer', transition: 'all 0.1s',
                  }}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                {activeTab === 'heatmap' && (
                  <>
                    <PanelLabel label="Mapas de calor" />
                    <HeatmapPanel
                      entries={playersData.map(d => ({
                        playerName: d.playerName,
                        cells: d.heatmapCells,
                        totalEvents: d.heatmapTotal,
                      }))}
                    />
                  </>
                )}
                {activeTab === 'passes' && (
                  <>
                    <PanelLabel label="Red de pases (resumida por zona)" />
                    <PassNetworkPanel
                      groups={passGroups}
                      focusPlayerId={passFocusPlayerId !== null ? passFocusPlayerId : 'all'}
                      onFocusChange={id => setPassFocusPlayerId(id === 'all' ? null : id as number)}
                    />
                  </>
                )}
                {activeTab === 'goals' && (
                  <>
                    <PanelLabel label="Ubicación de goles" />
                    <GoalsPanel
                      entries={playersData.map(d => ({
                        playerName: d.playerName,
                        goals: d.goals,
                      }))}
                    />
                  </>
                )}
                {activeTab === 'assists' && (
                  <>
                    <PanelLabel label="Ubicación de asistencias" />
                    <AssistsPanel
                      entries={playersData.map(d => ({
                        playerName: d.playerName,
                        assists: d.assists,
                      }))}
                    />
                  </>
                )}
                {activeTab === 'pressure' && (
                  <>
                    <PanelLabel label="Presión defensiva" />
                    <DefensivePressurePanel
                      entries={playersData.map(d => ({
                        playerName: d.playerName,
                        pressures: d.pressures,
                      }))}
                    />
                  </>
                )}
                {activeTab === 'jugadas' && (
                  <>
                    <PanelLabel label="Jugadas importantes por peso táctico" />
                    <KeyActionsPanel />
                  </>
                )}
              </div>
            </div>

            <HHandle onMouseDown={() => startDrag('h1')} />

            {/* Bottom: Pentagon chart */}
            <div style={{ height: `calc(${h2 * 100}% - ${HANDLE}px)`, position: 'relative', overflow: 'hidden' }}>
              <PanelLabel label="Pentágono — Comparación" />
              <PentagonChart players={comparePlayers} />
            </div>
          </div>
        </div>

        {/* Right sidebar: Scoring + Conjuntos (Grupo fue eliminado) */}
        <div style={{
          width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column',
          borderLeft: '1px solid var(--c-bdr)', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--c-bdr)', flexShrink: 0 }}>
            <button onClick={() => setRightTab('scoring')} style={{
              flex: 1, padding: '6px 0', fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: rightTab === 'scoring' ? 'var(--c-acc)' : 'var(--c-t4)',
              borderBottom: `2px solid ${rightTab === 'scoring' ? 'var(--c-acc)' : 'transparent'}`,
              background: rightTab === 'scoring' ? 'var(--c-sur2)' : 'transparent',
              fontWeight: 500, cursor: 'pointer', transition: 'all 0.1s',
            }}>
              Puntuación
            </button>
            <button onClick={() => setRightTab('conjuntos')} style={{
              flex: 1, padding: '6px 0', fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: rightTab === 'conjuntos' ? 'var(--c-acc)' : 'var(--c-t4)',
              borderBottom: `2px solid ${rightTab === 'conjuntos' ? 'var(--c-acc)' : 'transparent'}`,
              background: rightTab === 'conjuntos' ? 'var(--c-sur2)' : 'transparent',
              fontWeight: 500, cursor: 'pointer', transition: 'all 0.1s',
            }}>
              Conjuntos
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {rightTab === 'scoring' ? <PlayerScoring /> : <MembershipOverlap />}
          </div>
        </div>
      </div>
    </div>
  )
}

function PanelLabel({ label }: { label: string }) {
  return (
    <div style={{
      position: 'absolute', top: 6, left: 10, zIndex: 10, pointerEvents: 'none',
      fontSize: 7, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase',
      color: 'var(--c-t4)',
    }}>
      {label}
    </div>
  )
}

function HHandle({ onMouseDown }: { onMouseDown: () => void }) {
  return (
    <div onMouseDown={onMouseDown} style={{
      height: HANDLE, background: 'var(--c-sur1)', cursor: 'row-resize', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderTop: '1px solid var(--c-bdr)', borderBottom: '1px solid var(--c-bdr)',
    }}>
      <div style={{ width: 28, height: 1, background: 'var(--c-bdr2)', borderRadius: 1 }} />
    </div>
  )
}

function VHandle({ onMouseDown }: { onMouseDown: () => void }) {
  return (
    <div onMouseDown={onMouseDown} style={{
      width: HANDLE, background: 'var(--c-sur1)', cursor: 'col-resize', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderLeft: '1px solid var(--c-bdr)', borderRight: '1px solid var(--c-bdr)',
    }}>
      <div style={{ height: 28, width: 1, background: 'var(--c-bdr2)', borderRadius: 1 }} />
    </div>
  )
}
