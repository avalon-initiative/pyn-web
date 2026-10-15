import { PynTokens, expiryFromDate, parseRepos } from '@avalon-initiative/pyn-common-ui'
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

const tokens = [
  {
    id: 'aaaaaaaaaaaa',
    user: 'alice',
    name: 'ci',
    repos: ['acme/game'],
    permissions: ['read', 'lock'],
    created_at: '2026-10-08T09:00:00Z',
    expires_at: null,
    last_used_at: null,
  },
  {
    id: 'bbbbbbbbbbbb',
    user: 'alice',
    name: 'old',
    repos: [],
    permissions: ['read'],
    created_at: '2026-10-01T09:00:00Z',
    revoked_at: '2026-10-02T09:00:00Z',
  },
]

describe('token state', () => {
  it('splits and de-duplicates repositories', () => {
    expect(parseRepos('a/b, c/d\na/b  e/f')).toEqual(['a/b', 'c/d', 'e/f'])
    expect(parseRepos('')).toEqual([])
  })

  it('turns a date into an end-of-day expiry', () => {
    expect(expiryFromDate('2027-01-01')).toBe('2027-01-01T23:59:59Z')
    expect(expiryFromDate('')).toBeNull()
  })
})

describe('PynTokens', () => {
  it('lists tokens and only offers revoke for live ones', () => {
    const w = mount(PynTokens, { props: { tokens } })
    expect(w.text()).toContain('acme/game')
    expect(w.text()).toContain('no expiry')
    expect(w.text()).toContain('revoked')
    expect(w.findAll('button').filter((b) => b.text() === 'Revoke')).toHaveLength(1)
  })

  it('says so when there are no tokens', () => {
    expect(mount(PynTokens, { props: { tokens: [] } }).text()).toContain('No tokens yet')
  })

  it('emits the form and resets it', async () => {
    const w = mount(PynTokens, { props: { tokens: [] } })
    await w.find('input').setValue(' ci ')
    await w.find('textarea').setValue('acme/game acme/tools')
    await w.find('input[type=date]').setValue('2027-01-01')
    await w.find('input[value=lock]').setValue(true)
    await w.find('form').trigger('submit')
    expect(w.emitted('create')?.[0]).toEqual([
      {
        name: 'ci',
        repos: ['acme/game', 'acme/tools'],
        permissions: ['read', 'lock'],
        expires_at: '2027-01-01T23:59:59Z',
      },
    ])
    expect((w.find('textarea').element as HTMLTextAreaElement).value).toBe('')
  })

  it('shows the secret once and the error', async () => {
    const w = mount(PynTokens, { props: { tokens: [], secret: 'pyn_abc', error: 'nope' } })
    expect(w.text()).toContain('pyn_abc')
    expect(w.find('[role=alert]').text()).toBe('nope')
    await w.find('[role=status] button').trigger('click')
    expect(w.emitted('dismiss')).toHaveLength(1)
  })

  it('emits the id to revoke', async () => {
    const w = mount(PynTokens, { props: { tokens } })
    await w
      .findAll('button')
      .find((b) => b.text() === 'Revoke')!
      .trigger('click')
    expect(w.emitted('revoke')?.[0]).toEqual(['aaaaaaaaaaaa'])
  })
})
