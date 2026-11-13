<script setup lang="ts">
import { PynAdminLayout, PynPageNotFound, adminNavItems } from '@avalon-initiative/pyn-common-ui'
import { computed, inject } from 'vue'
import { useRoute } from 'vue-router'
import { sessionKey } from '../state/context.state'

const { admin } = inject(sessionKey)!
const route = useRoute()
const current = computed(() => String(route.name ?? '').replace(/^admin-/, ''))
</script>

<template>
  <PynPageNotFound v-if="!admin" />
  <PynAdminLayout v-else :items="adminNavItems()" :current="current"><RouterView /></PynAdminLayout>
</template>
