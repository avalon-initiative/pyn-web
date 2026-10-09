import type { Crumb, TreeEntry } from '../types/tree.types'
import type { FetchedContent, FileBody } from '../types/blob.types'
import { fileExtension, languageFor } from './code.state'
import { repoPath } from './repo.state'
import { encodeSegments, treePath } from './tree.state'

type Repo = { owner: string; name: string }

/** Largest file the page reads and renders; larger ones are offered as a download. */
export const VIEW_LIMIT = 1024 * 1024

const IMAGES = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'svg'])
const MARKDOWN = new Set(['md', 'markdown', 'mdown'])
const PLAIN = new Set(['txt', 'log', 'csv', 'tsv', 'env', 'gitignore', 'gitattributes', 'lock'])
const README = /^readme(\.(md|markdown|txt))?$/i

const clean = (path: string) => path.replace(/^\/+|\/+$/g, '')

/** The app route of a file. */
export const blobPath = (r: Repo, path: string): string =>
  repoPath(r, `blob/${encodeSegments(clean(path))}`)

/** The server URL of a file's head content, or of one revision. */
export function contentUrl(r: Repo, path: string, revision?: number): string {
  const q = new URLSearchParams({ path })
  if (revision !== undefined) q.set('revision', String(revision))
  const base = `/v1/repos/${encodeURIComponent(r.owner)}/${encodeURIComponent(r.name)}`
  return `${base}/content?${q}`
}

/** The history tab scoped to one file. */
export const historyLink = (r: Repo, path: string): string =>
  `${repoPath(r, 'history')}?path=${encodeURIComponent(path)}`

export const parentOf = (path: string): string => path.split('/').slice(0, -1).join('/')

export const baseName = (path: string): string => path.slice(path.lastIndexOf('/') + 1)

/** The repository, each folder, then the file as the current location. */
export function fileCrumbs(r: Repo, path: string): Crumb[] {
  const parts = clean(path).split('/')
  const crumbs: Crumb[] = [{ label: r.name, href: treePath(r, '') }]
  parts.forEach((label, i) => {
    const last = i === parts.length - 1
    crumbs.push({ label, href: last ? undefined : treePath(r, parts.slice(0, i + 1).join('/')) })
  })
  return crumbs
}

/** The folder's README file, preferring markdown. */
export function readmeEntry(entries: TreeEntry[]): TreeEntry | null {
  const found = entries.filter((e) => e.kind === 'file' && README.test(e.name))
  return found.find((e) => MARKDOWN.has(fileExtension(e.name))) ?? found[0] ?? null
}

export type FileKind = 'markdown' | 'image' | 'text' | 'unknown'

/** Classifies a file by name; 'unknown' needs its bytes sniffed. */
export function fileKind(path: string): FileKind {
  const ext = fileExtension(path)
  if (MARKDOWN.has(ext)) return 'markdown'
  if (IMAGES.has(ext)) return 'image'
  if (languageFor(path) || PLAIN.has(ext) || README.test(baseName(path))) return 'text'
  return 'unknown'
}

function decode(bytes: Uint8Array): string | null {
  if (bytes.includes(0)) return null
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes, { stream: true })
  } catch {
    return null
  }
}

/** What to show for fetched content; binary and oversized files show a download instead. */
export function fileBody(path: string, content: FetchedContent): FileBody {
  if (content.truncated) return { kind: 'large' }
  if (content.bytes.length === 0) return { kind: 'empty' }
  const text = decode(content.bytes)
  if (text === null) return { kind: 'binary' }
  if (fileKind(path) === 'markdown') return { kind: 'markdown', text }
  return { kind: 'code', text, language: languageFor(path) }
}
