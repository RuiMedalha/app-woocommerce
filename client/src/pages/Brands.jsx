import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export default function Brands() {
  const [brands, setBrands] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ key: '', name: '', sku_prefix: '', dictionary: {} })

  useEffect(() => {
    fetch(`${API_BASE}/brands`)
      .then((r) => r.json())
      .then((data) => setBrands(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const openEdit = (brand) => {
    setEditing(brand?.key ?? null)
    setForm({
      key: brand?.key ?? '',
      name: brand?.name ?? '',
      sku_prefix: brand?.sku_prefix ?? '',
      dictionary: brand?.dictionary_mapping ? { ...brand.dictionary_mapping } : {},
    })
  }

  const addDictEntry = () => {
    setForm((f) => ({ ...f, dictionary: { ...f.dictionary, '': '' } }))
  }

  const updateDictEntry = (oldKey, newKey, value) => {
    setForm((f) => {
      const d = { ...f.dictionary }
      if (oldKey !== undefined && oldKey !== '') delete d[oldKey]
      if (newKey !== '') d[newKey] = value
      return { ...f, dictionary: d }
    })
  }

  const removeDictEntry = (key) => {
    setForm((f) => {
      const d = { ...f.dictionary }
      delete d[key]
      return { ...f, dictionary: d }
    })
  }

  if (loading) return <p className="text-[var(--color-ink-muted)]">A carregar marcas...</p>
  if (error) return <p className="text-red-600">Erro: {error}</p>

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[var(--color-ink)] mb-2">Gestão de Marcas</h1>
      <p className="text-[var(--color-ink-muted)] mb-6">Configurar prefixos e mapeamento de siglas por marca.</p>

      <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] overflow-hidden shadow-[var(--shadow-card)]">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
              <th className="px-4 py-3 font-medium text-[var(--color-ink)]">Chave</th>
              <th className="px-4 py-3 font-medium text-[var(--color-ink)]">Nome</th>
              <th className="px-4 py-3 font-medium text-[var(--color-ink)]">SKU Prefix</th>
              <th className="px-4 py-3 font-medium text-[var(--color-ink)]">Ações</th>
            </tr>
          </thead>
          <tbody>
            {brands.map((b) => (
              <tr key={b.key} className="border-b border-[var(--color-border)] last:border-0">
                <td className="px-4 py-3 text-[var(--color-ink)]">{b.key}</td>
                <td className="px-4 py-3 text-[var(--color-ink)]">{b.name}</td>
                <td className="px-4 py-3 text-[var(--color-ink)] font-mono">{b.sku_prefix}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => openEdit(b)}
                    className="rounded-[var(--radius-button)] bg-[var(--color-accent)] px-3 py-1.5 text-sm text-white hover:bg-[var(--color-accent-hover)]"
                  >
                    Configurar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditing(null)}>
          <div
            className="w-full max-w-lg rounded-[var(--radius-card)] bg-[var(--color-surface-elevated)] p-6 shadow-[var(--shadow-modal)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-[var(--color-ink)] mb-4">
              {editing ? `Editar marca: ${editing}` : 'Nova marca'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-ink)] mb-1">Chave</label>
                <input
                  type="text"
                  value={form.key}
                  onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                  disabled={!!editing}
                  className="w-full rounded-[var(--radius-button)] border border-[var(--color-border)] px-3 py-2 text-[var(--color-ink)] disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-ink)] mb-1">Nome</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-[var(--radius-button)] border border-[var(--color-border)] px-3 py-2 text-[var(--color-ink)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-ink)] mb-1">SKU Prefix</label>
                <input
                  type="text"
                  value={form.sku_prefix}
                  onChange={(e) => setForm((f) => ({ ...f, sku_prefix: e.target.value }))}
                  placeholder="ex: UD"
                  className="w-full rounded-[var(--radius-button)] border border-[var(--color-border)] px-3 py-2 text-[var(--color-ink)]"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-[var(--color-ink)]">Mapeamento de siglas</label>
                  <button
                    type="button"
                    onClick={addDictEntry}
                    className="text-sm text-[var(--color-accent)] hover:underline"
                  >
                    + Adicionar
                  </button>
                </div>
                <div className="space-y-2 rounded-[var(--radius-button)] border border-[var(--color-border)] p-3 bg-[var(--color-surface)]">
                  {Object.entries(form.dictionary).map(([sigla, valor]) => (
                    <div key={sigla} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={sigla}
                        onChange={(e) => updateDictEntry(sigla, e.target.value, form.dictionary[sigla])}
                        placeholder="Sigla"
                        className="flex-1 rounded border border-[var(--color-border)] px-2 py-1.5 text-sm"
                      />
                      <span className="text-[var(--color-ink-muted)]">→</span>
                      <input
                        type="text"
                        value={valor}
                        onChange={(e) => updateDictEntry(sigla, sigla, e.target.value)}
                        placeholder="Substituição"
                        className="flex-1 rounded border border-[var(--color-border)] px-2 py-1.5 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeDictEntry(sigla)}
                        className="text-red-600 hover:underline text-sm"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                  {Object.keys(form.dictionary).length === 0 && (
                    <p className="text-sm text-[var(--color-ink-muted)]">Nenhuma entrada. Adicione siglas para remover/substituir no SKU.</p>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-[var(--radius-button)] border border-[var(--color-border)] px-4 py-2 text-[var(--color-ink)] hover:bg-[var(--color-surface)]"
              >
                Fechar
              </button>
              <button
                type="button"
                className="rounded-[var(--radius-button)] bg-[var(--color-accent)] px-4 py-2 text-white hover:bg-[var(--color-accent-hover)]"
              >
                Guardar (demo)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
