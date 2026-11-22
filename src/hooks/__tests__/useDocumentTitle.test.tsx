import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOCUMENT_TITLE_EVENT, useDocumentTitle } from '../useDocumentTitle'

const INITIAL_TITLE = 'Disciplr'

describe('useDocumentTitle', () => {
  let listener: ReturnType<typeof vi.fn>

  beforeEach(() => {
    document.title = INITIAL_TITLE
    listener = vi.fn()
    window.addEventListener(DOCUMENT_TITLE_EVENT, listener)
  })

  afterEach(() => {
    window.removeEventListener(DOCUMENT_TITLE_EVENT, listener)
  })

  it('formats document.title and dispatches DOCUMENT_TITLE_EVENT once per change', () => {
    const { rerender } = renderHook(({ title }) => useDocumentTitle(title), {
      initialProps: { title: 'Vaults' },
    })

    expect(document.title).toBe('Vaults · Disciplr')
    expect(listener).toHaveBeenCalledTimes(1)

    rerender({ title: 'Vaults' })
    expect(listener).toHaveBeenCalledTimes(1)

    rerender({ title: 'Dashboard' })
    expect(document.title).toBe('Dashboard · Disciplr')
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('is a no-op when title is an empty string', () => {
    renderHook(() => useDocumentTitle(''))

    expect(document.title).toBe(INITIAL_TITLE)
    expect(listener).not.toHaveBeenCalled()
  })

  it('restores the previous title on unmount when still unchanged', () => {
    const { unmount } = renderHook(() => useDocumentTitle('Vaults'))

    expect(document.title).toBe('Vaults · Disciplr')

    unmount()
    expect(document.title).toBe(INITIAL_TITLE)
  })

  it('does not clobber a title set by another component before unmount', () => {
    const { unmount } = renderHook(() => useDocumentTitle('Vaults'))

    expect(document.title).toBe('Vaults · Disciplr')
    expect(listener).toHaveBeenCalledTimes(1)

    document.title = 'Other'
    unmount()

    expect(document.title).toBe('Other')
  })
})
