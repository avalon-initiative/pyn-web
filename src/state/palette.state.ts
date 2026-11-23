import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Ref } from 'vue'
import {
  createShortcutMatcher,
  filterCommands,
  orgPath,
  repoPath,
  repoSettingsPath,
} from '@avalon-initiative/pyn-common-ui'
import type {
  CommandItem,
  OrgInfo,
  RecentItem,
  RepoInfo,
  RepoRef,
  ShortcutBinding,
  ShortcutGroup,
} from '@avalon-initiative/pyn-common-ui'
import { listPeople } from '../api/people'
import { PEOPLE_SEARCH_MAX } from './people.state'

export const PALETTE_PEOPLE_MAX = 5
const PEOPLE_DELAY_MS = 250

interface Chord {
  id: string
  keys: string[]
  label: string
  /** Where it goes; null when it does not apply in this context. */
  to: (repo: RepoRef | null) => string | null
}

const inRepo = (path: (r: RepoRef) => string) => (r: RepoRef | null) => (r ? path(r) : null)

// Order is the order shown in the help dialog.
const CHORDS: Chord[] = [
  { id: 'dashboard', keys: ['g', 'd'], label: 'Go to dashboard', to: () => '/' },
  { id: 'my-locks', keys: ['g', 'm'], label: 'Go to your locks', to: () => '/_/locks' },
  {
    id: 'notifications',
    keys: ['g', 'n'],
    label: 'Go to notifications',
    to: () => '/_/invitations',
  },
  { id: 'code', keys: ['g', 'c'], label: 'Go to code', to: inRepo((r) => repoPath(r)) },
  { id: 'locks', keys: ['g', 'l'], label: 'Go to locks', to: inRepo((r) => repoPath(r, 'locks')) },
  {
    id: 'history',
    keys: ['g', 'h'],
    label: 'Go to history',
    to: inRepo((r) => repoPath(r, 'history')),
  },
  {
    id: 'policy',
    keys: ['g', 'p'],
    label: 'Go to policy',
    to: inRepo((r) => repoSettingsPath(r, 'policy')),
  },
  // Outside a repository `g s` opens account settings.
  {
    id: 'settings',
    keys: ['g', 's'],
    label: 'Go to settings',
    to: (r) => (r ? repoPath(r, 'settings') : '/_/settings'),
  },
]

export const OPEN_PALETTE = 'palette'
export const OPEN_HELP = 'help'

export const shortcutBindings = (): ShortcutBinding[] => [
  { id: OPEN_HELP, keys: ['?'] },
  ...CHORDS.map(({ id, keys }) => ({ id, keys })),
]

/** The chord's destination, or null when it needs a repository and there is none. */
export function chordTarget(id: string, repo: RepoRef | null): string | null {
  return CHORDS.find((c) => c.id === id)?.to(repo) ?? null
}

export function shortcutGroups(inRepository: boolean): ShortcutGroup[] {
  const chords = (repoOnly: boolean) =>
    CHORDS.filter((c) => (c.to(null) === null) === repoOnly).map((c) => ({
      keys: c.keys,
      label: c.label,
    }))
  return [
    {
      title: 'Anywhere',
      shortcuts: [
        { keys: ['Ctrl', 'K'], label: 'Open the command palette' },
        { keys: ['/'], label: 'Search' },
        { keys: ['?'], label: 'Show keyboard shortcuts' },
        ...chords(false),
      ],
    },
    ...(inRepository ? [{ title: 'In a repository', shortcuts: chords(true) }] : []),
  ]
}

export function pageItems(admin: boolean): CommandItem[] {
  const page = (id: string, label: string, href: string, hint?: string): CommandItem => ({
    id,
    label,
    href,
    group: 'Pages',
    hint,
  })
  return [
    page('dashboard', 'Dashboard', '/', 'g d'),
    page('my-locks', 'Your locks', '/_/locks', 'g m'),
    page('notifications', 'Notifications', '/_/invitations', 'g n'),
    page('settings', 'Account settings', '/_/settings'),
    page('new-repo', 'New repository', '/_/new'),
    page('new-org', 'New organization', '/_/new-org'),
    page('orgs', 'Your organizations', '/_/orgs'),
    page('people', 'People', '/_/people'),
    ...(admin ? [page('admin', 'Server administration', '/_/admin')] : []),
  ]
}

export function localItems(
  admin: boolean,
  repos: RepoInfo[],
  orgs: OrgInfo[],
  recent: RecentItem[],
): CommandItem[] {
  return [
    ...pageItems(admin),
    ...repos.map((r) => ({
      id: `repo:${r.owner}/${r.name}`,
      label: `${r.owner}/${r.name}`,
      group: 'Repositories',
      href: repoPath(r),
      hint: r.visibility,
    })),
    ...orgs.map((o) => ({
      id: `org:${o.name}`,
      label: o.name,
      group: 'Organizations',
      href: orgPath(o.name),
    })),
    ...recent.map((i) => ({
      id: `recent:${i.href}`,
      label: i.label,
      group: 'Recent',
      href: i.href,
      hint: i.kind,
    })),
  ]
}

/** The items matching the text (library fuzzy match), then the server's people results; empty text shows recent ones first. */
export function paletteItems(local: CommandItem[], text: string, people: CommandItem[]) {
  const t = text.trim()
  const matched = filterCommands(t ? local.filter((i) => i.group !== 'Recent') : local, t)
  return [...matched, ...people]
}

export function usePalette(opts: {
  user: Ref<string>
  admin: Ref<boolean>
  repos: Ref<RepoInfo[]>
  orgs: Ref<OrgInfo[]>
  recent: Ref<RecentItem[]>
  repo: Ref<RepoRef | null>
  go: (path: string) => unknown
}) {
  const open = ref(false)
  const helpOpen = ref(false)
  const text = ref('')
  const people = ref<CommandItem[]>([])
  const loading = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  let seq = 0

  const local = computed(() =>
    localItems(opts.admin.value, opts.repos.value, opts.orgs.value, opts.recent.value),
  )
  const items = computed(() => paletteItems(local.value, text.value, people.value))
  const help = computed(() => shortcutGroups(opts.repo.value !== null))

  function reset() {
    clearTimeout(timer)
    seq++
    text.value = ''
    people.value = []
    loading.value = false
  }

  function show() {
    reset()
    helpOpen.value = false
    open.value = true
  }

  function close() {
    open.value = false
    reset()
  }

  function input(value: string) {
    text.value = value
    clearTimeout(timer)
    const q = value.trim().slice(0, PEOPLE_SEARCH_MAX)
    const mine = ++seq
    if (!q) {
      people.value = []
      loading.value = false
      return
    }
    loading.value = true
    timer = setTimeout(async () => {
      let found: CommandItem[] = []
      try {
        const page = await listPeople({ q, limit: PALETTE_PEOPLE_MAX })
        found = page.people.map((p) => ({
          id: `person:${p.identity.user}`,
          label: p.identity.user,
          group: 'People',
          href: `/${p.identity.user}`,
          hint: p.identity.display_name ?? undefined,
        }))
      } catch {
        // local results still show
      }
      if (mine !== seq) return
      people.value = found
      loading.value = false
    }, PEOPLE_DELAY_MS)
  }

  function select(item: CommandItem) {
    close()
    if (item.href) void opts.go(item.href)
  }

  const matcher = createShortcutMatcher(shortcutBindings())
  function onKey(e: KeyboardEvent) {
    if (!opts.user.value) return
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      if (open.value) close()
      else show()
      return
    }
    if (open.value || helpOpen.value) return
    const id = matcher.handle(e)
    if (id === null) return
    if (id === OPEN_HELP) {
      e.preventDefault()
      helpOpen.value = true
      return
    }
    const to = chordTarget(id, opts.repo.value)
    if (to !== null) void opts.go(to)
  }

  onMounted(() => document.addEventListener('keydown', onKey))
  onBeforeUnmount(() => {
    document.removeEventListener('keydown', onKey)
    clearTimeout(timer)
  })
  watch(opts.user, (name) => {
    if (!name) {
      open.value = false
      helpOpen.value = false
      reset()
    }
  })

  return { open, helpOpen, items, loading, help, show, close, input, select }
}
