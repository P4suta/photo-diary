import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { Locale } from '@/app/i18n'
import { useFolders, useStats } from '@/app/queries'
import { type Accent, type ThemeMode, useTheme } from '@/app/theme'
import type { WatchedFolder } from '@/domain/models'
import { formatBytes, formatCount, splitBytes } from '@/lib/format'
import { Button } from '@/ui/Button'
import { FolderIcon } from '@/ui/icons'
import { Segmented } from '@/ui/Segmented'

export function SettingsView() {
  const { t, i18n } = useTranslation()
  const { data: folders } = useFolders()
  const { data: stats } = useStats()
  const { mode, accent, showEmptyDays, setMode, setAccent, setShowEmptyDays } = useTheme()

  return (
    <div className="p-8">
      <div className="max-w-[880px]">
        <h2 className="text-[20px] font-semibold">{t('settings.title')}</h2>

        {/* Watched folders */}
        <section className="mt-6">
          <h3 className="text-[13px] font-semibold">{t('settings.watchedFolders')}</h3>
          <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
            {t('settings.watchedFoldersDesc')}
          </p>
          <div className="mt-3 rounded-lg border border-border divide-y divide-border overflow-hidden">
            {folders?.map((f) => (
              <FolderRow key={f.id} folder={f} />
            ))}
          </div>
          <Button variant="outline" className="mt-3">
            {t('settings.addFolder')}
          </Button>
        </section>

        {/* Internal library */}
        {stats && (
          <section className="mt-8 pt-6 border-t border-border">
            <h3 className="text-[13px] font-semibold">{t('settings.internalLibrary')}</h3>
            <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
              {t('settings.internalLibraryDesc')}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <StatCard label={t('settings.statTotalUsed')} {...splitBytes(stats.usedBytes)} />
              <StatCard
                label={t('settings.statPhotos')}
                value={formatCount(stats.photoCount)}
                unit={t('settings.photoUnit')}
              />
              <StatCard
                label={t('settings.statRecordedDays')}
                value={formatCount(stats.dayCount)}
                unit={t('settings.dayUnit')}
              />
            </div>
            <div className="mt-3 rounded-lg border border-border bg-card px-4 py-3 flex items-center gap-3">
              <div className="min-w-0">
                <div className="font-mono text-[10px] text-muted-foreground">
                  {t('settings.storageLocation')}
                </div>
                <div className="font-mono text-[12px] truncate mt-0.5">{stats.location}</div>
              </div>
              <Button variant="outline" size="sm" className="ml-auto shrink-0">
                {t('settings.openFolder')}
              </Button>
            </div>
            <div className="mt-3 rounded-lg border border-border bg-card px-4 py-3 flex items-center gap-3">
              <div>
                <div className="font-mono text-[10px] text-muted-foreground">
                  {t('settings.thumbnailCache')}
                </div>
                <div className="text-[13px] mt-0.5">
                  {formatBytes(stats.thumbnailCacheBytes)}{' '}
                  <span className="text-[11px] text-muted-foreground">
                    {t('settings.thumbnailCacheNote')}
                  </span>
                </div>
              </div>
              <div className="ml-auto flex items-center gap-1.5 shrink-0">
                <Button variant="outline" size="sm">
                  {t('settings.regenerate')}
                </Button>
                <Button variant="ghost" size="sm">
                  {t('settings.clear')}
                </Button>
              </div>
            </div>
          </section>
        )}

        {/* Appearance */}
        <section className="mt-8 pt-6 border-t border-border">
          <h3 className="text-[13px] font-semibold">{t('settings.appearance')}</h3>
          <div className="mt-3 flex flex-col gap-4">
            <SettingRow label={t('settings.language')}>
              <Segmented<Locale>
                options={[
                  { value: 'en', label: 'English' },
                  { value: 'ja', label: '日本語' },
                ]}
                value={(i18n.resolvedLanguage ?? 'en') as Locale}
                onChange={(v) => i18n.changeLanguage(v)}
              />
            </SettingRow>
            <SettingRow label={t('settings.theme')}>
              <Segmented<ThemeMode>
                options={[
                  { value: 'light', label: t('settings.themeLight') },
                  { value: 'dark', label: t('settings.themeDark') },
                  { value: 'system', label: t('settings.themeSystem') },
                ]}
                value={mode}
                onChange={setMode}
              />
            </SettingRow>
            <SettingRow label={t('settings.accent')}>
              <Segmented<Accent>
                options={[
                  { value: 'moss', label: t('settings.accentMoss') },
                  { value: 'dusk', label: t('settings.accentDusk') },
                  { value: 'clay', label: t('settings.accentClay') },
                ]}
                value={accent}
                onChange={setAccent}
              />
            </SettingRow>
            <SettingRow label={t('settings.emptyDays')}>
              <Segmented
                options={[
                  { value: 'show', label: t('settings.show') },
                  { value: 'hide', label: t('settings.hide') },
                ]}
                value={showEmptyDays ? 'show' : 'hide'}
                onChange={(v) => setShowEmptyDays(v === 'show')}
              />
            </SettingRow>
          </div>
        </section>

        <div className="mt-8 pt-6 border-t border-border">
          <Link
            to="/tokens"
            className="font-mono text-[11px] text-muted-foreground hover:text-foreground underline"
          >
            {t('settings.viewTokens')}
          </Link>
        </div>
      </div>
    </div>
  )
}

function FolderRow({ folder }: { folder: WatchedFolder }) {
  const { t } = useTranslation()
  const state = folder.status === 'watching' ? t('settings.watching') : t('settings.disconnected')
  const status = `${state} · ${t('settings.lastScan', { time: folder.lastScan })} · ${t('unit.photo', { count: folder.photoCount })}`
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-card">
      <FolderIcon className="w-4 h-4 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <div className="font-mono text-[12px] truncate">{folder.path}</div>
        <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{status}</div>
      </div>
      <div className="ml-auto flex items-center gap-1.5 shrink-0">
        <Button variant="outline" size="sm">
          {t('settings.rescan')}
        </Button>
        <Button variant="danger" size="sm">
          {t('settings.remove')}
        </Button>
      </div>
    </div>
  )
}

function StatCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3.5">
      <div className="font-mono text-[10px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-[20px] font-semibold leading-none">
        {value} <span className="text-[12px] font-normal text-muted-foreground">{unit}</span>
      </div>
    </div>
  )
}

function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-[13px] text-muted-foreground w-28 shrink-0">{label}</span>
      {children}
    </div>
  )
}
