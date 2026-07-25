'use client'

import { useDashboard } from '@/store/store'

interface Props { onThemeToggle: () => void; isDark: boolean }

export function MatchHeader({ onThemeToggle, isDark }: Props) {
  const { selectedMatch, lineupData, loading } = useDashboard()
  const isLoading = loading['lineup']

  return (
    <div style={{
      height: 46, borderBottom: '1px solid var(--c-bdr)',
      display: 'flex', alignItems: 'center', padding: '0 16px', flexShrink: 0,
      background: 'var(--c-sur1)',
    }}>
      {!selectedMatch ? (
        <>
          <span style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--c-t4)', fontWeight: 500 }}>
            Statsbomb — Scout Analytics
          </span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: 'var(--c-t5)' }}>Selecciona un partido</span>
        </>
      ) : (
        <>
          {/* Competition */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 100 }}>
            <span style={{ fontSize: 10, color: 'var(--c-t3)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500 }}>
              {selectedMatch.competition_name}
            </span>
            <span style={{ fontSize: 9, color: 'var(--c-t4)' }}>{selectedMatch.season_name}</span>
          </div>

          <div style={{ flex: 1 }} />

          {/* Score */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--c-t2)', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>
              {lineupData?.match.home_team_name ?? selectedMatch.home_team_name}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 300, color: 'var(--c-t1)', lineHeight: 1 }}>
                {lineupData?.match.home_score ?? selectedMatch.home_score}
              </span>
              <span style={{ fontSize: 10, color: 'var(--c-t5)' }}>—</span>
              <span style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 300, color: 'var(--c-t1)', lineHeight: 1 }}>
                {lineupData?.match.away_score ?? selectedMatch.away_score}
              </span>
            </div>
            <span style={{ fontSize: 12, color: 'var(--c-t2)', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {lineupData?.match.away_team_name ?? selectedMatch.away_team_name}
            </span>
          </div>

          <div style={{ flex: 1 }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, color: 'var(--c-t4)' }}>{selectedMatch.match_date}</span>
            {selectedMatch.match_status_360 === 'available' && (
              <span style={{ fontSize: 8, color: 'var(--c-blu)', border: '1px solid var(--c-blu)', opacity: 0.5, padding: '1px 5px', borderRadius: 2, letterSpacing: '0.05em' }}>
                360°
              </span>
            )}
            {isLoading && <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--c-acc)', opacity: 0.6 }} />}
          </div>
        </>
      )}

      {/* Theme toggle button */}
      <button
        onClick={onThemeToggle}
        title={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
        style={{
          marginLeft: 16,
          width: 28, height: 28,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid var(--c-bdr2)',
          borderRadius: 4,
          background: 'var(--c-sur2)',
          color: 'var(--c-t3)',
          cursor: 'pointer',
          transition: 'all 0.15s',
          flexShrink: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--c-acc)'; e.currentTarget.style.color = 'var(--c-acc)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--c-bdr2)'; e.currentTarget.style.color = 'var(--c-t3)' }}
      >
        {isDark ? <SunIcon /> : <MoonIcon />}
      </button>
    </div>
  )
}

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}
