import { Link } from 'react-router-dom'

const cards = [
  { title: 'Marcas', value: '—', to: '/marcas', desc: 'Configurar prefixos e siglas' },
  { title: 'Produtos', value: '—', to: '/produtos', desc: 'FAQs (Patos) e Sugestões (Células)' },
  { title: 'Excel', value: '—', to: '/excel', desc: 'Mapeamento dinâmico de colunas' },
]

export default function Dashboard() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-[var(--color-ink)] mb-2">Dashboard</h1>
      <p className="text-[var(--color-ink-muted)] mb-8">Visão geral e atalhos do Hotelequip Optimizer.</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ title, value, to, desc }) => (
          <Link
            key={to}
            to={to}
            className="block rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-lg"
          >
            <div className="text-[var(--color-ink-muted)] text-sm font-medium">{title}</div>
            <div className="mt-1 text-2xl font-semibold text-[var(--color-ink)]">{value}</div>
            <div className="mt-2 text-sm text-[var(--color-ink-muted)]">{desc}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
