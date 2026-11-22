import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { HighlightText } from '../components/HighlightText'

describe('HighlightText', () => {
  it('matches case-insensitively and preserves original casing in the output', () => {
    const { container } = render(<HighlightText text="USDC Trustline" query="trust" />)
    const marks = container.querySelectorAll('mark')

    expect(marks).toHaveLength(1)
    expect(marks[0].textContent).toBe('Trust')
    expect(container.textContent).toBe('USDC Trustline')
  })

  it('highlights multiple tokens while preserving original casing', () => {
    const { container } = render(<HighlightText text="USDC Trustline" query="trustline usdc" />)
    const marks = container.querySelectorAll('mark')

    expect(marks).toHaveLength(2)
    expect(marks[0].textContent).toBe('USDC')
    expect(marks[1].textContent).toBe('Trustline')
    expect(container.textContent).toBe('USDC Trustline')
  })

  it('renders plain text without <mark> when query is empty or has no searchable tokens', () => {
    const { container: emptyQuery } = render(<HighlightText text="USDC Trustline" query="" />)
    expect(emptyQuery.querySelectorAll('mark')).toHaveLength(0)
    expect(emptyQuery.textContent).toBe('USDC Trustline')

    const { container: whitespaceQuery } = render(<HighlightText text="USDC Trustline" query="   " />)
    expect(whitespaceQuery.querySelectorAll('mark')).toHaveLength(0)
    expect(whitespaceQuery.textContent).toBe('USDC Trustline')
  })

  it('renders empty span without <mark> when text is empty', () => {
    const { container } = render(<HighlightText text="" query="trust" />)
    expect(container.querySelectorAll('mark')).toHaveLength(0)
    expect(container.textContent).toBe('')
  })

  it('renders without throwing for queries containing regex-special characters', () => {
    expect(() => {
      const { container } = render(<HighlightText text="c++ (x)" query="c++(" />)
      const marks = container.querySelectorAll('mark')
      expect(marks).toHaveLength(1)
      expect(marks[0].textContent).toBe('c')
      expect(container.textContent).toBe('c++ (x)')
    }).not.toThrow()

    expect(() => {
      const { container } = render(<HighlightText text="USDC Trustline" query=".*+?()[]" />)
      expect(container.querySelectorAll('mark')).toHaveLength(0)
      expect(container.textContent).toBe('USDC Trustline')
    }).not.toThrow()

    expect(() => {
      const { container } = render(<HighlightText text="USDC Trustline" query="trust.*+?()[]" />)
      const marks = container.querySelectorAll('mark')
      expect(marks).toHaveLength(1)
      expect(marks[0].textContent).toBe('Trust')
    }).not.toThrow()
  })

  it('prefers the longer token when query tokens overlap', () => {
    const { container } = render(<HighlightText text="USDC Trustline" query="trust trustline" />)
    const marks = container.querySelectorAll('mark')

    expect(marks).toHaveLength(1)
    expect(marks[0].textContent).toBe('Trustline')
    expect(container.textContent).toBe('USDC Trustline')
  })

  it('allows markStyle prop to override default mark styles', () => {
    const { container } = render(
      <HighlightText
        text="USDC Trustline"
        query="trust"
        markStyle={{ backgroundColor: 'rgb(255, 255, 0)', padding: '2px 4px', fontWeight: 700 }}
      />,
    )
    const mark = container.querySelector('mark')

    expect(mark).not.toBeNull()
    expect(mark?.style.backgroundColor).toBe('rgb(255, 255, 0)')
    expect(mark?.style.padding).toBe('2px 4px')
    expect(mark?.style.fontWeight).toBe('700')
    expect(mark?.style.borderRadius).toBe('2px')
  })
})
