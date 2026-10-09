<script setup lang="ts">
import { useRouter } from 'vue-router'
import { createOrg } from '../api/orgs'
import PynOrgForm from '../components/PynOrgForm.vue'
import { useAction } from '../state/action.state'
import { orgPath } from '../state/org.state'
import styles from '../styles/View.module.scss'

const router = useRouter()
const { busy, error, attempt } = useAction()

const create = (name: string) =>
  attempt(async () => {
    const org = await createOrg(name)
    await router.push(orgPath(org.name))
  })
</script>

<template>
  <header :class="styles.header">
    <h1 :class="styles.title">New organization</h1>
  </header>
  <PynOrgForm :busy="busy" :error="error" @submit="create" />
</template>
