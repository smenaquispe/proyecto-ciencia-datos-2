'use client'

import { useDashboard } from '@/store/store'

const POS_COLORS: Record<string, string> = {
  GK: '#e5c07b', DEF: '#61afef', DM: '#56b6c2', MID: '#98c379', FWD: '#e06c75',
}

export function PlayerList() {
  const {
    scatterPlayers, selectedPlayerIds, algorithm,
    togglePlayerId, setSelectedPlayerIds,
  } = useDashboard()

  const isFcm = algorithm === 'fcm' || algorithm === 'aefcm' || algorithm === 'dec'

  if (!scatterPlayers.length) return null

  const displayPlayers = scatterPlayers.filter(p =>
    selectedPlayerIds.length === 0 || selectedPlayerIds.includes(p.player_id as number)
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{
        padding: '5px 10px', borderBottom: '1px solid var(--c-bdr)', flexShrink: 0,
        background: 'var(--c-sur1)', fontSize: 8, color: 'var(--c-t4)',
        letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span>Jugadores</span>
        <span style={{ color: 'var(--c-t5)', fontWeight: 400 }}>
          · {selectedPlayerIds.length || displayPlayers.length} / {scatterPlayers.length}
        </span>
        {selectedPlayerIds.length > 0 && (
          <button onClick={() => setSelectedPlayerIds([])}
            style={{ marginLeft: 'auto', fontSize: 7, color: 'var(--c-t5)', border: '1px solid var(--c-bdr)', borderRadius: 2, padding: '1px 5px' }}>
            Todos
          </button>
        )}
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {displayPlayers.map((p: any) => {
          const isSel = selectedPlayerIds.includes(p.player_id)
          const color = isFcm
            ? (['#00d68f', '#4d9eff', '#f5c842', '#ff6b35', '#9b59ff', '#ff4757', '#00bcd4', '#e91e63', '#7c3aed', '#14b8a6'][p.cluster] ?? '#666')
            : POS_COLORS[p.pos_group] ?? '#666'
          return (
            <div
              key={p.player_id}
              onClick={() => togglePlayerId(p.player_id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
                borderLeft: `2px solid ${isSel ? color : 'transparent'}`,
                background: isSel ? 'color-mix(in srgb, var(--c-acc) 6%, transparent)' : 'transparent',
                cursor: 'pointer', transition: 'all 0.1s',
              }}
            >
              <input
                type="checkbox"
                checked={isSel}
                onChange={() => togglePlayerId(p.player_id)}
                style={{ accentColor: color }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: isSel ? 'var(--c-t1)' : 'var(--c-t3)', fontWeight: isSel ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.player_name}
                </div>
                <div style={{ fontSize: 8, color: 'var(--c-t5)' }}>
                  {p.dominant_position} · {p.matches_played} part.
                </div>
              </div>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
