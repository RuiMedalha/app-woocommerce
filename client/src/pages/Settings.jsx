import { useState, useEffect } from 'react'

const raw = (import.meta.env.VITE_API_URL ?? '').toString().trim().replace(/\/$/, '')
const API_BASE = import.meta.env.MODE === 'production' ? '' : (raw || 'http://localhost:4000')
function apiPath(segment) {
  if (!API_BASE) return `/api/${segment}`
  return `${API_BASE}/api/${segment}`
}

const AI_MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (rápido, económico)' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-4', label: 'GPT-4' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
]

const DEFAULT_PROMPT = `És um especialista em SEO e copywriting para e-commerce de equipamentos de hotelaria e restauração.
Gera conteúdo em Português de Portugal (PT-PT). Usa os dados do Excel, da Biblioteca Técnica e do site do fornecedor para enriquecer títulos e descrições.`

export default function Settings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [form, setForm] = useState({
    openai_api_key: '',
    openai_model: 'gpt-4o-mini',
    seo_system_prompt: DEFAULT_PROMPT,
  })

  useEffect(() => {
    fetch(apiPath('settings'))
      .then((r) => r.json())
      .then((data) => {
        setForm((f) => ({
          ...f,
          openai_api_key: data.openai_api_key ?? '',
          openai_model: data.openai_model || 'gpt-4o-mini',
          seo_system_prompt: data.seo_system_prompt?.trim() || DEFAULT_PROMPT,
        }))
      })
      .catch(() => setMessage('Erro ao carregar configurações.'))
      .finally(() => setLoading(false))
  }, [])

  const saveSetting = async (key, value) => {
    const res = await fetch(apiPath('settings'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: value ?? '' }),
    })
    if (!res.ok) throw new Error('Falha ao guardar')
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await saveSetting('openai_api_key', form.openai_api_key)
      await saveSetting('openai_model', form.openai_model)
      await saveSetting('seo_system_prompt', form.seo_system_prompt)
      setMessage('Configurações guardadas.')
    } catch (e) {
      setMessage(e.message || 'Erro ao guardar.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-[var(--color-ink-muted)]">A carregar...</p>

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[var(--color-ink)] mb-2">Configurações</h1>
      <p className="text-[var(--color-ink-muted)] mb-6">
        Chaves de API, modelo de IA e prompt usado na otimização de produtos.
      </p>

      <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-6 shadow-[var(--shadow-card)] space-y-6 max-w-2xl">
        <div>
          <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">OpenAI API Key</label>
          <input
            type="password"
            value={form.openai_api_key}
            onChange={(e) => setForm((f) => ({ ...f, openai_api_key: e.target.value }))}
            placeholder="sk-..."
            className="w-full rounded-[var(--radius-button)] border border-[var(--color-border)] px-3 py-2 text-[var(--color-ink)]"
            autoComplete="off"
          />
          <p className="mt-1 text-xs text-[var(--color-ink-muted)]">Usada para otimização de textos e geração de conteúdo com IA.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">Modelo de IA</label>
          <select
            value={form.openai_model}
            onChange={(e) => setForm((f) => ({ ...f, openai_model: e.target.value }))}
            className="w-full rounded-[var(--radius-button)] border border-[var(--color-border)] px-3 py-2 text-[var(--color-ink)]"
          >
            {AI_MODELS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-[var(--color-ink-muted)]">Modelo usado ao clicar em &quot;Otimizar com IA&quot; nos produtos.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">Prompt para a IA (instruções do sistema)</label>
          <textarea
            value={form.seo_system_prompt}
            onChange={(e) => setForm((f) => ({ ...f, seo_system_prompt: e.target.value }))}
            rows={8}
            placeholder={DEFAULT_PROMPT}
            className="w-full rounded-[var(--radius-button)] border border-[var(--color-border)] px-3 py-2 text-[var(--color-ink)] resize-y"
          />
          <p className="mt-1 text-xs text-[var(--color-ink-muted)]">Instruções que a IA segue ao gerar títulos e descrições. Pode incluir tom de voz, regras de SEO ou termos a evitar.</p>
        </div>

        {message && (
          <p className={`text-sm ${message.includes('Erro') ? 'text-red-600' : 'text-[var(--color-ink-muted)]'}`}>{message}</p>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-[var(--radius-button)] bg-[var(--color-accent)] px-4 py-2 text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
        >
          {saving ? 'A guardar...' : 'Guardar configurações'}
        </button>
      </div>
    </div>
  )
}
