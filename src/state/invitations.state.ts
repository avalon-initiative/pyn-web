import { computed, ref } from 'vue'
import type { OrgInvitation } from '@avalon-initiative/pyn-common-ui'

/** The signed-in user's pending invitations. */
export const myInvitations = ref<OrgInvitation[]>([])
export const pendingInvitations = computed(() => myInvitations.value.length)
