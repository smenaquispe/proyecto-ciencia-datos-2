'use client'

import { useEffect, useState } from 'react'
import { useDashboard } from '@/store/store'
import { api } from '@/lib/api'
import type { Match } from '@/lib/types'

export function Sidebar() {
  const {
    countries, competitions, matches,
    selectedCountry, selectedCompetition, selectedMatch, selectedPlayer,
    lineupData,
    setCountry, setCompetition, setMatch, setPlayer,
    setCompetitions, setMatches,
  } = useDashboard()

  const [expandedComp, setExpandedComp] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedCountry) return
    api.competitions(selectedCountry).then(d => setCompetitions(d.competitions)).catch(console.error)
  }, [selectedCountry])

  useEffect(() => {
    if (!selectedCompetition) return
    api.matches(selectedCompetition.competition_id, selectedCompetition.season_id)
      .then(d => setMatches(d.matches)).catch(console.error)
  }, [selectedCompetition?.competition_id, selectedCompetition?.season_id])

  const compGroups = competitions.reduce<Record<string, typeof competitions>>((acc, c) => {
    acc[c.competition_name] = [...(acc[c.competition_name] ?? []), c]
    return acc
  }, {})

  const homeTeam = lineupData?.teams.find(t => t.team_id === lineupData.match.home_team_id)
  const awayTeam = lineupData?.teams.find(t => t.team_id !== lineupData.match.home_team_id)

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden',
      background: 'var(--c-bg)', borderRight: '1px solid var(--c-bdr)',
    }}>
      {/* Brand */}
      <div style={{
        height: 46, borderBottom: '1px solid var(--c-bdr)',
        display: 'flex', alignItems: 'center', padding: '0 16px', gap: 6, flexShrink: 0,
        background: 'var(--c-sur1)',
      }}>
        <span style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--c-t4)', fontWeight: 500 }}>
          Scout
        </span>
        <span style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--c-acc)', fontWeight: 400 }}>
          Analytics
        </span>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>

        {/* Country */}
        <Block label="País">
          <select value={selectedCountry ?? ''} onChange={e => setCountry(e.target.value || null)}
            style={{
              width: '100%', background: 'var(--c-sur2)', border: '1px solid var(--c-bdr)',
              color: 'var(--c-t2)', fontSize: 12, padding: '6px 8px', borderRadius: 3, outline: 'none', cursor: 'pointer',
            }}>
            <option value="">Seleccionar país...</option>
            {countries.map(c => (
              <option key={c.country_name} value={c.country_name}>
                {c.country_name} ({c.matches})
              </option>
            ))}
          </select>
        </Block>

        {/* Competitions */}
        {selectedCountry && Object.keys(compGroups).length > 0 && (
          <Block label="Competición / Temporada">
            {Object.entries(compGroups).map(([name, seasons]) => (
              <div key={name}>
                <button
                  onClick={() => setExpandedComp(expandedComp === name ? null : name)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '5px 0', fontSize: 12,
                    color: expandedComp === name ? 'var(--c-t1)' : 'var(--c-t3)',
                    display: 'flex', alignItems: 'center', gap: 6, transition: 'color 0.15s',
                  }}>
                  <Chevron open={expandedComp === name} />
                  {name}
                </button>
                {expandedComp === name && (
                  <div style={{ paddingLeft: 16 }}>
                    {seasons.map(s => {
                      const isSel = selectedCompetition?.season_id === s.season_id && selectedCompetition?.competition_id === s.competition_id
                      return (
                        <button key={`${s.competition_id}-${s.season_id}`} onClick={() => setCompetition(s)}
                          style={{
                            display: 'block', width: '100%', textAlign: 'left', padding: '3px 0', fontSize: 12,
                            color: isSel ? 'var(--c-acc)' : 'var(--c-t4)',
                            fontWeight: isSel ? 500 : 400, transition: 'color 0.15s',
                          }}>
                          {s.season_name}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </Block>
        )}

        {/* Matches */}
        {matches.length > 0 && (
          <Block label={`Partidos — ${matches.length}`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {matches.map(m => (
                <MatchRow key={m.match_id} match={m}
                  selected={selectedMatch?.match_id === m.match_id}
                  onClick={() => setMatch(m)} />
              ))}
            </div>
          </Block>
        )}

        {/* Home team players */}
        {homeTeam && (
          <Block label={homeTeam.team_name}>
            <PlayerList
              players={homeTeam.players.map(p => ({ ...p, team_id: homeTeam.team_id, team_name: homeTeam.team_name }))}
              selectedId={selectedPlayer?.player_id ?? null}
              color="var(--c-acc)"
              onClick={p => setPlayer(selectedPlayer?.player_id === p.player_id ? null :
                { player_id: p.player_id, player_name: p.player_name, team_id: p.team_id, team_name: p.team_name, position_name: p.position_name, jersey_number: p.jersey_number }
              )}
            />
          </Block>
        )}

        {/* Away team players */}
        {awayTeam && (
          <Block label={awayTeam.team_name}>
            <PlayerList
              players={awayTeam.players.map(p => ({ ...p, team_id: awayTeam.team_id, team_name: awayTeam.team_name }))}
              selectedId={selectedPlayer?.player_id ?? null}
              color="var(--c-org)"
              onClick={p => setPlayer(selectedPlayer?.player_id === p.player_id ? null :
                { player_id: p.player_id, player_name: p.player_name, team_id: p.team_id, team_name: p.team_name, position_name: p.position_name, jersey_number: p.jersey_number }
              )}
            />
          </Block>
        )}
      </div>
    </div>
  )
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--c-bdr)' }}>
      <div style={{ fontSize: 9, letterSpacing: '0.11em', textTransform: 'uppercase', color: 'var(--c-t4)', marginBottom: 8, fontWeight: 500 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function MatchRow({ match, selected, onClick }: { match: Match; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', gap: 2,
      width: '100%', textAlign: 'left', padding: '5px 7px',
      background: selected ? 'color-mix(in srgb, var(--c-acc) 8%, transparent)' : 'transparent',
      borderLeft: `2px solid ${selected ? 'var(--c-acc)' : 'transparent'}`,
      borderRadius: 2, transition: 'all 0.1s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: selected ? 'var(--c-t1)' : 'var(--c-t3)', fontWeight: selected ? 500 : 400 }}>
          {match.home_team_name}
          <span style={{ color: 'var(--c-t5)', margin: '0 4px' }}>vs</span>
          {match.away_team_name}
        </span>
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: selected ? 'var(--c-acc)' : 'var(--c-t4)', fontWeight: 500 }}>
          {match.home_score}–{match.away_score}
        </span>
      </div>
      <span style={{ fontSize: 9, color: 'var(--c-t5)' }}>
        {match.match_date}{match.match_week ? ` · J${match.match_week}` : ''}{match.match_status_360 === 'available' ? ' · 360°' : ''}
      </span>
    </button>
  )
}

function PlayerList({
  players, selectedId, color, onClick,
}: {
  players: (import('@/lib/types').Player & { team_id: number; team_name: string })[]
  selectedId: number | null
  color: string
  onClick: (p: import('@/lib/types').Player & { team_id: number; team_name: string }) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {[...players].sort((a, b) => a.position_id - b.position_id).map(p => {
        const isSel = selectedId === p.player_id
        return (
          <button key={p.player_id} onClick={() => onClick(p)} style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '3px 6px',
            background: isSel ? 'color-mix(in srgb, var(--c-acc) 7%, transparent)' : 'transparent',
            borderLeft: `2px solid ${isSel ? color : 'transparent'}`,
            borderRadius: 2, width: '100%', textAlign: 'left', transition: 'all 0.1s',
          }}>
            <span style={{ fontFamily: 'monospace', fontSize: 10, color: isSel ? color : 'var(--c-t5)', minWidth: 16, textAlign: 'right' }}>
              {p.jersey_number}
            </span>
            <span style={{ flex: 1, fontSize: 12, color: isSel ? 'var(--c-t1)' : 'var(--c-t3)', fontWeight: isSel ? 500 : 400 }}>
              {p.player_name}
            </span>
            <span style={{ fontSize: 8, color: 'var(--c-t5)' }}>
              {p.position_name.split(' ').map((w: string) => w[0]).join('')}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
      <path d={open ? 'M1 2.5L4 5.5L7 2.5' : 'M2.5 1L5.5 4L2.5 7'}
        stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}
