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
const current = computed(() => String(route.name ?? ''))
</script>

<template>
  <PynAccountSettings :items="accountNavItems(hasProvider)" :current="current"
    ><RouterView
  /></PynAccountSettings>
</template>
