'use client'

import { useMemo } from 'react'
import type { Pass } from '@/lib/types'

const W = 120, H = 80
const COLS = 8, ROWS = 5
const CELL_W = W / COLS, CELL_H = H / ROWS

const PLAYER_COLORS = [
  { main: 'rgba(0,214,143,0.7)', dim: 'rgba(0,214,143,0.25)', border: 'rgba(0,214,143,0.9)', glow: 'rgba(0,214,143,0.4)' },
  { main: 'rgba(155,89,255,0.7)', dim: 'rgba(155,89,255,0.25)', border: 'rgba(155,89,255,0.9)', glow: 'rgba(155,89,255,0.4)' },
  { main: 'rgba(245,200,66,0.7)', dim: 'rgba(245,200,66,0.25)', border: 'rgba(245,200,66,0.9)', glow: 'rgba(245,200,66,0.4)' },
  { main: 'rgba(255,107,53,0.7)', dim: 'rgba(255,107,53,0.25)', border: 'rgba(255,107,53,0.9)', glow: 'rgba(255,107,53,0.4)' },
]

interface PassGroup {
  passes: Pass[]
  playerIdx: number
  playerName: string
}

function PitchLines() {
  return (
    <g stroke="var(--c-pln)" strokeWidth={0.4} fill="none">
      <rect x={0} y={0} width={W} height={H} stroke="var(--c-pln2)" />
      <line x1={W/2} y1={0} x2={W/2} y2={H} stroke="var(--c-pln2)" strokeWidth={0.5} />
      <circle cx={W/2} cy={H/2} r={9.15} />
      <rect x={0} y={18} width={18} height={44} />
      <rect x={0} y={30} width={6} height={20} />
      <rect x={102} y={18} width={18} height={44} />
      <rect x={114} y={30} width={6} height={20} />
      <rect x={-2} y={36} width={2} height={8} />
      <rect x={120} y={36} width={2} height={8} />
    </g>
  )
}

interface Summary {
  cx: number; cy: number
  ex: number; ey: number
  count: number
  weight: number
  keyPassRatio: number
  hasKeyPasses: boolean
}

function summarizePasses(passes: Pass[]): Summary[] {
  const zoneMap = new Map<number, { sx: number; sy: number; ex: number; ey: number; count: number; weight: number; keyCount: number }>()

  passes.forEach(p => {
    if (p.x == null || p.end_x == null) return
    const col = Math.max(0, Math.min(COLS - 1, Math.floor(p.x / CELL_W)))
    const row = Math.max(0, Math.min(ROWS - 1, Math.floor(p.y / CELL_H)))
    const key = row * COLS + col

    let entry = zoneMap.get(key)
    if (!entry) {
      entry = { sx: 0, sy: 0, ex: 0, ey: 0, count: 0, weight: 0, keyCount: 0 }
      zoneMap.set(key, entry)
    }
    entry.sx += p.x
    entry.sy += p.y
    entry.ex += p.end_x
    entry.ey += p.end_y
    entry.count += 1
    
    // Weight: key passes (switch, cross, through ball) get counted more
    const isKey = !!(p.pass_switch || p.pass_cross || p.pass_through_ball)
    entry.weight += isKey ? 3 : 1
    if (isKey) entry.keyCount += 1
  })

  const summaries: Summary[] = []
  zoneMap.forEach((entry, key) => {
    if (entry.count < 3) return
    const col = key % COLS
    const row = Math.floor(key / COLS)
    summaries.push({
      cx: entry.sx / entry.count,
      cy: entry.sy / entry.count,
      ex: entry.ex / entry.count,
      ey: entry.ey / entry.count,
      count: entry.count,
      weight: entry.weight / entry.count,
      keyPassRatio: entry.keyCount / entry.count,
      hasKeyPasses: entry.keyCount > 0,
    })
  })
  return summaries
}

export type PassFocus = 'all' | number

export function PassNetworkPanel({
  groups,
  focusPlayerId,
  onFocusChange,
}: {
  groups: PassGroup[]
  focusPlayerId: PassFocus
  onFocusChange: (id: PassFocus) => void
}) {
  const allSummaries = useMemo(() => groups.map(g => ({
    playerIdx: g.playerIdx,
    playerName: g.playerName,
    summaries: summarizePasses(g.passes),
  })), [groups])

  const stats = useMemo(() => {
    const total = groups.reduce((s, g) => s + g.passes.length, 0)
    const completed = groups.reduce((s, g) => s + g.passes.filter(p => p.completed).length, 0)
    const key = groups.reduce((s, g) => s + g.passes.filter(p => p.pass_switch || p.pass_cross || p.pass_through_ball).length, 0)
    return { total, completed, key }
  }, [groups])

  if (!groups.length || !groups.some(g => g.passes.length > 0)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <span style={{ fontSize: 10, color: 'var(--c-t5)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Sin datos — selecciona jugador(es)
        </span>
      </div>
    )
  }

  const pad = 3
  const viewBox = `${-pad} ${-pad} ${W + pad * 2} ${H + pad * 2}`
  const maxWeight = Math.max(...allSummaries.flatMap(s => s.summaries.map(sm => sm.weight)), 0.01)
  const maxKeyRatio = Math.max(...allSummaries.flatMap(s => s.summaries.map(sm => sm.keyPassRatio)), 0.01)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--c-bg)' }}>
      {/* Stats bar */}
      <div style={{
        display: 'flex', gap: 12, padding: '4px 12px',
        borderBottom: '1px solid var(--c-bdr)', flexShrink: 0, background: 'var(--c-sur1)',
        alignItems: 'center',
      }}>
        <Chip label="Total" val={stats.total} />
        <Chip label="Compl." val={stats.completed} color="var(--c-acc)" />
        <Chip label="Clave" val={stats.key} color="var(--c-yel)" />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
          {groups.map(g => (
            <button key={g.playerIdx} onClick={() => onFocusChange(focusPlayerId === g.playerIdx ? 'all' : g.playerIdx)}
              style={{
                padding: '2px 7px', fontSize: 8, letterSpacing: '0.05em',
                color: focusPlayerId === g.playerIdx ? '#fff' : 'var(--c-t4)',
                background: focusPlayerId === g.playerIdx ? PLAYER_COLORS[g.playerIdx % PLAYER_COLORS.length].main : 'transparent',
                border: `1px solid ${PLAYER_COLORS[g.playerIdx % PLAYER_COLORS.length].border}`,
                borderRadius: 2, cursor: 'pointer',
              }}>
              {g.playerName.split(' ').slice(-1)[0]}
            </button>
          ))}
          <button onClick={() => onFocusChange('all')} style={{
            padding: '2px 7px', fontSize: 8, letterSpacing: '0.05em',
            color: focusPlayerId === 'all' ? 'var(--c-t1)' : 'var(--c-t4)',
            background: focusPlayerId === 'all' ? 'var(--c-sur2)' : 'transparent',
            border: '1px solid var(--c-bdr2)', borderRadius: 2, cursor: 'pointer',
          }}>
            Ambos
          </button>
        </div>
      </div>

      {/* SVG pitch */}
      <div style={{ flex: 1, padding: '4px 8px', overflow: 'hidden' }}>
        <svg viewBox={viewBox} style={{ width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid meet">
          <defs>
            {/* Glow filter for key passes */}
            <filter id="keyGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          
          <rect x={-pad} y={-pad} width={W + pad * 2} height={H + pad * 2} fill="var(--c-pit)" />
          <PitchLines />

          {/* Draw grid zones (subtle) */}
          {Array.from({ length: COLS + 1 }, (_, i) => (
            <line key={`vg-${i}`} x1={i * CELL_W} y1={0} x2={i * CELL_W} y2={H}
              stroke="var(--c-pln)" strokeWidth={0.3} opacity={0.15} />
          ))}
          {Array.from({ length: ROWS + 1 }, (_, i) => (
            <line key={`hg-${i}`} x1={0} y1={i * CELL_H} x2={W} y2={i * CELL_H}
              stroke="var(--c-pln)" strokeWidth={0.3} opacity={0.15} />
          ))}

          {/* Summarized pass vectors */}
          {allSummaries.map(s => {
            const color = PLAYER_COLORS[s.playerIdx % PLAYER_COLORS.length]
            return s.summaries.map((sm, i) => {
              const show = focusPlayerId === 'all' || focusPlayerId === s.playerIdx
              const opacity = (sm.weight / maxWeight) * 0.85 + 0.15
              const strokeW = Math.max(0.5, (sm.weight / maxWeight) * 3)
              const dx = sm.ex - sm.cx, dy = sm.ey - sm.cy
              const len = Math.sqrt(dx * dx + dy * dy)
              if (len < 0.5) return null

              // Highlight key pass zones
              const isKeyZone = sm.keyPassRatio > 0.3
              const keyOpacity = isKeyZone ? 0.15 + (sm.keyPassRatio / maxKeyRatio) * 0.3 : 0

              return (
                <g key={`${s.playerIdx}-${i}`} opacity={show ? 1 : 0.25}>
                  {/* Key pass zone highlight */}
                  {isKeyZone && (
                    <circle
                      cx={sm.cx}
                      cy={sm.cy}
                      r={Math.max(3, strokeW * 2)}
                      fill={color.glow}
                      opacity={keyOpacity}
                      filter="url(#keyGlow)"
                    />
                  )}
                  
                  {/* Base line */}
                  <line x1={sm.cx} y1={sm.cy} x2={sm.ex} y2={sm.ey}
                    stroke={isKeyZone ? color.border : color.main}
                    strokeWidth={strokeW}
                    opacity={opacity}
                    strokeLinecap="round"
                    filter={isKeyZone ? "url(#keyGlow)" : undefined}
                  />
                  
                  {/* Arrowhead */}
                  <circle cx={sm.ex} cy={sm.ey} r={Math.max(0.6, strokeW * 0.4)}
                    fill={isKeyZone ? color.border : color.main}
                    opacity={opacity}
                  />
                  
                  {/* Origin dot */}
                  <circle cx={sm.cx} cy={sm.cy} r={Math.max(0.8, strokeW * 0.5)}
                    fill={color.border}
                    opacity={opacity + 0.1}
                  />
                  
                  {/* Key pass indicator */}
                  {isKeyZone && (
                    <circle cx={sm.cx} cy={sm.cy} r={Math.max(1.2, strokeW * 0.7)}
                      fill="none"
                      stroke={color.border}
                      strokeWidth={0.8}
                      opacity={0.9}
                    />
                  )}
                  
                  {/* Size indicator */}
                  <text x={sm.cx - 2} y={sm.cy - 2} fontSize={5} fill={color.border} opacity={0.6}>
                    {sm.count}
                  </text>
                </g>
              )
            })
          })}
        </svg>
      </div>

      {/* Legend */}
      <div style={{
        padding: '3px 12px', borderTop: '1px solid var(--c-bdr)', flexShrink: 0,
        display: 'flex', gap: 10, alignItems: 'center', background: 'var(--c-sur1)',
        fontSize: 8, color: 'var(--c-t4)',
      }}>
        {groups.map(g => (
          <span key={g.playerIdx} style={{ color: PLAYER_COLORS[g.playerIdx % PLAYER_COLORS.length].border }}>
            ● {g.playerName.split(' ').slice(-1)[0]} ({g.passes.length})
          </span>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 7, color: 'var(--c-t5)' }}>
          Línea ≈ dirección promedio · grosor ≈ importancia · ○ = zona con pases clave
        </span>
      </div>
    </div>
  )
}

function Chip({ label, val, color = 'var(--c-t3)' }: { label: string; val: string | number; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ fontSize: 7, color: 'var(--c-t5)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontFamily: 'monospace', fontSize: 11, color, fontWeight: 500 }}>{val}</span>
    </div>
  )
}
