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
  const host = document.createElement('div')
  host.append(doc)
  return host.innerHTML
}
