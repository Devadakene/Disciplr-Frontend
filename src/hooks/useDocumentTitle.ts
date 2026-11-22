import { useEffect } from 'react'

export const DOCUMENT_TITLE_EVENT = 'disciplr:document-title-change'

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    if (!title) return
    const previousTitle = document.title
    const nextTitle = `${title} · Disciplr`
    document.title = nextTitle
    window.dispatchEvent(new Event(DOCUMENT_TITLE_EVENT))
    return () => {
      if (document.title === nextTitle) document.title = previousTitle
    }
  }, [title])
}