'use client'

import { useState, useMemo } from 'react'
import { useDashboard } from '@/store/store'

type SortKey = 'overall_score' | 'pass_score' | 'duel_score' | 'shot_score' | 'total_passes' | 'total_shots'

const COLS: { key: SortKey; label: string; color: string; short: string }[] = [
  { key: 'overall_score', label: 'Overall',  color: '#d0d0d0', short: 'OV' },
  { key: 'pass_score',    label: 'Pases',    color: '#00d68f', short: 'PA' },
  { key: 'duel_score',    label: 'Duelos',   color: '#4d9eff', short: 'DU' },
  { key: 'shot_score',    label: 'Tiros',    color: '#ff6b35', short: 'TI' },
  { key: 'total_passes',  label: 'N Pases',  color: '#505050', short: 'NP' },
  { key: 'total_shots',   label: 'N Tiros',  color: '#505050', short: 'NT' },
]

function scoreColor(score: number): string {
  if (score >= 7) return '#00d68f'
  if (score >= 5) return '#f5c842'
  if (score >= 3) return '#ff6b35'
  return '#ff4757'
}

function MiniBar({ value, max = 10, color }: { value: number; max?: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 40, height: 2, background: '#141414', borderRadius: 1, position: 'relative', flexShrink: 0 }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, height: '100%',
          width: `${Math.min(value / max, 1) * 100}%`,
          background: color, borderRadius: 1, transition: 'width 0.3s',
        }} />
      </div>
      <span style={{ fontFamily: 'monospace', fontSize: 10, color, fontWeight: 500, minWidth: 26, textAlign: 'right' }}>
        {typeof value === 'number' && value < 100 ? value.toFixed(1) : value}
      </span>
    </div>
  )
}

export function PlayerTable() {
  const { playersRanking, selectedPlayer, selectedPlayer2, setPlayer, setPlayer2, lineupData, loading, weights, hoveredPlayerId, setHoveredPlayerId } = useDashboard()
  const [sortKey, setSortKey] = useState<SortKey>('overall_score')
  const [sortAsc, setSortAsc] = useState(false)
  const [teamFilter, setTeamFilter] = useState<'all' | number>('all')

  const homeId = lineupData?.match.home_team_id
  const homeName = lineupData?.teams.find(t => t.team_id === homeId)?.team_name ?? 'Local'
  const awayName = lineupData?.teams.find(t => t.team_id !== homeId)?.team_name ?? 'Visitante'
  const awayId = lineupData?.teams.find(t => t.team_id !== homeId)?.team_id

  const adjusted = useMemo(() =>
    playersRanking.map(p => {
      const w = weights.pass + weights.duel + weights.shot
      const ov = w > 0
        ? (p.pass_score * weights.pass + p.duel_score * weights.duel + p.shot_score * weights.shot) / w
        : 0
      return { ...p, overall_score: Math.round(ov * 100) / 100 }
    }), [playersRanking, weights])

  const rows = useMemo(() => {
    let r = adjusted
    if (teamFilter !== 'all') r = r.filter(p => p.team_id === teamFilter)
    return [...r].sort((a, b) =>
      sortAsc ? (a[sortKey] ?? 0) - (b[sortKey] ?? 0) : (b[sortKey] ?? 0) - (a[sortKey] ?? 0)
    )
  }, [adjusted, sortKey, sortAsc, teamFilter])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(s => !s)
    else { setSortKey(key); setSortAsc(false) }
  }

  const isLoading = loading['lineup']

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Controls */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '5px 12px', borderBottom: '1px solid #111', flexShrink: 0,
      }}>
        {[
          { id: 'all', label: 'Todos' },
          { id: homeId, label: homeName },
          { id: awayId, label: awayName },
        ].filter(o => o.id !== undefined).map(o => (
          <button
            key={String(o.id)}
            onClick={() => setTeamFilter(o.id as typeof teamFilter)}
            style={{
              padding: '2px 8px', fontSize: 9,
              letterSpacing: '0.04em', textTransform: 'uppercase',
              color: teamFilter === o.id ? '#d8d8d8' : '#383838',
              border: `1px solid ${teamFilter === o.id ? '#2a2a2a' : '#141414'}`,
              borderRadius: 2,
              background: teamFilter === o.id ? '#141414' : 'none',
              cursor: 'pointer', transition: 'all 0.1s',
              maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {o.label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 9, color: '#282828', fontFamily: 'monospace' }}>
          {rows.length}
        </span>
        {isLoading && <span style={{ fontSize: 9, color: '#282828' }}>Cargando...</span>}
      </div>

      {/* Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '18px 1fr 78px 78px 78px 78px 56px 50px',
        padding: '4px 12px',
        borderBottom: '1px solid #111', flexShrink: 0,
      }}>
        <span />
        <span style={thStyle}>Jugador</span>
        {COLS.map(c => (
          <button key={c.key} onClick={() => handleSort(c.key)} style={{
            ...thStyle, textAlign: 'right', background: 'none', border: 'none',
            cursor: 'pointer', fontFamily: 'inherit',
            color: sortKey === c.key ? c.color : '#303030',
          }}>
            {c.label} {sortKey === c.key ? (sortAsc ? '↑' : '↓') : ''}
          </button>
        ))}
      </div>

      {/* Rows */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {rows.map((p, idx) => {
          const isSel = selectedPlayer?.player_id === p.player_id
          const isSel2 = selectedPlayer2?.player_id === p.player_id
          const isHov = hoveredPlayerId === p.player_id
          const isHome = p.team_id === homeId
          const tc = isHome ? '#00d68f' : '#ff6b35'

          const lineup = lineupData?.teams
            .flatMap(t => t.players.map(pl => ({ ...pl, team_id: t.team_id, team_name: t.team_name })))
            .find(pl => pl.player_id === p.player_id)

          const sp = { player_id: p.player_id, player_name: p.player_name, team_id: p.team_id, team_name: p.team_name, position_name: lineup?.position_name ?? '', jersey_number: lineup?.jersey_number ?? 0 }

          const handleClick = () => {
            if (isSel) { setPlayer(selectedPlayer2 ? { ...selectedPlayer2 } : null); setPlayer2(null) }
            else if (isSel2) { setPlayer2(null) }
            else if (!selectedPlayer) { setPlayer(sp) }
            else { setPlayer2(sp) }
          }

          return (
            <button
              key={p.player_id}
              onClick={handleClick}
              onMouseEnter={() => setHoveredPlayerId(p.player_id)}
              onMouseLeave={() => setHoveredPlayerId(null)}
              style={{
                display: 'grid',
                gridTemplateColumns: '18px 1fr 78px 78px 78px 78px 56px 50px',
                padding: '4px 12px',
                width: '100%', textAlign: 'left',
                background: isSel ? '#0d1410' : isSel2 ? '#12101a' : isHov ? '#0c0c0c' : 'transparent',
                borderLeft: `2px solid ${isSel ? tc : isSel2 ? '#9b59ff' : 'transparent'}`,
                borderBottom: '1px solid #0c0c0c',
                cursor: 'pointer', transition: 'background 0.1s',
              }}
            >
              <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#282828', alignSelf: 'center' }}>
                {idx + 1}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0, overflow: 'hidden', alignSelf: 'center' }}>
                <span style={{
                  fontSize: 11, fontWeight: 400,
                  color: isSel ? '#e8e8e8' : isHov ? '#c0c0c0' : '#888',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {p.player_name}
                </span>
                <span style={{ fontSize: 8, color: tc, opacity: 0.5 }}>
                  {p.team_name.split(' ').slice(0, 2).join(' ')}
                </span>
              </div>
              <MiniBar value={p.overall_score} color={scoreColor(p.overall_score)} />
              <MiniBar value={p.pass_score}    color="#00d68f" />
              <MiniBar value={p.duel_score}    color="#4d9eff" />
              <MiniBar value={p.shot_score}    color="#ff6b35" />
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#404040', textAlign: 'right', alignSelf: 'center' }}>
                {p.total_passes}
              </span>
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#404040', textAlign: 'right', alignSelf: 'center' }}>
                {p.total_shots}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  fontSize: 8, letterSpacing: '0.08em', textTransform: 'uppercase',
  color: '#2a2a2a', fontWeight: 400,
}
