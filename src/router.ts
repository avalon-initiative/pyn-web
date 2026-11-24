import { createRouter, createWebHistory } from 'vue-router'
import type { RouteLocationNormalized, RouteRecordRaw, RouterHistory } from 'vue-router'
import { trackPrevious } from './state/navigation.state'
import { scrollToHash } from './state/hash.state'
import { passwordChangeGuard } from './state/password-change.state'
import AdminAccessView from './views/AdminAccessView.vue'
import AdminAccessSessionsView from './views/AdminAccessSessionsView.vue'
import AdminAuditView from './views/AdminAuditView.vue'
import AdminInvitationsView from './views/AdminInvitationsView.vue'
import AdminAccountsView from './views/AdminAccountsView.vue'
import AdminWebhooksView from './views/AdminWebhooksView.vue'
import AdminTwoFactorView from './views/AdminTwoFactorView.vue'
import AdminView from './views/AdminView.vue'
import AccountView from './views/AccountView.vue'
import InvitationsView from './views/InvitationsView.vue'
import KeysView from './views/KeysView.vue'
import IdentitiesView from './views/IdentitiesView.vue'
import TokensView from './views/TokensView.vue'
import MyLocksView from './views/MyLocksView.vue'
import EmailAddressesView from './views/EmailAddressesView.vue'
import ProfileSettingsView from './views/ProfileSettingsView.vue'
import UsernameView from './views/UsernameView.vue'
import DeleteAccountView from './views/DeleteAccountView.vue'
import PasswordView from './views/PasswordView.vue'
import SecurityView from './views/SecurityView.vue'
import NotFoundView from './views/NotFoundView.vue'
import NewRepoView from './views/NewRepoView.vue'
import RepoBlobView from './views/RepoBlobView.vue'
import RepoAuditView from './views/RepoAuditView.vue'
import RepoBranchesView from './views/RepoBranchesView.vue'
import RepoFilesView from './views/RepoFilesView.vue'
import RepoHistoryView from './views/RepoHistoryView.vue'
import RepoLocksView from './views/RepoLocksView.vue'
import RepoMembersView from './views/RepoMembersView.vue'
import RepoRolesView from './views/RepoRolesView.vue'
import RepoGeneralView from './views/RepoGeneralView.vue'
import RepoPolicyReadView from './views/RepoPolicyReadView.vue'
import RepoPolicyView from './views/RepoPolicyView.vue'
import RepoSettingsLayout from './views/RepoSettingsLayout.vue'
import RepoStorageView from './views/RepoStorageView.vue'
import VerifyEmailView from './views/VerifyEmailView.vue'
import NewOrgView from './views/NewOrgView.vue'
import OrgAuditView from './views/OrgAuditView.vue'
import OrgMembersView from './views/OrgMembersView.vue'
import OrgPolicyView from './views/OrgPolicyView.vue'
import OrgSettingsLayout from './views/OrgSettingsLayout.vue'
import OrgSettingsView from './views/OrgSettingsView.vue'
import OrgTeamsView from './views/OrgTeamsView.vue'
import OrgTeamView from './views/OrgTeamView.vue'
import PeopleView from './views/PeopleView.vue'
import OrgsView from './views/OrgsView.vue'
import OrgView from './views/OrgView.vue'
import OwnerUsageView from './views/OwnerUsageView.vue'
import OwnerView from './views/OwnerView.vue'
import RepoView from './views/RepoView.vue'
import ReposView from './views/ReposView.vue'
import ExploreView from './views/ExploreView.vue'
import DashboardView from './views/DashboardView.vue'
import { recentFor, recordRecent } from './state/recent.state'

const settingsRedirect =
  (section: string) => (to: Pick<RouteLocationNormalized, 'params' | 'query' | 'hash'>) => ({
    name: `settings-${section}`,
    params: to.params,
    query: to.query,
    hash: to.hash,
  })

// Account pages live under "/_/" and organization pages under "/:owner/-/": neither "_" nor "-" can be a
// user, organization or repository name. The owner pattern excludes "_" so unknown "/_/..." paths reach
// the catch-all.
export const ownerParam = ':owner([^/_][^/]*|_[^/]+)'

export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'dashboard', component: DashboardView },
  { path: '/_/repos', name: 'repos', component: ReposView, meta: { crumb: 'Repositories' } },
  { path: '/_/explore', name: 'explore', component: ExploreView, meta: { public: true } },
  { path: '/verify-email', name: 'verify-email', component: VerifyEmailView },
  { path: '/_/people', name: 'people', component: PeopleView, meta: { public: true } },
  { path: '/_/locks', name: 'my-locks', component: MyLocksView },
  {
    path: '/_/admin',
    component: AdminView,
    children: [
      { path: '', redirect: '/_/admin/accounts' },
      { path: 'accounts', name: 'admin-accounts', component: AdminAccountsView },
      { path: 'invitations', name: 'admin-invitations', component: AdminInvitationsView },
      { path: 'access', name: 'admin-access', component: AdminAccessView },
      { path: 'two-factor', name: 'admin-two-factor', component: AdminTwoFactorView },
      {
        path: 'access-sessions',
        name: 'admin-access-sessions',
        component: AdminAccessSessionsView,
      },
      { path: 'audit', name: 'admin-audit', component: AdminAuditView },
      { path: 'webhooks', name: 'admin-webhooks', component: AdminWebhooksView },
    ],
  },
  { path: '/_/new', name: 'new-repo', component: NewRepoView },
  { path: '/_/new-org', name: 'new-org', component: NewOrgView },
  { path: '/_/orgs', name: 'orgs', component: OrgsView },
  { path: '/_/invitations', name: 'invitations', component: InvitationsView },
  {
    path: '/_/settings',
    component: AccountView,
    children: [
      { path: '', redirect: '/_/settings/profile' },
      { path: 'profile', name: 'profile-settings', component: ProfileSettingsView },
      { path: 'emails', name: 'emails', component: EmailAddressesView },
      { path: 'username', name: 'username', component: UsernameView },
      { path: 'password', name: 'password', component: PasswordView },
      { path: 'security', name: 'security', component: SecurityView },
      { path: 'keys', name: 'keys', component: KeysView },
      { path: 'tokens', name: 'tokens', component: TokensView },
      { path: 'identities', name: 'identities', component: IdentitiesView },
      { path: 'delete', name: 'delete-account', component: DeleteAccountView },
    ],
  },
  { path: `/${ownerParam}/-`, redirect: { name: 'owner' } },
  {
    path: `/${ownerParam}`,
    component: OrgView,
    children: [
      { path: '', name: 'owner', component: OwnerView, meta: { public: true } },
      {
        path: '-/repositories',
        name: 'owner-repositories',
        component: OwnerView,
        meta: { public: true },
      },
      { path: '-/usage', name: 'owner-usage', component: OwnerUsageView },
      { path: '-/members', name: 'org-members', component: OrgMembersView },
      { path: '-/teams', name: 'org-teams', component: OrgTeamsView },
      { path: '-/teams/:team', name: 'org-team', component: OrgTeamView },
      { path: '-/audit', name: 'org-audit', component: OrgAuditView },
      {
        path: '-/settings',
        component: OrgSettingsLayout,
        children: [
          { path: '', name: 'org-settings', component: OrgSettingsView },
          { path: 'members', name: 'org-settings-members', component: OrgMembersView },
          { path: 'teams', name: 'org-settings-teams', component: OrgTeamsView },
          { path: 'policy', name: 'org-settings-policy', component: OrgPolicyView },
          { path: 'usage', name: 'org-settings-usage', component: OwnerUsageView },
          { path: 'audit', name: 'org-settings-audit', component: OrgAuditView },
        ],
      },
    ],
  },
  {
    path: `/${ownerParam}/:name`,
    component: RepoView,
    children: [
      { path: '', name: 'files', component: RepoFilesView, meta: { public: true } },
      { path: 'tree/:path(.*)?', name: 'tree', component: RepoFilesView, meta: { public: true } },
      {
        path: 'blob/:path(.+)',
        name: 'blob',
        component: RepoBlobView,
        meta: { public: true, wide: true },
      },
      { path: 'locks', name: 'locks', component: RepoLocksView, meta: { public: true } },
      { path: 'history', name: 'history', component: RepoHistoryView, meta: { public: true } },
      { path: 'branches', name: 'branches', component: RepoBranchesView },
      { path: 'policy', name: 'policy', component: RepoPolicyReadView, meta: { wide: true } },
      ...['members', 'roles', 'audit'].map((section) => ({
        path: section,
        redirect: settingsRedirect(section),
      })),
      { path: 'invites', redirect: settingsRedirect('members') },
      {
        path: 'settings',
        component: RepoSettingsLayout,
        children: [
          { path: '', name: 'settings', component: RepoGeneralView },
          { path: 'members', name: 'settings-members', component: RepoMembersView },
          { path: 'roles', name: 'settings-roles', component: RepoRolesView },
          { path: 'invites', redirect: settingsRedirect('members') },
          {
            path: 'policy',
            name: 'settings-policy',
            component: RepoPolicyView,
            meta: { wide: true },
          },
          { path: 'storage', name: 'settings-storage', component: RepoStorageView },
          { path: 'audit', name: 'settings-audit', component: RepoAuditView },
        ],
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: NotFoundView,
    meta: { public: true },
  },
]

export const makeRouter = (
  history: RouterHistory = createWebHistory(),
  extraRoutes: RouteRecordRaw[] = [],
) => {
  const router = createRouter({
    history,
    routes: [...routes, ...extraRoutes],
    scrollBehavior(to) {
      if (to.hash) scrollToHash(to.hash)
    },
  })
  router.beforeEach(passwordChangeGuard)
  trackPrevious(router)
  router.afterEach((to, _from, failure) => {
    const item = failure ? null : recentFor(to)
    if (item) recordRecent(item)
  })
  return router
}
