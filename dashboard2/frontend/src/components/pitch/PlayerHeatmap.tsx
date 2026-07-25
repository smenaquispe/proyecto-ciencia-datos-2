"use client"

import { useEffect, useRef } from "react"
import type { HeatmapCell } from "@/lib/types"

interface Props {
  cells: HeatmapCell[]
  cellSize?: number
  width?: number
  height?: number
  playerName?: string
  upToMinute?: number
}

const PITCH_W = 120
const PITCH_H = 80

// ── Color scale: blue-green-yellow-red (matplotlib "hot" style) ───────────────
function heatColor(t: number): [number, number, number, number] {
  // t in [0,1]
  if (t <= 0) return [0, 0, 0, 0]
  // Custom stops: cold blue → cyan → green → yellow → orange → red
  const stops: Array<[number, [number, number, number]]> = [
    [0.00, [  0,   0, 100]],
    [0.15, [  0,  60, 180]],
    [0.30, [  0, 160, 200]],
    [0.45, [  0, 200, 100]],
    [0.60, [160, 220,   0]],
    [0.75, [255, 200,   0]],
    [0.88, [255, 100,   0]],
    [1.00, [230,   0,   0]],
  ]
  let i = 0
  while (i < stops.length - 2 && t > stops[i + 1][0]) i++
  const [t0, c0] = stops[i]
  const [t1, c1] = stops[i + 1]
  const f = (t - t0) / (t1 - t0)
  const r = Math.round(c0[0] + f * (c1[0] - c0[0]))
  const g = Math.round(c0[1] + f * (c1[1] - c0[1]))
  const b = Math.round(c0[2] + f * (c1[2] - c0[2]))
  const a = 0.12 + t * 0.82   // alpha: near-transparent at low, opaque at high
  return [r, g, b, a]
}

// Gaussian kernel (σ in cells)
function gaussian(dx: number, dy: number, sigma: number): number {
  return Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma))
}

function drawPitchLines(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sx = w  / PITCH_W
  const sy = h / PITCH_H
  ctx.strokeStyle = "rgba(255,255,255,0.55)"
  ctx.lineWidth   = 1.4

  const rect = (x: number, y: number, ww: number, hh: number) => {
    ctx.strokeRect(x * sx, y * sy, ww * sx, hh * sy)
  }
  const line = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath(); ctx.moveTo(x1 * sx, y1 * sy); ctx.lineTo(x2 * sx, y2 * sy); ctx.stroke()
  }
  const circle = (cx: number, cy: number, r: number) => {
    ctx.beginPath(); ctx.arc(cx * sx, cy * sy, r * sx, 0, Math.PI * 2); ctx.stroke()
  }
  const dot = (cx: number, cy: number) => {
    ctx.fillStyle = "rgba(255,255,255,0.55)"
    ctx.beginPath(); ctx.arc(cx * sx, cy * sy, 2, 0, Math.PI * 2); ctx.fill()
  }

  rect(0, 0, 120, 80)
  line(60, 0, 60, 80)
  circle(60, 40, 10)
  rect(0, 18, 18, 44)
  rect(102, 18, 18, 44)
  ctx.lineWidth = 0.8
  ctx.strokeStyle = "rgba(255,255,255,0.28)"
  rect(0, 30, 6, 20)
  rect(114, 30, 6, 20)
  dot(12, 40); dot(108, 40); dot(60, 40)
  // Goals
  ctx.strokeStyle = "rgba(255,255,255,0.5)"
  ctx.lineWidth = 1
  ctx.strokeRect(-4, 36 * sy, 4, 8 * sy)
  ctx.strokeRect(w, 36 * sy, 4, 8 * sy)
}

export default function PlayerHeatmap({
  cells, cellSize = 5, width = 560, height = 340, playerName, upToMinute
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width  = width  * dpr
    canvas.height = height * dpr
    canvas.style.width  = `${width}px`
    canvas.style.height = `${height}px`
    ctx.scale(dpr, dpr)

    // Background
    ctx.fillStyle = "#166534"
    ctx.fillRect(0, 0, width, height)

    // Grass stripes
    for (let i = 0; i < 10; i++) {
      if (i % 2 === 0) {
        ctx.fillStyle = "rgba(0,0,0,0.06)"
        ctx.fillRect(i * (width / 10), 0, width / 10, height)
      }
    }

    if (cells.length === 0) {
      drawPitchLines(ctx, width, height)
      return
    }

    const sx = width  / PITCH_W
    const sy = height / PITCH_H
    const cw = cellSize * sx
    const ch = cellSize * sy

    // Build dense grid for KDE smoothing
    const COLS = Math.ceil(PITCH_W / cellSize)
    const ROWS = Math.ceil(PITCH_H / cellSize)
    const SIGMA = 1.8  // gaussian sigma in cells

    const grid = new Float32Array(COLS * ROWS)
    for (const cell of cells) {
      grid[cell.cy * COLS + cell.cx] = cell.count
    }

    // KDE pass: convolve with gaussian kernel
    const radius = Math.ceil(SIGMA * 2.5)
    const smoothed = new Float32Array(COLS * ROWS)
    for (let gy = 0; gy < ROWS; gy++) {
      for (let gx = 0; gx < COLS; gx++) {
        let sum = 0, wsum = 0
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = gx + dx, ny = gy + dy
            if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue
            const w = gaussian(dx, dy, SIGMA)
            sum  += grid[ny * COLS + nx] * w
            wsum += w
          }
        }
        smoothed[gy * COLS + gx] = wsum > 0 ? sum / wsum : 0
      }
    }

    const maxVal = Math.max(...smoothed)

    // Draw heatmap cells
    for (let gy = 0; gy < ROWS; gy++) {
      for (let gx = 0; gx < COLS; gx++) {
        const v = smoothed[gy * COLS + gx]
        if (v < 0.001) continue
        const t = v / maxVal
        const [r, g, b, a] = heatColor(t)
        ctx.fillStyle = `rgba(${r},${g},${b},${a})`
        ctx.fillRect(gx * cw, gy * ch, cw + 0.5, ch + 0.5) // +0.5 avoids gaps
      }
    }

    drawPitchLines(ctx, width, height)
  }, [cells, width, height, cellSize])

  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-600" style={{ width, height }}>
      <canvas
        ref={canvasRef}
        style={{ display: "block", imageRendering: "pixelated" }}
      />

      {/* Color scale legend */}
      <div className="absolute bottom-2 right-2 bg-black/65 rounded-lg px-2 py-1.5 flex items-center gap-2 pointer-events-none">
        <span className="text-[9px] text-slate-400">Baja</span>
        <div style={{
          width: 64, height: 8, borderRadius: 4,
          background: "linear-gradient(to right, #003cb2, #00c8c8, #a0dc00, #ffcc00, #ff6400, #e60000)",
        }} />
        <span className="text-[9px] text-slate-300">Alta</span>
      </div>

      {/* Player + minute label */}
      <div className="absolute top-2 left-2 flex flex-col gap-1 pointer-events-none">
        {playerName && (
          <div className="bg-black/70 rounded-lg px-2 py-1 text-[11px] text-amber-400 font-semibold">
            {playerName}
          </div>
        )}
        {upToMinute !== undefined && playerName && (
          <div className="bg-black/70 rounded-lg px-2 py-1 text-[10px] text-white font-mono">
            0′ → <span className="text-amber-400 font-bold">{upToMinute}′</span>
          </div>
        )}
      </div>

      {cells.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-white/35 text-sm">Selecciona un jugador</span>
        </div>
      )}
    </div>
  )
}
