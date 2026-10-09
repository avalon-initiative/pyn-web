<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue'
import { listRoles, setRole } from '../api/repos'
import PynRoles from '../components/PynRoles.vue'
import { useAction } from '../state/action.state'
import { repoKey } from '../state/context.state'
import type { RoleGrant } from '../types/repo.types'

const { target, permissions } = inject(repoKey)!
const grants = ref<RoleGrant[]>([])
const loaded = ref(false)
const { busy, error, attempt } = useAction()
const canEdit = computed(() => permissions.value.includes('manage_roles'))

const load = async () => {
  grants.value = await listRoles(target.value)
}

const save = (g: RoleGrant) =>
  attempt(async () => {
    await setRole(target.value, g.role, g.permissions)
    await load()
  })

onMounted(async () => {
  await attempt(load)
  loaded.value = true
})
</script>

<template>
  <PynRoles
    v-if="loaded"
    :key="JSON.stringify(grants)"
    :grants="grants"
    :can-edit="canEdit"
    :busy="busy"
    :error="error"
    @save="save"
  />
  <p v-else-if="error" role="alert">{{ error }}</p>
</template>
