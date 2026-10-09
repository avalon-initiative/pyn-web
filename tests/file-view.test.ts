import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { fetchContent } from '../src/api/repos'
import PynCodeView from '../src/components/PynCodeView.vue'
import PynFileBar from '../src/components/PynFileBar.vue'
import PynFileView from '../src/components/PynFileView.vue'
import PynMarkdown from '../src/components/PynMarkdown.vue'
import PynReadme from '../src/components/PynReadme.vue'
import PynRepoLanding from '../src/components/PynRepoLanding.vue'
import PynTree from '../src/components/PynTree.vue'
import { makeRouter } from '../src/router'
import {
  blobPath,
  contentUrl,
  fileBody,
  fileCrumbs,
  fileKind,
  historyLink,
  readmeEntry,
} from '../src/state/blob.state'
import { highlightLines, languageFor } from '../src/state/code.state'
import { hashId, scrollToHash } from '../src/state/hash.state'
import { clickLine, lineHash, parseLineHash } from '../src/state/lines.state'
import { renderMarkdown, resolveRelative } from '../src/state/markdown.state'
import { codeText, fileEntry, imageSrc, lockedEntry, readmeText } from '../src/stories/file-data'
import { now, repo, rootEntries, rootListing, summary } from '../src/stories/landing-data'

const r = { owner: 'acme', name: 'castle-quest' }
const bytes = (s: string) => new TextEncoder().encode(s)

describe('blob state', () => {
  it('builds file, content and history links', () => {
    expect(blobPath(r, 'My Dir/a.ts')).toBe('/acme/castle-quest/blob/My%20Dir/a.ts')
    expect(contentUrl(r, 'a b.ts', 3)).toBe(
      '/v1/repos/acme/castle-quest/content?path=a+b.ts&revision=3',
    )
    expect(historyLink(r, 'a/b.ts')).toBe('/acme/castle-quest/history?path=a%2Fb.ts')
  })

  it('links every folder in the crumbs but not the file', () => {
    expect(fileCrumbs(r, 'a/b.ts')).toEqual([
      { label: 'castle-quest', href: '/acme/castle-quest' },
      { label: 'a', href: '/acme/castle-quest/tree/a' },
      { label: 'b.ts', href: undefined },
    ])
  })

  it('finds the README, preferring markdown', () => {
    const file = (name: string) => ({ ...fileEntry, name, path: name })
    expect(readmeEntry([file('README.txt'), file('readme.md')])?.name).toBe('readme.md')
    expect(readmeEntry([file('README')])?.name).toBe('README')
    expect(
      readmeEntry([file('Readme.md.bak'), { ...file('README.md'), kind: 'folder' }]),
    ).toBeNull()
  })

  it('classifies files by name', () => {
    expect(fileKind('a/NOTES.MD')).toBe('markdown')
    expect(fileKind('logo.png')).toBe('image')
    expect(fileKind('Player.cpp')).toBe('text')
    expect(fileKind('Level.umap')).toBe('unknown')
  })

  it('shows text, and a download for binary, empty and oversized content', () => {
    const body = (path: string, b: Uint8Array, truncated = false) =>
      fileBody(path, { bytes: b, truncated }).kind
    expect(body('a.ts', bytes('x'))).toBe('code')
    expect(body('a.md', bytes('# x'))).toBe('markdown')
    expect(body('a.bin', new Uint8Array([1, 0, 2]))).toBe('binary')
    expect(body('a.bin', new Uint8Array([0xff, 0xfe]))).toBe('binary')
    expect(body('a.txt', new Uint8Array())).toBe('empty')
    expect(body('a.txt', bytes('x'), true)).toBe('large')
  })
})

describe('code state', () => {
  it('picks a language from the extension or file name', () => {
    expect(languageFor('Source/a.rs')).toBe('rust')
    expect(languageFor('Makefile')).toBe('makefile')
    expect(languageFor('a.umap')).toBeNull()
  })

  it('splits highlighted output per line, closing spans that cross lines', () => {
    const lines = highlightLines('/* a\n b */\nlet x = 1\n', 'javascript')
    expect(lines).toHaveLength(3)
    for (const l of lines) {
      expect((l.match(/<span/g) ?? []).length).toBe((l.match(/<\/span>/g) ?? []).length)
    }
    expect(lines[1]).toContain('hljs-comment')
  })

  it('escapes plain text', () => {
    expect(highlightLines('<b>&', null)).toEqual(['&lt;b&gt;&amp;'])
  })
})

describe('markdown state', () => {
  const render = (src: string, dir = '') => renderMarkdown(src, r, dir)

  it('strips scripts, handlers, styles and script URLs', () => {
    const html = render(
      '<script>x()</script><img src="a.png" onerror="x()"><a href="javascript:x()">j</a><p style="color:red">p</p>',
    )
    expect(html).not.toMatch(/<script|onerror|javascript:|style=/i)
  })

  it('resolves relative links and images against the document folder', () => {
    const html = render('[n](Notes.md) [up](../a.md) [d](docs/) ![i](img/a.png)', 'x/y')
    expect(html).toContain('href="/acme/castle-quest/blob/x/y/Notes.md"')
    expect(html).toContain('href="/acme/castle-quest/blob/x/a.md"')
    expect(html).toContain('href="/acme/castle-quest/tree/x/y/docs"')
    expect(html).toContain('src="/v1/repos/acme/castle-quest/content?path=x%2Fy%2Fimg%2Fa.png"')
  })

  it('opens external links in a new tab without opener access', () => {
    const html = render('[e](https://example.com) [h](#top)')
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html.match(/target="_blank"/g)).toHaveLength(1)
  })

  it('highlights fenced code and renders tables', () => {
    const html = render('```js\nconst a = 1\n```\n\n| a |\n|---|\n| b |')
    expect(html).toContain('hljs-keyword')
    expect(html).toContain('<table>')
  })

  it('resolves paths', () => {
    expect(resolveRelative('a', '/b/c.md')).toBe('b/c.md')
    expect(resolveRelative('a/b', '../../../c')).toBe('c')
    expect(resolveRelative('a', 'https://x.dev')).toBeNull()
    expect(resolveRelative('a', '#frag')).toBeNull()
  })
})

describe('content api', () => {
  afterEach(() => vi.unstubAllGlobals())

  const stream = (...parts: string[]) =>
    new Response(
      new ReadableStream({
        start(c) {
          for (const p of parts) c.enqueue(bytes(p))
          c.close()
        },
      }),
    )

  it('reads a whole small file', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => stream('hello ', 'world')),
    )
    const got = await fetchContent(r, 'a.txt', 100)
    expect(new TextDecoder().decode(got.bytes)).toBe('hello world')
    expect(got.truncated).toBe(false)
  })

  it('stops at the limit and says it truncated', async () => {
    const fetchMock = vi.fn(async () => stream('aaaa', 'bbbb', 'cccc'))
    vi.stubGlobal('fetch', fetchMock)
    const got = await fetchContent(r, 'a.txt', 6)
    expect(got.truncated).toBe(true)
    expect(new TextDecoder().decode(got.bytes)).toBe('aaaabb')
    expect(fetchMock.mock.calls[0]).toEqual(['/v1/repos/acme/castle-quest/content?path=a.txt'])
  })

  it('throws the server error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ code: 'revision_not_found', message: 'no' }), {
            status: 404,
          }),
      ),
    )
    await expect(fetchContent(r, 'a.txt', 10)).rejects.toMatchObject({
      status: 404,
      code: 'revision_not_found',
    })
  })
})

describe('router', () => {
  it('routes files under /blob/ with the whole path', () => {
    const route = makeRouter(createMemoryHistory()).resolve('/acme/game/blob/Content/a b.ts')
    expect(route.name).toBe('blob')
    expect(route.params.path).toBe('Content/a b.ts')
  })
})

describe('hash state', () => {
  it('parses and formats line hashes', () => {
    expect(parseLineHash('#L12')).toEqual({ start: 12, end: 12 })
    expect(parseLineHash('#L20-L12')).toEqual({ start: 12, end: 20 })
    expect(parseLineHash('#L0')).toBeNull()
    expect(parseLineHash('#intro')).toBeNull()
    expect(lineHash({ start: 3, end: 3 })).toBe('#L3')
    expect(lineHash({ start: 3, end: 7 })).toBe('#L3-L7')
  })

  it('extends a range from its first line on shift-click', () => {
    expect(clickLine(null, 5, true)).toEqual({ start: 5, end: 5 })
    expect(clickLine({ start: 5, end: 5 }, 9, false)).toEqual({ start: 9, end: 9 })
    expect(clickLine({ start: 5, end: 5 }, 9, true)).toEqual({ start: 5, end: 9 })
    expect(clickLine({ start: 5, end: 9 }, 2, true)).toEqual({ start: 2, end: 5 })
  })

  it('decodes element ids and scrolls to them only when off screen', () => {
    expect(hashId('#a%20b')).toBe('a b')
    expect(hashId('#')).toBeNull()
    expect(hashId('#%E0%A4%A')).toBeNull()
    const el = document.createElement('div')
    el.id = 'far'
    el.scrollIntoView = vi.fn()
    el.getBoundingClientRect = () => ({ top: 5000, bottom: 5020 }) as DOMRect
    document.body.append(el)
    expect(scrollToHash('#far')).toBe(true)
    expect(el.scrollIntoView).toHaveBeenCalledOnce()
    el.getBoundingClientRect = () => ({ top: 100, bottom: 120 }) as DOMRect
    scrollToHash('#far')
    expect(el.scrollIntoView).toHaveBeenCalledOnce()
    expect(scrollToHash('#missing')).toBe(false)
    el.remove()
  })
})

describe('file components', () => {
  it('numbers each line of code', () => {
    const w = mount(PynCodeView, { props: { text: codeText, language: 'typescript' } })
    const lines = w.findAll('[data-line]')
    expect(lines).toHaveLength(codeText.trimEnd().split('\n').length)
    expect(lines[0].attributes('data-line')).toBe('1')
    expect(w.find('.hljs-keyword').exists()).toBe(true)
  })

  it('anchors line numbers, highlights the range and reports clicks', async () => {
    const w = mount(PynCodeView, {
      props: { text: codeText, language: 'typescript', range: { start: 2, end: 3 } },
    })
    const a = w.find('#L2 a')
    expect(a.attributes('href')).toBe('#L2')
    expect(a.text()).toBe('')
    expect(
      w.findAll('span[id^="L"]').filter((l) => l.classes().some((c) => c.includes('selected'))),
    ).toHaveLength(2)
    await w.find('#L7 a').trigger('click')
    await w.find('#L7 a').trigger('click', { shiftKey: true })
    expect(w.emitted('select')).toEqual([[{ start: 7, end: 7 }], [{ start: 2, end: 7 }]])
  })

  it('renders sanitised markdown', () => {
    const w = mount(PynMarkdown, { props: { source: readmeText, ...r } })
    expect(w.find('h1').text()).toBe('Castle Quest')
    expect(w.find('script').exists()).toBe(false)
    expect(w.find('a[href="/acme/castle-quest/blob/Content/Levels/Notes.md"]').exists()).toBe(true)
  })

  it('links the README to its file and renders it', () => {
    const w = mount(PynReadme, {
      props: { ...r, readme: { name: 'README.md', path: 'README.md', text: '# Hi' } },
    })
    expect(w.find('header a').attributes('href')).toBe('/acme/castle-quest/blob/README.md')
    expect(w.find('h1').text()).toBe('Hi')
  })

  it('shows a plain README as text', () => {
    const w = mount(PynReadme, {
      props: { ...r, readme: { name: 'README', path: 'README', text: '# not markdown' } },
    })
    expect(w.find('h1').exists()).toBe(false)
    expect(w.find('pre').text()).toBe('# not markdown')
  })

  it('shows mode, holder, revision and history in the file bar', () => {
    const w = mount(PynFileBar, { props: { ...r, entry: lockedEntry, me: 'jamie', now } })
    expect(w.find('[data-mode=exclusive]').exists()).toBe(true)
    expect(w.find('[data-state]').text()).toContain('bob')
    expect(w.text()).toContain('r61')
    expect(w.text()).toContain('jamie · 2 hours ago')
    const hrefs = w.findAll('a').map((a) => a.attributes('href'))
    expect(hrefs).toContain('/acme/castle-quest/history?path=Content%2FLevel01.umap')
    expect(hrefs).toContain('/v1/repos/acme/castle-quest/content?path=Content%2FLevel01.umap')
  })

  it('offers no download before the first revision', () => {
    const entry = { ...lockedEntry, last_change: null }
    const w = mount(PynFileBar, { props: { ...r, entry, now } })
    expect(w.text()).toContain('No revision yet')
    expect(w.text()).not.toContain('Download')
  })

  const view = (props: Record<string, unknown>) =>
    mount(PynFileView, { props: { ...r, path: fileEntry.path, entry: fileEntry, now, ...props } })

  it('renders each kind of body', () => {
    expect(
      view({ body: { kind: 'code', text: 'x', language: null } })
        .find('[data-line]')
        .exists(),
    ).toBe(true)
    expect(
      view({ body: { kind: 'markdown', text: '# T' } })
        .find('h1')
        .text(),
    ).toBe('T')
    expect(
      view({ body: { kind: 'image', src: imageSrc } })
        .find('img')
        .attributes('src'),
    ).toBe(imageSrc)
    expect(view({ body: null }).text()).toContain('Loading')
    expect(view({ body: { kind: 'binary' } }).text()).toContain('binary file')
    expect(view({ body: { kind: 'large' } }).text()).toContain('too large')
    expect(view({ body: { kind: 'empty' } }).text()).toContain('empty')
    expect(view({ body: { kind: 'none' } }).text()).toContain('no revision yet')
  })

  it('explains a missing file and links to its folder', () => {
    const w = view({ entry: null, missing: true, path: 'Source/gone.ts' })
    expect(w.find('[role=alert]').text()).toContain('/Source/gone.ts')
    expect(w.find('[role=alert] a').attributes('href')).toBe('/acme/castle-quest/tree/Source')
    expect(w.find('[aria-current=page]').text()).toBe('gone.ts')
  })
})

describe('browse integration', () => {
  it('links files to the viewer and folders to the tree', () => {
    const w = mount(PynTree, { props: { entries: rootEntries, ...r, now } })
    const hrefs = w.findAll('a').map((a) => a.attributes('href'))
    expect(hrefs).toContain('/acme/castle-quest/tree/Content')
    expect(hrefs).toContain('/acme/castle-quest/blob/README.md')
    expect(hrefs).toHaveLength(rootEntries.length)
  })

  it('shows the README under the listing, but not for a missing folder', () => {
    const readme = { name: 'README.md', path: 'README.md', text: '# Castle' }
    const props = { repo, path: '', listing: rootListing, summary, readme, now }
    const w = mount(PynRepoLanding, { props })
    expect(w.find('section[aria-label=README] h1').text()).toBe('Castle')
    const missing = mount(PynRepoLanding, { props: { ...props, listing: null, missing: true } })
    expect(missing.find('section[aria-label=README]').exists()).toBe(false)
  })
})
