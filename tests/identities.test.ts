import { PynIdentities, accountNav, accountNavItems } from '@avalon-initiative/pyn-common-ui'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

const provider = { name: 'Acme SSO', sign_in_url: '/v1/oidc/authorize' }
const identities = [
  {
    id: 'aaaaaaaaaaaa',
    issuer: 'https://id.acme.example',
    subject: 'u-1',
    email: 'wendy@acme.example',
    created_at: '2026-10-08T09:00:00Z',
    last_sign_in_at: null,
  },
]

describe('PynIdentities', () => {
  it('lists links and offers unlink and link', async () => {
    const w = mount(PynIdentities, { props: { identities, provider } })
    expect(w.text()).toContain('wendy@acme.example')
    expect(w.text()).toContain('never used')
    await w.findAll('button')[0].trigger('click')
    expect(w.emitted('unlink')?.[0]).toEqual(['aaaaaaaaaaaa'])
    await w.findAll('button')[1].trigger('click')
    expect(w.emitted('link')).toHaveLength(1)
  })

  it('says so when nothing is linked and shows an error', () => {
    const w = mount(PynIdentities, { props: { identities: [], provider, error: 'only way in' } })
    expect(w.text()).toContain('Nothing linked yet')
    expect(w.find('[role=alert]').text()).toBe('only way in')
  })
})

describe('settings navigation', () => {
  it('adds linked sign-in only when a provider exists', () => {
    expect(accountNavItems(false)).toEqual(accountNav)
    expect(accountNavItems(true).map((i) => i.id)).toEqual(['keys', 'tokens', 'identities'])
  })
})
