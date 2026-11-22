import { describe, expect, it } from 'vitest'
import { collectDefinitions, findUndefinedVars } from '../check-css-vars'

const defs = collectDefinitions([':root { --bg: #fff; --text: #000; }'])

describe('check-css-vars', () => {
  it('accepts defined variables', () => {
    const files = [{ path: 'a.css', content: 'a { color: var(--text); background: var(--bg); }' }]
    expect(findUndefinedVars(files, defs)).toEqual([])
  })

  it('reports undefined variables with line numbers', () => {
    const files = [{ path: 'a.css', content: 'a {\n  color: var(--nope);\n}' }]
    expect(findUndefinedVars(files, defs)).toEqual([{ file: 'a.css', line: 2, name: '--nope' }])
  })

  it('treats variables with fallbacks as undefined unless allow-listed', () => {
    const files = [{ path: 'a.css', content: 'a { color: var(--x, #fff); }' }]
    expect(findUndefinedVars(files, defs)).toHaveLength(1)
    expect(findUndefinedVars(files, defs, ['--x'])).toEqual([])
  })

  it('scans CSS-in-TSX template strings', () => {
    const files = [
      { path: 'C.tsx', content: 'const s = `.a { color: var(--missing); border: 1px solid var(--bg); }`' },
    ]
    expect(findUndefinedVars(files, defs).map((v) => v.name)).toEqual(['--missing'])
  })

  it('counts inline style custom property keys as definitions', () => {
    const d = collectDefinitions([], ["const s = { '--progress': '50%' }"])
    const files = [{ path: 'C.tsx', content: 'x = "width: var(--progress)"' }]
    expect(findUndefinedVars(files, d)).toEqual([])
  })
})
