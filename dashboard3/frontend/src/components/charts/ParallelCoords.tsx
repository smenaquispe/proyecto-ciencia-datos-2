'use client'

import { useMemo, useRef, useCallback, useEffect, useState } from 'react'
import { useDashboard } from '@/store/store'
import type { Pass, PlayerRatings } from '@/lib/types'

// ── Pentagon metric options ───────────────────────────────────────────────────

interface PentMetric {
  id: string
  label: string
  short: string
  get: (r: PlayerRatings) => number
  color: string
}

const ALL_PENT_METRICS: PentMetric[] = [
  { id: 'pass_score',      label: 'Score Pases',   short: 'Pases',   color: '#00d68f', get: r => r.passes.pass_score },
  { id: 'completion',      label: 'Precisión',      short: 'Prec.',   color: '#4d9eff', get: r => r.passes.completion_rate },
  { id: 'direction',       label: 'Dirección',      short: 'Dir.',    color: '#4d9eff', get: r => r.passes.direction_score },
  { id: 'length_score',    label: 'Longitud',       short: 'Long.',   color: '#9b59ff', get: r => r.passes.length_score },
  { id: 'pass_pressure',   label: 'Presión Pases',  short: 'P.Pase', color: '#f5c842', get: r => r.passes.pressure_rating },
  { id: 'duel_score',      label: 'Score Duelos',   short: 'Duelos',  color: '#4d9eff', get: r => r.duels.duel_score },
  { id: 'duel_winrate',    label: 'Tasa Ganados',   short: 'T.Gan.',  color: '#4d9eff', get: r => r.duels.win_rate },
  { id: 'duel_area',       label: 'Zona Duelo',     short: 'Zona',   color: '#9b59ff', get: r => r.duels.area_score },
  { id: 'shot_score',      label: 'Score Tiros',    short: 'Tiros',  color: '#ff6b35', get: r => r.shots.shot_score },
  { id: 'shot_accuracy',   label: 'Precisión Tiro', short: 'P.Tiro', color: '#ff6b35', get: r => r.shots.shot_accuracy },
  { id: 'xg',              label: 'xG Proxy',       short: 'xG',     color: '#ff6b35', get: r => r.shots.xg_score },
]

const DEFAULT_PENT = ['pass_score', 'pass_pressure', 'duel_score', 'shot_score', 'completion']

// ── Parallel coordinates axis definitions ────────────────────────────────────

interface AxisDef {
  id: string; label: string; short: string
  min: number; max: number
  fmt: (v: number) => string
  get: (p: Pass) => number | null
  group: 'spatial' | 'quality' | 'pressure' | 'time'
}

const ALL_AXES: AxisDef[] = [
  { id: 'x',                label: 'Inicio X',       short: 'InicX',  group: 'spatial',   min: 0,     max: 120, fmt: v => `${v.toFixed(0)}`,          get: p => p.x },
  { id: 'y',                label: 'Lateral inicio', short: 'InicY',  group: 'spatial',   min: 0,     max: 80,  fmt: v => v < 27 ? 'Izq' : v > 53 ? 'Der' : 'Cen', get: p => p.y },
  { id: 'end_x',            label: 'Destino X',      short: 'DestX',  group: 'spatial',   min: 0,     max: 120, fmt: v => `${v.toFixed(0)}`,          get: p => p.end_x },
  { id: 'end_y',            label: 'Lateral dest.',  short: 'DestY',  group: 'spatial',   min: 0,     max: 80,  fmt: v => `${v.toFixed(0)}`,          get: p => p.end_y },
  { id: 'pass_length',      label: 'Longitud (m)',   short: 'Long',   group: 'quality',   min: 0,     max: 65,  fmt: v => `${v.toFixed(0)}m`,         get: p => p.pass_length },
  { id: 'pass_angle',       label: 'Ángulo',         short: 'Ang',    group: 'quality',   min: -3.15, max: 3.15,fmt: v => `${(v*180/Math.PI).toFixed(0)}°`, get: p => p.pass_angle },
  { id: 'distance',         label: 'Distancia real', short: 'Dist',   group: 'quality',   min: 0,     max: 100, fmt: v => `${v.toFixed(0)}m`,         get: p => p.distance },
  { id: 'direction',        label: 'Dirección',      short: 'Dir',    group: 'quality',   min: 0,     max: 1,   fmt: v => v > 0.5 ? 'Adel' : 'Atrás', get: p => p.forward ? 1 : 0 },
  { id: 'completed',        label: 'Completado',     short: 'Compl',  group: 'quality',   min: 0,     max: 1,   fmt: v => v > 0.5 ? 'Sí' : 'No',      get: p => p.completed ? 1 : 0 },
  { id: 'press_dist',       label: 'Dist. presión',  short: 'Pres',   group: 'pressure',  min: 0,     max: 30,  fmt: v => v < 0.5 ? 'Libre' : `${v.toFixed(0)}m`, get: p => p.pressure_distance },
  { id: 'under_pressure',   label: 'Bajo presión',   short: 'UP',     group: 'pressure',  min: 0,     max: 1,   fmt: v => v > 0.5 ? 'Sí' : 'No',      get: p => p.under_pressure ? 1 : 0 },
  { id: 'pass_cross',       label: 'Centro',         short: 'Cross',  group: 'pressure',  min: 0,     max: 1,   fmt: v => v > 0.5 ? 'Sí' : 'No',      get: p => p.pass_cross ? 1 : 0 },
  { id: 'pass_switch',      label: 'Cambio juego',   short: 'Switch', group: 'pressure',  min: 0,     max: 1,   fmt: v => v > 0.5 ? 'Sí' : 'No',      get: p => p.pass_switch ? 1 : 0 },
  { id: 'minute',           label: 'Minuto',         short: 'Min',    group: 'time',      min: 0,     max: 120, fmt: v => `${v.toFixed(0)}'`,          get: p => p.minute },
  { id: 'duration',         label: 'Duración',       short: 'Dur',    group: 'time',      min: 0,     max: 5,   fmt: v => `${v.toFixed(1)}s`,          get: p => p.duration ?? null },
]

const DEFAULT_AXES = ['x', 'pass_length', 'direction', 'press_dist', 'y']

const GROUP_COLORS: Record<string, string> = {
  spatial: '#4d9eff', quality: '#00d68f', pressure: '#f5c842', time: '#9b59ff',
}

function norm(v: number, min: number, max: number): number {
  if (max === min) return 0.5
  return Math.max(0, Math.min(1, (v - min) / (max - min)))
}

function passStroke(p: Pass, active: boolean): string {
  if (!active) return 'rgba(35,35,35,0.6)'
  if (!p.completed)     return 'rgba(255,71,87,0.5)'
  if (p.under_pressure) return 'rgba(245,200,66,0.45)'
  if (p.forward)        return 'rgba(0,214,143,0.35)'
  return 'rgba(100,150,220,0.35)'
}

function sc(s: number): string {
  if (s >= 7) return '#00d68f'
  if (s >= 5) return '#f5c842'
  if (s >= 3) return '#ff6b35'
  return '#ff4757'
}

const CHART_H = 185
const CM = { t: 30, r: 16, b: 16, l: 16 }
const IH = CHART_H - CM.t - CM.b

interface Brush { axisId: string; y0: number; y1: number }

// ── Pentagon chart ────────────────────────────────────────────────────────────

function Pentagon({
  ratings, color, ratings2, color2, selectedIds, onToggle,
}: {
  ratings: PlayerRatings | null
  color: string
  ratings2?: PlayerRatings | null
  color2?: string
  selectedIds: string[]
  onToggle: (id: string) => void
}) {
  const axes = selectedIds.map(id => ALL_PENT_METRICS.find(m => m.id === id)!).filter(Boolean)
  const N = Math.max(axes.length, 3)
  const R = 72, cx = 100, cy = 100
  const angles = Array.from({ length: N }, (_, i) => (i / N) * Math.PI * 2 - Math.PI / 2)

  const values = axes.map(a => ratings ? a.get(ratings) : 0)
  const values2 = ratings2 ? axes.map(a => a.get(ratings2)) : null

  const pts = values.map((v, i) => ({
    x: cx + (v / 10) * R * Math.cos(angles[i]),
    y: cy + (v / 10) * R * Math.sin(angles[i]),
  }))
  const pts2 = values2?.map((v, i) => ({
    x: cx + (v / 10) * R * Math.cos(angles[i]),
    y: cy + (v / 10) * R * Math.sin(angles[i]),
  }))

  const avgPts = angles.map(a => ({
    x: cx + R * 0.5 * Math.cos(a),
    y: cy + R * 0.5 * Math.sin(a),
  }))

  const polygon = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const polygon2 = pts2?.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const avgPolygon = avgPts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const rgb = color === '#00d68f' ? '0,214,143' : '255,107,53'
  const c2 = color2 ?? '#9b59ff'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--c-bg)' }}>
      {/* Metric selector */}
      <div style={{ padding: '5px 10px', borderBottom: '1px solid var(--c-bdr)', flexShrink: 0 }}>
        <div style={{ fontSize: 8, color: 'var(--c-t4)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500, marginBottom: 5 }}>
          Ejes del pentágono
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {ALL_PENT_METRICS.map(m => {
            const active = selectedIds.includes(m.id)
            return (
              <button
                key={m.id}
                onClick={() => onToggle(m.id)}
                title={m.label}
                style={{
                  padding: '2px 5px', fontSize: 8, letterSpacing: '0.03em',
                  color: active ? '#e8e8e8' : 'var(--c-t5)',
                  border: `1px solid ${active ? m.color : 'var(--c-bdr)'}`,
                  borderRadius: 2, background: active ? `${m.color}18` : 'transparent',
                  cursor: 'pointer', transition: 'all 0.1s', fontWeight: active ? 500 : 400,
                }}
              >
                {m.short}
              </button>
            )
          })}
        </div>
      </div>

      {/* SVG pentagon */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%', maxWidth: 200, maxHeight: 200 }} preserveAspectRatio="xMidYMid meet">
          {/* Grid rings */}
          {[0.25, 0.5, 0.75, 1].map(t => {
            const gPts = angles.map(a => `${(cx + R * t * Math.cos(a)).toFixed(1)},${(cy + R * t * Math.sin(a)).toFixed(1)}`).join(' ')
            return <polygon key={t} points={gPts} fill="none" stroke={t === 1 ? 'var(--c-bdr2)' : 'var(--c-bdr)'} strokeWidth={t === 1 ? 0.8 : 0.5} />
          })}
          {/* Spokes */}
          {angles.map((a, i) => (
            <line key={i} x1={cx} y1={cy}
              x2={cx + R * Math.cos(a)} y2={cy + R * Math.sin(a)}
              stroke="var(--c-bdr)" strokeWidth={0.5} />
          ))}
          {/* Average reference */}
          <polygon points={avgPolygon} fill="none" stroke="var(--c-t5)" strokeWidth={0.6} strokeDasharray="2 2" opacity={0.5} />

          {/* Data polygon P1 */}
          <polygon points={polygon} fill={`rgba(${rgb},0.15)`} stroke={color} strokeWidth={1.2} />
          {pts.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={2.2} fill={color} opacity={0.85} />
          ))}
          {/* Data polygon P2 (overlay) */}
          {polygon2 && pts2 && (
            <>
              <polygon points={polygon2} fill={`rgba(155,89,255,0.1)`} stroke={c2} strokeWidth={1.2} strokeDasharray="3 2" />
              {pts2.map((p, i) => <circle key={`p2-${i}`} cx={p.x} cy={p.y} r={2.2} fill={c2} opacity={0.85} />)}
            </>
          )}

          {/* Labels */}
          {angles.map((a, i) => {
            const lx = cx + (R + 13) * Math.cos(a)
            const ly = cy + (R + 13) * Math.sin(a)
            const v = values[i] ?? 0
            return (
              <g key={i}>
                <text x={lx} y={ly - 2} textAnchor="middle" fontSize={7} fill="var(--c-t2)" fontFamily="system-ui" fontWeight="500">
                  {axes[i]?.short ?? ''}
                </text>
                <text x={lx} y={ly + 7} textAnchor="middle" fontSize={7} fill={sc(v)} fontFamily="'SF Mono', monospace" fontWeight="600">
                  {v.toFixed(1)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Value list */}
      <div style={{ padding: '4px 10px 6px', borderTop: '1px solid var(--c-bdr)', flexShrink: 0 }}>
        {axes.map((a, i) => {
          const v = values[i] ?? 0
          const v2 = values2?.[i] ?? null
          return (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: a.color, opacity: 0.8, flexShrink: 0 }} />
              <span style={{ fontSize: 9, color: 'var(--c-t3)', flex: 1 }}>{a.label}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 9, color: sc(v), fontWeight: 600, minWidth: 22, textAlign: 'right' }}>{v.toFixed(1)}</span>
              {v2 !== null && (
                <span style={{ fontFamily: 'monospace', fontSize: 9, color: c2, fontWeight: 600, minWidth: 22, textAlign: 'right', opacity: 0.9 }}>{v2.toFixed(1)}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ParallelCoords() {
  const { passes, passes2, filteredPassIds, setFilteredPassIds, ratings, ratings2, selectedPlayer, selectedPlayer2, lineupData } = useDashboard()

  const [pentagonIds, setPentagonIds] = useState<string[]>(DEFAULT_PENT)
  const [selectedAxisIds, setSelectedAxisIds] = useState<string[]>(DEFAULT_AXES)
  const [brushes, setBrushes] = useState<Brush[]>([])
  const dragRef = useRef<{ axisId: string; startY: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [chartWidth, setChartWidth] = useState(500)

  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver(en => setChartWidth(en[0].contentRect.width || 500))
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  const axes = useMemo(() =>
    selectedAxisIds.map(id => ALL_AXES.find(a => a.id === id)!).filter(Boolean),
    [selectedAxisIds]
  )

  const axisX = useMemo(() => {
    const iw = chartWidth - CM.l - CM.r
    return axes.map((_, i) => CM.l + (axes.length > 1 ? (i / (axes.length - 1)) : 0.5) * iw)
  }, [axes, chartWidth])

  const computeFiltered = useCallback((brsh: Brush[]) => {
    if (brsh.length === 0) { setFilteredPassIds(new Set()); return }
    const ids = new Set<string>()
    for (const p of passes) {
      const ok = brsh.every(b => {
        const axis = axes.find(a => a.id === b.axisId)
        if (!axis) return true
        const raw = axis.get(p)
        if (raw === null) return true
        const ny = norm(raw, axis.min, axis.max) * IH
        return ny >= Math.min(b.y0, b.y1) && ny <= Math.max(b.y0, b.y1)
      })
      if (ok && p.event_id) ids.add(p.event_id)
    }
    setFilteredPassIds(ids)
  }, [passes, axes, setFilteredPassIds])

  // Canvas line drawing (P1 + P2)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    if (!rect.width) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr; canvas.height = CHART_H * dpr
    canvas.style.width = `${rect.width}px`; canvas.style.height = `${CHART_H}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, rect.width, CHART_H)
    const scaleX = rect.width / chartWidth
    const scaled = axisX.map(x => x * scaleX)
    const af = filteredPassIds.size > 0

    const drawPasses = (passList: typeof passes, strokeFn: (p: typeof passes[0], active: boolean) => string) => {
      for (const p of passList) {
        const pts = axes.map((a, i) => {
          const raw = a.get(p)
          if (raw === null) return null
          return [scaled[i], CM.t + norm(raw, a.min, a.max) * IH] as [number, number]
        })
        if (pts.some(x => x === null)) continue
        const isActive = !af || (p.event_id ? filteredPassIds.has(p.event_id) : false)
        ctx.beginPath()
        ctx.moveTo((pts[0] as [number,number])[0], (pts[0] as [number,number])[1])
        for (let i = 1; i < pts.length; i++) ctx.lineTo((pts[i] as [number,number])[0], (pts[i] as [number,number])[1])
        ctx.strokeStyle = strokeFn(p, isActive)
        ctx.lineWidth = isActive ? 0.8 : 0.4
        ctx.stroke()
      }
    }

    drawPasses(passes, passStroke)
    if (passes2.length > 0) {
      drawPasses(passes2, (p, active) => {
        if (!active) return 'rgba(35,35,35,0.6)'
        if (!p.completed)     return 'rgba(200,89,255,0.5)'
        if (p.under_pressure) return 'rgba(155,89,255,0.5)'
        if (p.forward)        return 'rgba(155,89,255,0.4)'
        return 'rgba(100,89,255,0.35)'
      })
    }
  }, [passes, passes2, filteredPassIds, axes, axisX, chartWidth])

  useEffect(() => { setBrushes([]); setFilteredPassIds(new Set()) }, [selectedAxisIds])

  const getSvgY = (e: React.MouseEvent) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return 0
    return (e.clientY - rect.top) * (CHART_H / rect.height) - CM.t
  }

  const handleMD = (e: React.MouseEvent, axisId: string) => {
    e.preventDefault()
    dragRef.current = { axisId, startY: getSvgY(e) }
  }

  const handleMM = (e: React.MouseEvent) => {
    if (!dragRef.current) return
    const y = getSvgY(e)
    const { axisId, startY } = dragRef.current
    const next = [...brushes.filter(b => b.axisId !== axisId), ...(Math.abs(y - startY) > 3 ? [{ axisId, y0: startY, y1: y }] : [])]
    setBrushes(next); computeFiltered(next)
  }

  const toggleAxis = (id: string) => {
    setSelectedAxisIds(prev =>
      prev.includes(id)
        ? prev.length > 2 ? prev.filter(x => x !== id) : prev
        : [...prev, id]
    )
  }

  const togglePent = (id: string) => {
    setPentagonIds(prev =>
      prev.includes(id)
        ? prev.length > 3 ? prev.filter(x => x !== id) : prev
        : [...prev, id]
    )
  }

  const clearBrushes = () => { setBrushes([]); setFilteredPassIds(new Set()) }

  const isHome = selectedPlayer?.team_id === lineupData?.match.home_team_id
  const tc = isHome ? '#00d68f' : '#ff6b35'
  const activeCount = filteredPassIds.size > 0 ? filteredPassIds.size : passes.length

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', overflow: 'hidden' }}>

      {/* Pentagon panel */}
      <div style={{ width: 230, flexShrink: 0, borderRight: '1px solid var(--c-bdr)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '5px 10px', borderBottom: '1px solid var(--c-bdr)', flexShrink: 0 }}>
          <span style={{ fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--c-t4)', fontWeight: 500 }}>
            Rendimiento T2 — Pentágono
          </span>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <Pentagon ratings={ratings} color={tc} ratings2={ratings2} color2="#9b59ff" selectedIds={pentagonIds} onToggle={togglePent} />
        </div>
      </div>

      {/* Parallel coords panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--c-bg)' }}>

        {/* Axis selector */}
        <div style={{ padding: '5px 12px 6px', borderBottom: '1px solid var(--c-bdr)', flexShrink: 0, background: 'var(--c-sur1)' }}>
          <div style={{ fontSize: 8, color: 'var(--c-t4)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500, marginBottom: 4 }}>
            Ejes activos
          </div>
          {(['spatial', 'quality', 'pressure', 'time'] as const).map(group => {
            const gc = GROUP_COLORS[group]
            const groupLabel = { spatial: 'Posición', quality: 'Calidad', pressure: 'Presión', time: 'Tiempo' }[group]
            return (
              <div key={group} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                <span style={{ fontSize: 7, color: gc, minWidth: 46, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.8 }}>
                  {groupLabel}
                </span>
                {ALL_AXES.filter(a => a.group === group).map(a => {
                  const active = selectedAxisIds.includes(a.id)
                  return (
                    <button key={a.id} onClick={() => toggleAxis(a.id)} title={a.label} style={{
                      padding: '1px 6px', fontSize: 8,
                      color: active ? '#e8e8e8' : 'var(--c-t5)',
                      border: `1px solid ${active ? gc : 'var(--c-bdr)'}`,
                      borderRadius: 2, background: active ? `${gc}18` : 'transparent',
                      cursor: 'pointer', transition: 'all 0.1s', fontWeight: active ? 500 : 400,
                    }}>
                      {a.short}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '4px 12px', borderBottom: '1px solid var(--c-bdr)', flexShrink: 0, background: 'var(--c-sur1)' }}>
          <SN label="Pases" val={`${activeCount}/${passes.length}`} color="var(--c-acc)" />
          <SN label="Completados" val={passes.filter(p => p.completed && (!filteredPassIds.size || filteredPassIds.has(p.event_id ?? ''))).length} />
          <SN label="Ejes" val={axes.length} color="var(--c-pur)" />
          {brushes.length > 0 && (
            <button onClick={clearBrushes} style={{
              marginLeft: 'auto', fontSize: 9, color: 'var(--c-t3)',
              border: '1px solid var(--c-bdr2)', borderRadius: 2,
              padding: '2px 8px', letterSpacing: '0.05em', textTransform: 'uppercase',
            }}>
              Limpiar ({brushes.length})
            </button>
          )}
        </div>

        {/* Canvas + SVG chart */}
        <div ref={containerRef} style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} />
          <svg ref={svgRef}
            viewBox={`0 0 ${chartWidth} ${CHART_H}`}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            preserveAspectRatio="xMidYMid meet"
            onMouseMove={handleMM} onMouseUp={() => { dragRef.current = null }} onMouseLeave={() => { dragRef.current = null }}
          >
            {axes.map((axis, i) => {
              const x = axisX[i]
              const gc = GROUP_COLORS[axis.group]
              const brush = brushes.find(b => b.axisId === axis.id)
              return (
                <g key={axis.id}>
                  <rect x={x - 10} y={CM.t} width={20} height={IH} fill="transparent" style={{ cursor: 'ns-resize' }}
                    onMouseDown={e => handleMD(e, axis.id)} />
                  <line x1={x} y1={CM.t} x2={x} y2={CM.t + IH} stroke="var(--c-bdr2)" strokeWidth={1} />
                  {[0, 0.25, 0.5, 0.75, 1].map(t => {
                    const ty = CM.t + t * IH
                    const val = axis.min + t * (axis.max - axis.min)
                    return (
                      <g key={t}>
                        <line x1={x - 3} y1={ty} x2={x + 3} y2={ty} stroke="var(--c-bdr2)" strokeWidth={0.5} />
                        {(t === 0 || t === 0.5 || t === 1) && (
                          <text x={x + 5} y={ty + 2} fontSize={5.5} fill="var(--c-t4)" fontFamily="'SF Mono', monospace">
                            {axis.fmt(val)}
                          </text>
                        )}
                      </g>
                    )
                  })}
                  <text x={x} y={CM.t - 10} textAnchor="middle" fontSize={7} fill={gc} fontFamily="system-ui" fontWeight="500" letterSpacing="0.04em">
                    {axis.label}
                  </text>
                  {brush && (
                    <rect
                      x={x - 8} y={CM.t + Math.min(brush.y0, brush.y1)}
                      width={16} height={Math.abs(brush.y1 - brush.y0)}
                      fill={`${gc}18`} stroke={gc} strokeWidth={0.7}
                      style={{ cursor: 'pointer' }}
                      onClick={() => { const n = brushes.filter(b => b.axisId !== axis.id); setBrushes(n); computeFiltered(n) }}
                    />
                  )}
                </g>
              )
            })}
          </svg>
        </div>

        {/* Legend */}
        <div style={{ padding: '3px 12px', borderTop: '1px solid var(--c-bdr)', flexShrink: 0, display: 'flex', gap: 12, alignItems: 'center', background: 'var(--c-sur1)' }}>
          <LL color="rgba(0,214,143,0.65)" label="Completado" />
          <LL color="rgba(245,200,66,0.5)" label="Bajo presión" />
          <LL color="rgba(255,71,87,0.5)" label="Incompleto" />
          <LL color="rgba(100,150,220,0.5)" label="Hacia atrás" />
          <span style={{ marginLeft: 'auto', fontSize: 8, color: 'var(--c-t5)' }}>
            Arrastra sobre eje para filtrar · afecta red de pases
          </span>
        </div>
      </div>
    </div>
  )
}

function SN({ label, val, color = 'var(--c-t3)' }: { label: string; val: string | number; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ fontSize: 7, color: 'var(--c-t5)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontFamily: 'monospace', fontSize: 12, color, fontWeight: 500 }}>{val}</span>
    </div>
  )
}

function LL({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <svg width={14} height={2}><line x1={0} y1={1} x2={14} y2={1} stroke={color} strokeWidth={1.5} /></svg>
      <span style={{ fontSize: 8, color: 'var(--c-t4)' }}>{label}</span>
    </div>
  )
}
