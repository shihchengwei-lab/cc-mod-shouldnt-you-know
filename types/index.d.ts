export type Note = {
  text: string
}

declare module 'claude-code' {
  interface PluginState {
    'shouldnt-you-know': { current: Note | null; shown: Note[] }
  }
}
