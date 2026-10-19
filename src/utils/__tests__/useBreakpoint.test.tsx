import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { breakpoints, getBreakpointQuery, useBreakpoint } from '../useBreakpoint'

function createMatchMediaController(initialMatches: Record<string, boolean>) {
  const listeners = new Map<string, Set<(event: MediaQueryListEvent) => void>>()
  const matches = { ...initialMatches }

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((media: string) => {
      if (!listeners.has(media)) {
        listeners.set(media, new Set())
      }

      return {
        get matches() {
          return Boolean(matches[media])
        },
        media,
        addEventListener: (_event: string, listener: (event: MediaQueryListEvent) => void) => {
          listeners.get(media)?.add(listener)
        },
        removeEventListener: (_event: string, listener: (event: MediaQueryListEvent) => void) => {
          listeners.get(media)?.delete(listener)
        },
        dispatchEvent: vi.fn(),
      }
    }),
  })

  return {
    setMatches(media: string, nextValue: boolean) {
      matches[media] = nextValue
      const event = { matches: nextValue, media } as MediaQueryListEvent
      listeners.get(media)?.forEach((listener) => listener(event))
    },
    listenerCount(media: string) {
      const set = listeners.get(media)
      return set ? set.size : 0
    },
  }
}

describe('useBreakpoint', () => {
  it('exports the canonical breakpoint values', () => {
    expect(breakpoints).toEqual({
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
    })
    expect(getBreakpointQuery('md')).toBe('(min-width: 768px)')
  })

  it('reads matchMedia and updates when the media query changes', () => {
    const mdQuery = getBreakpointQuery('md')
    const media = createMatchMediaController({ [mdQuery]: false })
    const { result } = renderHook(() => useBreakpoint('md'))

    expect(window.matchMedia).toHaveBeenCalledWith(mdQuery)
    expect(result.current).toBe(false)

    act(() => {
      media.setMatches(mdQuery, true)
    })

    expect(result.current).toBe(true)
  })

  it('resubscribes when the requested breakpoint changes', () => {
    const mdQuery = getBreakpointQuery('md')
    const lgQuery = getBreakpointQuery('lg')
    const media = createMatchMediaController({ [mdQuery]: true, [lgQuery]: false })
    const { rerender, result } = renderHook(({ breakpoint }) => useBreakpoint(breakpoint), {
      initialProps: { breakpoint: 'md' as const },
    })

    expect(result.current).toBe(true)
    expect(media.listenerCount(mdQuery)).toBe(1)

    rerender({ breakpoint: 'lg' as const })

    expect(result.current).toBe(false)
    expect(media.listenerCount(mdQuery)).toBe(0)
    expect(media.listenerCount(lgQuery)).toBe(1)
  })

  it('removes the media query listener on unmount', () => {
    const xlQuery = getBreakpointQuery('xl')
    const media = createMatchMediaController({ [xlQuery]: true })
    const { unmount } = renderHook(() => useBreakpoint('xl'))

    expect(media.listenerCount(xlQuery)).toBe(1)
    unmount()
    expect(media.listenerCount(xlQuery)).toBe(0)
  })

  it('returns false when matchMedia is unavailable', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: undefined,
    })

    const { result } = renderHook(() => useBreakpoint('sm'))

    expect(result.current).toBe(false)
  })

  it('returns false without throwing when matchMedia exists but returns undefined', () => {
    // e.g. a test that called vi.restoreAllMocks() after setupTests defined the
    // matchMedia stub: the function exists but yields no MediaQueryList.
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue(undefined),
    })

    const { result } = renderHook(() => useBreakpoint('sm'))

    expect(result.current).toBe(false)
  })
})