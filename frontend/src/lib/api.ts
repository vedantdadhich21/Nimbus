import type { NimbusApi } from './types'
import { mockApi } from './api-mock'
import { httpApi } from './api-http'

// One switch, one place. The UI never knows which adapter is behind it.
export const API_MODE: 'mock' | 'http' =
  import.meta.env.VITE_API_MODE === 'http' ? 'http' : 'mock'

export const IS_MOCK = API_MODE === 'mock'

export const api: NimbusApi = IS_MOCK ? mockApi : httpApi
