import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SafeMarkdown } from '../components/SafeMarkdown'

describe('SafeMarkdown heading ids', () => {
  it('gives ## headings slug ids', () => {
    render(<SafeMarkdown content={'## Hello World'} />)
    expect(document.getElementById('hello-world')).not.toBeNull()
  })

  it('gives ### headings slug ids', () => {
    render(<SafeMarkdown content={'### Step 1: Connect'} />)
    expect(document.getElementById('step-1-connect')).not.toBeNull()
  })

  it('suffixes duplicate heading ids with -2', () => {
    render(
      <SafeMarkdown
        content={`## Overview\n## Overview`}
      />
    )
    expect(document.getElementById('overview')).not.toBeNull()
    expect(document.getElementById('overview-2')).not.toBeNull()
  })

  it('sets tabIndex={-1} on ## headings', () => {
    render(<SafeMarkdown content={'## Focusable'} />)
    const heading = document.getElementById('focusable')
    expect(heading).not.toBeNull()
    expect(heading?.tabIndex).toBe(-1)
  })

  it('does not set an id on # headings', () => {
    render(<SafeMarkdown content={'# Top Level'} />)
    // h1 rendered by SafeMarkdown has no id attribute
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1.id).toBe('')
  })
})

describe('SafeMarkdown onHeadings callback', () => {
  it('calls onHeadings with all ## and ### entries', () => {
    const onHeadings = vi.fn()
    render(
      <SafeMarkdown
        content={`## First\n### Sub\n## Second`}
        onHeadings={onHeadings}
      />
    )
    expect(onHeadings).toHaveBeenCalledOnce()
    const headings = onHeadings.mock.calls[0][0]
    expect(headings).toHaveLength(3)
    expect(headings[0]).toMatchObject({ id: 'first', level: 2, text: 'First' })
    expect(headings[1]).toMatchObject({ id: 'sub', level: 3, text: 'Sub' })
    expect(headings[2]).toMatchObject({ id: 'second', level: 2, text: 'Second' })
  })

  it('calls onHeadings with an empty array when there are no headings', () => {
    const onHeadings = vi.fn()
    render(<SafeMarkdown content={'Just a paragraph.'} onHeadings={onHeadings} />)
    expect(onHeadings).toHaveBeenCalledWith([])
  })

  it('does not include # (h1) headings in the onHeadings list', () => {
    const onHeadings = vi.fn()
    render(
      <SafeMarkdown
        content={`# Title\n## Section`}
        onHeadings={onHeadings}
      />
    )
    const headings = onHeadings.mock.calls[0][0]
    expect(headings).toHaveLength(1)
    expect(headings[0].level).toBe(2)
  })
})
