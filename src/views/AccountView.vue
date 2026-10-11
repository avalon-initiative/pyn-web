<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import PynAccountSettings from '../components/PynAccountSettings.vue'
import { fetchSignInOptions } from '../api/auth'
import { accountNavItems } from '../state/shell.state'

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
