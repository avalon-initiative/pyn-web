<script setup lang="ts">
import {
  type AccessAdd,
  type AccessRow,
  type AccessTab,
  type InviteInfo,
  type Member,
  type NewUser,
  type RepoTeam,
  type TeamInfo,
  PynLoading,
  PynRepoCollaborators,
  orgPath,
  personGrantees,
  repoPath,
  teamGrantees,
  ungrantedTeams,
} from '@avalon-initiative/pyn-common-ui'
import { computed, inject, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  addUser,
  createInvite,
  listInvites,
  listMembers,
  listRoles,
  revokeInvite,
  setMember,
} from '../api/repos'
import { listTeams, listRepoTeams, removeRepoTeam, setRepoTeam } from '../api/teams'
import { useAction } from '../state/action.state'
import { repoKey, sessionKey } from '../state/context.state'
import { isRepoOwner } from '../state/repo-access.state'

const PAGE_SIZE = 30
const { target, repo, permissions, org, frozen } = inject(repoKey)!
const { user } = inject(sessionKey)!
const router = useRouter()
const members = ref<Member[]>([])
const roles = ref<string[]>([])
const granted = ref<RepoTeam[]>([])
const orgTeams = ref<TeamInfo[]>([])
const invites = ref<InviteInfo[]>([])
const inviteCode = ref('')
const loaded = ref(false)
const tab = ref<AccessTab>('direct')
const query = ref('')
const adding = ref<AccessAdd>()
const type = ref('all')
const role = ref('all')
const page = ref(1)
const loading = useAction()
const people = useAction()
const teams = useAction()
const granting = useAction()
const inviting = useAction()

const manage = computed(() => permissions.value.includes('manage_users'))
const showTeams = computed(() => org.value !== null && manage.value)
const isOwner = computed(() => isRepoOwner(target.value.owner, user.value, org.value))

async function load() {
  members.value = await listMembers(target.value)
  roles.value = (await listRoles(target.value)).map((g) => g.role)
  invites.value = await listInvites(target.value)
  if (!showTeams.value) return
  granted.value = await listRepoTeams(target.value)
  orgTeams.value = await listTeams(target.value.owner)
}

const direct = (m: Member) => m.source === 'direct'
const allRows = computed<Record<AccessTab, AccessRow[]>>(() => {
  const person = (list: Member[]): AccessRow[] =>
    personGrantees(list).map((g) => ({ ...g, kind: 'person' }))
  const team: AccessRow[] = teamGrantees(target.value.owner, granted.value).map((g) => ({
    ...g,
    kind: 'team',
  }))
  return {
    direct: [...person(members.value.filter(direct)), ...team],
    organization: person(members.value.filter((m) => !direct(m))),
  }
})
const matching = computed(() => {
  const q = query.value.trim().toLowerCase()
  return allRows.value[tab.value].filter(
    (r) =>
      (type.value === 'all' || r.kind === type.value) &&
      (role.value === 'all' || r.role === role.value) &&
      r.name.toLowerCase().includes(q),
  )
})
const rows = computed(() =>
  matching.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE),
)
const countOf = (rs: AccessRow[], kind: AccessRow['kind']) =>
  rs.filter((r) => r.kind === kind).length

const filter = (id: string, value: string) => {
  if (id === 'type') type.value = value
  else if (id === 'role') role.value = value
}
watch([tab, query, type, role], () => (page.value = 1))

const run = (state: ReturnType<typeof useAction>, action: () => Promise<void>) =>
  state.attempt(async () => {
    await action()
    await load()
  })

const setRole = (c: { name: string; role: string }) =>
  run(people, async () => {
    const team = granted.value.some((t) => t.slug === c.name) && tab.value === 'direct'
    if (team) await setRepoTeam(target.value, c.name, c.role)
    else await setMember(target.value, c.name, c.role)
  })
const add = (u: NewUser) =>
  run(people, async () => {
    await addUser(target.value, u)
  })
const grant = (c: { name: string; role: string }) =>
  run(granting, () => setRepoTeam(target.value, c.name, c.role))
const revoke = (slug: string) => run(teams, () => removeRepoTeam(target.value, slug))
const invite = (f: { role: string; hours: number }) =>
  run(inviting, async () => {
    inviteCode.value = (await createInvite(target.value, f.role, f.hours)).code
  })
const dropInvite = (id: string) => run(inviting, () => revokeInvite(target.value, id))

const busy = computed(() => people.busy.value || teams.busy.value)
const error = computed(() => loading.error.value || people.error.value || teams.error.value)

onMounted(async () => {
  await loading.attempt(load)
  loaded.value = true
})
</script>

<template>
  <PynRepoCollaborators
    v-if="loaded"
    v-model:tab="tab"
    v-model:query="query"
    v-model:adding="adding"
    :rows="rows"
    :count="matching.length"
    :roles="roles"
    :visibility="repo?.visibility"
    :can-manage-visibility="isOwner && !frozen"
    :direct-people="countOf(allRows.direct, 'person')"
    :direct-teams="countOf(allRows.direct, 'team')"
    :org-people="countOf(allRows.organization, 'person')"
    :org-teams="0"
    :organization="org?.name"
    :organization-href="org ? orgPath(org.name) : undefined"
    :type="type"
    :role="role"
    :page="page"
    :page-size="PAGE_SIZE"
    :can-manage="manage && !frozen"
    :busy="busy"
    :error="error"
    :teams="ungrantedTeams(orgTeams, granted)"
    :invites="invites"
    :invite-code="inviteCode"
    :add-person-error="people.error.value"
    :grant-error="granting.error.value"
    :invite-error="inviting.error.value"
    @manage-visibility="router.push(repoPath(target, 'settings'))"
    @create-team="org && router.push(orgPath(org.name, 'teams'))"
    @filter="filter"
    @update:page="page = $event"
    @set-role="setRole"
    @revoke="revoke"
    @add-user="add"
    @grant="grant"
    @create-invite="invite"
    @revoke-invite="dropInvite"
  />
  <p v-else-if="loading.error.value" role="alert">{{ loading.error.value }}</p>
  <PynLoading v-else />
</template>
