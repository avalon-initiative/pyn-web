import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { makeRouter } from '../src/router'
import { repoKey } from '../src/state/context.state'
import RepoAuditView from '../src/views/RepoAuditView.vue'
import RepoHistoryView from '../src/views/RepoHistoryView.vue'
import RepoLocksView from '../src/views/RepoLocksView.vue'
import RepoMembersView from '../src/views/RepoMembersView.vue'

const reply = (body: unknown) => new Response(JSON.stringify(body))
const identity = {
  user: 'alicia',
  display_name: 'Alicia Rivera',
  avatar_url: '/v1/users/alicia/avatar?v=3',
}

async function view(component: object, body: unknown, url: string) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(body)))
  const router = makeRouter(createMemoryHistory())
  await router.push(url)
  const w = mount(component, {
    global: {
      plugins: [router],
      provide: {
        [repoKey as symbol]: {
          target: ref({ owner: 'alice', name: 'game' }),
          permissions: ref(['read', 'view_audit']),
          org: ref(null),
          frozen: ref(false),
          locks: ref(null),
          branches: ref([]),
        },
      },
    },
  })
  await flushPromises()
  return w
}

afterEach(() => vi.unstubAllGlobals())

describe('current author names', () => {
  it('history shows the current name and the written one', async () => {
    const w = await view(
      RepoHistoryView,
      {
        revisions: [
          {
            id: 1,
            path: 'a.ts',
            author: 'alice',
            author_current: 'alicia',
            content: '0'.repeat(64),
            message: 'm1',
            created_at: '2026-10-08T11:00:00Z',
          },
        ],
        next_cursor: null,
      },
      '/alice/game/history',
    )
    expect(w.text()).toContain('alicia')
    expect(w.text()).toContain('written as alice')
  })

  it('history shows the display name from the public identity', async () => {
    const w = await view(
      RepoHistoryView,
      {
        revisions: [
          {
            id: 1,
            path: 'a.ts',
            author: 'alice',
            author_current: 'alicia',
            author_public: identity,
            content: '0'.repeat(64),
            message: 'm1',
            created_at: '2026-10-08T11:00:00Z',
          },
        ],
        next_cursor: null,
      },
      '/alice/game/history',
    )
    expect(w.text()).toContain('Alicia Rivera')
    expect(w.find('img').attributes('src')).toBe('/v1/users/alicia/avatar?v=3')
  })

  it('audit shows the current actor name', async () => {
    const w = await view(
      RepoAuditView,
      {
        entries: [
          {
            id: 1,
            at: '2026-10-08T11:00:00Z',
            actor: 'alice',
            actor_current: 'alicia',
            hash: 'a'.repeat(64),
            action: 'repo_created',
            detail: 'alice/game',
          },
        ],
        next_before: null,
      },
      '/alice/game/audit',
    )
    expect(w.text()).toContain('alicia')
    expect(w.text()).toContain('written as alice')
  })

  it('locks and members show the holder identity', async () => {
    const locks = await view(
      RepoLocksView,
      [
        {
          path: 'a.umap',
          owner: 'alice',
          identity,
          acquired_at: '2026-10-08T10:00:00Z',
          expires_at: '2026-10-08T18:00:00Z',
        },
      ],
      '/alice/game/locks',
    )
    expect(locks.text()).toContain('Alicia Rivera')
    const members = await view(
      RepoMembersView,
      [{ user: 'alice', role: 'writer', source: 'direct', identity }],
      '/alice/game/settings/members',
    )
    expect(members.text()).toContain('Alicia Rivera')
  })
})
