'use client'

import { useDashboard } from '@/store/store'
import type { Algorithm } from '@/lib/types'

const ALGORITHMS: { id: Algorithm; label: string; desc: string }[] = [
  { id: 'umap',  label: 'UMAP',   desc: 'Proyección no lineal' },
  { id: 'pca',   label: 'PCA',    desc: 'Componentes principales' },
  { id: 'tsne',  label: 't-SNE',  desc: 't-SNE perplexity=30' },
  { id: 'mds',   label: 'MDS',    desc: 'Escalamiento multidimensional' },
  { id: 'fcm',   label: 'FCM',    desc: 'Fuzzy C-Means clustering' },
  { id: 'aefcm', label: 'AE+FCM', desc: 'Autoencoder + Fuzzy C-Means' },
  { id: 'dec',   label: 'DEC',    desc: 'Deep Embedded Clustering (Demir 2026)' },
  { id: 'decv2', label: 'DEC v2', desc: 'DEC k=8 sub-perfiles · vista 3D' },
]

export function AlgorithmSelector() {
  const { algorithm, nClusters, setAlgorithm, setNClusters, setLoading, setError, clearSelection } = useDashboard()

  const handleChange = (a: Algorithm) => {
    clearSelection()
    setAlgorithm(a)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
      padding: '0 14px',
    }}>
      <span style={{ fontSize: 9, color: 'var(--c-t4)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500, whiteSpace: 'nowrap' }}>
        Algoritmo
      </span>
      <div style={{ display: 'flex', gap: 3 }}>
        {ALGORITHMS.map(a => (
          <button
            key={a.id}
            onClick={() => handleChange(a.id)}
            title={a.desc}
            style={{
              padding: '4px 10px', fontSize: 11, fontWeight: 500, letterSpacing: '0.02em',
              color: algorithm === a.id ? 'var(--c-t1)' : 'var(--c-t4)',
              background: algorithm === a.id ? 'var(--c-sur2)' : 'transparent',
              border: `1px solid ${algorithm === a.id ? 'var(--c-bdr2)' : 'var(--c-bdr)'}`,
              borderRadius: 3, cursor: 'pointer', transition: 'all 0.1s',
            }}
          >
            {a.label}
          </button>
        ))}
      </div>
      {(algorithm === 'fcm' || algorithm === 'aefcm') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 6 }}>
          <span style={{ fontSize: 9, color: 'var(--c-t4)', whiteSpace: 'nowrap' }}>Clusters:</span>
          <select
            value={nClusters}
            onChange={e => setNClusters(Number(e.target.value))}
            style={{
              background: 'var(--c-sur2)', border: '1px solid var(--c-bdr)',
              color: 'var(--c-t2)', fontSize: 11, padding: '3px 6px', borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            {[3, 4, 5, 6, 7, 8].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
