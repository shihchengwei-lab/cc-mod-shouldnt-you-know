import type { Note } from '../types'

const LEARN = /^[\s*_]*learn[\s*_]*:[\s*_]*(.*)$/i
const EXPLAIN = /^[\s*_]*explain[\s*_]*:\s*$/i
const TEST_DIRS = new Set(['test', 'tests', '__tests__', '__snapshots__'])

const unfence = (text: string): string => {
  const match = /^\s*```[^\n]*\n([\s\S]*?)\n?```\s*$/.exec(text)

  return match ? (match[1] ?? '') : text
}

export const parseNote = (text: string): Note | null => {
  const lines = unfence(text).split(/\r?\n/)
  const at = lines.findIndex(line => LEARN.test(line))

  if (at === -1) {
    return null
  }

  const learn = (LEARN.exec(lines[at] ?? '')?.[1] ?? '').replace(/[\s*_]+$/, '').trim()

  if (learn === '' || /^none\W*$/i.test(learn)) {
    return null
  }

  const rest = lines.slice(at + 1)
  const explainAt = rest.findIndex(line => EXPLAIN.test(line))

  if (explainAt === -1) {
    return { learn, title: '', body: '' }
  }

  const after = rest.slice(explainAt + 1)
  const first = after.findIndex(line => line.trim() !== '')

  if (first === -1) {
    return { learn, title: '', body: '' }
  }

  const raw = (after[first] ?? '').trim()
  const title = raw.length >= 4 && raw.startsWith('**') && raw.endsWith('**') ? raw.slice(2, -2).trim() : raw
  const body = after.slice(first + 1).join('\n').trim()

  return { learn, title, body }
}

export const isTestPath = (path: string): boolean => {
  const parts = path.replace(/\\/g, '/').split('/')
  const base = parts[parts.length - 1] ?? ''

  return (
    parts.slice(0, -1).some(part => TEST_DIRS.has(part)) ||
    base.startsWith('test_') ||
    base.includes('.test.') ||
    base.includes('.spec.') ||
    base.endsWith('_test.go') ||
    base.endsWith('.snap')
  )
}
