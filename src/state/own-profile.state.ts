import { ref } from 'vue'
import type { Profile } from '../api/profile'

/** The signed-in account's own profile, shown in the top bar. */
export const ownProfile = ref<Profile>({})
