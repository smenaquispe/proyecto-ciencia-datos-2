'use client'

/**
 * DEC v2 — vista 3D del espacio latente (k=8 sub-perfiles).
 * Canvas 2D (no SVG) para redibujar 4304 puntos rápido en rotación/zoom.
 * ponytail: hardware-accelerated por el browser (GPU AMD del usuario entra
 * via canvas context). upgrade path: WebGL points si requiere 100k+ items.
 *
 * Layout: contenedor de tamaño flexible (lo fija el parent). Soporta:
 *   - Click en punto: toggle selección (drives other panels)
 *   - Drag: rotación yaw/pitch
 *   - Wheel / + − buttons: zoom
 *   - Auto-rotate toggle
 */
import { useRef, useState, useEffect, useCallback } from 'react'
import { useDashboard } from '@/store/store'
import type { FcmPlayer } from '@/lib/types'

const CLUSTER_COLORS = [
  '#00d68f', '#4d9eff', '#f5c842', '#ff6b35', '#9b59ff',
  '#ff4757', '#00bcd4', '#e91e63', '#7c3aed', '#14b8a6',
]
const PROJ_SC = 0.42
const Z_RANGE: [number, number] = [-1.7, 1.7]
const HIT_RADIUS = 9  // px

interface Pt { p: FcmPlayer; sx: number; sy: number; depth: number }

function norm1(a: number[]) {
  const mn = Math.min(...a), mx = Math.max(...a)
  const r = Math.max(mx - mn, 1e-6)
  return a.map(v => (2 * (v - mn) / r) - 1)
}

export function ProjectionScatter3D({ onExit }: { onExit: () => void }) {
  const {
    scatterPlayers, hoveredPlayerId, togglePlayerId, setHoveredPlayerId,
    selectedPlayerIds,
  } = useDashboard()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState<FcmPlayer | null>(null)
  const [toolPos, setToolPos] = useState({ x: 0, y: 0 })
  const [hud, setHud] = useState({ yaw: 34, pitch: 23, zoom: 1.0, auto: false })

  // Refs mutables: cero re-renders de React durante drag/zoom
  const yaw = useRef(0.6)
  const pitch = useRef(0.4)
  const zoom = useRef(1.0)
  const auto = useRef(false)
  const dragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, yaw: 0, pitch: 0 })

  const players = (scatterPlayers as FcmPlayer[]).filter(p => typeof p.z === 'number') as FcmPlayer[]

  // Coords normalizadas [-1,1]
  const norm = useRef<{ xs: number[]; ys: number[]; zs: number[] }>({ xs: [], ys: [], zs: [] })
  useEffect(() => {
    if (!players.length) { norm.current = { xs: [], ys: [], zs: [] }; return }
    norm.current = {
      xs: norm1(players.map(p => p.x)),
      ys: norm1(players.map(p => p.y)),
      zs: norm1(players.map(p => p.z ?? 0)),
    }
    draw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scatterPlayers])

  // Proyectar un punto (i) a (sx, sy, depth) usando el viewport actual W×H
  const project = useCallback((i: number, W: number, H: number): Pt => {
    const cy = Math.cos(yaw.current), syR = Math.sin(yaw.current)
    const cp = Math.cos(pitch.current), sp = Math.sin(pitch.current)
    const x = norm.current.xs[i], y = norm.current.ys[i], z = norm.current.zs[i]
    const x1 = x * cy - z * syR
    const z1 = x * syR + z * cy
    const y1 = y * cp - z1 * sp
    const z2 = y * sp + z1 * cp
    const sc = PROJ_SC * Math.min(W, H) * zoom.current
    return { p: players[i], sx: W / 2 + x1 * sc, sy: H / 2 - y1 * sc, depth: z2 }
  }, [players])

  // Dibujar — llamado en cada frame (rAF cuando auto, o tras drag/wheel/zoom)
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const cssW = canvas.clientWidth, cssH = canvas.clientHeight
    const dpr = window.devicePixelRatio || 1
    if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
      canvas.width = cssW * dpr; canvas.height = cssH * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    ctx.clearRect(0, 0, cssW, cssH)
    // fondo radial
    const grad = ctx.createRadialGradient(cssW / 2, cssH / 2, 0, cssW / 2, cssH / 2, Math.max(cssW, cssH) / 1.4)
    grad.addColorStop(0, '#11151f')
    grad.addColorStop(1, '#070912')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, cssW, cssH)

    // ejes guía
    const axes: [number, number, number, string][] = [
      [-1, 0, 0, '#e06c75'], [1, 0, 0, '#e06c75'],
      [0, -1, 0, '#61afef'], [0, 1, 0, '#61afef'],
      [0, 0, -1, '#98c379'], [0, 0, 1, '#98c379'],
    ]
    const cym = Math.cos(yaw.current), symP = Math.sin(yaw.current)
    const cpm = Math.cos(pitch.current), spm = Math.sin(pitch.current)
    const sc = PROJ_SC * Math.min(cssW, cssH) * zoom.current
    for (const [ax, ay, az, col] of axes) {
      const x1m = ax * cym - az * symP
      const z1m = ax * symP + az * cym
      const y1m = ay * cpm - z1m * spm
      ctx.strokeStyle = col; ctx.globalAlpha = 0.25; ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(cssW / 2, cssH / 2)
      ctx.lineTo(cssW / 2 + x1m * sc, cssH / 2 - y1m * sc)
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    if (!players.length) return

    // Proyectar todos + sort back-to-front
    const projected: Pt[] = players.map((_, i) => project(i, cssW, cssH))
    projected.sort((a, b) => a.depth - b.depth)

    //Dibujar
    for (const { p, sx, sy, depth } of projected) {
      const dp = (depth - Z_RANGE[0]) / (Z_RANGE[1] - Z_RANGE[0])
      const sel = selectedPlayerIds.includes(p.player_id)
      const hov = hoveredPlayerId === p.player_id
      const color = CLUSTER_COLORS[p.cluster] ?? '#666'
      const baseR = sel ? 5 : hov ? 4 : 2.2
      const r = baseR + dp * 1.6
      const memb = p.memberships ? Math.max(...p.memberships) : 1
      const alpha = Math.min((0.3 + dp * 0.5) * (sel ? 1.3 : hov ? 1.2 : 1) * (0.4 + memb * 0.6), 1)
      if (sel) {
        ctx.strokeStyle = color; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.arc(sx, sy, r + 4, 0, Math.PI * 2); ctx.stroke()
      }
      ctx.fillStyle = color; ctx.globalAlpha = alpha
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill()
      if (sel) {
        ctx.strokeStyle = '#fff'; ctx.globalAlpha = 1; ctx.lineWidth = 1.2
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke()
      }
    }
    ctx.globalAlpha = 1

    // Labels jugadores seleccionados (apellido)
    for (const { p, sx, sy } of projected) {
      if (!selectedPlayerIds.includes(p.player_id)) continue
      ctx.fillStyle = '#fff'
      ctx.font = '600 9px system-ui'
      ctx.textAlign = 'center'
      ctx.fillText(p.player_name.split(' ').slice(-1)[0], sx, sy - 12)
    }
  }, [players, project, selectedPlayerIds, hoveredPlayerId])

  // Auto-rotate loop
  useEffect(() => {
    let raf = 0
    const loop = () => {
      if (auto.current && !dragging.current && players.length) {
        yaw.current += 0.004
        draw()
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [draw, players.length])

  // ResizeObserver para re-dibujar al cambiar el tamaño del contenedor
  useEffect(() => {
    const c = containerRef.current
    if (!c) return
    const ro = new ResizeObserver(() => draw())
    ro.observe(c)
    return () => ro.disconnect()
  }, [draw])

  // Redraw on selection change
  useEffect(() => { draw() }, [selectedPlayerIds, draw])

  const syncHud = () => setHud({
    yaw: Math.round(yaw.current * 57.3), pitch: Math.round(pitch.current * 57.3),
    zoom: Number(zoom.current.toFixed(2)), auto: auto.current,
  })

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const f = e.deltaY < 0 ? 1.12 : 1 / 1.12
    zoom.current = Math.max(0.4, Math.min(4, zoom.current * f))
    syncHud(); draw()
  }
  const onDown = (e: React.MouseEvent) => {
    dragging.current = true; auto.current = false
    dragStart.current = { x: e.clientX, y: e.clientY, yaw: yaw.current, pitch: pitch.current }
    syncHud()
  }
  const onMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setToolPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    if (!dragging.current) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    yaw.current = dragStart.current.yaw + dx * 0.008
    pitch.current = Math.max(-1.4, Math.min(1.4, dragStart.current.pitch + dy * 0.008))
    draw()
  }
  const onUp = (e: React.MouseEvent) => {
    if (!dragging.current) return
    dragging.current = false
    // si no se movió el cursor (click), hacer hit-test sobre puntos
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const mx = e.clientX - rect.left, my = e.clientY - rect.top
    const cssW = rect.width, cssH = rect.height
    let nearest: FcmPlayer | null = null
    let bestD = HIT_RADIUS * HIT_RADIUS
    for (let i = 0; i < players.length; i++) {
      const { sx, sy } = project(i, cssW, cssH)
      const d = (sx - mx) ** 2 + (sy - my) ** 2
      if (d < bestD) { bestD = d; nearest = players[i] }
    }
    if (nearest) togglePlayerId(nearest.player_id)
    syncHud()
  }
  const onMoveCanvas = (e: React.MouseEvent) => {
    // hover detection: nearest point within radius
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const mx = e.clientX - rect.left, my = e.clientY - rect.top
    setToolPos({ x: mx, y: my })
    let nearest: FcmPlayer | null = null
    let bestD = HIT_RADIUS * HIT_RADIUS
    for (let i = 0; i < players.length; i++) {
      const { sx, sy } = project(i, rect.width, rect.height)
      const d = (sx - mx) ** 2 + (sy - my) ** 2
      if (d < bestD) { bestD = d; nearest = players[i] }
    }
    if (nearest && nearest.player_id !== hoveredPlayerId) {
      setHovered(nearest); setHoveredPlayerId(nearest.player_id)
    } else if (!nearest && hovered) {
      setHovered(null); setHoveredPlayerId(null)
    }
  }

  const reset = () => {
    yaw.current = 0.6; pitch.current = 0.4; zoom.current = 1.0
    syncHud(); draw()
  }
  const toggleAuto = () => { auto.current = !auto.current; syncHud() }
  const zoomBtn = (f: number) => () => {
    zoom.current = Math.max(0.4, Math.min(4, zoom.current * f))
    syncHud(); draw()
  }

  const nClusters = Math.min(8, players.length ? Math.max(...players.map(p => p.cluster)) + 1 : 1)

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, background: '#0b0e14', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top bar compacto */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px',
        borderBottom: '1px solid var(--c-bdr)', background: 'var(--c-sur1)', flexShrink: 0 }}>
        <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--c-acc)' }}>DEC v2 · 3D · k={nClusters}</span>
        <span style={{ fontSize: 7, color: 'var(--c-t5)' }}>{players.length} jugadores</span>
        <span style={{ fontSize: 7, color: 'var(--c-t5)', marginLeft: 'auto' }}>
          {hud.yaw}°/{hud.pitch}° · {hud.zoom.toFixed(2)}x
        </span>
        <button onClick={onExit} title="Cerrar DEC v2"
          style={{ fontSize: 9, padding: '1px 5px', border: '1px solid #ff6b35',
            borderRadius: 2, color: '#ff6b35', cursor: 'pointer', background: 'transparent' }}>✕</button>
      </div>

      {/* Toolbar ultra-compacta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 8px',
        borderBottom: '1px solid var(--c-bdr)', background: 'var(--c-sur1)', flexShrink: 0 }}>
        <button onClick={zoomBtn(1.3)} style={btn}>＋</button>
        <button onClick={zoomBtn(1 / 1.3)} style={btn}>－</button>
        <button onClick={toggleAuto} style={{ ...btn, background: hud.auto ? 'var(--c-sur2)' : 'transparent' }}>
          {hud.auto ? '◐' : '◯'}
        </button>
        <button onClick={reset} style={btn}>⟳</button>
        <span style={{ fontSize: 6, color: 'var(--c-t5)', marginLeft: 4, lineHeight: '1.2' }}>
          drag=rotar · wheel=zoom · click=sel
        </span>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
        onMouseLeave={() => { setHovered(null); setHoveredPlayerId(null) }}>
        <canvas ref={canvasRef}
          onWheel={onWheel} onMouseDown={onDown} onMouseMove={(e) => { onMove(e); onMoveCanvas(e) }}
          onMouseUp={onUp}
          style={{ display: 'block', width: '100%', height: '100%', cursor: dragging.current ? 'grabbing' : 'crosshair' }} />

        {/* Tooltip */}
        {hovered && (
          <div style={{
            position: 'absolute',
            left: Math.min(toolPos.x + 8, (containerRef.current?.clientWidth ?? 200) - 160),
            top: Math.max(toolPos.y - 70, 4), background: 'var(--c-sur2)',
            border: '1px solid var(--c-bdr2)', borderRadius: 4, padding: '5px 8px',
            pointerEvents: 'none', zIndex: 20, minWidth: 140,
          }}>
            <div style={{ fontSize: 10, color: 'var(--c-t1)', fontWeight: 500, marginBottom: 2 }}>{hovered.player_name}</div>
            <div style={{ fontSize: 8, color: 'var(--c-t4)' }}>{hovered.dominant_position} · {hovered.pos_group}</div>
            <div style={{ fontSize: 8, color: 'var(--c-t5)' }}>{hovered.matches_played}p · {hovered.total_minutes}min</div>
            <div style={{ marginTop: 2, fontSize: 9, fontWeight: 600, color: CLUSTER_COLORS[hovered.cluster] ?? '#fff' }}>
              C{hovered.cluster + 1} · {(Math.max(...hovered.memberships) * 100) >> 0}%
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const btn: React.CSSProperties = {
  width: 18, height: 18, fontSize: 10, color: 'var(--c-t3)',
  border: '1px solid var(--c-bdr)', borderRadius: 2, cursor: 'pointer',
  background: 'transparent', padding: 0, display: 'flex',
  alignItems: 'center', justifyContent: 'center', lineHeight: 1,
}