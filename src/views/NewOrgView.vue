<script setup lang="ts">
import { PynOrgForm, orgPath, PynViewAction, PynViewHeader } from '@avalon-initiative/pyn-common-ui'
import { useRouter } from 'vue-router'
import { createOrg } from '../api/orgs'
import { refreshOrgs } from '../state/session-data.state'
import { useAction } from '../state/action.state'
import { canonicalName, describeNameError, nameProblem, useNameCheck } from '../state/name.state'
import { ref } from 'vue'

const router = useRouter()
const typed = ref('')
const { busy, error, attempt } = useAction(true, (e) => describeNameError(e, typed.value))
const { nameMessage, nameCanonical, checkName } = useNameCheck()

const create = (name: string) =>
  attempt(async () => {
    typed.value = canonicalName(name)
    const problem = nameProblem(name)
    if (problem) {
      error.value = problem
      return
    }
    const org = await createOrg(typed.value)
    void refreshOrgs()
    await router.push(orgPath(org.name))
  })
</script>

<template>
  <PynViewHeader title="New organization">
    <PynViewAction href="/_/orgs">Cancel</PynViewAction>
  </PynViewHeader>
  <PynOrgForm
    :busy="busy"
    :error="error"
    :name-message="nameMessage"
    :name-canonical="nameCanonical"
    @name-input="checkName"
    @submit="create"
  />
</template>
