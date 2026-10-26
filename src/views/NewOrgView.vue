<script setup lang="ts">
import { PynOrgForm, orgPath, PynViewHeader } from '@avalon-initiative/pyn-common-ui'
import { useRouter } from 'vue-router'
import { createOrg } from '../api/orgs'
import { useAction } from '../state/action.state'
import { useNameCheck } from '../state/name.state'

const router = useRouter()
const { busy, error, attempt } = useAction()
const { nameMessage, checkName } = useNameCheck()

const create = (name: string) =>
  attempt(async () => {
    const org = await createOrg(name)
    await router.push(orgPath(org.name))
  })
</script>

<template>
  <PynViewHeader title="New organization" />
  <PynOrgForm
    :busy="busy"
    :error="error"
    :name-message="nameMessage"
    @name-input="checkName"
    @submit="create"
  />
</template>
