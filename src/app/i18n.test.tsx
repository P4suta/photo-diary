import { render, screen } from '@testing-library/react'
import { useTranslation } from 'react-i18next'
import { describe, expect, it } from 'vitest'
import i18n from './i18n'

/** Minimal probe that renders a translated nav label. */
function Probe() {
  const { t } = useTranslation()
  return <span>{t('nav.timeline')}</span>
}

describe('i18n', () => {
  it('defaults to English', () => {
    render(<Probe />)
    expect(screen.getByText('Timeline')).toBeInTheDocument()
  })

  it('switches to the Japanese catalog', async () => {
    await i18n.changeLanguage('ja')
    render(<Probe />)
    expect(screen.getByText('タイムライン')).toBeInTheDocument()
  })

  it('applies plural + number formatting for counts', () => {
    expect(i18n.t('unit.photo', { count: 1 })).toBe('1 photo')
    expect(i18n.t('unit.photo', { count: 4318 })).toBe('4,318 photos')
  })
})
