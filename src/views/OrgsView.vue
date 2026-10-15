<script setup lang="ts">
import { PynOrgList, sortOrgs } from '@avalon-initiative/pyn-common-ui'
import { onMounted, ref } from 'vue'
import { listMyOrgs } from '../api/orgs'
import { useAction } from '../state/action.state'
import styles from '../styles/View.module.scss'
import type { OrgInfo } from '../types/org.types'

const orgs = ref<OrgInfo[]>([])
const loaded = ref(false)
const { error, attempt } = useAction()

onMounted(async () => {
  await attempt(async () => {
    orgs.value = sortOrgs(await listMyOrgs())
  })
  loaded.value = true
})
</script>

<template>
  <header :class="styles.header">
    <h1 :class="styles.title">Organizations</h1>
    <span :class="styles.actions">
      <a href="/_/new-org" :class="styles.action">New organization</a>
    </span>
  </header>
  <p v-if="error" :class="styles.error" role="alert">{{ error }}</p>
  <PynOrgList v-else-if="loaded" :orgs="orgs" />
</template>
