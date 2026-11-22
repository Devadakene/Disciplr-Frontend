import { useEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

export function useScrollRestoration(): void {
  const location = useLocation()
  const navigationType = useNavigationType()
  const positions = useRef(new Map<string, number>())
  const currentKey = useRef(location.key)
  const previousLocation = useRef({ pathname: location.pathname, hash: location.hash, key: location.key })

  useEffect(() => {
    const savePosition = () => positions.current.set(currentKey.current, window.scrollY)
    window.addEventListener('scroll', savePosition, { passive: true })
    return () => window.removeEventListener('scroll', savePosition)
  }, [])

  useEffect(() => {
    positions.current.set(currentKey.current, window.scrollY)
    currentKey.current = location.key
    const samePage = previousLocation.current.pathname === location.pathname
      && previousLocation.current.hash === location.hash
    const keyChanged = previousLocation.current.key !== location.key
    previousLocation.current = { pathname: location.pathname, hash: location.hash, key: location.key }
    if (samePage && keyChanged) return
    const frame = window.requestAnimationFrame(() => {
      if (location.hash) {
        const target = document.getElementById(decodeURIComponent(location.hash.slice(1)))
        if (target) {
          target.scrollIntoView({ behavior: 'instant' })
          return
        }
      }

      const scrollY = navigationType === 'POP'
        ? positions.current.get(location.key) ?? 0
        : 0
      window.scrollTo({ top: scrollY, left: 0, behavior: 'instant' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [location.hash, location.key, navigationType])
}