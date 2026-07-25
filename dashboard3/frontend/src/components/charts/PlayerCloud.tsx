'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { useDashboard } from '@/store/store'
import type { FcmPlayer, SelectedPlayer } from '@/lib/types'

const CLUSTER_COLORS = ['#00d68f', '#4d9eff', '#f5c842', '#ff6b35', '#9b59ff', '#ff4757', '#00bcd4', '#e91e63']
const P2_COLOR = '#9b59ff'

export function PlayerCloud() {
  const {
    fcmPlayers, selectedPlayer, selectedPlayer2,
    setPlayer, setPlayer2, lineupData, loading,
  } = useDashboard()

  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 400, h: 300 })
  const [hovered, setHovered] = useState<FcmPlayer | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(([e]) => {
      setDims({ w: e.contentRect.width, h: e.contentRect.height })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const PAD = 24
  const W = dims.w - PAD * 2
  const H = dims.h - PAD * 2

  // FCM coords are [-1, 1]; map to SVG space
  const px = (x: number) => PAD + ((x + 1) / 2) * W
  const py = (y: number) => PAD + ((1 - (y + 1) / 2)) * H

  const lookupLineup = useCallback((player_id: number) =>
    lineupData?.teams
      .flatMap(t => t.players.map(p => ({ ...p, team_id: t.team_id, team_name: t.team_name })))
      .find(p => p.player_id === player_id),
    [lineupData]
  )

  const handleClick = useCallback((fp: FcmPlayer) => {
    const lineup = lookupLineup(fp.player_id)
    const sp: SelectedPlayer = {
      player_id: fp.player_id, player_name: fp.player_name,
      team_id: fp.team_id, team_name: fp.team_name,
      position_name: lineup?.position_name ?? '',
      jersey_number: lineup?.jersey_number ?? 0,
    }

    const isP1 = selectedPlayer?.player_id === fp.player_id
    const isP2 = selectedPlayer2?.player_id === fp.player_id

    if (isP1) {
      // Deselect P1 — promote P2 if exists
      setPlayer(selectedPlayer2 ? { ...selectedPlayer2 } : null)
      setPlayer2(null)
    } else if (isP2) {
      setPlayer2(null)
    } else if (!selectedPlayer) {
      setPlayer(sp)
    } else {
      setPlayer2(sp)  // always replace P2 slot
    }
  }, [selectedPlayer, selectedPlayer2, setPlayer, setPlayer2, lookupLineup])

  const isLoading = loading['fcm']

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, background: 'var(--c-bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '4px 12px',
        borderBottom: '1px solid var(--c-bdr)', flexShrink: 0, background: 'var(--c-sur1)',
      }}>
        <span style={{ fontSize: 8, color: 'var(--c-t4)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Fuzzy C-Means · {fcmPlayers.length} jugadores
        </span>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', alignItems: 'center' }}>
          {CLUSTER_COLORS.slice(0, 4).map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />
              <span style={{ fontSize: 7, color: 'var(--c-t5)' }}>C{i + 1}</span>
            </div>
          ))}
        </div>
        {isLoading && <span style={{ fontSize: 8, color: 'var(--c-t5)' }}>Calculando...</span>}
      </div>

      {/* Scatter SVG */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}
        onMouseMove={e => {
          const rect = e.currentTarget.getBoundingClientRect()
          setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
        }}
        onMouseLeave={() => setHovered(null)}
      >
        <svg width={dims.w} height={dims.h - 28} style={{ display: 'block', cursor: 'crosshair' }}>
          {/* Grid lines */}
          <line x1={dims.w / 2} y1={PAD} x2={dims.w / 2} y2={dims.h - PAD - 28}
            stroke="var(--c-bdr)" strokeWidth={0.5} strokeDasharray="3 3" />
          <line x1={PAD} y1={(dims.h - 28) / 2} x2={dims.w - PAD} y2={(dims.h - 28) / 2}
            stroke="var(--c-bdr)" strokeWidth={0.5} strokeDasharray="3 3" />

          {/* Axis labels */}
          <text x={dims.w - PAD + 2} y={(dims.h - 28) / 2 + 3} fontSize={7} fill="var(--c-t5)" textAnchor="start">Pases+</text>
          <text x={(dims.w) / 2} y={PAD - 4} fontSize={7} fill="var(--c-t5)" textAnchor="middle">Overall+</text>

          {/* Points */}
          {fcmPlayers.map(fp => {
            const x = px(fp.x)
            const y = py(fp.y)
            const isP1 = selectedPlayer?.player_id === fp.player_id
            const isP2 = selectedPlayer2?.player_id === fp.player_id
            const isHov = hovered?.player_id === fp.player_id
            const maxMem = Math.max(...fp.memberships)
            const clusterColor = CLUSTER_COLORS[fp.cluster] ?? '#666'
            const r = isP1 || isP2 ? 6 : isHov ? 5 : 4

            return (
              <g key={fp.player_id} onClick={() => handleClick(fp)}
                onMouseEnter={() => setHovered(fp)} onMouseLeave={() => setHovered(null)}
                style={{ cursor: 'pointer' }}>
                {/* Outer ring for selected */}
                {isP1 && <circle cx={x} cy={y} r={10} fill="none" stroke={clusterColor} strokeWidth={1.5} opacity={0.5} />}
                {isP2 && <circle cx={x} cy={y} r={10} fill="none" stroke={P2_COLOR} strokeWidth={1.5} opacity={0.7} strokeDasharray="3 2" />}
                {/* Main dot */}
                <circle cx={x} cy={y} r={r}
                  fill={isP2 ? P2_COLOR : clusterColor}
                  opacity={isP1 || isP2 ? 1 : 0.4 + maxMem * 0.55}
                  stroke={isP1 ? '#fff' : isP2 ? '#fff' : 'none'}
                  strokeWidth={isP1 || isP2 ? 1.2 : 0}
                />
              </g>
            )
          })}

          {/* Selection labels */}
          {fcmPlayers.filter(fp => selectedPlayer?.player_id === fp.player_id || selectedPlayer2?.player_id === fp.player_id).map(fp => {
            const x = px(fp.x)
            const y = py(fp.y)
            const isP2 = selectedPlayer2?.player_id === fp.player_id
            const short = fp.player_name.split(' ').slice(-1)[0]
            return (
              <text key={`lbl-${fp.player_id}`} x={x} y={y - 12} textAnchor="middle"
                fontSize={7.5} fill={isP2 ? P2_COLOR : '#fff'} fontWeight="600" fontFamily="system-ui">
                {short}
              </text>
            )
          })}
        </svg>

        {/* Hover tooltip */}
        {hovered && (
          <div style={{
            position: 'absolute',
            left: Math.min(mousePos.x + 10, dims.w - 140),
            top: Math.max(mousePos.y - 70, 4),
            background: 'var(--c-sur2)', border: '1px solid var(--c-bdr2)',
            borderRadius: 4, padding: '6px 8px', pointerEvents: 'none',
            zIndex: 20, minWidth: 130,
          }}>
            <div style={{ fontSize: 10, color: 'var(--c-t1)', fontWeight: 500, marginBottom: 4 }}>
              {hovered.player_name}
            </div>
            <div style={{ fontSize: 8, color: 'var(--c-t4)', marginBottom: 3 }}>{hovered.team_name}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '3px 6px' }}>
              {[
                { k: 'Pases', v: hovered.pass_score, c: '#00d68f' },
                { k: 'Duelos', v: hovered.duel_score, c: '#4d9eff' },
                { k: 'Tiros', v: hovered.shot_score, c: '#ff6b35' },
              ].map(({ k, v, c }) => (
                <div key={k}>
                  <div style={{ fontSize: 7, color: 'var(--c-t5)' }}>{k}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 10, color: c, fontWeight: 600 }}>{v.toFixed(1)}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 4, fontSize: 8, color: 'var(--c-t4)' }}>
              Cluster {hovered.cluster + 1} · memb. {(Math.max(...hovered.memberships) * 100).toFixed(0)}%
            </div>
          </div>
        )}
      </div>

      {/* Bottom legend */}
      <div style={{
        padding: '3px 12px', borderTop: '1px solid var(--c-bdr)', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 10, background: 'var(--c-sur1)',
      }}>
        {selectedPlayer && (
          <span style={{ fontSize: 8, color: '#fff' }}>
            P1: <span style={{ color: CLUSTER_COLORS[fcmPlayers.find(f => f.player_id === selectedPlayer.player_id)?.cluster ?? 0] }}>{selectedPlayer.player_name.split(' ').slice(-1)[0]}</span>
          </span>
        )}
        {selectedPlayer2 && (
          <span style={{ fontSize: 8, color: '#fff' }}>
            P2: <span style={{ color: P2_COLOR }}>{selectedPlayer2.player_name.split(' ').slice(-1)[0]}</span>
          </span>
        )}
        {!selectedPlayer && (
          <span style={{ fontSize: 8, color: 'var(--c-t5)' }}>Click = seleccionar · 2 clicks = comparar</span>
        )}
        {selectedPlayer && !selectedPlayer2 && (
          <span style={{ fontSize: 8, color: 'var(--c-t5)', marginLeft: 'auto' }}>Click otro para comparar</span>
        )}
        {selectedPlayer2 && (
          <span style={{ fontSize: 8, color: P2_COLOR, marginLeft: 'auto' }}>Modo comparación activo</span>
        )}
      </div>
    </div>
  )
}
