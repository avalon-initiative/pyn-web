<script setup lang="ts">
import {
  PynOrgList,
  sortOrgs,
  PynViewAction,
  PynViewError,
  PynViewHeader,
} from '@avalon-initiative/pyn-common-ui'
import { onMounted, ref } from 'vue'
import { listMyOrgs } from '../api/orgs'
import { useAction } from '../state/action.state'
import type { OrgInfo } from '@avalon-initiative/pyn-common-ui'

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
  <PynViewHeader title="Organizations">
    <PynViewAction href="/_/new-org" primary>New organization</PynViewAction>
  </PynViewHeader>
  <PynViewError v-if="error">{{ error }}</PynViewError>
  <PynOrgList v-else-if="loaded" :orgs="orgs" />
</template>
