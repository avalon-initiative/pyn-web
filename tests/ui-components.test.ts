import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PynFileList from '../src/components/PynFileList.vue'
import PynLockBadge from '../src/components/PynLockBadge.vue'
import PynKeys from '../src/components/PynKeys.vue'
import PynAccountNotice from '../src/components/PynAccountNotice.vue'
import PynResendForm from '../src/components/PynResendForm.vue'
import PynSignIn from '../src/components/PynSignIn.vue'
import PynVerifyEmail from '../src/components/PynVerifyEmail.vue'
import { csrfHeaders, setCsrfToken } from '../src/state/csrf.state'
import { groupByTopLevel, splitPath } from '../src/state/files.state'
import { formatLease, lockState } from '../src/state/lease.state'

const now = new Date('2026-10-08T12:00:00Z')
const lock = (owner: string, minutesLeft: number) => ({
  path: 'Content/a.umap',
  owner,
  acquired_at: '2026-10-08T09:00:00Z',
  expires_at: new Date(now.getTime() + minutesLeft * 60_000).toISOString(),
})

describe('lease state', () => {
  it('formats time left', () => {
    expect(formatLease(lock('a', 222).expires_at, now)).toBe('3h 42m')
    expect(formatLease(lock('a', 12).expires_at, now)).toBe('12m')
    expect(formatLease(lock('a', 0.5).expires_at, now)).toBe('<1m')
    expect(formatLease(lock('a', -1).expires_at, now)).toBe('expired')
  })

  it('classifies locks for the viewer', () => {
    expect(lockState(undefined, 'me', now)).toBe('available')
    expect(lockState(lock('bob', 120), 'me', now)).toBe('locked')
    expect(lockState(lock('me', 120), 'me', now)).toBe('mine')
    expect(lockState(lock('bob', 10), 'me', now)).toBe('expiring')
    expect(lockState(lock('bob', -10), 'me', now)).toBe('available')
  })
})

describe('files state', () => {
  it('splits a path into folder and file name', () => {
    expect(splitPath('Content/World/Main.umap')).toEqual({
      dir: 'Content/World/',
      name: 'Main.umap',
    })
    expect(splitPath('README.md')).toEqual({ dir: '', name: 'README.md' })
  })

  it('groups rows by top-level folder, keeping order', () => {
    const rows = [
      { path: 'Content/a.umap', mode: 'exclusive' as const },
      { path: 'README.md', mode: 'shared' as const },
      { path: 'Content/b.umap', mode: 'exclusive' as const },
    ]
    const groups = groupByTopLevel(rows)
    expect(groups.map((g) => [g.name, g.rows.length])).toEqual([
      ['Content', 2],
      ['(root)', 1],
    ])
  })
})

describe('PynLockBadge', () => {
  it('shows who holds the lock and for how long', () => {
    const w = mount(PynLockBadge, { props: { lock: lock('bob', 222), me: 'alice', now } })
    expect(w.text()).toContain('bob')
    expect(w.text()).toContain('3h 42m')
    expect(w.attributes('data-state')).toBe('locked')
  })

  it('says You for your own lock and Available when unlocked', () => {
    expect(
      mount(PynLockBadge, { props: { lock: lock('alice', 60), me: 'alice', now } }).text(),
    ).toContain('You')
    expect(mount(PynLockBadge, { props: { now } }).text()).toContain('Available')
  })
})

describe('PynFileList', () => {
  it('shows a lock badge only for exclusive files', () => {
    const w = mount(PynFileList, {
      props: {
        now,
        rows: [
          { path: 'Content/a.umap', mode: 'exclusive', revision: 3, lock: lock('bob', 60) },
          { path: 'Source/a.cpp', mode: 'shared', revision: 9 },
        ],
      },
    })
    expect(w.findAll('li')).toHaveLength(2)
    expect(w.findAll('[data-state]')).toHaveLength(1)
    expect(w.text()).toContain('r9')
  })

  it('shows the folder and file name separately and tolerates null from the API', () => {
    const w = mount(PynFileList, {
      props: {
        now,
        rows: [{ path: 'Content/World/Main.umap', mode: 'exclusive', revision: null, lock: null }],
      },
    })
    expect(w.text()).toContain('Content/World/')
    expect(w.text()).toContain('Main.umap')
    expect(w.text()).not.toContain('rnull')
    expect(w.text()).toContain('Available')
  })

  it('renders an empty state', () => {
    expect(mount(PynFileList, { props: { rows: [] } }).text()).toContain('No files')
  })
})

describe('repo rules', () => {
  it('has no <style> block in any component (styles live in src/styles/*.module.scss)', () => {
    const dir = join(import.meta.dirname, '../src')
    const vues = (d: string): string[] =>
      readdirSync(d, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? vues(join(d, e.name)) : e.name.endsWith('.vue') ? [join(d, e.name)] : [],
      )
    for (const f of vues(dir)) expect(readFileSync(f, 'utf8'), f).not.toMatch(/<style[\s>]/)
  })
})

describe('csrfHeaders', () => {
  it('adds the token to state-changing requests only, and nothing before sign-in', () => {
    setCsrfToken('')
    expect(csrfHeaders('POST')).toEqual({})
    setCsrfToken('abc')
    expect(csrfHeaders('POST')).toEqual({ 'X-Pyn-CSRF': 'abc' })
    expect(csrfHeaders('delete')).toEqual({ 'X-Pyn-CSRF': 'abc' })
    expect(csrfHeaders('GET')).toEqual({})
    setCsrfToken('')
  })
})

describe('PynSignIn', () => {
  const fill = async (w: ReturnType<typeof mount>, values: string[]) => {
    const inputs = w.findAll('input')
    for (const [i, v] of values.entries()) await inputs[i].setValue(v)
  }

  it('emits the user name and password when signing in', async () => {
    const w = mount(PynSignIn, { props: { registration: 'invite' } })
    await fill(w, ['alice', 'a long password'])
    await w.find('form').trigger('submit')
    expect(w.emitted('signIn')?.[0]).toEqual([{ username: 'alice', password: 'a long password' }])
  })

  it('offers an invitation field on invite-only servers and not on open ones', async () => {
    const invite = mount(PynSignIn, { props: { registration: 'invite' } })
    await invite
      .findAll('button')
      .find((b) => b.text() === 'I have an invitation')!
      .trigger('click')
    expect(invite.findAll('input')).toHaveLength(3)
    await fill(invite, ['wendy', 'a long password', 'pyni_x'])
    await invite.find('form').trigger('submit')
    expect(invite.emitted('register')?.[0]).toEqual([
      { username: 'wendy', password: 'a long password', invite: 'pyni_x' },
    ])

    const open = mount(PynSignIn, { props: { registration: 'open' } })
    await open
      .findAll('button')
      .find((b) => b.text() === 'Create an account')!
      .trigger('click')
    expect(open.findAll('input')).toHaveLength(2)
  })

  it('hides registration on closed servers and offers no token entry', () => {
    const w = mount(PynSignIn, { props: { registration: 'closed' } })
    const labels = w.findAll('button').map((b) => b.text())
    expect(labels).not.toContain('Create an account')
    expect(labels).not.toContain('I have an invitation')
    expect(labels.join(' ')).not.toMatch(/token/i)
  })

  it('shows an error', () => {
    const w = mount(PynSignIn, {
      props: { registration: null, error: 'wrong user name or password' },
    })
    expect(w.find('[role=alert]').text()).toContain('wrong user name')
  })
})

describe('sign-up and account states', () => {
  const fillAll = async (w: ReturnType<typeof mount>, values: string[]) => {
    const inputs = w.findAll('input')
    for (const [i, v] of values.entries()) await inputs[i].setValue(v)
  }

  it('asks for an email on open servers that verify addresses', async () => {
    const w = mount(PynSignIn, { props: { registration: 'open', emailVerification: true } })
    await w
      .findAll('button')
      .find((b) => b.text() === 'Create an account')!
      .trigger('click')
    expect(w.findAll('input')).toHaveLength(3)
    await fillAll(w, ['wendy', 'a long password', 'w@example.com'])
    await w.find('form').trigger('submit')
    expect(w.emitted('register')?.[0]).toEqual([
      { username: 'wendy', password: 'a long password', email: 'w@example.com', invite: undefined },
    ])
  })

  it.each([
    ['pending_verification', 'Check your email'],
    ['pending_approval', 'Waiting for approval'],
    ['account_disabled', 'Account disabled'],
  ] as const)('shows the %s state instead of the form', async (status, title) => {
    const w = mount(PynSignIn, {
      props: { registration: 'open', notice: { status, user: 'wendy' } },
    })
    expect(w.find('form input[autocomplete=username]').exists()).toBe(false)
    expect(w.text()).toContain(title)
    expect(w.text()).toContain('wendy')
    expect(w.findAll('input[type=email]')).toHaveLength(status === 'pending_verification' ? 1 : 0)
    await w
      .findAll('button')
      .find((b) => b.text() === 'Back to sign in')!
      .trigger('click')
    expect(w.emitted('dismiss')).toHaveLength(1)
  })

  it('emits the address to resend to and confirms without revealing the account', async () => {
    const w = mount(PynAccountNotice, { props: { status: 'pending_verification', sent: true } })
    await w.find('input').setValue('w@example.com')
    await w.find('form').trigger('submit')
    expect(w.emitted('resend')?.[0]).toEqual(['w@example.com'])
    expect(w.find('[role=status]').text()).toContain('If that address')
  })

  it('renders the resend form states', () => {
    const w = mount(PynResendForm, { props: { sent: true, error: 'Too many attempts.' } })
    expect(w.find('[role=status]').exists()).toBe(true)
    expect(w.find('[role=alert]').text()).toContain('Too many')
  })

  it('shows the verification outcomes', () => {
    const outcome = (props: object) => mount(PynVerifyEmail, { props: props as never })
    expect(outcome({ outcome: 'verifying' }).text()).toContain('Verifying')
    const ok = outcome({ outcome: 'verified', status: 'active', user: 'wendy' })
    expect(ok.text()).toContain('You can sign in now')
    expect(ok.find('a').attributes('href')).toBe('/')
    const wait = outcome({ outcome: 'verified', status: 'pending_approval' })
    expect(wait.text()).toContain('must approve')
    const bad = outcome({
      outcome: 'invalid',
      resendError: 'Too many attempts. Try again in 5 minutes.',
    })
    expect(bad.text()).toContain('Link not valid')
    expect(bad.find('input[type=email]').exists()).toBe(true)
    expect(bad.text()).toContain('5 minutes')
  })
})

describe('PynKeys', () => {
  const keys = [
    {
      id: 'aaaaaaaaaaaa',
      title: 'work laptop',
      algorithm: 'ssh-ed25519',
      fingerprint: 'SHA256:abc',
      created_at: '2026-10-08T09:00:00Z',
      last_used_at: null,
    },
  ]

  it('lists keys with their fingerprint and whether they were used', () => {
    const w = mount(PynKeys, { props: { keys } })
    expect(w.text()).toContain('work laptop')
    expect(w.text()).toContain('SHA256:abc')
    expect(w.text()).toContain('Added Oct 08 2026')
    expect(w.text()).toContain('never used')
  })

  it('says so when there are no keys', () => {
    expect(mount(PynKeys, { props: { keys: [] } }).text()).toContain('No keys yet')
  })

  it('emits the pasted key and title, then clears the form', async () => {
    const w = mount(PynKeys, { props: { keys: [] } })
    await w.find('input').setValue('laptop')
    await w.find('textarea').setValue('  ssh-ed25519 AAAA  ')
    await w.find('form').trigger('submit')
    expect(w.emitted('add')?.[0]).toEqual([{ key: 'ssh-ed25519 AAAA', title: 'laptop' }])
    expect((w.find('textarea').element as HTMLTextAreaElement).value).toBe('')
  })

  it('emits the id to remove and shows an error', async () => {
    const w = mount(PynKeys, { props: { keys, error: 'that key is already linked to an account' } })
    expect(w.find('[role=alert]').text()).toContain('already linked')
    await w.find('button.remove, button[type=button]').trigger('click')
    expect(w.emitted('remove')?.[0]).toEqual(['aaaaaaaaaaaa'])
  })
})
