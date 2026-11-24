<script setup lang="ts">
import { PynBranchDialog, PynBranchesPage, repoPath } from '@avalon-initiative/pyn-common-ui'
import type { BranchListItem, BranchView } from '@avalon-initiative/pyn-common-ui'
import { computed, inject, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { compareBranch, createBranch, deleteBranch, listBranches, renameBranch } from '../api/repos'
import { useAction } from '../state/action.state'
import { useBranchDialog } from '../state/branch-dialog.state'
import { repoKey } from '../state/context.state'
import { canWrite } from '../state/freeze.state'
import type { Branch } from '../types/repo.types'

const COMPARE_LIMIT = 20

const { target, permissions, frozen, reloadBranches } = inject(repoKey)!
const route = useRoute()
const query = ref('')
const view = computed<BranchView>(() => (route.query.view === 'all' ? 'all' : 'branches'))
const base = computed(() => repoPath(target.value, 'branches'))
const hrefs = computed(() => ({ branches: base.value, all: `${base.value}?view=all` }))
const writable = computed(() => canWrite(permissions.value.includes('checkin'), frozen.value))
const branches = ref<Branch[]>([])
const counts = ref<Record<string, { ahead: number; behind: number }>>({})
const loading = ref(true)
const { error, attempt } = useAction()
let seq = 0

// Ahead and behind come from the compare summary; a branch it fails for shows none.
async function compareAll(t: typeof target.value, list: Branch[], mine: number) {
  const others = list.filter((b) => !b.default).slice(0, COMPARE_LIMIT)
  await Promise.all(
    others.map(async (b) => {
      try {
        const c = await compareBranch(t, b.name)
        if (mine === seq) counts.value[b.name] = { ahead: c.ahead, behind: c.behind }
      } catch {
        // No counts for this branch.
      }
    }),
  )
}

async function load() {
  const mine = ++seq
  const t = target.value
  loading.value = true
  counts.value = {}
  await attempt(async () => {
    const list = await listBranches(t)
    if (mine !== seq) return
    branches.value = list
    loading.value = false
    await compareAll(t, list, mine)
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
      href,
      ...(b.default ? {} : { compareHref: href, ...counts.value[b.name] }),
    }
  }),
)

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
