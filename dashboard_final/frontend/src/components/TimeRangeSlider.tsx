'use client'

import { useDashboard } from '@/store/store'
import type { TimeLimit } from '@/lib/types'

export function TimeRangeSlider() {
  const { timeLimit, setTimeLimit, setLoading } = useDashboard()

  const sliderValue = timeLimit === 'all' ? 100 : (timeLimit as number)
  const isAll = timeLimit === 'all'

  const handleChange = (v: number) => {
    const newLimit: TimeLimit = v >= 100 ? 'all' : v
    setTimeLimit(newLimit)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
      padding: '0 14px', minWidth: 280,
    }}>
      <span style={{ fontSize: 9, color: 'var(--c-t4)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500, whiteSpace: 'nowrap' }}>
        Tiempo
      </span>
      <input
        type="range"
        min={1}
        max={100}
        value={sliderValue}
        onChange={e => handleChange(Number(e.target.value))}
        style={{ flex: 1, maxWidth: 140, accentColor: 'var(--c-acc)' }}
      />
      <div style={{
        fontSize: 11, fontFamily: 'monospace', color: 'var(--c-t2)', fontWeight: 500, minWidth: 80, textAlign: 'right',
      }}>
        {isAll ? 'Toda la carrera' : `Últimos ${sliderValue}`}
      </div>
    </div>
  )
}
