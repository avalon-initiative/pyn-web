<script setup lang="ts">
import {
  PynEmptyState,
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
  <template v-else-if="loaded">
    <PynOrgList v-if="orgs.length" :orgs="orgs" />
    <PynEmptyState
      v-else
      title="You are not in any organization yet"
      description="An organization lets a team share repositories and roles."
      primary-label="Create an organization"
      primary-href="/_/new-org"
    />
  </template>
</template>
