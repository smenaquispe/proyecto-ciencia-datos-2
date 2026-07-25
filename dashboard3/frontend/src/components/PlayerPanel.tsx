'use client'

import { useDashboard } from '@/store/store'
import type { PlayerRatings, SelectedPlayer, HeatmapCell } from '@/lib/types'

const C1 = '#00d68f'   // player 1 accent (overrides below when away)
const C2 = '#9b59ff'   // player 2 always purple

export function PlayerPanel() {
  const {
    selectedPlayer, selectedPlayer2,
    ratings, ratings2,
    heatmapCells, heatmapCells2,
    weights, setWeights, loading,
    minuteRange, maxMinute, setMinuteRange, lineupData,
  } = useDashboard()

  const isLoading = loading['player'] || loading['player2']
  const isHome1 = selectedPlayer?.team_id === lineupData?.match.home_team_id
  const isHome2 = selectedPlayer2?.team_id === lineupData?.match.home_team_id
  const tc1 = isHome1 ? '#00d68f' : '#ff6b35'
  const tc2 = C2
  const compareMode = !!selectedPlayer2

  if (!selectedPlayer) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', height: '100vh',
        background: 'var(--c-bg)', borderLeft: '1px solid var(--c-bdr)',
        alignItems: 'center', justifyContent: 'center', gap: 14,
      }}>
        <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
          <circle cx="19" cy="14" r="6.5" stroke="var(--c-bdr2)" strokeWidth="1.5" />
          <path d="M7 34c0-6.627 5.373-12 12-12s12 5.373 12 12"
            stroke="var(--c-bdr2)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span style={{ fontSize: 10, color: 'var(--c-t5)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500 }}>
          Sin jugador seleccionado
        </span>
      </div>
    )
  }

  const pass_s1 = ratings?.passes.pass_score ?? 0
  const duel_s1 = ratings?.duels.duel_score ?? 0
  const shot_s1 = ratings?.shots.shot_score ?? 0
  const pass_s2 = ratings2?.passes.pass_score ?? 0
  const duel_s2 = ratings2?.duels.duel_score ?? 0
  const shot_s2 = ratings2?.shots.shot_score ?? 0
  const wSum = weights.pass + weights.duel + weights.shot
  const weighted1 = wSum > 0 ? Math.round(((pass_s1 * weights.pass + duel_s1 * weights.duel + shot_s1 * weights.shot) / wSum) * 10) / 10 : 0
  const weighted2 = wSum > 0 ? Math.round(((pass_s2 * weights.pass + duel_s2 * weights.duel + shot_s2 * weights.shot) / wSum) * 10) / 10 : 0

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'auto',
      background: 'var(--c-bg)', borderLeft: '1px solid var(--c-bdr)',
    }}>
      {/* Header — single or dual */}
      {compareMode ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid var(--c-bdr)', flexShrink: 0, background: 'var(--c-sur1)' }}>
          <PlayerHeader player={selectedPlayer} tc={tc1} label="J1" />
          <PlayerHeader player={selectedPlayer2!} tc={tc2} label="J2" borderLeft />
        </div>
      ) : (
        <div style={{ padding: '13px 16px 11px', borderBottom: '1px solid var(--c-bdr)', flexShrink: 0, background: 'var(--c-sur1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <JerseyBadge num={selectedPlayer.jersey_number} tc={tc1} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: 'var(--c-t1)', fontWeight: 500, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedPlayer.player_name}
              </div>
              <div style={{ fontSize: 10, color: 'var(--c-t3)' }}>
                {selectedPlayer.position_name}
                <span style={{ color: 'var(--c-t5)', margin: '0 5px' }}>·</span>
                <span style={{ color: tc1, opacity: 0.7 }}>{selectedPlayer.team_name}</span>
              </div>
            </div>
            {isLoading && <div style={{ width: 5, height: 5, borderRadius: '50%', background: tc1, opacity: 0.5 }} />}
          </div>
        </div>
      )}

      {/* Time range */}
      <Section label="Rango de tiempo">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--c-t2)', minWidth: 28 }}>{minuteRange[0]}'</span>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <input type="range" min={0} max={maxMinute} value={minuteRange[0]} onChange={e => setMinuteRange([+e.target.value, minuteRange[1]])} />
            <input type="range" min={0} max={maxMinute} value={minuteRange[1]} onChange={e => setMinuteRange([minuteRange[0], +e.target.value])} />
          </div>
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--c-t2)', minWidth: 28, textAlign: 'right' }}>{minuteRange[1]}'</span>
        </div>
      </Section>

      {/* Scores */}
      {compareMode ? (
        <>
          <Section label="Comparación — T1/T2">
            <CompareBar label="Pases"  v1={pass_s1} v2={pass_s2} c2={tc2} />
            <CompareBar label="Duelos" v1={duel_s1} v2={duel_s2} c2={tc2} />
            <CompareBar label="Tiros"  v1={shot_s1} v2={shot_s2} c2={tc2} />
            <div style={{ height: 1, background: 'var(--c-bdr)', margin: '8px 0' }} />
            <CompareBar label="Overall" v1={weighted1} v2={weighted2} c2={tc2} big />
          </Section>

          <Section label="Pesos — T3">
            <WSlider label="Pases"  c="#00d68f" v={weights.pass} onChange={v => setWeights({ pass: v })} />
            <WSlider label="Duelos" c="#4d9eff" v={weights.duel} onChange={v => setWeights({ duel: v })} />
            <WSlider label="Tiros"  c="#ff6b35" v={weights.shot} onChange={v => setWeights({ shot: v })} />
          </Section>

          {ratings && (
            <Section label={`Detalle ${selectedPlayer.player_name.split(' ').slice(-1)[0]}`}>
              <SmallRBar label="Pases"  v={pass_s1} c="#00d68f" />
              <SmallRBar label="Duelos" v={duel_s1} c="#4d9eff" />
              <SmallRBar label="Tiros"  v={shot_s1} c="#ff6b35" />
            </Section>
          )}

          {ratings2 && (
            <Section label={`Detalle ${selectedPlayer2!.player_name.split(' ').slice(-1)[0]}`}>
              <SmallRBar label="Pases"  v={pass_s2} c={tc2} />
              <SmallRBar label="Duelos" v={duel_s2} c={tc2} />
              <SmallRBar label="Tiros"  v={shot_s2} c={tc2} />
            </Section>
          )}
        </>
      ) : (
        ratings ? (
          <>
            <Section label="Rendimiento — T1 / T2">
              <RBar label="Pases"  v={pass_s1} c="#00d68f" />
              <RBar label="Duelos" v={duel_s1} c="#4d9eff" />
              <RBar label="Tiros"  v={shot_s1} c="#ff6b35" />
              <div style={{ height: 1, background: 'var(--c-bdr)', margin: '10px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 10, color: 'var(--c-t3)' }}>Overall ajustado</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 26, fontWeight: 300, color: sc(weighted1) }}>{weighted1.toFixed(1)}</span>
                  <span style={{ fontSize: 10, color: 'var(--c-t5)' }}>/10</span>
                </div>
              </div>
            </Section>

            <Section label="Pesos — T3">
              <WSlider label="Pases"  c="#00d68f" v={weights.pass} onChange={v => setWeights({ pass: v })} />
              <WSlider label="Duelos" c="#4d9eff" v={weights.duel} onChange={v => setWeights({ duel: v })} />
              <WSlider label="Tiros"  c="#ff6b35" v={weights.shot} onChange={v => setWeights({ shot: v })} />
            </Section>

            <Section label="Pases">
              <G2 items={[
                ['Total', ratings.passes.total], ['Compl.', ratings.passes.completed],
                ['Precisión', ratings.passes.completion_rate.toFixed(1)],
                ['Dirección', ratings.passes.direction_score.toFixed(1)],
                ['Longitud', ratings.passes.length_score.toFixed(1)],
                ['Presión', ratings.passes.pressure_rating.toFixed(1)],
                ['Especiales', ratings.passes.special_passes],
              ]} />
            </Section>

            <Section label="Duelos">
              <G2 items={[
                ['Total', ratings.duels.total], ['Ganados', ratings.duels.won],
                ['Tasa', ratings.duels.win_rate.toFixed(1)], ['Zona', ratings.duels.area_score.toFixed(1)],
              ]} />
            </Section>

            <Section label="Tiros">
              <G2 items={[
                ['Total', ratings.shots.total], ['A puerta', ratings.shots.on_target],
                ['Goles', ratings.shots.goals], ['xG proxy', ratings.shots.xg_score.toFixed(1)],
              ]} />
            </Section>
          </>
        ) : (
          <div style={{ padding: 16 }}>
            <span style={{ fontSize: 11, color: 'var(--c-t5)' }}>Cargando datos del jugador...</span>
          </div>
        )
      )}

      {/* Mini heatmaps */}
      {compareMode ? (
        heatmapCells.length > 0 || heatmapCells2.length > 0 ? (
          <Section label="Actividad">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <div style={{ fontSize: 8, color: tc1, marginBottom: 4 }}>J1</div>
                <MiniHeatmap cells={heatmapCells} hex={tc1} />
              </div>
              <div>
                <div style={{ fontSize: 8, color: tc2, marginBottom: 4 }}>J2</div>
                <MiniHeatmap cells={heatmapCells2} hex={tc2} />
              </div>
            </div>
          </Section>
        ) : null
      ) : (
        heatmapCells.length > 0 && (
          <Section label="Mapa de actividad">
            <MiniHeatmap cells={heatmapCells} hex={tc1} />
          </Section>
        )
      )}
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function PlayerHeader({ player, tc, label, borderLeft }: { player: SelectedPlayer; tc: string; label: string; borderLeft?: boolean }) {
  return (
    <div style={{ padding: '10px 12px', borderLeft: borderLeft ? '1px solid var(--c-bdr)' : undefined }}>
      <div style={{ fontSize: 7, color: tc, letterSpacing: '0.1em', marginBottom: 4, fontWeight: 600 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <JerseyBadge num={player.jersey_number} tc={tc} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--c-t1)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {player.player_name.split(' ').slice(-1)[0]}
          </div>
          <div style={{ fontSize: 9, color: tc, opacity: 0.7 }}>{player.team_name.split(' ')[0]}</div>
        </div>
      </div>
    </div>
  )
}

function JerseyBadge({ num, tc }: { num: number; tc: string }) {
  return (
    <div style={{
      width: 26, height: 26, borderRadius: '50%',
      background: `${tc}15`, border: `1px solid ${tc}35`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'monospace', fontSize: 10, color: tc, fontWeight: 600, flexShrink: 0,
    }}>
      {num || '?'}
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '11px 16px', borderBottom: '1px solid var(--c-bdr)' }}>
      <div style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--c-t4)', marginBottom: 10, fontWeight: 500 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function CompareBar({ label, v1, v2, c2, big }: { label: string; v1: number; v2: number; c2: string; big?: boolean }) {
  return (
    <div style={{ marginBottom: big ? 0 : 9 }}>
      <div style={{ fontSize: 8, color: 'var(--c-t4)', marginBottom: 3 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: 'monospace', fontSize: big ? 14 : 11, color: sc(v1), minWidth: 30, textAlign: 'right', fontWeight: big ? 600 : 400 }}>
          {v1.toFixed(1)}
        </span>
        <div style={{ flex: 1, height: big ? 5 : 3, background: 'var(--c-bdr)', borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
          {/* P1: fills from center-left */}
          <div style={{ position: 'absolute', right: '50%', top: 0, height: '100%', width: `${Math.min(v1 / 10, 1) * 50}%`, background: '#00d68f', borderRadius: '2px 0 0 2px' }} />
          {/* P2: fills from center-right */}
          <div style={{ position: 'absolute', left: '50%', top: 0, height: '100%', width: `${Math.min(v2 / 10, 1) * 50}%`, background: c2, borderRadius: '0 2px 2px 0' }} />
          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--c-bdr2)' }} />
        </div>
        <span style={{ fontFamily: 'monospace', fontSize: big ? 14 : 11, color: sc(v2), minWidth: 30, fontWeight: big ? 600 : 400 }}>
          {v2.toFixed(1)}
        </span>
      </div>
    </div>
  )
}

function RBar({ label, v, c }: { label: string; v: number; c: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <span style={{ fontSize: 11, color: 'var(--c-t3)', minWidth: 44 }}>{label}</span>
      <div style={{ flex: 1, height: 2, background: 'var(--c-bdr)', borderRadius: 1, position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(v / 10, 1) * 100}%`, background: c, borderRadius: 1, transition: 'width 0.4s' }} />
      </div>
      <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 500, color: sc(v), minWidth: 30, textAlign: 'right' }}>{v.toFixed(1)}</span>
    </div>
  )
}

function SmallRBar({ label, v, c }: { label: string; v: number; c: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{ fontSize: 10, color: 'var(--c-t4)', minWidth: 44 }}>{label}</span>
      <div style={{ flex: 1, height: 2, background: 'var(--c-bdr)', borderRadius: 1, position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(v / 10, 1) * 100}%`, background: c, borderRadius: 1 }} />
      </div>
      <span style={{ fontFamily: 'monospace', fontSize: 10, color: sc(v), minWidth: 28, textAlign: 'right' }}>{v.toFixed(1)}</span>
    </div>
  )
}

function WSlider({ label, c, v, onChange }: { label: string; c: string; v: number; onChange: (x: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <span style={{ fontSize: 11, color: 'var(--c-t3)', minWidth: 44 }}>{label}</span>
      <input type="range" min={0} max={2} step={0.1} value={v}
        onChange={e => onChange(parseFloat(e.target.value))} style={{ flex: 1, accentColor: c }} />
      <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--c-t3)', minWidth: 30, textAlign: 'right' }}>{v.toFixed(1)}×</span>
    </div>
  )
}

function G2({ items }: { items: [string, string | number][] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px 14px' }}>
      {items.map(([k, v]) => (
        <div key={k}>
          <div style={{ fontSize: 9, color: 'var(--c-t4)', marginBottom: 1 }}>{k}</div>
          <div style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--c-t2)', fontWeight: 400 }}>{v}</div>
        </div>
      ))}
    </div>
  )
}

function MiniHeatmap({ cells, hex }: { cells: HeatmapCell[]; hex: string }) {
  // Accept any hex color — extract rgb for rgba usage
  const rgb = hex === '#00d68f' ? '0,214,143'
    : hex === '#ff6b35' ? '255,107,53'
    : hex === '#9b59ff' ? '155,89,255'
    : '0,214,143'
  const max = Math.max(...cells.map(c => c.intensity), 0.01)
  return (
    <svg viewBox="0 0 120 80" style={{ width: '100%', display: 'block', borderRadius: 2 }} preserveAspectRatio="xMidYMid meet">
      <rect width={120} height={80} style={{ fill: 'var(--c-pit)' }} />
      <line x1={60} y1={0} x2={60} y2={80} style={{ stroke: 'var(--c-pln)' }} strokeWidth={0.5} />
      {cells.map(c => (
        <rect key={`${c.cx}-${c.cy}`} x={c.x0} y={c.y0} width={5} height={5}
          fill={`rgba(${rgb},${(c.intensity / max) * 0.8})`} />
      ))}
    </svg>
  )
}

function sc(s: number): string {
  if (s >= 7) return '#00d68f'
  if (s >= 5) return '#f5c842'
  if (s >= 3) return '#ff6b35'
  return '#ff4757'
}
