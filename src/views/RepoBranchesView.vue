<script setup lang="ts">
import { PynBranchDialog, PynBranchesPage, repoPath } from '@avalon-initiative/pyn-common-ui'
import type { BranchListItem, BranchView } from '@avalon-initiative/pyn-common-ui'
import { computed, inject, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { createBranch, deleteBranch, listBranches, renameBranch } from '../api/repos'
import { useAction } from '../state/action.state'
import { useBranchDialog } from '../state/branch-dialog.state'
import { repoKey, sessionKey } from '../state/context.state'
import { canWrite } from '../state/freeze.state'
import type { Branch } from '../types/repo.types'

const { target, permissions, frozen, reloadBranches } = inject(repoKey)!
const session = inject(sessionKey, undefined)
const route = useRoute()
const query = ref('')
const VIEWS: BranchView[] = ['yours', 'active', 'stale', 'all']
const view = computed<BranchView>(() => VIEWS.find((v) => v === route.query.view) ?? 'branches')
const base = computed(() => repoPath(target.value, 'branches'))
const hrefs = computed(() => ({
  branches: base.value,
  ...Object.fromEntries(VIEWS.map((v) => [v, `${base.value}?view=${v}`])),
}))
const writable = computed(() => canWrite(permissions.value.includes('checkin'), frozen.value))
const branches = ref<Branch[]>([])
const loading = ref(true)
const { error, attempt } = useAction()
let seq = 0

async function load() {
  const mine = ++seq
  const t = target.value
  loading.value = true
  await attempt(async () => {
    const list = await listBranches(t)
    if (mine === seq) branches.value = list
  })
  if (mine === seq) loading.value = false
}

const items = computed<BranchListItem[]>(() =>
  branches.value.map((b) => {
    const href = repoPath(target.value, '', b.default ? undefined : b.name)
    return {
      name: b.name,
      isDefault: b.default,
      updatedAt: b.updated_at,
      updatedBy: b.updated_by ? { username: b.updated_by } : undefined,
      href,
      ...(b.default
        ? {}
        : { compareHref: href, ahead: b.ahead, behind: b.behind, countsCapped: b.counts_capped }),
    }
  }),
)

const names = (keep: (b: Branch) => boolean | undefined) =>
  branches.value.filter(keep).map((b) => b.name)
// Nothing is yours without a sign-in, so that view stays hidden.
const yours = computed(() => (session?.user.value ? names((b) => b.yours) : undefined))

async function reload() {
  await load()
  await reloadBranches?.()
}

const dialog = useBranchDialog({
  create: async (name, from) => {
    await createBranch(target.value, name, from)
    await reload()
  },
  remove: async (name, force) => {
    await deleteBranch(target.value, name, force)
    await reload()
  },
})

function rename(name: string, newName: string) {
  void attempt(async () => {
    await renameBranch(target.value, name, newName)
    await reload()
  })
}

onMounted(load)
watch(target, () => {
  branches.value = []
  void load()
})
</script>

<template>
  <PynBranchesPage
    v-model:query="query"
    :branches="items"
    :view="view"
    :hrefs="hrefs"
    :yours="yours"
    :active="names((b) => b.active)"
    :stale="names((b) => b.stale)"
    :can-create="writable"
    :can-delete="writable"
    :can-rename="writable"
    :loading="loading"
    :error="error || undefined"
    :default-branch="branches.find((b) => b.default)?.name"
    @new-branch="dialog.openCreate()"
    @delete="dialog.openDelete"
    @rename="rename"
  />
  <PynBranchDialog
    :open="dialog.open.value"
    :mode="dialog.mode.value"
    :name="dialog.name.value"
    :from="dialog.from.value"
    :branches="items"
    :unmerged="dialog.unmerged.value"
    :busy="dialog.busy.value"
    :error="dialog.error.value || undefined"
    @close="dialog.close"
    @create="dialog.create"
    @delete="dialog.remove"
  />
</template>
