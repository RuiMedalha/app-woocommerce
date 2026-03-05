import { useState, useEffect, useRef } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const DEFAULT_COLUMNS = ['SKU', 'Nome', 'Preço', 'Descrição', 'Categoria', 'Imagem', 'ID']

export default function ExcelMapping() {
  const [columns, setColumns] = useState(DEFAULT_COLUMNS)
  const [newCol, setNewCol] = useState('')
  const [mapping, setMapping] = useState({})
  const [filePath, setFilePath] = useState('')
  const [importResult, setImportResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const [inventoryFiles, setInventoryFiles] = useState([])
  const [libraryFiles, setLibraryFiles] = useState([])
  const [uploading, setUploading] = useState({ inv: false, lib: false })
  const [processing, setProcessing] = useState(null)
  const invInputRef = useRef(null)
  const libInputRef = useRef(null)

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

  const loadFiles = () => {
    fetch(`${API}/api/uploads`)
      .then((r) => r.json())
      .then((data) => {
        const all = Array.isArray(data) ? data : []
        setInventoryFiles(all.filter((f) => f.file_kind === 'inventory' || f.file_kind == null))
        setLibraryFiles(all.filter((f) => f.file_kind === 'library'))
      })
      .catch(() => {})
  }

  useEffect(() => {
    loadFiles()
  }, [])

  const uploadFile = async (file, fileKind) => {
    const form = new FormData()
    form.append('file', file)
    form.append('file_kind', fileKind)
    setUploading((u) => ({ ...u, [fileKind === 'inventory' ? 'inv' : 'lib']: true }))
    try {
      const res = await fetch(`${API}/api/upload`, { method: 'POST', body: form })
      if (res.ok) loadFiles()
    } finally {
      setUploading((u) => ({ ...u, [fileKind === 'inventory' ? 'inv' : 'lib']: false }))
    }
  }

  const processFile = async (fileId, columnMapping = null) => {
    setProcessing(fileId)
    try {
      await fetch(`${API}/api/upload/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId,
          columnMapping: columnMapping || mapping,
        }),
      })
      loadFiles()
    } finally {
      setProcessing(null)
    }
  }

  const runImport = () => {
    if (!filePath.trim()) return
    setLoading(true)
    setImportResult(null)
    fetch(`${API}/excel/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath: filePath.trim() }),
    })
      .then((r) => r.json())
      .then((data) => setImportResult(data))
      .catch((e) => setImportResult({ error: e.message }))
      .finally(() => setLoading(false))
  }

  const columnMapToApi = () => {
    const apiKeys = { 'Descrição': 'Descricao', 'Preço': 'Preco', 'Nome': 'Nome', 'SKU': 'SKU', 'ID': 'ID', 'Categoria': 'Categoria', 'Imagem': 'Imagem' }
    const excelCols = { SKU: 'A', Nome: 'B', Descricao: 'C', Preco: 'D', ID: 'E' }
    const apiMap = {}
    columns.forEach((col) => {
      const key = apiKeys[col] || col
      const v = mapping[col]
      apiMap[key] = (v && String(v).trim()) || excelCols[key] || ''
    })
    return apiMap
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[var(--color-ink)] mb-2">Mapeamento Excel</h1>
      <p className="text-[var(--color-ink-muted)] mb-6">
        Carregue o ficheiro de produtos (Excel/CSV), mapeie as colunas e processe. Carregue também PDFs da Udex na Base de Conhecimento.
      </p>

      {/* Upload ficheiro de produtos (Inventário) */}
      <section className="mb-8">
        <h2 className="text-lg font-medium text-[var(--color-ink)] mb-3">Upload do ficheiro de produtos</h2>
        <p className="text-sm text-[var(--color-ink-muted)] mb-2">
          Apenas .xlsx, .xls ou .csv. Após carregar, processe para importar os produtos para a lista.
        </p>
        <div
          className="mb-4 rounded-[var(--radius-card)] border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center cursor-pointer hover:border-[var(--color-accent)]"
          onClick={() => invInputRef.current?.click()}
        >
          <input
            ref={invInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) uploadFile(f, 'inventory')
              e.target.value = ''
            }}
          />
          {uploading.inv ? (
            <p className="text-[var(--color-ink-muted)]">A carregar...</p>
          ) : (
            <p className="text-[var(--color-ink-muted)]">Clique ou arraste um ficheiro .xlsx, .xls ou .csv para aqui.</p>
          )}
        </div>
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                <th className="px-4 py-2 font-medium text-[var(--color-ink)]">Ficheiro</th>
                <th className="px-4 py-2 font-medium text-[var(--color-ink)]">Estado</th>
                <th className="px-4 py-2 font-medium text-[var(--color-ink)]">Produtos</th>
                <th className="px-4 py-2 font-medium text-[var(--color-ink)]">Ações</th>
              </tr>
            </thead>
            <tbody>
              {inventoryFiles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-[var(--color-ink-muted)]">Nenhum ficheiro de inventário.</td>
                </tr>
              ) : (
                inventoryFiles.map((f) => (
                  <tr key={f.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="px-4 py-2 text-[var(--color-ink)]">{f.filename || f.path}</td>
                    <td className="px-4 py-2">{f.status || 'Aguardando processamento'}</td>
                    <td className="px-4 py-2">{f.product_count != null ? f.product_count : '—'}</td>
                    <td className="px-4 py-2">
                      {f.status === 'Aguardando processamento' && (
                        <button
                          type="button"
                          disabled={processing === f.id}
                          onClick={() => processFile(f.id, columnMapToApi())}
                          className="rounded-[var(--radius-button)] bg-[var(--color-accent)] px-2 py-1 text-white text-sm hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
                        >
                          {processing === f.id ? 'A processar...' : 'Processar'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Base de Conhecimento (PDFs Udex) */}
      <section className="mb-8">
        <h2 className="text-lg font-medium text-[var(--color-ink)] mb-3">Base de Conhecimento (Knowledge Base)</h2>
        <p className="text-sm text-[var(--color-ink-muted)] mb-2">
          Faça upload dos PDFs da Udex (manuais, catálogos). O texto é guardado para a IA usar ao otimizar produtos. Não cria produtos.
        </p>
        <div
          className="mb-4 rounded-[var(--radius-card)] border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center cursor-pointer hover:border-[var(--color-accent)]"
          onClick={() => libInputRef.current?.click()}
        >
          <input
            ref={libInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) uploadFile(f, 'library')
              e.target.value = ''
            }}
          />
          {uploading.lib ? (
            <p className="text-[var(--color-ink-muted)]">A carregar...</p>
          ) : (
            <p className="text-[var(--color-ink-muted)]">Clique ou arraste um ficheiro .pdf para aqui.</p>
          )}
        </div>
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                <th className="px-4 py-2 font-medium text-[var(--color-ink)]">Ficheiro</th>
                <th className="px-4 py-2 font-medium text-[var(--color-ink)]">Estado</th>
                <th className="px-4 py-2 font-medium text-[var(--color-ink)]">Ações</th>
              </tr>
            </thead>
            <tbody>
              {libraryFiles.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-4 text-[var(--color-ink-muted)]">Nenhum PDF na base de conhecimento.</td>
                </tr>
              ) : (
                libraryFiles.map((f) => (
                  <tr key={f.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="px-4 py-2 text-[var(--color-ink)]">{f.filename || f.path}</td>
                    <td className="px-4 py-2">{f.status || 'Aguardando processamento'}</td>
                    <td className="px-4 py-2">
                      {f.status === 'Aguardando processamento' && (
                        <button
                          type="button"
                          disabled={processing === f.id}
                          onClick={() => processFile(f.id)}
                          className="rounded-[var(--radius-button)] bg-[var(--color-accent)] px-2 py-1 text-white text-sm hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
                        >
                          {processing === f.id ? 'A processar...' : 'Processar'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Mapeamento de colunas (existente) */}
      <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-6 shadow-[var(--shadow-card)] space-y-6">
        <h2 className="text-lg font-medium text-[var(--color-ink)]">Mapeamento de colunas (para Processar)</h2>
        <div>
          <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">Colunas do modelo</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {columns.map((col) => (
              <span
                key={col}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--color-accent)]/10 px-3 py-1 text-sm text-[var(--color-accent)]"
              >
                {col}
                <button type="button" onClick={() => removeColumn(col)} className="hover:text-[var(--color-accent-hover)]" aria-label={`Remover ${col}`}>
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
          <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">Mapeamento → Coluna Excel (A, B, C… ou nome)</label>
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
          <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">Caminho do ficheiro Excel (alternativa ao upload)</label>
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
                <p className="text-[var(--color-ink-muted)]">Linhas lidas: <strong>{importResult.rowsCount ?? 0}</strong></p>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
