<script setup lang="ts">
import { computed } from 'vue'
import PynIcon from './PynIcon.vue'
import PynMenu from './PynMenu.vue'
import PynSearch from './PynSearch.vue'
import styles from '../styles/PynTopBar.module.scss'
import { themeChoices } from '../state/theme.state'
import type { ThemeChoice } from '../state/theme.state'
import type { MenuItem } from '../types/shell.types'

const props = defineProps<{ user: string; repos: string[]; theme: ThemeChoice }>()
const emit = defineEmits<{ open: [slug: string]; theme: [ThemeChoice]; signOut: [] }>()

const create: MenuItem[] = [{ id: 'new-repo', label: 'New repository', href: '/_/new' }]
const account = computed<MenuItem[]>(() => [
  { id: 'keys', label: 'SSH keys', href: '/_/keys' },
  { id: 'sep-theme', label: '', separator: true },
  ...themeChoices.map((t) => ({
    id: `theme:${t.id}`,
    label: `${t.label} theme`,
    checked: props.theme === t.id,
  })),
  { id: 'sep-out', label: '', separator: true },
  { id: 'sign-out', label: 'Sign out' },
])

function pick(id: string) {
  if (id === 'sign-out') emit('signOut')
  else if (id.startsWith('theme:')) emit('theme', id.slice(6) as ThemeChoice)
}
</script>

<template>
  <div :class="styles.bar">
    <a href="/" :class="styles.brand">PYN</a>
    <PynSearch :options="repos" :class="styles.search" @open="emit('open', $event)" />
    <PynMenu label="Create" :items="create">
      <PynIcon name="plus" /><PynIcon name="chevron" :class="styles.chevron" />
    </PynMenu>
    <PynMenu label="Account menu" :items="account" @select="pick">
      <template #header>
        <p :class="styles.who">Signed in as {{ user }}</p>
      </template>
      <span :class="styles.avatar">{{ user.slice(0, 1).toUpperCase() }}</span>
    </PynMenu>
  </div>
</template>
