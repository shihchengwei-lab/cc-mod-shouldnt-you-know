import type { Note } from '../types'

const TEST_DIRS = new Set(['test', 'tests', '__tests__', '__snapshots__'])

const unfence = (text: string): string => {
  const match = /^\s*```[^\n]*\n([\s\S]*?)\n?```\s*$/.exec(text)

  return match ? (match[1] ?? '') : text
}

export const parseNote = (text: string): Note | null => {
  const note = unfence(text).trim()

  return note === '' || /^none\W*$/i.test(note) ? null : { text: note }
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
