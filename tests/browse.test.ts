import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { fetchSummary, fetchTree } from '../src/api/repos'
import PynActivity from '../src/components/PynActivity.vue'
import PynBranchBar from '../src/components/PynBranchBar.vue'
import PynBreadcrumb from '../src/components/PynBreadcrumb.vue'
import PynCheckoutCard from '../src/components/PynCheckoutCard.vue'
import PynLockedFiles from '../src/components/PynLockedFiles.vue'
import PynModeChip from '../src/components/PynModeChip.vue'
import PynRepoDetails from '../src/components/PynRepoDetails.vue'
import PynRepoLanding from '../src/components/PynRepoLanding.vue'
import PynTree from '../src/components/PynTree.vue'
import { makeRouter } from '../src/router'
import { breadcrumbs, folderParam, formatAgo, treePath } from '../src/state/tree.state'
import {
  folderListing,
  now,
  repo,
  rootEntries,
  rootListing,
  summary,
} from '../src/stories/landing-data'

const r = { owner: 'acme', name: 'castle-quest' }

describe('tree state', () => {
  it('builds folder routes and encodes segments', () => {
    expect(treePath(r, '')).toBe('/acme/castle-quest')
    expect(treePath(r, 'Content/My Levels/')).toBe('/acme/castle-quest/tree/Content/My%20Levels')
  })

  it('links every crumb but the current one', () => {
    expect(breadcrumbs(r, '')).toEqual([{ label: 'castle-quest', href: undefined }])
    expect(breadcrumbs(r, 'a/b')).toEqual([
      { label: 'castle-quest', href: '/acme/castle-quest' },
      { label: 'a', href: '/acme/castle-quest/tree/a' },
      { label: 'b', href: undefined },
    ])
  })

  it('reads the folder from a route param', () => {
    expect(folderParam(undefined)).toBe('')
    expect(folderParam('a/b/')).toBe('a/b')
    expect(folderParam(['a', 'b'])).toBe('a/b')
  })

  it('formats relative times', () => {
    const at = (ms: number) => new Date(now.getTime() - ms).toISOString()
    expect(formatAgo(at(5_000), now)).toBe('just now')
    expect(formatAgo(at(60_000), now)).toBe('1 minute ago')
    expect(formatAgo(at(2 * 3_600_000), now)).toBe('2 hours ago')
    expect(formatAgo(at(3 * 86_400_000), now)).toBe('3 days ago')
    expect(formatAgo(at(90 * 86_400_000), now)).toBe('Jul 10 2026')
  })
})

describe('router', () => {
  it('routes folders under /tree/ and keeps the root as the Code tab', () => {
    const router = makeRouter(createMemoryHistory())
    expect(router.resolve('/acme/game').name).toBe('files')
    const tree = router.resolve('/acme/game/tree/Content/Levels')
    expect(tree.name).toBe('tree')
    expect(tree.params.path).toBe('Content/Levels')
  })
})

describe('tree api', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('passes the folder and activity count as query parameters', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await fetchTree(r, 'Content/Levels')
    await fetchTree(r)
    await fetchSummary(r, 5)
    const urls = fetchMock.mock.calls.map((c) => (c as unknown as [string])[0])
    expect(urls).toEqual([
      '/v1/repos/acme/castle-quest/tree?path=Content%2FLevels',
      '/v1/repos/acme/castle-quest/tree',
      '/v1/repos/acme/castle-quest/summary?activity=5',
    ])
  })
})

describe('PynModeChip', () => {
  it('labels mixed folders', () => {
    expect(mount(PynModeChip, { props: { mode: 'mixed' } }).text()).toBe('Mixed')
  })
})

describe('PynTree', () => {
  const tree = () => mount(PynTree, { props: { entries: rootEntries, ...r, me: 'jamie', now } })

  it('links folders to their route and leaves files unlinked', () => {
    const w = tree()
    const hrefs = w.findAll('a').map((a) => a.attributes('href'))
    expect(hrefs).toEqual([
      '/acme/castle-quest/tree/Content',
      '/acme/castle-quest/tree/Config',
      '/acme/castle-quest/tree/Source',
    ])
  })

  it('shows the revision, author and age of the last change', () => {
    const row = tree().findAll('tbody tr')[0]
    expect(row.text()).toContain('Level design changes')
    expect(row.text()).toContain('r61')
    expect(row.text()).toContain('jamie · 2 hours ago')
    expect(row.find('[data-mode=mixed]').exists()).toBe(true)
  })

  it('shows the holder only on locked files', () => {
    const rows = tree().findAll('tbody tr')
    const locked = rows[rows.length - 1]
    expect(locked.find('[data-state]').text()).toContain('bob')
    expect(locked.text()).toContain('No revision yet')
    expect(rows[0].find('[data-state]').exists()).toBe(false)
  })

  it('says so when a folder is empty', () => {
    const w = mount(PynTree, { props: { entries: [], ...r } })
    expect(w.text()).toContain('empty')
  })
})

describe('PynRepoLanding', () => {
  const landing = (props: Record<string, unknown> = {}) =>
    mount(PynRepoLanding, {
      props: { repo, path: '', listing: rootListing, summary, me: 'jamie', now, ...props },
    })

  it('composes the table, rail and checkout explainer', () => {
    const w = landing()
    expect(w.findAll('tbody tr')).toHaveLength(rootEntries.length)
    expect(w.text()).toContain('Repository details')
    expect(w.text()).toContain('Locked files')
    expect(w.text()).toContain('Recent activity')
    expect(w.text()).toContain('Exclusive File Checkout')
    expect(w.text()).toContain('main')
  })

  it('does not show what the server cannot provide', () => {
    const text = landing().text()
    for (const word of ['Fork', 'Watch', 'tags', 'branches']) expect(text).not.toContain(word)
  })

  it('shows the breadcrumb of the current folder', () => {
    const w = landing({ path: 'Content/Levels', listing: folderListing })
    expect(w.find('[aria-current=page]').text()).toBe('Levels')
  })

  it('explains a missing folder and links back to the root', () => {
    const w = landing({ path: 'Gone', listing: null, missing: true })
    expect(w.find('[role=alert]').text()).toContain('/Gone')
    expect(w.find('[role=alert] a').attributes('href')).toBe('/acme/castle-quest')
    expect(w.find('table').exists()).toBe(false)
  })
})

describe('landing parts', () => {
  it('lists locks with their holders', () => {
    const w = mount(PynLockedFiles, { props: { locks: summary.locks, ...r, me: 'jamie', now } })
    expect(w.findAll('li')).toHaveLength(2)
    expect(w.text()).toContain('Level02.umap')
    expect(w.text()).toContain('bob')
    expect(w.text()).toContain('You')
  })

  it('says when nothing is locked', () => {
    expect(mount(PynLockedFiles, { props: { locks: [], ...r } }).text()).toContain('No files')
  })

  it('words each activity by its action', () => {
    const w = mount(PynActivity, { props: { entries: summary.activity, now } })
    expect(w.text()).toContain('jamie locked')
    expect(w.text()).toContain('alex checked in')
    expect(w.text()).toContain('taylor released')
  })

  it('shows counts in the details', () => {
    const w = mount(PynRepoDetails, {
      props: {
        owner: 'acme',
        visibility: 'private',
        leaseHours: 24,
        createdAt: repo.created_at,
        updatedAt: summary.updated_at,
        files: 5,
        exclusiveFiles: 2,
        sharedFiles: 3,
        now,
      },
    })
    expect(w.text()).toContain('24 hours')
    expect(w.text()).toContain('Apr 12 2026')
    expect(w.text()).toContain('2 hours ago')
  })

  it('shows the branch bar and the checkout card', () => {
    const bar = mount(PynBranchBar, { props: { branch: 'main', files: 1, updatedAt: null } })
    expect(bar.text()).toContain('1 file')
    expect(bar.text()).toContain('No revisions yet')
    expect(mount(PynCheckoutCard).text()).toContain('one person at a time')
  })

  it('renders the breadcrumb as a labelled path', () => {
    const w = mount(PynBreadcrumb, { props: { crumbs: breadcrumbs(r, 'a') } })
    expect(w.attributes('aria-label')).toBe('Path')
    expect(w.findAll('li')).toHaveLength(2)
  })
})
