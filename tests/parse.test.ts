import { test, expect } from 'claude-code/testing'

import { isTestPath, parseNote } from '../hooks/parse'

test('parseNote keeps the whole reply as the note', async () => {
  const reply = 'sync() only sends adds.\n\nKeep the delete result.\nRecord deletes as operations.'

  expect(parseNote(`\n${reply}\n`)).toEqual({ text: reply })
})

test('parseNote returns null for none or an empty reply', async () => {
  expect(parseNote('none')).toBe(null)
  expect(parseNote('None.')).toBe(null)
  expect(parseNote('  none \n')).toBe(null)
  expect(parseNote('')).toBe(null)
  // A parser that always answers null passes the lines above; this one it does not.
  expect(parseNote('None of the deletes are synced.')?.text).toBe(
    'None of the deletes are synced.',
  )
})

test('parseNote strips a surrounding code fence', async () => {
  expect(parseNote('```\nKeep one source.\n```')).toEqual({ text: 'Keep one source.' })
  expect(parseNote('```\nnone\n```')).toBe(null)
})

test('parseNote does not require any part of the note', async () => {
  expect(parseNote('Only one sentence.')).toEqual({ text: 'Only one sentence.' })
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
