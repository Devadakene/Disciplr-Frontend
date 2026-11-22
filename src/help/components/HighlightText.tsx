import React from 'react'
import { escapeRegExp, tokenise } from '../search'

interface HighlightTextProps {
  text: string
  query: string
  className?: string
  markStyle?: React.CSSProperties
}

/**
 * Highlights matches of query tokens in text safely without dangerous HTML strings.
 * Operates purely on React text nodes.
 */
export function HighlightText({ text, query, className, markStyle }: HighlightTextProps): React.JSX.Element {
  if (!text) {
    return <span className={className}></span>
  }

  const tokens = tokenise(query)
  if (tokens.length === 0) {
    return <span className={className}>{text}</span>
  }

  // Sort longer tokens first so prefixes don't prematurely split longer matches
  const sortedTokens = [...tokens].sort((a, b) => b.length - a.length)
  const pattern = new RegExp(`(${sortedTokens.map(escapeRegExp).join('|')})`, 'gi')

  const parts = text.split(pattern)
  const tokenSet = new Set(tokens.map((t) => t.toLowerCase()))

  return (
    <span className={className}>
      {parts.map((part, index) => {
        const isMatch = tokenSet.has(part.toLowerCase())
        if (isMatch) {
          return (
            <mark
              key={index}
              style={{
                backgroundColor: 'var(--accent-transparent, rgba(59, 130, 246, 0.2))',
                color: 'inherit',
                borderRadius: '2px',
                padding: '0 2px',
                ...markStyle,
              }}
            >
              {part}
            </mark>
          )
        }
        return <React.Fragment key={index}>{part}</React.Fragment>
      })}
    </span>
  )
}
