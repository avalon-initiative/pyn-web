import { ref } from 'vue'
import type { Profile } from '../api/profile'

/** The signed-in account's own profile, shown in the top bar and side nav. */
export const ownProfile = ref<Profile>({})
