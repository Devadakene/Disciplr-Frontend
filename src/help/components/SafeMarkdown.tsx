import React from 'react'

interface SafeMarkdownProps {
  content: string
}

/**
 * A lightweight, safe renderer for markdown articles without dangerouslySetInnerHTML.
 * Parses headings (###, ##, #), bullet lists (- or *), bold/inline code, and paragraphs.
 */
export function SafeMarkdown({ content }: SafeMarkdownProps): React.JSX.Element {
  if (!content) return <div></div>

  const lines = content.split('\n')
  const elements: React.JSX.Element[] = []

  let inList = false
  let currentListItems: React.JSX.Element[] = []
  let listKey = 0

  const flushList = () => {
    if (inList && currentListItems.length > 0) {
      elements.push(
        <ul key={`ul-${listKey++}`} style={{ paddingLeft: '1.5rem', margin: '0.75rem 0', display: 'grid', gap: '0.35rem' }}>
          {currentListItems}
        </ul>
      )
      currentListItems = []
      inList = false
    }
  }

  const renderInline = (text: string): React.ReactNode[] => {
    // Match inline code `code` or bold **bold**
    const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('`') && part.endsWith('`') && part.length > 1) {
        return (
          <code
            key={i}
            style={{
              background: 'var(--surface-raised, #27272a)',
              padding: '0.15rem 0.4rem',
              borderRadius: 'var(--radius-sm, 4px)',
              fontSize: '0.9em',
              fontFamily: 'monospace',
            }}
          >
            {part.slice(1, -1)}
          </code>
        )
      }
      if (part.startsWith('**') && part.endsWith('**') && part.length > 3) {
        return (
          <strong key={i} style={{ fontWeight: 700 }}>
            {part.slice(2, -2)}
          </strong>
        )
      }
      return part
    })
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim()

    if (!trimmed) {
      flushList()
      return
    }

    if (trimmed.startsWith('### ')) {
      flushList()
      elements.push(
        <h3 key={`h3-${index}`} style={{ margin: '1.25rem 0 0.5rem', fontSize: '1.2rem', color: 'var(--text)' }}>
          {renderInline(trimmed.slice(4))}
        </h3>
      )
      return
    }

    if (trimmed.startsWith('## ')) {
      flushList()
      elements.push(
        <h2 key={`h2-${index}`} style={{ margin: '1.5rem 0 0.6rem', fontSize: '1.4rem', color: 'var(--text)' }}>
          {renderInline(trimmed.slice(3))}
        </h2>
      )
      return
    }

    if (trimmed.startsWith('# ')) {
      flushList()
      elements.push(
        <h1 key={`h1-${index}`} style={{ margin: '1.75rem 0 0.75rem', fontSize: '1.75rem', color: 'var(--text)' }}>
          {renderInline(trimmed.slice(2))}
        </h1>
      )
      return
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      inList = true
      currentListItems.push(
        <li key={`li-${index}`} style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
          {renderInline(trimmed.slice(2))}
        </li>
      )
      return
    }

    flushList()
    elements.push(
      <p key={`p-${index}`} style={{ margin: '0.6rem 0', color: 'var(--muted)', lineHeight: 1.65 }}>
        {renderInline(trimmed)}
      </p>
    )
  })

  flushList()

  return <div style={{ display: 'grid', gap: '0.5rem' }}>{elements}</div>
}
