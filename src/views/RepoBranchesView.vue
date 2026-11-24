<script setup lang="ts">
import { PynBranchesPage, repoPath } from '@avalon-initiative/pyn-common-ui'
import type { BranchListItem, BranchView } from '@avalon-initiative/pyn-common-ui'
import { computed, inject, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ApiError } from '../api/client'
import { compareBranch, createBranch, deleteBranch, listBranches } from '../api/repos'
import { useAction } from '../state/action.state'
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

function newBranch() {
  const name = window.prompt('Name of the new branch')?.trim()
  if (!name) return
  void attempt(async () => {
    await createBranch(target.value, name)
    await reload()
  })
}

function remove(name: string) {
  if (!window.confirm(`Delete the branch ${name}? Its revisions stay in the history.`)) return
  void attempt(async () => {
    try {
      await deleteBranch(target.value, name)
    } catch (e) {
      const unmerged = e instanceof ApiError && e.code === 'branch_not_merged'
      if (
        !unmerged ||
        !window.confirm(`${name} has changes that are not on the default branch. Delete it anyway?`)
      ) {
        if (!unmerged) throw e
        return
      }
      await deleteBranch(target.value, name, true)
    }
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
    :loading="loading"
    :error="error || undefined"
    :default-branch="branches.find((b) => b.default)?.name"
    @new-branch="newBranch"
    @delete="remove"
  />
</template>
