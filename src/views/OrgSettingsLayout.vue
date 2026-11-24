<script setup lang="ts">
import {
  PynOrgSettingsLayout,
  orgSettingsNav,
  orgSettingsPath,
} from '@avalon-initiative/pyn-common-ui'
import { computed, inject } from 'vue'
import { useRoute } from 'vue-router'
import NotFoundView from './NotFoundView.vue'
import { orgKey } from '../state/context.state'

const { name, org } = inject(orgKey)!
const route = useRoute()
const sections = computed(() =>
  orgSettingsNav(org.value?.role).map((i) => ({
    id: i.section,
    label: i.label,
    group: i.group,
    icon: i.icon,
    href: orgSettingsPath(name.value, i.section),
  })),
)
const current = computed(() => route.path.split('/')[4] || 'settings')
</script>

<template>
  <PynOrgSettingsLayout v-if="sections.length" :sections="sections" :current="current">
    <RouterView />
  </PynOrgSettingsLayout>
  <NotFoundView v-else />
</template>
