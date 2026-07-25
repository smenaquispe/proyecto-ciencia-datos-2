'use client'

import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { useDashboard } from '@/store/store'
import type { ProjectionPlayer, FcmPlayer } from '@/lib/types'

const CLUSTER_COLORS = ['#00d68f', '#4d9eff', '#f5c842', '#ff6b35', '#9b59ff', '#ff4757', '#00bcd4', '#e91e63', '#7c3aed', '#14b8a6']
const POS_COLORS: Record<string, string> = {
  GK: '#e5c07b', DEF: '#61afef', DM: '#56b6c2', MID: '#98c379', FWD: '#e06c75',
}
const POS_GROUPS = ['GK', 'DEF', 'DM', 'MID', 'FWD']

export function ProjectionScatter() {
  const {
    algorithm, scatterPlayers, selectedPlayerIds, hoveredPlayerId,
    setSelectedPlayerIds, togglePlayerId, setHoveredPlayerId,
  } = useDashboard()

  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [dims, setDims] = useState({ w: 400, h: 400 })
  const [hoveredInfo, setHoveredInfo] = useState<(ProjectionPlayer | FcmPlayer) | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  
  // Zoom & Pan state
  const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  
  // Position filter
  const [posFilter, setPosFilter] = useState<Set<string>>(new Set(POS_GROUPS))

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(([e]) => {
      setDims({ w: e.contentRect.width, h: e.contentRect.height })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const isFcm = algorithm === 'fcm' || algorithm === 'aefcm' || algorithm === 'dec'
  const players = scatterPlayers as any[]

  const PAD = 28
  const W = dims.w - PAD * 2
  const H = dims.h - PAD * 2 - 28

  const xMin = players.length ? Math.min(...players.map(p => p.x)) : -1
  const xMax = players.length ? Math.max(...players.map(p => p.x)) : 1
  const yMin = players.length ? Math.min(...players.map(p => p.y)) : -1
  const yMax = players.length ? Math.max(...players.map(p => p.y)) : 1
  const xRng = Math.max(xMax - xMin, 0.01)
  const yRng = Math.max(yMax - yMin, 0.01)

  const px = (v: number) => PAD + ((v - xMin) / xRng) * W
  const py = (v: number) => PAD + ((v - yMin) / yRng) * H

  const handleClick = (p: any) => {
    togglePlayerId(p.player_id)
  }

  // Zoom with wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    
    const zoomFactor = e.deltaY < 0 ? 1.15 : 1 / 1.15
    const newK = Math.max(0.5, Math.min(8, transform.k * zoomFactor))
    
    // Zoom towards mouse position
    const newX = mouseX - (mouseX - transform.x) * (newK / transform.k)
    const newY = mouseY - (mouseY - transform.y) * (newK / transform.k)
    
    setTransform({ k: newK, x: newX, y: newY })
  }, [transform])

  // Pan with mouse drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && e.shiftKey) {
      setIsPanning(true)
      setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setTransform(t => ({ ...t, x: e.clientX - panStart.x, y: e.clientY - panStart.y }))
    }
    const rect = e.currentTarget.getBoundingClientRect()
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  const handleMouseUp = () => {
    setIsPanning(false)
  }

  const resetZoom = () => setTransform({ k: 1, x: 0, y: 0 })

  const togglePosFilter = (pos: string) => {
    setPosFilter(prev => {
      const next = new Set(prev)
      if (next.has(pos)) {
        next.delete(pos)
      } else {
        next.add(pos)
      }
      return next
    })
  }

  const filteredPlayers = useMemo(() => 
    isFcm ? players : players.filter(p => posFilter.has(p.pos_group)),
    [players, posFilter, isFcm]
  )

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Top bar with filters */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '5px 12px',
        borderBottom: '1px solid var(--c-bdr)', flexShrink: 0, background: 'var(--c-sur1)',
      }}>
        <span style={{ fontSize: 8, color: 'var(--c-t4)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500 }}>
          {isFcm ? (algorithm === 'aefcm' ? 'AE+FCM Clustering' : algorithm === 'dec' ? 'DEC Clustering' : 'FCM Clustering') : algorithm.toUpperCase()}
          <span style={{ color: 'var(--c-t5)', marginLeft: 6 }}>· {filteredPlayers.length} jugadores</span>
        </span>
        {!isFcm && (
          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', alignItems: 'center' }}>
            {POS_GROUPS.map(g => {
              const active = posFilter.has(g)
              return (
                <button
                  key={g}
                  onClick={() => togglePosFilter(g)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 3,
                    padding: '2px 6px', fontSize: 7, borderRadius: 2,
                    background: active ? POS_COLORS[g] + '20' : 'transparent',
                    border: `1px solid ${active ? POS_COLORS[g] : 'var(--c-bdr)'}`,
                    color: active ? POS_COLORS[g] : 'var(--c-t5)',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: active ? POS_COLORS[g] : 'var(--c-bdr2)' }} />
                  {g}
                </button>
              )
            })}
          </div>
        )}
        {isFcm && (
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', alignItems: 'center' }}>
            {CLUSTER_COLORS.slice(0, Math.min(6, players.length ? Math.max(...players.map((p: any) => p.cluster)) + 1 : 1)).map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />
                <span style={{ fontSize: 7, color: 'var(--c-t5)' }}>C{i + 1}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Zoom controls */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '3px 12px',
        borderBottom: '1px solid var(--c-bdr)', flexShrink: 0, background: 'var(--c-sur1)',
      }}>
        <button onClick={() => setTransform(t => ({ ...t, k: Math.min(8, t.k * 1.3) }))}
          style={{ width: 20, height: 20, fontSize: 12, color: 'var(--c-t3)', border: '1px solid var(--c-bdr)', borderRadius: 2, cursor: 'pointer' }}>
          +
        </button>
        <button onClick={() => setTransform(t => ({ ...t, k: Math.max(0.5, t.k / 1.3) }))}
          style={{ width: 20, height: 20, fontSize: 12, color: 'var(--c-t3)', border: '1px solid var(--c-bdr)', borderRadius: 2, cursor: 'pointer' }}>
          −
        </button>
        <button onClick={resetZoom}
          style={{ padding: '2px 8px', fontSize: 7, color: 'var(--c-t4)', border: '1px solid var(--c-bdr)', borderRadius: 2, cursor: 'pointer' }}>
          Reset
        </button>
        <span style={{ fontSize: 7, color: 'var(--c-t5)', marginLeft: 'auto' }}>
          {Math.round(transform.k * 100)}% · Shift+drag para mover
        </span>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}
        onMouseLeave={() => { setHoveredInfo(null); setHoveredPlayerId(null) }}
      >
        <svg
          ref={svgRef}
          width={dims.w}
          height={dims.h - 28}
          style={{ display: 'block', cursor: isPanning ? 'grabbing' : 'crosshair' }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
            {/* Grid */}
            <line x1={PAD} y1={(dims.h - 28) / 2} x2={dims.w - PAD} y2={(dims.h - 28) / 2}
              stroke="var(--c-bdr)" strokeWidth={0.5 / transform.k} strokeDasharray="3 3" />
            <line x1={dims.w / 2} y1={PAD} x2={dims.w / 2} y2={dims.h - PAD - 28}
              stroke="var(--c-bdr)" strokeWidth={0.5 / transform.k} strokeDasharray="3 3" />

            {filteredPlayers.map((p: any) => {
              const x = px(p.x)
              const y = py(p.y)
              const isSelected = selectedPlayerIds.includes(p.player_id)
              const isHov = hoveredPlayerId === p.player_id

              let color: string
              if (isFcm) {
                color = CLUSTER_COLORS[p.cluster] ?? '#666'
              } else {
                color = POS_COLORS[p.pos_group] ?? '#666'
              }

              const r = (isSelected ? 7 : isHov ? 5 : 3.5) / transform.k
              const opacity = isFcm && p.memberships
                ? 0.35 + Math.max(...(p.memberships as number[])) * 0.6
                : isSelected ? 1 : 0.5

              return (
                <g key={p.player_id} onClick={() => handleClick(p)}
                  onMouseEnter={() => { setHoveredInfo(p); setHoveredPlayerId(p.player_id) }}
                  onMouseLeave={() => { setHoveredInfo(null); setHoveredPlayerId(null) }}
                  style={{ cursor: 'pointer' }}
                >
                  {isSelected && (
                    <circle cx={x} cy={y} r={11 / transform.k} fill="none" stroke={color} strokeWidth={1.5 / transform.k} opacity={0.5} />
                  )}
                  <circle cx={x} cy={y} r={r}
                    fill={color}
                    opacity={opacity}
                    stroke={isSelected ? '#fff' : 'none'}
                    strokeWidth={isSelected ? 1.2 / transform.k : 0}
                  />
                </g>
              )
            })}

            {/* Selection labels */}
            {filteredPlayers.filter((p: any) => selectedPlayerIds.includes(p.player_id)).map((p: any) => (
              <text key={`lbl-${p.player_id}`} x={px(p.x)} y={py(p.y) - 12 / transform.k} textAnchor="middle"
                fontSize={7 / transform.k} fill="#fff" fontWeight="600" fontFamily="system-ui">
                {p.player_name.split(' ').slice(-1)[0]}
              </text>
            ))}
          </g>
        </svg>

        {/* Tooltip */}
        {hoveredInfo && (
          <div style={{
            position: 'absolute',
            left: Math.min(mousePos.x + 12, dims.w - 160),
            top: Math.max(mousePos.y - 80, 4),
            background: 'var(--c-sur2)', border: '1px solid var(--c-bdr2)',
            borderRadius: 4, padding: '6px 8px', pointerEvents: 'none',
            zIndex: 20, minWidth: 140,
          }}>
            <div style={{ fontSize: 10, color: 'var(--c-t1)', fontWeight: 500, marginBottom: 3 }}>
              {hoveredInfo.player_name}
            </div>
            <div style={{ fontSize: 8, color: 'var(--c-t4)', marginBottom: 2 }}>
              {hoveredInfo.dominant_position} · {hoveredInfo.pos_group}
            </div>
            <div style={{ fontSize: 8, color: 'var(--c-t5)' }}>
              {hoveredInfo.matches_played} partidos · {hoveredInfo.total_minutes} min
            </div>
            {isFcm && 'cluster' in hoveredInfo && (
              <div style={{ marginTop: 2, fontSize: 8, color: CLUSTER_COLORS[(hoveredInfo as FcmPlayer).cluster] ?? '#666' }}>
                Cluster {(hoveredInfo as FcmPlayer).cluster + 1} · memb. {Math.max(...(hoveredInfo as FcmPlayer).memberships) * 100 >> 0}%
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div style={{
        padding: '4px 12px', borderTop: '1px solid var(--c-bdr)', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 10, background: 'var(--c-sur1)',
        fontSize: 8, color: 'var(--c-t5)',
      }}>
        <span><span style={{ color: 'var(--c-acc)' }}>{selectedPlayerIds.length}</span> seleccionados</span>
        <span>· Click = toggle selección</span>
        {selectedPlayerIds.length > 0 && (
          <button onClick={() => setSelectedPlayerIds([])}
            style={{ marginLeft: 'auto', fontSize: 8, color: 'var(--c-red)', border: '1px solid var(--c-bdr)', borderRadius: 2, padding: '2px 6px' }}>
            Limpiar
          </button>
        )}
      </div>
    </div>
  )
}
