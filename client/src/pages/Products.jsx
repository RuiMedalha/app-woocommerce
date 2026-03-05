import { useState, useEffect } from 'react'
import ProductEditModal from '../components/ProductEditModal'

// Remover /api do fim para evitar URLs duplicadas (/api/api/...). Produção sem env: base vazia (relativo).
const raw = (import.meta.env.VITE_API_URL ?? '').toString().trim().replace(/\/$/, '')
const API_BASE = raw ? raw.replace(/\/api\/?$/i, '') : (import.meta.env.MODE === 'production' ? '' : 'http://localhost:4000')

export default function Products() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [optimizingId, setOptimizingId] = useState(null)

  const loadProducts = () => {
    setLoading(true)
    fetch(`${API_BASE}/products`)
      .then((r) => r.json())
      .then((data) => {
        setProducts(Array.isArray(data) ? data : [])
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadProducts()
  }, [])

  const handleOptimize = async (id) => {
    setOptimizingId(id)
    try {
      const res = await fetch(`${API_BASE}/api/products/${id}/optimize`, { method: 'POST' })
      if (res.ok) {
        const updated = await res.json()
        setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)))
        if (selected?.id === id) setSelected(updated)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setOptimizingId(null)
    }
  }

  const handleSave = (productId, payload) => {
    fetch(`${API_BASE}/products/${productId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then((updated) => {
        setProducts((prev) => prev.map((p) => (p.id === productId ? updated : p)))
        if (selected?.id === productId) setSelected(updated)
      })
      .catch(() => {})
    setSelected(null)
  }

  const displayName = (p) => p.original_title || p.optimized_title || p.name || p.sku || '—'

  if (loading) return <p className="text-[var(--color-ink-muted)]">A carregar produtos...</p>

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[var(--color-ink)] mb-2">Produtos</h1>
      <p className="text-[var(--color-ink-muted)] mb-6">
        Lista do que foi importado (Excel). Edite FAQs e use «Otimizar com IA» para gerar títulos e descrições SEO com base no inventário e na Base de Conhecimento.
      </p>

      <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] overflow-hidden shadow-[var(--shadow-card)]">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
              <th className="px-4 py-3 font-medium text-[var(--color-ink)]">SKU</th>
              <th className="px-4 py-3 font-medium text-[var(--color-ink)]">Nome / Título</th>
              <th className="px-4 py-3 font-medium text-[var(--color-ink)]">Estado</th>
              <th className="px-4 py-3 font-medium text-[var(--color-ink)]">Ações</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-[var(--color-ink-muted)]">
                  Nenhum produto. Importe um ficheiro Excel na página Mapeamento Excel e processe-o.
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-4 py-3 font-mono text-[var(--color-ink)]">{p.sku}</td>
                  <td className="px-4 py-3 text-[var(--color-ink)] max-w-md truncate" title={displayName(p)}>
                    {displayName(p)}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-ink-muted)]">{p.status || 'Pendente'}</td>
                  <td className="px-4 py-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleOptimize(p.id)}
                      disabled={optimizingId != null}
                      className="rounded-[var(--radius-button)] bg-violet-600 px-3 py-1.5 text-sm text-white hover:bg-violet-700 disabled:opacity-50"
                    >
                      {optimizingId === p.id ? 'A otimizar...' : 'Otimizar com IA'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelected({ ...p, name: displayName(p) })}
                      className="rounded-[var(--radius-button)] bg-[var(--color-accent)] px-3 py-1.5 text-sm text-white hover:bg-[var(--color-accent-hover)]"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <ProductEditModal
          product={{ ...selected, name: selected.name || displayName(selected) }}
          onClose={() => setSelected(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
