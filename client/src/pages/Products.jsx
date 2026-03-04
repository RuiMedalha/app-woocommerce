import { useState, useEffect } from 'react'
import ProductEditModal from '../components/ProductEditModal'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

// Dados de exemplo quando não há API
const MOCK_PRODUCTS = [
  { id: 1, sku: 'UD-001', name: 'Produto Exemplo A', brand: 'ud', faqs: [], suggestions: [] },
  { id: 2, sku: 'UD-002', name: 'Produto Exemplo B', brand: 'ud', faqs: [{ q: 'Como lavar?', a: 'Lavar à mão.' }], suggestions: [{ cell: 'B2', value: 'Sugestão 1' }] },
]

export default function Products() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [useMock, setUseMock] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`${API_BASE}/products`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setProducts(data)
        else setProducts(MOCK_PRODUCTS)
        setUseMock(!Array.isArray(data))
      })
      .catch(() => {
        setProducts(MOCK_PRODUCTS)
        setUseMock(true)
      })
      .finally(() => setLoading(false))
  }, [])

  const handleSave = (productId, payload) => {
    if (useMock) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId
            ? {
                ...p,
                faqs: payload.faqs ?? p.faqs,
                suggestions: payload.suggestions ?? p.suggestions,
              }
            : p
        )
      )
      setSelected(null)
      return
    }
    // PUT /products/:id com payload
    setSelected(null)
  }

  if (loading) return <p className="text-[var(--color-ink-muted)]">A carregar produtos...</p>

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[var(--color-ink)] mb-2">Painel de Produtos</h1>
      <p className="text-[var(--color-ink-muted)] mb-6">
        Editar FAQs (Patos) e Sugestões (Células) por produto. Clique em «Editar» para abrir o modal.
      </p>

      <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] overflow-hidden shadow-[var(--shadow-card)]">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
              <th className="px-4 py-3 font-medium text-[var(--color-ink)]">SKU</th>
              <th className="px-4 py-3 font-medium text-[var(--color-ink)]">Nome</th>
              <th className="px-4 py-3 font-medium text-[var(--color-ink)]">Marca</th>
              <th className="px-4 py-3 font-medium text-[var(--color-ink)]">Ações</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b border-[var(--color-border)] last:border-0">
                <td className="px-4 py-3 font-mono text-[var(--color-ink)]">{p.sku}</td>
                <td className="px-4 py-3 text-[var(--color-ink)]">{p.name}</td>
                <td className="px-4 py-3 text-[var(--color-ink)]">{p.brand ?? '—'}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setSelected(p)}
                    className="rounded-[var(--radius-button)] bg-[var(--color-accent)] px-3 py-1.5 text-sm text-white hover:bg-[var(--color-accent-hover)]"
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <ProductEditModal
          product={selected}
          onClose={() => setSelected(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
