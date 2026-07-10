import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { makeFakeLibrary, renderWithProviders } from '@/test/utils'
import { NoteEditor } from './NoteEditor'

const PLACEHOLDER = 'A few lines about today.'

describe('NoteEditor', () => {
  it('shows "Write a note…" when empty and enters edit mode on click', async () => {
    const user = userEvent.setup()
    renderWithProviders(<NoteEditor date="2026-07-05" note={null} />)
    await user.click(screen.getByRole('button', { name: 'Write a note…' }))
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeInTheDocument()
  })

  it('saves on Cmd/Ctrl+Enter', async () => {
    const user = userEvent.setup()
    const library = makeFakeLibrary()
    renderWithProviders(<NoteEditor date="2026-07-05" note={null} />, { library })
    await user.click(screen.getByRole('button', { name: 'Write a note…' }))
    const ta = screen.getByPlaceholderText(PLACEHOLDER)
    await user.type(ta, 'a good day')
    await user.keyboard('{Control>}{Enter}{/Control}')
    await waitFor(() => expect(library.saveNote).toHaveBeenCalledWith('2026-07-05', 'a good day'))
  })

  it('Escape cancels (no save)', async () => {
    const user = userEvent.setup()
    const library = makeFakeLibrary()
    renderWithProviders(<NoteEditor date="2026-07-05" note={null} />, { library })
    await user.click(screen.getByRole('button', { name: 'Write a note…' }))
    const ta = screen.getByPlaceholderText(PLACEHOLDER)
    await user.type(ta, 'draft')
    await user.keyboard('{Escape}')
    expect(screen.queryByPlaceholderText(PLACEHOLDER)).toBeNull()
    expect(library.saveNote).not.toHaveBeenCalled()
  })

  it('saves on blur when changed', async () => {
    const user = userEvent.setup()
    const library = makeFakeLibrary()
    renderWithProviders(<NoteEditor date="2026-07-05" note={null} />, { library })
    await user.click(screen.getByRole('button', { name: 'Write a note…' }))
    const ta = screen.getByPlaceholderText(PLACEHOLDER)
    await user.type(ta, 'added')
    ta.blur()
    await waitFor(() => expect(library.saveNote).toHaveBeenCalledWith('2026-07-05', 'added'))
  })

  it('does not save on blur when unchanged', async () => {
    const user = userEvent.setup()
    const library = makeFakeLibrary()
    renderWithProviders(<NoteEditor date="2026-07-05" note="existing note" />, { library })
    await user.click(screen.getByRole('button', { name: /existing note/ }))
    const ta = screen.getByPlaceholderText(PLACEHOLDER)
    ta.blur()
    expect(library.saveNote).not.toHaveBeenCalled()
  })
})
