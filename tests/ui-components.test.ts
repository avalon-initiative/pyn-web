import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PynFileList from '../src/components/PynFileList.vue'
import PynLockBadge from '../src/components/PynLockBadge.vue'
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
