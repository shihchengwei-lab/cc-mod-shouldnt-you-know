import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'

const SURFACES = ['terminal', 'desktop'] as const
const PLUGIN = 'shouldnt-you-know'
const BAND = { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 80 }
const USAGE = {
  input_tokens: 0,
  output_tokens: 0,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
}

const NOTE_A =
  'sync() sends adds and edits, but a delete only changes the local list.\nThe task needs offline changes to match after reconnecting.'
const NOTE_B = 'The count is stored twice and the two copies drift.'

type Setup = {
  prompts: string[]
  fills: { text: string; mode: string }[]
  advance: () => Promise<void>
}

const setup = (on: On, replies: unknown[]): Setup => {
  const prompts: string[] = []
  const fills: { text: string; mode: string }[] = []
  const clock = mock.clock(on)
  let n = 0

  on('model.fork', (_$, e) => {
    prompts.push(e.prompt)
    const reply = replies[Math.min(n, replies.length - 1)]
    n += 1

    return { value: reply } as never
  })
  on('tool.call', { tool: 'Edit' }, () => ({ result: {}, text: 'ok' }) as never)
  on('turn.complete', () => ({ text: 'done' }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)

    return <Box />
  })
  on('prompt.fill', (_$, e) => {
    fills.push({ text: e.text, mode: e.mode })

    return { isFilled: true }
  })

  return { prompts, fills, advance: () => clock.advance(1) }
}

const answered = (text: string) => ({ isAnswered: true, text, usage: USAGE })

const edit = ($: any, path: string) =>
  $.tool.call({ tool: 'Edit', file_path: path, old_string: 'a', new_string: 'b' })

const finish = ($: any, extra: Record<string, unknown> = {}) =>
  $.turn.complete({
    answer: 'done',
    durationMs: 10,
    isAborted: false,
    turnId: 't1',
    reason: 'answer',
    ...extra,
  })

const band = ($: any, surface: (typeof SURFACES)[number]) =>
  $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: BAND })

// A skipped turn proves nothing on its own: a module that never forks skips too.
// Each skip test ends by showing the next ordinary edit does fork.
const expectNextEditForks = async ($: any, s: Setup) => {
  await edit($, 'src/next.ts')
  await finish($)
  await s.advance()

  expect(s.prompts.length).toBe(1)
}

test('an edit then a main turn shows the note in the band', async ($, on) => {
  const s = setup(on, [answered(NOTE_A)])

  await edit($, 'src/a.ts')
  await finish($)
  await s.advance()

  expect(s.prompts.length).toBe(1)

  for (const surface of SURFACES) {
    const ui = await band($, surface)

    expect(await ui.find({ type: 'Text', text: /Shouldn't you know\?/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: NOTE_A })).toBeDefined()
    await ui.unmount()
  }
})

// The only test that fails if review() shows the raw reply instead of parsing it.
test('none draws nothing of ours', async ($, on) => {
  const s = setup(on, [answered('none')])

  await edit($, 'src/a.ts')
  await finish($)
  await s.advance()

  expect(s.prompts.length).toBe(1)

  const ui = await band($, 'terminal')

  expect(await ui.find({ type: 'Button' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /Shouldn't you know/ })).toBeUndefined()
})

test('only test files edited: no fork', async ($, on) => {
  const s = setup(on, [answered(NOTE_A)])

  await edit($, 'tests/a.test.ts')
  await finish($)
  await s.advance()

  expect(s.prompts.length).toBe(0)
  await expectNextEditForks($, s)
})

test('no edits: no fork', async ($, on) => {
  const s = setup(on, [answered(NOTE_A)])

  await finish($)
  await s.advance()

  expect(s.prompts.length).toBe(0)
  await expectNextEditForks($, s)
})

test('a subagent turn does not fork', async ($, on) => {
  const s = setup(on, [answered(NOTE_A)])

  await edit($, 'src/a.ts')
  await finish($, { agentId: 'sub-1' })
  await s.advance()

  expect(s.prompts.length).toBe(0)
  await expectNextEditForks($, s)
})

test('an aborted turn does not fork', async ($, on) => {
  const s = setup(on, [answered(NOTE_A)])

  await edit($, 'src/a.ts')
  await finish($, { reason: 'aborted', isAborted: true })
  await s.advance()

  expect(s.prompts.length).toBe(0)
  await expectNextEditForks($, s)
})

test('the second fork prompt lists the first note', async ($, on) => {
  const s = setup(on, [answered(NOTE_A), answered(NOTE_B)])

  await edit($, 'src/a.ts')
  await finish($)
  await s.advance()
  await edit($, 'src/b.ts')
  await finish($)
  await s.advance()

  expect(s.prompts.length).toBe(2)
  expect(s.prompts[0]).toContain('(none)')
  expect(s.prompts[1]).toContain(
    '- sync() sends adds and edits, but a delete only changes the local list. The task needs offline changes to match after reconnecting.',
  )
})

test('Put in prompt fills the box and clears the band', async ($, on) => {
  const s = setup(on, [answered(NOTE_A)])

  await edit($, 'src/a.ts')
  await finish($)
  await s.advance()

  const ui = await band($, 'terminal')
  await ui.press({ key: 'fill' })

  expect(s.fills).toEqual([
    {
      text: `Shouldn't you know?\n${NOTE_A}`,
      mode: 'append',
    },
  ])

  const again = await band($, 'terminal')

  expect(await again.find({ type: 'Button' })).toBeUndefined()
})

test('Dismiss clears the band without filling', async ($, on) => {
  const s = setup(on, [answered(NOTE_A)])

  await edit($, 'src/a.ts')
  await finish($)
  await s.advance()

  const ui = await band($, 'terminal')
  await ui.press({ key: 'dismiss' })

  expect(s.fills.length).toBe(0)

  const again = await band($, 'terminal')

  expect(await again.find({ type: 'Button' })).toBeUndefined()
})

test('a failed fork shows no band', async ($, on) => {
  const s = setup(on, [
    { isAnswered: false, reason: 'api-error', status: 500, error: {}, usage: USAGE },
  ])

  await edit($, 'src/a.ts')
  await finish($)
  await s.advance()

  expect(s.prompts.length).toBe(1)

  const ui = await band($, 'terminal')

  expect(await ui.find({ type: 'Button' })).toBeUndefined()
})
