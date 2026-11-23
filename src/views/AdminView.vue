<script setup lang="ts">
import { PynAdminLayout, PynUpdateNotice, adminNavItems } from '@avalon-initiative/pyn-common-ui'
import { computed, inject } from 'vue'
import { useRoute } from 'vue-router'
import { fetchUpdateStatus } from '../api/admin'
import { useUpdateNotice } from '../state/update-notice.state'
import NotFoundView from './NotFoundView.vue'
import { sessionKey } from '../state/context.state'

const { admin } = inject(sessionKey)!
const route = useRoute()
const { notice, dismiss } = useUpdateNotice(() =>
  admin.value ? fetchUpdateStatus() : Promise.reject(),
)
const [accounts, ...others] = adminNavItems()
const items = [
  accounts,
  { id: 'invitations', label: 'Invitations', href: '/_/admin/invitations' },
  ...others,
  { id: 'two-factor', label: 'Two-factor', href: '/_/admin/two-factor' },
  { id: 'access-sessions', label: 'Access sessions', href: '/_/admin/access-sessions' },
]
const current = computed(() => String(route.name ?? '').replace(/^admin-/, ''))
</script>

<template>
  <NotFoundView v-if="!admin" />
  <PynAdminLayout v-else :items="items" :current="current">
    <PynUpdateNotice v-if="notice" v-bind="notice" @dismiss="dismiss" />
    <RouterView />
  </PynAdminLayout>
</template>
