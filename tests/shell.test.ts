import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import PynAccountSettings from '../src/components/PynAccountSettings.vue'
import PynMenu from '../src/components/PynMenu.vue'
import PynModeChip from '../src/components/PynModeChip.vue'
import PynRepoHeader from '../src/components/PynRepoHeader.vue'
import PynSearch from '../src/components/PynSearch.vue'
import PynShell from '../src/components/PynShell.vue'
import PynSideNav from '../src/components/PynSideNav.vue'
import PynTopBar from '../src/components/PynTopBar.vue'
import { repoTabs } from '../src/state/repo.state'
import { accountNav, activeNav, mainNav, matchRepos } from '../src/state/shell.state'
import { applyTheme, loadTheme, saveTheme } from '../src/state/theme.state'
import { sampleRepos } from '../src/stories/shell-data'

describe('shell state', () => {
  it('matches the active sidebar item by path', () => {
    expect(activeNav('/')).toBe('home')
    expect(activeNav('/alice/game')).toBe('')
    expect(activeNav('/_/locks')).toBe('locks')
  })

  it('matches repositories case-insensitively and returns nothing for an empty query', () => {
    expect(matchRepos(['alice/Game', 'bob/tools'], 'GAM')).toEqual(['alice/Game'])
    expect(matchRepos(['alice/game'], ' ')).toEqual([])
  })
})

describe('theme state', () => {
  it('remembers light and dark, treats anything else as system', () => {
    localStorage.clear()
    expect(loadTheme()).toBe('system')
    saveTheme('light')
    expect(loadTheme()).toBe('light')
    saveTheme('system')
    expect(loadTheme()).toBe('system')
    localStorage.setItem('pyn-theme', 'bogus')
    expect(loadTheme()).toBe('system')
    localStorage.clear()
  })

  it('survives blocked storage', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(loadTheme()).toBe('system')
    expect(() => saveTheme('dark')).not.toThrow()
    get.mockRestore()
    set.mockRestore()
  })

  it('sets and clears the root override', () => {
    const root = document.createElement('html')
    applyTheme('dark', root)
    expect(root.dataset.theme).toBe('dark')
    applyTheme('system', root)
    expect(root.dataset.theme).toBeUndefined()
  })
})

describe('PynModeChip', () => {
  it('names the mode', () => {
    expect(mount(PynModeChip, { props: { mode: 'shared' } }).text()).toBe('Shared')
    const w = mount(PynModeChip, { props: { mode: 'exclusive' } })
    expect(w.text()).toBe('Exclusive')
    expect(w.attributes('data-mode')).toBe('exclusive')
  })
})

describe('PynMenu', () => {
  it('opens on click, emits a choice and closes', async () => {
    const w = mount(PynMenu, {
      props: { label: 'Theme', items: [{ id: 'dark', label: 'Dark', checked: false }] },
    })
    expect(w.find('[role=menu]').exists()).toBe(false)
    await w.find('button').trigger('click')
    await w.find('[role=menuitemradio]').trigger('click')
    expect(w.emitted('select')?.[0]).toEqual(['dark'])
    expect(w.find('[role=menu]').exists()).toBe(false)
  })
})

describe('PynSearch', () => {
  it('opens the matching repository on submit', async () => {
    const w = mount(PynSearch, { props: { options: ['alice/game', 'bob/tools'] } })
    await w.find('input').setValue('bob')
    await w.find('form').trigger('submit')
    expect(w.emitted('open')?.[0]).toEqual(['bob/tools'])
  })

  it('does nothing when nothing matches', async () => {
    const w = mount(PynSearch, { props: { options: ['alice/game'] } })
    await w.find('input').setValue('zzz')
    await w.find('form').trigger('submit')
    expect(w.emitted('open')).toBeUndefined()
  })
})

describe('PynTopBar', () => {
  it('offers the theme choices, marks the current one and emits changes', async () => {
    const w = mount(PynTopBar, { props: { user: 'alice', repos: [], theme: 'light' } })
    await w.find('[aria-label="Account menu"]').trigger('click')
    const radios = w.findAll('[role=menuitemradio]')
    expect(radios.map((r) => r.text().replace('✓', ''))).toEqual([
      'System theme',
      'Light theme',
      'Dark theme',
    ])
    expect(radios.map((r) => r.attributes('aria-checked'))).toEqual(['false', 'true', 'false'])
    await radios[2].trigger('click')
    expect(w.emitted('theme')?.[0]).toEqual(['dark'])
  })

  it('links to account settings and emits sign out', async () => {
    const w = mount(PynTopBar, { props: { user: 'alice', repos: [], theme: 'system' } })
    await w.find('[aria-label="Account menu"]').trigger('click')
    expect(w.find('a[href="/_/settings"]').exists()).toBe(true)
    await w
      .findAll('button')
      .find((b) => b.text() === 'Sign out')!
      .trigger('click')
    expect(w.emitted('signOut')).toHaveLength(1)
  })
})

describe('PynSideNav', () => {
  it('lists the main items and the repositories, marking the current ones', () => {
    const w = mount(PynSideNav, {
      props: {
        account: 'alice',
        items: mainNav,
        current: 'home',
        repos: sampleRepos,
        currentRepo: 'alice/core-engine',
      },
    })
    expect(w.findAll('a').map((a) => a.attributes('href'))).toContain('/alice/castle-quest')
    expect(w.text()).toContain('Home')
    expect(w.text()).not.toContain('Settings')
    expect(w.findAll('[aria-current]').map((a) => a.text())).toEqual(['Home', 'alice/core-engine'])
    expect(w.find('button').attributes('disabled')).toBeDefined()
  })

  it('says when there are no repositories', () => {
    const w = mount(PynSideNav, {
      props: { account: 'alice', items: mainNav, current: '', repos: [] },
    })
    expect(w.text()).toContain('None yet')
  })
})

describe('PynAccountSettings', () => {
  it('lists the settings pages, marks the current one and renders the page', () => {
    const w = mount(PynAccountSettings, {
      props: { items: accountNav, current: 'keys' },
      slots: { default: '<p>content</p>' },
    })
    const link = w.find('a[aria-current="page"]')
    expect(link.text()).toBe('SSH keys')
    expect(link.attributes('href')).toBe('/_/settings/keys')
    expect(w.text()).toContain('content')
  })
})

describe('PynRepoHeader', () => {
  it('shows name, visibility and the permitted tabs', () => {
    const w = mount(PynRepoHeader, {
      props: {
        owner: 'alice',
        name: 'game',
        visibility: 'private',
        leaseHours: 24,
        tabs: repoTabs(['read'], false),
      },
    })
    expect(w.find('h1').text()).toContain('alice/game')
    expect(w.find('[data-visibility]').text()).toBe('private')
    expect(w.findAll('nav a').map((a) => a.text())).toEqual(['Code', 'Locks', 'History'])
  })

  it('omits the tab row without access', () => {
    const w = mount(PynRepoHeader, {
      props: { owner: 'a', name: 'b', visibility: 'public', leaseHours: 1 },
    })
    expect(w.find('nav').exists()).toBe(false)
  })
})

describe('PynShell', () => {
  it('toggles the sidebar and closes it after following a link', async () => {
    const w = mount(PynShell, { slots: { side: '<a href="#x">x</a>', default: 'body' } })
    const side = w.find('aside')
    expect(side.classes().length).toBe(1)
    await w.find('[aria-label="Toggle navigation"]').trigger('click')
    expect(side.classes().length).toBe(2)
    await side.find('a').trigger('click')
    expect(side.classes().length).toBe(1)
  })
})
