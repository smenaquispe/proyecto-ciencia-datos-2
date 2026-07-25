"use client"

import { useMemo, useRef, useCallback } from "react"
import type { Pass, EventSummary } from "@/lib/types"

interface Props {
  passes: Pass[]            // ALL passes of selected player for the full match
  eventsSummary: EventSummary[]
  currentMinute: number
  maxMinute: number
  onMinuteChange: (m: number) => void
  playerName?: string
}

export default function PassTimeline({
  passes,
  eventsSummary,
  currentMinute,
  maxMinute,
  onMinuteChange,
  playerName,
}: Props) {
  const W = 680
  const H = 110
  const PAD = { left: 34, right: 16, top: 20, bottom: 20 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top  - PAD.bottom

  const safe = Math.max(maxMinute, 90)

  const minuteToX = useCallback(
    (m: number) => PAD.left + (m / safe) * innerW,
    [safe, innerW]
  )

  // Count passes per minute
  const countByMinute = useMemo(() => {
    const counts: Record<number, { fwd: number; bck: number; lat: number }> = {}
    for (const p of passes) {
      if (!counts[p.minute]) counts[p.minute] = { fwd: 0, bck: 0, lat: 0 }
      if (["forward_vertical", "diagonal_forward"].includes(p.pass_type)) counts[p.minute].fwd++
      else if (["back_vertical", "diagonal_back"].includes(p.pass_type)) counts[p.minute].bck++
      else counts[p.minute].lat++
    }
    return counts
  }, [passes])

  const maxTotal = useMemo(() => {
    let m = 1
    for (const v of Object.values(countByMinute)) m = Math.max(m, v.fwd + v.bck + v.lat)
    return m
  }, [countByMinute])

  const countToY = useCallback(
    (c: number) => PAD.top + innerH - (c / maxTotal) * innerH,
    [maxTotal, innerH]
  )

  // Period separator minutes
  const periodLines = useMemo(() => {
    const seen = new Set<number>()
    const lines: { minute: number; period: number }[] = []
    for (const e of eventsSummary) {
      if (e.period > 1 && !seen.has(e.period)) {
        seen.add(e.period)
        lines.push({ minute: e.minute, period: e.period })
      }
    }
    return lines
  }, [eventsSummary])

  // SVG click → compute minute
  const svgRef = useRef<SVGSVGElement>(null)
  const handleSVGClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const relX = (e.clientX - rect.left) / rect.width * W
    const m = Math.round(((relX - PAD.left) / innerW) * safe)
    onMinuteChange(Math.max(0, Math.min(safe, m)))
  }

  const passesAtCurrent = passes.filter(p => p.minute === currentMinute)

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">
          Timeline de Pases {playerName ? <span className="text-amber-400">— {playerName}</span> : ""}
        </h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-3 h-2 rounded-sm bg-green-500 inline-block" /> Adelante
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-2 rounded-sm bg-red-500 inline-block" /> Atrás
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-2 rounded-sm bg-blue-400 inline-block" /> Lateral
          </span>
          <span className="text-amber-400 font-mono font-bold text-sm">
            {currentMinute}′ · {passesAtCurrent.length} pases
          </span>
        </div>
      </div>

      {/* Mini chart */}
      <svg
        ref={svgRef}
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        className="cursor-crosshair w-full"
        onClick={handleSVGClick}
        style={{ height: 110 }}
      >
        <rect x={PAD.left} y={PAD.top} width={innerW} height={innerH} fill="#0f172a" rx={3} />

        {/* Period lines */}
        {periodLines.map(({ minute, period }) => (
          <g key={period}>
            <line
              x1={minuteToX(minute)} y1={PAD.top}
              x2={minuteToX(minute)} y2={PAD.top + innerH}
              stroke="#475569" strokeWidth={1} strokeDasharray="3 3"
            />
            <text x={minuteToX(minute) + 2} y={PAD.top + 9} fontSize={7} fill="#64748b">HT</text>
          </g>
        ))}

        {/* Bars per minute */}
        {Object.entries(countByMinute).map(([ms, c]) => {
          const min  = parseInt(ms)
          const x    = minuteToX(min)
          const tot  = c.fwd + c.bck + c.lat
          const isCurrent = min === currentMinute
          const barW = Math.max(3, innerW / safe - 1)

          const yFwd = countToY(tot)
          const yBck = countToY(tot - c.fwd)  // after fwd
          const yLat = countToY(tot - c.fwd - c.bck)

          return (
            <g key={min} opacity={isCurrent ? 1 : 0.55}>
              {/* fwd (green) - bottom */}
              {c.fwd > 0 && (
                <rect x={x - barW / 2} y={yFwd}
                  width={barW} height={(c.fwd / maxTotal) * innerH}
                  fill="#22c55e" />
              )}
              {/* bck (red) - middle */}
              {c.bck > 0 && (
                <rect x={x - barW / 2} y={yBck}
                  width={barW} height={(c.bck / maxTotal) * innerH}
                  fill="#f87171" />
              )}
              {/* lat (blue) - top */}
              {c.lat > 0 && (
                <rect x={x - barW / 2} y={countToY(tot)}
                  width={barW} height={(c.lat / maxTotal) * innerH}
                  fill="#60a5fa" />
              )}
              {/* Highlight selected minute */}
              {isCurrent && (
                <rect x={x - barW / 2 - 1} y={PAD.top}
                  width={barW + 2} height={innerH}
                  fill="none" stroke="#f59e0b" strokeWidth={1.5} rx={1} />
              )}
            </g>
          )
        })}

        {/* Current minute needle */}
        <line
          x1={minuteToX(currentMinute)} y1={PAD.top - 4}
          x2={minuteToX(currentMinute)} y2={PAD.top + innerH}
          stroke="#f59e0b" strokeWidth={2}
        />
        <polygon
          points={`${minuteToX(currentMinute)},${PAD.top - 4} ${minuteToX(currentMinute) - 5},${PAD.top - 12} ${minuteToX(currentMinute) + 5},${PAD.top - 12}`}
          fill="#f59e0b"
        />
        <text
          x={minuteToX(currentMinute)} y={PAD.top - 14}
          textAnchor="middle" fontSize={7} fill="#f59e0b" fontWeight="bold"
        >
          {currentMinute}′
        </text>

        {/* X axis ticks */}
        {[0, 15, 30, 45, 60, 75, 90, ...(safe > 90 ? [safe] : [])].map((m) => (
          <text
            key={m}
            x={minuteToX(m)} y={PAD.top + innerH + 12}
            textAnchor="middle" fontSize={7} fill="#475569"
          >
            {m}′
          </text>
        ))}

        {/* Y axis */}
        {[0, maxTotal].map((v) => (
          <text key={v} x={PAD.left - 4} y={countToY(v) + 3}
            textAnchor="end" fontSize={6} fill="#475569">
            {v}
          </text>
        ))}
      </svg>

      {/* ── BIG SLIDER ── */}
      <div className="px-1 space-y-1">
        <div className="relative">
          <input
            type="range"
            min={0}
            max={safe}
            value={currentMinute}
            onChange={(e) => onMinuteChange(parseInt(e.target.value))}
            className="w-full h-3 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #f59e0b ${(currentMinute / safe) * 100}%, #1e293b ${(currentMinute / safe) * 100}%)`,
            }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-slate-500 px-0.5">
          <span className="font-mono">0′</span>
          <span className="text-slate-400">← Arrastra para navegar el partido →</span>
          <span className="font-mono">{safe}′</span>
        </div>

        {/* Quick jump buttons */}
        <div className="flex gap-1.5 flex-wrap pt-1">
          {[0, 15, 30, 45, 60, 75, 90, ...(safe > 90 ? [safe] : [])].map((m) => (
            <button
              key={m}
              onClick={() => onMinuteChange(m)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                currentMinute === m
                  ? "bg-amber-500 text-black font-bold"
                  : "bg-slate-700 text-slate-400 hover:bg-slate-600"
              }`}
            >
              {m}′
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
