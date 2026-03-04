import { useState } from 'react'

const DEFAULT_COLUMNS = ['SKU', 'Nome', 'Preço', 'Descrição', 'Categoria', 'Imagem']

export default function ExcelMapping() {
  const [columns, setColumns] = useState(DEFAULT_COLUMNS)
  const [newCol, setNewCol] = useState('')
  const [mapping, setMapping] = useState({})
  const [filePath, setFilePath] = useState('')
  const [importResult, setImportResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const addColumn = () => {
    const v = newCol.trim()
    if (v && !columns.includes(v)) {
      setColumns((c) => [...c, v])
      setNewCol('')
    }
  }

  const removeColumn = (col) => {
    setColumns((c) => c.filter((x) => x !== col))
    setMapping((m) => {
      const next = { ...m }
      delete next[col]
      return next
    })
  }

  const setMap = (col, excelCol) => {
    setMapping((m) => ({ ...m, [col]: excelCol }))
  }

  const runImport = () => {
    if (!filePath.trim()) return
    setLoading(true)
    setImportResult(null)
    const api = import.meta.env.VITE_API_URL || 'http://localhost:4000'
    fetch(`${api}/excel/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath: filePath.trim() }),
    })
      .then((r) => r.json())
      .then((data) => setImportResult(data))
      .catch((e) => setImportResult({ error: e.message }))
      .finally(() => setLoading(false))
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[var(--color-ink)] mb-2">Mapeamento de Excel dinâmico</h1>
      <p className="text-[var(--color-ink-muted)] mb-6">
        Defina as colunas do modelo e mapeie para as colunas do ficheiro Excel (por índice ou nome).
      </p>

      <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-6 shadow-[var(--shadow-card)] space-y-6">
        <div>
          <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">Colunas do modelo</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {columns.map((col) => (
              <span
                key={col}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--color-accent)]/10 px-3 py-1 text-sm text-[var(--color-accent)]"
              >
                {col}
                <button
                  type="button"
                  onClick={() => removeColumn(col)}
                  className="hover:text-[var(--color-accent-hover)]"
                  aria-label={`Remover ${col}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newCol}
              onChange={(e) => setNewCol(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addColumn()}
              placeholder="Nova coluna"
              className="flex-1 rounded-[var(--radius-button)] border border-[var(--color-border)] px-3 py-2 text-[var(--color-ink)]"
            />
            <button
              type="button"
              onClick={addColumn}
              className="rounded-[var(--radius-button)] bg-[var(--color-accent)] px-4 py-2 text-white hover:bg-[var(--color-accent-hover)]"
            >
              Adicionar
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">Mapeamento → Coluna Excel</label>
          <div className="space-y-2">
            {columns.map((col) => (
              <div key={col} className="flex items-center gap-3">
                <span className="w-32 font-medium text-[var(--color-ink)]">{col}</span>
                <span className="text-[var(--color-ink-muted)]">→</span>
                <input
                  type="text"
                  value={mapping[col] ?? ''}
                  onChange={(e) => setMap(col, e.target.value)}
                  placeholder="A, B, 1, 2 ou nome"
                  className="flex-1 rounded-[var(--radius-button)] border border-[var(--color-border)] px-3 py-2 text-[var(--color-ink)]"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-[var(--color-border)]">
          <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">Caminho do ficheiro Excel</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              placeholder="C:\pasta\ficheiro.xlsx"
              className="flex-1 rounded-[var(--radius-button)] border border-[var(--color-border)] px-3 py-2 text-[var(--color-ink)]"
            />
            <button
              type="button"
              onClick={runImport}
              disabled={loading}
              className="rounded-[var(--radius-button)] bg-[var(--color-accent)] px-4 py-2 text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
            >
              {loading ? 'A importar...' : 'Importar'}
            </button>
          </div>
          {importResult && (
            <div className="mt-3 rounded-[var(--radius-button)] bg-[var(--color-surface)] p-3 text-sm">
              {importResult.error ? (
                <p className="text-red-600">{importResult.error}</p>
              ) : (
                <p className="text-[var(--color-ink-muted)]">
                  Linhas lidas: <strong>{importResult.rowsCount ?? 0}</strong>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
