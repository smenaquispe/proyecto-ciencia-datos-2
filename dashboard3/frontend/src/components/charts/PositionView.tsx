'use client'

import { useState, useMemo } from 'react'
import { useDashboard } from '@/store/store'
import type { PositionPattern } from '@/lib/types'

const POSITION_GROUPS = ['Todos', 'Portero', 'Defensa Central', 'Lateral', 'MF Defensivo', 'MF Central', 'MF Atacante', 'Extremo', 'Delantero']

const GROUP_COLORS: Record<string, string> = {
  'Portero':         '#9b59ff',
  'Defensa Central': '#4d9eff',
  'Lateral':         '#00c8ff',
  'MF Defensivo':    '#00d68f',
  'MF Central':      '#a0e870',
  'MF Atacante':     '#f5c842',
  'Extremo':         '#ff9b35',
  'Delantero':       '#ff6b35',
}

const METRICS: { key: keyof PositionPattern; label: string; color: string; isScore?: boolean }[] = [
  { key: 'pass_score',    label: 'Score Pases',   color: '#00d68f', isScore: true },
  { key: 'duel_score',    label: 'Score Duelos',  color: '#4d9eff', isScore: true },
  { key: 'shot_score',    label: 'Score Tiros',   color: '#ff6b35', isScore: true },
  { key: 'overall_score', label: 'Overall',       color: '#c0c0c0', isScore: true },
  { key: 'completion_score', label: 'Precisión',  color: '#00d68f' },
  { key: 'direction_score',  label: 'Dirección',  color: '#4d9eff' },
  { key: 'pressure_score',   label: 'Presión',    color: '#f5c842' },
]

function RadarChart({ data, color }: { data: number[]; color: string }) {
  const N = METRICS.length
  const R = 50, cx = 60, cy = 60
  const angles = Array.from({ length: N }, (_, i) => (i / N) * Math.PI * 2 - Math.PI / 2)

  const points = data.map((v, i) => {
    const r = (v / 10) * R
    return {
      x: cx + r * Math.cos(angles[i]),
      y: cy + r * Math.sin(angles[i]),
    }
  })

  const polygon = points.map(p => `${p.x},${p.y}`).join(' ')

  return (
    <svg viewBox="0 0 120 120" style={{ width: 120, height: 120 }}>
      {/* Grid circles */}
      {[0.25, 0.5, 0.75, 1].map(t => (
        <circle key={t} cx={cx} cy={cy} r={R * t}
          fill="none" stroke="#151515" strokeWidth={0.5} />
      ))}
      {/* Grid spokes */}
      {angles.map((a, i) => (
        <line key={i}
          x1={cx} y1={cy}
          x2={cx + R * Math.cos(a)} y2={cy + R * Math.sin(a)}
          stroke="#151515" strokeWidth={0.5}
        />
      ))}
      {/* Data polygon */}
      <polygon
        points={polygon}
        fill={`${color}20`}
        stroke={color}
        strokeWidth={0.8}
      />
      {/* Data points */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={1.5}
          fill={color} opacity={0.8}
        />
      ))}
      {/* Labels */}
      {angles.map((a, i) => {
        const lx = cx + (R + 8) * Math.cos(a)
        const ly = cy + (R + 8) * Math.sin(a)
        return (
          <text
            key={i}
            x={lx} y={ly + 1.5}
            textAnchor="middle"
            fontSize={4.5}
            fill="#2e2e2e"
            fontFamily="system-ui"
          >
            {METRICS[i].label.split(' ')[0]}
          </text>
        )
      })}
    </svg>
  )
}

export function PositionView() {
  const { positionPatterns, loading } = useDashboard()
  const [selectedGroup, setSelectedGroup] = useState('Todos')
  const [selectedPos, setSelectedPos] = useState<PositionPattern | null>(null)

  const filtered = useMemo(() => {
    if (selectedGroup === 'Todos') return positionPatterns
    return positionPatterns.filter(p => p.position_group === selectedGroup)
  }, [positionPatterns, selectedGroup])

  const isLoading = loading['lineup']

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Group filter */}
      <div style={{
        display: 'flex', gap: 3, padding: '8px 16px',
        borderBottom: '1px solid #111', flexShrink: 0, flexWrap: 'wrap', alignItems: 'center',
      }}>
        {POSITION_GROUPS.map(g => (
          <button
            key={g}
            onClick={() => setSelectedGroup(g)}
            style={{
              padding: '3px 8px', fontSize: 9,
              letterSpacing: '0.04em', textTransform: 'uppercase',
              color: selectedGroup === g ? '#c0c0c0' : '#2a2a2a',
              border: `1px solid ${selectedGroup === g ? (GROUP_COLORS[g] ?? '#333') : '#161616'}`,
              borderRadius: 2,
              background: selectedGroup === g ? `${GROUP_COLORS[g] ?? '#333'}15` : 'none',
              cursor: 'pointer', transition: 'all 0.1s',
            }}
          >
            {g}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 8, color: '#252525' }}>
          {filtered.length} posiciones
        </span>
        {isLoading && <span style={{ fontSize: 9, color: '#333' }}>Cargando...</span>}
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {/* Position list */}
        <div style={{
          width: 220, overflowY: 'auto',
          borderRight: '1px solid #111', flexShrink: 0,
        }}>
          {filtered
            .sort((a, b) => b.overall_score - a.overall_score)
            .map(pos => {
              const isSelected = selectedPos?.position_name === pos.position_name
              const color = GROUP_COLORS[pos.position_group] ?? '#555'
              return (
                <button
                  key={pos.position_name}
                  onClick={() => setSelectedPos(isSelected ? null : pos)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 14px',
                    width: '100%', textAlign: 'left',
                    background: isSelected ? `${color}10` : 'transparent',
                    borderLeft: `2px solid ${isSelected ? color : 'transparent'}`,
                    borderBottom: '1px solid #0d0d0d',
                    cursor: 'pointer', transition: 'all 0.1s',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: isSelected ? '#c0c0c0' : '#444', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {pos.position_name}
                    </div>
                    <div style={{ fontSize: 8, color: '#252525', letterSpacing: '0.04em' }}>
                      {pos.n_players} jugadores · {pos.total_passes} pases
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: scoreColor(pos.overall_score), fontWeight: 400 }}>
                      {pos.overall_score.toFixed(1)}
                    </span>
                    <div style={{ display: 'flex', gap: 2 }}>
                      <Dot score={pos.pass_score} color="#00d68f" />
                      <Dot score={pos.duel_score} color="#4d9eff" />
                      <Dot score={pos.shot_score} color="#ff6b35" />
                    </div>
                  </div>
                </button>
              )
            })}
        </div>

        {/* Detail panel */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {selectedPos ? (
            <PositionDetail pos={selectedPos} />
          ) : (
            <div style={{
              height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 9, color: '#252525', letterSpacing: '0.08em' }}>
                Selecciona una posición para ver el detalle
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PositionDetail({ pos }: { pos: PositionPattern }) {
  const color = GROUP_COLORS[pos.position_group] ?? '#555'
  const radarData = METRICS.map(m => (pos[m.key] as number) ?? 0)

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 300, color: '#d0d0d0', marginBottom: 4 }}>
          {pos.position_name}
        </h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color, opacity: 0.7 }}>{pos.position_group}</span>
          <span style={{ fontSize: 9, color: '#2a2a2a' }}>
            {pos.n_players} jugadores — {pos.player_names.join(', ')}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {/* Radar */}
        <div>
          <div style={{ fontSize: 9, color: '#252525', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Perfil de rendimiento
          </div>
          <RadarChart data={radarData} color={color} />
        </div>

        {/* Metrics grid */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 9, color: '#252525', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
            Métricas detalladas
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {METRICS.map(m => {
              const val = (pos[m.key] as number) ?? 0
              return (
                <div key={m.key as string} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 9, color: '#383838', minWidth: 90 }}>{m.label}</span>
                  <div style={{
                    flex: 1, height: 1.5, background: '#111', borderRadius: 1,
                    position: 'relative',
                  }}>
                    <div style={{
                      position: 'absolute', left: 0, top: 0,
                      height: '100%', width: `${Math.min(val / 10, 1) * 100}%`,
                      background: m.color, borderRadius: 1,
                    }} />
                  </div>
                  <span style={{ fontFamily: 'monospace', fontSize: 10, color: m.color, minWidth: 28, textAlign: 'right' }}>
                    {val.toFixed(1)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Count stats */}
      <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Pases',      val: pos.total_passes },
          { label: 'Completados',val: pos.completed_passes },
          { label: 'Duelos',     val: pos.total_duels },
          { label: 'Ganados',    val: pos.won_duels },
          { label: 'Tiros',      val: pos.total_shots },
          { label: 'A puerta',   val: pos.on_target },
          { label: 'Goles',      val: pos.goals },
          { label: 'Especiales', val: pos.special_passes },
        ].map(({ label, val }) => (
          <div key={label} style={{ padding: '8px 10px', background: '#0d0d0d', borderRadius: 2 }}>
            <div style={{ fontSize: 8, color: '#252525', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
              {label}
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 16, color: '#505050', fontWeight: 300 }}>
              {val}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Dot({ score, color }: { score: number; color: string }) {
  const opacity = score > 0 ? 0.2 + (score / 10) * 0.6 : 0.1
  return (
    <div style={{
      width: 5, height: 5, borderRadius: '50%',
      background: color, opacity,
    }} />
  )
}

function scoreColor(score: number): string {
  if (score >= 7) return '#00d68f'
  if (score >= 5) return '#f5c842'
  if (score >= 3) return '#ff6b35'
  return '#ff4757'
}
