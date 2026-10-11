import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PynSetup from '../src/components/PynSetup.vue'
import { stepComplete } from '../src/state/setup.state'
import type { SetupForm } from '../src/types/auth.types'

const blank: SetupForm = {
  token: '',
  username: '',
  password: '',
  email: '',
  server_name: '',
  public_url: '',
  registration: 'closed',
}

describe('setup state', () => {
  it('requires the token and the administrator credentials', () => {
    expect(stepComplete('token', blank)).toBe(false)
    expect(stepComplete('token', { ...blank, token: ' abc ' })).toBe(true)
    expect(stepComplete('admin', { ...blank, username: 'root' })).toBe(false)
    expect(stepComplete('admin', { ...blank, username: 'root', password: 'pw' })).toBe(true)
    expect(stepComplete('server', blank)).toBe(true)
  })
})

describe('PynSetup', () => {
  const next = (w: ReturnType<typeof mount>) => w.find('form').trigger('submit')

  it('walks every step and emits the form on finish', async () => {
    const w = mount(PynSetup, { props: { registration: 'closed', publicUrl: 'http://x' } })
    expect(w.text()).toContain('Step 1 of 6')
    await next(w)
    await w.find('input').setValue('tok')
    await next(w)
    const [user, pass] = w.findAll('input')
    await user.setValue('root')
    await pass.setValue('pw')
    await next(w)
    await w.find('input').setValue('Studio')
    await next(w)
    expect(w.text()).toContain('written to the server log')
    await w.find('input[value=invite]').setValue(true)
    await next(w)
    expect(w.text()).toContain('root')
    expect(w.text()).toContain('Invitation only')
    await next(w)
    expect(w.emitted('finish')?.[0]).toEqual([
      {
        token: 'tok',
        username: 'root',
        password: 'pw',
        email: '',
        server_name: 'Studio',
        public_url: 'http://x',
        registration: 'invite',
      },
    ])
  })

  it('stays on the token step until one is entered', async () => {
    const w = mount(PynSetup, { props: { registration: 'closed' } })
    await next(w)
    await next(w)
    expect(w.text()).toContain('Step 2 of 6')
  })

  it('goes back and shows an error', async () => {
    const w = mount(PynSetup, { props: { registration: 'closed', error: 'bad token' } })
    await next(w)
    expect(w.find('[role=alert]').text()).toBe('bad token')
    await w.find('button[type=button]').trigger('click')
    expect(w.text()).toContain('Step 1 of 6')
  })

  it('offers sign-in once finished', async () => {
    const w = mount(PynSetup, { props: { registration: 'closed', done: true } })
    await w.find('button').trigger('click')
    expect(w.emitted('signIn')).toHaveLength(1)
  })
})
