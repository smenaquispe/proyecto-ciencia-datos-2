'use client'

import { useEffect, useRef, useState } from 'react'
import { useDashboard } from '@/store/store'
import { api } from '@/lib/api'
import { Sidebar } from '@/components/Sidebar'
import { MatchHeader } from '@/components/MatchHeader'
import { PlayerPanel } from '@/components/PlayerPanel'
import { PlayerCloud } from '@/components/charts/PlayerCloud'
import { ActivityHeatmap } from '@/components/charts/ActivityHeatmap'
import { PassNetwork } from '@/components/charts/PassNetwork'
import { ParallelCoords } from '@/components/charts/ParallelCoords'
import { PlayerTable } from '@/components/charts/PlayerTable'

interface Grid { topH: number; botH: number; v1: number; v2: number }
const HANDLE = 5

export default function DashboardPage() {
  const {
    selectedMatch, selectedPlayer, selectedPlayer2, minuteRange,
    setCountries, setLineupData, setPasses, setPasses2,
    setHeatmapCells, setHeatmapCells2, setRatings, setRatings2,
    setPlayersRanking, setPositionPatterns, setMaxMinute, setFcmPlayers, setLoading,
    theme, toggleTheme,
  } = useDashboard()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const [grid, setGrid] = useState<Grid>({ topH: 0.46, botH: 0.25, v1: 0.56, v2: 0.50 })
  const dragType = useRef<keyof Grid | null>(null)
  const mainRef = useRef<HTMLDivElement>(null)

  // ── Countries ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    api.countries().then(d => setCountries(d.countries)).catch(console.error)
  }, [setCountries])

  // ── Match data + FCM ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedMatch) { setLineupData(null); return }
    const mid = selectedMatch.match_id
    setLoading('lineup', true)
    setLoading('fcm', true)
    Promise.all([api.lineup(mid), api.eventsSummary(mid), api.playersRanking(mid), api.positionPatterns(mid)])
      .then(([l, e, r, p]) => { setLineupData(l); setMaxMinute(e.max_minute || 90); setPlayersRanking(r.players); setPositionPatterns(p.positions) })
      .catch(console.error).finally(() => setLoading('lineup', false))
    api.fcm(mid)
      .then(d => setFcmPlayers(d.players))
      .catch(console.error)
      .finally(() => setLoading('fcm', false))
  }, [selectedMatch?.match_id])

  // ── Player 1 data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedPlayer || !selectedMatch) { setRatings(null); setPasses([]); setHeatmapCells([]); return }
    const { match_id } = selectedMatch; const { player_id } = selectedPlayer
    const [mf, mt] = minuteRange
    setLoading('player', true)
    Promise.all([api.playerRatings(match_id, player_id), api.passes(match_id, player_id, mf, mt), api.heatmap(match_id, player_id, mf, mt)])
      .then(([r, p, h]) => { setRatings(r); setPasses(p.passes); setHeatmapCells(h.cells) })
      .catch(console.error).finally(() => setLoading('player', false))
  }, [selectedPlayer?.player_id])

  // ── Player 2 data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedPlayer2 || !selectedMatch) { setRatings2(null); setPasses2([]); setHeatmapCells2([]); return }
    const { match_id } = selectedMatch; const { player_id } = selectedPlayer2
    const [mf, mt] = minuteRange
    setLoading('player2', true)
    Promise.all([api.playerRatings(match_id, player_id), api.passes(match_id, player_id, mf, mt), api.heatmap(match_id, player_id, mf, mt)])
      .then(([r, p, h]) => { setRatings2(r); setPasses2(p.passes); setHeatmapCells2(h.cells) })
      .catch(console.error).finally(() => setLoading('player2', false))
  }, [selectedPlayer2?.player_id])

  // ── Minute range refetch (both players) ──────────────────────────────────────
  useEffect(() => {
    if (!selectedPlayer || !selectedMatch) return
    const { match_id } = selectedMatch; const { player_id } = selectedPlayer; const [mf, mt] = minuteRange
    api.passes(match_id, player_id, mf, mt).then(d => setPasses(d.passes)).catch(console.error)
    api.heatmap(match_id, player_id, mf, mt).then(d => setHeatmapCells(d.cells)).catch(console.error)
  }, [minuteRange[0], minuteRange[1]])

  useEffect(() => {
    if (!selectedPlayer2 || !selectedMatch) return
    const { match_id } = selectedMatch; const { player_id } = selectedPlayer2; const [mf, mt] = minuteRange
    api.passes(match_id, player_id, mf, mt).then(d => setPasses2(d.passes)).catch(console.error)
    api.heatmap(match_id, player_id, mf, mt).then(d => setHeatmapCells2(d.cells)).catch(console.error)
  }, [selectedPlayer2?.player_id, minuteRange[0], minuteRange[1]])

  // ── Resizable grid ────────────────────────────────────────────────────────────
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragType.current || !mainRef.current) return
      const rect = mainRef.current.getBoundingClientRect()
      const t = dragType.current
      if (t === 'topH') setGrid(g => ({ ...g, topH: Math.max(0.2, Math.min(0.68, (e.clientY - rect.top) / rect.height)) }))
      else if (t === 'botH') setGrid(g => ({ ...g, botH: Math.max(0.1, Math.min(0.42, 1 - (e.clientY - rect.top) / rect.height)) }))
      else if (t === 'v1')   setGrid(g => ({ ...g, v1: Math.max(0.25, Math.min(0.78, (e.clientX - rect.left) / rect.width)) }))
      else if (t === 'v2')   setGrid(g => ({ ...g, v2: Math.max(0.25, Math.min(0.78, (e.clientX - rect.left) / rect.width)) }))
    }
    const up = () => { dragType.current = null; document.body.style.cursor = ''; document.body.style.userSelect = '' }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
    return () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up) }
  }, [])

  const startDrag = (t: keyof Grid) => {
    dragType.current = t
    document.body.style.userSelect = 'none'
    document.body.style.cursor = t === 'v1' || t === 'v2' ? 'col-resize' : 'row-resize'
  }

  const midH = Math.max(0.1, 1 - grid.topH - grid.botH)

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '240px 1fr 340px',
      height: '100vh', overflow: 'hidden',
      background: 'var(--c-bg)',
    }}>
      <Sidebar />

      <div style={{
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        borderLeft: '1px solid var(--c-bdr)', borderRight: '1px solid var(--c-bdr)',
      }}>
        <MatchHeader onThemeToggle={toggleTheme} isDark={theme === 'dark'} />

        <div ref={mainRef} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* ROW 1 */}
          <div style={{ height: `calc(${grid.topH * 100}% - ${HANDLE}px)`, display: 'flex', minHeight: 0 }}>
            <Panel style={{ width: `${grid.v1 * 100}%` }} label="Nube FCM — jugadores">
              <PlayerCloud />
            </Panel>
            <VHandle onMouseDown={() => startDrag('v1')} />
            <Panel style={{ flex: 1 }} label="Ranking del partido">
              <PlayerTable />
            </Panel>
          </div>

          <HHandle onMouseDown={() => startDrag('topH')} />

          {/* ROW 2 */}
          <div style={{ height: `calc(${midH * 100}% - ${HANDLE}px)`, display: 'flex', minHeight: 0 }}>
            <Panel style={{ width: `${grid.v2 * 100}%` }} label="Mapa de calor">
              {selectedPlayer ? <ActivityHeatmap /> : <EmptyMsg text="Mapa de calor — selecciona jugador" />}
            </Panel>
            <VHandle onMouseDown={() => startDrag('v2')} />
            <Panel style={{ flex: 1 }} label="Red de pases">
              {selectedPlayer ? <PassNetwork /> : <EmptyMsg text="Red de pases — selecciona jugador" />}
            </Panel>
          </div>

          <HHandle onMouseDown={() => startDrag('botH')} />

          {/* ROW 3 */}
          <div style={{ height: `${grid.botH * 100}%`, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
            {selectedPlayer ? <ParallelCoords /> : <EmptyMsg text="Pentágono y coordenadas paralelas — selecciona jugador" />}
          </div>
        </div>
      </div>

      <PlayerPanel />
    </div>
  )
}

function Panel({ children, style, label }: { children: React.ReactNode; style?: React.CSSProperties; label: string }) {
  return (
    <div style={{ position: 'relative', overflow: 'hidden', minWidth: 0, minHeight: 0, ...style }}>
      <div style={{
        position: 'absolute', top: 6, left: 12, zIndex: 10, pointerEvents: 'none',
        fontSize: 8, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase',
        color: 'var(--c-t4)',
      }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function HHandle({ onMouseDown }: { onMouseDown: () => void }) {
  return (
    <div onMouseDown={onMouseDown} style={{
      height: HANDLE, background: 'var(--c-sur1)', cursor: 'row-resize', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderTop: '1px solid var(--c-bdr)', borderBottom: '1px solid var(--c-bdr)',
    }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-sur2)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--c-sur1)')}
    >
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
    }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-sur2)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--c-sur1)')}
    >
      <div style={{ height: 28, width: 1, background: 'var(--c-bdr2)', borderRadius: 1 }} />
    </div>
  )
}

function EmptyMsg({ text }: { text: string }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 10, color: 'var(--c-t5)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {text}
      </span>
    </div>
  )
}
