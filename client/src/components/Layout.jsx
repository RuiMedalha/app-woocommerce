import { Outlet, NavLink } from 'react-router-dom'

const nav = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/marcas', label: 'Gestão de Marcas', icon: '🏷️' },
  { to: '/excel', label: 'Mapeamento Excel', icon: '📋' },
  { to: '/produtos', label: 'Produtos', icon: '📦' },
]

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-[var(--color-surface)]">
      <aside className="w-56 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface-elevated)] shadow-[var(--shadow-card)]">
        <div className="p-4 border-b border-[var(--color-border)]">
          <h1 className="font-semibold text-lg text-[var(--color-ink)]">Hotelequip Optimizer</h1>
        </div>
        <nav className="p-2">
          {nav.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-[var(--radius-button)] px-3 py-2.5 text-[var(--color-ink-muted)] transition-colors ${
                  isActive
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'hover:bg-[var(--color-border)] hover:text-[var(--color-ink)]'
                }`
              }
            >
              <span>{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
