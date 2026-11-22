import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useScrollRestoration } from '../useScrollRestoration'

function NavigationHarness() {
  const navigate = useNavigate()
  useScrollRestoration()
  return (
    <>
      <button onClick={() => navigate('/second')}>Go forward</button>
      <button onClick={() => navigate(-1)}>Go back</button>
      <button onClick={() => navigate('/first#anchor')}>Go to anchor</button>
      <Routes>
        <Route path="/first" element={<div>First page</div>} />
        <Route path="/second" element={<div>Second page</div>} />
      </Routes>
    </>
  )
}

describe('useScrollRestoration', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('scrolls to the top on PUSH and restores the prior position on POP', async () => {
    let currentScrollY = 0
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => currentScrollY })
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    const scrollTo = vi.fn(({ top }: ScrollToOptions) => { currentScrollY = top ?? 0 })
    vi.spyOn(window, 'scrollTo').mockImplementation(scrollTo)
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/first']}>
        <NavigationHarness />
      </MemoryRouter>,
    )
    currentScrollY = 345
    fireEvent.scroll(window)

    await user.click(screen.getByRole('button', { name: 'Go forward' }))
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: 'instant' })

    await user.click(screen.getByRole('button', { name: 'Go back' }))
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 345, left: 0, behavior: 'instant' })
  })

  it('scrolls to a hash target', async () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    const target = document.createElement('div')
    target.id = 'anchor'
    target.scrollIntoView = vi.fn()
    document.body.appendChild(target)
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/second']}>
        <NavigationHarness />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: 'Go to anchor' }))

    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'instant' })
    target.remove()
  })
})