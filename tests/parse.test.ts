import { test, expect } from 'claude-code/testing'

import { isTestPath, parseNote } from '../hooks/parse'

test('parseNote reads learn, title and body', async () => {
  const note = parseNote(
    'learn: Deletes are not synced.\nexplain:\n**Deletes get lost**\nThe task needs X.\nThe code does Y.\n',
  )

  expect(note).toEqual({
    learn: 'Deletes are not synced.',
    title: 'Deletes get lost',
    body: 'The task needs X.\nThe code does Y.',
  })
})

test('parseNote returns null for none, empty or missing learn', async () => {
  expect(parseNote('learn: none')).toBe(null)
  expect(parseNote('Learn: None.')).toBe(null)
  expect(parseNote('learn:   ')).toBe(null)
  expect(parseNote('no label here')).toBe(null)
  expect(parseNote('')).toBe(null)
  // A parser that always answers null passes the lines above; this one it does not.
  expect(parseNote('learn: None of the deletes are synced.')?.learn).toBe(
    'None of the deletes are synced.',
  )
})

test('parseNote strips a code fence and markdown decoration', async () => {
  const note = parseNote('```\n**learn:** Keep one source.\nexplain:\n**One source**\nBody\n```')

  expect(note).toEqual({ learn: 'Keep one source.', title: 'One source', body: 'Body' })
})

test('parseNote without an explain section gives empty title and body', async () => {
  expect(parseNote('learn: Only a line.')).toEqual({ learn: 'Only a line.', title: '', body: '' })
})

test('isTestPath follows the test conventions', async () => {
  const yes = [
    'tests/a.ts',
    'src/__tests__/a.ts',
    'a\\test\\b.ts',
    'x/__snapshots__/a.txt',
    'src/test_a.py',
    'src/a.test.ts',
    'src/a.spec.js',
    'pkg/a_test.go',
    'src/a.snap',
  ]
  const no = ['src/a.ts', 'src/latest.ts', 'src/contest/a.ts', 'README.md']

  for (const path of yes) {
    expect(isTestPath(path), path).toBe(true)
  }

  for (const path of no) {
    expect(isTestPath(path), path).toBe(false)
  }
})
