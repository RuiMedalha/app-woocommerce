import { useState, useEffect } from 'react'

export default function ProductEditModal({ product, onClose, onSave }) {
  const [faqs, setFaqs] = useState([])
  const [suggestions, setSuggestions] = useState([])

  useEffect(() => {
    setFaqs(Array.isArray(product.faqs) ? product.faqs.map((f) => ({ ...f })) : [])
    setSuggestions(Array.isArray(product.suggestions) ? product.suggestions.map((s) => ({ ...s })) : [])
  }, [product])

  const addFaq = () => setFaqs((f) => [...f, { q: '', a: '' }])
  const updateFaq = (i, field, value) => {
    setFaqs((f) => f.map((item, j) => (j === i ? { ...item, [field]: value } : item)))
  }
  const removeFaq = (i) => setFaqs((f) => f.filter((_, j) => j !== i))

  const addSuggestion = () => setSuggestions((s) => [...s, { cell: '', value: '' }])
  const updateSuggestion = (i, field, value) => {
    setSuggestions((s) => s.map((item, j) => (j === i ? { ...item, [field]: value } : item)))
  }
  const removeSuggestion = (i) => setSuggestions((s) => s.filter((_, j) => j !== i))

  const handleSave = () => {
    onSave(product.id, { faqs, suggestions })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[var(--radius-card)] bg-[var(--color-surface-elevated)] p-6 shadow-[var(--shadow-modal)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-[var(--color-ink)] mb-1">Editar produto</h2>
        <p className="text-sm text-[var(--color-ink-muted)] mb-4">
          {product.sku} — {product.name}
        </p>

        {/* FAQs (Patos) */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-[var(--color-ink)]">FAQs (Patos)</h3>
            <button
              type="button"
              onClick={addFaq}
              className="text-sm text-[var(--color-accent)] hover:underline"
            >
              + Adicionar FAQ
            </button>
          </div>
          <div className="space-y-3 rounded-[var(--radius-button)] border border-[var(--color-border)] p-3 bg-[var(--color-surface)]">
            {faqs.map((faq, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  value={faq.q ?? ''}
                  onChange={(e) => updateFaq(i, 'q', e.target.value)}
                  placeholder="Pergunta"
                  className="rounded border border-[var(--color-border)] px-2 py-1.5 text-sm"
                />
                <input
                  type="text"
                  value={faq.a ?? ''}
                  onChange={(e) => updateFaq(i, 'a', e.target.value)}
                  placeholder="Resposta"
                  className="rounded border border-[var(--color-border)] px-2 py-1.5 text-sm"
                />
                <div className="sm:col-span-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeFaq(i)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
            {faqs.length === 0 && (
              <p className="text-sm text-[var(--color-ink-muted)]">Nenhum FAQ. Adicione perguntas e respostas.</p>
            )}
          </div>
        </section>

        {/* Sugestões (Células) */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-[var(--color-ink)]">Sugestões (Células)</h3>
            <button
              type="button"
              onClick={addSuggestion}
              className="text-sm text-[var(--color-accent)] hover:underline"
            >
              + Adicionar sugestão
            </button>
          </div>
          <div className="space-y-3 rounded-[var(--radius-button)] border border-[var(--color-border)] p-3 bg-[var(--color-surface)]">
            {suggestions.map((sug, i) => (
              <div key={i} className="flex gap-2 items-center flex-wrap">
                <input
                  type="text"
                  value={sug.cell ?? ''}
                  onChange={(e) => updateSuggestion(i, 'cell', e.target.value)}
                  placeholder="Célula (ex: B2)"
                  className="w-24 rounded border border-[var(--color-border)] px-2 py-1.5 text-sm"
                />
                <input
                  type="text"
                  value={sug.value ?? ''}
                  onChange={(e) => updateSuggestion(i, 'value', e.target.value)}
                  placeholder="Valor / sugestão"
                  className="flex-1 min-w-[120px] rounded border border-[var(--color-border)] px-2 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeSuggestion(i)}
                  className="text-sm text-red-600 hover:underline"
                >
                  Remover
                </button>
              </div>
            ))}
            {suggestions.length === 0 && (
              <p className="text-sm text-[var(--color-ink-muted)]">Nenhuma sugestão. Associe células ao valor sugerido.</p>
            )}
          </div>
        </section>

        <div className="flex justify-end gap-2 pt-4 border-t border-[var(--color-border)]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--radius-button)] border border-[var(--color-border)] px-4 py-2 text-[var(--color-ink)] hover:bg-[var(--color-surface)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-[var(--radius-button)] bg-[var(--color-accent)] px-4 py-2 text-white hover:bg-[var(--color-accent-hover)]"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}
