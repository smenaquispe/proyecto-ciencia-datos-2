'use client'

import { useState, useMemo, useCallback } from 'react'
import { useDashboard } from '@/store/store'
import type { Pass } from '@/lib/types'

const W = 120, H = 80

type FilterId = 'all' | 'completed' | 'incomplete' | 'pressure' | 'forward' | 'backward'

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all',        label: 'Todos' },
  { id: 'completed',  label: 'Completados' },
  { id: 'incomplete', label: 'Incompletos' },
  { id: 'pressure',   label: 'Bajo presión' },
  { id: 'forward',    label: 'Adelante' },
  { id: 'backward',   label: 'Atrás' },
]

function localFilter(p: Pass, filter: FilterId): boolean {
  switch (filter) {
    case 'completed':  return p.completed === true
    case 'incomplete': return p.completed === false
    case 'pressure':   return p.under_pressure === true
    case 'forward':    return p.forward === true
    case 'backward':   return p.forward === false
    default:           return true
  }
}

function passColor(p: Pass): string {
  if (!p.completed)     return 'rgba(255,71,87,0.8)'
  if (p.under_pressure) return 'rgba(245,200,66,0.75)'
  if (p.forward)        return 'rgba(0,214,143,0.75)'
  return 'rgba(100,150,220,0.65)'
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

function passColor2(p: Pass): string {
  if (!p.completed)     return 'rgba(200,89,255,0.75)'
  if (p.under_pressure) return 'rgba(155,89,255,0.65)'
  if (p.forward)        return 'rgba(155,89,255,0.55)'
  return 'rgba(100,89,255,0.5)'
}

export function PassNetwork() {
  const { passes, passes2, filteredPassIds, selectedPlayer2, loading } = useDashboard()
  const [filter, setFilter] = useState<FilterId>('all')
  const [hoveredPass, setHoveredPass] = useState<Pass | null>(null)

  const hasParallelFilter = filteredPassIds.size > 0

  // Compute which passes are "active" (show fully) vs "dimmed"
  const isActive = useCallback((p: Pass): boolean => {
    const parallelOk = !hasParallelFilter || (p.event_id ? filteredPassIds.has(p.event_id) : false)
    return localFilter(p, filter) && parallelOk
  }, [filter, filteredPassIds, hasParallelFilter])

  const activePasses = useMemo(() => passes.filter(p => isActive(p)), [passes, isActive])
  const pressurePasses = useMemo(() =>
    activePasses.filter(p => p.under_pressure && p.pressure_source_x != null),
    [activePasses]
  )

  const stats = useMemo(() => ({
    total:      passes.length,
    completed:  passes.filter(p => p.completed).length,
    pressure:   passes.filter(p => !!p.under_pressure).length,
    forward:    passes.filter(p => p.forward && p.completed).length,
    active:     activePasses.length,
  }), [passes, activePasses])

  const isLoading = loading['player'] || loading['player2']
  const compareMode = !!selectedPlayer2 && passes2.length > 0
  const pad = 3
  const viewBox = `${-pad} ${-pad} ${W + pad * 2} ${H + pad * 2}`
  const showPressure = filter === 'pressure' || filter === 'all'

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--c-bg)' }}>
      {/* Stats bar */}
      <div style={{
        display: 'flex', gap: 16, padding: '5px 14px',
        borderBottom: '1px solid var(--c-bdr)', flexShrink: 0, alignItems: 'center',
        background: 'var(--c-sur1)',
      }}>
        <Chip label="Total" val={stats.total} />
        <Chip label="Compl." val={stats.completed} color="var(--c-acc)" />
        <Chip label="Presión" val={stats.pressure} color="var(--c-yel)" />
        <Chip label="Adelante" val={stats.forward} color="var(--c-blu)" />
        {filter !== 'all' && <Chip label="Filtrados" val={stats.active} color="var(--c-t2)" />}
        {isLoading && <span style={{ fontSize: 9, color: 'var(--c-t5)', marginLeft: 'auto' }}>...</span>}
      </div>

      {/* Filter bar */}
      <div style={{
        display: 'flex', gap: 3, padding: '5px 14px',
        borderBottom: '1px solid var(--c-bdr)', flexShrink: 0, alignItems: 'center',
        background: 'var(--c-sur1)',
      }}>
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            padding: '3px 8px', fontSize: 9,
            letterSpacing: '0.05em', textTransform: 'uppercase',
            color: filter === f.id ? 'var(--c-t1)' : 'var(--c-t4)',
            border: `1px solid ${filter === f.id ? 'var(--c-bdr2)' : 'var(--c-bdr)'}`,
            borderRadius: 2,
            background: filter === f.id ? 'var(--c-sur2)' : 'transparent',
            cursor: 'pointer', transition: 'all 0.1s',
            fontWeight: filter === f.id ? 500 : 400,
          }}>
            {f.label}
          </button>
        ))}
        {filter === 'pressure' && pressurePasses.length > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 8, color: 'var(--c-yel)', opacity: 0.7 }}>
            Origen de presión visible — punto rojo = presionador
          </span>
        )}
      </div>

      {/* SVG pass map */}
      <div style={{ flex: 1, padding: '4px 8px', overflow: 'hidden' }}>
        <svg
          viewBox={viewBox}
          style={{ width: '100%', height: '100%' }}
          preserveAspectRatio="xMidYMid meet"
        >
          <rect x={-pad} y={-pad} width={W + pad * 2} height={H + pad * 2} fill="var(--c-pit)" />
          <PitchLines />

          {/* Dimmed inactive passes */}
          {passes.map((p, i) => {
            if (isActive(p)) return null
            if (p.x == null || p.end_x == null) return null
            return (
              <line key={`dim-${p.event_id ?? i}`}
                x1={p.x} y1={p.y} x2={p.end_x} y2={p.end_y}
                stroke="var(--c-pln)" strokeWidth={0.3} opacity={0.4}
              />
            )
          })}

          {/* Pressure origin lines (when pressure filter active) */}
          {showPressure && pressurePasses.map((p, i) => (
            <g key={`pressline-${p.event_id ?? i}`}>
              {/* Dashed line from presser to passer */}
              <line
                x1={p.pressure_source_x!} y1={p.pressure_source_y!}
                x2={p.x} y2={p.y}
                stroke="rgba(255,71,87,0.35)"
                strokeWidth={0.7}
                strokeDasharray="1.2 0.8"
              />
              {/* Presser dot */}
              <circle
                cx={p.pressure_source_x!} cy={p.pressure_source_y!} r={1.6}
                fill="rgba(255,71,87,0.75)"
              />
            </g>
          ))}

          {/* Active passes */}
          {passes.map((p, i) => {
            if (!isActive(p)) return null
            if (p.x == null || p.end_x == null) return null
            const color = passColor(p)
            const dx = p.end_x - p.x, dy = p.end_y - p.y
            const len = Math.sqrt(dx * dx + dy * dy)
            if (len < 0.1) return null
            const ax = p.x + dx * 0.82, ay = p.y + dy * 0.82
            const isHov = hoveredPass?.event_id === p.event_id

            return (
              <g key={`pass-${p.event_id ?? i}`}
                onMouseEnter={() => setHoveredPass(p)}
                onMouseLeave={() => setHoveredPass(null)}
              >
                <line x1={p.x} y1={p.y} x2={ax} y2={ay}
                  stroke={color}
                  strokeWidth={isHov ? 1.2 : 0.7}
                  strokeDasharray={!p.completed ? '1.5 0.8' : undefined}
                />
                {/* Arrowhead */}
                <circle cx={p.end_x} cy={p.end_y} r={0.8} fill={color} />
                {/* Invisible hit area */}
                <line x1={p.x} y1={p.y} x2={p.end_x} y2={p.end_y}
                  stroke="transparent" strokeWidth={4}
                />
              </g>
            )
          })}

          {/* Player 2 passes (overlay, purple) */}
          {compareMode && passes2.map((p, i) => {
            if (p.x == null || p.end_x == null) return null
            const dx = p.end_x - p.x, dy = p.end_y - p.y
            const len = Math.sqrt(dx * dx + dy * dy)
            if (len < 0.1) return null
            const ax = p.x + dx * 0.82, ay = p.y + dy * 0.82
            const color = passColor2(p)
            return (
              <g key={`p2-${p.event_id ?? i}`}>
                <line x1={p.x} y1={p.y} x2={ax} y2={ay}
                  stroke={color} strokeWidth={0.7}
                  strokeDasharray={!p.completed ? '1.5 0.8' : undefined}
                />
                <circle cx={p.end_x} cy={p.end_y} r={0.8} fill={color} />
              </g>
            )
          })}

          {/* Hovered pass: start dot + presser info */}
          {hoveredPass && (
            <circle cx={hoveredPass.x} cy={hoveredPass.y} r={1.5}
              fill={passColor(hoveredPass)} opacity={0.9}
            />
          )}
        </svg>
      </div>

      {/* Bottom: tooltip or legend */}
      <div style={{
        padding: '4px 14px', borderTop: '1px solid var(--c-bdr)', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 12, minHeight: 24,
        background: 'var(--c-sur1)',
      }}>
        {hoveredPass ? (
          <PassTooltip pass={hoveredPass} />
        ) : (
          <>
            <LegItem color="rgba(0,214,143,0.75)" label="Completado adelante" />
            <LegItem color="rgba(100,150,220,0.65)" label="Completado atrás" />
            <LegItem color="rgba(245,200,66,0.75)" label="Bajo presión" />
            <LegItem color="rgba(255,71,87,0.8)" label="Incompleto" dashed />
            {filter === 'pressure' && (
              <span style={{ marginLeft: 'auto', fontSize: 8, color: 'rgba(255,71,87,0.6)' }}>
                Punto rojo = origen presión · Línea punteada = dirección presión
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Chip({ label, val, color = 'var(--c-t3)' }: { label: string; val: number; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ fontSize: 8, color: 'var(--c-t5)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontFamily: 'monospace', fontSize: 12, color, fontWeight: 500 }}>{val}</span>
    </div>
  )
}

function LegItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <svg width={14} height={2}>
        <line x1={0} y1={1} x2={14} y2={1} stroke={color} strokeWidth={1.5}
          strokeDasharray={dashed ? '3 2' : undefined} />
      </svg>
      <span style={{ fontSize: 8, color: 'var(--c-t4)' }}>{label}</span>
    </div>
  )
}

function PassTooltip({ pass }: { pass: Pass }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontFamily: 'monospace', fontSize: 9, color: 'var(--c-t4)' }}>
        {pass.minute}'{String(pass.second).padStart(2, '0')}
      </span>
      <span style={{ fontSize: 9, color: pass.completed ? 'var(--c-acc)' : 'var(--c-red)', fontWeight: 500 }}>
        {pass.completed ? 'COMPLETO' : 'INCOMPLETO'}
      </span>
      {pass.pass_length && (
        <span style={{ fontFamily: 'monospace', fontSize: 9, color: 'var(--c-t3)' }}>
          {pass.pass_length.toFixed(1)}m
        </span>
      )}
      {pass.under_pressure && (
        <span style={{ fontSize: 8, color: 'var(--c-yel)', border: '1px solid var(--c-yel)', opacity: 0.7, padding: '0 4px', borderRadius: 1 }}>
          PRESIÓN
        </span>
      )}
      {pass.presser_name && (
        <span style={{ fontSize: 9, color: 'var(--c-red)', opacity: 0.7 }}>
          Presionado por: {pass.presser_name.split(' ').slice(-1)[0]}
        </span>
      )}
      {pass.pass_recipient_name && (
        <span style={{ fontSize: 9, color: 'var(--c-t4)' }}>
          → {pass.pass_recipient_name.split(' ').slice(-1)[0]}
        </span>
      )}
    </div>
  )
}
