import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'
import { useStats } from '@/app/queries'
import { cn } from '@/lib/cn'
import { formatImportedAt } from '@/lib/datetime'
import { formatBytes } from '@/lib/format'
import { CalendarIcon, SettingsIcon, TimelineIcon } from '@/ui/icons'

interface NavItem {
  to: string
  labelKey: string
  icon: typeof TimelineIcon | null
  end?: boolean
}

const NAV: NavItem[] = [
  { to: '/', labelKey: 'nav.timeline', icon: TimelineIcon, end: true },
  { to: '/calendar', labelKey: 'nav.calendar', icon: CalendarIcon },
  { to: '/highlights', labelKey: 'nav.highlights', icon: null },
  { to: '/settings', labelKey: 'nav.settings', icon: SettingsIcon },
]

export function Sidebar() {
  const { t, i18n } = useTranslation()
  const { data: stats } = useStats()
  // lastImport is a raw ISO timestamp (empty when nothing imported yet); format for display.
  const lastImport = stats?.lastImport ? formatImportedAt(stats.lastImport, i18n.language) : '—'
  return (
    <aside className="w-[216px] shrink-0 border-r border-border flex flex-col p-3">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="w-5 h-5 rounded-md bg-[color:var(--moss)]" />
        <div>
          <div className="text-[14px] font-semibold leading-none tracking-wide">photo-diary</div>
          <div className="text-[10px] text-muted-foreground mt-1">{t('brand.subtitle')}</div>
        </div>
      </div>

      <nav className="mt-4 flex flex-col gap-0.5">
        {NAV.map(({ to, labelKey, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] no-underline',
                isActive
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )
            }
          >
            {Icon ? (
              <Icon className="w-4 h-4" />
            ) : (
              <span className="w-4 h-4 text-center text-[13px] leading-4">★</span>
            )}
            {t(labelKey)}
          </NavLink>
        ))}
      </nav>

      {stats && (
        <div className="mt-auto px-3 pb-2">
          <div className="h-px bg-border mb-3" />
          <div className="font-mono text-[10px] leading-5 text-muted-foreground">
            {t('unit.photo', { count: stats.photoCount })} · {formatBytes(stats.usedBytes)}
            <br />
            {t('sidebar.lastImport', { time: lastImport })}
          </div>
        </div>
      )}
    </aside>
  )
}
