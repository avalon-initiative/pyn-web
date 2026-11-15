<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { PynAccountSettings, accountNavItems } from '@avalon-initiative/pyn-common-ui'
import { useRoute } from 'vue-router'
import { fetchSignInOptions } from '../api/auth'

const route = useRoute()
const hasProvider = ref(false)
onMounted(async () => {
  hasProvider.value = !!(await fetchSignInOptions().catch(() => null))?.external
})
const items = computed(() => [
  ...accountNavItems(hasProvider.value),
  { id: 'delete-account', label: 'Delete account', href: '/_/settings/delete' },
])
const current = computed(() => String(route.name ?? ''))
</script>

<template>
  <PynAccountSettings :items="items" :current="current"><RouterView /></PynAccountSettings>
</template>
