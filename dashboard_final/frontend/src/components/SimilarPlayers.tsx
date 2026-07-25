'use client'

/**
 * SimilarPlayers — control para encontrar los N jugadores más parecidos a uno
 * seleccionado, basado en distancia L1 sobre memberships DEC (la búsqueda se
 * hace en el store). Aparece al pie del sidebar izquierdo cuando hay
 * exactamente 1 jugador seleccionado.
 *
 * Munzner: T4 (Tarea: identificar perfiles más parecidos → scout similares).
 * Sin backend, todo local sobre scatterPlayers.memberships.
 */
import { useState } from 'react'
import { useDashboard } from '@/store/store'

export function SimilarPlayers({ playerId }: { playerId: number }) {
  const { scatterPlayers, findSimilar, selectedPlayerIds, setSelectedPlayerIds } = useDashboard()
  const [n, setN] = useState(5)

  const ref = (scatterPlayers as any[]).find(p => p.player_id === playerId)
  const hasMemberships = !!(ref?.memberships?.length)

  if (!hasMemberships) {
    return <Placeholder text="Cambia a DEC o DEC v2 para encontrar similares" />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontSize: 8, color: 'var(--c-t4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 500 }}>
        Buscar similares · {ref.player_name?.split(' ').slice(-1)[0] ?? 'jugador'}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 8, color: 'var(--c-t5)', minWidth: 14 }}>N =</span>
        <input
          type="range" min={1} max={20} step={1} value={n}
          onChange={e => setN(Number(e.target.value))}
          style={{ flex: 1, accentColor: 'var(--c-acc)' }}
        />
        <span style={{
          fontSize: 11, fontFamily: 'monospace', fontWeight: 600, color: 'var(--c-acc)',
          minWidth: 22, textAlign: 'right',
        }}>
          {n}
        </span>
        <button
          onClick={() => findSimilar(playerId, n)}
          title={`Selecciona ${n} + el jugador actual`}
          style={{
            fontSize: 8, padding: '3px 10px', borderRadius: 2, cursor: 'pointer',
            border: '1px solid var(--c-acc)', color: 'var(--c-acc)', background: 'transparent',
            fontWeight: 500, letterSpacing: '0.04em',
          }}>
          Encontrar
        </button>
      </div>
      <div style={{ marginTop: 4, fontSize: 7, color: 'var(--c-t5)' }}>
        Reemplaza selección actual por 1 + {n} jugadores más parecidos
      </div>
      {selectedPlayerIds.length > 1 && (
        <button
          onClick={() => setSelectedPlayerIds([playerId])}
          style={{
            marginTop: 5, fontSize: 7, color: 'var(--c-t5)',
            border: '1px solid var(--c-bdr)', background: 'transparent',
            padding: '2px 6px', borderRadius: 2, cursor: 'pointer',
          }}>
          ↺ Restaurar selección a solo este jugador
        </button>
      )}
    </div>
  )
}

function Placeholder({ text }: { text: string }) {
  return (
    <div style={{ textAlign: 'center', fontSize: 8, color: 'var(--c-t5)', padding: 4 }}>
      {text}
    </div>
  )
}