import DOMPurify from 'dompurify'
import { Marked } from 'marked'
import { blobPath, contentUrl } from './blob.state'
import { highlight, languageFromTag } from './code.state'
import { treePath } from './tree.state'

type Repo = { owner: string; name: string }

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')

const marked = new Marked({
  gfm: true,
  renderer: {
    code({ text, lang }) {
      const language = languageFromTag((lang ?? '').split(/\s/)[0])
      const cls = language ? ` class="language-${escapeAttr(language)}"` : ''
      return `<pre><code${cls}>${highlight(text, language)}</code></pre>\n`
    },
  },
})

const SCHEME = /^([a-z][a-z0-9+.-]*:|\/\/)/i

const safeDecode = (s: string) => {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/** Joins a repo-relative link onto the folder holding the document; null if not repo-relative. */
export function resolveRelative(dir: string, href: string): string | null {
  if (!href || href.startsWith('#') || SCHEME.test(href)) return null
  const [target] = href.split(/[?#]/)
  const parts = target.startsWith('/') ? [] : dir.split('/').filter(Boolean)
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop()
    else if (seg && seg !== '.') parts.push(safeDecode(seg))
  }
  return parts.join('/')
}

/** GitHub-style heading slug: lowercase, punctuation dropped, spaces to hyphens. */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '')
    .replace(/\s/g, '-')
}

const RESERVED = /^(app|L\d+(-L\d+)?)$/

/** True when an id belongs to the app or a line anchor rather than rendered markdown. */
function isTaken(id: string): boolean {
  if (RESERVED.test(id)) return true
  const el = document.getElementById(id)
  return !!el && !el.closest('[data-markdown]')
}

/** Drops authored ids and names, then gives each heading a unique slug id. */
function assignHeadingIds(doc: DocumentFragment) {
  for (const el of doc.querySelectorAll('[id], [name]')) {
    el.removeAttribute('id')
    el.removeAttribute('name')
  }
  const used = new Set<string>()
  for (const h of doc.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
    const base = slugify(h.textContent ?? '')
    if (!base) continue
    let id = base
    for (let n = 1; used.has(id) || isTaken(id); n++) id = `${base}-${n}`
    used.add(id)
    h.id = id
  }
}

/** Safe HTML for markdown; relative links open in the viewer, relative images load from the server. */
export function renderMarkdown(source: string, repo: Repo, dir: string): string {
  const raw = marked.parse(source, { async: false })
  const doc = DOMPurify.sanitize(raw, { RETURN_DOM_FRAGMENT: true, FORBID_ATTR: ['style'] })
  for (const a of doc.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href') ?? ''
    const path = resolveRelative(dir, href)
    if (path !== null) {
      const folder = href.endsWith('/') || path === ''
      a.setAttribute('href', folder ? treePath(repo, path) : blobPath(repo, path))
    } else if (!href.startsWith('#')) {
      a.setAttribute('target', '_blank')
      a.setAttribute('rel', 'noopener noreferrer')
    }
  }
  for (const img of doc.querySelectorAll('img[src]')) {
    const path = resolveRelative(dir, img.getAttribute('src') ?? '')
    if (path !== null) img.setAttribute('src', contentUrl(repo, path))
  }
  assignHeadingIds(doc)
  const host = document.createElement('div')
  host.append(doc)
  return host.innerHTML
}
