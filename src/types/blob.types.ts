export interface FetchedContent {
  bytes: Uint8Array
  /** The content was longer than the read limit. */
  truncated: boolean
}

/** What the file page shows in place of the file's content. */
export type FileBody =
  | { kind: 'markdown'; text: string }
  | { kind: 'code'; text: string; language: string | null }
  | { kind: 'image'; src: string }
  | { kind: 'binary' }
  | { kind: 'large' }
  | { kind: 'empty' }
  | { kind: 'none' }

export interface ReadmeDoc {
  name: string
  path: string
  text: string
}
