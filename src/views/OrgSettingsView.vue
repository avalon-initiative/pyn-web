<script setup lang="ts">
import { inject } from 'vue'
import { useRouter } from 'vue-router'
import { deleteOrg } from '../api/orgs'
import PynOrgDelete from '../components/PynOrgDelete.vue'
import PynPageNotFound from '../components/PynPageNotFound.vue'
import { useAction } from '../state/action.state'
import { orgKey } from '../state/context.state'
import { isOrgOwner } from '../state/org.state'

const { name, org } = inject(orgKey)!
const router = useRouter()
const { busy, error, attempt } = useAction()

const remove = () =>
  attempt(async () => {
    await deleteOrg(name.value)
    await router.push('/_/orgs')
  })
</script>

<template>
  <PynOrgDelete v-if="isOrgOwner(org)" :name="name" :busy="busy" :error="error" @remove="remove" />
  <PynPageNotFound v-else />
</template>
