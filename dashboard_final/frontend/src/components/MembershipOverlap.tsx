'use client'

/**
 * MembershipOverlap — teoría de conjuntos fuzzy para 2 jugadores en DEC v2.
 *
 * Por cada sub-perfil C{1..8}: dos barras horizontales, una por jugador.
 *   - Color: color del jugador (canal de identidad categórico, Munzner)
 *   - Longitud: m_a, m_b (canal de magnitud continuo)
 *   - La intersección shared = min(m_A, m_B) se denota como una superposición
 *     con un patrón diagonal gris (sin color nuevo — sólo textura para indicar
 *     "región solapada", fiel a Expresividad).
 *
 * Score global: Jaccard fuzzy = Σ min(m_A,m_B) / Σ max(m_A,m_B).
 *
 * Datos: useDashboard.scatterPlayers.memberships (DEC v2, k=8).
 */
import { useDashboard } from '@/store/store'
import type { FcmPlayer } from '@/lib/types'

const PLAYER_COL = ['#4d9eff', '#ff6b35']  // A = azul, B = naranja (de PLAYER_COLORS)
const POS_COLORS: Record<string, string> = {
  GK: '#e5c07b', DEF: '#61afef', DM: '#56b6c2', MID: '#98c379', FWD: '#e06c75',
}

function fuzzyPair(mA: number, mB: number) {
  const shared = Math.min(mA, mB)
  return { ua: mA - shared, shared, ub: mB - shared }
}

export function MembershipOverlap() {
  const { scatterPlayers, selectedPlayerIds, algorithm } = useDashboard()

  if (algorithm !== 'decv2' && algorithm !== 'dec') {
    return <Placeholder text="Activa DEC o DEC v2 en el algoritmo" />
  }
  if (selectedPlayerIds.length !== 2) {
    return <Placeholder text="Selecciona exactamente 2 jugadores para ver su solapamiento" />
  }

  const players = (scatterPlayers as FcmPlayer[]).filter(p => selectedPlayerIds.includes(p.player_id))
  if (players.length !== 2) return <Placeholder text="Jugadores no cargados — re-selecciona" />

  const [a, b] = players
  const mA = a.memberships ?? []
  const mB = b.memberships ?? []
  if (mA.length !== mB.length || mA.length === 0) {
    return <Placeholder text="Membership no disponible para este algoritmo" />
  }
  const k = mA.length

  // Jaccard fuzzy global
  let sumMin = 0, sumMax = 0
  for (let i = 0; i < k; i++) {
    sumMin += Math.min(mA[i], mB[i])
    sumMax += Math.max(mA[i], mB[i])
  }
  const jaccard = sumMax > 0 ? sumMin / sumMax : 0
  const jaccardPct = (jaccard * 100).toFixed(1)
  const barW = 200  // px por fila
  const fmt = (v: number) => (v * 100).toFixed(1) + '%'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto', background: 'var(--c-bg)' }}>
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--c-bdr)', flexShrink: 0, background: 'var(--c-sur1)' }}>
        <div style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--c-t4)', fontWeight: 500, marginBottom: 8 }}>
          Perfiles — Teoría de conjuntos
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: PLAYER_COL[0] }} />
            <span style={{ fontSize: 10, color: PLAYER_COL[0], fontWeight: 600 }}>
              {a.player_name.split(' ').slice(-1)[0]}
            </span>
            <span style={{ fontSize: 7, color: 'var(--c-t5)' }}>{a.pos_group}</span>
          </div>
          <span style={{ fontSize: 8, color: 'var(--c-t5)' }}>vs</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: PLAYER_COL[1] }} />
            <span style={{ fontSize: 10, color: PLAYER_COL[1], fontWeight: 600 }}>
              {b.player_name.split(' ').slice(-1)[0]}
            </span>
            <span style={{ fontSize: 7, color: 'var(--c-t5)' }}>{b.pos_group}</span>
          </div>
        </div>
        <div style={{ marginTop: 10, padding: '8px 10px', border: '1px solid var(--c-bdr2)', borderRadius: 3, background: 'var(--c-sur2)' }}>
          <div style={{ fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--c-t5)' }}>
            Similitud de perfiles (Jaccard fuzzy)
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--c-acc)', marginTop: 2 }}>
            {jaccardPct}%
          </div>
          <div style={{ height: 3, background: 'var(--c-bdr)', borderRadius: 2, marginTop: 4 }}>
            <div style={{ width: `${jaccard * 100}%`, height: '100%', background: 'var(--c-acc)', borderRadius: 2 }} />
          </div>
        </div>
      </div>

      {/* Bars: 2 barras por sub-perfil, una por jugador */}
      <div style={{ padding: '12px 14px', flexShrink: 0 }}>
        {Array.from({ length: k }).map((_, i) => {
          const shared = Math.min(mA[i], mB[i])
          const sharedW = (shared) * barW     // px de zona compartida en cada barra
          const wA = mA[i] * barW
          const wB = mB[i] * barW

          return (
            <div key={i} style={{ marginBottom: 11 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 9, color: 'var(--c-t3)', fontWeight: 500 }}>
                  Sub-perfil C{i + 1}
                </span>
                <span style={{ fontSize: 8, color: 'var(--c-t5)', fontFamily: 'monospace' }}>
                  A {fmt(mA[i])} · B {fmt(mB[i])} · ∩ {fmt(shared)}
                </span>
              </div>
              {/* Barra A */}
              <div style={{ position: 'relative', height: 12, marginBottom: 2, width: barW, borderRadius: 2, background: 'var(--c-bdr)', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: wA, background: PLAYER_COL[0], opacity: 0.85 }} />
                {/* overlay hatched sobre la porción shared */}
                <div style={{
                  position: 'absolute', left: 0, top: 0, height: '100%', width: sharedW,
                  backgroundImage:
                    'repeating-linear-gradient(45deg, rgba(255,255,255,0.55) 0 2px, transparent 2px 4px)',
                  backgroundSize: '4px 4px',
                }} />
              </div>
              {/* Barra B */}
              <div style={{ position: 'relative', height: 12, width: barW, borderRadius: 2, background: 'var(--c-bdr)', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: wB, background: PLAYER_COL[1], opacity: 0.85 }} />
                <div style={{
                  position: 'absolute', left: 0, top: 0, height: '100%', width: sharedW,
                  backgroundImage:
                    'repeating-linear-gradient(45deg, rgba(255,255,255,0.55) 0 2px, transparent 2px 4px)',
                  backgroundSize: '4px 4px',
                }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ padding: '8px 14px', borderTop: '1px solid var(--c-bdr)', marginTop: 'auto', background: 'var(--c-sur1)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Legend color={PLAYER_COL[0]} label={a.player_name.split(' ').slice(-1)[0]} />
          <Legend color={PLAYER_COL[1]} label={b.player_name.split(' ').slice(-1)[0]} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 14, height: 8, borderRadius: 1,
              backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.7) 0 2px, transparent 2px 4px)',
              backgroundSize: '4px 4px', background: 'rgba(255,255,255,0.15)',
            }} />
            <span style={{ fontSize: 8, color: 'var(--c-t5)' }}>intersección (∩)</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 8, height: 8, background: color, borderRadius: 1 }} />
      <span style={{ fontSize: 8, color: 'var(--c-t5)' }}>{label}</span>
    </div>
  )
}

function Placeholder({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 16 }}>
      <div style={{ textAlign: 'center' }}>
        <svg width="40" height="28" viewBox="0 0 40 28">
          <circle cx="14" cy="14" r="10" fill={PLAYER_COL[0] + '44'} stroke={PLAYER_COL[0]} strokeWidth="1.5" opacity="0.7" />
          <circle cx="26" cy="14" r="10" fill={PLAYER_COL[1] + '44'} stroke={PLAYER_COL[1]} strokeWidth="1.5" opacity="0.7" />
        </svg>
        <div style={{ fontSize: 10, color: 'var(--c-t5)', marginTop: 10, letterSpacing: '0.06em' }}>{text}</div>
      </div>
    </div>
  )
}