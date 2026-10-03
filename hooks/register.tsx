import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Note } from '../types'
import { parseNote, isTestPath } from './parse'
import { buildPrompt } from './prompt'

const current = atom({ plugin: 'shouldnt-you-know', key: 'current' } as const, null)
const shown = atom({ plugin: 'shouldnt-you-know', key: 'shown' } as const, [])

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])

const changed = new Set<string>()

const format = (note: Note): string =>
  [
    `Shouldn't you know?\n${note.learn}`,
    [note.title, note.body].filter(part => part !== '').join('\n'),
  ]
    .filter(part => part !== '')
    .join('\n\n')

const review = async ($: EngineInterface) => {
  const previous = await read($, shown)
  const answer = await $.model.fork({ prompt: buildPrompt(previous) })

  if (!answer.isAnswered) {
    return
  }

  const note = parseNote(answer.text)

  if (note === null) {
    return
  }

  await update($, shown, list => [...list, note])
  await update($, current, () => note)
}

export const register: Register = on => {
  on('tool.call', async ($, e, next) => {
    const r = await next(e)
    const name = String(e.tool)

    if (!EDIT_TOOLS.has(name) || r.deny !== undefined || r.isError === true) {
      return r
    }

    const input = e as unknown as Record<string, unknown>
    const path = name === 'NotebookEdit' ? input.notebook_path : input.file_path

    if (typeof path === 'string') {
      changed.add(path)
    }

    return r
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)

    if (e.agentId !== undefined) {
      return r
    }

    const paths = [...changed]
    changed.clear()

    if (e.reason !== 'answer' || paths.length === 0 || paths.every(isTestPath)) {
      return r
    }

    $.clock.after(0, () => {
      void review($)
    })

    return r
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const note = await read($, current)

    if (e.props.hasSurvey || note === null) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        <Text bold color="yellow">
          Shouldn't you know? {note.learn}
        </Text>
        {note.title !== '' && <Text bold>{note.title}</Text>}
        {note.body !== '' && <Text wrap="wrap">{note.body}</Text>}
        <Box>
          <Button
            key="fill"
            label="Put in prompt"
            onPress={async () => {
              const filled = await $.prompt.fill({ text: format(note), mode: 'append' })

              if (filled.isFilled) {
                await update($, current, () => null)
              }
            }}
          />
          <Button
            key="dismiss"
            label="Dismiss"
            role="dismiss"
            onPress={() => update($, current, () => null)}
          />
        </Box>
      </Box>
    )
  })
}
