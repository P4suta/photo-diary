import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSaveNote } from '@/app/queries'

/** A day's note. Display ⇄ inline edit; a few lines only (requirement 3). */
export function NoteEditor({ date, note }: { date: string; note: string | null }) {
  const { t } = useTranslation()
  const save = useSaveNote()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note ?? '')

  const startEdit = () => {
    setDraft(note ?? '')
    setEditing(true)
  }

  const commit = () => {
    setEditing(false)
    if (draft !== (note ?? '')) save.mutate({ date, note: draft })
  }

  if (editing) {
    return (
      <textarea
        // biome-ignore lint/a11y/noAutofocus: focusing on edit lets you type immediately
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit()
          if (e.key === 'Escape') setEditing(false)
        }}
        rows={2}
        placeholder={t('day.notePlaceholder')}
        className="w-full resize-none bg-transparent text-[15px] leading-7 outline-none placeholder:text-muted-foreground/50"
      />
    )
  }

  if (note) {
    return (
      <button type="button" onClick={startEdit} className="w-full text-left group">
        <p className="text-[15px] leading-7">{note}</p>
        <div className="mt-1 text-[11px] text-muted-foreground/0 group-hover:text-muted-foreground/70 transition-colors">
          {t('day.clickToEdit')}
        </div>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      className="text-[15px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
    >
      {t('day.writeNote')}
    </button>
  )
}
