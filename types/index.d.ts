export type Note = {
  learn: string
  title: string
  body: string
}

declare module 'claude-code' {
  interface PluginState {
    'shouldnt-you-know': { current: Note | null; shown: Note[] }
  }
}
