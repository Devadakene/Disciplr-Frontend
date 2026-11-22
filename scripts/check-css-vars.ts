/**
 * Fails when src/**\/*.{ts,tsx,css} references a var(--name) that is not defined
 * in the generated, semantic or index CSS (or set via a '--name' style key).
 * A fallback, e.g. var(--x, #fff), does NOT make an undefined variable valid
 * unless the name is allow-listed.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface SourceFile {
  path: string
  content: string
}

export interface Violation {
  file: string
  line: number
  name: string
}

/** Names intentionally allowed to be undefined (e.g. set by third-party libs). */
export const ALLOW_LIST: readonly string[] = []

const VAR_USE_RE = /var\(\s*(--[A-Za-z0-9_-]+)/g
const CSS_DECL_RE = /(?:^|[;{\s])(--[A-Za-z0-9_-]+)\s*:/g
const STYLE_KEY_RE = /['"`](--[A-Za-z0-9_-]+)['"`]\s*:/g

export function collectDefinitions(cssSources: string[], codeSources: string[] = []): Set<string> {
  const defined = new Set<string>()
  for (const css of cssSources) {
    for (const m of css.matchAll(CSS_DECL_RE)) defined.add(m[1])
  }
  for (const code of codeSources) {
    for (const m of code.matchAll(STYLE_KEY_RE)) defined.add(m[1])
  }
  return defined
}

export function findUndefinedVars(
  files: SourceFile[],
  defined: Set<string>,
  allowList: readonly string[] = ALLOW_LIST,
): Violation[] {
  const allowed = new Set(allowList)
  const out: Violation[] = []
  for (const file of files) {
    for (const m of file.content.matchAll(VAR_USE_RE)) {
      const name = m[1]
      if (defined.has(name) || allowed.has(name)) continue
      const line = file.content.slice(0, m.index).split('\n').length
      out.push({ file: file.path, line, name })
    }
  }
  return out
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, acc)
    else if (/\.(ts|tsx|css)$/.test(entry)) acc.push(full)
  }
  return acc
}

function main(): number {
  const root = resolve(fileURLToPath(import.meta.url), '../..')
  const files: SourceFile[] = walk(join(root, 'src')).map((p) => ({
    path: relative(root, p).replace(/\\/g, '/'),
    content: readFileSync(p, 'utf8').replace(/\r\n/g, '\n'),
  }))
  const css = files.filter((f) =>
    ['src/styles/tokens.generated.css', 'src/styles/semantic.css', 'src/index.css'].includes(f.path),
  )
  const code = files.filter((f) => /\.tsx?$/.test(f.path))
  const defined = collectDefinitions(
    css.map((f) => f.content),
    code.map((f) => f.content),
  )
  const violations = findUndefinedVars(files, defined)
  if (violations.length > 0) {
    console.error(`Found ${violations.length} undefined CSS variable reference(s):`)
    for (const v of violations) console.error(`  ${v.file}:${v.line}  var(${v.name})`)
    return 1
  }
  console.log('check-css-vars: no undefined CSS variables.')
  return 0
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main())
}
