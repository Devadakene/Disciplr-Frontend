import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { DOCUMENT_TITLE_EVENT } from '../hooks/useDocumentTitle'
import { formatDocumentTitle, getRouteTitle } from '../routes/titles'

export default function RouteAnnouncer() {
  const location = useLocation()
  const [announcement, setAnnouncement] = useState('')
  const hasNavigated = useRef(false)

  useEffect(() => {
    document.title = formatDocumentTitle(getRouteTitle(location.pathname))
    if (hasNavigated.current) {
      setAnnouncement(document.title)
    }
    hasNavigated.current = true
  }, [location.pathname])

  useEffect(() => {
    const announceTitle = () => setAnnouncement(document.title)
    window.addEventListener(DOCUMENT_TITLE_EVENT, announceTitle)
    return () => window.removeEventListener(DOCUMENT_TITLE_EVENT, announceTitle)
  }, [])

  return (
    <div className="visually-hidden" aria-live="polite" aria-atomic="true">
      {announcement}
    </div>
  )
}