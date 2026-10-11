import type { Meta, StoryObj } from '@storybook/vue3'
import PynSignIn from '../components/PynSignIn.vue'

const meta: Meta<typeof PynSignIn> = {
  title: 'Account/PynSignIn',
  component: PynSignIn,
  args: { registration: 'invite' },
}
export default meta
type Story = StoryObj<typeof PynSignIn>

export const InviteOnlyServer: Story = {}
export const OpenServer: Story = { args: { registration: 'open' } }
export const ClosedServer: Story = { args: { registration: 'closed' } }
export const WrongPassword: Story = {
  args: { error: 'authentication failed: wrong user name or password' },
}
export const OpenServerWithVerification: Story = {
  args: { registration: 'open', emailVerification: true },
}
export const RateLimited: Story = {
  args: { error: 'Too many attempts. Try again in 12 minutes.' },
}
export const EmailNotVerified: Story = {
  args: {
    registration: 'open',
    emailVerification: true,
    notice: { status: 'pending_verification', user: 'wendy' },
  },
}
export const VerificationResent: Story = {
  args: {
    registration: 'open',
    emailVerification: true,
    notice: { status: 'pending_verification', user: 'wendy' },
    resent: true,
  },
}
export const AwaitingApproval: Story = {
  args: { notice: { status: 'pending_approval', user: 'wendy' } },
}
export const AccountDisabled: Story = {
  args: { notice: { status: 'account_disabled', user: 'wendy' } },
}
export const WithProvider: Story = {
  args: { external: { name: 'Acme SSO', sign_in_url: '/v1/oidc/authorize' } },
}
export const ProviderOnly: Story = {
  args: {
    passwordSignIn: false,
    external: { name: 'Acme SSO', sign_in_url: '/v1/oidc/authorize' },
  },
}
export const ProviderRefusedAccount: Story = {
  args: {
    external: { name: 'Acme SSO', sign_in_url: '/v1/oidc/authorize' },
    callbackError: 'external_account_not_linked',
  },
}
