import { NavLink } from 'react-router'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/** Warehouse tasks and physical vehicle presence are separate destinations. */
export function WarehouseWorkspaceTabs() {
  const t = useT()
  return <nav aria-label={t('warehouse.presence.workspace')} className="flex gap-2 overflow-x-auto py-1">
    {([{ to: '/kho', label: 'warehouse.list.title' }, { to: '/kho/xe', label: 'warehouse.presence.pageTitle' }] as const).map(({ to, label }) => <NavLink
      key={to} to={to} end className={({ isActive }) => cn('inline-flex min-h-14 shrink-0 items-center rounded-md border px-4 font-semibold', isActive ? 'border-cyan-300 bg-cyan-300 text-cyan-950' : 'border-sky-text-3 text-sky-text')}
    >{t(label)}</NavLink>)}
  </nav>
}
