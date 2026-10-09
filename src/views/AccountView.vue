<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import PynAccountSettings from '../components/PynAccountSettings.vue'
import { accountNav } from '../state/shell.state'

const route = useRoute()
const current = computed(() => String(route.name ?? ''))
</script>

<template>
  <PynAccountSettings :items="accountNav" :current="current"><RouterView /></PynAccountSettings>
</template>
